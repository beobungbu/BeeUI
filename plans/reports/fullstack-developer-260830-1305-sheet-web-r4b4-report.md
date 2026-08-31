# Issue #159 (R4B.4) — Sheet Web policy implementation report

## Executed
- Branch: `feat/159-sheet-web`, base `main@3f45783`, HEAD `4ca86a1` (single commit, exact-head).
- PR: https://github.com/beobungbu/BeeUI/pull/317 (open, not merged).
- Worktree: `/Users/textsoft/workspace/beeui-wt-159` (main worktree untouched).

## Scope delivered
Web implementation of Sheet per accepted ADR-006 (`docs/decisions/006-sheet-gesture-engine.md`):
bottom-sheet surface with backdrop, Escape, focus ownership/restoration, responsive layout,
RTL, reduced motion — reusing BeeUI's own Web overlay primitives, no gorhom/Reanimated/
Gesture-Handler on Web, no drag-to-dismiss gesture claimed.

## Files changed
- `packages/ui/src/components/sheet.web.tsx` (new, 806 lines) — Web `SheetContent`/`SheetHandle`
  reimplementation using `OverlayPortal`/`ModalOverlayHost` instead of `<Modal>`; `Sheet`/
  `SheetTrigger`/`SheetTitle`/`SheetDescription`/`SheetFooter`/`SheetClose` duplicated
  verbatim (platform-file resolution is whole-file; mirrors the `table.tsx`/`table.web.tsx`
  precedent). `sheet.tsx` (native skeleton, #157) was **not** touched.
- `packages/ui/src/index.ts` — exports `Sheet`/`SheetClose`/`SheetContent`/`SheetDescription`/
  `SheetFooter`/`SheetHandle`/`SheetTitle`/`SheetTrigger` + types from `./components/sheet`
  (previously unexported from the public barrel since #157; needed for the Web build/demo to
  consume it — `tsc` resolves this specifier to `sheet.tsx`, Metro/webpack resolve
  `sheet.web.tsx` for Web builds).
- `apps/showcase/component-gallery/component-gallery.tsx` — new "Sheet" demo section
  (`sheet-demo-trigger`/`-content`/`-overlay`/`-input`/`-close` testIDs) between Dialog and
  Popover sections.
- `apps/showcase/__tests__/helpers/dynamic-type.ts` — added `sheet.web.tsx` to
  `FIXED_HEIGHT_ALLOWLIST` (same `h-1.5`→`h-1` decorative-handle entry as `sheet.tsx`).
- `apps/visual-regression/src/a11y-scenarios.ts` — added `component-gallery-sheet-overlay`
  axe scenario.
- `apps/visual-regression/tests/sheet-showcase.spec.ts` (new) — 7 Playwright tests: open/close,
  Escape, backdrop, Tab focus-trap wrap (both directions), responsive (compact vs. `medium`+),
  RTL, reduced motion.
- `docs/components.md` — "Sheet boundary" section extended with a "Web implementation" subsection
  documenting the platform-specific behavior.

## Key implementation decisions
- **No `<Modal>` on Web** (per `sheet.tsx`'s own doc comment anticipating #159): panel/backdrop
  render via `OverlayPortal` + `ModalOverlayHost`, matching how `Popover`/`DropdownMenu` already
  portal on Web, so nested-overlay dismiss-stack routing (a `Popover` opened from inside the
  Sheet) works identically to Dialog's own precedent.
- **Real bug found + fixed via Playwright evidence**: BeeUI's shared bubble-phase Escape bridge
  (`overlay-dismiss-events.web.ts`, window-level) and a bubble-phase Tab-trap listener are both
  silently defeated when a focused text `Input` inside the panel stops the keydown's bubble
  phase (confirmed empirically: Escape/Tab worked with focus on a `Button`, failed with focus on
  an `Input`, consistently reproducible). Fixed by attaching Sheet's own Escape and Tab-trap
  listeners in the **capture phase** instead, gated by `isTopmost()` for Escape so nested-overlay
  precedence is preserved. This is Sheet-specific, in-scope code; no shared `overlay-runtime.tsx`
  file was touched.
- Motion: `sheet-enter`/`sheet-exit` via `resolveMotion`/`resolveNativeMotion` + RN `Animated`
  (translateY + opacity), the same pattern `theme-inspector/motion-preview.tsx` already
  demonstrates — not raw CSS custom properties, kept consistent with the one animation idiom
  already used elsewhere in this RN-based codebase.
- Responsive: `md:` (768px+) caps the panel at the existing `max-w-dialog` (512px) token and
  centers it with rounded-all corners; below that, edge-to-edge full-width bottom sheet.
- `dismissOnRequestClose` on Web mirrors the native contract exactly (gates backdrop/Escape/
  `onRequestClose`-triggered close, not just a native-request-close concept) — verified against
  the pinned #157 test `notifies onRequestClose without closing when dismissOnRequestClose is
  false`.

## Tests status
- Type check (full workspace, 5 projects): **pass**.
- `pnpm --filter @beemvp/beeui-showcase test` (jest, 63 suites): **685/685 pass**, including the
  pinned `issue-157-sheet-api.test.tsx` (untouched, still exercises native `sheet.tsx`).
- Playwright `sheet-showcase.spec.ts`: **7/7 pass**, re-run 3× each (21/21) with no flakiness.
- Playwright `component-gallery-sheet-overlay` axe scan: **0 blocking violations**.
- Full `showcase-integration` Playwright project (41 tests, incl. `overlay-context.spec.ts`,
  `select-showcase.spec.ts`, cross-theme/viewport Component Gallery matrix): **40 passed, 1
  correctly skipped** (CI/env-gated full 37-screen matrix).
- `a11y-audit` + `a11y-gate-regression` projects: **18/18 pass**.
- `node ./scripts/check-repo-hygiene.mjs`: **pass**.
- Local env note: node v24.14.1 vs repo's pinned `24.13.1` required `PNPM_CONFIG_ENGINE_STRICT=false`
  for every pnpm invocation locally; no repo config was changed.

## Concerns / follow-ups
- The capture-phase-listener-defeats-input-stopPropagation issue may also affect other
  overlay content that contains a focused text `Input` (e.g. a `Popover`/`Dialog` with a
  search field) — out of scope here since it's shared `overlay-runtime.tsx`/`dialog.tsx` code,
  not touched by this PR. Worth a dedicated follow-up issue if confirmed elsewhere.
- No safe-area inset padding on Web (documented as deliberate, matching `DialogContent`'s
  existing lack of a Web precedent for it).
- Native (#158) still renders the `sheet.tsx` skeleton; no `@gorhom/bottom-sheet` dependency
  was touched by this PR (out of scope).

Status: DONE
Summary: Sheet Web implementation complete with real focus-trap/Escape/backdrop/responsive/RTL/
reduced-motion behavior, backed by 7 new Playwright tests (21 runs, zero flakes) plus a passing
axe scan; PR #317 open against main, unmerged, linking #159/#114.
PR: https://github.com/beobungbu/BeeUI/pull/317
Concerns: see "Concerns / follow-ups" above — none blocking.
