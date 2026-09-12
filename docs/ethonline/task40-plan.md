# ETHOnline 2026 — Task 40 implementation plan

> Historical development artifact. Status, version and publication statements below describe that task stage. For the current released state, use [the review guide](judge-guide.md).

1. Preserve the accepted Initialize protobuf contract and make PoolManager/network selection a manifest parameter.
2. Add a small dependency-free composition CLI that consumes real `map_initialize` output and queries Pinax Token API metadata without putting credentials in code, arguments, logs, or repository files.
3. Keep native currency, missing metadata, dynamic fees, and missing volume distinct from zero values.
4. Add deterministic rules and tests with reasons suitable for a human reviewer.
5. Run bounded live acceptance on both networks and one Base ERC-20/ERC-20 pool, then record PASS/PARTIAL/UNKNOWN evidence without publishing the package.
6. Prepare a short owner-recorded demo script and document the remaining publication and prize gates.

The artifact remains observe_only and has no Alpha2 bridge. Live acceptance is evidence for this candidate, not a claim about AlphaScanner production behavior.
