# WS-A · a11y + forms + i18n copy

Owned files (packages/ui/src/components): tabs.tsx, pagination.tsx, stepper.tsx, accordion.tsx, collapsible.tsx, progress.tsx, calendar.tsx, dropdown-menu.tsx, switch.tsx, checkbox.tsx, radio.tsx, field.tsx, field-context.ts, form-group.tsx, form-group-context.ts, label.tsx, alert-dialog.tsx, segmented-control.tsx, password-input.tsx. New tests in apps/showcase/__tests__/. Docs pages for these components in apps/docs/src/content/docs/components/ ONLY where behavior changes need a note.

Issues (read each with `gh issue view N --repo beobungbu/BeeUI`):
- #553 Tabs/Pagination/Stepper: Web must expose aria-selected / aria-current (RNW does not derive from accessibilityState.selected).
- #555 Accordion/Collapsible trigger: aria-expanded on Web.
- #556 Progress: aria-valuemin/now/max on Web.
- #557 Calendar selected day: aria-selected.
- #558 DropdownMenuTrigger: aria-haspopup="menu". #607 item 2: hover state + forward onHoverIn/onHoverOut/onPointerEnter on web. #603 item 2: DropdownMenuItem `description` (secondary line) slot.
- #559 Switch: accessibilityLabelledBy must label the interactive <input role="switch">. #611 item 4: disabled Switch must still show on vs off.
- #570 Field: accessible name must be on the control only (remove duplicate aria-label from label element).
- #571 Field/FormGroup label relationship must reach Switch, Checkbox, Checkbox lists (consume field context in those controls).
- #601 Field required: do not append raw English "required"; use accessibilityRequired / aria-required and let callers pass localized copy via a `requiredLabel` prop defaulting to none.
- #587 AlertDialog content role="alertdialog" on web.
- #613 item 1: SegmentedControl radiogroup gets an accessible name (accessibilityLabel prop → aria-label; also from Field label context).
- #600 SegmentedControl: wrap labels at large text instead of truncating mid-glyph.
- #610 PasswordInput: showLabel/hideLabel must change visible text, not only accessible name; no hardcoded English fallback in visible UI.
- #611 items 2,3: Stepper `orientation="horizontal"|"vertical"` prop; document 1-based clamp in props JSDoc and dev warning on 0.

Rules: follow AGENTS.md (merge caller a11y state, no dynamic class names, semantic tokens only). Add/extend jest tests in apps/showcase/__tests__ (web ARIA via react-native-web render; see selection-control-aria.test.tsx, issue-276-structural-status-a11y.test.tsx for style). Export any new props/types from packages/ui/src/index.ts if needed; run `pnpm ui-exports:generate` then `pnpm ui-exports:check` if exports change.
