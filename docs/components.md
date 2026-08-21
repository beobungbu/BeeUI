# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `Box` | layout | Thin `View` primitive; no design assumptions. |
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
| `AppHeader` | application chrome | Title/description/leading/trailing composition; owns no navigation. |
| `BottomActionBar` | application chrome | Bottom action surface; safe-area ownership stays with the application shell. |
| `ListItem` | application pattern | Optional press behavior, inferred labels, leading/trailing slots. |
| `SettingsItem` | application pattern | Settings row specialization with value/trailing content. |
| `Card` | surface | Surface variants and spacing contract. |
| `Badge` | data display | Semantic status variants with paired foreground tokens. |
| `Avatar` | data display | Image/fallback behavior with size variants. |
| `Progress` | feedback | Clamped progress value and native progressbar semantics. |
| `Spinner` | feedback | Native indicator with semantic tone mapping. |
| `Skeleton` | feedback | Decorative static loading surface. |
| `Separator` | layout | Decorative by default; semantic separator when requested. |
| `EmptyState` | state | Neutral empty-state composition with optional action. |
| `ErrorState` | state | Destructive error-state specialization with optional retry action. |

## Next components

The next safe tranche should focus on application patterns that remain dependency-light:

- form affordances and validation helpers
- screen/section/container composition
- list grouping and metadata rows
- lightweight pagination / segmented controls

## Overlay components

`Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`, `Toast`, and `Select` are intentionally deferred until BeeUI locks a behavior layer that works across Expo, Expo prebuild, bare React Native, and web.

Do not implement these as ad-hoc `Modal` wrappers merely to fill out the catalog. Focus management, portals, escape/back handling, keyboard behavior, and accessibility are part of their contract.
