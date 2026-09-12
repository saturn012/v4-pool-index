# Public specification — identity and consumer

Provenance: retrospective reconstruction prepared 12 September 2026 from the public source, earlier Task 36/40 artifacts and repository history. This is not an original execution prompt.

## Goal and instruction contract

Capture Uniswap v4 PoolManager Initialize identity without inferring swaps, liquidity, prices or trading safety. The subgraph stores the raw identity and event context. The Substreams producer emits a typed stream with pool ID, both currencies, raw fee, tick spacing and hooks. Select the PoolManager through network parameters rather than duplicating a decoder per chain.

The downstream package imports the published producer by registry name. It consumes that module's output and computes counts and hook/dynamic-fee flags. It does not copy the Initialize implementation. Its statistics output is separate from the metadata assessment served by MCP/x402.

## Shipped design

- Producer: `substreams/src/lib.rs`, `substreams/proto/pool/v1/pool.proto`, `substreams/substreams.yaml`.
- Consumer: `consumer/src/lib.rs`, `consumer/substreams.yaml`.
- Published versions: producer `v0.1.2`, consumer `v0.1.1` for Base/Robinhood.
- Local-only extension: BSC manifest entry, not republished into those versions.

## Reconstructed execution sequence and acceptance

Define raw schema and event decoder; test deterministic fixtures; parameterize networks; compare bounded provider events against RPC; import the producer from a consumer; verify matching counts at the same block; publish the package chain only after verification.

The recorded Base and Robinhood producer/consumer observations each counted one pool. The README records RPC reconciliation windows and limits. Fixture success alone is not live-provider evidence. The component has no trading bridge.
