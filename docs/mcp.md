# v4-pool-index MCP

`v4-pool-index-mcp` is a local stdio MCP server for the repository's existing `map_initialize` Substreams module and the deterministic metadata decision layer. It exposes no HTTP listener, makes no wallet or transaction calls, and does not invoke the Pinax MCP server.

## Client connection

Use a client that supports newline-delimited stdio MCP JSON-RPC, such as Claude Desktop. From a checkout that has its Node dependencies and the `substreams` CLI available, add a server entry like this (replace the placeholders; do not commit a token):

```json
{
  "mcpServers": {
    "v4-pool-index": {
      "command": "node",
      "args": ["/path/to/v4-pool-index/scripts/mcp.mjs"],
      "env": {
        "THEGRAPH_TOKEN": "set-this-in-the-client-secret-store",
        "MCP_BASE_START_BLOCK": "50994246",
        "MCP_ROBINHOOD_START_BLOCK": "56764780",
        "MCP_BLOCK_SPAN": "1"
      }
    }
  }
}
```

`THEGRAPH_TOKEN` is read only from the MCP process environment. The server passes it in-process to the existing Substreams CLI as `SUBSTREAMS_API_TOKEN`, and passes it to the existing Base Token API client as an HTTP bearer header. It is never accepted as a tool argument, emitted in an MCP response, or written to repository files. The client should supply it from its own secret store or a supervised launcher that reads a protected file into the environment.

The checked-in defaults use the already verified one-block evidence windows shown above. An owner can update the three bounded range variables for another reviewable window; the span is capped at 100 blocks. A requested `pool_id` outside that window returns `POOL_NOT_FOUND`, rather than silently searching an unbounded history.

## Tools

- `resolve_pool(pool_id, network)` returns the Initialize identity (`currency0`, `currency1`, raw `fee`, `tick_spacing`, `hooks`), currency metadata where coverage exists, provenance, and the decision scope.
- `assess_pool(pool_id, network)` returns the pre-existing deterministic verdict with every check and human-readable reason, plus provenance and scope.

`network` must be `base` or `robinhood`; `pool_id` must be a 32-byte `0x`-prefixed hexadecimal PoolId. Invalid input and unavailable bounded sources produce structured MCP tool errors, not incidental stdout logs.

## Evidence and limits

The server runs only `map_initialize` over a finite final-block range and filters the resulting JSONL locally. Base ERC-20 metadata is queried through the existing Token API composition. The current Token API endpoint is not supported for Robinhood, so Robinhood ERC-20 metadata is explicitly `UNKNOWN`; the server does not fabricate enrichment or call that endpoint for Robinhood.

The verdict is a technical Initialize/metadata assessment, not a sell-safety or trade decision. It does not cover swaps, liquidity, price, slippage, transferability, approvals, signatures, wallets, transactions, or settlement. In particular, one `Initialize` event cannot establish sell behavior.

## Checks

```sh
npm run test:mcp
npm run test:composition
```

For a supervised live invocation, set `THEGRAPH_TOKEN` in the process environment and send `initialize`, `tools/list`, and a tool call over stdio. Keep client logs and error reports free of the environment value.
