use std::env;

use substreams_ethereum::Abigen;

fn main() -> Result<(), anyhow::Error> {
    println!("cargo:rerun-if-changed=abi/PoolManager.json");
    println!("cargo:rerun-if-changed=proto/pool/v1/pool.proto");

    Abigen::new("pool_manager", "abi/PoolManager.json")?
        .generate()?
        .write_to_file("src/abi/pool_manager.rs")?;

    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    env::set_var("PROTOC", protoc);
    prost_build::Config::new().compile_protos(&["proto/pool/v1/pool.proto"], &["proto"])?;

    Ok(())
}
