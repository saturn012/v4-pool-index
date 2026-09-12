# v4-pool-index MCP

`v4-pool-index-mcp` is a local stdio MCP server for the repository's existing `map_initialize` Substreams module and the deterministic metadata decision layer. It exposes no HTTP listener, makes no wallet or transaction calls, and does not invoke the Pinax MCP server.

## Prerequisite: published registry package

The stdio server resolves the published v4-pool-index@v0.1.2 package by registry name. A cold checkout does not need cargo or substreams/target; it needs the Substreams CLI on PATH, Node dependencies, and either an inherited `THEGRAPH_TOKEN` or an explicit protected `THEGRAPH_TOKEN_FILE` supplied to mcp-with-secret.mjs:

    node scripts/mcp-with-secret.mjs

The same cold registry path can be checked without Cargo or a local target artifact:

    substreams run v4-pool-index@v0.1.2 map_initialize --network base --start-block 50994246 --stop-block +1 --output jsonl

For this standalone CLI command, configure `SUBSTREAMS_API_TOKEN` through your secret manager and select the appropriate provider endpoint. The MCP launcher performs that token mapping for MCP calls, not for unrelated shell commands. The CLI fetches the immutable producer package by name and uses the configured provider; no build step or local WASM file is involved.

## Client connection

Use a client that supports newline-delimited stdio MCP JSON-RPC, such as Claude Desktop. From a checkout that has its Node dependencies and the `substreams` CLI available, add a server entry like this (replace the placeholders; do not commit a token):

```json
{
  "mcpServers": {
    "v4-pool-index": {
      "command": "node",
      "args": ["/path/to/v4-pool-index/scripts/mcp-with-secret.mjs"],
      "env": {
        "THEGRAPH_TOKEN_FILE": "/secure/path/thegraph.token",
        "SUBSTREAMS_ENDPOINT_BASE": "base.substreams.pinax.network:443",
        "SUBSTREAMS_ENDPOINT_ROBINHOOD": "robinhood.substreams.pinax.network:443",
        "MCP_BASE_START_BLOCK": "50994246",
        "MCP_ROBINHOOD_START_BLOCK": "56764780",
        "MCP_BLOCK_SPAN": "1"
      }
    }
  }
}
```

`mcp-with-secret.mjs` preserves an inherited nonempty `THEGRAPH_TOKEN`; otherwise it reads `THEGRAPH_TOKEN_FILE` into the MCP process environment. Set the file path explicitly on your machine; the implementation fallback is deployment-specific. The file must be owned by the current user with no group/other permission bits (for example mode 600). The value is never accepted as an argument, emitted in an MCP response, or written to repository files. It is passed in-process to the existing Substreams CLI as `SUBSTREAMS_API_TOKEN` and to the Base Token API bearer header. The launcher does not migrate or delete any existing credential files.

The checked-in defaults use the already verified one-block evidence windows shown above. An owner can update the three bounded range variables for another reviewable window; the span is capped at 100 blocks. A requested `pool_id` outside that window returns `POOL_NOT_FOUND`, rather than silently searching an unbounded history.

For reproducible provider routing, set `SUBSTREAMS_ENDPOINT_BASE=base.substreams.pinax.network:443` and `SUBSTREAMS_ENDPOINT_ROBINHOOD=robinhood.substreams.pinax.network:443` in the same MCP process environment. The existing `substreams` CLI selects the matching variable for the tool's `network`; the MCP forwards it unchanged. Base token metadata uses the existing `https://api.pinax.network/v1/evm/tokens` endpoint. These are the only three external read-only destinations in a live tool call; no endpoint is contacted until a tool is called.

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

## Registry publication with the canonical token

The publication launcher reads the owner-only file selected by
`SUBSTREAMS_REGISTRY_TOKEN_FILE` into `SUBSTREAMS_REGISTRY_TOKEN` and invokes `/usr/local/bin/substreams registry
publish <absolute-package.spkg> --yes`. Pass exactly one existing local `.spkg`:

```sh
SUBSTREAMS_REGISTRY_TOKEN_FILE=/secure/path/registry.token node scripts/registry-publish-with-secret.mjs /absolute/package.spkg
```

The child receives only PATH, HOME, LANG and the registry token. Inherited debug
settings and endpoint overrides are omitted. Raw stderr is suppressed; success
requires exit code zero and the CLI publication success marker.

The current composition publishes producer v4-pool-index@v0.1.2 first and consumer v4-pool-index-consumer@v0.1.1 second with Substreams 1.22.0. The token file must remain owner-only. This is a maintainer publication procedure, not a judge reproduction step; the existing published versions need no new publication. For every secret migration, loader tests alone do not authorize removal of the old consumer path.
