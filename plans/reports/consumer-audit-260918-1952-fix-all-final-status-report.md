# Consumer-audit fix-all — final status (BeeUI #543–#615)

Branch: `fix/consumer-audit-batch` (base `origin/development`). Workstreams A–H merged; per-WS reports in `plans/260918-1559-consumer-audit-fix-all/reports/`.

| Bucket | Count | Issues |
|---|---|---|
| Fixed (code and/or docs, merged, regression-tested) | 65 | see below |
| Code fixed, needs owner proof on real device | 1 | #584 (Sheet iOS: `enableDynamicSizing=false`; proof is an owner gate) |
| Documented, root cause outside BeeUI | 2 | #606 (react-native-web TextInput stops keydown bubbling; capture-phase guidance published, Playwright `fixme` spec kept), #609 (Web verified correct; native untested) |
| Partially fixed | 2 | #585 (site-level items 2, 3 not attempted), #590 (items 1–5 done; item 6 is hosting ops) |
| Owner action only | 1 | #561 (npm `latest` already equals the RC because npm tags the first publish `latest`; needs `npm dist-tag` or policy change) |
| Closed duplicate before this work | 1 | #551 |

## Fixed — BeeECOM (15)
#543 #544 #545 #546 #547 #548 #549 #550 #552 #553 #555 #556 #557 #558 #559

## Fixed — BeePOS (50)
#560 #562 #563 #564 #565 #566 #567 #568 #569 #570 #571 #572 #573 #574 #575 #576 #577 #578 #579 #580 #581 #582 #583 #586 #587 #588 #589 #591 #592 #593 #594 #595 #596 #597 #598 #599 #600 #601 #602 #603 #604 #605 #607 #608 #610 #611 #612 #613 #614 #615

Umbrellas fully closed: #566 (6/6), #573 (5/5), #592 (3/3), #597 (5/5), #603 (2/2), #607 (2/2), #611 (6/6), #613 (4/4).

## Notable root causes found on the way
- #550/#552: `scripts/generate-tokens.mjs` nested every runtime theme inside `:root {}` → compiled `:root:where(.theme, .theme *)` can only match `<html>`; now emitted as un-anchored `.theme {}` blocks (plus cascade-inert `@variant` registration so Uniwind still generates semantic utilities).
- #587/#607: react-native-web `Modal` forces `role="dialog"` on its own node; AlertDialog now corrects it with a MutationObserver (browser-proven).
- #596/#605 looked fixed in source but were latent: `bg-surface-raised` equalled `bg-surface` in light themes; tailwind-merge evicted the Avatar text colour by class order.
- #606: react-native-web's own TextInput calls `stopPropagation` on keydown; BeeUI had worked around it three times internally without documenting it for consumers.

## New capabilities (approved 2026-09-18)
- Tabs: `TabsList scrollable/addon`, `TabsTrigger closable/onClose/closeAccessibilityLabel` (#591)
- OTPInput `appearance="segmented"` (#592)
- Table `density` with new `spacing.row-dense` 48 token, `TableCell align`, `TableRow onPress/selected` (#603, #595, #596, #572)
- Toolbar / ToolbarItem with priority-based overflow menu (#611), registered in registry + docs

## Gates
Code gate on merged A–G: lint, ui/showcase typecheck, ui-exports, tokens, 123 suites / 1110 jest tests green. Docs gates (contract, portal pages, surface, llms, ai-contract, registry, examples, patterns, build) green on WS-H. Full `pnpm typecheck && pnpm test` on the final merge: see PR checks.

## Follow-ups (not in this PR)
1. #584 real-device proof; #609 native half.
2. #585 items 2–3 (broad prose passes).
3. Arrow-key roving focus for scrollable Tabs and Toolbar (scoped out by WS-F).
4. DateTimePicker locale placeholder copy (WS-H noted the DatePicker fix did not cover DateTimePicker).
5. #561 npm dist-tag decision.
