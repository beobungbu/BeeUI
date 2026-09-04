---
title: All components
description: Source-driven BeeUI public component reference.
---

This index is generated from the public Registry + `@beemvp/beeui-ui` export map. It currently contains **62** stable public component families; adding or removing a public Registry component changes this inventory automatically and is checked by CI.

## Actions & controls

- **[Button](/docs/components/button/)** — Accessible pressable with variant/size/loading/disabled states and an optional label primitive. · [Showcase](/showcase/?surface=component&id=button&example=basic)
- **[Icon Button](/docs/components/icon-button/)** — 44px icon-only action; an accessible label is required. · [Showcase](/showcase/?surface=component&id=icon-button&example=basic)
- **[Segmented Control](/docs/components/segmented-control/)** — Compact mutually-exclusive selection surface with radiogroup semantics. · [Showcase](/showcase/?surface=component&id=segmented-control&example=basic)

## Data display

- **[Avatar](/docs/components/avatar/)** — Image-with-fallback identity surface with size variants and source-keyed failure reset. · [Showcase](/showcase/?surface=component&id=avatar&example=basic)
- **[Badge](/docs/components/badge/)** — Compact semantic status label with paired foreground/background tokens. · [Showcase](/showcase/?surface=component&id=badge&example=basic)
- **[Chip](/docs/components/chip/)** — Standalone toggle or value-scoped group item with button/radio/checkbox semantics. · [Showcase](/showcase/?surface=component&id=chip&example=basic)
- **[Description List](/docs/components/description-list/)** — Read-only grouped label/value metadata composition with no data-state ownership. · [Showcase](/showcase/?surface=component&id=description-list&example=basic)
- **[List Group](/docs/components/list-group/)** — Bordered grouped-row surface with list container semantics and an aligned header. · [Showcase](/showcase/?surface=component&id=list-group&example=basic)
- **[List Item](/docs/components/list-item/)** — Grouped row (with a settings-row specialization) that synthesizes accessible names from primitive content when interactive. · [Showcase](/showcase/?surface=component&id=list-item&example=basic)
- **[Metadata Row](/docs/components/metadata-row/)** — Read-only label/value metadata row primitive. · [Showcase](/showcase/?surface=component&id=metadata-row&example=basic)
- **[Separator](/docs/components/separator/)** — Decorative-by-default divider (semantic when requested); vertical orientation stretches across the cross axis. · [Showcase](/showcase/?surface=component&id=separator&example=basic)
- **[Stat](/docs/components/stat/)** — Layout-only metric composition (label/value/help text) with no formatting or state ownership. · [Showcase](/showcase/?surface=component&id=stat&example=basic)
- **[Table](/docs/components/table/)** — Semantic data-table primitives that render real table/th scope/aria-sort semantics on Web. · [Showcase](/showcase/?surface=component&id=table&example=basic)
- **[Text](/docs/components/text/)** — Semantic typography primitive with type/tone variants that honors OS/browser font scaling. · [Showcase](/showcase/?surface=component&id=text&example=basic)
- **[Timeline](/docs/components/timeline/)** — Read-only ordered history composition with semantic marker states; owns no workflow state. · [Showcase](/showcase/?surface=component&id=timeline&example=basic)

## Forms & selection

