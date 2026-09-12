# ETHOnline 2026 — public implementation prompt (sanitized)

> Historical development artifact. Status, version and publication statements below describe that task stage. For the current released state, use [the review guide](judge-guide.md).

Implement a minimal, offline-testable Substreams package for the existing Uniswap v4 Initialize indexer.

Use the public PoolManager ABI and `substreams-ethereum` code generation. Create one composable map from `sf.ethereum.type.v2.Block` to a protobuf list of `pool_id`, `currency0`, `currency1`, `fee`, `tick_spacing`, and `hooks`. Keep the existing subgraph files. Do not add Swap or ModifyLiquidity, provider probes, authentication, publication, wallets, transactions, or private application data.

Add an explicit offline decode test. Any synthetic values must be labeled as synthetic and must never be described as mainnet data. Verify the manifest, wasm build, package contract, and `substreams pack` result.

Document AI assistance precisely, including implementation and verification work. State the limits of offline evidence and do not claim continuity, prize acceptance, or live integration.

Sanitization note: this public prompt intentionally excludes private task paths, credentials, server details, internal reports, and private fixture identities. No secret is required by the implementation.
