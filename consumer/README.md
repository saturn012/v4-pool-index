# v4-pool-index consumer

This package is the downstream half of the composition proof. It imports the published `v4-pool-index@v0.1.1` package by registry name and consumes its `pools:map_initialize` output; it does not copy or re-run the producer implementation.

`map_pool_digest` emits one `consumer.v1.PoolDigests` record per block with:

- `pool_count`: pools emitted by the imported producer on that block;
- `nonzero_hooks`: those pools with at least one nonzero hook byte;
- `dynamic_fee`: those pools with the v4 dynamic-fee flag (`0x800000`).

## Reproduce

From the repository root, with a Substreams API token available through the normal CLI environment:

```sh
cargo build --manifest-path consumer/Cargo.toml --release --target wasm32-unknown-unknown
substreams pack consumer/substreams.yaml
substreams run consumer/substreams.yaml map_pool_digest --network robinhood --start-block <BLOCK> --stop-block <BLOCK+1> --output jsonl
substreams run consumer/substreams.yaml map_pool_digest --network base --start-block <BLOCK> --stop-block <BLOCK+1> --output jsonl
```

The package imports `v4-pool-index@v0.1.1` by name; no producer source or producer package is copied into `consumer/`. The package is not published by this task.

## Live acceptance evidence

The following bounded read-only runs used the same block for producer and consumer on each network:

```text
base block 50994246:
  producer map_initialize: pools=1
  consumer map_pool_digest: poolCount=1, nonzeroHooks=1, dynamicFee=1
  count_match=PASS

robinhood block 56764780:
  producer map_initialize: pools=1
  consumer map_pool_digest: poolCount=1, nonzeroHooks=0, dynamicFee=0
  count_match=PASS
```

The full JSONL and stderr captures are kept in the task-private evidence directory, not committed to the public package.
