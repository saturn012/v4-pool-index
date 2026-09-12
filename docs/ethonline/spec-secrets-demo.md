# Public specification — secret barrier and reproducible demo

Provenance: retrospective reconstruction prepared 12 September 2026 from public scanner/launcher code, reviewed Task 53 and the recorded preflight corrections. Private cross-system credential migration procedures are excluded.

## Secret-handling contract

Credentials must not enter tracked code, fixtures, logs or process arguments. Protected-file loaders populate only the required process environment. The Git hook scans staged blobs; the standalone scanner covers the index or reachable history. Public contract addresses, pool IDs, transaction hashes and the configured recipient are not classified as secrets merely because they are hexadecimal.

The scanner also rejects forbidden secret paths and recognizable credential formats. Its documented limitations remain: it is not an access-control system and does not prove the absence of every possible secret. Loader tests do not authorize deleting old credential copies or claiming a real consumer migration worked.

## Demo instruction contract

`npm run demo` produces six human-readable stages: pool identity, token metadata, scoped verdict, unpaid 402, payer authorization and the settled HTTP response. Print units, sources, limits and the full public transaction hash. Never print key values or fragments.

The preflight aggregates missing dependencies, Substreams availability, provider access, payer configuration, test USDC and loopback-server readiness. `demo:check` performs checks without a payment. Payer ETH is advisory in the corrected implementation; it must not block the round. An unknown payment outcome stops the run without a blind retry.

`demo -- --offline` exercises only stages 1–3 using clearly marked fixtures, without provider requests or secret access. Offline output cannot stand in for live-provider or settlement evidence.

## Reconstructed execution sequence and acceptance

Install staged-content protection; test protected loaders and error redaction; add the orchestrated demo and preflight; test dependency failures and secret isolation; verify fixture rehearsal; preserve the full output of the separately authorized paid run.

The payer key is removed from the environment passed to the assessment-side work. Owned loopback listeners are closed on completion or error. Existing foreign listeners are preserved. Tests cover the scanner, launchers, payer and demo; current counts and results are in the verification report.
