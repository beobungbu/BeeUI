# #143 Dynamic Type — redesigned native evidence path (Challenge A)

Status: in progress
Branch: `claude/fable5-root-blockers-796be0` from main `e19c66b`.

## Root cause of PR #269's Android failure

The native evidence flow navigated Showcase → Component Gallery and ran
`scrollUntilVisible` on `select-showcase-controlled-trigger`, a target deep in a
very long gallery (~28s scroll at 1x on the CI emulator). Real font scaling
expands all preceding content; the 180s scroll budget is exhausted before the
target enters UIAutomator's visible hierarchy → evidence never completes even
though font_scale is applied and the app runs.

## Redesign

Deterministic runtime fixture screen (same pattern as the existing
`RuntimeAcceptance` surface — one tap from home, targets at the top, zero
gallery traversal):

1. `apps/showcase/runtime-smoke/dynamic-type-acceptance.tsx` (new)
   - No `AppHeader` → decoupled from #284's large-text collapse bug.
   - `dynamic-type-ready` marker; `dynamic-type-font-scale` label rendering
     `PixelRatio.getFontScale().toFixed(2)` → in-app proof the OS scale applied.
   - Real `SelectTrigger` (`dynamic-type-select-trigger`) and `PaginationItem`
     (`dynamic-type-pagination-item-1`) directly under the label (growth targets).
   - Representative fixed-height exceptions `dynamic-type-save-button`,
     `dynamic-type-email-input` (web-measured only).
2. `showcase-root.tsx`: 5th home card + `showcase-open-dynamic-type` launcher.
3. Component fixes (carried from #269, verified unchanged on new base):
   `select.tsx` `h-11`→`min-h-11 py-2`; `pagination.tsx` `h-10`→`min-h-10 py-2`.
4. Jest contract suite + helpers ported from #269, re-validated against current
   sources (occurrence counts re-checked by running).
5. Web evidence `dynamic-type-showcase.spec.ts` ported, retargeted to the
   fixture screen (root-font-size + CSS zoom axes, same 4 targets).
6. `scripts/runtime-smoke/android-dynamic-type.sh` (new, sourceable segment)
   invoked at end of `android.sh`: per scale 1.0/1.3/1.5/2.0 →
   set `font_scale` → clearState relaunch → home → 1 tap → assert scale label
   text → assert both targets visible (no scroll) → single uiautomator dump →
   parse bounds for both targets → screenshot; final node check asserts 2x
   height > 1x height per target. font_scale reset in cleanup.
7. `install-maestro.sh` hardening carried from #269 (banner parse, retry).
8. Docs: `docs/dynamic-type.md` (evidence section rewritten for new path),
   `docs/components.md` boundary paragraph.

## Verification

- Jest suite locally.
- Playwright web spec locally (chromium).
- Real Android evidence locally: existing `beeui` AVD (android-35 arm64) +
  maestro, running the same sourceable segment against a local emulator.
