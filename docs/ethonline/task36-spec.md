# ETHOnline 2026 — public specification for the Initialize module

> Historical development artifact. Status, version and publication statements below describe that task stage. For the current released state, use [the review guide](judge-guide.md).

Status: offline implementation complete; live provider and publication intentionally not performed.

## Goal

Provide a small reusable Substreams module that extracts Uniswap v4 `PoolManager.Initialize` events on Robinhood Chain and exposes pool identity to downstream packages.

## Contract

`map_initialize` receives `sf.ethereum.type.v2.Block` and emits `pool.v1.PoolInitializations`. Each item contains:

- `pool_id` (`bytes`)
- `currency0` and `currency1` (`bytes`)
- `fee` (`uint32`, raw uint24 value)
- `tick_spacing` (`int32`, raw int24 value)
- `hooks` (`bytes`)

The output is composable as a map input. `Swap`, `ModifyLiquidity`, pricing, sinks, wallets, and transaction execution are excluded.

## Acceptance boundary

Offline acceptance covers ABI generation, event decoding, Rust unit tests, wasm compilation, manifest validation, and package packing. It does not prove an authenticated provider response, a live stream, a deployment, prize eligibility, or continuity eligibility.

## AI and redaction disclosure

AI tools assisted with implementation, test construction, documentation, and verification. The human owner supplied requirements, scope decisions, and authorization. This public file omits private coordination paths, credentials, server addresses, internal reports, and non-public fixture identities; those omissions are intentional and do not represent missing live evidence.
