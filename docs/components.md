# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `Screen` | layout | Base application surface with semantic background and optional spacing; owns no safe-area behavior. |
| `Box` | layout | Thin `View` primitive; no design assumptions. |
| `Section` | layout | Title/description/action/content composition for screen sections. |
| `MetadataRow` | layout | Read-only label/value metadata presentation. |
| `Text` | typography | Semantic type/tone variants. |
| `Button` | action | Accessible pressable, variants, sizes, loading/disabled states. |
| `ButtonLabel` | action | Explicit label primitive for composed buttons. |
| `IconButton` | action | 44px icon action; accessible label is required. |
| `Input` | form | Semantic focus/invalid/disabled states and themed native colors. |
| `Textarea` | form | Multiline input using the same `Input` contract. |
| `Field` | form | Label/description/error composition; propagates state and accessibility metadata to text controls. |
| `SearchInput` | form | Search keyboard/submit semantics layered on `Input`. |
| `PasswordInput` | form | Password visibility composition without external icon dependencies. |
| `OTPInput` | form | Controlled/uncontrolled one-time-code input with numeric normalization and completion callback. |
| `Checkbox` | form | Controlled boolean/indeterminate state with checkbox semantics. |
| `Radio` | form | Controlled radio item; works standalone or in `RadioGroup`. |
| `RadioGroup` | form | Controlled value coordination and radiogroup semantics. |
| `Switch` | form | Native `Switch` with semantic track/thumb colors. |
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
| `Dialog` | modal overlay | Controlled/uncontrolled modal state backed by React Native core `Modal`. |
| `DialogTrigger` | modal overlay | Button-compatible trigger with expanded-state semantics. |
| `DialogContent` | modal overlay | Modal surface with semantic backdrop, Android/web close path, and modal accessibility hints. |
| `DialogTitle` | modal overlay | Semantic dialog heading. |
| `DialogDescription` | modal overlay | Muted dialog supporting text. |
| `DialogFooter` | modal overlay | Action-row composition. |
| `DialogClose` | modal overlay | Button-compatible close control. |
| `AppHeader` | application chrome | Title/description/leading/trailing composition; owns no navigation. |
| `BottomActionBar` | application chrome | Bottom action surface; safe-area ownership stays with the application shell. |
| `ListItem` | application pattern | Optional press behavior, inferred labels, leading/trailing slots. |
| `SettingsItem` | application pattern | Settings row specialization with value/trailing content. |
| `Card` | surface | Surface variants and spacing contract. |
| `AlertBanner` | feedback | Semantic inline status callout with live-region behavior and optional action. |
| `Badge` | data display | Semantic status variants with paired foreground tokens. |
| `Avatar` | data display | Image/fallback behavior with size variants. |
| `Progress` | feedback | Clamped progress value and native progressbar semantics. |
| `Spinner` | feedback | Native indicator with semantic tone mapping. |
| `Skeleton` | feedback | Decorative static loading surface. |
| `Separator` | layout | Decorative by default; semantic separator when requested. |
| `EmptyState` | state | Neutral empty-state composition with optional action. |
| `ErrorState` | state | Destructive error-state specialization with optional retry action. |

## Next components

The next safe tranche should focus on dependency-light interaction and application patterns:

- `AlertDialog` and `Sheet` validation on the accepted modal-class behavior kernel
- chips / filters / lightweight segmented controls
- form affordances and validation helpers
- list grouping and metadata variants
- lightweight pagination

## Anchored overlay components

`Popover`, `DropdownMenu`, `Tooltip`, `Toast`, and `Select` remain deferred until BeeUI locks an anchored behavior layer that works across Expo, Expo prebuild, bare React Native, and web.

Do not approximate anchored overlays with full-screen modal behavior. Positioning, collision handling, nested overlays, focus, keyboard semantics, and accessibility are part of their contract.
