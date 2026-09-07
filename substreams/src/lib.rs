mod abi;

pub mod pb {
    pub mod pool {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/pool.v1.rs"));
        }
    }
}

use hex_literal::hex;
use pb::pool::v1::{PoolInitialization, PoolInitializations};
use substreams::errors::Error;
use substreams_ethereum::pb::eth::v2 as eth;

substreams_ethereum::init!();

const ROBINHOOD_POOL_MANAGER: [u8; 20] = hex!("8366a39cc670b4001a1121b8f6a443a643e40951");

fn pool_manager_from_params(params: &str) -> Result<[u8; 20], Error> {
    let value = params.trim();
    let value = value.strip_prefix("pool_manager=").unwrap_or(value).trim();
    let value = value.strip_prefix("0x").unwrap_or(value);
    if value.is_empty() {
        return Ok(ROBINHOOD_POOL_MANAGER);
    }

    let bytes = hex::decode(value)
        .map_err(|error| Error::msg(format!("invalid pool_manager hex: {error}")))?;
    bytes.try_into().map_err(|bytes: Vec<u8>| {
        Error::msg(format!(
            "pool_manager must be 20 bytes, got {}",
            bytes.len()
        ))
    })
}

/// Extract the Uniswap v4 PoolManager Initialize event into a reusable stream.
///
/// The output intentionally contains only identity and raw PoolKey fields. A
/// downstream package can consume `map_initialize` without depending on this
/// repository's Graph subgraph schema or on any price/liquidity interpretation.
#[substreams::handlers::map]
pub fn map_initialize(params: String, block: eth::Block) -> Result<PoolInitializations, Error> {
    let pool_manager = pool_manager_from_params(&params)?;
    let pools = block
        .events::<abi::pool_manager::events::Initialize>(&[&pool_manager])
        .map(|(event, _log)| PoolInitialization {
            pool_id: event.id.to_vec(),
            currency0: event.currency0.to_vec(),
            currency1: event.currency1.to_vec(),
            fee: event.fee.to_u64() as u32,
            tick_spacing: event
                .tick_spacing
                .to_string()
                .parse::<i32>()
                .expect("int24 tick spacing fits in i32"),
            hooks: event.hooks.to_vec(),
        })
        .collect();

    Ok(PoolInitializations { pools })
}

#[cfg(test)]
mod tests {
    use super::abi::pool_manager::events::Initialize;
    use super::*;
    use substreams::hex;

    const INITIALIZE_TOPIC: [u8; 32] =
        hex!("dd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438");
    const FOREIGN_ADDRESS: [u8; 20] = hex!("4444444444444444444444444444444444444444");
    const INVALID_TOPIC: [u8; 32] = [0u8; 32];

    fn initialize_log(address: &[u8; 20], topic: &[u8; 32]) -> eth::Log {
        eth::Log {
            address: address.to_vec(),
            topics: vec![
                topic.to_vec(),
                hex!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").to_vec(),
                hex!("0000000000000000000000001111111111111111111111111111111111111111").to_vec(),
                hex!("0000000000000000000000002222222222222222222222222222222222222222").to_vec(),
            ],
            data: hex!("00000000000000000000000000000000000000000000000000000000000009c4ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc400000000000000000000000033333333333333333333333333333333333333330000000000000000000000000000000000000000000000000000000000000001ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc4").to_vec(),
            ..Default::default()
        }
    }

    #[test]
    fn decodes_initialize_event_shape_from_synthetic_fixture() {
        // Synthetic values only: this fixture is not a mainnet observation.
        let log = eth::Log {
            topics: vec![
                hex!("dd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438").to_vec(),
                hex!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").to_vec(),
                hex!("0000000000000000000000001111111111111111111111111111111111111111").to_vec(),
                hex!("0000000000000000000000002222222222222222222222222222222222222222").to_vec(),
            ],
            data: hex!("00000000000000000000000000000000000000000000000000000000000009c4000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000033333333333333333333333333333333333333330000000000000000000000000000000000000000000000000000000000000001ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc4").to_vec(),
            ..Default::default()
        };

        assert!(Initialize::match_log(&log));
        let event = Initialize::decode(&log).expect("synthetic Initialize must decode");
        assert_eq!(
            event.id,
            hex!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_eq!(
            event.currency0,
            hex!("1111111111111111111111111111111111111111")
        );
        assert_eq!(
            event.currency1,
            hex!("2222222222222222222222222222222222222222")
        );
        assert_eq!(event.fee.to_u64(), 2500);
        assert_eq!(event.tick_spacing.to_string(), "60");
        assert_eq!(
            event.hooks,
            hex!("3333333333333333333333333333333333333333")
        );
        assert_eq!(event.sqrt_price_x96.to_u64(), 1);
        assert_eq!(event.tick.to_string(), "-60");
    }

    #[test]
    fn maps_only_pool_manager_initialize_logs_from_a_successful_receipt() {
        // Synthetic values only: this fixture is not a mainnet observation.
        let block = eth::Block {
            transaction_traces: vec![eth::TransactionTrace {
                status: 1,
                receipt: Some(eth::TransactionReceipt {
                    logs: vec![
                        initialize_log(&super::ROBINHOOD_POOL_MANAGER, &INITIALIZE_TOPIC),
                        initialize_log(&FOREIGN_ADDRESS, &INITIALIZE_TOPIC),
                        initialize_log(&super::ROBINHOOD_POOL_MANAGER, &INVALID_TOPIC),
                    ],
                    ..Default::default()
                }),
                ..Default::default()
            }],
            ..Default::default()
        };

        let output = __impl_map_initialize(String::new(), block).expect("synthetic block must map");
        assert_eq!(output.pools.len(), 1);
        let pool = &output.pools[0];
        assert_eq!(
            pool.pool_id,
            hex!("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_eq!(
            pool.currency0,
            hex!("1111111111111111111111111111111111111111")
        );
        assert_eq!(
            pool.currency1,
            hex!("2222222222222222222222222222222222222222")
        );
        assert_eq!(pool.fee, 2500);
        assert_eq!(pool.tick_spacing, -60);
        assert_eq!(pool.hooks, hex!("3333333333333333333333333333333333333333"));

        let empty = __impl_map_initialize(String::new(), eth::Block::default())
            .expect("empty block must map");
        assert!(empty.pools.is_empty());
    }
    #[test]
    fn accepts_a_network_specific_pool_manager_parameter() {
        let base = hex!("498581ff718922c3f8e6a244956af099b2652b2b");
        let output = __impl_map_initialize(
            "pool_manager=0x498581ff718922c3f8e6a244956af099b2652b2b".to_string(),
            eth::Block::default(),
        )
        .expect("base pool manager parameter must decode");
        assert!(output.pools.is_empty());
        assert_eq!(
            pool_manager_from_params("pool_manager=0x498581ff718922c3f8e6a244956af099b2652b2b")
                .expect("base address must parse"),
            base
        );
    }
}
