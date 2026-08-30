# Accessibility documentation contract

BeeUI 1.0 issue [#150](https://github.com/beobungbu/BeeUI/issues/150). This document is
the consolidated accessibility contract for the current public `@beeui/ui` component
surface: what each component guarantees for roles/states, labels/descriptions, keyboard
behavior, iOS/Android/Web differences, RTL, Dynamic Type/large text, reduced motion, and
assistive-technology (AT) expectations, plus the exact evidence that backs each claim and
the known limitations that do not yet have evidence.

This document does not introduce new component behavior. It consolidates and cross-checks
claims already made in per-axis contracts (`docs/keyboard-focus-acceptance-matrix.md`,
`docs/web-accessibility-audit.md`, `docs/dynamic-type.md`, `docs/motion.md`,
`docs/decisions/004-direction-architecture.md`) and in `docs/components.md`, and adds the
per-component sections those documents do not (each axis document is cross-cutting by
design; no single document previously listed all nine dimensions per component).

## Evidence-honesty rule for this document

Per `docs/agent-execution-contract.md` and `docs/beeui-1.0-evidence-classes.md`, this
document states the strongest evidence class actually obtained for each claim, never the
strongest evidence class desired. Concretely:

- A claim backed only by a deterministic Jest/RNTL assertion (React Native props/roles in
  a mocked renderer) is labeled **deterministic contract evidence** — it proves the
  component *requests* the right semantics, not that a real screen reader announces them
  correctly.
- A claim backed by a real Chromium Playwright interaction (`apps/visual-regression`) is
  labeled **browser interaction evidence** — Web only, does not generalize to native.
- A claim backed by real VoiceOver/TalkBack interaction on a named build is labeled
  **assistive-technology evidence** — as of this document, **no component in this
  repository has that evidence class recorded**. See "Native screen readers" below.

## Cross-cutting axes: canonical source and status

| Axis | Canonical document | Tracking issue | Status | Strongest evidence class obtained |
| --- | --- | --- | --- | --- |
| Keyboard & focus (cross-cutting matrix) | `docs/keyboard-focus-acceptance-matrix.md` | #146 | Closed | Browser interaction (Playwright, real keydown/focus, never `.focus()`/synthetic `onKeyDown`) |
| Web automated accessibility (axe-core) | `docs/web-accessibility-audit.md` | #145 | Closed | Browser interaction (axe-core over real Showcase scenarios) |
| Dynamic Type / font scaling | `docs/dynamic-type.md` | #143 | Closed | Deterministic contract + browser interaction (Web) + native runtime (Android emulator, real OS font-scale) |
| Reduced motion | `docs/motion.md` § "Reduced-motion contract" | #149 | **Open** — no cross-cutting acceptance matrix yet | Deterministic contract (`Animated` spy) + browser interaction (`motion-reduced.spec.ts`, one representative fixture); per-component reduced-motion assertions exist only where an individual component's own test suite added one (see "Known gaps" below) |
| RTL / logical direction | `docs/decisions/004-direction-architecture.md` (ADR-004, accepted) | #141 (overlay acceptance), #142 (component stress matrix) | **Both open** — no cross-cutting acceptance matrix yet | Deterministic contract (`use-direction.ts` precedence, `logical-direction.test.tsx`) + browser interaction (per-component Playwright specs — see the per-component sections below); RTL is implemented and exercised, but there is no single consolidated matrix document the way #146 exists for keyboard |
| VoiceOver (iOS) | — | #147 | **Open** | None recorded (see "Native screen readers") |
| TalkBack (Android) | — | #148 | **Open** | None recorded (see "Native screen readers") |
| Localization / long-content stress | — | #144 | **Open** | Not evaluated by this document |

Do not read the "Closed" rows above as claiming certification beyond what each canonical
document itself states — each already documents its own known gaps and this document does
not relax them.

## Guarantees that apply to the whole component set

These are enforced by shared conventions and, where noted, by regression tests that scan
`packages/ui/src/components/*`, not per-component opt-in:

- **No component disables platform text scaling.** `allowFontScaling={false}` is banned
  repo-wide and enforced by `apps/showcase/__tests__/dynamic-type-contract.test.tsx`
  (`docs/dynamic-type.md`).
- **No component owns a second RTL/theme/motion state engine.** Direction, theme, and
  motion preferences are read from the platform's own authority
  (`I18nManager`/`document.dir`, Uniwind scope, `prefers-reduced-motion`/
  `AccessibilityInfo.isReduceMotionEnabled()`) and forwarded, never duplicated into a
  BeeUI-owned store (ADR-004, `theme-scope.tsx`, `docs/motion.md`).
- **Disabled/loading states are real, not visual-only.** `Button`, `Chip`,
  `SegmentedControlItem`, `PaginationItem`, `StepperItem`, and form controls fail safe to a
  disabled/skippable state (both for pointer and for keyboard/AT) rather than only dimming
  color (`docs/components.md`).
- **`VisuallyHidden` is the only sanctioned way to keep non-interactive content in the
  accessibility tree while removing it from visual layout**; it is documented as never a
  substitute for labeling an interactive control (`docs/components.md`).
- **Form labeling is centralized in `Field`/`Label`**, which generate stable label
  `nativeID` metadata and propagate it to `Input`/`Textarea`, preserving explicit caller
  overrides (`apps/showcase/__tests__/accessibility-readonly.test.tsx`). `FormGroup` does
  not fake a generic ARIA `group`/`fieldset` role RN does not expose; only components with
  a real RN group role (`RadioGroup` → `radiogroup`) consume that context (`docs/
  components.md` § "Form grouping accessibility policy").
- **Decorative elements are hidden from the accessibility tree**, not merely
  visually de-emphasized: `Breadcrumb` separators, `DropdownMenuSeparator`, `Separator`
  (default), loading spinners paired with `aria-busy` on `Button` — never a redundant
  second announcement (`apps/showcase/__tests__/issue-276-structural-status-a11y.test.tsx`).
- **Live-region/announcement components are explicit, not implicit.** `AlertBanner`
  (Android live-region + iOS `AccessibilityInfo` announcement) and `FormMessage` (polite
  live region by default) are the only components that announce without a direct user
  action; `Toast` announces through its own runtime with the same policy family
  (`docs/toast.md`).

## Per-component accessibility notes

Every stable component in `docs/components.md`'s Foundation table has at least a
deterministic-contract-level accessibility test. Components with meaningfully complex
accessibility surfaces get their own subsection below; components whose surface is fully
covered by the "Guarantees" section above (pure layout/typography/data-display primitives
with no interaction — `Box`, `Stack`/`HStack`/`VStack`, `Card`, `Badge`, `Avatar`,
`Skeleton`, `Stat*`, `Timeline*`, `EmptyState`/`ErrorState`, `MetadataRow`/
`DescriptionList`/`DescriptionItem`) are intentionally not repeated here; see
`docs/components.md` for their contract.

### Tooltip

Non-interactive contextual disclosure — never a click-to-open menu (ADR-005,
`docs/decisions/005-tooltip-contract.md`; full contract in `docs/components.md` §
"Tooltip contract").

- **Roles/states**: Web `role="tooltip"`; native has no floating-bubble role (the bubble is
  hidden from the accessibility tree on native — see below).
- **Labels/descriptions**: Web — gated `aria-describedby` on the trigger, present only
  while content is mounted. Native — no `aria-describedby` equivalent, so the relationship
  is a merged `accessibilityHint` registered on the trigger unconditionally; an explicit
  consumer-provided `accessibilityHint` is never overwritten.
- **Keyboard**: never a Tab stop (`tabIndex={-1}` Web); Escape dismisses; opens
  immediately on focus, closes immediately on blur (hover has `openDelay`/`closeDelay`,
  focus/blur never do). Evidence: `tooltip-fixture.spec.ts`, `keyboard-focus-acceptance-
  matrix.md`.
- **iOS/Android/Web differences**: Web opens on hover-in/focus; native has no hover, so it
  opens on long-press (immediate) and closes after a fixed reveal window on release; focus
  (external keyboard/Switch Control) behaves like Web on both platforms.
- **RTL**: shares the same anchored-overlay geometry/direction resolver as
  Popover/DropdownMenu/Select (`use-direction.ts`); remains operable under
  `document.dir = 'rtl'` (`tooltip-showcase.spec.ts` "remains operable when the document
  direction is RTL").
- **Dynamic Type/large text**: no enter/exit transition, no fixed-height clipping risk
  specific to Tooltip; inherits the shared `dynamic-type.md` contract.
- **Reduced motion**: Tooltip renders no enter/exit transition of its own (a synchronous
  mount/unmount), so `prefers-reduced-motion` has nothing Tooltip-specific to gate
  (`docs/components.md`).
- **AT expectations**: deterministic contract only (RNTL props); no VoiceOver/TalkBack
  evidence recorded yet (#147/#148 open).
- **Known limitations**: content may not contain focusable/actionable elements (`__DEV__`
  warns) — use `Popover` for interactive disclosure.

### Sheet

Bottom-sheet modal overlay, separately gated from Dialog for gesture/keyboard/safe-area
behavior (ADR-006, `docs/decisions/006-sheet-gesture-engine.md`; full contract in
`docs/components.md` § "Sheet boundary").

- **Roles/states**: modal semantics via React Native core `Modal` (native) / the shared
  Web overlay portal with a real Tab focus-trap (Web).
- **Labels/descriptions**: `SheetTitle`/`SheetDescription` register accessibility
  relationships the same way `DialogTitle`/`DialogDescription` do.
- **Keyboard (Web)**: opening moves focus to the panel's first focusable descendant; Tab/
  Shift+Tab cycle only within the panel and wrap at both ends; closing restores focus to
  the pre-open element; Escape and backdrop press both route through
  `dismissOnRequestClose`. Escape/Tab are wired on a **capture-phase** listener so a
  focused `Input` inside the panel cannot swallow them. Evidence: `sheet-showcase.spec.ts`
  ("traps Tab focus within the panel and wraps at both ends", "Escape closes the Sheet and
  restores trigger focus"), also in `keyboard-focus-acceptance-matrix.md`.
- **iOS/Android/Web differences**: native wraps `@gorhom/bottom-sheet` (`BottomSheetModal`)
  — dismissal via backdrop press, swipe-to-dismiss, and Android hardware back all route
  through the same `onRequestClose` contract; Web has no drag-to-dismiss gesture parity
  claim for 1.0. Native `avoidKeyboard={false}` cannot fully disable keyboard avoidance
  (gorhom upstream limitation).
- **RTL**: no Sheet-specific handling beyond the existing logical-property/dynamic-type
  contract already applied to `SheetTitle`/`SheetDescription`/panel styling; remains
  operable under RTL (`sheet-showcase.spec.ts` "remains operable when the document
  direction is RTL").
- **Dynamic Type/large text**: standard `Field`/text-wrapping contract; no Sheet-specific
  truncation.
- **Reduced motion**: `sheet-enter`/`sheet-exit` intents are `opacity-or-state`/`immediate`
  respectively (`docs/motion.md`); native forwards BeeUI's reduced-motion signal into
  gorhom's own `overrideReduceMotion` seam rather than adding a second motion engine.
- **AT expectations**: deterministic contract only; no VoiceOver/TalkBack evidence
  recorded yet. Native `pageSheet`/`formSheet` (Dialog, not Sheet) presentation remains
  EXPERIMENTAL per `docs/native-verification.md` — not relevant to Sheet's own gorhom
  engine, noted here only to avoid confusion between the two overlay kinds.
- **Known limitations**: presenting a Sheet from inside an already-open RN `Modal` can
  render behind the native modal window on iOS without a `react-native-screens`
  `FullWindowOverlay` (not added for 1.0 — prefer a BeeUI-native overlay as the opener in
  that scenario). Sheet registry/dependency-closure documentation (#161) is still open.

### Table / DataTable

Platform-diverging semantic composition: real HTML table elements on Web, RN accessible
composition on native, one shared prop contract (ADR-007,
`docs/decisions/007-table-datatable-architecture.md`).

- **Roles/states (Web)**: a real `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th scope="col">`/
  `<td>` tree — not a simulated ARIA grid (the "does not overstate ARIA grid behavior" test
  in `table-showcase.spec.ts` pins this: no roving-tabindex arrow-key cell navigation is
  claimed or implemented). Sortable headers expose `aria-sort`; selectable rows expose
  `aria-selected` (only on elements where that attribute is ARIA-allowed — axe-core's
  `aria-allowed-attr` rule is honored, see `table.web.tsx`).
- **Roles/states (native)**: RN has no dedicated table/row/cell accessibility role, so
  `table.tsx` folds row/column context directly into each cell's `accessibilityLabel`
  (e.g. `"${columnLabel}: ${children}"`) rather than asserting an unverified role mapping.
- **Labels/descriptions**: sort-trigger `accessibilityLabel` defaults to `"Sort by
  <column>"`; explicit `label`/`accessibilityLabel` overrides are always preserved.
- **Keyboard (Web)**: the sort trigger and any embedded row action sit in normal Tab order
  right after the header/row select-all checkbox — no custom grid keyboard pattern.
  Evidence: `table-showcase.spec.ts` ("sort trigger sits in normal tab order...", "embedded
  row action sits in normal tab order..."), `keyboard-focus-acceptance-matrix.md`.
- **iOS/Android/Web differences**: `layout="stacked"` renders a labelled block list (not a
  forced-narrow `<table>`) below a configurable breakpoint — a genuinely better a11y
  presentation at narrow width/large text, not merely a visual rearrangement (evidence:
  `table-showcase.spec.ts` "layout=\"stacked\" renders a labelled block list, not a
  <table>").
- **RTL**: the horizontal-scroll wrapper adopts `dir="rtl"` and visually reverses column
  order via the shared `useDirection()` resolver, independent of literal DOM/array order.
  Evidence: `table-showcase.spec.ts` "RTL: the scroll container adopts dir=\"rtl\" and
  visually reverses column order", `table-production.spec.ts` "RTL" describe block.
- **Dynamic Type/large text**: table text remains visible and unclipped at large root font
  size (evidence: `table-showcase.spec.ts` "table text remains visible and unclipped at
  large root font size (200%-equivalent)").
- **Reduced motion**: Table has no enter/exit animation of its own; not applicable.
- **AT expectations**: Web gets real `<table>` semantics "for free" from the browser/AT
  stack (strong, well-established AT support by construction). Native gets a
  deterministic-contract-verified accessible-name strategy (row/column context folded into
  labels); **no VoiceOver/TalkBack interaction evidence exists yet** for either platform —
  #167 (native rendering/a11y policy) is closed at the deterministic-contract level, but
  the release-level VoiceOver/TalkBack matrices (#147/#148) that would add real AT
  evidence remain open.
- **Known limitations**: no default virtualization (evidence-gated, `docs/decisions/007-
  table-datatable-architecture.md`); if a future virtualization adapter ships, it must
  preserve `aria-rowcount`/`aria-rowindex` and fixed/explicit column widths or Web
  row-count AT semantics regress — not yet needed at the accepted 100/500-row envelope.
  Table registry/docs/AI-metadata integration (#170) is still open.

### Calendar / DatePicker / DateTimePicker

Native-first date/time architecture (ADR-008, `docs/decisions/008-datetime-
architecture.md`); `Field` derives `accessibilityHint`/`accessibilityLabel`/
`accessibilityLabelledBy` for the composed trigger the same way it does for text controls.

- **Roles/states**: `Calendar`'s day grid exposes real `grid`/`row`/`cell` roles on Web,
  with each cell genuinely nested row-in-grid (not a flat list styled to look nested).
  Evidence: `issue-176-calendar-date-a11y.test.tsx` "exposes grid/row/cell roles, with each
  cell genuinely nested inside a row inside the grid"; browser confirmation in
  `calendar-accessibility-showcase.spec.ts` "Calendar grid exposes real grid/row/cell ARIA
  roles and announced day states".
- **Labels/descriptions**: the grid's `accessibilityLabel` defaults to the visible
  month/year and accepts an explicit override; each day cell's accessible name includes
  the full date plus today/selected/disabled state (not color alone), so state is never
  conveyed by color alone for AT users. Navigating months announces the new visible
  month/year via a **polite live region**, not just a visual repaint (evidence:
  `issue-176-calendar-date-a11y.test.tsx` "announces the visible month/year change via a
  polite live region as navigation happens"). DateTimePicker's hour/minute/period controls
  get distinguishable default labels, honor explicit overrides, and the AM/PM control is
  fully omitted (not just visually hidden) for a 24h locale (evidence: same test file,
  "DateTimePicker time-field screen-reader names" describe block).
- **Keyboard**: ArrowUp/Down move a week, Home/End move within the week, Shift+PageUp/Down
  move a year, ArrowLeft/Right move a day and mirror direction under RTL (see below),
  Escape dismisses the popover. A disabled day (e.g. weekend) is skipped by keyboard
  navigation. The AM/PM control is keyboard-operable (Tab + Enter), not mouse-only.
  Evidence: `calendar-accessibility-showcase.spec.ts` ("Calendar keyboard grid contract...",
  "DateTimePicker AM/PM control is keyboard-operable..."), `date-picker-showcase.spec.ts`,
  `date-time-picker-showcase.spec.ts`, `keyboard-focus-acceptance-matrix.md`.
- **iOS/Android/Web differences**: one shared anchored-`Popover` presentation on every
  platform (no native OS date-picker wheel/dialog substitution) — this is a deliberate
  ADR-008 decision, trading away free OS-native date-entry AT semantics for one
  consistent, verifiable cross-platform contract; see ADR-008's "Option" comparisons for
  the full tradeoff discussion.
- **RTL**: `Calendar` resolves direction via the shared `useDirection()` resolver;
  ArrowLeft/ArrowRight and the navigation chevrons mirror to match real RTL layout, verified
  against actual rendered geometry, not just a flipped prop. Evidence:
  `calendar-accessibility-showcase.spec.ts` "Calendar keyboard mirrors ArrowLeft/ArrowRight
  and the navigation chevrons under RTL"; deterministic mirroring assertion in
  `issue-172-calendar.test.tsx`.
- **Dynamic Type/large text**: the grid stays usable (no overlapping cells, focus still
  lands correctly) under a large text-scale override, and day cells meet the 44×44 minimum
  touch target at every scale. Evidence: `calendar-accessibility-showcase.spec.ts` ("...
  remains usable ... under a large text-scale override", "... meet the minimum 44x44
  touch-target size").
- **Reduced motion**: no Calendar/DatePicker/DateTimePicker-specific motion intent beyond
  the shared `overlay-enter`/`overlay-exit` the anchored `Popover` already uses.
- **Focus indicator**: a focused day cell renders a visible, non-transparent keyboard focus
  indicator (evidence: `calendar-accessibility-showcase.spec.ts`).
- **AT expectations**: deterministic contract (RNTL role/label assertions) plus real
  Chromium browser interaction evidence (grid roles, keyboard, RTL, large text, focus
  indicator, touch target). **No VoiceOver/TalkBack interaction evidence exists yet** for
  native grid traversal (#176 closed the component-local accessibility/keyboard
  acceptance at the deterministic+browser level; #177, visual + native runtime acceptance,
  and #147/#148, the release-level AT matrices, remain open).
- **Known limitations**: i18n/week-start/DST regression coverage is tracked separately
  (`docs/date-i18n-timezone-matrix.md`, #175, closed) and is not repeated here.
  Calendar/date registry/docs/AI-metadata integration (#178) and visual/native runtime
  acceptance (#177) remain open.

### Anchored overlays (Popover, DropdownMenu, Select)

Full keyboard/focus contract already lives in `docs/keyboard-focus-acceptance-matrix.md`
and full Select semantics in `docs/components.md` § "Select contract"; this section adds
only what those do not already state.

- **Roles/states**: Web — `Select` exposes combobox/listbox/option roles; `DropdownMenu`
  exposes menu/menuitem semantics; native — trigger/item accessibility state and labels
  are supplied through React Native semantics, with the listbox/menu container role
  Web-only (RN's typed role surface has no equivalent container role).
- **RTL**: all three anchored overlays (plus Tooltip) resolve direction through the same
  `resolveDirection()` call (`use-direction.ts`), collapsing what used to be three
  independently duplicated `I18nManager.isRTL` reads into one precedence contract:
  explicit prop → native `I18nManager.isRTL` / Web `document.documentElement.dir` →
  `'ltr'` fallback. Evidence: `logical-direction.test.tsx` ("resolveDirection /
  readAmbientDirection precedence", "overlay direction consolidation" — including a test
  that an explicit `direction` prop is never overridden by the resolver).
- **AT expectations**: "This documentation does not claim VoiceOver/TalkBack runtime proof
  until simulator/device evidence exists" (already stated verbatim in `docs/components.md`
  § "Select contract" — restated here because it applies equally to `Popover`/
  `DropdownMenu`).

### Dialog / AlertDialog

Full contract in `docs/keyboard-focus-acceptance-matrix.md` and `docs/components.md`.
Summary: Web Tab focus-trap with wrap-at-both-ends and focus restoration to the trigger
(fixed by #146); AlertDialog never dismisses via Escape or backdrop press, by design (WCAG
does not require every dialog to be Escape-dismissible, and a destructive-confirmation
dialog intentionally requires an explicit choice). `DialogTitle`/`DialogDescription`
register real accessibility relationships (`accessibilityLabelledBy`/hint), evidenced by
`apps/showcase/__tests__/issue-7-runtime-a11y.test.tsx` "links Dialog content to primitive
title and description semantics". Native `pageSheet`/`formSheet` presentation is
EXPERIMENTAL (`docs/native-verification.md`) — do not treat it as release-quality until
that document's status changes.

### Forms (Input, Textarea, Field, Checkbox, Radio, RadioGroup, Switch, SearchInput,
PasswordInput, OTPInput)

- **Roles/states**: standard RN form roles (`textbox`/checkbox/radio/switch semantics);
  `Field disabled` maps to `editable={false}` (a real Tab stop that is read-only, not
  removed from the Tab order) rather than a real HTML `disabled`, matching the platform
  convention that a "read-only" text field on iOS/Android has no separate
  non-focusable concept (documented, accepted gap — see
  `keyboard-focus-acceptance-matrix.md` "Known gaps").
- **Labels/descriptions**: `Field`/`Label` centralize label linkage (see "Guarantees"
  above); `FormMessage` gives destructive feedback polite live-region semantics by
  default.
- **Keyboard**: `bee-focus-ring` on Web for every text control; disabled controls are real
  Tab-order exclusions for `Button`/`Chip`/etc. (Checkbox/Radio/Switch/Input follow RN's
  own disabled/editable semantics per platform).
- **RTL/Dynamic Type/reduced motion**: no component-specific exception; inherit the shared
  contracts.
- **AT expectations**: deterministic contract only.
- **Known limitations**: a standalone `Checkbox`/`Radio` rendered without a `label` has
  only its 20×20 glyph box as the pressable target, under the 44px touch-target floor at
  every scale — a pre-existing, static (non-scaling-related) gap tracked separately from
  #143 (`docs/dynamic-type.md` "Minimum hit targets survive scale").

### Toast / AlertBanner / FormMessage (live regions)

- **Roles/states**: `AlertBanner` uses Android live-region behavior plus iOS
  `AccessibilityInfo` announcement, with explicit announcement text available for complex
  content; disabling live semantics is explicit and tested (evidence:
  `apps/showcase/__tests__/issue-7-runtime-a11y.test.tsx` "announces primitive AlertBanner
  content on iOS with polite queueing", "does not announce AlertBanner content when live
  semantics are disabled"). Toast shares the same announcement policy family through its
  own transient-notification runtime (`docs/toast.md`), not `OverlayPortal`/core `Modal`.
- **Keyboard/RTL/Dynamic Type/reduced motion**: no component-specific exception.
- **AT expectations**: deterministic contract only (Jest-mocked `AccessibilityInfo`); no
  live VoiceOver/TalkBack announcement evidence recorded yet.

### Structural/status primitives (ListGroup/ListItem/SettingsItem, Progress, Spinner,
Button busy state)

Covered by #276's structural/status semantics work
(`apps/showcase/__tests__/issue-276-structural-status-a11y.test.tsx`):

- `ListGroup`/`ListItem` only gain `listitem` role when actually owned by a `ListGroup`
  wrapper — an orphan `ListItem` outside a list never claims a `listitem` role it cannot
  back (regression-guarded, "load-bearing" tests explicitly named to fail if this
  ownership scoping regresses).
- `Progress`/`Spinner` fall back to a generic, non-brand accessible name only when the
  caller supplies none, and never override an explicit `accessibilityLabelledBy`.
- `Button`'s loading state exposes `aria-busy` directly on the button (not buried in the
  compound `accessibilityState` object), and the decorative loading spinner is hidden from
  assistive tech instead of producing a redundant second announcement.

## Native screen readers (VoiceOver/TalkBack)

**As of this document, BeeUI has zero recorded assistive-technology evidence-class
entries** for any component. Every accessibility claim in this document and in
`docs/components.md` for native platforms is either:

- **deterministic contract evidence** — the component requests the correct RN
  accessibility props/roles/labels, asserted in Jest/RNTL; or
- inherited, unverified platform behavior that RN's own accessibility bridge is expected
  to surface correctly (not independently re-verified by BeeUI).

#147 (VoiceOver release matrix) and #148 (TalkBack release matrix) are the tracked,
currently **open** issues that would produce the first real assistive-technology evidence
class entries — a repeatable checklist, recorded device/simulator/build/SHA, and explicit
per-flow pass/fail for Form entry/error, Dialog/AlertDialog, Popover/Select/Tooltip, Toast
announcement, Sheet, Table/DataTable, and Calendar/DatePicker/DateTimePicker. Until those
land, do not describe any BeeUI component as VoiceOver- or TalkBack-verified beyond "its
requested accessibility props are asserted by a deterministic test" — several component
docs already say this explicitly (`docs/components.md` § "Select contract"); this document
extends the same honesty to every other interactive component rather than leaving it
implicit.

## Evidence index

| Evidence class | Location |
| --- | --- |
| Deterministic contract (Jest/RNTL) — general | `apps/showcase/__tests__/accessibility-readonly.test.tsx`, `issue-7-runtime-a11y.test.tsx`, `issue-276-structural-status-a11y.test.tsx` |
| Deterministic contract — RTL/direction | `apps/showcase/__tests__/logical-direction.test.tsx` |
| Deterministic contract — Calendar/date a11y | `apps/showcase/__tests__/issue-176-calendar-date-a11y.test.tsx`, `issue-172-calendar.test.tsx` |
| Deterministic contract — Dynamic Type | `apps/showcase/__tests__/dynamic-type-contract.test.tsx` |
| Deterministic contract — Table | `apps/showcase/__tests__/table.test.tsx`, `table-performance.test.tsx` |
| Browser interaction — keyboard/focus | `apps/visual-regression/tests/keyboard-focus-matrix-showcase.spec.ts`, `select-showcase.spec.ts`, `tooltip-fixture.spec.ts`, `sheet-showcase.spec.ts`, `table-showcase.spec.ts`, `date-picker-showcase.spec.ts`, `date-time-picker-showcase.spec.ts`, `high-contrast-focus.spec.ts` |
| Browser interaction — automated a11y (axe) | `apps/visual-regression/tests/a11y.spec.ts`, `a11y-gate.spec.ts`, `a11y-readiness.spec.ts` |
| Browser interaction — RTL | `apps/visual-regression/tests/table-showcase.spec.ts`, `table-production.spec.ts`, `sheet-showcase.spec.ts`, `tooltip-showcase.spec.ts`, `calendar-accessibility-showcase.spec.ts` |
| Browser interaction — reduced motion | `apps/visual-regression/tests/motion-reduced.spec.ts` |
| Browser interaction — Dynamic Type / large text | `apps/visual-regression/tests/dynamic-type-showcase.spec.ts`, `dynamic-type-home-navigation.spec.ts`, `app-header-large-text-showcase.spec.ts`, `calendar-accessibility-showcase.spec.ts` |
| Native runtime — Dynamic Type only | `scripts/runtime-smoke/android-dynamic-type.sh` (real Android emulator `font_scale`) |
| Assistive technology (VoiceOver/TalkBack) | None recorded — see "Native screen readers" |

## Known gaps (honestly tracked, not silently omitted)

- **No cross-cutting RTL acceptance matrix yet** (#141/#142 open), unlike keyboard (#146).
  RTL is implemented (ADR-004, `use-direction.ts`) and exercised per-component
  (Popover/DropdownMenu/Select/Tooltip via the shared resolver; Breadcrumb/Pagination/
  Table/Calendar via direct `useDirection()` calls), with real Playwright evidence for
  Table, Sheet, Tooltip, and Calendar specifically — but there is no single document that
  enumerates every RTL-relevant component the way #146's matrix does for keyboard.
- **No cross-cutting reduced-motion acceptance matrix yet** (#149 open). `docs/motion.md`
  defines the policy and one representative Playwright fixture
  (`motion-reduced.spec.ts`) plus a deterministic `Animated`-spy suite proves the policy
  is honored for the defined intents; it does not enumerate every component the way #146
  does for keyboard.
- **No assistive-technology (VoiceOver/TalkBack) evidence exists for any component**
  (#147/#148 open) — see "Native screen readers" above.
- **Localization/long-content stress suite is open** (#144) — this document does not
  evaluate long-string/CJK/complex-script wrapping behavior beyond what
  `docs/dynamic-type.md`'s wrap-vs-truncation policy already covers for stress-length
  Latin-script text.
- **Table and Calendar/date registry, docs, and AI-metadata integration are open**
  (#170, #178), and Calendar/date visual + native runtime acceptance is open (#177).
  Their component-local accessibility/keyboard behavior is implemented and tested (closed
  #166/#167/#176), but the final registry/docs/clean-consumer/native-runtime-evidence
  layer for these two component families is not yet complete. Treat this document's Table
  and Calendar sections as accurate for what exists on `main` today, not as a claim that
  #170/#178/#177 are finished.
- **Sheet registry dependency closure is open** (#161) — Sheet's own accessibility
  behavior (native #158, Web #159) is implemented and tested; #161 is packaging/export
  closure, not an accessibility gap, listed here only because #150's own dependency list
  names it.

This document should be revisited (not silently left stale) once #141, #142, #144, #147,
#148, #149, #161, #170, #177, and #178 close, since several of them will add or change the
evidence class available for claims made above.