- **[Calendar](/docs/components/calendar/)** — Month-grid date-selection surface; owns no field, popover, or input chrome. · [Showcase](/showcase/?surface=component&id=calendar&example=basic)
- **[Checkbox](/docs/components/checkbox/)** — Controlled boolean/indeterminate checkbox; enabled usage without onCheckedChange warns in development. · [Showcase](/showcase/?surface=component&id=checkbox&example=basic)
- **[Date Picker](/docs/components/date-picker/)** — Native system date-picker field backed by @react-native-community/datetimepicker. · [Showcase](/showcase/?surface=component&id=date-picker&example=basic)
- **[Date Time Picker](/docs/components/date-time-picker/)** — Native combined date-and-time picker field backed by @react-native-community/datetimepicker. · [Showcase](/showcase/?surface=component&id=date-time-picker&example=basic)
- **[Field](/docs/components/field/)** — Label/description/error composition for text-entry controls; wires accessible label and required relationships to text inputs only. · [Showcase](/showcase/?surface=component&id=field&example=basic)
- **[Form Group](/docs/components/form-group/)** — Structural legend/description/error grouping for related controls without becoming one accessible parent element. · [Showcase](/showcase/?surface=component&id=form-group&example=basic)
- **[Form Message](/docs/components/form-message/)** — Destructive form feedback (with muted HelperText variant) using polite live-region semantics. · [Showcase](/showcase/?surface=component&id=form-message&example=basic)
- **[Input](/docs/components/input/)** — Single-line text input with semantic focus/invalid/disabled states and Field-provided accessibility. · [Showcase](/showcase/?surface=component&id=input&example=basic)
- **[Label](/docs/components/label/)** — Semantic form/control label with accessible required-state wording and optional nativeID linkage. · [Showcase](/showcase/?surface=component&id=label&example=basic)
- **[OTP Input](/docs/components/otp-input/)** — Controlled/uncontrolled one-time-code input with numeric normalization and per-value completion callbacks. · [Showcase](/showcase/?surface=component&id=otp-input&example=basic)
- **[Password Input](/docs/components/password-input/)** — Password field with visibility toggle and safe keyboard/autofill defaults; caller overrides remain authoritative. · [Showcase](/showcase/?surface=component&id=password-input&example=basic)
- **[Radio](/docs/components/radio/)** — Controlled radio item and RadioGroup coordinator with native radiogroup semantics. · [Showcase](/showcase/?surface=component&id=radio&example=basic)
- **[Search Input](/docs/components/search-input/)** — Search-keyboard input layered on Input; clearing a non-empty query emits one onSearch('') reset. · [Showcase](/showcase/?surface=component&id=search-input&example=basic)
- **[Select](/docs/components/select/)** — Persistent single string-value selection with anchored option surface and listbox semantics on Web. · [Showcase](/showcase/?surface=component&id=select&example=basic)
- **[Switch](/docs/components/switch/)** — Controlled native switch with semantic track/thumb colors; enabled usage without onValueChange warns in development. · [Showcase](/showcase/?surface=component&id=switch&example=basic)
- **[Textarea](/docs/components/textarea/)** — Multiline text input using the same semantic contract as Input. · [Showcase](/showcase/?surface=component&id=textarea&example=basic)

## Layout & surfaces

- **[Bottom Action Bar](/docs/components/bottom-action-bar/)** — Bottom-anchored primary-action surface; safe-area ownership stays with the app shell. · [Showcase](/showcase/?surface=component&id=bottom-action-bar&example=basic)
- **[Box](/docs/components/box/)** — Thin View primitive with no design assumptions, for ad-hoc layout. · [Showcase](/showcase/?surface=component&id=box&example=basic)
- **[Card](/docs/components/card/)** — Elevated/outlined surface with variant and spacing contract. · [Showcase](/showcase/?surface=component&id=card&example=basic)
- **[Keyboard Aware Screen](/docs/components/keyboard-aware-screen/)** — Scrollable form-screen shell with bounded width, explicit safe-area ownership, and platform keyboard handling. · [Showcase](/showcase/?surface=component&id=keyboard-aware-screen&example=basic)
- **[Safe Area](/docs/components/safe-area/)** — BeeUIProvider application root plus an explicit SafeArea surface with caller-owned edge selection. · [Showcase](/showcase/?surface=component&id=safe-area&example=basic)
- **[Screen](/docs/components/screen/)** — Base application surface with semantic background and optional spacing; owns no safe-area or scroll behavior. · [Showcase](/showcase/?surface=component&id=screen&example=basic)
- **[Section](/docs/components/section/)** — Title/description/action/content composition for screen sections. · [Showcase](/showcase/?surface=component&id=section&example=basic)
- **[Stack](/docs/components/stack/)** — Typed direction/gap/alignment/wrap layout over View, with HStack/VStack specializations. · [Showcase](/showcase/?surface=component&id=stack&example=basic)

## Navigation & disclosure

