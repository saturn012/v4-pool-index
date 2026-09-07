import test from "node:test";
import assert from "node:assert/strict";
import { ZERO_ADDRESS, evaluatePool, parseStreamText } from "./compose.mjs";

const ERC20 = (address, overrides = {}) => ({ contract: address, name: "Example Token", symbol: "EXT", decimals: 18, holders: 42, circulating_supply: 1000000, ...overrides });
const pool = (overrides = {}) => ({ pool_id: `0x${"11".repeat(32)}`, currency0: `0x${"22".repeat(20)}`, currency1: `0x${"33".repeat(20)}`, fee: 500, tick_spacing: 10, hooks: ZERO_ADDRESS, ...overrides });

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
