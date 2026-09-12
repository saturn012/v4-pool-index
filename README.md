# v4-pool-index

> A minimal Uniswap v4 pool-identity index with a composable Initialize stream and a deterministic metadata decision layer.

**Before you enter a Uniswap v4 pool, know what you are buying — and
know what nobody can tell you.**

A published Substreams producer supplies a typed stream of pool identities.
A published consumer imports that stream through the registry and computes
pool statistics. A separate assessment path reads the producer directly,
adds Pinax Token API metadata, and returns PASS, REJECT, or UNKNOWN with
reasons, sources, and an explicit scope. Missing volume is reported as
unknown; it is never interpreted as an absent market.

Agents reach it two ways: an MCP server, and a paid HTTP endpoint. The x402
payment and assessment happen without a human in the loop; the assessment
server itself is loopback-only and has no public listener.

Verify without running anything:

- package in the registry, pullable by name: [`v4-pool-index-consumer@v0.1.1`](https://substreams.dev/packages/v4-pool-index-consumer/v0.1.1)
- payment settled on Base Sepolia: [0xc2cb8f09…](https://sepolia.basescan.org/tx/0xc2cb8f09373c57f077660e855ca0685ce14b5d924401860200f51698130bcbdd)
- paid HTTP 200 + verdict evidence: [2026-09-11 paid run](docs/evidence/2026-09-11_paid-run.md)

For a short path through the code and evidence, use the [review and
reproduction guide](docs/ethonline/judge-guide.md).

## Continuity: prior work and this submission

AlphaScanner is the owner's pre-existing private Telegram signal and BNB
Chain execution product. Those systems are outside this submission. The
public history here begins on 5 September 2026 and contains the new
pool-identity and assessment component, alongside attributed upstream
libraries and generated material. Integration into the existing product
is unfinished; no production bridge is claimed. See the full
[Continuity and AI disclosure](docs/ethonline/continuity.md).

## Scope

The published packages index only `PoolManager.Initialize` on Robinhood Chain and Base. The local producer manifest additionally contains the bounded BSC extension documented below. The original subgraph stores raw currencies, fee, tick spacing, hooks, initial square-root price, initial tick, block, timestamp, and transaction hash. The Substreams package emits reusable identity fields: `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks`.

`Swap` and `ModifyLiquidity` are intentionally out of scope. No path calculates prices or USD values, interprets dynamic fees as fixed percentages, or enables a trading wallet, trading transaction, sink, or AlphaScanner bridge. The x402 payment is a separate Base Sepolia settlement transaction, not a trading transaction path.

## Code pointers (verified source commit)

The links below are pinned to source commit `e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95` so a reviewer lands on the verified lines rather than on a moving branch:

- PoolManager and `Initialize`: the Robinhood PoolManager address is `0x8366a39cc670b4001a1121b8f6a443a643e40951` in [`substreams/src/lib.rs`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/src/lib.rs#L18); the verified `Initialize` topic0 is `0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438` in the test constant ([`substreams/src/lib.rs#L71-L72`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/src/lib.rs#L71-L72)).
- [`substreams/src/lib.rs#L44-L62`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/src/lib.rs#L44-L62) filters `Initialize` logs by the selected PoolManager address, decodes the event, and emits the reusable pool fields.
- [`substreams/proto/pool/v1/pool.proto#L5-L16`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/substreams/proto/pool/v1/pool.proto#L5-L16) defines the protobuf output shape: `pool_id`, both currencies, raw `fee`, `tick_spacing`, and `hooks`.
- [`scripts/compose.mjs#L208-L235`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/scripts/compose.mjs#L208-L235) enriches the Substreams records with token metadata and provenance; [`scripts/compose.mjs#L155-L186`](https://github.com/saturn012/v4-pool-index/blob/e647f3fa6acf5adc8d3ae40be5be2cad1ce4bd95/scripts/compose.mjs#L155-L186) contains the deterministic hook, fee, tick-spacing, metadata, and final `PASS`/`REJECT`/`UNKNOWN` decision rules.

## Local MCP

For a local stdio MCP client configuration, the two available pool tools, required environment variables, bounded lookup windows, and evidence limits, see [docs/mcp.md](docs/mcp.md). The MCP exposes `resolve_pool` and `assess_pool`; it does not open a public port or make trading decisions.

## What became easier through package composition

The package-composition demonstration is producer + statistics consumer
through the Substreams registry. The consumer imports
`v4-pool-index@v0.1.2` by name as `pools:map_initialize` and uses its output
without copying the decoder. The assessment served by MCP/x402 reads the
producer directly and enriches it through Pinax; it does not consume the
statistics package. Both paths reuse the same typed pool identity.

The shared typed identity stream makes the standards leverage concrete: the PoolManager address is a parameter, not a chain-bound Rust constant. Adding the third network, BSC, therefore required one manifest entry and zero Rust lines; its existing 200-block verification emitted two records through that same stream. Downstream packages do not need to rewrite `Initialize` parsing for each network or each consumer; they receive the ready typed identity flow.

Both packages are published and pullable by name:

- producer: [`v4-pool-index@v0.1.2`](https://substreams.dev/packages/v4-pool-index/v0.1.2)
- consumer: [`v4-pool-index-consumer@v0.1.1`](https://substreams.dev/packages/v4-pool-index-consumer/v0.1.1)

The same consumer package was checked on two networks using the same block
for the producer and consumer halves:

- Base block `50994246`: producer `pools=1`; consumer
  `poolCount=1`, `nonzeroHooks=1`, `dynamicFee=1`; `count_match=PASS`.
- Robinhood block `56764780`: producer `pools=1`; consumer
  `poolCount=1`, `nonzeroHooks=0`, `dynamicFee=0`; `count_match=PASS`.

This is the primary composition evidence: a downstream package pulls a
ready stream of pool identities by registry name on both networks.

Token metadata remains a separate enrichment step from the Pinax Token API.
The local enrichment layer is `scripts/compose.mjs`: it consumes JSONL
output from `map_initialize`, enriches Base ERC-20 currencies through
`https://api.pinax.network/v1/evm/tokens`, preserves native zero-address
currencies, and returns provider provenance plus a deterministic technical
decision. The CLI now rejects non-empty input that contains no supported
JSONL records, while a supported empty `pools` record remains a successful
empty result; this keeps malformed or pretty/multiline JSON from silently
becoming an empty composition.

### Reproducible Base example

A bounded read-only run at Base block `50994246` produced this pool identity:

- `pool_id`: `0xfa7714c40e1de3c702b8c8052230072d41f3f36f949bca2a26e9147d678a3c22`
- `currency0`: `0xd84af51aae54fe6df667e83a66291529b5456cdd` — `KING Robin` (`KING Robin`), 18 decimals, 4 holders
- `currency1`: `0xf67fcf24bbbff934c79ffb09399122482a25594d` — `cajonosama` (`cajonosama`), 18 decimals, 358 holders
- raw fee: `8388608`; tick spacing: `200`; hooks: `0x0469a4bd3724dc86c9542f4694c976da13c450c0`
- decision: `REJECT`, because the nonzero hooks are not bounded by initialize-only evidence; the dynamic-fee flag in raw fee `8388608` remains `UNKNOWN`, not a fixed percentage

The composed record preserves the Substreams source (`map_initialize`, Base),
the Pinax Token API endpoint, provider fields, and observation timestamps. In
this run the Pinax Token API supplied metadata for Base. That endpoint is
unsupported for Robinhood Chain in this composition; Robinhood therefore
remains Substreams-only here. This is an endpoint-coverage statement, not a
claim about the whole platform's metadata capabilities.

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

The same `map_initialize` module is selected through manifest `network` overrides and `pool_manager` params. The published consumer package is `v4-pool-index-consumer@v0.1.1`; it can be pulled by registry name and is not required to run this repository.

## Live provider evidence and RPC reconciliation

A bounded read-only run of this repository's `map_initialize` used the live
Graph provider endpoint `mainnet.robinhood.streamingfast.io:443` over blocks
`56634000-56634199`. The module emitted exactly three records:

| block | pool_id | transaction |
| --- | --- | --- |
| `56634006` | `0xf222ce57ec6eda4048e3942e0dc1f3b7dceefdf6568a9a1cd68d3db656ce9603` | `0xb004ebbe14180f51e9c6a851daf457f9e0088542eda70c0fb7f735ba45dede6b` |
| `56634066` | `0x40724f42e574e24b46eb56a9cdd9fed3a80ad2af29dbd03a9c1fddcac8cd4565` | `0xe7fc8d16301619f8542198d0dd06f3d83dd866bf3f8b6d5783f9ec17638edba5` |
| `56634095` | `0x74d24eb80e63c9008fa1fa845a05162fa18e44d97e7afc5f45f70bb70105aed2` | `0x94f1ff233e13e3d004914e992ae29e945498f057829c6a2305d4b62028b69f21` |

The truth source for the reconciliation was an `eth_getLogs` query to
`https://rpc.mainnet.chain.robinhood.com` for the same inclusive window,
filtered to PoolManager
`0x8366a39cc670b4001a1121b8f6a443a643e40951` and Initialize topic0
`0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438`.
The node returned three logs; the module returned three records:
`misses=0`, `false_positives=0`, and `identity_mismatches=0`. For every
record, `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and
`hooks` matched the RPC decode. The transaction hashes above anchor the
three node logs to their corresponding blocks.

### BSC bounded verification

A bounded read-only run of the local map_initialize module used the BSC manifest entry and provider endpoint bnb.streamingfast.io:443 over blocks 121217205-121217404 (200 blocks). The manifest PoolManager is 0x28e2ea090877bf75740558f6bfb36a5ffee9e9df, with deployment initialBlock 45970610 verified from transaction 0x64b395f1b0b3c734a477c802bc8cc3ce394f328c651290d0d166946048487bbe.

The same inclusive window was queried with eth_getLogs at https://bsc-rpc.publicnode.com, filtered to the same PoolManager and Initialize topic0. RPC count=2; module count=2; misses=0; false_positives=0; field_mismatches=0. The two records were at blocks 121217252 and 121217332.

This is a bounded read-only observation of the same chain used by the trading layer, not a claim of product integration. The published v4-pool-index@v0.1.2 package and the Robinhood/Base paths were not changed or republished.

This is one 200-block window on one network, not a continuous audit of the
chain's history. It is a live, public-chain, read-only observation; it does
not prove current liquidity, hook safety, or execution, and it does not
imply AlphaScanner production integration.

## Reproduce

```sh
cd substreams
cargo test --lib
cargo build --release --target wasm32-unknown-unknown
substreams pack substreams.yaml
substreams run substreams.yaml map_initialize --network base --start-block -3000 --stop-block +300 --output jsonl > /tmp/base-initialize.jsonl
cd ..
node scripts/compose.mjs --network base --token-file /secure/path/pinax-token.txt --input /tmp/base-initialize.jsonl --limit 1
```

Supply Substreams authentication through its `SUBSTREAMS_API_TOKEN` process environment using your secret manager. Replace `/secure/path/pinax-token.txt` with an owner-only bearer-token file outside the repository. Do not put it in a shell argument, repository file, or log. The composition CLI reads it in-process and never prints it. The exact provider endpoint and authentication setup are account-dependent.

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

The [development archive](docs/ethonline/development-artifacts.md) indexes earlier public specifications, prompts and plans, plus clearly labeled retrospective component specifications. Historical documents are labeled; [current submission copy](docs/ethonline/submission.md), the [demo script](docs/ethonline/demo-script.md), and [verification report](ethonline-verification.md) describe the finalization. Private coordination paths, server addresses, credentials, internal reports, and non-public fixture identities are intentionally omitted. This repository does not claim partner-prize acceptance; live evidence, continuity history, publication, and the owner-recorded demo remain separate gates.

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
