---
name: beeui-adr003-measurement-tick-budget
description: BeeUI ADR-003 watchdog basics + how to verify it fired (dev-only console.warn); the 2026-08-30 iOS reopen failure was NOT the watchdog but a Fabric rendering blank
metadata:
  type: project
---

`packages/ui/src/components/overlay-runtime.tsx` implements ADR-003
(`docs/decisions/003-native-measurement-timeout.md`): anchored overlays arm a
watchdog when `measureInWindow` is scheduled; if the callback misses
`MEASUREMENT_TICK_BUDGET` (2 RAF+macrotask ticks), `onAnchorUnavailable()`
fires and e.g. `Popover` self-closes (`popover.tsx` `handleAnchorUnavailable`).
Tuning the numeric default is owned by #121. Tests hardcode their own
`ADR_BUDGET_TICKS = 2` literal (`overlay-measurement-completion-budget.test.tsx`),
so bumping the source constant desyncs the ADR-locked contract.

**How to verify whether the watchdog actually fired:** it emits a
`__DEV__`-only `console.warn` containing "measurement did not resolve within
its completion budget" (`warnMeasurementUnresponsive`). CI runs a Metro dev
bundle, and iOS `simulator.log` (captured by `ios.sh` on failure) DOES carry
JS console lines — so grep it. Zero hits = the watchdog did NOT fire.

**Correction (2026-08-30, run 33319858948):** an earlier version of this memory
blamed the #126 iOS popover-reopen failure on the ADR-003 tick budget. The
run's artifacts disprove that: zero watchdog warnings, and the video
(`sheet-cases.mp4` ~t400-410s) + `failure.png` show an app-wide Fabric
rendering breakdown on the headless iOS Simulator — after a scroll gesture
whose initiating touch dismissed the Popover (dismiss layer unmounted
mid-gesture while owning the touch), newly-exposed ScrollView content
(plain Cards, no overlay involvement) permanently renders BLANK; Maestro's
hierarchy still reports the invisible views so scroll/tap steps "COMPLETE"
while assertions fail forever. Android runs the identical sequence green.
PR #315 therefore keeps the scroll-gesture dismissal variant Android-only
(android.sh case A6b) and the cross-platform flow uses a tap-variant
outside-press + popover-closed scroll + reopen. See
[[beeui-github-hosted-ci-migration]] and
[[beeui-overlay-dismiss-layer-contract]].

**Status 2026-08-30: #126 PARKED by owner at PR #315 head 934963d** (blocks
nothing; #127/#59 merged with deterministic evidence). Known remaining
failure points at that head (run 33321952665), deliberately NOT fixed:
(1) android-runtime: `scrollUntilVisible` DOWN to
`runtime-stress-scroll-target` times out at 20s (popover flow itself now
green after pixel_7 + keyboard-toggle fixes); (2) ios-runtime: post-scroll
popover reopen still lands on the blank-render (even with the popover
CLOSED during the scroll — so mid-gesture dismiss-layer unmount is NOT the
only trigger; any long Maestro scroll on this screen may blank the headless
sim). Owner is filing the iOS blank-render as its own tracking issue.
