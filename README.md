# v4-pool-index

> A minimal Uniswap v4 pool-identity index for Robinhood Chain. The repository keeps the original The Graph subgraph and adds an offline-tested, composable Substreams `Initialize` module.

## Scope

The project indexes only `PoolManager.Initialize` on Robinhood Chain. The original subgraph stores raw currencies, fee, tick spacing, hooks, initial square-root price, initial tick, block, timestamp, and transaction hash. The Substreams package emits the reusable identity fields `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks`.

`Swap` and `ModifyLiquidity` are intentionally out of scope. Neither path calculates prices or USD values, interprets dynamic fees, infers token orientation, or enables a wallet, transaction, sink, or AlphaScanner bridge.

## Direction update: Subgraph to Substreams

The first implementation attempt remains in the first twelve commits as an honest record of the classic Graph subgraph work. During deployment research, Subgraph Studio reported that subgraphs are no longer supported on Robinhood Chain. The project therefore moved the Initialize indexer to Substreams, whose public network registry lists Robinhood endpoints.

The Substreams module is now implemented and tested offline. It uses `substreams-ethereum` ABI code generation and a single `map_initialize` module. The output is a protobuf message with repeated pool identities, so a downstream package can declare `map: map_initialize` as its input. This is an offline package artifact: no authenticated provider run, package publication, or live Initialize response is claimed here.

The public ABI and contract metadata in this repository are protocol inputs, not evidence of a live stream. Provider authentication, a real network sample, and deployment remain separate follow-up work.

## Substreams package

From `substreams/`:

~~~sh
cargo test --lib
cargo build --release --target wasm32-unknown-unknown
substreams pack substreams.yaml
~~~

The package contains the PoolManager ABI, Rust bindings generated during build, the protobuf contract at `proto/pool/v1/pool.proto`, and `map_initialize`. The only emitted fields are identity and raw PoolKey values. The synthetic unit fixture is explicitly marked synthetic and is not a mainnet observation.

## AI assistance disclosure

AI tools assisted with the implementation, ABI/code generation setup, protobuf contract, unit test fixture, repository documentation, public-artifact drafting, and automated verification runs in this repository. This includes both the original Graph subgraph files and the Substreams package; it is not limited to boilerplate.

The human project owner supplied requirements, selected the scope and direction, made repository and publication decisions, and authorized the work. This README does not claim manual source or code verification by the owner where no such evidence exists. The offline checks and their exact limitations are recorded in the public artifacts under `docs/ethonline/`.

## ETHOnline public artifacts

The files under `docs/ethonline/` are safe public versions of the specification, implementation prompt, and plan. Private coordination paths, server addresses, credentials, internal reports, and non-public fixture identities are intentionally omitted. That redaction is disclosed in each file; it does not remove the AI-use disclosure or turn offline evidence into live integration evidence.

This repository does not claim ETHGlobal Continuity eligibility or any partner-prize acceptance. Those depend on the applicable track, event history, public evidence, and—where required—a real provider integration and working product workflow.

## Network and deployment floor

- Network: Robinhood Chain mainnet (`robinhood`)
- Chain ID: 4663
- PoolManager: `0x8366a39cc670b4001a1121b8f6a443a643e40951`
- Initialize topic0: `0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438`
- Start block: 9070

The start block is the PoolManager deployment block. Live receipt and provider checks are deliberately not part of the offline acceptance reported by this repository.

## Original subgraph reproduction

Use the project-local, pinned Graph toolchain for the original subgraph:

~~~sh
npm ci
npm run codegen
npm run build
npm test
~~~

The Matchstick runner requires the host runtime library `libpq.so.5`.
