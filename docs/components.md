# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its stable behavior/variant API is semantic-token based, accessibility behavior is defined, and any implementation-specific styling escape hatch is clearly optional.

## Foundation components

| Component | Category | Key contract |
| --- | --- | --- |
| `Box` | layout | Thin `View` primitive; no design assumptions. |
| `Text` | typography | Semantic type/tone variants. |
| `Separator` | layout | Decorative by default; semantic separator when requested. |
| `Button` / `ButtonLabel` | action | Accessible pressable, variants, sizes, loading/disabled states. |
| `IconButton` | action | 44px icon action; accessible label is required. |
| `Input` / `Textarea` | form | Semantic focus/invalid/disabled states and themed native colors. |
| `Field` | form | Label/description/error composition and state propagation. |
| `Checkbox` | form | Controlled boolean/indeterminate state with checkbox semantics. |
| `Radio` / `RadioGroup` | form | Controlled radio item/group coordination. |
| `Switch` | form | Native switch with semantic track/thumb colors. |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | navigation | Controlled tab state with tab semantics. |
| `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` | disclosure | Controlled or uncontrolled disclosure with expanded semantics. |
| `Accordion` / `AccordionItem` / `AccordionTrigger` / `AccordionContent` | disclosure | Single-value controlled or uncontrolled accordion. |
| `ListItem` | application pattern | Accessible interactive row with leading/trailing slots. |
| `SettingsItem` | application pattern | ListItem specialization with semantic value/trailing slot. |
| `Card` | surface | Surface variants and spacing contract. |
| `Badge` | data display | Semantic status variants with paired foreground tokens. |
| `Avatar` | data display | Image/fallback behavior with size variants. |
| `Progress` | feedback | Clamped progress value and native progressbar semantics. |
| `Spinner` | feedback | Native indicator with semantic tone mapping. |
| `Skeleton` | feedback | Decorative static loading surface. |
| `EmptyState` | state | Reusable title/description/icon/action composition. |
| `ErrorState` | state | Error-specialized state composition using semantic destructive tone. |

## Next components

The next dependency-light tranche should focus on:

- form helpers beyond text controls
- app headers / bottom action bars
- search / password / OTP input compositions
- list and settings row refinements based on real app use

## Overlay components

`Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`, `Toast`, and `Select` are intentionally deferred until BeeUI locks a behavior layer that works across Expo, Expo prebuild, bare React Native, and web.

Do not implement these as ad-hoc `Modal` wrappers merely to fill out the catalog. Focus management, portals, escape/back handling, keyboard behavior, and accessibility are part of their contract.
