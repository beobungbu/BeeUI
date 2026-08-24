# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `BeeUIProvider` | application root | Provides safe-area measurement, a provider-local Toast runtime/viewport, and the shared anchored-overlay runtime/host; by default synchronizes measured insets to Uniwind safe-area utilities. Nested providers reuse the outer anchored-overlay runtime while Toast state remains scoped to the nearest BeeUIProvider. |
| `SafeArea` | layout | Explicit `react-native-safe-area-context` surface with caller-owned edge selection; BeeUI never silently adds system insets to generic screen/chrome components. |
| `Screen` | layout | Base application surface with semantic background and optional spacing; owns no safe-area or scroll behavior. |
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
| `DialogContent` | modal overlay | Modal surface with semantic backdrop/close paths plus registered title/description accessibility relationships while preserving explicit caller overrides. `overFullScreen` is transparent; native `fullScreen`/`pageSheet`/`formSheet` remain non-transparent so RN can honor the requested presentation. `onRequestClose` fires exactly once per native request; Android Modal back is child-first for a nested anchored overlay, while iOS/other native request-close applies the Dialog close policy directly. `dismissOnRequestClose={false}` makes that request notification-only. |
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
| `PopoverTrigger` | anchored overlay | Button-compatible anchor/toggle. Preserves caller accessibility state, adds `expanded`, and links to the content through React Native's typed `aria-controls` surface. |
| `PopoverContent` | anchored overlay | Non-modal anchored surface using shared window-coordinate measurement, geometry flip/shift/collision, safe-area policy, optional keyboard avoidance, and topmost-only dismissal. Unresolved content measures invisibly offscreen rather than flashing at `(0,0)`. |
| `PopoverTitle` | anchored overlay | Heading that registers stable native label metadata and primitive text with its Popover content. |
| `PopoverDescription` | anchored overlay | Supporting text that registers a primitive-text accessibility hint with its Popover content. |
| `PopoverClose` | anchored overlay | Button-compatible explicit close action. |
| `DropdownMenu` | anchored overlay | Controlled/uncontrolled non-modal menu state layered on the same shared anchored-overlay runtime as Popover. |
| `DropdownMenuTrigger` | anchored overlay | Button-compatible measured anchor that preserves caller accessibility state, adds `expanded`, and links to menu content. |
| `DropdownMenuContent` | anchored overlay | Menu surface defaulting to bottom/start placement with flip/shift, safe-area collision handling, unresolved-geometry gating, topmost-only dismissal, and deterministic Web current-item keyboard navigation. |
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
2. establish protected iOS/Android runtime interaction smoke beyond the existing compile gates;
3. deepen the semantic theme/token system;
4. production `Select` — **implemented in Wave 2A** on the accepted overlay runtime; `Tooltip` remains separate work with its own hover/focus/accessibility contract;
5. implement `Sheet` as a separate gesture/keyboard/safe-area behavior class if BeeUI claims first-class modern mobile coverage;
6. add `Slider` and later high-value components only when cross-domain evidence supports them.

Additional form-group integrations should be added only where React Native exposes an unambiguous group semantic. `VisuallyHidden` remains restricted to non-interactive assistive content.

## Anchored overlay components

The shared anchored-overlay geometry/runtime kernels are accepted, with public `Popover`, `DropdownMenu`, and `Select` layered on them.

The portal transport preserves consumer React context declared below `BeeUIProvider` (web `ReactDOM.createPortal`, native `react-native-teleport`), with a defensive legacy fallback that does not preserve it. Overlays inside a `Dialog` target a modal-local host. See `docs/anchored-overlays.md`.

`Select` does not alias `DropdownMenu`: menu items activate commands, while Select options represent one persistent current value. Future `Tooltip` work must likewise keep its own semantics while reusing the transport/runtime instead of cloning it.

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

## Sheet boundary

`Sheet` remains separately gated because gesture, snap-point, keyboard, safe-area, scrolling, hardware-back, and accessibility behavior need stronger native runtime verification than a centered modal.

## Toast boundary

Toast v1 is implemented as a separate transient-notification runtime. It is not anchor-positioned and does not use `OverlayPortal` or React Native core `Modal`.

Animation/swipe/custom-content additions remain future work and must preserve the current ownership boundary unless new evidence justifies a different contract.

## Pattern-driven promotion

Production patterns under `apps/showcase/patterns/**` are executable Showcase evidence sources, not automatic component requests.

Use the Rule of Two from `docs/roadmap.md`: compose existing primitives first, keep domain-specific composition local, and promote a public primitive only after repeated or behaviorally complex evidence justifies a stable contract.
