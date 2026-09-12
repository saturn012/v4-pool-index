# ETHOnline finalization verification — 12 September 2026

Scope: documentation and public engineering materials in the existing `saturn012/v4-pool-index` repository. Starting commit: `00793453e50ce1a26ed59516c34cc663ee3b3a8f`. Runtime code, lockfiles, manifests, registry package versions and the full recorded paid response are unchanged.

## Fresh local checks

Checks ran in an isolated Linux checkout with Node.js 22.23.1, npm 10.9.8, Cargo/Rust 1.98.1, Substreams CLI 1.22.0 and the installed Matchstick runtime dependencies.

| Check | Result | Detail |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | PASS | Clean checkout installed the existing lockfile |
| `node --test scripts/*.test.mjs tests/*.test.mjs` | PASS | 63 tests passed; none failed/skipped |
| `npm run codegen` | PASS | Generated subgraph types in ignored output directories |
| `npm run build < /dev/null` | PASS | Original subgraph build |
| `npm test < /dev/null` | PASS | 2 Graph/Matchstick tests passed |
| `npm run demo -- --offline` | PASS | Fixture-labeled stages 1–3; no paid stages |
| `cargo test --locked --offline --manifest-path substreams/Cargo.toml --lib` | PASS | 3 Rust tests passed |
| `cargo build --locked --offline --manifest-path substreams/Cargo.toml --release --target wasm32-unknown-unknown` | PASS | Producer WASM build from source |
| `cargo build --locked --offline --manifest-path consumer/Cargo.toml --release --target wasm32-unknown-unknown` | PASS | Consumer WASM build from source |
| Actual stdio MCP subprocess | PASS | Initialize, exactly two tools, invalid input rejection; no provider or payment call |

Cargo's installed user binary directory was added to PATH for the Rust checks. `--offline` means these Rust builds used the existing local dependency cache; a first build on a new host still needs registry access.

## Failed attempts and resolution

An earlier audit before disk cleanup passed 48 Node tests and failed 15 while creating temporary fixtures (`ENOSPC`); Graph tests could not start. The fresh isolated run above occurred after space was restored and replaces that blocked runtime result.

The first Graph build in the finalization run inherited the piped SSH command stream as stdin and interpreted the remaining shell text as a manifest path. Re-running with stdin redirected from `/dev/null` passed. No source change was made for this runner error.

The first Rust commands did not find Cargo in the non-login PATH (exit 127). Explicitly adding the installed Cargo directory resolved that launch issue; the subsequent test and both builds passed.

## Public link checks and recorded live evidence

Anonymous HTTP GET returned 200 for the GitHub repository and both [producer](https://substreams.dev/packages/v4-pool-index/v0.1.2) and [consumer](https://substreams.dev/packages/v4-pool-index-consumer/v0.1.1) registry pages.

The Base Sepolia explorer returned an automated HTTP 403 challenge. Its browser reachability is therefore not reported as a fresh PASS. A read-only receipt recheck through the public Base Sepolia RPC also returned an HTTP error, so fresh receipt availability is UNKNOWN. The [full paid-run evidence](docs/evidence/2026-09-11_paid-run.md) preserves the HTTP 402, HTTP 200, returned assessment and matching receipt check for transaction `0xc2cb8f09373c57f077660e855ca0685ce14b5d924401860200f51698130bcbdd`.

The 11 September paid round and earlier provider/RPC reconciliations are recorded live evidence, not new payments/provider runs executed by this finalization. Local BSC evidence covers only the specified 200-block window. Current provider availability and mainnet trading behavior are not inferred from those observations.

## Engineering changes

- README distinguishes the statistics consumer from the producer-plus-Pinax assessment path and links the settlement from the same recorded paid round.
- Continuity disclosure identifies the prior private product, the new component, upstream materials, AI assistance and unfinished integration.
- MCP/x402 instructions use operator-selected credentials and portable checkout commands; x402 documents the recorded paid success.
- Current submission copy, demo script, review guide, component specifications and finalization plan are separate files.
- Earlier task documents remain preserved and labeled historical. New component specifications explicitly disclose that they were reconstructed during finalization.

## Remaining external and archival items

The original internal task/design archive was not bulk-published. All 31 sanitized drafts received an independent privacy review; direct public release was not cleared because private operational context remains even after mechanical redaction. The [development index](docs/ethonline/development-artifacts.md) states which documents are earlier public artifacts and which are retrospective reconstructions; complete original-artifact coverage remains PARTIAL.

The owner's personal FEEDBACK sections, the external Uniswap form, the recorded human-narrated video and the ETHGlobal submission receipt remain unverified. Repository completion does not imply those submissions occurred or that partner qualification is guaranteed.

## Release record

Independent read-only review returned SHIP for the scoped documentation release. The index secret scan passed with 70 items and zero findings; history scan passed with 167 items and zero findings. All 61 checked relative links resolved, the 22 changed files were Markdown-only, and no private deployment references were found in those files. Final publication identity is verified against the remote during the release gate. The owner report supplies the exact thematic commit IDs, backup location and ordered revert commands. No force push, package republish, payment or private production deployment belongs to this finalization.
