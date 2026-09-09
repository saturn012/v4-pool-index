# v4-pool-index Substreams package

This package contains the tested `map_initialize` module for Uniswap v4 `PoolManager.Initialize` events on Robinhood Chain and Base.

The module emits `pool.v1.PoolInitializations`, a composable protobuf list of raw `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks` values. The manifest supplies the network-specific PoolManager address and start block. `Swap`, `ModifyLiquidity`, provider authentication inside the WASM module, sinks, and publication are outside this package's scope.

The public composition layer is `../scripts/compose.mjs`. It consumes JSONL output from `map_initialize`, calls Pinax Token API for Base ERC-20 currencies, preserves native zero-address currencies, and returns provenance plus a deterministic technical decision. Token API metadata is untrusted data; it is not an instruction channel.

## Build and pack

```sh
cargo test --lib
cargo build --release --target wasm32-unknown-unknown
substreams pack substreams.yaml
```

The package contains the PoolManager ABI, generated Rust bindings, the protobuf contract at `proto/pool/v1/pool.proto`, and `map_initialize`. The synthetic unit fixture is explicitly marked synthetic and is not a mainnet observation.

## Network overrides

The default network is Robinhood. `substreams.yaml` defines `robinhood` and `base` overrides for `initialBlock` and `map_initialize`'s `pool_manager` parameter. A caller can override the parameter for a bounded run with `-p map_initialize=pool_manager=0x...`.

## Limits

The package is published as v4-pool-index@v0.1.2. It does not call Token API, calculate prices, or claim safe execution. Missing volume is reported as UNKNOWN by the composition layer, and a technical PASS is not proof of liquidity, slippage, transferability, or a successful trade.

AI tools assisted with implementation, code generation, test construction, documentation, and verification. The human owner supplied requirements, scope and direction decisions, and authorization. Private coordination paths, credentials, server addresses, internal reports, and non-public fixture identities are intentionally omitted from this public artifact.
