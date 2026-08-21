# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `Screen` | layout | Base application surface with semantic background and optional spacing; owns no safe-area behavior. |
| `Box` | layout | Thin `View` primitive; no design assumptions. |
| `Stack` | layout | Typed direction/gap/alignment/wrap composition over `View`; owns no responsive policy. |
| `HStack` | layout | Horizontal specialization of `Stack`. |
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
| `Field` | form | Label/description/error composition; generates stable label `nativeID` metadata and propagates state/accessibility metadata to text controls. |
| `HelperText` | form | Muted supporting text for form affordances without hidden state. |
| `FormMessage` | form | Destructive form feedback with polite live-region semantics by default. |
| `SearchInput` | form | Search keyboard/submit semantics layered on `Input`; clearing a previously non-empty query emits one `onSearch('')` reset signal. |
| `PasswordInput` | form | Password visibility composition with safe keyboard/autofill defaults; explicit caller overrides remain authoritative. |
| `OTPInput` | form | Controlled/uncontrolled one-time-code input with numeric normalization, safe text-entry defaults, and completion callbacks deduplicated per completed value until the input becomes incomplete again. |
| `Checkbox` | form | Controlled boolean/indeterminate state with checkbox semantics. |
| `Radio` | form | Controlled radio item; works standalone or in `RadioGroup`. |
| `RadioGroup` | form | Controlled value coordination and radiogroup semantics. |
| `Switch` | form | Native `Switch` with semantic track/thumb colors. |
| `Chip` | selection | Standalone toggle or value-scoped group item with button/radio/checkbox semantics; grouped items without a value fail safe as disabled and warn in development. |
| `ChipGroup` | selection | Controlled/uncontrolled single or multiple selection coordination. |
| `SegmentedControl` | selection | Controlled compact mutually exclusive selection surface with `radiogroup` semantics. |
| `SegmentedControlItem` | selection | Accessible radio-style segment with checked-state semantics. |
| `Pagination` | navigation | Controlled page/page-count context with normalized boundaries. |
| `PaginationItem` | navigation | Type-enforced page/previous/next action; page items require a page number, malformed runtime page items fail safe as disabled, and boundary/selected semantics are enforced. |
| `Breadcrumb` | navigation | Router-neutral breadcrumb composition with decorative separators hidden from accessibility. |
| `BreadcrumbItem` | navigation | Link semantics for navigable ancestors and non-interactive selected semantics for the current location. |
| `Stepper` | navigation | Controlled current-step context with finite normalization and duplicate normalized-step detection; owns no application workflow state. |
| `StepperItem` | navigation | Current/completed/disabled step presentation with accessible position; duplicate normalized step values fail safe as disabled. |
| `Tabs` | navigation | Controlled tab state shared across list/triggers/content. |
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
| `DialogTrigger` | modal overlay | Button-compatible trigger with expanded-state semantics. |
| `DialogContent` | modal overlay | Modal surface with semantic backdrop/close paths plus registered title/description accessibility relationships while preserving explicit caller overrides. |
| `DialogTitle` | modal overlay | Semantic dialog heading that registers stable label metadata with its containing `DialogContent`. |
| `DialogDescription` | modal overlay | Muted supporting text that provides a primitive-text accessibility hint to its containing dialog. |
| `DialogFooter` | modal overlay | Action-row composition. |
| `DialogClose` | modal overlay | Button-compatible close control. |
| `AppHeader` | application chrome | Title/description/leading/trailing composition; owns no navigation. |
| `BottomActionBar` | application chrome | Bottom action surface; safe-area ownership stays with the application shell. |
| `ListGroup` | application pattern | Semantic bordered surface for grouped application rows without taking ownership of row behavior. |
| `ListGroupHeader` | application pattern | Title/description/trailing header composition for grouped rows. |
| `ListItem` | application pattern | Optional press behavior; interactive rows synthesize deterministic accessible names from primitive title/description/trailing content unless the caller supplies an explicit label. |
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
| `Timeline` | data display | Read-only ordered history composition that derives terminal connector placement from rendered children. |
| `TimelineItem` | data display | Title/description/meta event presentation with semantic marker states and no workflow ownership. |
| `Progress` | feedback | Clamped progress value and native progressbar semantics. |
| `Spinner` | feedback | Native indicator with semantic tone mapping. |
| `Skeleton` | feedback | Decorative static loading surface. |
| `Separator` | layout | Decorative by default; semantic separator when requested; vertical orientation stretches across the parent's cross axis instead of relying on percentage height. |
| `EmptyState` | state | Neutral empty-state composition with optional action. |
| `ErrorState` | state | Destructive error-state specialization with optional retry action. |

## Next components

The next safe tranche should remain dependency-light and avoid pretending complex native behavior is solved:

- `AlertDialog` only after validating its semantic contract against the accepted core-Modal behavior kernel
- stronger form grouping/legend composition where native accessibility semantics are unambiguous
- read-only data presentation only where it adds behavior beyond `MetadataRow`, `DescriptionList`, `Stat`, and `Timeline`

`VisuallyHidden` is intentionally restricted to non-interactive assistive content. Interactive controls must carry their own accessible name/state rather than relying on an off-screen control.

`Sheet` remains separately gated because gesture, keyboard, safe-area, and presentation behavior need stronger platform verification than a centered modal.

## Anchored overlay components

`Popover`, `DropdownMenu`, `Tooltip`, `Toast`, and `Select` remain deferred until BeeUI locks an anchored behavior layer that works across Expo, Expo prebuild, bare React Native, and web.

Do not approximate anchored overlays with full-screen modal behavior. Positioning, collision handling, nested overlays, focus, keyboard semantics, and accessibility are part of their contract.
