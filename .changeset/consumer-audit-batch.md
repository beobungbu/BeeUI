---
"@beemvp/beeui-ui": minor
"@beemvp/beeui-tokens": minor
---

Consumer-audit batch from the BeePOS and BeeECOM validation programs (BeeUI #543–#615).

Additive public surface:

- New `Toolbar` / `ToolbarItem` family with priority-based overflow into a dropdown menu.
- `Tabs`: `TabsList scrollable` and `addon`; `TabsTrigger closable`, `onClose`, `closeAccessibilityLabel`.
- `OTPInput appearance="segmented"`.
- `Table density` (new `spacing.row-dense` 48 token), `TableCell align`, `TableRow onPress`; `TableAlign` and `TableDensity` types.
- `BeeUIProvider toastPlacement` and the `ToastPlacement` type; toasts default to the bottom edge on native.
- `IconButton size` and `count`; `ListItem active`; `Chip` static tag variant and `ChipGroup allowDeselect`; `DropdownMenuItem description`; `Stepper orientation`; `Screen scroll`; `SearchInput trailing`; `Field requiredLabel`.

Behaviour fixes (Web ARIA on Tabs/Pagination/Stepper/Accordion/Collapsible/Progress/Calendar/DropdownMenu/Switch/Field, AlertDialog role, single dialog owner, scoped `BeeThemeScope` CSS emission, Sheet viewport geometry, Select mouse pick, SafeArea className, Input Dynamic Type and VoiceOver value, KeyboardAwareScreen scroll-into-view on iOS, dark-mode table header and avatar contrast) and the localized-copy contract for `Field required` and `PasswordInput` are documented per component page.
