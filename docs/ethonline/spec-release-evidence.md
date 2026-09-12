# Public specification — registry release, paid evidence and BSC

Provenance: retrospective reconstruction prepared 12 September 2026 from public release history, recorded paid evidence, the reviewed Task 61/62 requirements and current manifests. It is not a contemporaneous release transcript.

## Registry and evidence contract

The demo must resolve an actual published producer by name, not require an unbuilt local WASM file. Publish producer first, then a consumer importing that exact version. The shipped versions are producer `v0.1.2` and consumer `v0.1.1`; old versions remain historical. A cold registry run and a local source build prove different things and should be reported separately.

For a paid round, preserve full combined stdout/stderr rather than selected successful fragments. Show machine-readable 402 requirements, the authorized amount/receiver, HTTP 200, a settlement hash and the returned verdict. Match the hash to a successful Base Sepolia receipt and keep a README link to the same run. Scan the evidence for secrets before publication.

## BSC extension contract

Add the BSC PoolManager as a manifest network parameter. Verify its deployment block rather than guessing an initial block. Do not change Rust, republish packages, alter the Base/Robinhood paths or claim production integration.

The accepted local observation used initial block 45970610 and the inclusive 200-block window 121217205–121217404. Provider and RPC each returned two Initialize events; recorded misses, false positives and field mismatches were zero. This is a bounded historical observation, not a continuous chain audit.

Task 62 requested a concise explanation of practical reuse: one BSC manifest entry and zero Rust changes, with downstream code reusing typed identity instead of duplicating event parsing. That claim must preserve the separate statistics-consumer and assessment paths.

## Reconstructed execution sequence and acceptance

Correct cold registry resolution; publish the version chain; complete the separately authorized paid round and preserve evidence; verify the BSC deployment/window against RPC; update the README with exact scope and links; run relevant checks; compare release baseline and commit/push without rewriting history.

The documentation finalization does not repeat payments or publish a new Substreams version. Its fresh offline/build checks and its historical external evidence are listed separately in the verification report.
