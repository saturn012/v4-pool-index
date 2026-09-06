# v4-pool-index Substreams package

This package contains the offline-tested `map_initialize` module for Uniswap v4 PoolManager `Initialize` events on Robinhood Chain.

The module emits `pool.v1.PoolInitializations`, a composable protobuf list of raw `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks` values. `Swap`, `ModifyLiquidity`, provider authentication, live runs, sinks, and publication are outside this package's scope.

Build and pack from this directory with `cargo test --lib`, `cargo build --release --target wasm32-unknown-unknown`, and `substreams pack substreams.yaml`. The test fixture is synthetic and is not mainnet evidence.

AI tools assisted with implementation, code generation, test construction, documentation, and automated checks. Private coordination material is intentionally not included.
