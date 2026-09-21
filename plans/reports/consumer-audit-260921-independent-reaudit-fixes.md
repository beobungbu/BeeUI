# Consumer audit — independent re-audit fixes (2026-09-21)

Target: `fix/consumer-audit-followups` / PR #618.

This pass fixes the composed-contract regressions found after WS-P/WS-Q + Astra review #2:

1. SafeArea keeps non-padding layout/style on the outer root and moves only caller padding inward.
2. IconButton keeps Button as the root for count/no-count and preserves Pressable style callbacks.
3. Toolbar uses effective item/child disabled state, measures the real wrapper, and mounts each caller child once.
4. Native Sheet serializes dismiss/present so gorhom's tokenless `onDismiss` never has multiple live presentations to disambiguate.
5. Scrollable + closable Tabs bounds close-button Tab order to the current tab.
6. Distribution docs/generators state observed registry truth without inventing an npm first-publish causal rule.

Not over-claimed: native TableRow nested interactive behavior still lacks real responder evidence; #619 remains open for complete native Sheet context/overlay/toast topology.
