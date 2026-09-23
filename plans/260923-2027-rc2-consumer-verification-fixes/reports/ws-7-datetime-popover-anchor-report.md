# WS7: DateTimePicker popover detached from its below-the-fold trigger

Branch `ws7-datetime-popover-anchor` (from `6b73f92` on `fix/rc2-consumer-verification`),
worktree `/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-abc30672945a7f758`.

## Symptom

`date-production.spec.ts` › "DateTimePicker opens its bounded Calendar and time controls in a
Popover" (desktop-light) failed `expectPopoverAdjacentToTrigger` with gap 34 > 24. It reproduced
locally: the popover's top was at viewport y=8 and its bottom 34px above the trigger.

## Root cause (measured, then traced to code)

I instrumented the fixture in Chromium (desktop 1280×800):

- `#root` and the root overlay host `beeui-overlay-host` are both 800px tall at the top of the
  document. The fixture content (scrollHeight 1298) overflows them.
- The DateTimePicker trigger is at document y=1008. Playwright's click scrolls the page by 498px
  before it presses, so the trigger lands at viewport y=510..554. Focus causes no further scroll
  (`preventScroll` from 00c9ef8 works). The scroll comes from reaching the trigger, which is what
  a user does too.
- After that scroll the host's window rect is `{y: -498, height: 800}`, which is only on screen
  from y=0 to y=302. The trigger is below that.

In the code path:

1. `packages/ui/src/components/overlay-runtime.tsx` (pre-fix L1233-1238, L1244-1246): the
   collision viewport is the nearest host's rect, and `getSafeAreaCollisionPadding(hostRect,
   windowRect, …)` clips it to the window.
2. `packages/core/src/utils/overlay-runtime.ts:160`: `top = safeTop - host.y` = 498. With the
   default `collisionPadding` of 8, the bounds come out as y=8..294, a 286px strip that does not
   contain the trigger.
3. `packages/core/src/utils/anchored-overlay.ts:212` (`clampAxis`): `if (size >= span) return
   min`. Any overlay at least 286px tall is pinned to the strip's top edge, y=8. The flip chooses
   `top`, and the shift then overrides the flipped coordinate.

So the popover's top is always at y=8 and its bottom is at `8 + height`. The gap to the trigger
is `510 - 8 - height`: 14px for the old 488px content (passed) and 34px for the new 468px content
(failed). Placement never depended on the popover's height or on the trigger. The old baseline
passed only because 488px happened to land within 24px.

Underlying defect: the Web root host is a DOM box in document flow. It moves with document scroll
and does not clip its absolutely positioned children. Its rect was still used as the collision
viewport, so once the page scrolls (or the app root is shorter than the window) that viewport is
just the part of the host still on screen.

## Fix

`packages/ui/src/components/overlay-runtime.tsx` `useAnchoredOverlayPosition` (L1235-1266): when
the scope is the root host (`ROOT_OVERLAY_HOST`) and the transport is `web-dom`, the collision and
safe-area rectangle is `windowRect` (the browser window). Rendering still translates by the
measured host origin (`position = windowPosition - hostRect`), so the popover stays in document
space and scrolls with its trigger. Behaviour is unchanged in these cases:

- modal-local scopes (Dialog/Sheet hosts), which still collide against their host;
- native, which still collides against the host;
- the common Web case where the host covers the window, where `host ∩ window === window` and the
  result is the same.

On the fixture the popover now flips above the trigger at y=34, a gap of 8 (the default
`sideOffset`). The spec's thresholds are unchanged.

`docs/anchored-overlays.md` (scope model, "Geometry") documents the Web root-scope exception.
`llms:check` passes and none of the generated llms output inlines that sentence.

## Regression check

- New fixture `?fixture=popover-scrolled-anchor&contentHeight=N` in `apps/visual-regression/App.tsx`.
  The app root is one viewport tall, the content overflows it, and the Popover trigger is only
  reachable by scrolling. The panel has no padding, so its height is `contentHeight + 2`.
- New spec `apps/visual-regression/tests/popover-scrolled-anchor.spec.ts` (desktop-light). It
  scrolls the trigger to viewport y=520, opens the popover, and asserts that the trigger did not
  move, that both boxes are inside the viewport, and that the gap is 8±1 on the expected side. It
  runs five content heights: 96 and 180 (below), 360, 468 and 488 (flip above). 468 and 488 are
  the two real DateTimePicker heights.
- Without the fix (fix reverted, fixture rebuilt), all 5 fail. Gaps: -338 and -422 (overlapping
  the trigger), then 150, 42 and 22. The 488px case would even pass the old ≤24 tolerance, which
  shows the same coincidence as the original. With the fix, all 5 pass.

## Verification (local macOS, Node 24.13.1, pnpm 10.15.0, Chromium via Playwright 1.62.1)

I used a temporary local Playwright config (port 4273, plus a showcase server on 4174) to avoid
another worktree's server on 4173. I deleted it before committing.

- `date-production.spec.ts`, all 8 canonical projects: geometry passes everywhere, including the
  previously failing test. Against the committed Linux PNGs, pixel comparisons fail on macOS
  because the fonts differ, as expected. See the screenshot section below.
- Canonical projects for `popover-scrolled-anchor`, `tooltip-fixture`, `tooltip-high-contrast`,
  `select-bare-route-pointer-pick`, `select-field-label`, `visual` (includes `popover-open` and
  `dropdown-menu-open`) and `sheet-backdrop-covers-viewport-with-short-root`: pass.
- `showcase-integration` and `showcase-acceptance-smoke`, all specs (includes
  `date-picker-showcase`, `date-time-picker-showcase`, `overlay-context`,
  `overlay-rtl-showcase`, `calendar-accessibility-showcase`, `select-*-showcase`,
  `tooltip-showcase` and `sheet-showcase`): 150/150 pass. `select-overflowing-list-mouse-pick`
  also passes once the showcase server is up.
- `apps/showcase` jest: suites matching `overlay|popover|date|anchor|select|tooltip|dropdown|sheet|dialog`
  58/58 (475 tests), full suite 146/146 (1259 tests).
- `packages/ui` typecheck, `apps/visual-regression` typecheck, `pnpm lint`, `llms:check`,
  `hygiene:check`, `docs:contract:check`, `docs:public-truth:check`, `docs:foundation:check`: pass.

## Screenshot baselines (not regenerated)

I captured every committed screenshot assertion before the fix: date-production, dataviz-brands,
high-contrast-focus, density, scoped-preview, table-production and visual, across the 8 canonical
projects. That gave 127 PNGs on this machine. I then compared the fixed build against those
captures on the same machine. All 127 are pixel-identical.

The only PNG that changes is:

- `apps/visual-regression/tests/__screenshots__/date-production--open-date-time-picker--light--desktop.png`.
  The popover now sits 8px above the trigger in the scrolled document instead of pinned to the
  viewport top. It had to be regenerated anyway for the SegmentedControl height change. It needs
  regenerating on the canonical Ubuntu 24.04 runner.

The new spec adds no PNGs.

## Out of scope / notes

- The root `OverlayDismissLayer` is still an absoluteFill of the same host box. On a Web page
  scrolled past the root, an outside press below that box does not reach the dismiss layer. This
  is pre-existing and not changed here.
- Jest cannot exercise this path: its transport resolves to the native/legacy implementation even
  when a test sets `Platform.OS = 'web'`, which is why I keyed the fix on the `web-dom` transport.
  The Playwright spec is the regression proof.
- `segmented-control.tsx` is untouched.
