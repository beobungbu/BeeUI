# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `BeeUIProvider` | application root | Provides safe-area measurement, a provider-local Toast runtime/viewport, and the shared anchored-overlay runtime/host; by default synchronizes measured insets to Uniwind safe-area utilities. Nested providers reuse the outer anchored-overlay runtime while Toast state remains scoped to the nearest BeeUIProvider. |
| `SafeArea` | layout | Explicit `react-native-safe-area-context` surface with caller-owned edge selection; BeeUI never silently adds system insets to generic screen/chrome components. |
| `Screen` | layout | Base application surface with semantic background and optional spacing; owns no safe-area or scroll behavior. |
| `KeyboardAwareScreen` | layout/form | Reusable scrollable form-screen shell with bounded content width, explicit safe-area ownership, iOS keyboard avoidance, Android edge-to-edge focused-field correction (including focus changes while the keyboard stays open), and platform-correct keyboard dismissal defaults. It owns no routing, form state, validation, auth, or persistence. |
| `Box` | layout | Thin `View` primitive; no design assumptions. |
| `Stack` | layout | Typed direction/gap/alignment/wrap composition over `View`; owns no responsive policy. |
| `HStack` | layout | Horizontal specialization of `Stack`; defaults cross-axis alignment to center and still allows explicit alignment overrides. |
| `VStack` | layout | Vertical specialization of `Stack`. |
| `Section` | layout | Title/description/action/content composition for screen sections. |
| `MetadataRow` | layout | Read-only label/value metadata presentation. |
| `VisuallyHidden` | accessibility | Keeps non-interactive assistive content in the accessibility tree while removing it from visual layout; never a substitute for labeling an interactive control. |
| `Text` | typography | Semantic type/tone variants. |
| `Label` | typography/form | Semantic form/control label with accessible required-state wording and optional `nativeID` linkage. |
| `Button` | action | Accessible pressable, variants, sizes, loading/disabled states. |
| `ButtonLabel` | action | Explicit label primitive for composed buttons. |
| `IconButton` | action | 44px icon action; accessible label is required. |
| `Link` | action | Link semantics over `Pressable`; owns no navigation library or routing behavior. |
| `Input` | form | Semantic focus/invalid/disabled states, themed native colors, and Field-provided label/required relationships while preserving explicit overrides. |
| `Textarea` | form | Multiline input using the same `Input` contract. |
| `Field` | form | Label/description/error composition for text-entry controls; generates stable label `nativeID` metadata and propagates state/accessibility metadata to text controls only. Checkbox/radio/switch labels and state remain explicit at the control/group level. |
| `FormGroup` | form | Structural legend/description/error composition for related controls. It never becomes one accessible parent element; compatible semantic child groups such as `RadioGroup` inherit legend/hint/disabled metadata while explicit child accessibility props remain authoritative. |
| `HelperText` | form | Muted supporting text for form affordances without hidden state. |
| `FormMessage` | form | Destructive form feedback with polite live-region semantics by default. |
| `SearchInput` | form | Search keyboard/submit semantics layered on `Input`; clearing a previously non-empty query emits one `onSearch('')` reset signal. |
| `PasswordInput` | form | Password visibility composition with safe keyboard/autofill defaults; explicit caller overrides remain authoritative. |
| `OTPInput` | form | Controlled/uncontrolled one-time-code input with numeric normalization, safe text-entry defaults, and completion callbacks deduplicated per completed value until the input becomes incomplete again. |
| `Checkbox` | form | Controlled boolean/indeterminate state with checkbox semantics; enabled usage without `onCheckedChange` warns in development instead of failing silently. |
| `Radio` | form | Controlled radio item; standalone radios may request both selection and deselection, while grouped radios remain mutually exclusive. Enabled standalone usage without `onCheckedChange` warns in development. |
| `RadioGroup` | form | Controlled value coordination and native `radiogroup` semantics; enabled usage without `onValueChange` warns in development. When nested in `FormGroup`, it inherits group legend, guidance/error hint, and disabled state without hiding radio descendants. |
| `Switch` | form | Controlled native `Switch` with semantic track/thumb colors; enabled usage without `onValueChange` warns in development. |
| `Chip` | selection | Standalone toggle or value-scoped group item with button/radio/checkbox semantics; grouped items without a value fail safe as disabled and warn in development. |
| `ChipGroup` | selection | Controlled/uncontrolled single or multiple selection coordination. |
| `SegmentedControl` | selection | Controlled compact mutually exclusive selection surface with `radiogroup` semantics; enabled usage without `onValueChange` warns in development. |
| `SegmentedControlItem` | selection | Accessible radio-style segment with checked-state semantics. |
| `Pagination` | navigation | Controlled page/page-count context with normalized boundaries. |
| `PaginationItem` | navigation | Type-enforced page/previous/next action; page items require a page number, malformed runtime page items fail safe as disabled, and boundary/selected semantics are enforced. |
| `Breadcrumb` | navigation | Router-neutral breadcrumb composition with decorative separators hidden from accessibility; supplied child keys are preserved when composing separators. |
| `BreadcrumbItem` | navigation | Link semantics for navigable ancestors and non-interactive selected semantics for the current location. |
| `Stepper` | navigation | Controlled current-step context with finite normalization and duplicate normalized-step detection; owns no application workflow state. |
| `StepperItem` | navigation | Current/completed/disabled step presentation with accessible position; duplicate normalized step values fail safe as disabled. |
| `Tabs` | navigation | Controlled tab state shared across list/triggers/content; enabled usage without `onValueChange` warns in development. |
| `TabsList` | navigation | Tablist semantic container. |
| `TabsTrigger` | navigation | Accessible tab selection trigger. |
| `TabsContent` | navigation | Active tabpanel content; inactive panels are not mounted. |
| `Collapsible` | disclosure | Controlled/uncontrolled disclosure state. |
| `CollapsibleTrigger` | disclosure | Accessible expanded-state trigger. |
| `CollapsibleContent` | disclosure | Mounts only while disclosure is open. |
| `Accordion` | disclosure | Single-value controlled/uncontrolled disclosure coordination. |
| `AccordionItem` | disclosure | Value-scoped accordion item. |
| `AccordionTrigger` | disclosure | Accessible item trigger. |
| `AccordionContent` | disclosure | Active item content. |
| `Dialog` | modal overlay | Controlled/uncontrolled modal state backed by React Native core `Modal`; controlled `open` requires `onOpenChange`, with dismissable runtime fallback for malformed JS usage. |
| `DialogTrigger` | modal overlay | Button-compatible trigger that opens the modal without exposing disclosure-only `expanded` state. |
| `DialogContent` | modal overlay | Modal surface with semantic backdrop/close paths plus registered title/description accessibility relationships while preserving explicit caller overrides. `overFullScreen` is transparent; native `fullScreen`/`pageSheet`/`formSheet` remain non-transparent so RN can honor the requested presentation. `onRequestClose` fires exactly once per native request; Android Modal back is child-first for a nested anchored overlay, while iOS/other native request-close applies the Dialog close policy directly. `dismissOnRequestClose={false}` makes that request notification-only. On Web (#146), it also owns a real Tab focus-trap: opening moves focus to its first focusable descendant, Tab/Shift+Tab wrap at both ends without ever reaching background page content, and closing restores focus to whatever was focused before it opened — an independent, Dialog-local implementation of the same contract `sheet.web.tsx` already owns for Sheet. |
| `DialogTitle` | modal overlay | Semantic dialog heading that registers stable label metadata with its containing `DialogContent`. |
| `DialogDescription` | modal overlay | Muted supporting text that provides a primitive-text accessibility hint to its containing dialog. |
| `DialogFooter` | modal overlay | Action-row composition. |
| `DialogClose` | modal overlay | Button-compatible close control. |
| `AlertDialog` | modal overlay | Confirmation/destructive modal state built on the accepted Dialog/core-Modal kernel; it shares Dialog's controlled/uncontrolled state contract without introducing another overlay engine. |
| `AlertDialogTrigger` | modal overlay | Button-compatible confirmation trigger. |
| `AlertDialogContent` | modal overlay | Alert-dialog surface that never closes from backdrop presses. Android Modal hardware back dismisses a nested anchored child first, then follows the alert cancellation policy; iOS/other native request-close is not child-intercepted. `cancelOnRequestClose={false}` makes the no-child native request notification-only. Accessibility escape remains a separate cancellation path. |
| `AlertDialogTitle` | modal overlay | Dialog-kernel title semantics for confirmation content. |
| `AlertDialogDescription` | modal overlay | Dialog-kernel supporting description/accessibility hint for confirmation content. |
| `AlertDialogFooter` | modal overlay | Confirmation action-row composition. |
| `AlertDialogCancel` | modal overlay | Close action defaulting to the outline button variant while preserving caller handlers. |
| `AlertDialogAction` | modal overlay | Close action defaulting to the destructive button variant while preserving caller handlers. |
| `Popover` | anchored overlay | Controlled/uncontrolled non-modal anchored state. Controlled use requires `open` + `onOpenChange`; uncontrolled use supports `defaultOpen`. Reuses the shared BeeUIProvider overlay runtime rather than a private portal/Modal engine. |
| `PopoverTrigger` | anchored overlay | Button-compatible anchor/toggle. Preserves caller accessibility state, adds `expanded`, and links to the content through React Native's typed `aria-controls` surface only while the content is mounted (open), so the idref never dangles when closed. |
| `PopoverContent` | anchored overlay | Non-modal anchored surface using shared window-coordinate measurement, geometry flip/shift/collision, safe-area policy, optional keyboard avoidance, and topmost-only dismissal. Unresolved content measures invisibly offscreen rather than flashing at `(0,0)`. |
| `PopoverTitle` | anchored overlay | Heading that registers stable native label metadata and primitive text with its Popover content. |
| `PopoverDescription` | anchored overlay | Supporting text that registers a primitive-text accessibility hint with its Popover content. |
| `PopoverClose` | anchored overlay | Button-compatible explicit close action. |
| `DropdownMenu` | anchored overlay | Controlled/uncontrolled non-modal menu state layered on the same shared anchored-overlay runtime as Popover. |
| `DropdownMenuTrigger` | anchored overlay | Button-compatible measured anchor that preserves caller accessibility state, adds `expanded`, and links to menu content via `aria-controls` only while the menu content is mounted (open), so the idref never dangles when closed. |
| `DropdownMenuContent` | anchored overlay | Menu surface defaulting to bottom/start placement with flip/shift, safe-area collision handling, unresolved-geometry gating, topmost-only dismissal, and deterministic Web current-item keyboard navigation. On Web (#146), opening/changing the roving-tabindex current item also moves real DOM focus onto it (mirroring `select.tsx`'s identical contract), and the trigger regains real focus when the menu closes. |
| `DropdownMenuItem` | anchored overlay | Menu-item semantics with disabled state. `onSelect` is the cross-input selection callback; normal items close the menu by default after caller handlers run. |
| `DropdownMenuCheckboxItem` | anchored overlay | Checked menu-item semantics with controlled `checked`/`onCheckedChange`; remains open by default and can opt into close-on-select. |
| `DropdownMenuRadioGroup` | anchored overlay | Controlled radio-value coordination for menu radio items. Duplicate values are detected and fail safe as disabled. |
| `DropdownMenuRadioItem` | anchored overlay | Checked menu-item semantics within a radio group; selection requests the next group value and remains open by default. |
| `DropdownMenuLabel` | anchored overlay | Non-interactive semantic label text for grouping menu content. |
| `DropdownMenuSeparator` | anchored overlay | Decorative non-interactive separator hidden from accessibility. |
| `Select` | anchored selection | Persistent string-value selection with controlled/uncontrolled value and open state. It reuses the shared anchored-overlay runtime while owning option/value semantics independently from `DropdownMenu`. |
| `SelectTrigger` | anchored selection | Measured combobox-style trigger that conveys expanded/disabled/current-value state and links to Select content. Web ArrowUp/ArrowDown can open it. |
| `SelectValue` | anchored selection | Displays the registered text for the selected option or caller-provided placeholder. |
| `SelectContent` | anchored selection | Anchored scrollable option surface with collision/safe-area/keyboard policy, topmost dismissal, Web listbox keyboard/typeahead behavior, and viewport-constrained max height. |
| `SelectItem` | anchored selection | String-valued option with persistent selected state, disabled state, duplicate-value fail-safe behavior, and optional `textValue` for composed children. |
| `SelectGroup` | anchored selection | Structural option grouping; Web exposes group/label association while native keeps visible label structure without inventing unsupported listbox-container semantics. |
| `SelectLabel` | anchored selection | Visible group label with a stable native ID used by its group association. |
| `Tooltip` | anchored disclosure | Non-interactive contextual annotation (ADR-005); composition-root context/open-close-delay state machine only, no rendered surface of its own. Controlled use requires `open` + `onOpenChange`; uncontrolled use supports `defaultOpen`. |
| `TooltipTrigger` | anchored disclosure | Hover/focus channel (never press) that requests open/close through the shared delay state machine; never toggles open state on press so it never blocks the trigger's own action. |
| `TooltipContent` | anchored disclosure | Anchored, portaled, non-interactive bubble reusing the shared overlay geometry/dismiss kernel. `tabIndex={-1}` (Web) / hidden from the accessibility tree (native) — it is never a focus target itself; `role="tooltip"` + gated `aria-describedby` (Web) or a merged `accessibilityHint` (native) carry the accessible relationship instead. |
| `AppHeader` | application chrome | Title/description/leading/trailing composition; owns no navigation. Primitive titles receive header semantics; complex title nodes own their own internal accessibility semantics. |
| `BottomActionBar` | application chrome | Bottom action surface; safe-area ownership stays explicit with the application shell via `SafeArea` or safe-area utilities. |
| `ListGroup` | application pattern | Bordered grouped-row surface with list container semantics without taking ownership of row actions. |
| `ListGroupHeader` | application pattern | Title/description/trailing header composition aligned to the same horizontal inset as grouped rows. |
| `ListItem` | application pattern | Optional press behavior; interactive rows synthesize deterministic accessible names from primitive title/description/trailing content, while non-interactive rows group primitive content without hiding complex descendants. |
| `SettingsItem` | application pattern | Settings row specialization where value and trailing content can coexist; a primitive value remains part of the synthesized accessible name even when trailing content is complex. |
| `DescriptionList` | application pattern | Read-only grouped metadata composition with no formatting/data-state ownership. |
| `DescriptionItem` | application pattern | Description-list row specialization composed from `MetadataRow`. |
| `Card` | surface | Surface variants and spacing contract. |
| `AlertBanner` | feedback | Semantic inline status callout with Android live-region behavior and iOS `AccessibilityInfo` announcement support; explicit announcement text is available for complex content. |
| `useToast` / Toast viewport | feedback | Provider-scoped descriptor notifications with `show`/`dismiss`/`dismissAll`, three-visible FIFO queueing, explicit persistent mode, deterministic action dismissal, safe-area-aware stacking, live announcement semantics, and no Modal/anchored geometry/arbitrary ReactNode transport. |
| `Badge` | data display | Semantic status variants with paired foreground tokens. |
| `Avatar` | data display | Image/fallback behavior with size variants; failure reset is keyed to semantic image source content rather than source object identity. |
| `Stat` | data display | Layout-only metric composition with no hidden state or formatting ownership. |
| `StatLabel` | data display | Muted semantic metric label. |
| `StatValue` | data display | Prominent metric value presentation. |
| `StatHelpText` | data display | Supporting metric context with caller-selectable semantic tone. |
| `Timeline` | data display | Read-only ordered history composition that derives terminal connector placement from rendered children and preserves supplied child keys. |
| `TimelineItem` | data display | Title/description/meta event presentation with semantic marker states and no workflow ownership. |
| `Progress` | feedback | Clamped progress value and native progressbar semantics. |
| `Spinner` | feedback | Native indicator with semantic tone mapping. |
| `Skeleton` | feedback | Decorative static loading surface. |
| `Separator` | layout | Decorative by default; semantic separator when requested; vertical orientation stretches across the parent's cross axis instead of relying on percentage height. |
| `EmptyState` | state | Neutral empty-state composition with optional action. |
| `ErrorState` | state | Destructive error-state specialization with optional retry action. |

## Form grouping accessibility policy

React Native exposes semantic roles such as `radiogroup`, but does not expose a generic cross-platform `fieldset`/`group` accessibility role. BeeUI therefore does not fake one. `FormGroup` remains `accessible={false}` so its children stay independently discoverable, while semantic descendants opt into the metadata they can represent correctly. `RadioGroup` currently consumes that context because React Native has an explicit `radiogroup` role.

`Field` remains the text-entry composition primitive. `FormGroup` does not implicitly mutate checkbox/switch/radio application state and does not make arbitrary descendants disabled by cloning them; compatible group primitives consume the shared metadata intentionally.

## Current roadmap ordering

The component inventory is no longer the main production-readiness bottleneck. BeeUI already has broad foundation coverage plus an executable Showcase with the preserved Component Gallery and all 37 production pattern screens integrated into the Pattern Gallery.

Wave 0 is implemented. The next major work is ordered by `docs/roadmap.md`:

1. context-preserving anchored-overlay transport — **delivered** (Wave 1A) at the deterministic/compile contract level: web `createPortal`, native teleport, generic modal-local scope, legacy fallback contract; exact runtime/device interaction remains separately gated;
2. Theme Tokens v3 — **delivered**: canonical DTCG source/codegen/lifecycle, semantic-consumption guard, scoped themes, runtime overrides/readers, density, high contrast, dataviz and motion contracts;
3. production `Select` — **implemented in Wave 2A** on the accepted overlay runtime; `Tooltip` remains separate work with its own hover/focus/accessibility contract;
4. native runtime-smoke foundation — **established** (see `docs/native-runtime-smoke.md`); the open work is the R1 runtime-hardening dependency chain (bounded measurement completion, deterministic host fallback, and the explicit `pageSheet`/`formSheet` support/quarantine policy) tracked in `docs/roadmap.md`;
5. implement `Sheet` as a separate gesture/keyboard/safe-area behavior class if BeeUI claims first-class modern mobile coverage;
6. add `Slider` and later high-value components only when cross-domain evidence supports them.

Additional form-group integrations should be added only where React Native exposes an unambiguous group semantic. `VisuallyHidden` remains restricted to non-interactive assistive content.

## Anchored overlay components

The shared anchored-overlay geometry/runtime kernels are accepted, with public `Popover`, `DropdownMenu`, `Select`, and `Tooltip` layered on them.

The portal transport preserves consumer React context declared below `BeeUIProvider` (web `ReactDOM.createPortal`, native `react-native-teleport`), with a defensive legacy fallback that does not preserve it. Overlays inside a `Dialog` target a modal-local host. See `docs/anchored-overlays.md`.

`Select` does not alias `DropdownMenu`: menu items activate commands, while Select options represent one persistent current value. `Tooltip` (below) likewise keeps its own semantics — a non-interactive contextual annotation, not an interactive disclosure — while reusing the same transport/runtime instead of cloning it.

Do not approximate anchored overlays with full-screen modal behavior merely to avoid portal/context work. Positioning, collision handling, nested overlays, focus, keyboard semantics, and accessibility remain part of each component's contract.

## Select contract

The public value type is `SelectOptionValue = string`. `Select` supports `value`/`onValueChange` for controlled selection and `defaultValue` for uncontrolled selection. Supplying an explicit `value={undefined}` is treated as a controlled empty selection; a selection request calls `onValueChange`, but BeeUI does not invent an optimistic local value while the parent is delayed. `open`/`onOpenChange` and `defaultOpen` independently control presentation state.

Uncontrolled usage:

```tsx
<Select defaultValue="pro">
  <SelectTrigger accessibilityLabel="Plan">
    <SelectValue placeholder="Choose a plan" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="starter">Starter</SelectItem>
    <SelectItem value="pro">Pro</SelectItem>
  </SelectContent>
</Select>
```

Controlled usage:

```tsx
const [plan, setPlan] = React.useState('starter');

<Select value={plan} onValueChange={setPlan}>
  <SelectTrigger accessibilityLabel="Plan">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Plans</SelectLabel>
      <SelectItem value="starter">Starter</SelectItem>
      <SelectItem value="pro">Pro</SelectItem>
      <SelectItem disabled value="enterprise">Enterprise</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

`SelectItem` infers its selected-value display/typeahead text from primitive string/number children. Composed children should supply `textValue`. Duplicate values fail safe: every item sharing the duplicate value is disabled until the duplicate is removed, and development builds warn. An option removed while selected does not emit a synthetic value change; the underlying value remains application state and `SelectValue` falls back to its placeholder until a matching item returns. If a selected item becomes disabled, the selected value remains persistent but the item cannot be activated or navigated to.

On Web, the trigger exposes combobox-style semantics, content exposes a listbox role, and items expose option + selected/disabled state. ArrowUp/ArrowDown open/navigate, Home/End move to boundaries, Enter/Space select, and short prefix typeahead is supported. Disabled and duplicate options are skipped. Closing restores focus to the trigger only after the open state actually transitions closed, so a delayed controlled parent does not move focus prematurely. Escape and outside press use the shared scope-aware dismiss runtime.

On native, v1 deliberately keeps the same anchored presentation rather than pretending browser hover/keyboard behavior or adding a Bottom Sheet dependency. Trigger/item accessibility state and labels are supplied through React Native semantics; the listbox container role is Web-only because React Native's typed role surface does not expose that container role. Android `Modal` request-close remains child-first for a Dialog-local Select through the existing modal dismiss scope. iOS/other modal request-close follows the Dialog close policy rather than being intercepted as a Select-only close. This documentation does **not** claim VoiceOver/TalkBack runtime proof until simulator/device evidence exists.

`SelectContent` uses a `ScrollView`, defaults to a 320px maximum content height, constrains that maximum to the current overlay viewport, and scrolls the current option toward visibility when opened. 0, 1, 20, and 100+ option fixtures are part of the deterministic contract. v1 does not add virtualization: measured evidence is required before taking that dependency/complexity. Placement, flip/shift, collision padding, safe-area/keyboard avoidance, viewport changes, async anchor measurement, modal-local geometry, context preservation, and dismissal all come from the accepted shared overlay runtime.

A Select inside `Dialog` targets the Dialog's modal-local host and preserves consumer React context on the context-preserving portal transports. Closing the Dialog while Select is open unmounts the child with the modal. The legacy overlay fallback remains exactly the shared runtime's documented fallback and therefore cannot promise consumer-context preservation.

Unsupported v1 presentation behavior is intentionally narrow: there is no Sheet mode, no virtualization API, and no browser-style hover/keyboard emulation on native. A future Sheet presentation may be added behind a presentation policy without changing `value`, `defaultValue`, `onValueChange`, item values, selected state, or group semantics.

## Tooltip contract

`Tooltip`/`TooltipTrigger`/`TooltipContent` (#152 Web, #153 native, #154 regression matrix, #155 export/registry/docs) implement [ADR-005](decisions/005-tooltip-contract.md): a **non-interactive contextual disclosure**, not a click-to-open menu or a persistent panel. Content may not contain focusable or actionable elements (`__DEV__` warns if it does); use `Popover` for interactive disclosure content.

```tsx
<Tooltip>
  <TooltipTrigger accessibilityLabel="Autosave">
    <Icon name="save" />
  </TooltipTrigger>
  <TooltipContent>Saved automatically every 30 seconds</TooltipContent>
</Tooltip>
```

`Tooltip` supports `open`/`onOpenChange` (controlled) or `defaultOpen` (uncontrolled), plus `openDelay` (default 500ms, hover-only) and `closeDelay` (default 300ms, hover-out-only). Focus always opens immediately and blur always closes immediately — the delay only ever applies to the pointer/hover channel. `TooltipTrigger` never toggles open state on press; tapping/clicking the trigger is reserved for the trigger's own action.

**Web**: `TooltipTrigger` opens on `onHoverIn`/`onFocus` and closes on `onHoverOut`/`onBlur`; a pointer that travels from the trigger onto `TooltipContent` itself does not trigger the pending close (WCAG 1.4.13 "hoverable"), and Escape dismisses without any pointer/focus movement (WCAG 1.4.13 "dismissible"). `TooltipContent` renders `role="tooltip"` and the trigger exposes `aria-describedby` only while content is mounted. `TooltipContent` is `tabIndex={-1}` — it is never a Tab stop and never receives focus itself, natural or programmatic. There is no outside-press dismiss layer; Tooltip is never modal.

**Native**: there is no mouse hover, so `TooltipTrigger` opens on long-press (immediately, no `openDelay`) and closes after a fixed reveal window once the press releases; focus (external keyboard/Switch Control) opens immediately and blur closes immediately, exactly like Web. There is no RN equivalent of `aria-describedby`, so the accessible relationship is instead a merged `accessibilityHint` registered on the trigger unconditionally (independent of whether the visual bubble has ever mounted) — an explicit consumer-provided `accessibilityHint` is never overwritten. The floating visual bubble itself is hidden from the accessibility tree (`accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`) so it never produces a second, redundant announcement alongside the merged hint.

**Shared**: placement, flip/shift, collision padding, safe-area/keyboard avoidance, direction (RTL/LTR) resolution, modal-local geometry when nested in a `Dialog`, context preservation across the portal transport, and Escape scope-awareness (a `Tooltip` opened from inside a `Dialog` dismisses child-first, the `Dialog` stays open) all come from the same accepted anchored-overlay kernel `Popover`/`DropdownMenu`/`Select` already use — no second geometry/portal/dismiss engine. `Tooltip` renders no enter/exit transition of its own (it is a synchronous mount/unmount, not an animated disclosure), so `prefers-reduced-motion` has nothing Tooltip-specific to gate.

## Sheet boundary

`Sheet` remains separately gated because gesture, snap-point, keyboard, safe-area, scrolling, hardware-back, and accessibility behavior need stronger native runtime verification than a centered modal.

### Native implementation (#158, ADR-006)

`sheet.native.tsx` replaces the skeleton's rendering on iOS/Android behind the identical public contract, wrapping the optional `@gorhom/bottom-sheet` adapter (`BottomSheetModal`) instead of RN's `<Modal>`. **Required app-root wiring**: any consumer rendering `Sheet` must wrap its app root in both `GestureHandlerRootView` (`react-native-gesture-handler`) and `BottomSheetModalProvider` (`@gorhom/bottom-sheet`) — see `apps/showcase/App.tsx` for the reference wiring. This is an unavoidable upstream integration cost of the chosen engine (ADR-006), not a BeeUI-invented requirement.

- **Dismissal**: backdrop press (custom `backdropComponent`, `closeOnBackdropPress`), swipe-to-dismiss (`enableSwipeToDismiss` → `enablePanDownToClose`), and Android hardware back all route through `dismissOnRequestClose`/`onRequestClose`. `@gorhom/bottom-sheet` does not integrate `BackHandler` itself, so `sheet.native.tsx` owns the back-press contract directly, reusing the same nested-scope-first dismiss precedence (`ModalOverlayHost`) `DialogContent`/the Web Sheet already document.
- **Motion**: gorhom's own drag/spring physics drive the sheet; BeeUI adds no second motion engine, only forwards its own already-read `AccessibilityInfo.isReduceMotionEnabled()` signal into gorhom's `overrideReduceMotion` seam.
- **Handle**: rendered through gorhom's own `handleComponent` slot (required for the real pan-gesture wiring) rather than as a plain child — visually similar to, but structurally distinct from, the Web/skeleton placement.
- **Known limitations (owed to #160 native runtime acceptance)**: `avoidKeyboard={false}` cannot map to a true "disable keyboard avoidance" behavior (gorhom's `keyboardBehavior` enum has no such option upstream); presenting a Sheet from inside an already-open RN `<Modal>` can render behind the native modal window on iOS without a `react-native-screens` `FullWindowOverlay` (a fourth dependency BeeUI does not add for 1.0 — prefer a BeeUI-native overlay, e.g. Popover, as the opener in that scenario).

### Web implementation (#159, ADR-006)

### Web implementation (#159, ADR-006)

`sheet.web.tsx` replaces the skeleton's rendering on Web behind the identical public contract, per [ADR-006](decisions/006-sheet-gesture-engine.md): no `@gorhom/bottom-sheet`, no Reanimated/Gesture-Handler, and no drag-to-dismiss gesture parity claim for 1.0. It reuses `overlay-transport.web.tsx`'s portal (`OverlayPortal`/`ModalOverlayHost`) directly instead of React Native's `<Modal>`, and BeeUI's own Web overlay primitives for everything a consumer can observe:

- **Dismissal**: backdrop press (`closeOnBackdropPress`) and Escape both route through `dismissOnRequestClose`/`onRequestClose`, identical to the native contract. Escape and the panel's own Tab focus-trap are each wired through a **capture-phase** `document` `keydown` listener rather than the shared bubble-phase Escape bridge (`overlay-dismiss-events.web.ts`) alone — a focused text `Input` inside the panel (a common Sheet content shape) stops that event's bubble phase before it reaches a bubble-phase listener, which would otherwise silently swallow Escape/Tab while a search or filter field has focus. Nested-overlay precedence (e.g. a `Popover` opened from inside the Sheet) is unchanged: an `isTopmost()` guard defers to whatever registered later in the Sheet's own dismiss scope.
- **Focus**: opening moves focus to the panel's first focusable descendant (or the panel itself as a fallback); Tab/Shift+Tab cycle only within the panel; closing restores focus to the element focused before the Sheet opened.
- **Motion**: `sheet-enter`/`sheet-exit` (`docs/motion.md`) drive an opacity + translateY transition through `resolveMotion`/`resolveNativeMotion` and React Native's built-in `Animated` — the same mechanism `apps/showcase/theme-inspector/motion-preview.tsx` already demonstrates — honoring `prefers-reduced-motion` with no Reanimated dependency.
- **Responsive layout**: edge-to-edge bottom sheet below the `medium` (768px) breakpoint; a centered, inset, fully-rounded panel capped at the existing `max-w-dialog` (512px) content width at `medium` and above (`docs/responsive-layout.md`).
- **RTL/large text**: no additional handling is needed beyond the existing logical-property/dynamic-type contracts already applied to the shared `SheetTitle`/`SheetDescription`/panel styling.
- **Not claimed**: drag-to-dismiss gesture parity, native swipe completion, and safe-area inset padding (Dialog sets no Web precedent for the latter either; `react-native-safe-area-context` reports zero insets on most Web targets).

Real-browser Playwright evidence lives in `apps/visual-regression/tests/sheet-showcase.spec.ts` (open/close, Escape, backdrop, focus-trap/restoration, responsive, RTL, reduced motion) and the `component-gallery-sheet-overlay` axe scenario (`apps/visual-regression/src/a11y-scenarios.ts`).

## Table contract

`Table`/`TableCaption`/`TableHeader`/`TableBody`/`TableFooter`/`TableRow`/`TableHead`/`TableCell` (#165 core anatomy, #166 Web semantics/keyboard, #167 native rendering/a11y, #168 performance/scale, #169 production patterns, #170 export/registry/docs) implement [ADR-007](decisions/007-table-datatable-architecture.md): a **composable primitive family**, not a data-driven `columns`/`data` grid. BeeUI owns no fetching, backend/query state, sort/filter/selection state, or spreadsheet-style cell navigation/editing — the caller maps its own rows to `<TableRow>`/`<TableCell>` exactly as it already does for any other list.

```tsx
<Table>
  <TableCaption>Recent invoices</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead sortDirection={sort} onSortChange={toggleSort}>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {invoices.map((invoice) => (
      <TableRow key={invoice.id} selected={selectedId === invoice.id}>
        <TableCell>{invoice.number}</TableCell>
        <TableCell>{invoice.status}</TableCell>
        <TableCell>{invoice.amount}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**State boundaries**: `TableHead`'s `sortDirection`/`onSortChange` pair is controlled by the caller (mirroring the `Checkbox`/`Tabs` controlled-callback discipline); presence of `sortDirection` is what marks a column sortable and renders an interactive sort trigger reachable by normal tab order. `TableRow`'s `selected` prop is a caller-owned boolean reflected as a visual/accessibility state only — row selection itself reuses the existing `Checkbox` component inside a cell, with the caller owning the selected-id set. Table stores none of this state itself.

**Platform rendering** (ADR-007 "Platform rendering strategy", Option B): `table.web.tsx` renders the real HTML table elements (`<table>`, `<caption>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th scope="col">`, `<td>`) so Web gets native browser row/column/header assistive-technology semantics for free, plus `aria-sort` on sortable `<th>` elements. The default (native) file composes `View`/`Text`/`Pressable` — React Native has no table/row/column-header accessibility role, so each plain-text `TableCell` folds its column's label into its own `accessibilityLabel` (`label: value`) instead, and the sort trigger inside `TableHead` gets an accessible name that includes the current sort state (`", sorted ascending"` / `", sorted descending"` / `", not sorted"`). Both files share one identical prop contract per subcomponent, so caller JSX does not change per platform.

**Responsive layout**: `Table`'s `layout` prop (`TableLayout = 'scroll' | 'stacked'`, default `'scroll'`) is an explicit caller-driven choice — BeeUI does not measure viewport/container width itself. `'scroll'` wraps the row grid in a horizontally scrolling container (Web `overflow-x`, native horizontal `ScrollView`) with column order following `useDirection()` (ADR-004) rather than a hardcoded physical left-to-right assumption. `'stacked'` renders each `TableRow` as a card and each `TableCell` as a `label: value` pair; `TableHead` cells register their column's inferred (or explicit `label` override) text into a `Table`-scoped context that `TableCell` looks up by column index, mirroring `ListGroupMembershipContext`'s local-context pattern — no global store, no state persisted across renders.

**Accessibility/scale limits**: native row/cell touch targets keep the accepted `>=44dp` floor (mirrors `ListItem`'s guard) even in `compact` density. Table does not disable Dynamic Type/font scaling (`docs/dynamic-type.md`). Native VoiceOver/TalkBack row/column-announcement evidence is deterministic-contract-verified (`apps/showcase/__tests__/table.test.tsx`) rather than real-device-verified as of #167; this documentation does not claim stronger native assistive-technology evidence than that. Table ships **no default virtualization** — `TableBody` renders every supplied row directly; real, harness-measured evidence (`pnpm bench:web`, `scripts/benchmark/scenarios/web/table-render.mjs`) shows 100/500-row renders comfortably inside a 16ms frame budget on a representative dev host (see `apps/docs/src/content/docs/components/table.md`'s Performance section for the full numbers and methodology), so no virtualization adapter is currently justified. Consumers with significantly larger row counts should wrap row content in `React.memo` (proven to isolate a selection/sort update to only the changed row, `apps/showcase/__tests__/table-performance.test.tsx`) or reach for an external virtualization/data-grid library — BeeUI does not bundle one.

**Not claimed**: spreadsheet-style arrow-key cell navigation, in-cell editing, or a roving-tabindex grid pattern — none of these are part of Table's contract (ADR-007's explicit non-goal); the header sort trigger and any embedded row action reach normal tab order like any other interactive control.

## Toast boundary

Toast v1 is implemented as a separate transient-notification runtime. It is not anchor-positioned and does not use `OverlayPortal` or React Native core `Modal`.

Animation/swipe/custom-content additions remain future work and must preserve the current ownership boundary unless new evidence justifies a different contract.

## Dynamic Type / font-scaling boundary

Every text-bearing component in this catalog follows the Dynamic Type/font-scaling
contract in [`dynamic-type.md`](./dynamic-type.md): OS/browser-owned scaling only (no
`allowFontScaling={false}`, no BeeUI font-scale override), text wraps by default, and any
single-line truncation or fixed-height row is explicitly allow-listed with a rationale
there. A new component that introduces `numberOfLines` or a fixed-height row bearing
caller text must add itself to that contract's tables, not silently opt out of scaling.

## Pattern-driven promotion

Production patterns under `apps/showcase/patterns/**` are executable Showcase evidence sources, not automatic component requests.

Use the Rule of Two from `docs/roadmap.md`: compose existing primitives first, keep domain-specific composition local, and promote a public primitive only after repeated or behaviorally complex evidence justifies a stable contract.
