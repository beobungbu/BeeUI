# BeeUI component catalog

This file is the canonical component inventory for BeeUI. A component is considered `foundation` only when its public API is engine-neutral, semantic-token based, and has an accessibility contract.

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
| `Checkbox` | form | Controlled boolean/indeterminate state with checkbox semantics. |
| `Radio` | form | Controlled radio item; works standalone or in `RadioGroup`. |
| `RadioGroup` | form | Controlled value coordination and radiogroup semantics. |
| `Switch` | form | Native `Switch` with semantic track/thumb colors. |
| `Card` | surface | Surface variants and spacing contract. |
| `Badge` | data display | Semantic status variants with paired foreground tokens. |
| `Avatar` | data display | Image/fallback behavior with size variants. |
| `Progress` | feedback | Clamped progress value and native progressbar semantics. |
| `Spinner` | feedback | Native indicator with semantic tone mapping. |
| `Skeleton` | feedback | Decorative static loading surface. |
| `Separator` | layout | Decorative by default; semantic separator when requested. |

## Next components

The next safe tranche should focus on components that do not require an overlay/focus-management dependency:

- form field composition (`Field`, label, description, error)
- list item / settings item primitives
- tabs and accordion if their behavior contract can be kept dependency-light
- empty/error state compositions

## Overlay components

`Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`, `Toast`, and `Select` are intentionally deferred until BeeUI locks a behavior layer that works across Expo, Expo prebuild, bare React Native, and web.

Do not implement these as ad-hoc `Modal` wrappers merely to fill out the catalog. Focus management, portals, escape/back handling, keyboard behavior, and accessibility are part of their contract.
