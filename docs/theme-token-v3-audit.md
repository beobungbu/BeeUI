# Theme token v3 audit and Codex execution backlog

Baseline: PR #56 (`feat/theme-tokens-v2`)
Parent tracker: #64

## Purpose

PR #56 completes the Wave 1C semantic-token foundation. This document records the follow-up gaps discovered during the architecture/accessibility audit and defines the recommended execution order for Codex.

The v2 direction remains valid: semantic tokens over brand literals, Uniwind as runtime theme authority, Tailwind v4 as the utility/compiler layer, and brand-blind reusable components. The work below hardens and extends that contract rather than replacing it.

## P0 — correctness/accessibility

1. #65 — Make interactive state contrast semantic and deterministic.
   - Cover default/hover/pressed/disabled foreground/background relationships for every filled action state.
   - Remove opacity-only color-state fallbacks where compositing can invalidate contrast.
   - Add state-level contrast tests across Bee/Violet light/dark.

2. #66 — Raise control-boundary contrast for inputs and fields.
   - Separate structural-border and interactive-control-boundary intent if necessary.
   - Target >= 3:1 where the boundary is required to identify the control.
   - Cover default/focus/invalid/disabled states and adjacent surfaces.

## P1 — developer-completeness and architecture

### Canonical token/compiler lane

3. #69 — Single canonical token source + generated TypeScript/CSS/tooling artifacts.
4. #70 — Private primitive -> semantic alias hierarchy.
5. #83 — Strict semantic-token consumption guardrails for reusable components.

### Theme/runtime lane

6. #67 — Extensible typed theme registry instead of a closed Bee/Violet brand union.
7. #68 — Typed scoped-theme wrapper on top of Uniwind scoped themes.
8. #71 — Typed runtime overrides beyond colors.
9. #72 — Typed runtime token readers for SVG/charts/navigation/platform APIs.

### Layout/system lane

10. #73 — Semantic z/layer ordering separate from elevation.
11. #74 — Application density semantics for compact/comfortable/spacious UI.
12. #75 — Canonical responsive breakpoints, gutters, and layout-container semantics.

## P2 — maturity and specialized domains

13. #76 — Optional component-recipe layer for recurring brand customization.
14. #77 — High-contrast themes and broader semantic contrast validation.
15. #78 — Data-visualization tokens for finance/dashboard charts.
16. #79 — Evidence-driven mono/tabular/data typography semantics.
17. #80 — DTCG-compatible export and design-tool interoperability artifacts.
18. #81 — Token deprecation/version/migration metadata.
19. #82 — Cross-platform semantic spring and reduced-motion motion contracts.

## Dependency graph

```text
P0: #65 -> #66

#69 -> #70 -> #83
#69 -> #80
#69 -> #81

#67 -> #68 -> #71 -> #72
     \                 /
      +---- #69 -------+

#69 -> #73
#69 -> #74
#69 -> #75

#69 + #70 -> #76
#65 + #66 + #67 + #69 -> #77
#69 + #70 -> #78
#69 -> #79
#69 -> #82
```

Dependencies above are sequencing guidance, not a mandate to combine issues into one PR.

## Codex execution rules

- Prefer one focused issue per PR.
- Every implementation PR references its child issue and parent tracker #64.
- Do not modify component source by brand name; themes remain semantic.
- Do not introduce a second theme store/provider/runtime.
- Do not mass-replace literals unless their semantic intent is proven by recurring product evidence.
- Preserve v2 public compatibility unless the issue explicitly approves a migration; document any deprecation.
- Keep generated artifacts deterministic and add freshness checks where generation is introduced.
- For package/runtime changes, run typecheck, tests, release verification, web/Android/iOS exports, and applicable native verification.
- For cross-cutting visual changes, run Component Gallery plus the full 5 viewport x 2 appearance x 37 screen Pattern Gallery acceptance matrix.

## Global Definition of Done

A child issue is complete only when:

1. its issue-specific implementation and out-of-scope constraints are satisfied;
2. deterministic tests cover the new contract and regression case;
3. docs/API examples are updated;
4. typecheck and relevant unit/integration tests are green;
5. release verification is green where distributable package output changes;
6. relevant visual acceptance is green;
7. Android/iOS/native acceptance is green for platform-sensitive work;
8. no second theme engine/store has been introduced.

## Notes for reviewers

The P0 issues are correctness bugs against the current v2 behavior and should be handled before broader v3 expansion. The P1 issues close the largest developer-experience and white-label gaps relative to mature design systems while preserving BeeUI's smaller semantic API. P2 should remain evidence-driven; it is intentionally not a mandate to add every possible design token.
