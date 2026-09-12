# ETHOnline 2026 — Task 40 public specification

> Historical development artifact. Status, version and publication statements below describe that task stage. For the current released state, use [the review guide](judge-guide.md).

Status: implementation candidate on a task branch; live provider evidence is recorded privately and the package is not published.

## Composition contract

`map_initialize` is a reusable Substreams map over Uniswap v4 `PoolManager.Initialize` events. Its output remains the six raw identity fields from Task 36. The manifest now supplies `pool_manager` and `initialBlock` per network:

- Robinhood: `0x8366a39cc670b4001a1121b8f6a443a643e40951`, start block `9070`.
- Base: `0x498581ff718922c3f8e6a244956af099b2652b2b`, manifest floor `0`; bounded runs may use a relative start such as `-3000`.

The Node composition layer consumes JSONL output from that map and enriches non-native `currency0` and `currency1` through the Pinax Token API using `network` and `contract`. Native zero-address currency is represented explicitly and is never sent to the ERC-20 endpoint.

## Deterministic decision scope

The decision engine is deliberately not a trading model. It rejects nonzero hooks, rejects a static fee above 10,000 ppm (1% per leg), rejects non-positive tick spacing, and checks available holder metadata. Dynamic fee flags are `UNKNOWN`, not a percentage. Missing volume is `UNKNOWN`, not “no market”. A technical `PASS` means only that the available initialize and metadata checks passed; it does not prove liquidity, slippage, transferability, price impact, or a successful buy/sell.

The 1% per-leg screen is a documented engineering screen anchored to the measured approximately 1.2% round-trip baseline in the task evidence and to v4's raw fee units. It is not a claim that all pools below the screen are executable.

## Acceptance boundary

Fixture tests cover parsing and rule explanations. Live acceptance must separately show bounded Initialize output on Robinhood and Base, and a Base pool whose two ERC-20 currencies return metadata. The package is not a Substreams publication and no wallet, approval, signature, trade, or AlphaScanner bridge is part of this work.

## AI and redaction disclosure

AI tools assisted with implementation, test construction, documentation, public-artifact drafting, and verification. The human project owner supplied requirements, scope, publication decisions, and authorization. Private task paths, credentials, server addresses, internal reports, and private fixture identities are intentionally omitted from this public artifact.
