import assert from "node:assert/strict";
import test from "node:test";
import { PayerClientError, buildAssessUrl, createOfficialClient, runAssessClient, runPaymentAttempt } from "./assess-client.mjs";

const poolId = `0x${"ab".repeat(32)}`;
const syntheticPrivateKey = `0x${"11".repeat(32)}`;
const payerHttpMethods = [
  "getPaymentRequiredResponse",
  "createPaymentPayload",
  "encodePaymentSignatureHeader",
  "getPaymentSettleResponse",
];

function assertFakeMatchesOfficial(fake, official) {
  for (const method of payerHttpMethods) {
    assert.equal(typeof official[method], "function", `official x402 client is missing ${method}`);
    assert.equal(typeof fake[method], typeof official[method], `test fake diverges from official x402 client at ${method}`);
  }
}

const expectedRequirement = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0xcED7757fb07449f2f20AB673255fEc480104c54A",
  maxTimeoutSeconds: 300,
};

function response(status, { headers = {}, body = {} } = {}) {
  return { status, headers: new Headers(headers), json: async () => body };
}

function fakeClient({ requirement = expectedRequirement, settlement = { success: true, network: "eip155:84532", transaction: `0x${"cd".repeat(32)}` } } = {}) {
  const calls = { createPayload: 0, settle: 0 };
  return {
    calls,
    getPaymentRequiredResponse() { return { x402Version: 2, accepts: [requirement] }; },
    async createPaymentPayload() { calls.createPayload += 1; return { authorization: "synthetic" }; },
    encodePaymentSignatureHeader() { return { "payment-signature": "synthetic-payment" }; },
    getPaymentSettleResponse() { calls.settle += 1; return settlement; },
  };
}

function run({ client = fakeClient(), fetchImpl } = {}) {
  return runPaymentAttempt({ argv: [poolId], fetchImpl, client });
}

test("buildAssessUrl accepts only a Base pool id and emits the loopback assess URL", () => {
  assert.equal(buildAssessUrl([poolId, "--network", "base"]), `http://127.0.0.1:4021/assess?network=base&pool_id=${poolId}`);
  assert.throws(() => buildAssessUrl([poolId, "--network", "robinhood"]), { code: "INVALID_NETWORK" });
});

