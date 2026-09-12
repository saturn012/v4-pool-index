# Review and reproduction guide

This guide separates recorded live evidence, current local checks and external submission status. Start with [current submission copy](submission.md) and [Continuity disclosure](continuity.md).

## Claims and evidence

| Claim | Inspect | Boundary |
| --- | --- | --- |
| Reusable identity | [producer source](../../substreams/src/lib.rs), [protobuf](../../substreams/proto/pool/v1/pool.proto), [registry package](https://substreams.dev/packages/v4-pool-index/v0.1.2) | Initialize fields only |
| Package composition | [consumer import and input](../../consumer/substreams.yaml), [consumer source](../../consumer/src/lib.rs), [registry consumer](https://substreams.dev/packages/v4-pool-index-consumer/v0.1.1) | Computes statistics, not the per-pool verdict |
| Explainable assessment | [composition rules](../../scripts/compose.mjs), [MCP](../../scripts/mcp.mjs) | Producer plus Pinax metadata; deterministic scoped checks |
| BSC extension | [local manifest](../../substreams/substreams.yaml), [recorded reconciliation](../../README.md#bsc-bounded-verification) | One 200-block observation; not included in the published package versions |
| Paid delivery | [full recorded run](../evidence/2026-09-11_paid-run.md), [matching transaction](https://sepolia.basescan.org/tx/0xc2cb8f09373c57f077660e855ca0685ce14b5d924401860200f51698130bcbdd) | Historical real Base Sepolia settlement; loopback service |
| Prior work and AI use | [disclosure](continuity.md), [development archive](development-artifacts.md) | Existing private product is outside this submission |

## Reproduce without credentials or payment

From a fresh checkout, install the lockfile's dependencies with Node.js/npm available:

```sh
git clone https://github.com/saturn012/v4-pool-index.git
cd v4-pool-index
npm ci
node --test scripts/*.test.mjs tests/*.test.mjs
npm run demo -- --offline
```

The Node tests exercise fixtures and transient loopback servers. Some tests construct temporary Git repositories, so Git must be installed and the temporary filesystem must be writable. The offline demo explicitly labels fixture data and omits paid steps. It is rehearsal evidence, not a substitute for the recorded live provider/payment run.

For the original subgraph, use the pinned Graph CLI from npm. Its Matchstick binary requires `libpq.so.5` on the verified Linux environment; other platforms may need their supported Matchstick setup.

```sh
npm run codegen
npm run build < /dev/null
npm test < /dev/null
```

The explicit stdin redirection prevents Graph CLI from interpreting piped shell instructions as a manifest. Interactive terminal use does not need that workaround.

Rust producer tests and WASM builds require Cargo, the `wasm32-unknown-unknown` target and package-registry access on the first build:

```sh
cargo test --locked --manifest-path substreams/Cargo.toml --lib
cargo build --locked --manifest-path substreams/Cargo.toml --release --target wasm32-unknown-unknown
cargo build --locked --manifest-path consumer/Cargo.toml --release --target wasm32-unknown-unknown
```

Run `npm run scan:secrets` before publishing changes. It scans tracked/indexed content, so include newly authored files in the index before relying on that check. Historical commit scanning is available through `npm run scan:secrets:history`; it reports findings, not proof that all possible secrets are detectable.

## Live reproduction

The [MCP instructions](../mcp.md) document explicit provider-token configuration and a cold registry lookup that needs no Rust build. The [x402 instructions](../x402.md) describe a deliberate Base Sepolia-only payment. Both use bounded windows. These require the operator's own provider access; payment also requires an explicitly authorized, dedicated test payer.

No automated live payment is needed to inspect the existing [recorded receipt and assessment](../evidence/2026-09-11_paid-run.md). A transaction alone proves settlement; the full run provides the corresponding HTTP response and verdict.

## External submission status

The technical repository, packages and recorded payment are available. A video upload, the owner's completed personal feedback and external form submission receipts remain separate evidence. This repository does not certify those actions as done or guarantee partner qualification.

Submission deadline: 13 September 2026 at 12:00 EDT (19:00 Moscow). The video must be 2–4 minutes, at least 720p, with human narration and no speed-up. Check the [official event rules](https://ethglobal.com/events/ethonline2026/info/details) before submission.
