# WS-N · Reduced-motion Dialog role on Web, Select pointer artifact, date popover geometry

Date: 2026-09-19 · Branch: `ws/n-reduced-motion-dialog` (from `fix/consumer-audit-followups` @ 00c9ef8)
Commits: 0fbdd9d (dialog fix + tests + date geometry assertion), 5e957bf (Select spec pointer fix), plus this report.

## Verdict

The `showcase-integration` failure at `reduced-motion-acceptance-showcase.spec.ts:37` was a real accessibility defect, not a test problem: under `prefers-reduced-motion: reduce` an open `Dialog` had `aria-modal="true"`, `aria-labelledby` and `aria-label="Project settings"` on the react-native-web Modal owner node but **no `role` attribute at all**, one second after opening. Hypothesis (a) from the task is confirmed; (b) is ruled out (the accessible name was always present); (c) is not it either (the reduce-motion listener works, it just answers one microtask too late).

The `:53` AlertDialog case already worked once the spec queried `alertdialog` (00c9ef8): the existing `MutationObserver` watcher stamps that role itself, independent of react-native-web's timing. That asymmetry is what pointed at the mechanism.

## Root cause

1. `DialogContent` derives `animationType` (`'none'` under reduced motion, else `'fade'`) from `useReducedMotionPreference`, which read `AccessibilityInfo.isReduceMotionEnabled()` — a Promise even on Web, where react-native-web merely wraps a synchronous `matchMedia` read. So the **first open render always used `fade`**, and the value flipped to `none` one microtask later, while the Modal was already visible.
2. react-native-web 0.21 `ModalAnimation` decides how a Modal becomes "active" (`isActive` → `role="dialog"` on `ModalContent`) from `onShow`, which it calls either from the CSS `animationend` of the fade keyframe, or manually — but only when `visible` *changes* while `animationType` is already `'none'` (`if (visible !== wasVisible.current && !isAnimated) animationEndCallback()`). The fade→none flip happened with `visible` unchanged, and it removed the keyframe before `animationend` could fire. Neither path ran; `isActive` stayed `false`; `role` stayed `null` forever.
3. Since #607 (WS-E) the panel `View` no longer restates `role`/`aria-modal` on Web (to avoid two nested `role="dialog"` nodes), so the owner node was the *only* candidate for the role — and it never got one.

A latent version of the same problem existed without reduced motion: under `fade`, the owner node had no `role` for the first ~300ms (until `animationend`). `keyboard-focus-matrix-showcase.spec.ts` tolerated that through `waitFor`.

## Evidence (Chromium, Showcase gallery-qa export served on 4174, `[aria-modal], [role=dialog], [role=alertdialog]` dump after opening)

Before (00c9ef8):

| Media | Surface | @50ms | @1050ms |
| --- | --- | --- | --- |
| reduce | Dialog | `role=null`, aria-modal, labelledby, label "Project settings", wrapper animation `none` | `role=null` (unchanged) |
| reduce | AlertDialog | `role=alertdialog` (watcher) | `role=alertdialog` |
| no-preference | Dialog | `role=null`, wrapper animation `r-imtty0` (fade) | `role=dialog` |
| no-preference | AlertDialog | `role=alertdialog` | `role=alertdialog` |

After (0fbdd9d): `role=dialog` / `role=alertdialog` present at @50ms and @1050ms in all four rows, exactly one node each; fade still plays under no-preference, `none` under reduce.

## Fix (`packages/ui/src/components/dialog.tsx`, `dialog-role-watch.ts`)

