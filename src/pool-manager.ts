import { Initialize } from "../generated/PoolManager/PoolManager";
import { Pool } from "../generated/schema";

export function handleInitialize(event: Initialize): void {
  let pool = new Pool(event.params.id);

  // Keep PoolKey fields exactly as emitted. Fee is raw uint24 data, not a rate.
  pool.currency0 = event.params.currency0;
  pool.currency1 = event.params.currency1;
  pool.fee = event.params.fee;
  pool.tickSpacing = event.params.tickSpacing;
  pool.hooks = event.params.hooks;
  pool.initSqrtPriceX96 = event.params.sqrtPriceX96;
  pool.initTick = event.params.tick;

  // Every stored numeric observation carries block and timestamp metadata.
  pool.createdAtBlock = event.block.number;
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtTx = event.transaction.hash;

  pool.save();
}
