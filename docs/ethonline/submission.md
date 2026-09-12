# ETHOnline 2026 — current submission copy

Prepared 12 September 2026. This is ready-to-use project copy, not a receipt that an external form was submitted. It supersedes earlier application drafts with producer `v0.1.1` / consumer `v0.1.0`.

## Project title

v4-pool-index — explainable pool assessment for agents

## Short description

Identify a Uniswap v4 pool, inspect the available evidence, and receive an explainable PASS, REJECT or UNKNOWN. A reusable Substreams identity stream powers a statistics consumer and a separate metadata assessment service. Agents can request assessments over MCP or pay 0.001 test USDC per request through x402 on Base Sepolia.

## What the project does

A pool ID alone does not expose the currencies, raw fee, tick spacing or hooks encoded by its PoolKey. We capture these fields from Initialize events and make the typed identity reusable.

The project has two downstream paths. The published consumer imports the producer through the Substreams registry and computes pool counts, nonzero-hook counts and dynamic-fee flags. The assessment path reads the producer directly, adds Base token metadata from the Pinax Token API, and applies deterministic checks. It returns the reason, source and scope behind each result.

Nonzero hooks are rejected by our conservative policy because Initialize-only evidence cannot bound callback behavior. A dynamic-fee flag yields UNKNOWN for the effective fee. Missing volume remains UNKNOWN. A technical PASS does not establish liquidity, slippage, transferability or successful execution.

## The Graph — composable products

The producer `v4-pool-index@v0.1.2` and consumer `v4-pool-index-consumer@v0.1.1` are published in the registry. The consumer imports the producer by name:

```yaml
imports:
  pools: v4-pool-index@v0.1.2
```

The consumer uses the producer's typed output without copying Initialize decoding. Its output is statistics; the per-pool verdict is produced by the separate assessment path.

The same consumer was checked at Base block 50994246 and Robinhood block 56764780. Each producer run emitted one pool and each consumer counted one. BSC was added to the local producer through one manifest entry with zero Rust changes: in blocks 121217205–121217404, module count 2 matched RPC count 2 with zero misses, false positives or field mismatches. Published package versions were not changed for this BSC check.

Live provider evidence and exact windows are recorded in the [README](../../README.md#live-provider-evidence-and-rpc-reconciliation). Pinax Token API is named as separate metadata enrichment, not as a second Graph product.

## The Graph — AI tooling, Continuity

The reusable infrastructure consists of a local stdio MCP server exposing `resolve_pool` and `assess_pool`, plus a payment-gated HTTP assessment endpoint and constrained payer. An AI client can consume structured results with sources and explicit evidence limits. The decision rules are deterministic; no LLM inference is claimed inside the service.

The Graph provides the underlying pool identity. This is a real provider-backed data path, with fixture-only rehearsal explicitly labeled separately. The x402 path has a recorded HTTP 402 → payment authorization → HTTP 200 → verdict exchange and confirmed Base Sepolia settlement.

The HTTP service binds to loopback. The customer needs no service API key for the payment-gated request; the backend still requires provider credentials. No public hosted endpoint or production deployment is claimed.

## Uniswap Foundation

We index Uniswap v4 Initialize identity and preserve the raw units needed to avoid misleading assessments. Dynamic fees, unknown hook behavior and incomplete token metadata have explicit outcomes and reasons. The public README links to relevant contracts, source lines and reproducible observations.

The repository includes [FEEDBACK.md](../../FEEDBACK.md). Its personal sections still require the owner's assessment, and completion of the separate feedback form has not been verified. Do not represent that form as submitted until a receipt exists.

## Prior work and AI disclosure

Use [continuity.md](continuity.md) for the full disclosure. AlphaScanner's prior private Telegram and execution systems are outside this repository. The new assessment component is not yet integrated into those production systems. AI-assisted areas, upstream materials and the owner's contribution are disclosed explicitly.

## Verification links

- [Public repository](https://github.com/saturn012/v4-pool-index)
- [Producer v0.1.2](https://substreams.dev/packages/v4-pool-index/v0.1.2)
- [Consumer v0.1.1](https://substreams.dev/packages/v4-pool-index-consumer/v0.1.1)
- [Full paid run and assessment](../evidence/2026-09-11_paid-run.md)
- [Matching Base Sepolia settlement](https://sepolia.basescan.org/tx/0xc2cb8f09373c57f077660e855ca0685ce14b5d924401860200f51698130bcbdd)
- [Current demo script](demo-script.md)
- [Development instructions archive](development-artifacts.md)

## Submission operations still requiring confirmation

Select The Graph and Uniswap Foundation as partners and verify the applicable tracks in the actual dashboard. They count as two partners, not four partner slots. Select Continuity consistently with the disclosure. Partner eligibility and awards are determined by the organizers.

Record and upload the actual 2–4 minute video, enter its real URL, finalize the owner's Uniswap feedback and submit its form, choose live judging or partner-prizes-only, and retain submission confirmations. No placeholder video URL or assumed submission receipt is supplied here.

Official references: [ETHOnline submission rules](https://ethglobal.com/events/ethonline2026/info/details), [The Graph prizes](https://ethglobal.com/events/ethonline2026/prizes/the-graph), [Uniswap prizes](https://ethglobal.com/events/ethonline2026/prizes/uniswap-foundation).
