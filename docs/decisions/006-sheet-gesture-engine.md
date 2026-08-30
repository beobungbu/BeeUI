# ADR-006: Sheet/BottomSheet gesture engine and dependency strategy

Status: Accepted

## Context

[#156](https://github.com/beobungbu/BeeUI/issues/156) (R4B.1, parent
[#114](https://github.com/beobungbu/BeeUI/issues/114)) requires BeeUI to choose its
Sheet/BottomSheet implementation strategy before #157 (public API), #158 (native
implementation), #159 (Web implementation), #160 (dedicated native runtime acceptance),
and #161 (registry/package dependency closure) can execute. `docs/roadmap.md:203-212`
and `docs/beeui-1.0-sequence.md:74-80` fix this exact chain and mark R4B "hard 1.0."

Today BeeUI has no Sheet component and no gesture-physics dependency anywhere in the
tree:

- A repo-wide search for `sheet`/`bottom-sheet`/`gorhom` under `packages/ui/src` finds
  no implementation; every existing reference is either the unrelated `StyleSheet` API
  or a documented **placeholder boundary**. `docs/anchored-overlays.md:178-180` states:
  "A future first-class `Sheet` component remains a separate behavior class (gestures,
  snap points, scrolling, keyboard, accessibility). This is distinct from using RN
  Modal's `pageSheet`/`formSheet` presentation for `DialogContent`." `docs/components.md:204-206`
  repeats the same boundary: "`Sheet` remains separately gated because gesture,
  snap-point, keyboard, safe-area, scrolling, hardware-back, and accessibility behavior
  need stronger native runtime verification than a centered modal."
- `packages/ui/package.json`'s `peerDependencies`/`devDependencies` contain no
  `react-native-reanimated` and no `react-native-gesture-handler` (verified by direct
  read of the file). A repo-wide search for `reanimated`, `gesture-handler`,
  `PanResponder`, and `Animated\.` under `packages/ui/src` returns no matches. BeeUI's
  only existing native animation mechanism is React Native's built-in `Animated` API,
  wrapped by `resolveMotion`/`resolveNativeMotion` (`docs/motion.md`).
- `docs/motion.md:96-119` already fixes a "Reduced-motion contract": every animated
  intent declares exactly one policy (`immediate` / `opacity-or-state` / `shorten` /
  `remove-spatial`), BeeUI "adds **no** motion/preference store," and reads the
  ambient reduced-motion signal directly
  (`AccessibilityInfo.isReduceMotionEnabled()` native, `prefers-reduced-motion` Web) —
  the same "read, don't own a second state engine" shape ADR-004 (direction) already
  established for RTL. Today `overlay-enter`/`overlay-exit`/`disclosure` are the only
  assigned intents; no `sheet-*` intent exists yet.
- `docs/architecture.md:96-100` ("Styling engine boundary") already carves out exactly
  this class of problem: "Hot-path UI may bypass [Uniwind] when evidence warrants:
  gesture-driven interactions, high-frequency animations... Those paths may use
  `StyleSheet.create` and Reanimated while preserving BeeUI contracts." Gesture-driven,
  Reanimated-class UI is therefore already an accepted BeeUI escape hatch in principle;
  #156 is the first issue that must decide the concrete dependency shape for it.
- `apps/showcase/app.json` sets `"newArchEnabled": true` today, and
  `docs/architecture.md:183-191` (Overlay portal transport) already routes native
  transport through `react-native-teleport` specifically for "native New Architecture
  with registered host." BeeUI's only currently-shipping native runtime target is New
  Architecture (Fabric); there is no legacy-architecture row in
  `docs/compatibility-matrix.md`.
- `docs/registry-cli.md:112-147` (Dependency resolution) already has a working,
  tested mechanism for optional, per-item external package reporting:
  `react-dom`, `react-native-safe-area-context`, and `react-native-teleport` are
  "only reported for items that resolve the `overlay-runtime`/`safe-area`/`toast`
  utilities... plain components never pull them in." Any Sheet-only dependency can
  reuse this exact mechanism without inventing a new one.
- `docs/compatibility-matrix.md`'s rule (from #129): "If a combination cannot be
  tested, narrow the public promise instead of documenting hope." No
  `react-native-reanimated`/`react-native-gesture-handler`/`@gorhom/bottom-sheet` row
  exists yet in that matrix; this ADR decides the dependency *shape*, not the exact
  tested version pins, which remain owned by #158/#161 per that file's own process.

