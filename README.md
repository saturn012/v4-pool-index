# v4-pool-index

> A minimal Uniswap v4 pool-identity index with a composable Initialize stream and a deterministic metadata decision layer.

**Before you enter a Uniswap v4 pool, know what you are buying — and
know what nobody can tell you.**

This tool composes two of The Graph's products into a per-pool verdict
with reasons, sources, and an explicit scope. It answers PASS, REJECT,
or UNKNOWN, and it never turns missing data into a confident answer:
"the metadata endpoint has no volume field" is reported as unknown, not
as "no market".

Agents reach it two ways: an MCP server, and a paid HTTP endpoint where
the agent settles 0.001 USDC over x402 with no human in the loop.

Verify without running anything:

- payment settled on Base Sepolia: [0xf52d84b8…](https://sepolia.basescan.org/tx/0xf52d84b85d0603841a98b17b4e4a42070f7d6c07e46efd8209f8f46b37d420d1)
- package in the registry, pullable by name: `v4-pool-index-consumer`

## Scope

The project indexes only `PoolManager.Initialize` on Robinhood Chain and Base. The original subgraph stores raw currencies, fee, tick spacing, hooks, initial square-root price, initial tick, block, timestamp, and transaction hash. The Substreams package emits reusable identity fields: `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks`.

`Swap` and `ModifyLiquidity` are intentionally out of scope. No path calculates prices or USD values, interprets dynamic fees as fixed percentages, or enables a wallet, transaction, sink, or AlphaScanner bridge.

## Code pointers (verified source commit)

The links below are pinned to source commit `e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95` so a reviewer lands on the verified lines rather than on a moving branch:

- PoolManager and `Initialize`: the Robinhood PoolManager address is `0x8366a39cc670b4001a1121b8f6a443a643e40951` in [`substreams/src/lib.rs`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/src/lib.rs#L18); the verified `Initialize` topic0 is `0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438` in the test constant ([`substreams/src/lib.rs#L71-L72`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/src/lib.rs#L71-L72)).
- [`substreams/src/lib.rs#L44-L62`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/src/lib.rs#L44-L62) filters `Initialize` logs by the selected PoolManager address, decodes the event, and emits the reusable pool fields.
- [`substreams/proto/pool/v1/pool.proto#L5-L16`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/proto/pool/v1/pool.proto#L5-L16) defines the protobuf output shape: `pool_id`, both currencies, raw `fee`, `tick_spacing`, and `hooks`.
- [`scripts/compose.mjs#L208-L235`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/scripts/compose.mjs#L208-L235) enriches the Substreams records with token metadata and provenance; [`scripts/compose.mjs#L155-L186`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/scripts/compose.mjs#L155-L186) contains the deterministic hook, fee, tick-spacing, metadata, and final `PASS`/`REJECT`/`UNKNOWN` decision rules.

## Local MCP

For a local stdio MCP client configuration, the two available pool tools, required environment variables, bounded lookup windows, and evidence limits, see [docs/mcp.md](docs/mcp.md). The MCP exposes `resolve_pool` and `assess_pool`; it does not open a public port or make trading decisions.

## What became easier through composition

In v4, `pool_id` is a hash of the `PoolKey`; the identity stream can tell us which currencies and pool parameters were initialized, but it does not supply token names or holder counts. The Graph Token API (operated by Pinax) supplies standardized token meaning, but it does not know which v4 pool produced the pair. Feeding the first product's output into the second makes one reproducible record that a rules engine can explain. This is a composition of two Graph products, not a claim that the entire Substreams platform cannot expose token metadata.

The public composition layer is `scripts/compose.mjs`. It consumes JSONL output from `map_initialize`, enriches Base ERC-20 currencies through `https://api.pinax.network/v1/evm/tokens`, preserves native zero-address currencies, and returns provider provenance plus a deterministic technical decision. The CLI now rejects non-empty input that contains no supported JSONL records, while a supported empty `pools` record remains a successful empty result; this keeps malformed or pretty/multiline JSON from silently becoming an empty composition.

### Reproducible Base example

A bounded read-only run at Base block `50994246` produced this pool identity:

- `pool_id`: `0xfa7714c40e1de3c702b8c8052230072d41f3f36f949bca2a26e9147d678a3c22`
- `currency0`: `0xd84af51aae54fe6df667e83a66291529b5456cdd` — `KING Robin` (`KING Robin`), 18 decimals, 4 holders
- `currency1`: `0xf67fcf24bbbff934c79ffb09399122482a25594d` — `cajonosama` (`cajonosama`), 18 decimals, 358 holders
- raw fee: `8388608`; tick spacing: `200`; hooks: `0x0469a4bd3724dc86c9542f4694c976da13c450c0`
- decision: `REJECT`, because the nonzero hooks are not bounded by initialize-only evidence; the dynamic-fee flag in raw fee `8388608` remains `UNKNOWN`, not a fixed percentage

The composed record preserves the Substreams source (`map_initialize`, Base), the Token API endpoint, provider fields, and observation timestamps. In this run the Token API supplied metadata for Base. That endpoint is unsupported for Robinhood Chain in this composition; Robinhood therefore remains Substreams-only here. This is an endpoint-coverage statement, not a claim that the whole platform cannot know token metadata.

## Deterministic decision layer

The rules are deliberately explainable and scoped:

- nonzero hooks: `REJECT`, because initialize-only evidence cannot bound hook callbacks;
- static fee above 10,000 ppm: `REJECT`; dynamic-fee flag: `UNKNOWN`, never treated as a normal percentage;
- non-positive tick spacing: `REJECT`;
- zero holders: `REJECT`; missing holders, name, symbol, decimals, or supply: `UNKNOWN`;
- missing volume: `UNKNOWN`, not “no market”.

A technical `PASS` means only that available initialize and metadata checks passed. It does not prove liquidity, slippage, transferability, price impact, or a successful buy/sell. The 1% per-leg fee screen is anchored to the measured approximately 1.2% round-trip baseline in the task evidence and to v4 raw fee units; it is not a trading recommendation.

## Network and package

- Robinhood Chain mainnet: chain ID 4663, PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`, start block `9070`.
- Base: chain ID 8453, PoolManager `0x498581ff718922c3f8e6a244956af099b2652b2b`, manifest floor `0`; bounded runs can use a relative start such as `-3000`.

The same `map_initialize` module is selected through manifest `network` overrides and `pool_manager` params. The published consumer package is `v4-pool-index-consumer@v0.1.0`; it can be pulled by registry name and is not required to run this repository.

## Live provider evidence

The Robinhood verification used the live Graph provider endpoint
`mainnet.robinhood.streamingfast.io:443` and streamed `map_initialize` over
the latest 5,000 blocks. The finding records 50 `Initialize` events in that
provider window and one independently decoded event at block `56634095`,
transaction
`0x94f1ff233e13e3d004914e992ae29e945498f057829c6a2305d4b62028b69f21`.
Its pool identity and decoded fields matched the independent log decode.

Method: provider output was treated as the live stream under test; RPC was
used only to obtain the block number for the recorded event. The referenced
finding does not contain a complete node-event count, exact node comparison
range, or totals for misses and false positives. Those provider-vs-node
metrics are therefore `UNKNOWN/PARTIAL` here rather than being inferred.
This is a bounded, public-chain, read-only observation; it does not prove
Token API coverage, current liquidity, hook safety, or execution, and it does
not imply AlphaScanner production integration.

## Reproduce

```sh
cd substreams
cargo test --lib
cargo build --release --target wasm32-unknown-unknown
substreams pack substreams.yaml
substreams run substreams.yaml map_initialize --network base --start-block -3000 --stop-block +300 --output jsonl > /tmp/base-initialize.jsonl
cd ..
node scripts/compose.mjs --network base --token-file ./local-token.txt --input /tmp/base-initialize.jsonl --limit 1
```

Keep the bearer token in a local file ignored by your environment. Do not put it in a shell argument, repository file, or log. The composition CLI reads it in-process and never prints it. The exact provider endpoint and authentication setup are account-dependent.

## Original subgraph reproduction

Use the project-local pinned Graph toolchain:

```sh
npm ci
npm run codegen
npm run build
npm test
```

The Matchstick runner requires the host runtime library `libpq.so.5`.

## Secret barrier

Private keys, mnemonics, API tokens, JWTs, and paid RPC URLs containing a path
key must never enter Git. Contract addresses, pool IDs, transaction hashes, and
the public x402 payment recipient are not secrets; the scanner does not reject a
plain 64-hex public identifier by length alone.

Install the clone-local pre-commit hook with one command:

```sh
npm run install-secrets-hook
```

Manually scan the current Git index:

```sh
npm run scan:secrets
```

The hook reads staged blobs from the Git index rather than the working tree. It
also rejects `.env` (including variants) and paths inside `secrets/`,
case-insensitively. `npm run scan:secrets:history` scans all refs, commit
messages, and reachable blobs; pass `-- --report /safe/path/report.json` for a
sanitized JSON report.

This task-52 local detector is not a replacement for review, CI, or access
control. It intentionally does not unpack binary/archive files, decode
base64/encrypted values, reconstruct values split across lines, or recognize all
proprietary token formats. `git commit --no-verify` bypasses any Git hook, so CI
and manual checks must run the same scanner independently.

The mnemonic dictionary is the full English BIP-39 wordlist from
[bitcoin/bips](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt),
vendored in `config/bip39-english.txt`. The scanner checks 12- and 24-word
dictionary sequences but does not validate their checksum.

## ETHOnline public artifacts

The files under `docs/ethonline/` are safe public versions of the specification, implementation prompt, plan, and demo script. Private coordination paths, server addresses, credentials, internal reports, and non-public fixture identities are intentionally omitted. This repository does not claim partner-prize acceptance; live evidence, continuity history, publication, and the owner-recorded demo remain separate gates.

## AI assistance disclosure

AI tools assisted with the original Graph subgraph, Substreams implementation, ABI/code generation setup, composition layer, tests, documentation, public-artifact drafting, and automated verification runs in this repository. The human project owner supplied requirements, selected the scope and direction, made repository and publication decisions, and authorized the work. The README does not claim manual source or code verification by the owner where no such evidence exists.
## Local x402 assessment

A local, Base-Sepolia-only paid `GET /assess` wrapper and the owner-run `npm run pay:assess -- <pool_id> --network base` client are documented in [`docs/x402.md`](docs/x402.md). The payer accepts only the configured Base Sepolia USDC requirement and emits no automatic retry after a signed request. This remains a loopback-only, testnet procedure: it has no public listener, server-side private key, trading action, or mainnet route.

## Reproducible demo

The video/demo path is one command from data to paid assessment:

```sh
npm run demo
```

Before the run it aggregates all missing prerequisites: npm runtime dependencies, the `substreams` CLI, the canonical `THEGRAPH_TOKEN`, Token API availability, the payer key, the Base Sepolia USDC balance, and the loopback assessment server. The check-only command performs the same preflight, never signs, pays, starts a persistent server, or runs the assessment:

```sh
npm run demo:check
```

The default demo uses the Base pool from the reproducible example above. The first three steps show `map_initialize`, Token API metadata, and the existing `assess_pool`-shaped verdict with sources, reasons, and limits. Steps 4–6 show the machine-readable HTTP 402, the existing x402 payer's single signed retry, and the settled result. Each invocation costs `1000` atomic USDC units (`0.001 USDC`) on Base Sepolia; the preflight reports a two-run plan of `2000` units so a second recorded run can be made deliberately. Only the dedicated payer `X402_PAYER_PRIVATE_KEY` and the dedicated receiver from `config/assess-x402.mjs` are in scope; the trading wallet is not used.

If the network or provider is unavailable, the first three steps can be rehearsed without any external I/O or secret access:

```sh
npm run demo -- --offline
```

Offline output is explicitly marked as recorded fixtures, and steps 4–6 are not run. The paid path is Base Sepolia only; test USDC is available from the [Circle faucet](https://faucet.circle.com/). The payer's ETH balance is advisory: the x402 facilitator submits the settlement transaction and pays gas, so payer ETH does not affect a run. The balance checks use Base's public [Base Sepolia RPC](https://docs.base.org/base-chain/api-reference/rpc-overview) and never treat an unknown response as zero.
