#!/usr/bin/env node
import express from "express";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { McpError, assessmentFromResolved, loadPool, validateArguments } from "./mcp.mjs";
import { ASSESS_FACILITATOR_URL, ASSESS_NETWORK, ASSESS_PAY_TO, ASSESS_PRICE as CONFIGURED_PRICE } from "../config/assess-x402.mjs";

export const ASSESS_PATH = "/assess";
export const BASE_SEPOLIA = ASSESS_NETWORK;
export const ASSESS_PRICE = CONFIGURED_PRICE;
export const FACILITATOR_URL = ASSESS_FACILITATOR_URL;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4021;
export const FACILITATOR_TIMEOUT_MS = 5_000;
export const ASSESSMENT_TIMEOUT_MS = 65_000;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;

export class AssessHttpError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function requirePublicPayTo(value) {
  const payTo = String(value ?? "").trim();
  if (!ADDRESS_PATTERN.test(payTo) || payTo.toLowerCase() === ZERO_ADDRESS) {
    throw new AssessHttpError("INVALID_PAY_TO", "ASSESS_PAY_TO must be a nonzero public EVM address", 500);
  }
  return payTo;
}

export function requireLoopbackHost(value) {
  const host = String(value ?? DEFAULT_HOST).trim();
  if (host !== DEFAULT_HOST) throw new AssessHttpError("INVALID_HOST", "ASSESS_HOST is fixed to 127.0.0.1", 500);
  return host;
}

function parsePort(value) {
  if (value === undefined || value === "") return DEFAULT_PORT;
  if (!/^[0-9]+$/.test(String(value))) throw new AssessHttpError("INVALID_PORT", "ASSESS_PORT must be a TCP port", 500);
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new AssessHttpError("INVALID_PORT", "ASSESS_PORT must be a TCP port", 500);
  return port;
}

export function runtimeConfig(env = process.env) {
  return {
    payTo: requirePublicPayTo(env.ASSESS_PAY_TO ?? ASSESS_PAY_TO),
    host: requireLoopbackHost(env.ASSESS_HOST),
    port: parsePort(env.ASSESS_PORT),
  };
}

export function routesFor(payTo) {
  return {
    [`GET ${ASSESS_PATH}`]: {
      accepts: [{ scheme: "exact", price: ASSESS_PRICE, network: BASE_SEPOLIA, payTo: requirePublicPayTo(payTo) }],
      description: "Pool assessment",
      mimeType: "application/json",
    },
  };
}

export function createX402PaymentMiddleware(payTo, { facilitator } = {}) {
  const client = facilitator ?? new HTTPFacilitatorClient({ url: FACILITATOR_URL, timeoutMs: FACILITATOR_TIMEOUT_MS });
  const resourceServer = new x402ResourceServer(client)
    .register(BASE_SEPOLIA, new ExactEvmScheme());
  // The current v2 SDK requires this capability sync before it can emit requirements.
  return paymentMiddleware(routesFor(payTo), resourceServer);
}

function safeQueryArgument(value) {
  return typeof value === "string" ? value : "";
}

async function withTimeout(operation, timeoutMs = ASSESSMENT_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new AssessHttpError("ASSESSMENT_TIMEOUT", "assessment timed out", 504)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function publicFailure(error) {
  if (error instanceof McpError) {
    if (error.code === "INVALID_ARGUMENTS" || error.code === "INVALID_NETWORK" || error.code === "INVALID_POOL_ID") {
      return { status: 400, body: { error: { code: error.code, message: error.message } } };
    }
    return { status: 503, body: { error: { code: error.code, message: "assessment source is unavailable" } } };
  }
  if (error instanceof AssessHttpError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "assessment failed" } } };
}

export function createAssessApp({ payTo, resolver = loadPool, paymentGate = createX402PaymentMiddleware } = {}) {
  const app = express();
  const checkedPayTo = requirePublicPayTo(payTo);
  app.disable("x-powered-by");
  app.all(ASSESS_PATH, (req, res, next) => {
    if (req.method === "GET") return next();
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "only GET is allowed" } });
  });
  app.use(paymentGate(checkedPayTo));
  app.get(ASSESS_PATH, async (req, res) => {
    let args;
    try {
      args = validateArguments({ pool_id: safeQueryArgument(req.query.pool_id), network: safeQueryArgument(req.query.network) });
      const resolved = await withTimeout(Promise.resolve(resolver(args)));
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json(assessmentFromResolved(resolved));
    } catch (error) {
      const failure = publicFailure(error);
      res.status(failure.status).json(failure.body);
    }
  });
  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "not found" } }));
  return app;
}

export function start(config = runtimeConfig()) {
  const app = createAssessApp(config);
  return app.listen(config.port, config.host, () => {
    process.stdout.write(`x402 assessment server listening on http://${config.host}:${config.port}${ASSESS_PATH}\n`);
  });
}

export function isMainModule(argv1 = process.argv[1]) {
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  try {
    const server = start();
    const stop = () => server.close(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "startup failed"}\n`);
    process.exitCode = 2;
  }
}
