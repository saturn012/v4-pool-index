#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const TOKEN_API_URL = "https://api.pinax.network/v1/evm/tokens";
export const DYNAMIC_FEE_FLAG = 0x800000;
export const MAX_STATIC_FEE_PPM = 10_000;

function hex(value) {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.startsWith("0x") ? text.toLowerCase() : `0x${text.toLowerCase()}`;
}

function asNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function field(object, names) {
  for (const name of names) {
    if (object && object[name] !== undefined && object[name] !== null) return object[name];
  }
  return null;
}

export function normalizePool(value) {
  const pool = value?.pool ?? value;
  const poolId = field(pool, ["pool_id", "poolId", "id"]);
  const currency0 = field(pool, ["currency0", "currency_0"]);
  const currency1 = field(pool, ["currency1", "currency_1"]);
  if (!poolId || !currency0 || !currency1) return null;
  return {
    pool_id: hex(poolId),
    currency0: hex(currency0),
    currency1: hex(currency1),
    fee: asNumber(field(pool, ["fee", "fee_ppm"])),
    tick_spacing: asNumber(field(pool, ["tick_spacing", "tickSpacing"])),
    hooks: hex(field(pool, ["hooks"])) ?? ZERO_ADDRESS,
  };
}

function decodeJsonValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function poolsFromStreamObject(object) {
  const decoded = decodeJsonValue(object);
  const candidates = [decoded, decoded?.value, decoded?.data, decoded?.output, decoded?.["@data"]]
    .map(decodeJsonValue)
    .filter(Boolean);
  for (const candidate of candidates) {
    if (Array.isArray(candidate?.pools)) return candidate.pools.map(normalizePool).filter(Boolean);
    const one = normalizePool(candidate);
    if (one) return [one];
  }
  return [];
}

