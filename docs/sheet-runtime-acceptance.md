# Sheet native runtime acceptance (#160)

`Sheet` (#157 public API, #158 native `@gorhom/bottom-sheet` adapter per
ADR-006 `docs/decisions/006-sheet-gesture-engine.md`) required a dedicated
runtime-acceptance pass because gesture, keyboard, scroll, and Back behavior
cannot be accepted from compile proof alone. This document records, per
required flow, the strongest evidence class actually obtained
(`docs/beeui-1.0-evidence-classes.md`) and states explicitly which flows
remain deferred rather than generalizing a weaker evidence class into a
stronger claim.

## Why this is deterministic contract evidence, not simulator/device evidence

The repository's Maestro-driven native runtime-smoke suite
(`docs/native-runtime-smoke.md`) cannot currently produce a usable iOS
Simulator run for gesture/overlay interaction: [#349](https://github.com/beobungbu/BeeUI/issues/349)
documents a headless-iOS-Simulator Fabric bug where a scroll/touch gesture
that dismisses an overlay mid-gesture permanently blanks subsequently exposed
content, so every later Maestro assertion fails against dead pixels
regardless of retries. [#126](https://github.com/beobungbu/BeeUI/issues/126)
(the general native overlay-runtime stress smoke) is parked on this exact
bug. Real-device cloud testing — the concrete way around a Simulator-only
bug — was researched
(`plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md`)
and requires an owner decision (BrowserStack OSS-program approval, a paid
tier, or a community device-cloud fork) that has not been made; it is a
parked, explicitly deferred decision, not a task this issue can complete
unilaterally per `docs/agent-execution-contract.md`'s owner-gate rules.

Per `docs/beeui-1.0-evidence-classes.md`'s rule ("always state the strongest
evidence class actually obtained, never the strongest evidence class
desired"), #160 is therefore satisfied with the strongest evidence
obtainable today: deterministic Jest/RNTL contract tests that exercise
BeeUI's own wiring around the `@gorhom/bottom-sheet` seam (present/dismiss
lifecycle, snap-point/index forwarding, reduced-motion mapping, keyboard-mode
mapping, nested-content composition, child-overlay dismiss-scope precedence,
and Android hardware Back) against gorhom's own mocked ref/prop API — the
same seam-testing discipline ADR-006's verification plan already prescribes
for #158. Real native gesture/spring physics, real nested-scroll gesture
arbitration, true keyboard-avoidance geometry, VoiceOver/TalkBack
focus-into-sheet, and RTL mirrored geometry are explicitly **not** claimed
here; they remain deferred until #349 is resolved or a real-device path is
approved.

## Criterion → evidence table

| #160 required flow | Evidence class obtained | Where |
| --- | --- | --- |
| Open/dismiss via trigger | Deterministic contract | `issue-158-sheet-native.test.tsx` (`SheetTrigger` press → `present()`/`dismiss()`) |
| Open/dismiss via backdrop | Deterministic contract | `issue-158-sheet-native.test.tsx` (backdrop press → `onOpenChange`/`closeOnBackdropPress`) |
| Open/dismiss via gesture | Deterministic contract (wiring only) | `issue-158-sheet-native.test.tsx` ("gorhom-initiated dismiss" simulates `onDismiss`, proving BeeUI's own close/re-present handling of a completed gesture). **Real drag/velocity physics: deferred** — native runtime evidence, blocked by #349. |
| Snap/presentation changes | Deterministic contract | `issue-160-sheet-runtime-acceptance.test.tsx` ("snap-point / presentation-change wiring": `snapPoints`/`initialSnapIndex` forwarded to the engine and clamped) |
| Keyboard + focused input | Deterministic contract (mapping + focus) | `issue-160-sheet-runtime-acceptance.test.tsx` ("keyboard-avoidance mapping": `avoidKeyboard` → `keyboardBehavior`/`android_keyboardInputMode`); `issue-158-sheet-native.test.tsx` (text input focus/edit inside the panel). **Real on-screen-keyboard-avoidance geometry: deferred** — native runtime evidence. |
| Long/nested scroll | Deterministic contract (composition only) | `issue-160-sheet-runtime-acceptance.test.tsx` ("nested scrollable content": long list renders end-to-end inside the panel without remounting the engine). **Real nested-scroll gesture arbitration (finger deciding sheet-drag vs. list-scroll): deferred** — this is gorhom's own physics per ADR-006 and requires native runtime evidence. |
| Child overlay | Deterministic contract | `issue-160-sheet-runtime-acceptance.test.tsx` ("child overlay dismiss-scope precedence + Android Back": a `DropdownMenu` nested inside `SheetContent` dismisses first, mirroring `overlay-scope.test.tsx` CASE A/E for Dialog) |
| Android Back | Deterministic contract | `issue-158-sheet-native.test.tsx` (single-level Back) + `issue-160-sheet-runtime-acceptance.test.tsx` (Back with a nested child overlay, then a second Back closing the Sheet itself once the child is gone) |
| Controlled state synchronization | Deterministic contract | `issue-158-sheet-native.test.tsx` ("does not treat our own effect-driven dismiss() as a gorhom-initiated close", controlled/uncontrolled backdrop tests) |
| Reduced motion | Deterministic contract | `issue-160-sheet-runtime-acceptance.test.tsx` ("reduced-motion mapping": ambient `AccessibilityInfo.isReduceMotionEnabled()`/`reduceMotionChanged` forwarded live into `overrideReduceMotion`). **Real absence-of-spatial-animation on device: deferred** — native runtime evidence. |
| RTL | Inherited contract (no new geometry) | `issue-160-sheet-runtime-acceptance.test.tsx` ("RTL / large text": confirms `SheetTitle` uses the logical `pe-8` class, not a physical `pr-8`/`pl-8`). Sheet has one fixed (bottom) edge that RTL does not mirror and reuses the same `Text`/`View` primitives already RTL-accepted by [#141](https://github.com/beobungbu/BeeUI/issues/141) (`issue-141-rtl-overlay-acceptance.test.tsx`) against the shared `resolveDirection` resolver — this is not re-derived from scratch. **Real mirrored-layout rendering on device: deferred** — native runtime evidence, same #349 blocker. |
| Large text | Inherited contract (no new geometry) | Sheet's title/description/handle render through the same `Text`/dynamic-type-aware primitives already exercised by other components' large-text acceptance; Sheet introduces no Sheet-specific text-scaling logic. **Real on-device large-text layout: deferred** — native runtime evidence. |
| VoiceOver/TalkBack focus-into-sheet | Not obtained | Requires assistive-technology evidence on a named real build/runtime (`docs/beeui-1.0-evidence-classes.md`). Deferred alongside #349/real-device gaps; owned by a future assistive-technology acceptance pass (see #147/#148 precedent for VoiceOver/TalkBack scope). |

## Deferral statement

The following remain **explicitly deferred**, not claimed as passing, and not
faked with a mocked substitute for the actual behavior:

- real `@gorhom/bottom-sheet` drag/spring/velocity-completion physics;
- real nested-scroll gesture arbitration (`ScrollView`/`FlatList` inside a
  draggable sheet deciding whether a touch belongs to the list or the sheet);
- real on-device keyboard-avoidance geometry;
- real mirrored RTL layout and real on-device large-text layout;
- VoiceOver/TalkBack focus-into-sheet and background-hidden-from-AT behavior.

These require a real iOS Simulator/Android Emulator or physical device.
[#349](https://github.com/beobungbu/BeeUI/issues/349) blocks the existing
Maestro-driven Simulator path for exactly this class of gesture/overlay
interaction; real-device cloud testing is a researched, owner-gated decision
that has not been made
(`plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md`).
When #349 is resolved or a real-device path is approved, re-run the deferred
flows above against this same exact-head contract-test suite and record the
result here rather than opening a new acceptance document.
