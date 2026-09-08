#!/usr/bin/env node
import fs from "node:fs/promises";
import net from "node:net";
import process from "node:process";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEMO_NETWORK = "base";
export const DEMO_POOL_ID = "0xfa7714c40e1de3c702b8c8052230072d41f3f36f949bca2a26e9147d678a3c22";
export const DEFAULT_PAYER_ADDRESS = "0x76eFfFAec43eFaefa64eE71BFEb2963f608fC4A4";
export const ASSESS_HOST = "127.0.0.1";
export const ASSESS_PORT = 4021;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_FAUCET = "https://www.alchemy.com/faucets/base-sepolia";
export const USDC_FAUCET = "https://faucet.circle.com/";
export const USDC_DECIMALS = 6;
export const MIN_GAS_WEI = 200_000_000_000_000n;
export const PLANNED_RUNS = 2;

const PACKAGE_FILE = fileURLToPath(new URL("../package.json", import.meta.url));
const USDC_BALANCE_OF_SELECTOR = "70a08231";
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function status(name, state, message, extra = {}) {
  return { name, status: state, message, ...extra };
}

export function safeMainErrorMessage(error) {
  switch (error?.code) {
    case "CLIENT_INITIALIZATION_FAILED":
      return "payer client could not be initialized; no request was sent";
    case "UNKNOWN_PAYMENT_OUTCOME":
      return "signed payment request outcome is unknown; no retry was attempted";
    case "KNOWN_PAYMENT_REJECTION":
      return "payment was rejected; no automatic retry was attempted";
    case "MISSING_PAYER_KEY":
      return "X402_PAYER_PRIVATE_KEY is missing";
    default:
      return "demo failed; see the preflight and step output";
  }
}

export async function createSafePayerClient({ createClient, privateKey }) {
  try {
    return await createClient(privateKey);
  } catch (_) {
    const error = new Error("payer client could not be initialized; no request was sent");
    error.code = "CLIENT_INITIALIZATION_FAILED";
    throw error;
  }
}

export function parseMode(argv = []) {
  const args = [...argv];
  if (args.length === 0) return "full";
  if (args.length === 1 && args[0] === "--offline") return "offline";
  if (args.length === 1 && args[0] === "--check") return "check";
  throw new Error("usage: npm run demo | npm run demo:check | npm run demo -- --offline");
}

export async function checkDependencies({ packagePath = PACKAGE_FILE, requireResolve } = {}) {
  const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
  const resolver = requireResolve ?? createRequire(packagePath).resolve;
  const missing = [];
  for (const name of Object.keys(packageJson.dependencies ?? {})) {
    try {
      resolver(name);
    } catch (_) {
      missing.push(name);
    }
  }
  return missing.length === 0
    ? status("npm dependencies", "PASS", "runtime packages are installed")
    : status("npm dependencies", "FAIL", `missing: ${missing.join(", ")}; run npm install`, { missing });
}

export function checkSubstreams({ spawn = spawnSync } = {}) {
  const result = spawn("substreams", ["--version"], { stdio: "ignore" });
  if (result.error?.code === "ENOENT") return status("substreams CLI", "FAIL", "substreams is not installed or not on PATH");
  return status("substreams CLI", "PASS", "substreams command is available");
}

export async function loadGraphToken(env = process.env) {
  try {
    const { tokenFromEnvironment } = await import("./mcp-with-secret.mjs");
    return tokenFromEnvironment(env);
  } catch (_) {
    return null;
  }
}

export async function checkTokenApi({ token, fetchImpl = fetch } = {}) {
  if (!token) return status("Token API", "FAIL", "THEGRAPH_TOKEN is missing; cannot verify Pinax Token API");
  const url = new URL("https://api.pinax.network/v1/evm/tokens");
  url.searchParams.set("network", DEMO_NETWORK);
  url.searchParams.set("contract", "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  try {
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok
      ? status("Token API", "PASS", "Pinax Token API responded for Base metadata")
      : status("Token API", "FAIL", `Pinax Token API returned HTTP ${response.status}`);
  } catch (_) {
    return status("Token API", "UNKNOWN", "Pinax Token API response is unknown; no metadata is assumed");
  }
}