- `useReducedMotionPreference` now returns the synchronous `matchMedia('(prefers-reduced-motion: reduce)').matches` on Web (falling back to the existing async `AccessibilityInfo` path off Web or where `matchMedia` is unavailable — native, SSR, this repo's Jest harness). The open render carries the current preference; a preference changed while closed is picked up on reopen without any transient value. Explicit `modalProps.animationType` still wins.
- The owner-node role no longer depends on react-native-web's animation bookkeeping: `watchAlertDialogRole` became `watchDialogOwnerRole(node, role, MutationObserver)` and runs for both `dialog` and `alertdialog` whenever the Dialog is open on Web. It stamps the role on the first open commit and re-applies it whenever react-native-web writes its own value (`'dialog'` on activate, `null` on deactivate). This is what makes "exactly one correctly-named `role=dialog`/`alertdialog` node regardless of `animationType`, including `none`" true, and it closes the ~300ms role-less window under `fade` as well. Module renamed `alert-dialog-role-watch.ts` → `dialog-role-watch.ts`; it is still internal (not re-exported).
- `alert-dialog.tsx` unchanged.

Known limitation, documented rather than fixed: if the OS preference is toggled *while* a Dialog is open, `animationType` still changes mid-presentation and react-native-web's `isActive` will not flip for that cycle. The role is unaffected (the watcher owns it) and BeeUI already owns focus-trap and Escape on Web, so nothing user-visible depends on that flag; the alternative (latching `animationType` per open cycle) was judged not worth the extra state for an edge case with no observable effect.

## Second finding: Select reduced-motion scenario (pre-existing, environment-dependent)

`reduced-motion-acceptance-showcase.spec.ts` "Select opens and selects from the keyboard" failed locally 3/3 after the fix (`select-showcase-placeholder-designer` not focused; `engineer` was). Attribution:

- Replaying the exact spec steps against the fixed build (4174) **and** a build of untouched 00c9ef8 `packages/ui/src` (served separately) at the spec's 390×844 viewport: focus lands on **Engineer** on both, with and without reduced motion. At 1280×800 it lands on Designer on both. So: pre-existing, viewport-dependent, unrelated to this change.
- Mechanism (instrumented page): one `keydown` is dispatched, but `focus()` is called twice (Designer, then Engineer). The pointer is still at (195, 597) from the "Open Components" click; when the listbox opens, the Engineer option's rect is 38–228 × 576–616, so Chromium fires `pointerenter`/`mouseenter` on it without any mouse movement, `SelectItem`'s `onHoverIn` calls `setCurrentItem(engineer)`, and the current-item effect focuses it. With `page.mouse.move(0, 0)` before the keys, no pointer events fire and Designer keeps focus. The overlap depends on font metrics, which is why CI (Linux fonts) passed and a Mac fails.

Fix (5e957bf): the Select scenario parks the pointer at (0, 0) before `trigger.focus()`, with a comment. The component behaviour (hover makes an option current) is by design and untouched.

## Date popover geometry (`date-production.spec.ts`)

Measured on 4173 (desktop-light settings, 00c9ef8 `preventScroll` fix in place):

| Picker | `scrollY` after open | Trigger (viewport y, h) | Content (viewport y, h) | Side | Gap |
| --- | --- | --- | --- | --- | --- |
| DatePicker | 0 | 628, 44 | 266, 354 | above | 8px |
| DateTimePicker | 498 | 510, 44 | 8, 488 | above | 14px |

Both trigger and popover are fully inside the live viewport, and the popover's nearest edge is within 24px of the trigger — the rendering the committed `open-date-time-picker` PNG encodes (WS-M: this state is ~2% from that PNG on a Mac, versus ~7.7% for the detached rendering). `expectPopoverAdjacentToTrigger` now asserts this in both open-popover tests, before the screenshot, so the geometry is checked independently of font rasterisation.

Local screenshot results for `date-production.spec.ts --project=desktop-light`: all 8 `toHaveScreenshot` assertions fail at ratio 0.01–0.02 (the 360px one at 0.05 with a 24px page-height wrap difference), identical set and ratios before and after this change; the open-date-time-picker capture is 10568 px (ratio 0.0105) from the baseline, i.e. the font floor. Every non-screenshot assertion in the file, including the new geometry checks, passes. CI (Linux fonts) is the authority for the PNGs.

## Tests added / changed

- `apps/showcase/__tests__/dialog-web-modal-owner.test.tsx` — new `animationType under prefers-reduced-motion on Web` block: with a `matchMedia` stub reporting `reduce`, the **first** render of an open Dialog on Web has `animationType="none"` (no async settle), it stays `none` after the Promise-based signal resolves `false`, no-preference gives `fade`, a preference changed while closed is honoured on the reopen render itself, and explicit `modalProps.animationType` still wins.
- `apps/showcase/__tests__/dialog-role-mutation-correction.test.ts` (renamed from `alert-dialog-role-mutation-correction.test.ts`) — `watchDialogOwnerRole` parametrised over `dialog` and `alertdialog`; also covers react-native-web writing `null` (deactivate).
- `apps/visual-regression/tests/date-production.spec.ts` — `expectPopoverAdjacentToTrigger` on both open-popover tests.
- `apps/visual-regression/tests/reduced-motion-acceptance-showcase.spec.ts` — pointer parked in the Select scenario (browser proof for Dialog/AlertDialog unchanged).

## Gate results (Node 24.13.1, local)

| Gate | Result |
| --- | --- |
| `corepack pnpm lint` | pass |
| `corepack pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `corepack pnpm --filter @beemvp/beeui-showcase typecheck` | pass |
| `corepack pnpm --filter @beemvp/beeui-visual-regression typecheck` | pass (re-run after the spec edits) |
| `corepack pnpm --filter @beemvp/beeui-showcase test` | 126 suites, 1142 tests, all pass |
| Playwright `showcase-integration`: `reduced-motion-acceptance-showcase.spec.ts` + `keyboard-focus-matrix-showcase.spec.ts` | 24/24 pass (Dialog/AlertDialog reduced-motion cases also 3/3 under `--repeat-each=3`) |
| Playwright `desktop-light`: `dialog-alert-dialog-role-uniqueness.spec.ts` (rebuilt 4173 export) | 2/2 pass — still exactly one `dialog` / one `alertdialog` node |
| Playwright `desktop-light`: `date-production.spec.ts` | geometry + all DOM assertions pass; 8 `toHaveScreenshot` at the local font floor (see above), unchanged from before this change |

Servers were reused as the config allows locally (`reuseExistingServer`): showcase gallery-qa export on 4174, visual-regression export on 4173, docs build on 4175 (the docs build completed in a few minutes here, no config change needed).

## Files

- `packages/ui/src/components/dialog.tsx`
- `packages/ui/src/components/dialog-role-watch.ts` (renamed from `alert-dialog-role-watch.ts`)
- `apps/showcase/__tests__/dialog-web-modal-owner.test.tsx`
- `apps/showcase/__tests__/dialog-role-mutation-correction.test.ts` (renamed)
- `apps/visual-regression/tests/date-production.spec.ts`
- `apps/visual-regression/tests/reduced-motion-acceptance-showcase.spec.ts`
- `plans/260919-1258-consumer-audit-followups/reports/ws-n-report.md`

Status: DONE_WITH_CONCERNS
Branch: ws/n-reduced-motion-dialog @ 5e957bf (+ report commit)
Summary: Under reduced motion the Dialog's owner node never received `role` because the animation type flipped fade→none after the first open render and react-native-web's activation never ran; the preference is now read synchronously on Web and BeeUI stamps the owner role itself for both dialog roles, proven in Chromium and Jest. The Select reduced-motion scenario was a pre-existing pointer-overlap artifact at 390px, fixed in the spec.
Concerns: `date-production.spec.ts` PNG comparisons can only be signed off by CI (local font floor); a mid-open OS reduced-motion toggle still leaves react-native-web's internal `isActive` false for that cycle (no user-visible effect, documented in the hook docblock).
