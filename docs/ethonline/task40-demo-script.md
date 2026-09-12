# Task 40 demo script (2–4 minutes, 720p+)

> Historical development artifact. Status, version and publication statements below describe that task stage. For the current released state, use [the review guide](judge-guide.md).

Use a screen recording with the owner's real voice. Do not add synthetic narration, speed-up, or phone footage.

1. (0:00–0:25) State the problem: a v4 `pool_id` is a hash of a `PoolKey`, while token meaning lives in a separate standardized product.
2. (0:25–1:05) Show the same `map_initialize` module selected for Robinhood and Base through manifest network overrides. Run a bounded live stream and point to `pool_id`, both currencies, raw fee, tick spacing, and hooks.
3. (1:05–1:45) On Base, pass one real ERC-20/ERC-20 output to the composition CLI. Show `symbol`, `name`, `decimals`, `holders`, supply when available, provider, network, and observation time for both currencies. Mention that native zero-address inputs skip the ERC-20 call.
4. (1:45–2:35) Show two real pools: one technical PASS with the exact checks, and one REJECT with a human-readable reason such as nonzero hooks or a fee above the screen. If live data yields UNKNOWN, show it honestly and explain why.
5. (2:35–3:20) Show the README section “What became easier”. Explain that composition gives identity plus meaning; neither source alone supplies both.
6. (3:20–3:45) State limits: no trades, approvals, signatures, slippage or liquidity proof; missing volume remains UNKNOWN. The local package is prepared but unpublished pending owner authorization.
