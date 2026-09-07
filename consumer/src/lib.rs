pub mod pb {
    pub mod consumer {
        pub mod v1 {
            #[derive(Clone, PartialEq, ::prost::Message)]
            pub struct PoolDigests {
                #[prost(uint64, tag = "1")]
                pub pool_count: u64,
                #[prost(uint64, tag = "2")]
                pub nonzero_hooks: u64,
                #[prost(uint64, tag = "3")]
                pub dynamic_fee: u64,
            }
        }
    }
    pub mod pool {
        pub mod v1 {
            // Wire-compatible input bindings for the imported v4-pool-index output.
            // The producer module and its protobuf remain supplied by the package import.
            #[derive(Clone, PartialEq, ::prost::Message)]
            pub struct PoolInitializations {
                #[prost(message, repeated, tag = "1")]
                pub pools: ::prost::alloc::vec::Vec<PoolInitialization>,
            }
            #[derive(Clone, PartialEq, ::prost::Message)]
            pub struct PoolInitialization {
                #[prost(bytes = "vec", tag = "1")]
                pub pool_id: ::prost::alloc::vec::Vec<u8>,
                #[prost(bytes = "vec", tag = "2")]
                pub currency0: ::prost::alloc::vec::Vec<u8>,
                #[prost(bytes = "vec", tag = "3")]
                pub currency1: ::prost::alloc::vec::Vec<u8>,
                #[prost(uint32, tag = "4")]
                pub fee: u32,
                #[prost(int32, tag = "5")]
                pub tick_spacing: i32,
                #[prost(bytes = "vec", tag = "6")]
                pub hooks: ::prost::alloc::vec::Vec<u8>,
            }
        }
    }
}

use pb::consumer::v1::PoolDigests;
use pb::pool::v1::PoolInitializations;
use substreams::errors::Error;

const DYNAMIC_FEE_FLAG: u32 = 0x800000;

fn digest(input: PoolInitializations) -> PoolDigests {
    let pool_count = input.pools.len() as u64;
    let nonzero_hooks = input
        .pools
        .iter()
        .filter(|pool| pool.hooks.iter().any(|byte| *byte != 0))
        .count() as u64;
    let dynamic_fee = input
        .pools
        .iter()
        .filter(|pool| pool.fee & DYNAMIC_FEE_FLAG != 0)
        .count() as u64;

    PoolDigests {
        pool_count,
        nonzero_hooks,
        dynamic_fee,
    }
}

#[substreams::handlers::map]
pub fn map_pool_digest(input: PoolInitializations) -> Result<PoolDigests, Error> {
    Ok(digest(input))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_the_two_decision_signals_without_reimplementing_initialize() {
        let output = digest(PoolInitializations {
            pools: vec![
                pb::pool::v1::PoolInitialization {
                    fee: 0x800000,
                    hooks: vec![0; 20],
                    ..Default::default()
                },
                pb::pool::v1::PoolInitialization {
                    fee: 500,
                    hooks: vec![1],
                    ..Default::default()
                },
            ],
        });
        assert_eq!(output.pool_count, 2);
        assert_eq!(output.nonzero_hooks, 1);
        assert_eq!(output.dynamic_fee, 1);
    }
}
