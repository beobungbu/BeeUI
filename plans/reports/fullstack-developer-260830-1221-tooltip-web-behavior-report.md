# Tooltip Web behavior (#152) — implementation report

## Executed
- Issue: #152 (R4A.2), contract: `docs/decisions/005-tooltip-contract.md` (ADR-005)
- Worktree: `/Users/textsoft/workspace/beeui-wt-152`, branch `feat/152-tooltip-web`, base `80a113c`
- Status: DONE

## Files
- `packages/ui/src/components/tooltip-shared.tsx` (new) — platform-agnostic composition root, context, controlled/uncontrolled state, open/close delay state machine, shared prop types, interactive-child dev-check helper.
- `packages/ui/src/components/tooltip.d.ts` (new) — types-only shim mirroring `overlay-transport.d.ts` so `tooltip.native.tsx` (#153) can be added with no refactor.
- `packages/ui/src/components/tooltip.web.tsx` (new) — Web `TooltipTrigger`/`TooltipContent`: hover/focus wiring, `role="tooltip"`+`aria-describedby`, Escape via `useOverlayDismissable`, `tabIndex={-1}` (no focus transfer), dev interactive-content warning.
- `apps/showcase/__tests__/issue-152-tooltip-web.test.tsx` (new) — 10 Jest/RNTL fake-timer tests.
- `apps/visual-regression/App.tsx` (modified) — new `?fixture=tooltip` fixture (default/fast/controlled instances).
- `apps/visual-regression/src/a11y-scenarios.ts` (modified) — additive `tooltip-open` axe scenario.
- `apps/visual-regression/tests/tooltip-fixture.spec.ts` (new) — 6 real-Chromium Playwright tests + 1 baseline screenshot.

## Key decision: not exported from `@beemvp/beeui-ui` yet
Confirmed empirically (not just per ADR text) that exporting `Tooltip` from `packages/ui/src/index.ts` right now would break `apps/showcase`'s iOS/Android Metro bundling — that shared barrel is consumed by `apps/showcase`, which builds for iOS/Android, and only a `.web.tsx` implementation exists (no native/generic fallback for Metro to resolve on other platforms). Additionally, `apps/showcase/__tests__/pattern-gallery.test.tsx`'s "keeps Showcase imports public and router-free" guard test forbids any Component-Gallery file from deep-importing `packages/ui/src/...` — so a Component Gallery demo was not a viable path either. Real hover/focus/Escape/timing evidence instead lives in `apps/visual-regression`, a genuinely Web-only Expo app (`build:web` only, no `ios`/`android` script), where a direct `tooltip.web.tsx` import is safe. This matches ADR-005's own sequencing (#155 owns barrel/registry export once #152-154 are green).

## Bug caught during self-review
Initial `TooltipContent` used `Pressable` (needed for `onHoverIn`/`onHoverOut`) which defaults to `tabIndex={0}` on Web — making the tooltip bubble an unwanted, independent Tab stop, contradicting ADR-005's "no focus transfer into content." Caught via the real-browser Playwright test (`never becomes a Tab stop and never receives focus itself`), fixed with an explicit `tabIndex={-1}`, and pinned with a matching Jest assertion too.

## Tests status
- `pnpm --filter @beemvp/beeui-ui typecheck`: pass
- `pnpm --filter @beemvp/beeui-showcase typecheck`: pass
- `pnpm --filter @beemvp/beeui-visual-regression typecheck`: pass
- `pnpm --filter @beemvp/beeui-showcase test`: 59 suites / 617 tests pass (10 new; confirms Popover/#21, DropdownMenu, Select, overlay-runtime/#59 contracts all remain green)
- `apps/visual-regression` `tooltip-fixture.spec.ts` (`desktop-light` project): 6/6 pass, stable across 2 reruns
- `apps/visual-regression` a11y gate (`BEEUI_A11Y_AUDIT=1`, `a11y-audit` + `a11y-gate-regression` projects): 18/18 pass; `tooltip-open` scenario: 0 blocking/allowlisted/non-blocking axe violations
- `apps/visual-regression` `showcase-integration` project (Select/overlay-context/showcase/dynamic-type/large-text): 33/33 pass (1 pre-existing unrelated skip)
- SKIPPED (honest, not faked): full canonical `visual.spec.ts`/`density`/`dataviz-brands`/`scoped-preview` matrix — reproduces an identical ~1% pixel-diff on every scenario on the **unmodified base commit** too (verified via `git stash` + rebuild + rerun), i.e. pre-existing font-rendering baseline drift specific to this sandbox, unrelated to this change. Not touched or regenerated (out of scope for #152; regenerating would be scope creep and could mask a real future regression).

## PR
https://github.com/beobungbu/BeeUI/pull/314 (head `139eddf`, base `80a113c`), links #152 + #114. Not merged.

## Concerns / follow-ups (for #153/#154/#155, not blocking this PR)
- #153 should verify the shared timer state machine (`tooltip-shared.tsx`) needs no changes for long-press + merged `accessibilityHint` on native — only new `TooltipTrigger`/`TooltipContent` native implementations should be required.
- #155 should switch `apps/visual-regression/App.tsx`'s Tooltip import from the deep `tooltip.web` path back to `@beemvp/beeui-ui` once the barrel export lands, and should decide whether the `apps/visual-regression`-only fixture is retired in favor of a real Component Gallery demo at that point.
