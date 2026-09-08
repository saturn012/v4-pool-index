#!/usr/bin/env node
/** Run the fixed Substreams registry publish command with a protected env token. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { readProtectedToken } from "./mcp-with-secret.mjs";

export const REGISTRY_ENDPOINT = "https://substreams.dev";
export const RETAINED_SPKG = "/home/hermes/.hermes/private_reports/task-A44-disk-policy-20260908/retained-artifacts/task44-v4-pool-index-consumer-v0.1.0.spkg";
export const SUCCESS_MARKER = "Package published successfully!";

export function registryEnvironment(env = process.env) {
  const next = {};
  for (const name of ["PATH", "HOME", "LANG"]) if (env[name]) next[name] = env[name];
  next.SUBSTREAMS_REGISTRY_TOKEN = readProtectedToken(env.SUBSTREAMS_REGISTRY_TOKEN_FILE || "/home/hermes/.hermes/secrets/substreams-registry.token");
  return next;
}

export function publishCommand() { return ["registry", "publish", RETAINED_SPKG, "--yes"]; }

export function main(argv = process.argv.slice(2), env = process.env, spawn = spawnSync) {
  if (argv.length !== 0) throw new Error("registry publish launcher accepts no arguments");
  const result = spawn("/usr/local/bin/substreams", publishCommand(), { env: registryEnvironment(env), encoding: "utf8", stdio: "pipe" });
  const stdout = String(result.stdout || "");
  if (result.status !== 0 || !stdout.includes(SUCCESS_MARKER)) throw new Error("registry publish failed");
  const safe = stdout.split(/\r?\n/).filter((line) => line === SUCCESS_MARKER || /^https:\/\/substreams\.dev\//.test(line)).join("\n");
  if (!safe) throw new Error("registry publish output was unsafe");
  process.stdout.write(`${safe}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (_) { process.stderr.write("registry publish: ERROR failed\n"); process.exitCode = 2; }
}