export async function derivePayerAddress({ privateKey, createAccount } = {}) {
  if (!privateKey) return status("payer key", "FAIL", "X402_PAYER_PRIVATE_KEY is missing", { privateKey: null });
  if (!PRIVATE_KEY_PATTERN.test(String(privateKey).trim())) {
    return status("payer key", "FAIL", "X402_PAYER_PRIVATE_KEY is malformed", { privateKey: null });
  }
  try {
    const account = await createAccount(privateKey);
    if (!ADDRESS_PATTERN.test(account.address)) throw new Error("invalid public address");
    return status("payer key", "PASS", `payer public address ${account.address}`, { address: account.address, privateKey });
  } catch (_) {
    return status("payer key", "FAIL", "X402_PAYER_PRIVATE_KEY could not be converted to a public address", { privateKey: null });
  }
}

async function rpcCall({ fetchImpl, method, params }) {
  const response = await fetchImpl(BASE_SEPOLIA_RPC, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body?.error || typeof body?.result !== "string") throw new Error("RPC returned no usable result");
  return body.result;
}

function formatUnits(value, decimals) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = String(absolute % base).padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function balanceOfData(address) {
  return `0x${USDC_BALANCE_OF_SELECTOR}${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

export async function checkBalances({ address, asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e", amountAtomic = 1000n, fetchImpl = fetch } = {}) {
  if (!address) return { checks: [status("payer balances", "UNKNOWN", "payer address is unavailable; balances are not assumed to be zero")] };
  try {
    const [chainId, ethHex, usdcHex] = await Promise.all([
      rpcCall({ fetchImpl, method: "eth_chainId", params: [] }),
      rpcCall({ fetchImpl, method: "eth_getBalance", params: [address, "latest"] }),
      rpcCall({ fetchImpl, method: "eth_call", params: [{ to: asset, data: balanceOfData(address) }, "latest"] }),
    ]);
    if (chainId.toLowerCase() !== "0x14a34") throw new Error("RPC is not Base Sepolia (chain id 84532)");
    const eth = BigInt(ethHex);
    const usdc = BigInt(usdcHex);
    const requiredUsdc = amountAtomic * BigInt(PLANNED_RUNS);
    const ethCheck = eth >= MIN_GAS_WEI
      ? status("payer gas balance", "PASS", `${formatUnits(eth, 18)} ETH on Base Sepolia`)
      : status("payer gas balance", "FAIL", `${formatUnits(eth, 18)} ETH is below the ${formatUnits(MIN_GAS_WEI, 18)} ETH two-run gas floor; faucet: ${BASE_SEPOLIA_FAUCET}; address: ${address}`);
    const usdcCheck = usdc >= requiredUsdc
      ? status("payer USDC balance", "PASS", `${formatUnits(usdc, USDC_DECIMALS)} USDC; two-run plan requires ${formatUnits(requiredUsdc, USDC_DECIMALS)} USDC`)
      : status("payer USDC balance", "FAIL", `${formatUnits(usdc, USDC_DECIMALS)} USDC is below the two-run plan ${formatUnits(requiredUsdc, USDC_DECIMALS)} USDC; faucet: ${USDC_FAUCET}; address: ${address}`);
    return { checks: [ethCheck, usdcCheck], balances: { eth, usdc, requiredUsdc } };
  } catch (_) {
    return { checks: [
      status("payer gas balance", "UNKNOWN", `Base Sepolia ETH balance is unknown; do not treat it as zero; faucet: ${BASE_SEPOLIA_FAUCET}; address: ${address}`),
      status("payer USDC balance", "UNKNOWN", `Base Sepolia USDC balance is unknown; do not treat it as zero; faucet: ${USDC_FAUCET}; address: ${address}`),
    ] };
  }
}

export async function checkAssessmentServer({ createApp, payTo, host = ASSESS_HOST, port = ASSESS_PORT } = {}) {
  if (!createApp) return status("assessment server", "UNKNOWN", "server check was not attempted because npm dependencies are missing");
  let server;
  try {
    server = createApp({ payTo }).listen(port, host);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    await closeOwnedServer(server);
    return status("assessment server", "PASS", `loopback ${host}:${port} is free and assessment app starts`);
  } catch (error) {
    if (server) await closeOwnedServer(server).catch(() => {});
    if (error?.code === "EADDRINUSE") return status("assessment server", "FAIL", `port ${host}:${port} is occupied; existing process was preserved`);
    return status("assessment server", "FAIL", "assessment app could not start");
  }
}

async function preflightPayerKey({ env, dependencies, adapters }) {
  if (dependencies.status !== "PASS") {
    return env.X402_PAYER_PRIVATE_KEY
      ? status("payer key", "UNKNOWN", "payer key was not checked because npm dependencies are missing", { privateKey: null })
      : status("payer key", "FAIL", "X402_PAYER_PRIVATE_KEY is missing", { privateKey: null });
  }
  return (adapters.deriveAddress ?? derivePayerAddress)({
    privateKey: env.X402_PAYER_PRIVATE_KEY,
    createAccount: adapters.createAccount ?? (async (privateKey) => {
      const { privateKeyToAccount } = await import("viem/accounts");
      return privateKeyToAccount(privateKey);
    }),
  });
}

export async function runPreflight({ env = process.env, adapters = {} } = {}) {
  const checks = [];
  const dependencies = await (adapters.dependencies ?? checkDependencies)();
  checks.push(dependencies);
  checks.push((adapters.substreams ?? checkSubstreams)());

  const token = await (adapters.loadToken ?? loadGraphToken)(env);
  checks.push(token ? status("Graph token", "PASS", "canonical Graph token is available in process memory") : status("Graph token", "FAIL", "canonical Graph token is missing or unsafe"));
  checks.push(await (adapters.tokenApi ?? checkTokenApi)({ token, fetchImpl: adapters.fetchImpl ?? fetch }));

  const keyCheck = await preflightPayerKey({ env, dependencies, adapters });
  checks.push(keyCheck);
  const balances = await (adapters.balances ?? checkBalances)({
    address: keyCheck.address ?? DEFAULT_PAYER_ADDRESS,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    amountAtomic: 1000n,
    fetchImpl: adapters.fetchImpl ?? fetch,
  });
  checks.push(...balances.checks);

  const server = await (adapters.server ?? (async () => {
    if (dependencies.status !== "PASS") return checkAssessmentServer({});
    try {
      const { createAssessApp } = await import("./assess-http.mjs");
      const { ASSESS_PAY_TO } = await import("../config/assess-x402.mjs");
      return checkAssessmentServer({ createApp: ({ payTo }) => createAssessApp({ payTo }), payTo: ASSESS_PAY_TO });
    } catch (_) {
      return status("assessment server", "FAIL", "assessment app could not be loaded");
    }
  }))();
  checks.push(server);
  return { ok: checks.every((check) => check.status === "PASS"), checks, token, privateKey: keyCheck.privateKey, payerAddress: keyCheck.address ?? DEFAULT_PAYER_ADDRESS, balances };
}

function printCheck(check, write = console.log) {
  write(`[preflight] ${check.status} ${check.name}: ${check.message}`);
}

export function graphEnvironment(env, token) {
  const graphEnv = { ...env, THEGRAPH_TOKEN: token };
  delete graphEnv.X402_PAYER_PRIVATE_KEY;
  return graphEnv;
}

export async function closeOwnedServer(server) {
  if (!server || !server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function withOwnedServer({ startServer, task }) {
  const server = await startServer();
  try {
    return await task(server);
  } finally {
    await closeOwnedServer(server);
  }
}

function elapsed(start) {
  return `${(Number(process.hrtime.bigint() - start) / 1e6).toFixed(0)} ms`;
}

async function timedStep(number, title, action, write = console.log) {
  const started = process.hrtime.bigint();
  write(`\nSTEP ${number}/6 — ${title}`);
  const result = await action();
  write(`step ${number} completed in ${elapsed(started)}`);
  return result;
}

function printAssessment(assessment, write = console.log) {
  write(`verdict: ${assessment.verdict}`);
  write(`source: ${assessment.provenance.source} (${assessment.network}); metadata: ${assessment.provenance.token_api}`);
  write(`scope/limits: ${assessment.scope}`);
  for (const check of assessment.checks) write(`  ${check.status.padEnd(7)} ${check.name}: ${check.reason}`);
}

function fixtureResolved() {
  return {
    pool_id: DEMO_POOL_ID,
    network: DEMO_NETWORK,
    pool: {
      currency0: "0xd84af51aae54fe6df667e83a66291529b5456cdd",
      currency1: "0xf67fcf24bbbff934c79ffb09399122482a25594d",
      fee: 8388608,
      tick_spacing: 200,
      hooks: "0x0469a4bd3724dc86c9542f4694c976da13c450c0",
    },
    currencies: {
      currency0: { address: "0xd84af51aae54fe6df667e83a66291529b5456cdd", kind: "erc20", status: "PASS", reason: "fixture metadata" },
      currency1: { address: "0xf67fcf24bbbff934c79ffb09399122482a25594d", kind: "erc20", status: "PASS", reason: "fixture metadata" },
    },
    provenance: { source: "Substreams map_initialize", network: DEMO_NETWORK, fixture: true, token_api: "https://api.pinax.network/v1/evm/tokens" },
    scope: "initialize identity + hook/fee/tick-spacing checks + available token metadata; no swap, liquidity, slippage, transfer, or wallet evidence",
  };
}

export async function runOfflineDemo({ write = console.log } = {}) {
  const [{ evaluatePool }, { assessmentFromResolved }] = await Promise.all([
    import("./compose.mjs"),
    import("./mcp.mjs"),
  ]);
  const resolved = fixtureResolved();
  const metadata = new Map([
    [resolved.pool.currency0, { name: "KING Robin", symbol: "KING", decimals: 18, holders: 4 }],
    [resolved.pool.currency1, { name: "cajonosama", symbol: "CAJ", decimals: 18, holders: 358 }],
  ]);
  resolved.decision = evaluatePool(resolved.pool, metadata);
  write("OFFLINE MODE — recorded fixtures only; no network, secrets, server, or payment");
  await timedStep(1, "pool identity", async () => write(`fixture: ${resolved.provenance.source}; pool_id=${resolved.pool_id}; network=${resolved.network}`), write);
  await timedStep(2, "token metadata enrichment", async () => write("fixture: Pinax Token API-shaped metadata; no request made"), write);
  const assessment = await timedStep(3, "assess_pool decision", async () => assessmentFromResolved(resolved), write);
  printAssessment(assessment, write);
  write("offline completed after steps 1–3; steps 4–6 intentionally not run");
  return assessment;
}

async function initialPayment({ client, url, write }) {
  const response = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10_000) });
  let body = {};
  try { body = await response.json(); } catch (_) {}
  if (response.status !== 402) throw new Error(`expected initial HTTP 402, got ${response.status}`);
  const required = client.getPaymentRequiredResponse((name) => response.headers.get(name), body);
  if (!required?.accepts?.length) throw new Error("402 did not contain machine-readable payment requirements");
  write(`HTTP 402 payment-required: ${JSON.stringify({ x402Version: required.x402Version, accepts: required.accepts }, null, 2)}`);
  return response;
}

async function runFullDemo({ env = process.env, write = console.log } = {}) {
  const preflight = await runPreflight({ env });
  for (const check of preflight.checks) printCheck(check, write);
  if (!preflight.ok) throw new Error("preflight failed; no server was started and no payment was attempted");

  const [{ loadPool, assessmentFromResolved }, http, clientModule, config] = await Promise.all([
    import("./mcp.mjs"),
    import("./assess-http.mjs"),
    import("./assess-client.mjs"),
    import("../config/assess-x402.mjs"),
  ]);
  const graphEnv = graphEnvironment(env, preflight.token);
  const poolId = env.DEMO_POOL_ID || DEMO_POOL_ID;
  const resolved = await timedStep(1, "pool identity from Substreams", () => loadPool({ poolId, network: DEMO_NETWORK, env: graphEnv }), write);
  write(`source: ${resolved.provenance.source}; search window=${JSON.stringify(resolved.provenance.search_window)}; pool_id=${resolved.pool_id}`);
  write(`currency0=${resolved.pool.currency0}; currency1=${resolved.pool.currency1}; fee=${resolved.pool.fee} raw; tick_spacing=${resolved.pool.tick_spacing}; hooks=${resolved.pool.hooks}`);

  await timedStep(2, "Token API enrichment", async () => {
    write(`source: ${resolved.provenance.token_api}; coverage=${resolved.provenance.metadata_coverage}`);
    for (const field of ["currency0", "currency1"]) write(`${field}: ${JSON.stringify(resolved.currencies[field])}`);
  }, write);
  const assessment = await timedStep(3, "assess_pool decision", async () => assessmentFromResolved(resolved), write);
  printAssessment(assessment, write);

  const url = clientModule.buildAssessUrl([poolId, "--network", DEMO_NETWORK]);
  const payerKey = preflight.privateKey;
  const client = await createSafePayerClient({ createClient: (key) => clientModule.createOfficialClient(key), privateKey: payerKey });

  await withOwnedServer({
    startServer: async () => {
      const server = http.start({ host: ASSESS_HOST, port: ASSESS_PORT, payTo: config.ASSESS_PAY_TO });
      await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
      return server;
    },
    task: async () => {
      await timedStep(4, "unpaid request", () => initialPayment({ client, url, write }), write);
      write("\nSTEP 5/6 — payment and signed retry");
      write(`cost: ${clientModule.ASSESS_AMOUNT} atomic units = 0.001 USDC on ${clientModule.ASSESS_NETWORK}`);
      write(`payer: ${preflight.payerAddress}`);
      write(`receiver: ${config.ASSESS_PAY_TO}`);
      const paymentStarted = process.hrtime.bigint();
      let result;
      try {
        result = await clientModule.runPaymentAttempt({ argv: [poolId, "--network", DEMO_NETWORK], client });
      } catch (error) {
        write(`payment stopped in ${elapsed(paymentStarted)}: ${error.code ?? "PAYMENT_ERROR"}`);
        if (error.code === "UNKNOWN_PAYMENT_OUTCOME") write("UNKNOWN_PAYMENT_OUTCOME: no additional retry was attempted");
        throw error;
      }
      write(`step 5 completed in ${elapsed(paymentStarted)}`);
      await timedStep(6, "assessment result", async () => {
        write(`HTTP ${result.status}; settlement network=${result.network}; amount=${result.amount} atomic units`);
        write(`transaction: ${result.transaction}`);
        write(`explorer: https://sepolia.basescan.org/tx/${result.transaction}`);
        write(JSON.stringify(result.body, null, 2));
      }, write);
    },
  });
}

export async function main(argv = process.argv.slice(2), { write = console.log } = {}) {
  const mode = parseMode(argv);
  if (mode === "offline") { await runOfflineDemo({ write }); return 0; }
  if (mode === "check") {
    const preflight = await runPreflight();
    for (const check of preflight.checks) printCheck(check, write);
    write(preflight.ok ? "preflight PASS: no payment, no signed request, no persistent server" : "preflight FAIL: all missing/unknown prerequisites are listed; no payment or persistent server");
    return preflight.ok ? 0 : 2;
  }
  await runFullDemo({ write });
  return 0;
}

export function isMainModule(argv1 = process.argv[1]) {
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  try {
    process.exitCode = await main();
  } catch (error) {
    const code = error?.code === "UNKNOWN_PAYMENT_OUTCOME" ? 3 : 2;
    process.stderr.write(`${error?.code ?? "DEMO_ERROR"}: ${safeMainErrorMessage(error)}\n`);
    process.exitCode = code;
  }
}