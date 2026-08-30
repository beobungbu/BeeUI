# ADR-005: Tooltip product contract

Status: Accepted

## Context

BeeUI 1.0 (#114) has three shipped anchored-overlay components — `Popover`, `DropdownMenu`,
and `Select` — all built on the same accepted kernels: the pure `@beeui/core` geometry
resolver (`resolveAnchoredOverlayPosition()`), the `@beeui/ui` overlay runtime
(`overlay-runtime.tsx`: portal transport, scope/dismiss stack, latest-request-wins
measurement with the ADR-003 completion budget), and the direction resolver
(`use-direction.ts`, ADR-004). `docs/anchored-overlays.md` and ADR-002
(`docs/decisions/002-overlay-behavior.md`) already name `Tooltip` as a future anchored
component that "must add its own semantic contract rather than becoming a visual alias of
DropdownMenu" — but no product contract exists yet. `docs/roadmap.md` (`# R4A — Tooltip`)
sequences `#151 (this ADR) → (#152 Web + #153 native) → #154 regression matrix → #155
export/registry`, and states #151 "uses runtime contract #120–#125 + direction foundation
#139" — i.e., R3 **foundation** policies, not final R3 cross-component acceptance
(#141/#142/#146–#150 run after Tooltip exists, per `docs/beeui-1.0-sequence.md`).

Every existing anchored component is **interactive**: `PopoverContent` renders
`role="dialog"`, supports `PopoverClose`, and dismisses via `OverlayDismissLayer` (an
outside-press-capturing backdrop, `popover.tsx:278-284`); `DropdownMenuContent` and
`SelectContent` add keyboard-navigable, activatable items. None of the three is a template
for content whose entire purpose is a short, transient, non-interactive text annotation
tied to a trigger's meaning. Without an explicit contract, an implementation agent
building #152/#153 would have to guess: whether Tooltip opens on press (like Popover) or
hover/focus; whether it needs the outside-press dismiss layer; whether its content can
contain buttons/links; and how a floating, portaled bubble is supposed to reach assistive
technology on native, where there is no RN equivalent of `aria-describedby`.

## Constraints

- **Platform**: iOS, Android (bare RN + Expo), and Web (Expo Web / `react-native-web`) must
  share one public API. Native has no mouse-hover concept and no native
  `aria-describedby`-equivalent relationship API; Web has both. The contract must be
  platform-honest (per `docs/agent-execution-contract.md`) rather than force an identical
  interaction model where the platforms genuinely differ.
- **Reuse, don't duplicate, existing kernels**: this ADR must not introduce a new geometry
  resolver, a second portal/runtime, or a second direction read. It reuses
  `resolveAnchoredOverlayPosition()`, the existing `@beeui/ui` overlay runtime
  (`useAnchoredOverlayPosition`, `useOverlayId`, `OverlayPortal`, `useOverlayDismissable`),
  and `resolveDirection()`/`useDirection()` (ADR-004) exactly as `Popover`/`DropdownMenu`
  already do.
- **Foundation-only sequencing (per #151/roadmap)**: this ADR may rely on #139 (direction),
  #143 (Dynamic Type policy, `docs/dynamic-type.md`), and #145 (Web a11y harness policy,
  `docs/web-accessibility-audit.md`) as already-accepted foundation policies. It must not
  assume final cross-component RTL/keyboard/VoiceOver/TalkBack acceptance (#141/#142/
  #146-#148), which runs after #154.
- **Accessibility (WCAG 1.4.13 "Content on Hover or Focus")**: any hover/focus-triggered
  content that BeeUI ships must be dismissible, hoverable, and persistent (not
  auto-timed-out) if it is not already dismissible by other trivial means. This applies
  directly to Tooltip and is a correctness constraint, not a nice-to-have.
- **Non-goal**: this ADR does not implement `Tooltip`, does not add it to the public
  package export surface or component registry, and does not perform final RTL/keyboard/
  VoiceOver/TalkBack sweeps. It is the contract #152 (Web) and #153 (native) implement
  against; #154 is the regression matrix; #155 is export/registry/docs.
- **Non-goal**: this ADR does not design a generic "hover card" / rich-content popover
  API. That use case is already served by `Popover`; Tooltip's contract intentionally
  excludes it (see Decision).
- **Non-goal**: this ADR does not add a new semantic motion or timing token to
  `packages/tokens`. Open/close delay is interaction timing, not a `packages/tokens`
  animation intent (`docs/motion.md` covers enter/exit transition curves only, not
  pre-open hover delay); a numeric prop default is sufficient at this stage.

## Options considered

### Option A — Tooltip as a thin `Popover` preset (shared `PopoverContent`, different default props)

- **Design summary**: `Tooltip`/`TooltipTrigger`/`TooltipContent` become renamed
  re-exports of `Popover`/`PopoverTrigger`/`PopoverContent` with different defaults
  (`role="tooltip"`, no `PopoverClose`, `closeOnOutsidePress` off).
- **Benefits**: minimal new code; automatically inherits Popover's tested dismiss/geometry
  behavior.
- **Risks/tradeoffs**: `PopoverContent` opens on `Pressable`/press-toggle
  (`PopoverTrigger`'s `onPress` flips `open`, `popover.tsx:155-158`) — wrong interaction
  model for a hover/focus-revealed annotation, and there is no built-in hover-delay,
  hover-out debounce, or focus-triggered-without-delay behavior. `PopoverContent` also
  defaults `role="dialog"` and supports arbitrary interactive children
  (`PopoverClose`, buttons) — exactly the "distinct from menu/select" boundary #151
  requires BeeUI *not* to blur. Reusing the same content component would make it
  structurally possible (and likely, by copy-paste) for a future consumer to put
  interactive content in a `TooltipContent`, silently violating WCAG's tooltip-content
  expectations and the issue's own "distinct from menu/select" requirement.
- **Web/iOS/Android implications**: does not solve the native accessible-relationship gap
  (no `aria-describedby` equivalent) — `Popover`'s accessibility wiring is designed around
  a `role="dialog"` surface with its own title/description, not a `role="tooltip"`
  description-only relationship.
- **Dependency/package/registry impact**: smallest diff, but a same-shaped public API
  that reads as "another Popover," muddying the two components' actual behavioral
  contracts.
- **Accessibility/RTL/large-text/reduced-motion impact**: negative — inherits dialog
  semantics and outside-press dismissal that do not match the WAI-ARIA tooltip pattern
  (`role="tooltip"` + `aria-describedby`, no focus trap, no backdrop).
- **Rejected**: collapses two genuinely different behavior classes (interactive disclosure
  vs. non-interactive annotation) into one component, contradicting the issue's explicit
  "distinct from menu/select" requirement and ADR-002/`docs/anchored-overlays.md`'s
  existing statement that Tooltip "must add its own semantic contract."

### Option B — New `Tooltip`/`TooltipTrigger`/`TooltipContent` composition, reusing the anchored-overlay kernels but with its own trigger/dismiss/accessibility semantics

- **Design summary**: a new, small composition mirroring `Popover`'s file shape
  (context + trigger + content) but with its own trigger-event contract (hover + focus
  show; hover-out + blur + Escape hide, all through open/close delays), no outside-press
  dismiss layer, `role="tooltip"` (Web) / merged trigger `accessibilityHint` (native), and
  an explicit non-interactive-content constraint. Reuses
  `resolveAnchoredOverlayPosition()`, `useAnchoredOverlayPosition()`, `OverlayPortal`,
  `useOverlayId()`, and `useDirection()`/`resolveDirection()` exactly as accepted.
  `useOverlayDismissable()` is reused only for the Escape-key path, not for outside-press
  capture (no `OverlayDismissLayer`).
- **Benefits**: correct interaction model (hover/focus, not press-toggle); correct
  accessibility relationship per platform; content is structurally simple (no
  `TooltipClose`, no arbitrary interactive-child slot) so the non-interactive constraint
  is enforced by the shape of the API, not just documentation; identical public shape
  across Web/native (same component names/props), matching #151's "one coherent public
  API" requirement; no new runtime/portal/geometry authority.
- **Risks/tradeoffs**: genuinely new interaction code (hover/focus/delay state machine)
  that does not exist in any current component — `dropdown-menu.tsx`/`select.tsx` use
  `onHoverIn`/`onFocus` only to move a *keyboard/mouse highlight* within an already-open
  menu, not to open/close an overlay on hover; this ADR must specify that state machine
  precisely enough that #152/#153 do not diverge. Native has no hover; the touch-trigger
  path (long-press) and the "does the bubble even need to render for a screen-reader user
  to get the text" question must be decided explicitly (see Decision).
- **Web/iOS/Android implications**: platform-honest — Web gets real hover; native gets
  long-press-to-reveal plus an assistive-technology path that does not depend on the
  bubble rendering at all.
- **Dependency/package/registry impact**: new small internal composition and (later, in
  #155) new public exports; no new runtime dependency.
- **Accessibility/RTL/large-text/reduced-motion impact**: positive — enables a
  WCAG-1.4.13-conformant hover/focus content contract that does not exist anywhere in
  BeeUI today, and a native accessible-name/hint path independent of visual
  presentation.
- **Migration/semver impact**: purely additive; no existing component's contract changes.
- **Testing/runtime evidence required**: deterministic unit/RNTL tests for the open/close
  delay state machine (fake timers), hover-to-content-without-closing (hoverable),
  Escape-dismiss without pointer/focus movement (dismissible), and no
  auto-timeout-driven close (persistent); Web Playwright evidence for
  `role="tooltip"`/`aria-describedby` wiring and real mouse hover; native
  simulator/device evidence for long-press reveal and VoiceOver/TalkBack reading the
  merged hint — deferred to #152/#153/#154 per sequencing, not this ADR.
- **Selected.**

### Option C — Tooltip content always accompanies the trigger in the accessibility tree (no portal; render inline, hidden, and reveal with `display`/`opacity` toggling under the trigger's own subtree)

- **Design summary**: skip the anchored-overlay runtime entirely; render `TooltipContent`
  as a sibling of the trigger inside the same layout subtree, positioned with plain
  absolute offsets instead of measured anchor geometry, so the native accessibility tree
  naturally keeps content and trigger adjacent without any relationship API.
- **Benefits**: avoids the native accessible-relationship problem by never separating
  content from trigger in the tree; no portal/runtime/measurement involvement.
- **Risks/tradeoffs**: reintroduces exactly the per-component reimplementation problem
  BeeUI's anchored-overlay layer exists to prevent (`docs/anchored-overlays.md`, "Layer 1
  — geometry kernel"): no collision/flip/shift, no cross-scroll-container correctness, no
  reuse of the already-accepted, tested `resolveAnchoredOverlayPosition()`. Clipping by an
  ancestor's `overflow: hidden`/`ScrollView` is a real, common failure mode this approach
  cannot solve without duplicating the portal runtime anyway. Contradicts ADR-002's
  explicit instruction that `Tooltip` "must reuse these kernels rather than approximating
  anchored UI" with a different mechanism.
- **Web/iOS/Android implications**: would need a second, parallel positioning
  implementation distinct from every other anchored component's, doubling maintenance
  surface for RTL/flip/shift/viewport-collision correctness.
- **Rejected**: violates the explicit reuse constraint (ADR-002, `docs/anchored-overlays.md`)
  and the "no new portal/theme/state engine" DoD line in #151 itself — Option C is not
  literally a new engine, but it is a second, parallel *positioning* mechanism doing the
  same job the accepted kernel already does, for no accessibility benefit that Option B's
  merged-hint approach does not already provide without the tradeoffs.

## Decision

BeeUI 1.0 adopts **Option B**: `Tooltip`/`TooltipTrigger`/`TooltipContent`, a new
composition built on the existing anchored-overlay kernels, with its own hover/focus
trigger contract, its own dismiss policy, and its own per-platform accessibility wiring.
Tooltip is a **non-interactive contextual disclosure** — it exists to attach a short,
supplementary description to a trigger. It is not a click-to-open menu, not a
persistent-until-explicit-close panel, and its content may not contain focusable or
actionable elements. Any use case needing interactive content, longer-lived content, or
click-to-open behavior uses `Popover`.

### Composition and public API

```
<Tooltip>
  <TooltipTrigger>...</TooltipTrigger>
  <TooltipContent>Short description</TooltipContent>
</Tooltip>
```

- **`Tooltip`** — provider-only composition root, mirroring `Popover`'s shape. Holds
  open state and the anchor ref; renders no DOM/native view of its own.
- **`TooltipTrigger`** — wraps a `Pressable`-based child (same `assignRef`/ref-merge
  pattern as `PopoverTrigger`) and attaches the hover/focus/long-press listeners defined
  below. It does **not** toggle open state on `onPress` the way `PopoverTrigger` does;
  tapping/clicking the trigger does not open or close the tooltip by itself (pressing
  is reserved for the trigger's own action, e.g. an icon button's click handler — a
  tooltip must never intercept or block the trigger's primary interaction).
- **`TooltipContent`** — the anchored, portaled bubble. Renders `children` as its only
  content slot (no `TooltipTitle`/`TooltipDescription`/`TooltipClose` subcomponents —
  Tooltip content is a single short block of text/inline content, not a structured
  document; components needing a title/description/close affordance are `Popover`, not
  Tooltip). `TooltipContent` accepts primarily text-like children; a first-render
  `__DEV__` check (mirroring `Popover`'s existing `__DEV__` warnings, e.g.
  `popover.tsx:104-109`) warns when a rendered child is itself a `Pressable`/`Button`/
  `TextInput`-family element, since interactive content violates the non-interactive
  contract; it does not attempt to strip or block such content at runtime (BeeUI does
  not silently mutate consumer trees).

### Controlled / uncontrolled / no `defaultOpen`-driven persistence

- Same controlled/uncontrolled shape as `Popover`: `open` + `onOpenChange` for
  controlled, `defaultOpen` for uncontrolled, `onOpenChange` optional in the uncontrolled
  case, delayed-parent-update handling identical to `PopoverContent`'s existing
  `useEffect` reconciliation (`popover.tsx:112-114`).
- Unlike `Popover`, `defaultOpen: true` on mount is **discouraged but not blocked** — a
  tooltip that is open before any hover/focus event has no anchor interaction to
  attribute the disclosure to. This ADR does not forbid it (some controlled test/story
  scenarios need it) but #152/#153 must not add special-case logic to make an
  always-open tooltip a first-class supported pattern; it is a controlled-mode
  consequence, not a designed feature.

### Trigger events and default timing semantics

Two independent trigger channels, matching the WAI-ARIA APG tooltip pattern's show
triggers (hover, focus) plus a native touch equivalent:

| Channel | Platform | Opens on | Closes on |
| --- | --- | --- | --- |
| Pointer hover | Web (mouse/trackpad) | `onHoverIn` after `openDelay` | `onHoverOut` after `closeDelay`, unless the pointer moved onto `TooltipContent` itself (hoverable, see below) |
| Keyboard/programmatic focus | Web + native (external keyboard, Switch Control, AT focus navigation) | `onFocus`, **no `openDelay`** | `onBlur`, immediately (no `closeDelay`) |
| Long-press | Native touch (iOS/Android) | `onLongPress`, no additional `openDelay` beyond the platform's own long-press recognition | Release/touch-end after a fixed reveal window, or the next tap elsewhere |

- **`openDelay`** (default **500 ms**) applies only to the hover channel. Focus opens
  immediately: a keyboard user tabbing through controls must not wait through an
  artificial delay to get the same information a mouse user eventually sees, and the
  WAI-ARIA APG explicitly treats focus as an immediate-reveal trigger distinct from
  hover.
- **`closeDelay`** (default **300 ms**) applies only to the hover-out path, and exists
  solely to let a pointer travel from the trigger to the content bubble (e.g. to select
  displayed text) without the tooltip closing mid-transit — this is the **hoverable**
  requirement of WCAG 1.4.13. Focus-out (blur) closes without a delay, matching the
  immediate-open contract on the same channel.
- **Escape** closes an open tooltip without requiring the pointer or focus to move —
  the **dismissible** requirement of WCAG 1.4.13. This reuses `useOverlayDismissable()`'s
  existing Escape/accessibility-escape wiring (as `PopoverContent` already does via
  `onAccessibilityEscape`), but `TooltipContent` does **not** register an
  `OverlayDismissLayer` (no outside-press capture) — a tooltip is not modal and must
  never block interaction with content underneath it. Tapping/clicking anywhere other
  than the content simply lets the existing hover/focus/blur logic close it naturally.
- **No auto-close timeout.** Once open (via any channel), a tooltip stays open until an
  explicit close path above fires — never on a bare `setTimeout` that fires regardless of
  continued hover/focus. This is the **persistent** requirement of WCAG 1.4.13.
- `openDelay`/`closeDelay` are plain numeric-millisecond props, not `packages/tokens`
  motion-intent values (see Constraints, non-goal) — they gate *when* a show/hide begins,
  not the enter/exit transition curve itself, which may separately reuse the existing
  `overlay-enter`/`overlay-exit` motion intents (`docs/motion.md`) if `TooltipContent`
  animates, exactly as other overlays already may.

### Placement/alignment via the shared anchored-overlay runtime

`TooltipContent` calls `useAnchoredOverlayPosition()` exactly as `PopoverContent` does,
with different defaults appropriate to a small annotation bubble:

- default `placement="top"`, `align="center"` (vs. Popover's `bottom`/`center`) — a
  tooltip conventionally appears above its trigger unless flipped for viewport
  collision;
- `flip`/`shift`/`collisionPadding`/`sideOffset`/`alignOffset` exposed with the same
  names, types, and defaults as `PopoverContentProps` for consistency across BeeUI's
  anchored components;
- `direction` resolved via `resolveDirection()` (ADR-004) exactly as `PopoverContent`
  does (`direction = resolveDirection()`), so RTL alignment-flip is correct by
  construction without Tooltip inventing its own read;
- `avoidKeyboard` defaults to `false` (a tooltip is not expected to coexist with an
  active text-input keyboard the way a `Select`/form popover might; consumers needing it
  may still pass it explicitly since the prop is threaded through unchanged).

### Accessible relationship semantics

- **Web**: `TooltipContent` renders with `role="tooltip"` (never `role="dialog"`). The
  resolved trigger element carries `aria-describedby` pointing at `TooltipContent`'s
  `nativeID`, mirroring how `PopoverContent` already computes and forwards a stable ID
  (`contentNativeID`, `popover.tsx:102`) — but using `aria-describedby` (a *description*
  relationship) rather than `aria-labelledby` (a *naming* relationship, already used by
  `Select`/`DropdownMenu` triggers via `aria-controls`/expanded state). This is
  deliberate: a tooltip supplements a trigger's existing accessible name, it does not
  replace or define it.
- **Native (iOS/Android)**: there is no reliable, cross-platform RN equivalent of
  `aria-describedby` that lets VoiceOver/TalkBack traverse from a focused trigger to a
  separately portaled floating view's text. BeeUI does not invent one. Instead,
  `TooltipTrigger` merges the resolved tooltip content's text into the trigger's own
  `accessibilityHint` (following the same `accessibilityHint ?? <derived text>` merge
  pattern `PopoverContent` already uses for its own description, `popover.tsx:290`) —
  **unconditionally**, independent of whether `TooltipContent` is currently open/rendered.
  This means a VoiceOver/TalkBack user gets the supplementary text every time they land
  on the trigger, whether or not they ever trigger the visual reveal (which, on native, a
  screen-reader user driven purely by swipe navigation may never do, since there is no
  hover and swipe navigation does not "focus" in the `onFocus` sense granted to external
  keyboards/Switch Control).
- This is the ADR's explicit **native-visible vs. accessibility-only policy boundary**:
  the visual bubble (`TooltipContent` actually rendering/measuring/positioning) and the
  accessibility announcement (the merged `accessibilityHint`) are two independent
  delivery paths on native. The visual bubble is a native-visible progressive
  enhancement for sighted touch/keyboard/Switch-Control users who do trigger
  long-press/focus; the accessibility announcement is unconditional and does not depend
  on the bubble ever mounting. On Web, the two paths converge (the `aria-describedby`
  relationship only resolves to real content when `TooltipContent` is mounted, exactly
  like `Popover`'s existing `accessibilityLabelledBy`/`accessibilityHint` gating on
  `open`), because Web assistive technology and pointer/keyboard users share the same
  DOM and the visible-reveal gating is itself the accepted Web convention (WAI-ARIA APG).

### Interaction / non-interaction constraints (summary)

- `TooltipContent` must not contain focusable or actionable elements; violating this is a
  dev-time warning, not a runtime block (see Composition above).
- `TooltipTrigger` never intercepts the wrapped element's own `onPress`/primary action;
  Tooltip is strictly additive to whatever interaction the trigger already performs.
- No outside-press dismiss layer, no focus trap, no modal backdrop — Tooltip is never
  converted into, or layered behind, an `OverlayDismissLayer`/RN `Modal`.
- Only one tooltip may reasonably be open per pointer/focus position; this ADR does not
  add cross-tooltip coordination beyond what the existing per-scope dismiss stack already
  provides (each `TooltipContent` registers under the nearest `OverlayScope` exactly like
  `Popover`).

## Rejected alternatives

- **Option A (Tooltip as a `Popover` preset)**: rejected — collapses two different
  behavior classes into one component, contradicting the issue's "distinct from
  menu/select" requirement and ADR-002/`docs/anchored-overlays.md`'s existing statement
  that Tooltip needs its own semantic contract. Reusing `PopoverContent` verbatim would
  also make interactive tooltip content structurally easy to introduce, the opposite of
  what this ADR locks down.
- **Option C (inline, non-portaled positioning to sidestep the native accessibility
  gap)**: rejected — reintroduces a second, parallel positioning mechanism instead of
  reusing the accepted `resolveAnchoredOverlayPosition()`/runtime kernel, contradicting
  ADR-002's explicit reuse instruction, for an accessibility benefit already delivered by
  the merged-`accessibilityHint` approach in Option B without that cost.
- **Deriving the trigger's `accessibilityLabel` from tooltip content by default**:
  considered and rejected as a default. A tooltip is a *description* relationship
  (`aria-describedby`/merged hint), not a *naming* one; auto-promoting it to the
  trigger's name would silently change a consumer's existing accessible name whenever
  they add a `Tooltip`, and would make an icon-only button's name depend on hover-only
  content that a screen-reader-first flow might not even mount (native). Consumers that
  genuinely have no other accessible name for a trigger must still set
  `accessibilityLabel`/`aria-label` explicitly; Tooltip only supplements it.
- **A single shared `openDelay`/`closeDelay` applied uniformly to hover and focus**:
  rejected — would either force keyboard users to wait through a hover-tuned delay to see
  a description already visible to mouse users, or force hover close to be instant and
  defeat the diagonal-mouse-travel allowance WCAG 1.4.13's "hoverable" requirement exists
  for. Splitting the two delays per channel is the only combination that satisfies both.
- **A `packages/tokens` timing token for `openDelay`/`closeDelay`**: deferred, not
  rejected outright — today's `docs/motion.md` vocabulary covers enter/exit transition
  curves, not pre-open interaction delay, and Tooltip is BeeUI's first component needing
  the latter. Introducing a token for a single component's single numeric default would
  be speculative; if a second component later needs the same delay concept, that
  becomes its own scoped tokens decision with real evidence of reuse.

## Implementation consequences

- **#152 (Web behavior)** implements `Tooltip`/`TooltipTrigger`/`TooltipContent` per this
  contract for Web: `role="tooltip"`, `aria-describedby`, hover/focus/blur/Escape wiring
  with the specified delays, reusing `useAnchoredOverlayPosition()`/`OverlayPortal`/
  `useDirection()`. It depends on #151 (this ADR) + #125 (final runtime hardening lane) +
  #139/#140 (direction foundation/audit) + #145 (Web a11y harness) per
  `docs/beeui-1.0-sequence.md`, and must add its Web interaction scenario(s) to the
  reusable a11y harness (`apps/visual-regression/src/a11y-scenarios.ts`,
  `docs/web-accessibility-audit.md:77`).
- **#153 (native policy/behavior)** implements the same public component names/props for
  iOS/Android: long-press reveal, merged `accessibilityHint`, no `aria-describedby`
  equivalent attempted. It depends on #151 + #139 (direction) + #143 (Dynamic Type
  policy — Tooltip's short-text content must survive the audited stress levels in
  `docs/dynamic-type.md`) and explicitly does not wait for final VoiceOver/TalkBack
  release matrices (#147/#148).
- **#154 (deterministic/browser/native regression matrix)** is responsible for pinning:
  the open/close delay state machine (fake-timer-driven, per
  `docs/agent-execution-contract.md`'s "avoid arbitrary sleeps" rule); hoverable
  (pointer travel from trigger to content does not close it); dismissible (Escape closes
  without pointer/focus movement); persistent (no auto-timeout close); focus opens
  without delay and closes on blur without delay; RTL alignment-flip via the existing
  `direction` resolution (reusing the already-accepted geometry tests' pattern, no new
  geometry code); and the native merged-hint path being unconditional on render state.
- **#155 (export/registry/docs/Showcase/AI integration)** adds `Tooltip` to the public
  package export surface, component registry, and AI/docs metadata once #152–#154 are
  green; per `docs/beeui-1.0-integration-discipline.md`, final shared exports/registry
  integration across R4 lanes (#155/#161/#170/#178) is serialized.
- No existing component's public API or default behavior changes as a result of this
  ADR; it defines a new component's contract only.

## Verification plan

This ADR itself ships no code; it is the accepted contract #152/#153 implement against
and #154 pins with regression evidence. This PR's own self-test is ADR/docs-only.

- **Deterministic contract evidence** (#154): fake-timer unit/RNTL tests for the
  open/close delay state machine per channel (hover-with-delay, focus-without-delay,
  blur-without-delay, hover-out-with-delay), hoverable/dismissible/persistent behavior,
  and direction-aware alignment reusing the existing `resolveAnchoredOverlayPosition()`
  RTL contract (no new geometry logic to test — only that `TooltipContent` passes
  `direction` through correctly, mirroring `PopoverContent`'s existing wiring).
- **Browser interaction evidence** (#152/#154): Playwright coverage for real mouse
  hover-in/out timing, keyboard focus/blur, Escape dismissal, and `role="tooltip"`/
  `aria-describedby` presence in the accessibility tree; a Web a11y-harness scenario
  (#145's harness) covering at least one representative `Tooltip` instance.
  Traceability note for the reviewer: at ADR-acceptance time #145's own issue is closed
  as a foundation policy, but the actual `a11yScenarios` entry for Tooltip is added by
  #152/#154, not by this ADR.
- **Native runtime evidence** (#153/#154): iOS Simulator and Android Emulator evidence
  for long-press reveal, and VoiceOver/TalkBack confirmation that the merged
  `accessibilityHint` is announced when focusing/selecting the trigger, independent of
  whether the visual bubble was ever triggered.
- **Dynamic Type evidence** (#153, per #143 fixtures): `TooltipContent` text audited at
  the four canonical stress levels (`docs/dynamic-type.md`) without truncation policy
  violations for short annotation text.

## Revisit trigger

Revisit this ADR if any of the following become true with concrete evidence:

- A shipped consumer demonstrates a real, reproducible need for interactive content
  inside a tooltip-shaped disclosure (e.g. a "Learn more" link) that `Popover` cannot
  serve ergonomically — that would be evidence for a distinct third anchored-component
  contract, not a reason to loosen Tooltip's non-interactive constraint.
- Native runtime evidence (#153) shows the merged-`accessibilityHint` approach is
  insufficient for a real VoiceOver/TalkBack flow (e.g. hint text is truncated, not
  announced, or conflicts with an existing consumer-provided hint) — that would require
  a new native accessible-relationship mechanism, an owner/ADR-level decision, not a
  workaround baked into #153.
- A second component after Tooltip needs the same `openDelay`/`closeDelay` concept,
  providing concrete reuse evidence for promoting it from a plain numeric prop default to
  a `packages/tokens` semantic timing value.
- Real product evidence shows the chosen default delays (500 ms open / 300 ms close) are
  measurably wrong (e.g. accessibility audit findings, or user-testing evidence of
  premature/late reveal) — defaults may be tuned by #152/#153/#154 with that evidence
  without reopening the overall contract.
