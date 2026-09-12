# Public specification — repository-owned MCP

Provenance: retrospective public reconstruction prepared 12 September 2026. The original Task 48 was reviewed during finalization; private credential paths are intentionally absent. This document is not a verbatim copy or original execution log.

## Goal and instruction contract

Expose the existing pool resolver and deterministic assessment through local stdio MCP. Implement exactly `resolve_pool(pool_id, network)` and `assess_pool(pool_id, network)`; avoid a new decision engine. Every assessment returns reasons, provenance and explicit evidence limits.

Use the repository-owned implementation rather than depending on an external MCP adapter. Initialize identity comes from Substreams; metadata comes from the existing Pinax Token API composition. The supported tool networks are Base and Robinhood. The separate statistics consumer is not an assessment dependency.

## Shipped design

`scripts/mcp.mjs` handles MCP negotiation, tool listing, validation and bounded resolution. `scripts/mcp-with-secret.mjs` preserves an inherited provider token or reads an explicitly configured protected file. No token is accepted as a CLI argument or returned in MCP output.

Later release work changed resolution to the immutable producer `v4-pool-index@v0.1.2` from the registry. A judge's checkout therefore does not need to build local WASM to use MCP. Default windows are bounded and configurable, with a capped span. Out-of-window results are errors, not unbounded searches.

## Reconstructed execution sequence and acceptance

Implement stdio handling around the existing resolver, validate the two tool contracts, test initialization/listing and error shape, document client configuration, then verify bounded real provider examples separately from fixtures.

The server exposes no HTTP port, wallet, signature or transaction operation. Missing Robinhood token-metadata coverage is explicit. Tests are in `scripts/mcp.test.mjs`; current connection instructions are in `docs/mcp.md`.