export function parseStreamText(text) {
  const pools = [];
  for (const line of text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    try {
      pools.push(...poolsFromStreamObject(JSON.parse(line)));
    } catch {
      // Human-readable CLI progress lines are not composable input.
    }
  }
  const seen = new Set();
  return pools.filter((pool) => {
    const key = `${pool.pool_id}:${pool.currency0}:${pool.currency1}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isNativeCurrency(address) {
  return String(address).toLowerCase() === ZERO_ADDRESS;
}

function tokenStatus(metadata) {
  if (!metadata) return { status: "UNKNOWN", reason: "Token API metadata is unavailable" };
  const missing = ["name", "symbol", "decimals"].filter((key) => metadata[key] === null || metadata[key] === undefined);
  if (missing.length) return { status: "UNKNOWN", reason: `Token API omitted ${missing.join(", ")}` };
  const holders = asNumber(metadata.holders);
  if (holders === null) return { status: "UNKNOWN", reason: "Token API omitted holders" };
  if (holders === 0) return { status: "REJECT", reason: "Token API reports zero holders" };
  return { status: "PASS", reason: `Token API reports ${holders} holders` };
}

function volumeStatus(metadata) {
  if (!metadata) return { status: "UNKNOWN", reason: "Token API metadata is unavailable; volume is also UNKNOWN" };
  const volume = field(metadata, ["volume", "volume_24h", "volume_usd", "volume24h"]);
  if (volume === null) {
    return { status: "UNKNOWN", reason: "Token metadata endpoint has no volume field; this is not treated as no market" };
  }
  const numeric = asNumber(volume);
  if (numeric === null) return { status: "UNKNOWN", reason: "Token API volume value is not numeric" };
  return numeric > 0 ? { status: "PASS", reason: `reported volume=${numeric}` } : { status: "REJECT", reason: "Token API reports zero volume" };
}

export function evaluatePool(pool, metadataByAddress = new Map()) {
  const checks = [];
  const hooks = pool.hooks ?? ZERO_ADDRESS;
  checks.push(hooks === ZERO_ADDRESS
    ? { name: "hooks", status: "PASS", reason: "zero hook address" }
    : { name: "hooks", status: "REJECT", reason: `nonzero hooks ${hooks}; swap behavior is not bounded by initialize-only evidence` });

  const fee = asNumber(pool.fee);
  if (fee === null) checks.push({ name: "fee", status: "UNKNOWN", reason: "Initialize output omitted fee" });
  else if ((fee & DYNAMIC_FEE_FLAG) !== 0) checks.push({ name: "fee", status: "UNKNOWN", reason: `dynamic-fee flag set in raw fee ${fee}; not interpreted as a fixed percentage` });
  else if (fee > MAX_STATIC_FEE_PPM) checks.push({ name: "fee", status: "REJECT", reason: `static fee ${fee} ppm exceeds ${MAX_STATIC_FEE_PPM} ppm (1% per leg)` });
  else checks.push({ name: "fee", status: "PASS", reason: `static fee ${fee} ppm is within the 1% per-leg screen` });

  const spacing = asNumber(pool.tick_spacing);
  checks.push(spacing !== null && spacing > 0
    ? { name: "tick_spacing", status: "PASS", reason: `positive int24 tick spacing ${spacing}` }
    : { name: "tick_spacing", status: "REJECT", reason: `tick spacing ${pool.tick_spacing ?? "missing"} is not positive` });

  const tokens = ["currency0", "currency1"].map((key) => {
    const address = pool[key];
    if (isNativeCurrency(address)) return { field: key, address, kind: "native", status: "PASS", reason: "native currency; Token API not called" };
    const metadata = metadataByAddress.get(address.toLowerCase()) ?? null;
    return { field: key, address, kind: "erc20", metadata, ...tokenStatus(metadata) };
  });
  checks.push(...tokens.map((token) => ({ name: `${token.field}_metadata`, status: token.status, reason: token.reason })));
  checks.push({ name: "volume", ...volumeStatus(tokens.find((token) => token.metadata)?.metadata ?? null) });

  const reject = checks.find((check) => check.status === "REJECT");
  const requiredUnknown = checks.filter((check) => ["hooks", "fee", "tick_spacing", "currency0_metadata", "currency1_metadata"].includes(check.name) && check.status === "UNKNOWN");
  return {
    decision: reject ? "REJECT" : requiredUnknown.length ? "UNKNOWN" : "PASS",
    scope: "initialize identity + hook/fee/tick-spacing checks + available token metadata; no swap, liquidity, slippage, transfer, or wallet evidence",
    checks,
    tokens,
  };
}

export async function fetchTokenMetadata(network, contract, token) {
  const url = new URL(TOKEN_API_URL);
  url.searchParams.set("network", network);
  url.searchParams.set("contract", contract);
  const observedAt = new Date().toISOString();
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Token API HTTP ${response.status}`);
  const body = await response.json();
  const rows = Array.isArray(body?.data) ? body.data : [];
  const row = rows.find((item) => String(item.contract).toLowerCase() === contract.toLowerCase()) ?? rows[0] ?? null;
  return { row, observedAt };
}

export async function composePools({ pools, network, tokenFile, limit = 10 }) {
  const token = (await fs.readFile(tokenFile, "utf8")).trim();
  if (!token) throw new Error("token file is empty");
  const selected = pools.slice(0, limit);
  const addresses = [...new Set(selected.flatMap((pool) => [pool.currency0, pool.currency1]).filter((address) => !isNativeCurrency(address)))];
  const metadata = new Map();
  const errors = new Map();
  for (const address of addresses) {
    try {
      const { row, observedAt } = await fetchTokenMetadata(network, address, token);
      if (row) metadata.set(address.toLowerCase(), { ...row, observed_at: observedAt, provenance: { provider: "Pinax Token API", endpoint: TOKEN_API_URL, network } });
    } catch (error) {
      errors.set(address.toLowerCase(), error instanceof Error ? error.message : String(error));
    }
  }
  const results = selected.map((pool) => {
    const currencies = {};
    for (const fieldName of ["currency0", "currency1"]) {
      const address = pool[fieldName];
      currencies[fieldName] = isNativeCurrency(address)
        ? { address, kind: "native", metadata: null, status: "PASS", reason: "native currency; Token API not called" }
        : { address, kind: "erc20", metadata: metadata.get(address.toLowerCase()) ?? null, status: metadata.has(address.toLowerCase()) ? "PASS" : "UNKNOWN", reason: metadata.has(address.toLowerCase()) ? "metadata received" : (errors.get(address.toLowerCase()) ?? "metadata not returned") };
    }
    const relevant = new Map([...metadata].filter(([address]) => [pool.currency0, pool.currency1].map((item) => item.toLowerCase()).includes(address)));
    return { ...pool, network, provenance: { source: "Substreams map_initialize", network, observed_at: new Date().toISOString() }, currencies, decision: evaluatePool(pool, relevant) };
  });
  return { network, source: { substreams_module: "map_initialize", token_api: TOKEN_API_URL }, pools: results };
}

function usage() {
  console.error("Usage: node scripts/compose.mjs --network base --token-file ./token.txt [--input stream.jsonl] [--limit 10]");
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const network = value("--network");
  const tokenFile = value("--token-file");
  if (!network || !tokenFile) { usage(); process.exitCode = 2; return; }
  const inputFile = value("--input");
  const limit = Number(value("--limit") ?? 10);
  const text = inputFile ? await fs.readFile(inputFile, "utf8") : await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
  process.stdout.write(`${JSON.stringify(await composePools({ pools: parseStreamText(text), network, tokenFile, limit }), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
