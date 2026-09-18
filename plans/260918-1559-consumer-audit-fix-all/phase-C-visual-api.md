# WS-C · dialog, table, visual/dark, button family, list/chip/badge API gaps, toast/date-picker native

Owned files (packages/ui/src/components): dialog.tsx, table.tsx, table.web.tsx, table-shared.ts, avatar.tsx, icon-button.tsx, button.tsx, badge.tsx, chip.tsx, list-item.tsx, list-group.tsx, separator.tsx, toast.tsx, date-picker*.ts(x), timeline.tsx. New tests in apps/showcase/__tests__/. Showcase examples in apps/showcase only if a new prop needs an example.

Issues (read each with `gh issue view N --repo beobungbu/BeeUI`):
- #593 DialogTrigger variant="outline" paints fill with primary label colour in dark → fix token usage.
- #607 item 1: Dialog renders two nested role="dialog" nodes → positioner must not carry role/aria-modal.
- #608 native DialogContent does not clip children (overflow hidden).
- #604 web dark: Table header cells render raw <th> text with document colour → apply text-foreground/muted token to header cells.
- #595 TableCell `align="start"|"center"|"end"` prop (also fix className right-align).
- #596 TableRow `selected` must paint a selected background (bg-accent or token) besides aria-selected.
- #615 Table layout="stacked" must keep row grouping on web (cells inside a row element with role=row).
- #546 Table web: accessibilityLabel must map to aria-label on table/rows/cells.
- #572 TableRow `onPress` (pressable row, role=button/link semantics, keyboard Enter/Space on web) and document the row-to-detail pattern in the Table docs page.
- #597 item 3: Badge as direct child of TableCell stretches; Badge should hug its text (self-start / inline layout).
- #605 web dark: Avatar fallback initials paint black → text-foreground token.
- #568 IconButton `size` prop aligned with Button sizes. #613 item 4: IconButton `count` slot (badge overlay) with accessible label.
- #602 ButtonLabel: respect numberOfLines and wrap at large text instead of clamping to one line.
- #597 item 1: Button labelClassName must apply when child is an explicit ButtonLabel (merge) or be documented; prefer merge.
- #613 item 3: Badge variant="outline" must be visually distinct from disabled inputs (border-foreground/40 + text-foreground).
- #573 item 1: Chip static/tag variant (no interactive role) e.g. `interactive={false}` or `<Chip as="tag">`. #573 item 2: ChipGroup single mode allows deselect (`allowDeselect` prop) → value null.
- #566 item 3: ListItem `active`/`selected` prop with aria-current/selected and tokenized background. #597 item 5: ListItem keeps accessible name when `title` is a node (accept `accessibilityLabel`; derive from string children where possible).
- #611 item 6: Separator orientation="vertical" stretches by default (self-stretch) so it draws without explicit height.
- #586 item 1: Toast placement prop (`placement: "top"|"bottom"`, default bottom on native) + document. #586 item 2: DatePicker native adapter must not forward deprecated onChange to @react-native-community/datetimepicker (use current callback).
- #573 item 3: DatePicker.locale localizes its own copy (placeholder "Select date", etc.) using date-picker-locale.ts; add vi-VN.

Rules: AGENTS.md. Jest tests in apps/showcase/__tests__ (see table.test.tsx, toast.test.tsx, issue-173-date-picker-native.test.tsx, component-contracts.test.tsx). Run `pnpm ui-exports:generate && pnpm ui-exports:check` if exports change.
