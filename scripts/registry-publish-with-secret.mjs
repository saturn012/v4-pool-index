#!/usr/bin/env node
/** Run the fixed Substreams registry publish command with a protected env token. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { readProtectedToken } from "./mcp-with-secret.mjs";

export const REGISTRY_ENDPOINT = "https://substreams.dev";
const BLOCKED_ENV = ["SUBSTREAMS_ENDPOINT", "SUBSTREAMS_REGISTRY_ENDPOINT", "RUST_LOG", "RUST_BACKTRACE"];

export function registryEnvironment(env = process.env) {
  for (const name of BLOCKED_ENV) if (env[name]) throw new Error("unsafe inherited registry logging or endpoint setting");
  const next = { ...env, SUBSTREAMS_REGISTRY_TOKEN: readProtectedToken(env.SUBSTREAMS_REGISTRY_TOKEN_FILE || "/home/hermes/.hermes/secrets/substreams-registry.token"), RUST_LOG: "warn" };
  delete next.SUBSTREAMS_ENDPOINT;
  delete next.SUBSTREAMS_REGISTRY_ENDPOINT;
  return next;
}

export function publishCommand() { return ["registry", "publish"]; }

export function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 0) throw new Error("registry publish launcher accepts no arguments");
  const result = spawnSync("substreams", publishCommand(), { env: registryEnvironment(env), encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) throw new Error("registry publish failed");
  process.stdout.write("registry publish: PASS\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  try { main(); } catch (_) { process.stderr.write("registry publish: ERROR failed\n"); process.exitCode = 2; }
}
