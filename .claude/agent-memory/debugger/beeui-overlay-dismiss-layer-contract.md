---
name: beeui-overlay-dismiss-layer-contract
description: Any touch outside an open Popover/Select/DropdownMenu content hits OverlayDismissLayer (closeOnOutsidePress default true) - it closes the overlay AND swallows the touch; Maestro flows must never tap "through" it
metadata:
  type: project
---

BeeUI anchored overlays (Popover/DropdownMenu/Select,
`packages/ui/src/components/*.tsx`) render `OverlayDismissLayer` — a
full-screen absolute-fill `Pressable` above app content — while open
(`closeOnOutsidePress` defaults to true). Consequences for tests/flows:

- Tapping ANY other element while such an overlay is open (e.g. a Dialog's
  input under an open child Popover) lands on the layer: the overlay closes
  by contract and the touch is SWALLOWED — the intended target never
  receives it. Proven by CI run 33319858948 (Android): #126's original
  keyboard stress tapped the dialog input expecting the child popover to
  survive; it can never pass.
- To exercise keyboard-raise while an overlay stays open, drive focus
  programmatically from INSIDE the overlay content (PR #315: a toggle button
  in the popover calls `inputRef.focus()/blur()`; an in-popover
  `keyboard: shown|hidden` Text makes the evidence non-vacuous).
- The touch that STARTS a scroll gesture outside content is also an
  outside-press: the layer unmounts mid-gesture. On Android emulator this is
  fine; on the headless iOS CI Simulator it triggers a permanent Fabric
  rendering blank of the whole ScrollView (see
  [[beeui-adr003-measurement-tick-budget]] correction) — keep that variant
  Android-only in runtime smokes.
