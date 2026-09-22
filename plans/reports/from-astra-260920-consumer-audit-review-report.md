# Independent review by Astra (external, ChatGPT) — received 2026-09-20 10:40

Verdict: PR #617 REQUEST CHANGES, PR #618 REQUEST CHANGES, #619 proceed with Layer A revised and Layer B spiked first. Status: BLOCKED.

Findings (severity · location · summary):
- major · #618 docs/dist-tag-policy.md · causal explanation of `latest` == RC ("first publish always creates latest despite --tag"; "no supported way to remove latest") called unsupported by npm docs; checker does not query the registry.
- major · #618 toolbar.tsx:242-352 · roving sequence counts every visible ToolbarItem before knowing whether its child is focusable; Fragment/null/text children break the single tab stop.
- major · #617 table.tsx:281-386, table.web.tsx:436-535 · TableRow onPress has no embedded-action exclusion (web onClick on <tr>; native row Pressable with role button around arbitrary cell content).
- minor · #550/#552 · packed Vite/RNW consumer does not render BeeThemeScope / useBeeToken, so the package-boundary case is not gated.
Plausible, unverified: #584 rapid close→reopen race in presentedRef/handleDismiss; visual baselines not individually inspected; all 72 acceptance criteria not re-proved; Android sheet runtime.
Cleared: CI edits still compile both Android APKs and iOS; public-surface delta is exactly the 9 expected rows; #606 diagnosis (RNW 0.21 TextInput stopPropagation) correct; #584 mount-time dismiss matches an upstream gorhom 5.2.14 defect.
#619: A revise (no "skip when outer provider exists"), B spike first (containerComponent is a top-layer placement API, not a context-preserving portal), C approve with single topmost toast renderer, D approve; do not retire legacy transport in the same change.

Coordinator disposition (Ambrose, 2026-09-20): see plans/reports/consumer-audit-260920-astra-review-disposition-report.md.
