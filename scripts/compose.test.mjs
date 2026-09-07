import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ZERO_ADDRESS, evaluatePool, parseStreamText } from "./compose.mjs";

const ERC20 = (address, overrides = {}) => ({ contract: address, name: "Example Token", symbol: "EXT", decimals: 18, holders: 42, circulating_supply: 1000000, ...overrides });
const pool = (overrides = {}) => ({ pool_id: `0x${"11".repeat(32)}`, currency0: `0x${"22".repeat(20)}`, currency1: `0x${"33".repeat(20)}`, fee: 500, tick_spacing: 10, hooks: ZERO_ADDRESS, ...overrides });
const composeScript = fileURLToPath(new URL("./compose.mjs", import.meta.url));

test("parses Substreams JSONL repeated pools", () => {
  const parsed = parseStreamText(JSON.stringify({ "@data": { pools: [pool()] } }));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].fee, 500);
});

test("native zero address is explicit and skips ERC-20 metadata", () => {
  const result = evaluatePool(pool({ currency0: ZERO_ADDRESS }), new Map());
  assert.equal(result.tokens[0].kind, "native");
  assert.equal(result.tokens[0].status, "PASS");
});

test("static fee and metadata pass while volume remains unknown", () => {
  const p = pool();
  const metadata = new Map([[p.currency0, ERC20(p.currency0)], [p.currency1, ERC20(p.currency1)]]);
  const result = evaluatePool(p, metadata);
  assert.equal(result.decision, "PASS");
  assert.equal(result.checks.find((check) => check.name === "volume").status, "UNKNOWN");
});

test("nonzero hooks reject with a human-readable reason", () => {
  const result = evaluatePool(pool({ hooks: `0x${"44".repeat(20)}` }));
  assert.equal(result.decision, "REJECT");
  assert.match(result.checks.find((check) => check.name === "hooks").reason, /nonzero hooks/);
});

test("dynamic fee is unknown rather than a fixed percentage", () => {
  const p = pool({ fee: 0x800000 | 500 });
  const metadata = new Map([[p.currency0, ERC20(p.currency0)], [p.currency1, ERC20(p.currency1)]]);
  const result = evaluatePool(p, metadata);
  assert.equal(result.checks.find((check) => check.name === "fee").status, "UNKNOWN");
});

test("zero holders reject while missing holders remain unknown", () => {
  const p = pool();
  const zero = evaluatePool(p, new Map([[p.currency0, ERC20(p.currency0, { holders: 0 })], [p.currency1, ERC20(p.currency1)]]));
  assert.equal(zero.decision, "REJECT");
  const missing = evaluatePool(p, new Map([[p.currency0, ERC20(p.currency0, { holders: null })], [p.currency1, ERC20(p.currency1)]]));
  assert.equal(missing.decision, "UNKNOWN");
});

test("CLI rejects nonempty pretty JSON instead of silently producing an empty result", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v4-compose-task42-"));
  try {
    const input = path.join(dir, "pretty.json");
    const token = path.join(dir, "token.txt");
    fs.writeFileSync(input, `${JSON.stringify({ "@data": { pools: [pool()] }, }, null, 2)}\n`);
    fs.writeFileSync(token, "test-token\n");
    const result = spawnSync(process.execPath, [composeScript, "--network", "base", "--token-file", token, "--input", input], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No supported JSONL records parsed/);
    assert.match(result.stderr, /pretty\/multiline JSON|JSONL/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI accepts a valid empty JSONL record without network access", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v4-compose-task42-"));
  try {
    const input = path.join(dir, "empty.jsonl");
    const token = path.join(dir, "token.txt");
    fs.writeFileSync(input, '{"@data":{"pools":[]}}\n');
    fs.writeFileSync(token, "test-token\n");
    const result = spawnSync(process.execPath, [composeScript, "--network", "base", "--token-file", token, "--input", input], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout).pools, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
