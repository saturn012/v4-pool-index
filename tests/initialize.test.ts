import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  clearStore,
  newTypedMockEventWithParams,
  test,
} from "matchstick-as/assembly/index";
import { Initialize } from "../generated/PoolManager/PoolManager";
import { handleInitialize } from "../src/pool-manager";

function makeInitialize(
  id: Bytes,
  currency0: Address,
  currency1: Address,
  fee: i32,
  tickSpacing: i32,
  hooks: Address,
  sqrtPriceX96: BigInt,
  tick: i32,
  blockNumber: i32,
  timestamp: i32,
  transactionHash: Bytes,
): Initialize {
  let params = new Array<ethereum.EventParam>();
  params.push(new ethereum.EventParam("id", ethereum.Value.fromFixedBytes(id)));
  params.push(
    new ethereum.EventParam(
      "currency0",
      ethereum.Value.fromAddress(currency0),
    ),
  );
  params.push(
    new ethereum.EventParam(
      "currency1",
      ethereum.Value.fromAddress(currency1),
    ),
  );
  params.push(
    new ethereum.EventParam("fee", ethereum.Value.fromI32(fee)),
  );
  params.push(
    new ethereum.EventParam(
      "tickSpacing",
      ethereum.Value.fromI32(tickSpacing),
    ),
  );
  params.push(
    new ethereum.EventParam("hooks", ethereum.Value.fromAddress(hooks)),
  );
  params.push(
    new ethereum.EventParam(
      "sqrtPriceX96",
      ethereum.Value.fromUnsignedBigInt(sqrtPriceX96),
    ),
  );
  params.push(
    new ethereum.EventParam("tick", ethereum.Value.fromI32(tick)),
  );

  let event = newTypedMockEventWithParams<Initialize>(params);
  event.block.number = BigInt.fromI32(blockNumber);
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.transaction.hash = transactionHash;
  return event;
}

// Fixture provenance:
// The values below reproduce one public Robinhood Chain PoolManager
// `Initialize` receipt. The pool id and currencies are indexed event fields;
// fee, tick spacing, hook, initial price, initial tick, block, timestamp, and
// transaction hash are the remaining fields from that same log.
//
// We intentionally retain this known public log. Two newer public-RPC
// candidates were rejected by the pre-publication correlation gate because
// their currencies already occurred in internal datasets. Replacing this test
// with a merely different public address would therefore not make the fixture
// independently selected.
//
// A future replacement must come from a public explorer/RPC and pass the same
// current-dataset gate before it is committed. That gate documents provenance;
// after retention cleanup, it is not a claim about every deleted historical
// record.
test("maps an independent public Initialize log with all raw fields", () => {
  let id = Bytes.fromHexString(
    "0x9ca021d16b63ba396c457583fe462dde99506caa2a149c5285e26ecdae57c998",
  );
  let currency0 = Address.fromString(
    "0x01d750b863ac2ffe76b062c42bb82910be84a6ba",
  );
  let currency1 = Address.fromString(
    "0x05a3d1cd21d0c88145e82600e62e7e496e0f222b",
  );
  let hooks = Address.fromString(
    "0x97c21ad990db9dc8cfd19713574fbdf2697f68cc",
  );
  let tx = Bytes.fromHexString(
    "0x646c20e519dce00217d0346f05f45fc3e01e3e0979f1c5038aa2df1f197b6710",
  );

  handleInitialize(
    makeInitialize(
      id,
      currency0,
      currency1,
      2500,
      60,
      hooks,
      BigInt.fromString("78212785280997392003103750"),
      -138420,
      55373313,
      1788636766,
      tx,
    ),
  );

  assert.entityCount("Pool", 1);
  assert.fieldEquals("Pool", id.toHexString(), "currency0", currency0.toHexString());
  assert.fieldEquals("Pool", id.toHexString(), "currency1", currency1.toHexString());
  assert.fieldEquals("Pool", id.toHexString(), "fee", "2500");
  assert.fieldEquals("Pool", id.toHexString(), "tickSpacing", "60");
  assert.fieldEquals("Pool", id.toHexString(), "hooks", hooks.toHexString());
  assert.fieldEquals(
    "Pool",
    id.toHexString(),
    "initSqrtPriceX96",
    "78212785280997392003103750",
  );
  assert.fieldEquals("Pool", id.toHexString(), "initTick", "-138420");
  assert.fieldEquals("Pool", id.toHexString(), "createdAtBlock", "55373313");
  assert.fieldEquals("Pool", id.toHexString(), "createdAtTimestamp", "1788636766");
  assert.fieldEquals("Pool", id.toHexString(), "createdAtTx", tx.toHexString());
  clearStore();
});

test("preserves the dynamic-fee flag and a non-zero hook as raw values", () => {
  let id = Bytes.fromHexString(
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  );
  let currency0 = Address.fromString(
    "0x1111111111111111111111111111111111111111",
  );
  let currency1 = Address.fromString(
    "0x2222222222222222222222222222222222222222",
  );
  let hooks = Address.fromString(
    "0x3333333333333333333333333333333333333333",
  );
  let tx = Bytes.fromHexString(
    "0x4444444444444444444444444444444444444444444444444444444444444444",
  );

  handleInitialize(
    makeInitialize(
      id,
      currency0,
      currency1,
      8388608,
      -60,
      hooks,
      BigInt.fromString("79228162514264337593543950336"),
      -60,
      90000000,
      1800000000,
      tx,
    ),
  );

  assert.entityCount("Pool", 1);
  assert.fieldEquals("Pool", id.toHexString(), "fee", "8388608");
  assert.fieldEquals("Pool", id.toHexString(), "tickSpacing", "-60");
  assert.fieldEquals("Pool", id.toHexString(), "hooks", hooks.toHexString());
  assert.fieldEquals("Pool", id.toHexString(), "initTick", "-60");
  clearStore();
});