- **[Accordion](/docs/components/accordion/)** — Single-value controlled/uncontrolled disclosure group where one item expands at a time. · [Showcase](/showcase/?surface=component&id=accordion&example=basic)
- **[App Header](/docs/components/app-header/)** — Title/description/leading/trailing screen-header composition; owns no navigation library. · [Showcase](/showcase/?surface=component&id=app-header&example=basic)
- **[Breadcrumb](/docs/components/breadcrumb/)** — Router-neutral breadcrumb trail with decorative separators hidden from accessibility. · [Showcase](/showcase/?surface=component&id=breadcrumb&example=basic)
- **[Collapsible](/docs/components/collapsible/)** — Controlled/uncontrolled single-region disclosure with content mounted only while open. · [Showcase](/showcase/?surface=component&id=collapsible&example=basic)
- **[Link](/docs/components/link/)** — Link semantics over Pressable; owns no navigation library or routing behavior. · [Showcase](/showcase/?surface=component&id=link&example=basic)
- **[Pagination](/docs/components/pagination/)** — Controlled page/page-count context with normalized boundaries and type-enforced page/prev/next items. · [Showcase](/showcase/?surface=component&id=pagination&example=basic)
- **[Stepper](/docs/components/stepper/)** — Controlled current-step context with finite normalization and duplicate-step fail-safe; owns no workflow state. · [Showcase](/showcase/?surface=component&id=stepper&example=basic)
- **[Tabs](/docs/components/tabs/)** — Controlled tab set sharing state across list/triggers/content; inactive panels are not mounted. · [Showcase](/showcase/?surface=component&id=tabs&example=basic)

## Overlays & feedback

- **[Alert Banner](/docs/components/alert-banner/)** — Inline semantic status callout with live-region announcement for feedback that stays on screen. · [Showcase](/showcase/?surface=component&id=alert-banner&example=basic)
- **[Alert Dialog](/docs/components/alert-dialog/)** — Confirmation/destructive modal built on the Dialog kernel; only explicit Cancel/Action closes it. · [Showcase](/showcase/?surface=component&id=alert-dialog&example=basic)
- **[Dialog](/docs/components/dialog/)** — Controlled/uncontrolled modal backed by React Native core Modal, with a real Web focus trap and Escape dismissal. · [Showcase](/showcase/?surface=component&id=dialog&example=basic)
- **[Dropdown Menu](/docs/components/dropdown-menu/)** — Non-modal action menu on the shared anchored-overlay runtime, with items, checkbox items, and radio groups. · [Showcase](/showcase/?surface=component&id=dropdown-menu&example=basic)
- **[Popover](/docs/components/popover/)** — Non-modal anchored surface on the shared overlay runtime with flip/shift/collision and safe-area policy. · [Showcase](/showcase/?surface=component&id=popover&example=basic)
- **[Progress](/docs/components/progress/)** — Clamped determinate progress bar with native progressbar semantics. · [Showcase](/showcase/?surface=component&id=progress&example=basic)
- **[Sheet](/docs/components/sheet/)** — Gesture-driven bottom sheet with detents on the shared overlay runtime. · [Showcase](/showcase/?surface=component&id=sheet&example=basic)
- **[Skeleton](/docs/components/skeleton/)** — Decorative static loading placeholder surface. · [Showcase](/showcase/?surface=component&id=skeleton&example=basic)
- **[Spinner](/docs/components/spinner/)** — Native activity indicator with semantic tone mapping. · [Showcase](/showcase/?surface=component&id=spinner&example=basic)
- **[State Message](/docs/components/state-message/)** — Empty-state and error-state (with retry) composition for zero/failure surfaces. · [Showcase](/showcase/?surface=component&id=state-message&example=basic)
- **[Toast](/docs/components/toast/)** — Provider-scoped toast runtime exposed via useToast (show/dismiss/dismissAll) with FIFO queueing and safe-area-aware stacking. · [Showcase](/showcase/?surface=component&id=toast&example=basic)
- **[Tooltip](/docs/components/tooltip/)** — Non-interactive contextual annotation (ADR-005): a hover/focus delay state machine plus an anchored, non-focusable bubble. · [Showcase](/showcase/?surface=component&id=tooltip&example=basic)

## Theming & utilities

- **[Theme Scope](/docs/components/theme-scope/)** — BeeThemeScope subtree boundary that applies a scoped theme override to its descendants. · [Showcase](/showcase/?surface=component&id=theme-scope&example=basic)
- **[Use Bee Token](/docs/components/use-bee-token/)** — Read resolved design-token values at runtime via useBeeToken (hook) and getBeeToken (imperative). · [Showcase](/showcase/?surface=component&id=use-bee-token&example=basic)
- **[Visually Hidden](/docs/components/visually-hidden/)** — Keeps non-interactive assistive content in the accessibility tree while removing it from visual layout. · [Showcase](/showcase/?surface=component&id=visually-hidden&example=basic)
