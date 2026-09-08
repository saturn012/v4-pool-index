#!/usr/bin/env node
/** Run the fixed Substreams registry publish command with a protected env token. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { readProtectedToken } from "./mcp-with-secret.mjs";

export const REGISTRY_ENDPOINT = "https://substreams.dev";
export const SUCCESS_MARKER = "Package published successfully!";

export function registryEnvironment(env = process.env) {
  const next = {};
  for (const name of ["PATH", "HOME", "LANG"]) if (env[name]) next[name] = env[name];
  next.SUBSTREAMS_REGISTRY_TOKEN = readProtectedToken(env.SUBSTREAMS_REGISTRY_TOKEN_FILE || "/home/hermes/.hermes/secrets/substreams-registry.token");
  return next;
}

export function packagePath(value) {
  if (!value || value.startsWith("-") || /^https?:/i.test(value) || !value.endsWith(".spkg")) throw new Error("local .spkg path is required");
  const absolute = resolve(value); if (!statSync(absolute).isFile()) throw new Error("local .spkg path is required"); return absolute;
}
export function publishCommand(absoluteSpkg) { return ["registry", "publish", absoluteSpkg, "--yes"]; }

export function main(argv = process.argv.slice(2), env = process.env, spawn = spawnSync) {
  if (argv.length !== 1) throw new Error("local .spkg path is required");
  const result = spawn("/usr/local/bin/substreams", publishCommand(packagePath(argv[0])), { env: registryEnvironment(env), encoding: "utf8", stdio: "pipe" });
  const stdout = String(result.stdout || "");
  if (result.status !== 0 || !stdout.includes(SUCCESS_MARKER)) throw new Error("registry publish failed");
  process.stdout.write(`${SUCCESS_MARKER}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (_) { process.stderr.write("registry publish: ERROR failed\n"); process.exitCode = 2; }
}