test("missing payer key exits before client construction or network access", async () => {
  let fetchCalls = 0;
  let clientCalls = 0;
  await assert.rejects(
    runAssessClient({ argv: [poolId], env: {}, fetchImpl: async () => { fetchCalls += 1; }, createClient: async () => { clientCalls += 1; } }),
    (error) => error instanceof PayerClientError && error.code === "MISSING_PAYER_KEY",
  );
  assert.equal(clientCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("client initialization redacts an opaque SDK error before any request", async () => {
  const marker = "synthetic-private-value";
  let fetchCalls = 0;
  await assert.rejects(
    runAssessClient({
      argv: [poolId],
      env: {},
      fetchImpl: async () => { fetchCalls += 1; },
      readPayerKey: () => marker,
      createClient: async () => { throw new Error(`SDK rejected privateKey=${marker}`); },
    }),
    (error) => error instanceof PayerClientError &&
      error.code === "CLIENT_INITIALIZATION_FAILED" &&
      error.message.includes("SDK cause: SDK rejected privateKey=[redacted]") &&
      !error.message.includes(marker),
  );
  assert.equal(fetchCalls, 0);
});

test("official client is the x402 HTTP wrapper required by the payer flow", async () => {
  const client = await createOfficialClient(syntheticPrivateKey);
  for (const method of payerHttpMethods) {
    assert.equal(typeof client[method], "function", `official x402 client is missing ${method}`);
  }
});

test("test fake matches the official x402 HTTP client and rejects a missing HTTP method", async () => {
  const official = await createOfficialClient(syntheticPrivateKey);
  const fake = fakeClient();
  assertFakeMatchesOfficial(fake, official);

  const divergentFake = { ...fake };
  delete divergentFake.getPaymentRequiredResponse;
  assert.throws(
    () => assertFakeMatchesOfficial(divergentFake, official),
    /test fake diverges from official x402 client at getPaymentRequiredResponse/,
  );
});

test("402 parser retains a redacted SDK cause beside its machine-readable code", async () => {
  const marker = "synthetic-payment-signature";
  const client = fakeClient();
  client.getPaymentRequiredResponse = () => {
    throw new Error(`SDK parse failure PAYMENT-SIGNATURE=${marker} token=synthetic-token`);
  };
  await assert.rejects(
    run({ client, fetchImpl: async () => response(402, { headers: { "payment-required": "synthetic" } }) }),
    (error) => error instanceof PayerClientError &&
      error.code === "UNEXPECTED_PAYMENT_REQUIREMENT" &&
      error.message.includes("SDK cause: SDK parse failure PAYMENT-SIGNATURE=[redacted] token=[redacted]") &&
      !error.message.includes(marker) &&
      !error.message.includes("synthetic-token"),
  );
});

test("rejects an unexpected 402 requirement before creating a payment payload", async () => {
  const client = fakeClient({ requirement: { ...expectedRequirement, amount: "1001" } });
  let fetchCalls = 0;
  await assert.rejects(
    run({ client, fetchImpl: async () => { fetchCalls += 1; return response(402, { headers: { "payment-required": "synthetic" } }); } }),
    (error) => error instanceof PayerClientError && error.code === "UNEXPECTED_PAYMENT_REQUIREMENT",
  );
  assert.equal(fetchCalls, 1);
  assert.equal(client.calls.createPayload, 0);
});

test("a repeated 402 is a known rejection and never triggers a third request", async () => {
  const client = fakeClient();
  const requests = [];
  await assert.rejects(
    run({ client, fetchImpl: async (_url, options) => { requests.push(options); return response(402, { headers: { "payment-required": "synthetic" } }); } }),
    (error) => error instanceof PayerClientError && error.code === "KNOWN_PAYMENT_REJECTION",
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[1].redirect, "error");
  assert.equal(requests[1].headers["payment-signature"], "synthetic-payment");
});

test("a signed retry transport failure is unknown and never retried", async () => {
  const client = fakeClient();
  const requests = [];
  await assert.rejects(
    run({
      client,
      fetchImpl: async (_url, options) => {
        requests.push(options);
        if (requests.length === 1) return response(402, { headers: { "payment-required": "synthetic" } });
        throw new Error("connection closed after signed request");
      },
    }),
    (error) => error instanceof PayerClientError && error.code === "UNKNOWN_PAYMENT_OUTCOME",
  );
  assert.equal(requests.length, 2);
  assert.equal(client.calls.createPayload, 1);
});

test("only a settled response with HTTP 200 and a valid transaction hash is paid success", async () => {
  const client = fakeClient();
  let fetchCalls = 0;
  const result = await run({
    client,
    fetchImpl: async () => {
      fetchCalls += 1;
      return fetchCalls === 1
        ? response(402, { headers: { "payment-required": "synthetic" } })
        : response(200, { headers: { "payment-response": "synthetic" }, body: { verdict: "PASS" } });
    },
  });
  assert.deepEqual(result, {
    status: 200, transaction: `0x${"cd".repeat(32)}`, amount: "1000", network: "eip155:84532",
    receiver: "0xcED7757fb07449f2f20AB673255fEc480104c54A", body: { verdict: "PASS" },
  });
  assert.equal(fetchCalls, 2);
  assert.equal(client.calls.settle, 1);
});

test("a paid 200 without a verifiable transaction hash is unknown", async () => {
  const client = fakeClient({ settlement: { success: true, network: "eip155:84532" } });
  let fetchCalls = 0;
  await assert.rejects(
    run({
      client,
      fetchImpl: async () => {
        fetchCalls += 1;
        return fetchCalls === 1
          ? response(402, { headers: { "payment-required": "synthetic" } })
          : response(200, { headers: { "payment-response": "synthetic" } });
      },
    }),
    (error) => error instanceof PayerClientError && error.code === "UNKNOWN_PAYMENT_OUTCOME",
  );
  assert.equal(fetchCalls, 2);
});

for (const [name, settlement] of [
  ["settlement success is false", { success: false, network: "eip155:84532", transaction: `0x${"cd".repeat(32)}` }],
  ["settlement network is not Base Sepolia", { success: true, network: "eip155:8453", transaction: `0x${"cd".repeat(32)}` }],
]) {
  test(`a paid 200 with ${name} is unknown and never retried`, async () => {
    const client = fakeClient({ settlement });
    let fetchCalls = 0;
    await assert.rejects(
      run({
        client,
        fetchImpl: async () => {
          fetchCalls += 1;
          return fetchCalls === 1
            ? response(402, { headers: { "payment-required": "synthetic" } })
            : response(200, { headers: { "payment-response": "synthetic" } });
        },
      }),
      (error) => error instanceof PayerClientError && error.code === "UNKNOWN_PAYMENT_OUTCOME",
    );
    assert.equal(fetchCalls, 2);
  });
}
