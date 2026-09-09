#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import process from "node:process";
import readline from "node:readline";
import { composePools, parseStreamTextDetailed } from "./compose.mjs";

const execFileAsync = promisify(execFile);
export const PROTOCOL_VERSION = "2025-06-18";
export const NETWORKS = new Set(["base", "robinhood"]);
export const SUBSTREAMS_PACKAGE = "v4-pool-index@v0.1.1";
export const POOL_ID_PATTERN = /^0x[0-9a-f]{64}$/i;
const MAX_OUTPUT_BYTES = 1_000_000;
const QUERY_TIMEOUT_MS = 30_000;
const DEFAULT_WINDOWS = Object.freeze({
  base: { startBlock: 50_994_246, span: 1 },
  robinhood: { startBlock: 56_764_780, span: 1 },
});

export class McpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function safePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!/^[1-9][0-9]*$/.test(String(value))) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function queryWindows(env = process.env) {
  return Object.fromEntries(Object.entries(DEFAULT_WINDOWS).map(([network, defaults]) => [network, {
    startBlock: safePositiveInteger(env[`MCP_${network.toUpperCase()}_START_BLOCK`], defaults.startBlock),
    span: Math.min(safePositiveInteger(env.MCP_BLOCK_SPAN, defaults.span), 100),
  }]));
}

export function validateArguments(argumentsValue) {
  const args = argumentsValue && typeof argumentsValue === "object" && !Array.isArray(argumentsValue) ? argumentsValue : null;
  if (!args) throw new McpError("INVALID_ARGUMENTS", "arguments must be an object with pool_id and network");
  const network = String(args.network ?? "").toLowerCase();
  if (!NETWORKS.has(network)) throw new McpError("INVALID_NETWORK", "network must be one of: base, robinhood");
  const poolId = String(args.pool_id ?? "").toLowerCase();
  if (!POOL_ID_PATTERN.test(poolId)) throw new McpError("INVALID_POOL_ID", "pool_id must be a 0x-prefixed 32-byte hexadecimal value");
  return { network, poolId };
}

function toolDefinition(name, description) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["pool_id", "network"],
      properties: {
        pool_id: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$", description: "Uniswap v4 PoolId (bytes32)." },
        network: { type: "string", enum: ["base", "robinhood"], description: "Network selected by the existing Substreams manifest." },
      },
    },
  };
}

export const TOOLS = Object.freeze([
  toolDefinition("resolve_pool", "Resolve one v4 pool from bounded map_initialize output and attach available token metadata."),
  toolDefinition("assess_pool", "Resolve one v4 pool and return the existing deterministic technical verdict, reasons, provenance, and scope."),
]);

function sourceError(error) {
  if (error instanceof McpError) return error;
  return new McpError("SOURCE_UNAVAILABLE", "bounded Substreams Initialize query did not complete");
}

export function buildSubstreamsArgs({ network, startBlock, span }) {
  return [
    "run", SUBSTREAMS_PACKAGE, "map_initialize", "--network", network,
    "--start-block", String(startBlock), "--stop-block", "+" + String(span),
    "--output", "jsonl", "--limit-processed-blocks", String(Math.max(span + 2, 10)),
    "--max-retries", "0", "--final-blocks-only",
  ];
}

export async function loadPool({ poolId, network, env = process.env, execute = execFileAsync }) {
  const token = String(env.THEGRAPH_TOKEN ?? "").trim();
  if (!token) throw new McpError("MISSING_TOKEN", "THEGRAPH_TOKEN is required in the MCP process environment");
  const window = queryWindows(env)[network];
  const args = buildSubstreamsArgs({ network, startBlock: window.startBlock, span: window.span });
  let stdout;
  try {
    ({ stdout } = await execute("substreams", args, {
      timeout: QUERY_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      env: { ...env, SUBSTREAMS_API_TOKEN: token },
      windowsHide: true,
    }));
  } catch (error) {
    throw sourceError(error);
  }
  const parsed = parseStreamTextDetailed(stdout);
  if (parsed.malformedLines.length || parsed.unsupportedLines.length) {
    throw new McpError("SOURCE_PROTOCOL_ERROR", "Substreams returned an unsupported Initialize JSONL record");
  }
  const pool = parsed.pools.find((candidate) => candidate.pool_id === poolId);
  const provenance = {
    source: "Substreams map_initialize",
    package: SUBSTREAMS_PACKAGE,
    network,
    search_window: { start_block: window.startBlock, stop_block_exclusive: window.startBlock + window.span, processed_block_limit: Math.max(window.span + 2, 10) },
  };
  if (!pool) throw new McpError("POOL_NOT_FOUND", `pool_id was not found in the bounded ${network} Initialize window (${window.startBlock}..${window.startBlock + window.span - 1})`);
  let composed;
  try {
    composed = await composePools({ pools: [pool], network, token, limit: 1 });
  } catch (error) {
    throw sourceError(error);
  }
  const resolved = composed.pools[0];
  return {
    pool_id: poolId,
    network,
    pool: {
      currency0: resolved.currency0,
      currency1: resolved.currency1,
      fee: resolved.fee,
      tick_spacing: resolved.tick_spacing,
      hooks: resolved.hooks,
    },
    currencies: resolved.currencies,
    provenance: { ...provenance, token_api: composed.source.token_api, metadata_coverage: composed.source.metadata_coverage },
    scope: resolved.decision.scope,
    decision: resolved.decision,
  };
}

export function assessmentFromResolved(resolved) {
  return {
    pool_id: resolved.pool_id,
    network: resolved.network,
    verdict: resolved.decision.decision,
    checks: resolved.decision.checks,
    reason: resolved.decision.checks.map((check) => `${check.name}: ${check.reason}`),
    provenance: resolved.provenance,
    scope: resolved.scope,
    currencies: resolved.currencies,
  };
}

function asToolResult(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, ...(isError ? { isError: true } : {}) };
}

function toolError(error) {
  const normalized = error instanceof McpError ? error : new McpError("INTERNAL_ERROR", "internal MCP error");
  return asToolResult({ error: { code: normalized.code, message: normalized.message } }, true);
}

export function createHandler({ resolver = loadPool } = {}) {
  return async function handle(message) {
    const id = Object.prototype.hasOwnProperty.call(message ?? {}, "id") ? message.id : null;
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid JSON-RPC request" } };
    }
    if (message.method === "notifications/initialized") return null;
    if (message.method === "initialize") {
      return { jsonrpc: "2.0", id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "v4-pool-index-mcp", version: "0.1.0" } } };
    }
    if (message.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (message.method === "tools/call") {
      const name = message.params?.name;
      if (name !== "resolve_pool" && name !== "assess_pool") return { jsonrpc: "2.0", id, result: toolError(new McpError("UNKNOWN_TOOL", "tool must be resolve_pool or assess_pool")) };
      try {
        const { network, poolId } = validateArguments(message.params?.arguments);
        const resolved = await resolver({ network, poolId });
        const result = name === "resolve_pool"
          ? (({ decision, ...resolution }) => resolution)(resolved)
          : assessmentFromResolved(resolved);
        return { jsonrpc: "2.0", id, result: asToolResult(result) };
      } catch (error) {
        return { jsonrpc: "2.0", id, result: toolError(error) };
      }
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${message.method}` } };
  };
}

export async function serve({ input = process.stdin, output = process.stdout, handler = createHandler() } = {}) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try { message = JSON.parse(line); } catch {
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      continue;
    }
    const response = await handler(message);
    if (response !== null && message.id !== undefined) output.write(`${JSON.stringify(response)}\n`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) serve().catch(() => { process.exitCode = 1; });
