import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readProtectedToken, tokenFromEnvironment } from "./mcp-with-secret.mjs";

test("canonical MCP token bootstrap reads a protected file and rejects loose mode", () => {
  const dir = mkdtempSync(join(tmpdir(), "task52-graph-token-"));
  const file = join(dir, "token");
  try {
    writeFileSync(file, "fixture-token\n", { mode: 0o600 });
    chmodSync(file, 0o600);
    assert.equal(readProtectedToken(file), "fixture-token");
    chmodSync(file, 0o644);
    assert.throws(() => readProtectedToken(file), /protected Graph token bootstrap failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("MCP bootstrap preserves a nonempty inherited token without opening the file", () => {
  assert.equal(tokenFromEnvironment({ THEGRAPH_TOKEN: "preset-token", THEGRAPH_TOKEN_FILE: "/missing/token" }), "preset-token");
});
