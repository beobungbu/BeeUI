# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `BeeUIProvider` | application root | Provides safe-area measurement and the shared anchored-overlay runtime/host; by default synchronizes measured insets to Uniwind safe-area utilities. Nested providers reuse the outer overlay runtime. |
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
| `DialogContent` | modal overlay | Modal surface with semantic backdrop/close paths plus registered title/description accessibility relationships while preserving explicit caller overrides. Native request-close paths may be notification-only through `dismissOnRequestClose={false}` for higher-level modal contracts. |
| `DialogTitle` | modal overlay | Semantic dialog heading that registers stable label metadata with its containing `DialogContent`. |
| `DialogDescription` | modal overlay | Muted supporting text that provides a primitive-text accessibility hint to its containing dialog. |
| `DialogFooter` | modal overlay | Action-row composition. |
| `DialogClose` | modal overlay | Button-compatible close control. |
| `AlertDialog` | modal overlay | Confirmation/destructive modal state built on the accepted Dialog/core-Modal kernel; it shares Dialog's controlled/uncontrolled state contract without introducing another overlay engine. |
| `AlertDialogTrigger` | modal overlay | Button-compatible confirmation trigger. |
| `AlertDialogContent` | modal overlay | Alert-dialog surface that never closes from backdrop presses. Android hardware-back/accessibility escape behave like cancellation by default and can be made notification-only with `cancelOnRequestClose={false}`. |
| `AlertDialogTitle` | modal overlay | Dialog-kernel title semantics for confirmation content. |
| `AlertDialogDescription` | modal overlay | Dialog-kernel supporting description/accessibility hint. |
| `AlertDialogFooter` | modal overlay | Confirmation action-row composition. |
| `AlertDialogCancel` | modal overlay | Close action defaulting to the outline button variant while preserving caller handlers. |
| `AlertDialogAction` | modal overlay | Close action defaulting to the destructive button variant while preserving caller handlers. |
| `Popover` | anchored overlay | Controlled/uncontrolled non-modal anchored state. Controlled use requires `open` + `onOpenChange`; uncontrolled use supports `defaultOpen`. Reuses the shared BeeUIProvider overlay runtime rather than a private portal/Modal engine. |
| `PopoverTrigger` | anchored overlay | Button-compatible anchor/toggle. Preserves caller accessibility state, adds `expanded`, and links to the content through React Native's typed `aria-controls` surface. |
| `PopoverContent` | anchored overlay | Non-modal anchored surface using shared window-coordinate measurement, geometry flip/shift/collision, safe-area policy, optional keyboard avoidance, and topmost-only dismissal. Unresolved content measures invisibly offscreen rather than flashing at `(0,0)`. |
| `PopoverTitle` | anchored overlay | Heading that registers stable native label metadata and primitive text with its Popover content. |
| `PopoverDescription` | anchored overlay | Supporting text that registers a primitive-text accessibility hint with its Popover content. |
| `PopoverClose` | anchored overlay | Button-compatible explicit close action. |
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

## Next components

The next safe tranche should remain dependency-light and avoid pretending complex native behavior is solved. `DropdownMenu` is the next anchored-overlay component because the shared host/measurement/dismiss kernel and public Popover composition are now established, but menu semantics must add keyboard navigation, roving/current-item behavior, disabled/item roles, and selection/close rules rather than simply aliasing Popover.

Additional form-group integrations should only be added where the target React Native control exposes unambiguous group semantics. `VisuallyHidden` remains restricted to non-interactive assistive content. Interactive controls must carry their own accessible name/state rather than relying on an off-screen control.

`Sheet` remains separately gated because gesture, keyboard, safe-area, and presentation behavior need stronger platform verification than a centered modal.

## Anchored overlay components

The shared anchored-overlay geometry and runtime kernels are accepted, and `Popover` is the first public component layered on them. `DropdownMenu`, `Select`, and `Tooltip` remain deferred until their component-specific keyboard/focus/accessibility contracts are implemented and verified. `Toast` is not anchor-positioned and follows a separate transient-notification contract.

Do not approximate anchored overlays with full-screen modal behavior. Positioning, collision handling, nested overlays, focus, keyboard semantics, and accessibility remain part of each component's contract.
