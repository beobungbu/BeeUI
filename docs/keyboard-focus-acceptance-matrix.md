# Keyboard and focus acceptance matrix (#146, R3.8)

This is BeeUI's final, cross-cutting keyboard/focus acceptance record for the Web-capable
1.0 component set. It complements, and does not replace, each component's own local
keyboard contract (already implemented and tested by that component's own issue) and the
[Web accessibility audit gate](./web-accessibility-audit.md) (#145, axe-core rule
coverage). This matrix instead verifies the seven cross-cutting dimensions #146 names —
**visible focus, logical order, Escape, focus restoration, disabled-item skipping, no
focus behind overlays, and high-contrast focus visibility** — with real, keyboard-driven
Playwright evidence (never a `.focus()`/synthetic `onKeyDown` shortcut) across the
surfaces the issue enumerates: Forms, Buttons/Links, Tabs, menus, Select, Tooltip,
Dialog/AlertDialog, Sheet, Table, Calendar/Date/Time controls.

## How to read this table

- **Evidence** cites the exact spec file and test name(s) that assert the behavior in a
  real Chromium browser (`apps/visual-regression`, `pnpm --dir apps/visual-regression
  test`).
- **N/A** means the criterion does not apply to that component's actual, accepted
  contract (for example: an `AlertDialog` intentionally cannot be dismissed by Escape,
  the same way a backdrop press cannot dismiss it — see `docs/components.md`
  "AlertDialogContent"). N/A rows still link the test that proves the *actual* behavior,
  so the row is falsifiable, not merely asserted.
- Component-local keyboard behavior (arrow-key navigation *within* Select/Calendar/Table,
  typeahead, etc.) is evidenced by that component's own spec file and is not repeated
  here in detail.

## Matrix

| Component | Visible focus | Logical order | Escape | Focus restoration | Disabled-item skipping | No focus behind overlay | High-contrast focus visibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Buttons | ✅ branded ring (`bee-focus-ring`) | ✅ normal Tab order | N/A (no dismissal semantics) | N/A | ✅ `disabled`/`loading` both skipped | N/A (not an overlay) | ✅ `high-contrast-focus.spec.ts` |
| Links | ⚠️ weaker: some visible indicator, no branded ring | ✅ normal Tab order | N/A | N/A | N/A (no disabled Link demo) | N/A | ⚠️ `high-contrast-focus.spec.ts` (weak-contract row) |
| Forms (`Input`/`Textarea`/etc., `Field disabled`) | ✅ branded ring (`bee-focus-ring`) | ✅ normal Tab order | N/A | N/A | **N/A by design** — `Field disabled` maps to RN `editable={false}`, not a real HTML `disabled`; the Input stays a real Tab stop (non-editable, not non-focusable), matching native iOS/Android read-only-field conventions. See "Known gaps." | N/A | ✅ inherits `Input`'s ring (`high-contrast-focus.spec.ts`) |
| Tabs (`TabsTrigger`) | ✅ **fixed by this change** — `tabs.tsx` had no `bee-focus-ring` utility at all (`outline-style: none`); now uses the same token-driven ring | ✅ sequential Tab stops per trigger (no roving-tabindex arrow-key nav implemented — accepted current contract, not a #146 requirement) | N/A | N/A | N/A (no disabled tab in this demo) | N/A | ⚠️ default-theme existence check only; no dedicated high-contrast screenshot fixture yet (tracked below) |
| Select | ✅ (existing) | ✅ (existing) | ✅ (existing) | ✅ (existing) | ✅ (existing) | N/A (anchored, non-modal; ARIA menu/listbox pattern — Escape closes and returns focus, no Tab-trap expected) | ✅ trigger is `Button` |
| Tooltip | N/A (never a Tab stop, by design — ADR-005) | N/A | ✅ (existing) | N/A (never takes focus) | N/A | N/A (not focus-trapping) | N/A |
| DropdownMenu (menus) | ✅ **fixed by this change** — items had no `bee-focus-ring` utility | ✅ **fixed by this change** — see "Findings fixed by this change" below | ✅ (existing `onAccessibilityEscape`/dismiss-stack path; confirmed by new test) | ✅ **fixed by this change** — trigger never regained real focus on close | ✅ (existing `moveCurrent` logic; now reachable — confirmed by new test) | N/A (anchored, non-modal; Tab intentionally exits to the next page element, matching the ARIA menu-button pattern) | ⚠️ default-theme existence check only (see Select for the shared trigger ring) |
| Dialog | ✅ inherits `Input`/`Button` ring | ✅ **fixed by this change** — Tab now cycles only the dialog's own focusable descendants | ✅ (existing; now also proven not to leak background focus) | ✅ **fixed by this change** — real initial focus + real restoration to the trigger | N/A (no disabled control in this demo) | ✅ **fixed by this change** — Tab no longer reaches background triggers | ✅ inherits `Button`/`Input` ring |
| AlertDialog | ✅ inherits `Button` ring | ✅ (built on the same `DialogContent` fix) | **N/A by design** — Escape intentionally does not dismiss, matching "backdrop press never dismisses" (regression-guarded by the new test) | ✅ (built on the same `DialogContent` fix); explicit Cancel restores focus | N/A | ✅ (built on the same `DialogContent` fix) | ✅ inherits `Button` ring |
| Sheet | ✅ (existing) | ✅ (existing) | ✅ (existing) | ✅ (existing) | N/A (no disabled control in this demo) | ✅ (existing Tab-trap-and-wrap proof) | ✅ inherits `Input`/`Button` ring |
| Table (interactive headers/rows) | ✅ (existing) | ✅ (existing — sort trigger and row action both proven in normal tab order) | N/A (not an overlay) | N/A | N/A | N/A | ✅ (existing dedicated focus-indicator test) |
| Calendar / DatePicker / DateTimePicker | ✅ (existing) | ✅ (existing) | ✅ (existing) | N/A (anchored Popover, not a Tab-trapping modal) | ✅ (existing — disabled weekend day skipped) | N/A (anchored, non-modal) | ✅ inherits `Button`/`Input`/Calendar-cell ring |
| Production-demo flows | Deferred | Deferred | Deferred | Deferred | Deferred | Deferred | Deferred |

Production-demo rows are deferred per #146's own sequence rule ("production-demo rows
may be appended after #237 if not yet available"); the production demo (`apps/demo`,
#258–#263) now exists, but formal keyboard/focus acceptance of its flows is part of
owner-gated RC acceptance (#248/#249 on real devices), not asserted here.

## Evidence index

| Component | Spec file | Representative test names |
| --- | --- | --- |
| Buttons | `keyboard-focus-matrix-showcase.spec.ts` | "Tab skips both a disabled Button and a loading Button in one pass" |
| Links / high-contrast | `high-contrast-focus.spec.ts` | "Tab-driven keyboard focus is visible on ... (high-contrast-light/dark)" |
| Forms | `keyboard-focus-matrix-showcase.spec.ts` | "Tab reaches the next Input in document order and it carries a real focus indicator" |
| Tabs | `keyboard-focus-matrix-showcase.spec.ts` | "Tab reaches both TabsTrigger elements...", "a keyboard-focused TabsTrigger has a real, non-transparent focus indicator" |
| Select | `select-showcase.spec.ts` | "Select opens, navigates, and selects from the keyboard", "Escape dismisses Select without changing its selected value" |
| Tooltip | `tooltip-fixture.spec.ts` | "never becomes a Tab stop...", "keyboard focus opens immediately and Tab-away closes immediately" |
| DropdownMenu | `keyboard-focus-matrix-showcase.spec.ts` | "Enter opens the menu and moves real focus...", "ArrowDown cycles only through enabled items...", "the disabled item never receives focus...", "a keyboard-focused menu item has a real, non-transparent focus indicator" |
| Dialog | `keyboard-focus-matrix-showcase.spec.ts` | "opening moves real focus into the dialog...", "Tab wraps forward within the dialog and never reaches background page content", "Shift+Tab wraps backward within the dialog", "Escape closes the dialog and restores focus to its trigger" |
| AlertDialog | `keyboard-focus-matrix-showcase.spec.ts` | "opening focuses Cancel first...", "Escape does not dismiss an AlertDialog; explicit Cancel does and restores focus" |
| Sheet | `sheet-showcase.spec.ts` | "traps Tab focus within the panel and wraps at both ends", "Escape closes the Sheet and restores trigger focus" |
| Table | `table-showcase.spec.ts` | "sort trigger sits in normal tab order...", "sort trigger has a visible keyboard focus indicator", "embedded row action sits in normal tab order..." |
| DatePicker / DateTimePicker | `date-picker-showcase.spec.ts`, `date-time-picker-showcase.spec.ts` | "...selects a date from the keyboard", "Escape dismisses the DatePicker popover...", "...skips a disabled weekend day and PageDown moves a month" |

## Findings fixed by this change

Writing real, end-to-end keyboard-driven tests (rather than trusting each component's own
unit-level `onKeyDown`/`.focus()` assertions) surfaced two genuine, pre-existing Web
keyboard/focus defects. Both are fixed in `packages/ui/src/components/` as part of this
change, each mirroring an already-shipped, already-tested sibling implementation:

1. **`DialogContent`/`AlertDialogContent` did not trap Tab on Web.** Opening a Dialog
   left real DOM focus on the trigger button; from there, Tab continued into background
   page content (other overlay triggers, form fields) instead of staying inside the
   modal. `Sheet`'s own Web engine (#159, `sheet.web.tsx`) already implements exactly
   this contract (`useSheetFocusTrap`) for its own non-`Modal` engine; `dialog.tsx` now
   has an independent, Dialog-local implementation of the identical contract (initial
   focus, Tab wrap at both ends, restoration to the previously focused element on
   close) on top of React Native's core `Modal`, which does not provide this on Web by
   itself. `AlertDialogContent` gets the fix for free (it renders `DialogContent`
   internally).
2. **`DropdownMenuContent` computed a roving-tabindex "current" item but never moved
   real DOM focus onto it.** `DropdownMenuItem` already rendered `tabIndex={current ? 0
   : -1}` and the content container already had an `ArrowDown`/`ArrowUp`/`Home`/`End`
   `onKeyDown` handler — but nothing ever called `.focus()` on the current item, so a
   real keyboard user opening the menu (Enter/Space on the trigger) had no way to reach
   it: DOM focus stayed on the trigger, whose own ancestors never receive the content's
   keydown handler. `select.tsx` already solves the identical roving-tabindex problem
   with two small effects — focus the current item whenever it changes while open, and
   restore focus to the trigger (`anchorRef`) when `open` transitions back to `false`.
   `dropdown-menu.tsx` now has the same two effects, independently implemented for its
   own component.

Both fixes are additive (new effects / a new ref-merge callback; no existing prop,
export, or DOM attribute removed) and are covered by:

- the new Playwright tests above (browser interaction evidence);
- the full existing `@beemvp/beeui-showcase` Jest/RNTL suite (770 tests) passing unchanged,
  since both fixes are `Platform.OS === 'web'`-gated and the native rendering path is
  untouched (deterministic contract evidence).

A related, smaller finding: `TabsTrigger` and `DropdownMenuItem`/`DropdownMenuCheckboxItem`/
`DropdownMenuRadioItem` rendered with `outline-style: none` on keyboard focus — neither
opted into the shared `web:focus-visible:bee-focus-ring` utility that `Button`/`Input`/
`Table`'s sort trigger/`Calendar`'s day cells already use. Both now apply the same
token-driven utility class; this is a pure additive CSS class (no layout/behavior
change) and is covered by the new focus-indicator assertions above.

## Known gaps (tracked, not blocking)

- **A `Field disabled` Input is not removed from the Tab order.** `input.tsx` maps a
  disabled `Field`/`Input` to React Native's `editable={false}`, which `react-native-web`
  renders as a `readOnly` (not `disabled`) HTML attribute — the browser still includes a
  `readOnly` element in the Tab order. This differs from `Button`'s `disabled` (a real
  `<button disabled>`, fully removed from the Tab order — proven by the "Buttons" row
  above). This is the existing, cross-platform `editable`/`disabled` distinction React
  Native itself draws (there is no native "disabled" concept for a text field on
  iOS/Android, only editable-or-not; a read-only field is still accessibility-focusable
  there), not a #146 regression. Changing `Input`'s Web disabled semantics to fully
  remove it from the Tab order is a cross-cutting, ambiguous product/accessibility
  decision affecting every `Input` in the library — out of scope for this cross-cutting
  *verification* issue; file as a follow-up if BeeUI decides Web should match `Button`'s
  stricter contract instead.
- **Tabs has no ARIA roving-tabindex arrow-key navigation.** Each `TabsTrigger` is a
  normal sequential Tab stop; `ArrowLeft`/`ArrowRight` currently do nothing. This is the
  existing, accepted contract (not introduced by this change) and Tab-only access still
  fully works. Adding roving-tabindex arrow-key nav to `Tabs` is a component-behavior
  enhancement outside this cross-cutting acceptance issue's scope; file as a follow-up
  if the ARIA Tabs pattern's arrow-key recommendation becomes a 1.0 requirement.
- **No dedicated high-contrast *screenshot* fixture for Tabs/DropdownMenu/Dialog/
  AlertDialog.** `high-contrast-focus.spec.ts` (#77) proves the exact branded ring
  geometry for `Button`/`Input`/`Link` under both high-contrast themes with a visual
  baseline. Every Button-built trigger/action in this matrix (`DialogClose`,
  `AlertDialogCancel`/`AlertDialogAction`, `DropdownMenuTrigger`, `SheetClose`) inherits
  that same proof transitively. `TabsTrigger`/`DropdownMenuItem` now carry the identical
  utility class and are proven visible (non-`none` outline, non-transparent color) under
  the *default* theme by this change; extending the #77 fixture itself to add dedicated
  high-contrast-themed screenshot coverage for these two primitives is a reasonable
  follow-up, not required for this matrix's "visible focus" acceptance.
