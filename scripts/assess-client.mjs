#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ASSESS_NETWORK, ASSESS_PAY_TO } from "../config/assess-x402.mjs";

export const PAYER_PRIVATE_KEY_ENV = "X402_PAYER_PRIVATE_KEY";
export const ASSESS_ORIGIN = "http://127.0.0.1:4021";
export const ASSESS_PATH = "/assess";
export const ASSESS_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const ASSESS_AMOUNT = "1000";
export const ASSESS_TIMEOUT_SECONDS = 300;

const POOL_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const TRANSACTION_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export class PayerClientError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function payerError(code, message) {
  return new PayerClientError(code, message);
}

function redactSdkCause(error) {
  const message = error instanceof Error ? error.message : "SDK threw a non-Error value";
  return message
    .replace(/\b0x[0-9a-f]{64}\b/gi, "[redacted]")
    .replace(/\b(private(?:[_\s-]*key)?|(?:access[_\s-]*)?token|authorization|payment[_\s-]*signature)\b\s*([:=])\s*(?:Bearer\s+)?[^\s,;]+/gi, "$1$2[redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .trim() || "SDK did not provide an error message";
}

function payerErrorWithSdkCause(code, message, error) {
  return payerError(code, `${message}; SDK cause: ${redactSdkCause(error)}`);
}

function requirePayerKey(env) {
  const value = String(env[PAYER_PRIVATE_KEY_ENV] ?? "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw payerError("MISSING_PAYER_KEY", `${PAYER_PRIVATE_KEY_ENV} must contain a 0x-prefixed private key in the environment`);
  }
  return value;
}

function parseArguments(argv) {
  const args = [...argv];
  const poolId = args.shift();
  if (!POOL_ID_PATTERN.test(poolId ?? "")) {
    throw payerError("INVALID_POOL_ID", "pool_id must be a 32-byte 0x-prefixed hex value");
  }
  let network = "base";
  if (args.length > 0) {
    if (args.length !== 2 || args[0] !== "--network") {
      throw payerError("INVALID_ARGUMENTS", "usage: npm run pay:assess -- <pool_id> [--network base]");
    }
    network = args[1];
  }
  if (network !== "base") throw payerError("INVALID_NETWORK", "only --network base is supported");
  return { poolId, network };
}

export function buildAssessUrl(argv) {
  const { poolId, network } = parseArguments(argv);
  const url = new URL(ASSESS_PATH, ASSESS_ORIGIN);
  url.searchParams.set("network", network);
  url.searchParams.set("pool_id", poolId);
  return url.toString();
}

function expectedPaymentRequirement(requirement) {
  const actual = requirement ?? {};
  const matches =
    actual.scheme === "exact" &&
    actual.network === ASSESS_NETWORK &&
    actual.amount === ASSESS_AMOUNT &&
    typeof actual.asset === "string" &&
    actual.asset.toLowerCase() === ASSESS_ASSET.toLowerCase() &&
    typeof actual.payTo === "string" &&
    actual.payTo.toLowerCase() === ASSESS_PAY_TO.toLowerCase() &&
    actual.maxTimeoutSeconds === ASSESS_TIMEOUT_SECONDS;
  if (!matches) {
    throw payerError("UNEXPECTED_PAYMENT_REQUIREMENT", "refusing 402 requirements outside the configured Base Sepolia assessment allowlist");
  }
  return actual;
}

function parseRequiredPayment(client, response, body) {
  let required;
  try {
    required = client.getPaymentRequiredResponse((name) => response.headers.get(name), body);
  } catch (error) {
    throw payerErrorWithSdkCause("UNEXPECTED_PAYMENT_REQUIREMENT", "unable to parse the initial 402 payment requirements", error);
  }
  if (required?.x402Version !== 2 || !Array.isArray(required.accepts) || required.accepts.length !== 1) {
    throw payerError("UNEXPECTED_PAYMENT_REQUIREMENT", "initial 402 must advertise exactly one x402 v2 payment requirement");
  }
  expectedPaymentRequirement(required.accepts[0]);
  return required;
}

function requestOptions(headers = undefined, timeoutMs = 10_000) {
  return {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  };
}

async function parseJson(response, code, message) {
  try {
    return await response.json();
  } catch (_) {
    throw payerError(code, message);
  }
}

function requireSettlement(settlement) {
  const transaction = settlement?.transaction;
  if (settlement?.success !== true || settlement?.network !== ASSESS_NETWORK || typeof transaction !== "string" || !TRANSACTION_PATTERN.test(transaction)) {
    throw payerError("UNKNOWN_PAYMENT_OUTCOME", "paid response did not contain a successful Base Sepolia settlement with a verifiable transaction hash; do not retry automatically");
  }
  return transaction;
}

export async function runAssessClient({ argv, env = process.env, fetchImpl = fetch, createClient, readPayerKey = requirePayerKey }) {
  const privateKey = readPayerKey(env);
  let client;
  try {
    client = await createClient(privateKey);
  } catch (error) {
    throw payerErrorWithSdkCause("CLIENT_INITIALIZATION_FAILED", "payer client could not be initialized; no request was sent", error);
  }
  return runPaymentAttempt({ argv, fetchImpl, client });
}

export async function runPaymentAttempt({ argv, fetchImpl = fetch, client }) {
  const url = buildAssessUrl(argv);

  let initial;
  try {
    initial = await fetchImpl(url, requestOptions());
  } catch (_) {
    throw payerError("UNPAID_REQUEST_FAILED", "initial unsigned request failed before any payment was created");
  }
  if (initial.status !== 402) {
    throw payerError("EXPECTED_PAYMENT_REQUIRED", `expected initial HTTP 402, got ${initial.status}`);
  }

  const requirements = parseRequiredPayment(
    client,
    initial,
    await parseJson(initial, "UNEXPECTED_PAYMENT_REQUIREMENT", "initial 402 did not contain valid payment requirements"),
  );

  let signatureHeaders;
  try {
    const payload = await client.createPaymentPayload(requirements);
    signatureHeaders = client.encodePaymentSignatureHeader(payload);
  } catch (error) {
    throw payerErrorWithSdkCause("KNOWN_PAYMENT_REJECTION", "payment could not be created locally; no signed request was sent", error);
  }

  let paid;
  try {
    paid = await fetchImpl(url, requestOptions(signatureHeaders, 70_000));
  } catch (_) {
    throw payerError("UNKNOWN_PAYMENT_OUTCOME", "signed payment request has no response; do not retry automatically");
  }
  if (paid.status === 402) {
    throw payerError("KNOWN_PAYMENT_REJECTION", "server returned 402 after the signed request; no automatic retry was made");
  }
  if (paid.status !== 200) {
    throw payerError("UNKNOWN_PAYMENT_OUTCOME", `signed payment request returned HTTP ${paid.status}; do not retry automatically`);
  }

  let settlement;
  try {
    settlement = client.getPaymentSettleResponse((name) => paid.headers.get(name));
  } catch (error) {
    throw payerErrorWithSdkCause("UNKNOWN_PAYMENT_OUTCOME", "paid response settlement header could not be verified; do not retry automatically", error);
  }
  const transaction = requireSettlement(settlement);
  const body = await parseJson(paid, "UNKNOWN_PAYMENT_OUTCOME", "paid response body could not be verified; do not retry automatically");
  return {
    status: paid.status,
    transaction,
    amount: ASSESS_AMOUNT,
    network: ASSESS_NETWORK,
    receiver: ASSESS_PAY_TO,
    body,
  };
}

export async function createOfficialClient(privateKey) {
  const [{ x402Client, x402HTTPClient }, { registerExactEvmScheme }, { privateKeyToAccount }] = await Promise.all([
    import("@x402/core/client"),
    import("@x402/evm/exact/client"),
    import("viem/accounts"),
  ]);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: privateKeyToAccount(privateKey) });
  return new x402HTTPClient(client);
}

export function isMainModule(argv1 = process.argv[1]) {
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  try {
    const result = await runAssessClient({
      argv: process.argv.slice(2),
      createClient: createOfficialClient,
    });
    process.stdout.write(`${JSON.stringify({ payment: { status: result.status, transaction: result.transaction, amount: result.amount, network: result.network, receiver: result.receiver, explorer: `https://sepolia.basescan.org/tx/${result.transaction}` }, assessment: result.body })}\n`);
  } catch (error) {
    const code = error instanceof PayerClientError ? error.code : "CLIENT_ERROR";
    const message = error instanceof Error ? error.message : "assessment payment failed";
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = code === "UNKNOWN_PAYMENT_OUTCOME" ? 3 : 2;
  }
}
