import test from "node:test";
import assert from "node:assert/strict";
import { createHandler, PROTOCOL_VERSION, validateArguments } from "./mcp.mjs";

const poolId = `0x${"11".repeat(32)}`;
const resolved = {
  pool_id: poolId,
  network: "base",
  pool: { currency0: `0x${"22".repeat(20)}`, currency1: `0x${"33".repeat(20)}`, fee: 500, tick_spacing: 10, hooks: `0x${"00".repeat(20)}` },
  currencies: { currency0: { status: "PASS" }, currency1: { status: "PASS" } },
  provenance: { source: "Substreams map_initialize", network: "base", search_window: { start_block: 1, stop_block_exclusive: 2 } },
  scope: "initialize identity only; no swap, liquidity, slippage, transfer, or wallet evidence",
  decision: { decision: "PASS", checks: [{ name: "hooks", status: "PASS", reason: "zero hook address" }] },
};
const handler = createHandler({ resolver: async ({ poolId: requested, network }) => ({ ...resolved, pool_id: requested, network }) });

async function request(method, params, id = 1) {
  return handler({ jsonrpc: "2.0", id, method, params });
}

test("initialize negotiates the supported MCP protocol", async () => {
  const response = await request("initialize", { protocolVersion: PROTOCOL_VERSION });
  assert.equal(response.result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(response.result.capabilities.tools.listChanged, false);
});

test("tools/list exposes exactly the two bounded pool tools", async () => {
  const response = await request("tools/list");
  assert.deepEqual(response.result.tools.map((tool) => tool.name), ["resolve_pool", "assess_pool"]);
});

test("resolve_pool returns pool identity, coverage, provenance, and scope", async () => {
  const response = await request("tools/call", { name: "resolve_pool", arguments: { pool_id: poolId, network: "base" } });
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(response.result.isError, undefined);
  assert.equal(payload.pool_id, poolId);
  assert.equal(payload.provenance.source, "Substreams map_initialize");
  assert.match(payload.scope, /no swap/);
  assert.equal(payload.decision, undefined);
});

test("assess_pool always returns a verdict, reasons, provenance, and scope", async () => {
  const response = await request("tools/call", { name: "assess_pool", arguments: { pool_id: poolId, network: "base" } });
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.verdict, "PASS");
  assert.deepEqual(payload.reason, ["hooks: zero hook address"]);
  assert.equal(payload.provenance.network, "base");
  assert.match(payload.scope, /wallet evidence/);
});

test("pool id and network validation reject malformed or unsupported input", () => {
  assert.throws(() => validateArguments({ pool_id: "0x1234", network: "base" }), { code: "INVALID_POOL_ID" });
  assert.throws(() => validateArguments({ pool_id: poolId, network: "ethereum" }), { code: "INVALID_NETWORK" });
});

test("tool errors are structured MCP results rather than stdout diagnostics", async () => {
  const response = await request("tools/call", { name: "resolve_pool", arguments: { pool_id: "bad", network: "base" } });
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(response.result.isError, true);
  assert.equal(payload.error.code, "INVALID_POOL_ID");
});
