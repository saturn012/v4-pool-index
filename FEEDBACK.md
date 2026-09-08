# Uniswap Developer Feedback — owner draft scaffold

> This is a factual scaffold, not the owner's submitted review. The project owner must rewrite the short personal sections in their own words, complete the assessment, and submit the Uniswap Developer Feedback Form. Codex has not submitted the form.

## 1. `poolId` / `PoolKey` identity

**Technical facts to preserve**

- In Uniswap v4, `poolId` is the irreversible hash of the `PoolKey`.
- The `Initialize` event is the place where the pool identity is observed together with the currencies, raw fee, tick spacing, and hooks. Without indexing `Initialize`, a later v4 event cannot be interpreted back to those pool parameters.
- In this implementation, the decoded `Initialize.id` becomes the reusable `pool_id` output.

**Owner's own words — write here**

- [Describe what was learned about why the `Initialize` index matters in the project.]
- [Add the owner's personal assessment of the implementation and its usefulness.]

## 2. Dynamic-fee flag

**Technical facts to preserve**

- The observed raw fee value is `8388608`, which is hexadecimal `0x800000`.
- `0x800000` is the dynamic-fee flag; it must not be read as a percentage or treated as a normal fixed fee.
- The composition rules therefore keep a dynamic-fee result `UNKNOWN` instead of inventing a fixed percentage.

**Owner's own words — write here**

- [Explain in the owner's words why preserving raw fee units prevented a misleading conclusion.]
- [Add any personal assessment of the dynamic-fee handling.]

## 3. Hooks and the limit of `Initialize` evidence

**Technical facts to preserve**

- A non-zero hooks address is present in the `Initialize` data, but one `Initialize` event does not reveal what the hook will do during a sale or other later callbacks.
- The implementation treats that as a boundary of the event evidence itself: non-zero hooks are not bounded by initialize-only evidence, so the technical decision is `REJECT` for that check.
- This is not a claim that the decoder is broken; it is a limitation of what the event can establish.

**Owner's own words — write here**

- [Describe the owner's view of the hooks limitation and why it matters to the feedback.]
- [Add the owner's assessment of the trade-off between useful identity data and incomplete behavior evidence.]

## 4. Robinhood data route: scoped Substreams observation

**Technical facts to preserve**

- In the provider-registry snapshot used for the Robinhood work, the recorded state was `subgraphs: 0` and three Substreams endpoints; the live `Initialize` observation was obtained from a Substreams stream.
- For that Robinhood snapshot and this data path, Substreams was therefore the available route to the v4 event data.
- Keep the claim scoped: this does not establish that every Robinhood-related service, every provider, or every time period has subgraphs unavailable.

**Owner's own words — write here**

- [Describe the owner's experience of using Substreams for the Robinhood data path.]
- [State what the owner would want the provider ecosystem or tooling to improve.]

## Owner-written assessment and submission

- [Write the owner's overall evaluation in first person and add any concrete feedback for Uniswap/the provider ecosystem.]
- [Add the owner's final assessment of what worked, what was limited, and what should be improved.]
- [Owner: review every section, add the required link to this `FEEDBACK.md`, and submit the Uniswap Developer Feedback Form.]

**Submission status:** not submitted by Codex; pending owner review and submission.
