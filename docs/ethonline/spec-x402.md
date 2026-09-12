# Public specification — x402 assessment server and payer

Provenance: retrospective public reconstruction prepared 12 September 2026 from reviewed Tasks 49 and 51, the current payer/server code and the published correction history. It is not a verbatim original prompt.

## Goal and instruction contract

Make only the existing pool assessment available through paid HTTP. Use x402 v2, the explicit test facilitator, Base Sepolia `eip155:84532`, and 1000 atomic USDC units per request. An unpaid request returns 402 with machine-readable requirements before assessment work. A paid request can return the assessment.

The server uses a dedicated public receiver address from configuration; no server-side private key is required. The client uses a separate explicitly approved test payer. It verifies scheme, network, asset, amount, receiver, timeout and URL before creating a payment authorization.

## Shipped design and corrections

- `scripts/assess-http.mjs`: loopback-only GET route, bounded assessment and method restrictions.
- `config/assess-x402.mjs`: dedicated receiver and testnet-only requirements.
- `scripts/assess-client.mjs`: official v2 HTTP client wrapper, one signed retry and structured outcomes.
- The wrapper contract was corrected after the raw SDK client lacked the required HTTP methods. Regression tests exercise the official wrapper surface.

A repeated 402 is a known rejection. Transport loss, timeout or an unverifiable settlement after a signed request is an unknown outcome; the implementation does not automatically retry it. Paid success requires HTTP 200, successful Base Sepolia settlement and a valid transaction hash.

Earlier instructions assumed the payer needed ETH and mentioned a different receiver. Current code uses the dedicated configured receiver and treats payer ETH as advisory because the facilitator submits settlement and pays gas. Those historical assumptions are not current requirements.

## Reconstructed execution sequence and acceptance

Implement and test the 402 gate; implement and validate the constrained client; distinguish known rejection from uncertainty; verify redacted failures and method restrictions; perform a separately authorized testnet round; preserve full output and match the settlement receipt.

The successful 11 September run is recorded in `docs/evidence/2026-09-11_paid-run.md`. No new payment is part of documentation finalization. The service has no public listener or mainnet route.
