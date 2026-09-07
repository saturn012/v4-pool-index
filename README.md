# v4-pool-index

> A minimal Uniswap v4 pool-identity index with a composable Initialize stream and a deterministic metadata decision layer.

## Scope

The project indexes only `PoolManager.Initialize` on Robinhood Chain and Base. The original subgraph stores raw currencies, fee, tick spacing, hooks, initial square-root price, initial tick, block, timestamp, and transaction hash. The Substreams package emits reusable identity fields: `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks`.

`Swap` and `ModifyLiquidity` are intentionally out of scope. No path calculates prices or USD values, interprets dynamic fees as fixed percentages, or enables a wallet, transaction, sink, or AlphaScanner bridge.

## What became easier through composition

In v4, `pool_id` is a hash of the `PoolKey`; the identity stream can tell us which currencies and pool parameters were initialized, but it does not supply token names or holder counts. Pinax Token API supplies standardized token meaning, but it does not know which v4 pool produced the pair. Feeding the first product's output into the second makes one reproducible record that a rules engine can explain. This is a composition of two Graph products, not a claim that the entire Substreams platform cannot expose token metadata.

The public composition layer is `scripts/compose.mjs`. It consumes JSONL output from `map_initialize`, enriches Base ERC-20 currencies through `https://api.pinax.network/v1/evm/tokens`, preserves native zero-address currencies, and returns provenance plus a deterministic technical decision.

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

The same `map_initialize` module is selected through manifest `network` overrides and `pool_manager` params. The package is not published to a Substreams registry in this candidate.

## Live provider evidence

The inherited Robinhood verification streamed `map_initialize` from the Graph provider and matched decoded Initialize logs. This candidate additionally selects the same module for Base through the manifest network override and composes bounded Base output with Token API metadata. These are public-chain, read-only observations; they do not imply AlphaScanner production integration.

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

## ETHOnline public artifacts

The files under `docs/ethonline/` are safe public versions of the specification, implementation prompt, plan, and demo script. Private coordination paths, server addresses, credentials, internal reports, and non-public fixture identities are intentionally omitted. This repository does not claim partner-prize acceptance; live evidence, continuity history, publication, and the owner-recorded demo remain separate gates.

## AI assistance disclosure

AI tools assisted with the original Graph subgraph, Substreams implementation, ABI/code generation setup, composition layer, tests, documentation, public-artifact drafting, and automated verification runs in this repository. The human project owner supplied requirements, selected the scope and direction, made repository and publication decisions, and authorized the work. The README does not claim manual source or code verification by the owner where no such evidence exists.
