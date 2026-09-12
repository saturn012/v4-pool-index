# Continuity and AI assistance disclosure

## Pre-existing work

AlphaScanner is the owner's existing Telegram pipeline for collecting crypto calls, scoring tokens and delivering cards. Its separate execution layer trades on BNB Smart Chain through Definitive. Those private systems predate this submission and are not included in this public repository.

## Work submitted for ETHOnline 2026

The public history of `v4-pool-index` begins on 5 September 2026. The submitted project-specific implementation consists of the Uniswap v4 Initialize subgraph, a reusable Substreams producer, a separately published consumer, deterministic metadata assessment, local MCP access, the x402 server and payer, tests and reproduction documentation.

Existing open-source libraries, protocol ABIs and generated bindings are used and identified in the repository. The BIP-39 dictionary is vendored from bitcoin/bips and attributed in the README. This submission does not claim that these upstream materials were authored during the event.

The producer supplies a typed pool-identity stream. One downstream package computes pool counts and flags. A separate assessment path enriches producer output with Pinax Token API metadata and serves scoped verdicts over MCP or paid HTTP. The statistics consumer is not an intermediate stage in that assessment path.

## Integration boundary

The new component is intended to inform a check before a signal card or execution decision. Integration into the existing AlphaScanner product is unfinished. No production bridge or trading capability is claimed for this repository.

The local producer manifest was extended to BSC and checked against two RPC logs in one 200-block window. That establishes a bounded observation on the same chain used by the existing execution product. The published producer `v0.1.2` and consumer `v0.1.1` remain the Base/Robinhood package versions; the BSC manifest was not republished.

## Human contribution and AI assistance

The owner supplied requirements, selected the product problem, set scope and evidence boundaries, reviewed decisions and authorized publication. AI tools assisted implementation, tests, debugging, documentation, public-artifact preparation and automated verification.

This disclosure does not assert that the owner manually wrote or reviewed every line. Earlier public specifications and clearly labeled retrospective component specifications are indexed in [the development materials](development-artifacts.md). The published history and evidence distinguish prior work, new work, generated material and verification.

This disclosure supports review; it does not assert eligibility or acceptance by ETHGlobal or a partner.
