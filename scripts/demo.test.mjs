import assert from "node:assert/strict";
import test from "node:test";
import { checkBalances, checkDependencies, graphEnvironment, runOfflineDemo, runPreflight, withOwnedServer } from "./demo.mjs";

test("dependency preflight names every missing runtime dependency", async () => {
  const result = await checkDependencies({
    packagePath: new URL("../package.json", import.meta.url),
    requireResolve: () => { throw new Error("missing"); },
  });
  assert.equal(result.status, "FAIL");
  assert.match(result.message, /missing:/);
  assert.ok(result.missing.length >= 1);
});

test("preflight aggregates all missing prerequisites", async () => {
  const result = await runPreflight({
    env: {},
    adapters: {
      dependencies: async () => ({ status: "FAIL", name: "npm dependencies", message: "missing: express; run npm install" }),
      substreams: () => ({ status: "FAIL", name: "substreams CLI", message: "missing" }),
      loadToken: async () => null,
      tokenApi: async () => ({ status: "FAIL", name: "Token API", message: "token missing" }),
      deriveAddress: async () => ({ status: "FAIL", name: "payer key", message: "X402_PAYER_PRIVATE_KEY is missing" }),
      balances: async () => ({ checks: [{ status: "UNKNOWN", name: "payer balances", message: "address unavailable" }] }),
      server: async () => ({ status: "UNKNOWN", name: "assessment server", message: "not attempted" }),
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.checks.map((item) => item.name), ["npm dependencies", "substreams CLI", "Graph token", "Token API", "payer key", "payer balances", "assessment server"]);
});

test("RPC/balance failure is UNKNOWN and never treated as zero", async () => {
  const result = await checkBalances({
    address: "0x1111111111111111111111111111111111111111",
    fetchImpl: async () => { throw new Error("RPC unavailable"); },
  });
  assert.equal(result.checks[0].status, "UNKNOWN");
  assert.equal(result.checks[1].status, "UNKNOWN");
  assert.match(result.checks[0].message, /not treat it as zero/);
});

test("offline path renders only fixture steps and makes no fetch call", async () => {
  const output = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline fetch must not run"); };
  try {
    const result = await runOfflineDemo({ write: (line) => output.push(String(line)) });
    assert.equal(result.provenance.fixture, true);
    assert.ok(output.some((line) => line.includes("OFFLINE MODE")));
    assert.ok(output.some((line) => line.includes("steps 1–3")));
    assert.equal(output.some((line) => line.includes("STEP 4/6")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("owned server is closed even when the demo task fails", async () => {
  let closed = false;
  const server = { listening: true, close(callback) { closed = true; this.listening = false; callback(); } };
  await assert.rejects(withOwnedServer({ startServer: async () => server, task: async () => { throw new Error("step failed"); } }), /step failed/);
  assert.equal(closed, true);
});

test("Graph/Substreams child environment never receives payer private key", () => {
  const result = graphEnvironment({ X402_PAYER_PRIVATE_KEY: "0xsecret-like-value", OTHER: "kept" }, "graph-token");
  assert.equal(result.X402_PAYER_PRIVATE_KEY, undefined);
  assert.equal(result.THEGRAPH_TOKEN, "graph-token");
  assert.equal(result.OTHER, "kept");
});
