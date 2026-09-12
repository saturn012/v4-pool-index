# ETHOnline documentation finalization — specification and plan

Prepared 12 September 2026 for the owner's request to independently complete documentation, public engineering materials, checks and GitHub publication with separate files, reversible commits and a detailed report.

## Baseline and scope

Public repository: `saturn012/v4-pool-index`. Starting commit: `00793453e50ce1a26ed59516c34cc663ee3b3a8f`. Development uses an isolated `ethonline-finalization-20260912` branch. The existing repository retains its event history; no duplicate repository is created.

Change only documentation. Keep source code, lockfiles, manifests, package versions and recorded paid stdout/stderr unchanged. Do not modify private production systems, repeat a payment or republish Substreams packages. The owner's personal review, voice recording and external submission receipts must not be fabricated.

## Planned work

1. Correct README architecture and link the same transaction used by paid evidence; add explicit Continuity disclosure.
2. Update x402 acceptance and make MCP/x402 instructions portable without exposing private deployment paths.
3. Add separate current submission copy, demo script, review guide and component specifications; label all historical and retrospectively reconstructed material.
4. Verify lockfile installation, existing Node/Graph/Rust tests, source builds, fixture demo, credential-free MCP negotiation, secret scans and documentation links.
5. Review the exact diff independently, make thematic commits, compare the moving main baseline, retain a backup, and publish with ordinary Git operations.
6. Report checks, failed attempts, limits, unpublished items and reversible commit steps.

## Acceptance

Current documentation must match code paths and evidence. Newly written relative links must resolve. No private data or new credential exposure may be introduced. Existing code and recorded payment must remain unchanged. Fresh tests/builds must pass, and the reviewed artifact must be the one published.

A complete original internal prompt/spec archive is a separate review boundary: reconstructing public technical contracts is not represented as having published every original instruction. External video/feedback/form completion is also reported separately from repository finalization.

## Rollback design

Retain the pre-finalization commit in a backup ref and Git bundle before edits. Separate documentation corrections, public materials and the verification report into thematic commits. Roll back with normal revert commits in reverse dependency order, never by force-pushing or resetting shared history. Exact commit IDs are recorded in the final owner report.