## Constraints

- **Platform**: iOS, Android (bare RN + Expo, New Architecture) and Web (Expo
  Web/`react-native-web`) must all get a coherent Sheet, but native gesture-drag
  physics and Web pointer/keyboard interaction are not the same problem and do not
  need the same engine.
- **Ownership invariant (from #156's own default direction and
  `docs/agent-execution-contract.md:75` "no duplicate theme, overlay, focus,
  direction, or state authority")**: BeeUI owns the public Sheet API, controlled/
  uncontrolled state contract, accessibility semantics, and its own tests. It does not
  need to own low-level drag/spring physics implementation when a proven, actively
  maintained option exists and no evidence shows a conflict with BeeUI contracts.
- **No new BeeUI-wide motion/preference store**: any Sheet engine choice must compose
  with, not replace or duplicate, `docs/motion.md`'s existing reduced-motion contract
  and its "read the ambient signal, own no store" rule.
- **Dependency boundary**: any new runtime dependency must be **optional** (consumers
  who never render `Sheet` must not be forced to install it), matching the existing
  `react-dom`/`react-native-safe-area-context`/`react-native-teleport` optional-peer
  pattern already in `packages/ui/package.json` and already reportable per-item by the
  registry CLI (`docs/registry-cli.md:112-147`).
- **Source-ownership registry**: whatever is chosen must fit the existing registry
  transitive-dependency-resolution and platform-split (`*.native.tsx`/`*.web.tsx`)
  conventions without inventing a new resolution mechanism.
- **Distribution**: BeeUI packages remain private during `0.x`
  (`docs/architecture.md:223-227`); this ADR adds no dependency to any manifest and
  changes no `peerDependencies` range — that is #161's job.
- **Accessibility**: keyboard, nested-scroll gesture arbitration, safe-area insets,
  reduced motion, and VoiceOver/TalkBack focus-into-sheet are correctness requirements
  (`docs/agent-execution-contract.md:78`, `docs/beeui-1.0-review-checklist.md:38-51`),
  not optional polish.
- **Support-matrix discipline**: any new dependency needs its own
  `docs/compatibility-matrix.md` row with an honestly stated evidence class before it
  can be promised publicly; this ADR does not itself add or widen that matrix.
- **Non-goal**: this ADR does not design the public `Sheet`/`BottomSheetContent` API
  surface (#157), does not implement any runtime code, does not pin exact tested
  dependency versions (#158/#161), and does not perform native/Web runtime acceptance
  (#160).

## Options considered

### Option A — Optional `@gorhom/bottom-sheet` native adapter, BeeUI-owned Web implementation

- **Design summary**: `Sheet`'s public API (open/close, controlled/uncontrolled,
  snap points, accessibility props, keyboard/safe-area policy) is defined once by
  BeeUI (#157) and implemented per platform. `sheet.native.tsx` wraps
  `@gorhom/bottom-sheet`'s `BottomSheet`/`BottomSheetModal` as an internal
  implementation detail behind BeeUI's own ref/prop contract; the gesture/spring
  physics, snap-point math, and nested-scroll gesture arbitration are gorhom's, not
  BeeUI's. `@gorhom/bottom-sheet`, `react-native-reanimated`, and
  `react-native-gesture-handler` are declared as **optional** peer dependencies
  (`peerDependenciesMeta.optional: true`, mirroring `react-dom` today), reported by
  the registry CLI only for the `sheet` entry and its transitive dependents, exactly
  like `react-native-teleport`/`react-native-safe-area-context` today
  (`docs/registry-cli.md:145`). `sheet.web.tsx` does **not** use gorhom at all; it
  reuses BeeUI's existing Web overlay contract — `overlay-transport.web.tsx`'s
  `ReactDOM.createPortal` transport, the Dialog/Modal CSS kernel, and Uniwind
  transitions — with pointer/keyboard interaction (Escape, backdrop click, focus
  trap) instead of native-style drag-to-dismiss gesture physics.
- **Benefits**: BeeUI never reimplements spring physics, snap-point resolution,
  velocity-based gesture completion, or nested-scroll gesture arbitration (FlatList/
  ScrollView/SectionList inside a draggable sheet) — a large, easy-to-get-subtly-wrong
  surface that `@gorhom/bottom-sheet` has hardened across real apps for years.
  `@gorhom/bottom-sheet` already integrates with `react-native-safe-area-context`
  (already a BeeUI peer dependency) for bottom-inset padding, so no second safe-area
  mechanism is introduced. It ships an `overrideReduceMotion` seam and
  keyboard-aware behaviors (`BottomSheetTextInput`/keyboard-avoiding container) that
  cover the hard parts of #156's evaluation list directly. Because
  `apps/showcase/app.json` already runs `newArchEnabled: true` and BeeUI's overlay
  transport already assumes New Architecture (`docs/architecture.md:187-188`), the
  New Architecture requirement of `@gorhom/bottom-sheet` v5 + Reanimated v3 + Gesture
  Handler v2 is not a new burden, it matches BeeUI's existing native target exactly.
  Because the dependency is optional and per-item reported, consumers who never add
  `sheet` never install Reanimated/Gesture Handler/gorhom, preserving the "plain
  components never pull them in" property the registry already guarantees for other
  optional externals.
- **Risks/tradeoffs**: introduces three new transitive runtime dependencies (gorhom +
  Reanimated + Gesture Handler) to the dependency graph for the first time in this
  monorepo; each needs its own `docs/compatibility-matrix.md` row with real evidence
  before any public claim is made (owned by #158/#161, not this ADR). Reanimated's
  worklet/JSI boundary occasionally breaks across its own major versions (the search
  evidence below shows an open, tracked migration for Reanimated v4 support in
  gorhom's own repo); BeeUI must pin a specific tested combination, not float ranges,
  until real evidence justifies widening (same discipline `docs/compatibility-matrix.md`
  already applies to React/RN/Tailwind/Uniwind). BeeUI's `resolveMotion`/
  `resolveNativeMotion` (`docs/motion.md`) do not drive gorhom's own Reanimated-based
  open/close spring; that spring is a scoped, deliberate exception under the already-
  accepted "gesture-driven interactions... may use... Reanimated" carve-out
  (`docs/architecture.md:100`), not a second general-purpose motion engine — but it
  must be documented as exactly that scoped exception (see Implementation
  consequences) so it is not mistaken for permission to add Reanimated elsewhere.
- **Web/iOS/Android implications**: iOS/Android native gesture physics and nested-
  scroll arbitration are gorhom's; Web is BeeUI's own existing overlay contract with
  no drag-to-dismiss gesture parity claimed for 1.0 (pointer users get close
  button/backdrop/Escape, consistent with `Dialog`'s existing Web behavior and with
  the existing Select precedent of not adding "a Bottom Sheet dependency" for Web
  parity it does not need, `docs/components.md:196`).
- **Dependency/package/registry impact**: three new optional peer dependencies, gated
  to the `sheet` registry entry and its dependents only; no change to any other
  component's required-dependency set; fits the existing optional-peer-reporting
  mechanism without new registry machinery.
- **Accessibility/RTL/large-text/reduced-motion impact**: BeeUI still owns and asserts
  its own accessibility contract (role, modal semantics, focus movement/restoration,
  labels) on top of gorhom's focus-into-sheet/background-hiding behavior, the same way
  BeeUI owns Dialog's accessibility contract on top of RN's `Modal`; gorhom's
  `overrideReduceMotion` is driven by BeeUI's own already-resolved reduced-motion
  signal (`AccessibilityInfo.isReduceMotionEnabled()`), not a second preference
  read — no new motion/preference store is introduced. Large-text/RTL follow the
  same logical-direction/dynamic-type contracts already established (ADR-004,
  `docs/dynamic-type.md`) applied to Sheet's own content, independent of the engine
  choice.
- **Migration/semver impact**: purely additive — a new component, no change to any
  existing public API.
- **Testing/runtime evidence required**: deterministic tests for BeeUI's own public
  API/state contract (controlled/uncontrolled, accessibility prop emission) against a
  test double for gorhom's ref API, the same seam discipline already used for other
  native modules; bundle/compile evidence (Expo prebuild + iOS/Android native compile)
  once the dependency is actually added to a consuming target; dedicated native
  runtime evidence (#160) for drag/snap/keyboard/nested-scroll/safe-area/VoiceOver/
  TalkBack; Web interaction evidence (#159) for BeeUI's own Web implementation.
- **Selected.**

### Option B — BeeUI-owned minimal gesture engine (hand-rolled `PanResponder`/`Animated`, no third-party gesture library)

- **Design summary**: BeeUI implements its own drag/snap/velocity-completion physics
  natively using RN's built-in `PanResponder`/`Animated` (or a hand-rolled minimal
  Reanimated+Gesture-Handler pair written from scratch), with no dependency on
  `@gorhom/bottom-sheet`.
- **Benefits**: zero new third-party gesture-library dependency; full control over
  every line of physics code.
- **Risks/tradeoffs**: directly contradicts #156's own stated default direction
  ("BeeUI owns semantics/API/tests, not physics for its own sake"). Reimplements a
  large, easy-to-get-wrong surface — velocity-based snap resolution, multi-snap-point
  interpolation, nested-scroll gesture arbitration (deciding whether a vertical drag
  belongs to the sheet or to a `FlatList`/`ScrollView` inside it), keyboard-aware
  repositioning, and safe-area-aware bounds — that `@gorhom/bottom-sheet` has already
  hardened across a large real-world install base. `PanResponder`-only physics cannot
  credibly hit smooth native drag/spring behavior at the quality bar BeeUI's other
  overlay work already holds itself to (`docs/decisions/003-native-measurement-timeout.md`,
  `docs/native-runtime-smoke.md`); a credible from-scratch implementation would still
  need Reanimated + Gesture Handler as primitives to be competitive, which means this
  option does not even avoid the two heaviest new dependencies — it only discards the
  one dependency (gorhom itself) that already assembles them into tested behavior,
  while taking on all of the physics-correctness and native-runtime-verification risk
  itself. This would consume a large share of #158/#160's implementation and native
  runtime acceptance budget re-deriving behavior that already exists and is proven,
  with no BeeUI-specific requirement identified that gorhom cannot satisfy.
- **Web/iOS/Android implications**: same three-platform burden as Option A but with
  BeeUI as the sole author of native gesture correctness instead of an established,
  externally-tested library.
- **Dependency/package/registry impact**: smallest dependency count (possibly zero if
  hand-rolled on `PanResponder`/`Animated` only) but at the cost noted above; if
  Reanimated + Gesture Handler are still adopted as primitives, the dependency count
  matches Option A anyway, minus the one dependency that reduces BeeUI's own
  maintenance burden.
- **Accessibility/RTL/large-text/reduced-motion impact**: BeeUI would need to build
  its own keyboard-avoidance and nested-scroll-arbitration accessibility behavior from
  zero, with no external evidence base, raising the risk of the exact runtime-gesture
  defects `docs/agent-execution-contract.md`'s "async/runtime paths must cover stale
  callbacks... failure states" and `docs/beeui-1.0-review-checklist.md`'s "gesture/
  scroll/keyboard interaction" review line are meant to catch.
- **Migration/semver impact**: same as Option A (additive), but higher long-term
  maintenance cost carried entirely by BeeUI.
- **Testing/runtime evidence required**: full native-runtime gesture/physics
  regression suite would need to be built from scratch by BeeUI itself, rather than
  BeeUI's own tests being scoped to its API/semantics layer while trusting an
  externally-tested physics engine underneath.
- **Rejected.**

### Option C — Adopt `@gorhom/bottom-sheet` (or equivalent) for Web as well, as a single cross-platform engine

- **Design summary**: Use `@gorhom/bottom-sheet`'s own Web/DOM-based implementation
  (available since its v5 rewrite) for the Web target too, instead of BeeUI's own
  existing Web overlay contract, so native and Web share one engine end-to-end.
- **Benefits**: one implementation to reason about instead of two; potential
  drag-to-dismiss gesture parity on Web pointer input if desired later.
- **Risks/tradeoffs**: introduces a **second, competing Web modal/portal/animation
  implementation** alongside BeeUI's own already-proven Web overlay contract
  (`ReactDOM.createPortal` transport + Dialog/Modal CSS kernel + Uniwind transitions,
  already exercised by `Dialog`/`Popover`/`DropdownMenu`/`Select` and covered by
  Chromium Playwright evidence per `docs/web-accessibility-audit.md`/
  `docs/visual-regression.md`). This is exactly the "no duplicate... overlay...
  authority" pattern `docs/agent-execution-contract.md:75` and
  `docs/beeui-1.0-review-checklist.md:25` ("No duplicate theme/overlay/focus/
  direction/state runtime") forbid. Search evidence shows gorhom's Web/DOM support is
  recent (introduced in the v5 rewrite) with actively-fixed issues (React 19's removal
  of `findNodeHandle` needing a v5.1.3+ fix; gesture `preventDefault` errors on web
  fixed in v5.1.5+; `BottomSheetFlashList` still not working on Web) — materially
  weaker evidence than BeeUI's own already-CI-proven Chromium Web contract. It would
  also force `react-native-reanimated`/`react-native-gesture-handler` onto every Web
  bundle that renders `Sheet`, even though BeeUI's Web target has no equivalent native
  touch-gesture requirement (Web users already get close button/backdrop/Escape
  parity from BeeUI's existing Dialog contract, and #156's own default direction does
  not ask for native-identical drag-gesture parity on Web).
- **Web/iOS/Android implications**: native unaffected (same as Option A); Web gains a
  second overlay engine with less mature, still-evolving support.
- **Dependency/package/registry impact**: forces Reanimated/Gesture Handler onto the
  Web dependency graph as well as native, widening the optional-dependency surface for
  no BeeUI-identified Web requirement.
- **Accessibility/RTL/large-text/reduced-motion impact**: risks two divergent
  accessibility implementations for the same semantic contract (BeeUI's own Dialog-
  style focus/ARIA handling vs. gorhom's own Web focus/ARIA handling), increasing the
  chance of drift instead of the single coherent contract `docs/beeui-1.0-review-
  checklist.md` requires.
- **Migration/semver impact**: same as Option A, but with strictly higher integration
  risk for no identified benefit.
- **Rejected**: violates the no-duplicate-overlay-authority invariant without any
  BeeUI-specific requirement Option A's BeeUI-owned Web implementation cannot already
  satisfy.

## Decision

BeeUI 1.0 adopts **Option A**: a platform-split Sheet architecture where BeeUI owns
the public API, accessibility contract, and tests end-to-end, and delegates native
gesture/spring physics to an **optional** `@gorhom/bottom-sheet` adapter, while Web
reuses BeeUI's own existing, already-proven overlay contract with no gorhom
dependency at all.

### Ownership split

1. **Public API/semantics (#157) — 100% BeeUI-owned, both platforms.** Open/close
   state (controlled/uncontrolled), snap-point contract, accessibility props
   (role/label/modal semantics/focus restoration), keyboard policy, and safe-area
   contract are defined once by BeeUI and are platform-neutral at the API boundary.
   No part of the public contract exposes gorhom's own ref/prop shape directly.
2. **Native engine (#158) — optional `@gorhom/bottom-sheet` adapter.**
   `sheet.native.tsx` wraps `@gorhom/bottom-sheet`'s `BottomSheet`/`BottomSheetModal`
   internally. `@gorhom/bottom-sheet`, `react-native-reanimated`, and
   `react-native-gesture-handler` become **optional** peer dependencies of
   `@beeui/ui`, declared with `peerDependenciesMeta.optional: true` exactly like
   `react-dom` today, and reported by the registry CLI only for the `sheet` entry and
   anything that transitively depends on it — no other component's dependency set
   changes.
3. **Web engine (#159) — BeeUI-owned, no gorhom dependency.** `sheet.web.tsx` reuses
   the existing `overlay-transport.web.tsx` (`ReactDOM.createPortal`) and Dialog/Modal
   CSS/Uniwind kernel already proven for `Dialog`/`Popover`/`DropdownMenu`/`Select`.
   Web 1.0 scope does not claim native-style drag-to-dismiss gesture parity; pointer
   users get backdrop click, Escape, and an explicit close affordance, consistent with
   `Dialog`'s existing Web behavior.
4. **Reduced motion — composed, not duplicated.** Sheet's native open/close spring is
   a scoped, deliberate use of the already-accepted "gesture-driven interactions...
   may use... Reanimated" carve-out in `docs/architecture.md:100` (Styling engine
   boundary) — it is not a general license to add Reanimated to other BeeUI
   components. `docs/motion.md` gains new `sheet-enter`/`sheet-exit` (and, if #157's
   API needs it, a drag-in-progress) intents in its policy table as part of #157/#158,
   each mapped through the existing four-value reduced-motion policy vocabulary. The
   native adapter's `overrideReduceMotion` seam is driven by BeeUI's own already-read
   `AccessibilityInfo.isReduceMotionEnabled()` signal — BeeUI still "adds no
   motion/preference store," per `docs/motion.md:113-115`; it only forwards an
   already-resolved value into gorhom's existing seam, the same read-and-forward shape
   ADR-004 established for RTL.
5. **Safe area — reused, not reinvented.** The native adapter is configured to use
   BeeUI's existing `react-native-safe-area-context` peer dependency for bottom-inset
   padding rather than introducing a second safe-area mechanism.
6. **Accessibility — BeeUI asserts its own contract on top of the engine.** BeeUI's
   own component code sets and tests the accessibility role/label/modal-semantics/
   focus-restoration contract, the same way `Dialog` owns its accessibility contract
   on top of RN's `Modal` today; gorhom's built-in focus-into-sheet/background-hiding
   behavior is a starting point, not a substitute for BeeUI's own assertions.

### Dependency shape (not final version pins)

This ADR fixes the **shape**: three new **optional** peer dependencies
(`@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`),
gated to the `sheet` registry entry only. It does **not** add any dependency to any
manifest, and it does not pin exact tested versions — per `docs/compatibility-
matrix.md`'s rule, exact tested pins are decided when #158 implements against a real
build and #161 closes the registry/package dependency chain, each adding its own
honestly-scoped compatibility-matrix row.

## Rejected alternatives

- **Option B (BeeUI-owned minimal gesture engine)**: rejected — contradicts #156's own
  default direction, reimplements a large already-solved and already-hardened physics
  surface with no identified BeeUI-specific requirement gorhom cannot satisfy, and
  would likely still require Reanimated + Gesture Handler as primitives anyway,
  meaning it does not even reduce the dependency footprint — only the correctness
  confidence.
- **Option C (gorhom for Web too)**: rejected — introduces a second, less-mature,
  actively-evolving Web overlay/animation authority alongside BeeUI's own already-CI-
  proven Web overlay contract, directly violating the no-duplicate-overlay-authority
  invariant, for no identified Web requirement Option A's BeeUI-owned Web
  implementation cannot already satisfy.
- **A hard (non-optional) `@gorhom/bottom-sheet` dependency**: rejected without
  discussion as its own option — it would force Reanimated + Gesture Handler onto
  every BeeUI consumer and every bundle (including Web, where they are not needed at
  all under Option A), breaking the existing optional-peer pattern
  (`react-dom`/`react-native-safe-area-context`/`react-native-teleport`) that the
  registry CLI's per-item dependency reporting already depends on.

## Implementation consequences

- **#157 (public Sheet API)** must define the controlled/uncontrolled open/snap-point
  contract, accessibility props, and keyboard/safe-area policy platform-neutrally,
  without leaking gorhom's own ref/prop shape into the public surface, and must add
  the `sheet-enter`/`sheet-exit` (and any drag-related) intents to `docs/motion.md`'s
  reduced-motion policy table.
- **#158 (native implementation)** must: add `@gorhom/bottom-sheet`,
  `react-native-reanimated`, and `react-native-gesture-handler` as optional peer
  dependencies of `@beeui/ui`; wire `overrideReduceMotion` to BeeUI's existing
  `AccessibilityInfo.isReduceMotionEnabled()` read; configure the adapter against
  BeeUI's existing `react-native-safe-area-context` peer; assert BeeUI's own
  accessibility contract on top of gorhom's defaults; and add the first
  `docs/compatibility-matrix.md` rows for the three new dependencies with an honestly
  stated evidence class, not an aspirational one.
- **#159 (Web implementation)** must implement `sheet.web.tsx` on BeeUI's existing
  `overlay-transport.web.tsx`/Dialog CSS kernel, with no `@gorhom/bottom-sheet`,
  Reanimated, or Gesture Handler dependency, and no native-style drag-to-dismiss
  parity claimed for 1.0.
- **#160 (dedicated native runtime acceptance)** must obtain real iOS Simulator/
  Android Emulator (and, where feasible, device) evidence for drag/snap-point
  completion, nested-scroll gesture arbitration (a `FlatList`/`ScrollView` inside the
  sheet), keyboard interaction, safe-area insets, reduced-motion behavior, and
  VoiceOver/TalkBack focus-into-sheet — none of which may be inferred from
  deterministic/compile evidence alone, per `docs/beeui-1.0-evidence-classes.md`.
- **#161 (registry/package dependency closure)** must add the `sheet` registry entry
  with the three new dependencies reported only for `sheet` and its dependents (no
  change to any other entry's reported requirements), and must keep
  `docs/compatibility-matrix.md` synchronized per its own machine-checked drift rule.
- **`docs/architecture.md`'s "Styling engine boundary"** should be read, going
  forward, as already covering this specific Reanimated/Gesture-Handler carve-out for
  Sheet; no separate architecture-doc edit is required by this ADR beyond the
  `docs/motion.md` intent-table addition #157/#158 must make.
- No existing public component's API, dependency set, or bundle size changes as a
  result of this ADR; the entire dependency addition is scoped to the new `sheet`
  registry entry.

## Verification plan

- **Deterministic contract evidence**: unit/RNTL tests for BeeUI's own public Sheet
  API (controlled/uncontrolled state, `onChange`/snap-index callbacks, accessibility
  prop emission, reduced-motion intent selection) against a test double for gorhom's
  ref API — BeeUI does not re-test gorhom's own internal physics, only its own
  contract and the seam between them.
- **Bundle/compile evidence**: Expo prebuild + iOS/Android native compile once
  `@gorhom/bottom-sheet`/Reanimated/Gesture Handler are actually added to a consuming
  target (Showcase), extending the existing `ci.yml` native-compile jobs.
- **Native runtime evidence** (#160): iOS Simulator/Android Emulator (Maestro,
  matching the existing `docs/native-runtime-smoke.md` pattern) proving drag-to-snap
  completion, velocity-based dismissal, nested-scroll gesture arbitration, keyboard
  interaction, non-zero safe-area inset padding, and reduced-motion behavior (open
  state reached without spatial animation when the OS signal is set).
- **Assistive-technology evidence**: VoiceOver/TalkBack focus-into-sheet, background
  hidden-from-AT while open, and restoration on close, on a named build/runtime.
- **Browser interaction evidence** (#159): Playwright coverage of BeeUI's own Web
  Sheet implementation — open/close, Escape, backdrop click, focus trap/restoration —
  using the existing Chromium harness.
- **Support-matrix evidence**: first `docs/compatibility-matrix.md` rows for
  `@gorhom/bottom-sheet`, `react-native-reanimated`, and `react-native-gesture-handler`
  stating the strongest evidence class actually obtained, added by #158/#161 in the
  same change that introduces the dependency, per that file's existing drift-check
  discipline.
- This ADR itself ships no code; the plan above is the acceptance bar for #157–#161,
  not for this document. This PR's own self-test is ADR/docs-only.

## Revisit trigger

Revisit this ADR if any of the following become true with concrete evidence:

- Real #158/#160 implementation work finds a concrete, reproducible conflict between
  `@gorhom/bottom-sheet` (or its Reanimated/Gesture Handler dependencies) and a BeeUI
  contract — for example, an unresolvable conflict with the existing overlay-runtime
  portal/dismiss-stack kernel, the modal-local anchored-geometry contract
  (`docs/architecture.md:201-203`), or the New Architecture Fabric transport BeeUI
  already depends on — that Option A cannot accommodate without compromising a
  BeeUI invariant.
- `@gorhom/bottom-sheet`'s Web/DOM implementation matures to a point where a future,
  separately-scoped decision finds a concrete BeeUI requirement (e.g., proven,
  evidence-backed demand for native-style drag-to-dismiss gesture parity on Web) that
  BeeUI's own existing Web overlay contract cannot satisfy — that would be its own new
  ADR, not a reopening of this one on spec alone.
- Reanimated's own major-version migration (v3 → v4, tracked upstream) lands in a way
  that breaks the pinned combination before gorhom ships compatible support, requiring
  a version-pin decision that belongs to #158/#161's compatibility-matrix process, not
  a re-litigation of the engine choice itself.
- A future audit finds BeeUI has silently grown a second general-purpose Reanimated
  usage outside the scoped Sheet carve-out this ADR documents, which would require
  either formalizing Reanimated as a general BeeUI escape hatch (its own ADR) or
  correcting the drift back to this ADR's scoped boundary.
