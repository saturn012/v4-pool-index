# v4-pool-index

> A minimal The Graph subgraph for Robinhood Chain that records Uniswap v4 pool identity from PoolManager Initialize events, preserving raw pool parameters and observation metadata so downstream services can resolve pool IDs without guessing prices, fees, or token orientation.

## Scope

This repository indexes only Initialize on the Uniswap v4 PoolManager. It stores both currencies exactly as emitted, raw fee, tickSpacing, hooks, initial square-root price, initial tick, block, timestamp, and transaction hash. It does not index swaps or liquidity changes, calculate prices or USD values, interpret dynamic fees, or infer token orientation.

## Network and deployment floor

- Network: Robinhood Chain mainnet (robinhood)
- Chain ID: 4663
- PoolManager: 0x8366a39cc670b4001a1121b8f6a443a643e40951
- Initialize topic0: 0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438
- Start block: 9070

The start block is the PoolManager deployment block. The primary evidence is the official Uniswap deployment record and its deployment transaction 0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41. Verify the receipt against the Robinhood RPC:

~~~sh
curl -sS https://rpc.mainnet.chain.robinhood.com \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41"]}'
~~~

The receipt must contain blockNumber: 0x236e, which is decimal block 9070, and a PoolManager log in that block.

## Reproduce

Use the project-local, pinned toolchain:

~~~sh
npm ci
npm run codegen
npm run build
npm test
~~~

npm test invokes the pinned Graph CLI Matchstick integration. Its native runner requires the host runtime library libpq.so.5.

The official network support reference is the Robinhood Chain Mainnet page at https://thegraph.com/docs/en/supported-networks/robinhood/. The manifest follows The Graph Subgraph Manifest format at https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/.
