import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { createAssessApp, createX402PaymentMiddleware, isMainModule, requirePublicPayTo, routesFor, runtimeConfig } from "./assess-http.mjs";

const payTo = "0x1111111111111111111111111111111111111111";
const poolId = `0x${"ab".repeat(32)}`;
const resolved = {
  pool_id: poolId,
  network: "base",
  currencies: { currency0: { status: "PASS" }, currency1: { status: "PASS" } },
  provenance: { source: "Substreams map_initialize", network: "base" },
  scope: "initialize identity only; no swap, liquidity, slippage, transfer, or wallet evidence",
  decision: { decision: "PASS", checks: [{ name: "hooks", status: "PASS", reason: "zero hook address" }] },
};

function offlinePaymentGate() {
  return (req, res, next) => {
    if (req.get("x-offline-test-payment") === "accepted") return next();
    res.status(402).set("payment-required", "offline-test-requirements").json({ error: "payment required" });
  };
}

function officialOfflinePaymentGate(payTo) {
  return createX402PaymentMiddleware(payTo, {
    facilitator: {
      async getSupported() {
        return { kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }], extensions: [], signers: {} };
      },
      async verify() {
        throw new Error("verify must not run for this test input");
      },
      async settle() {
        throw new Error("settle must not run for this test input");
      },
    },
  });
}

async function request(app, path, headers = {}, method = "GET") {
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: server.address().port, path, method, headers }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: body ? JSON.parse(body) : null }));
      });
      req.on("error", reject);
      req.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("public recipient configuration accepts only a nonzero EVM address", () => {
  assert.equal(requirePublicPayTo(payTo), payTo);
  assert.throws(() => requirePublicPayTo(""), { code: "INVALID_PAY_TO" });
  assert.throws(() => requirePublicPayTo(`0x${"0".repeat(40)}`), { code: "INVALID_PAY_TO" });
  assert.equal(runtimeConfig({}).payTo, "0xcED7757fb07449f2f20AB673255fEc480104c54A");
  const route = routesFor(payTo)["GET /assess"];
  assert.deepEqual(route.accepts, [{ scheme: "exact", price: "$0.001", network: "eip155:84532", payTo }]);
});

test("official x402 middleware returns 402 before resolver work for an unpaid real HTTP request", async () => {
  let calls = 0;
  const app = createAssessApp({ payTo, resolver: async () => { calls += 1; return resolved; }, paymentGate: officialOfflinePaymentGate });
  const response = await request(app, `/assess?pool_id=${poolId}&network=base`);
  assert.equal(response.status, 402);
  assert.ok(response.headers["payment-required"]);
  assert.equal(calls, 0);
});

test("malformed payment header never reaches assessment", async () => {
  let calls = 0;
  const app = createAssessApp({ payTo, resolver: async () => { calls += 1; return resolved; }, paymentGate: officialOfflinePaymentGate });
  const response = await request(app, `/assess?pool_id=${poolId}&network=base`, { "payment-signature": "not-a-payment" });
  assert.ok([400, 402].includes(response.status));
  assert.equal(calls, 0);
});

test("offline accepted payment gate releases only a valid bounded assessment", async () => {
  let calls = 0;
  const app = createAssessApp({
    payTo,
    resolver: async (args) => { calls += 1; return { ...resolved, ...args }; },
    paymentGate: offlinePaymentGate,
  });
  const response = await request(app, `/assess?pool_id=${poolId}&network=base`, { "x-offline-test-payment": "accepted" });
  assert.equal(response.status, 200);
  assert.equal(response.body.verdict, "PASS");
  assert.equal(calls, 1);
});

test("even an accepted test gate does not run a malformed assessment", async () => {
  let calls = 0;
  const app = createAssessApp({ payTo, resolver: async () => { calls += 1; return resolved; }, paymentGate: offlinePaymentGate });
  const response = await request(app, "/assess?pool_id=bad&network=base", { "x-offline-test-payment": "accepted" });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_POOL_ID");
  assert.equal(calls, 0);
});

test("npm script path is recognized as the executable module", () => {
  assert.equal(isMainModule(path.resolve("scripts/assess-http.mjs")), true);
  assert.equal(isMainModule(path.resolve("scripts/mcp.mjs")), false);
});

test("only GET is permitted for assess; HEAD and all other methods cannot reach the resolver", async () => {
  for (const method of ["HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    let calls = 0;
    const app = createAssessApp({ payTo, resolver: async () => { calls += 1; return resolved; }, paymentGate: officialOfflinePaymentGate });
    const response = await request(app, `/assess?pool_id=${poolId}&network=base`, {}, method);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.allow, "GET", method);
    assert.equal(response.headers["payment-required"], undefined, method);
    assert.equal(calls, 0, method);
  }
});

test("runtime host is loopback-only and rejects wildcard or public bindings", () => {
  assert.equal(runtimeConfig({ ASSESS_HOST: "127.0.0.1" }).host, "127.0.0.1");
  for (const host of ["0.0.0.0", "::", "::1", "localhost", "192.0.2.10"]) {
    assert.throws(() => runtimeConfig({ ASSESS_HOST: host }), { code: "INVALID_HOST" }, host);
  }
});
