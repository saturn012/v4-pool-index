#!/usr/bin/env node
/** Load a protected canonical Graph token into env, then serve MCP over stdio. */
import { lstatSync, readFileSync } from "node:fs";
import process from "node:process";
import { serve } from "./mcp.mjs";

export const CANONICAL_TOKEN_FILE = "/home/hermes/.hermes/secrets/thegraph.token";

export function readProtectedToken(file = process.env.THEGRAPH_TOKEN_FILE || CANONICAL_TOKEN_FILE) {
  try {
    const info = lstatSync(file);
    if (!info.isFile() || (info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid())) throw new Error("unsafe");
    const token = readFileSync(file, "utf8").trim();
    if (!token) throw new Error("empty");
    return token;
  } catch (_) {
    throw new Error("protected Graph token bootstrap failed");
  }
}

export function tokenFromEnvironment(env = process.env) {
  return String(env.THEGRAPH_TOKEN || "").trim() || readProtectedToken(env.THEGRAPH_TOKEN_FILE || CANONICAL_TOKEN_FILE);
}

export async function main() {
  process.env.THEGRAPH_TOKEN = tokenFromEnvironment();
  await serve();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main().catch(() => { process.exitCode = 2; });
}
