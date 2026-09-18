# WS-A a11y + forms + i18n copy — implementation report

Branch: `ws/a-a11y-forms`, based on `fix/consumer-audit-batch` @ `e437553`.

## Per-issue status

| Issue | Status | Notes |
|---|---|---|
| #553 Tabs/Pagination/Stepper current/selected | Fixed | `aria-selected` on `TabsTrigger`, `aria-current="page"` on `PaginationItem`, `aria-current="step"` on `StepperItem`, all explicit literal props (compound `accessibilityState` does not reach react-native-web's DOM). |
| #555 Accordion/Collapsible `aria-expanded` | Fixed | Literal `aria-expanded` added to both triggers. |
| #556 Progress `aria-valuemin/now/max` | Fixed | Literal props added alongside the existing `accessibilityValue`. |
| #557 Calendar selected day `aria-selected` | Fixed | Literal `aria-selected` added to the day-cell `Pressable`. |
| #558 DropdownMenuTrigger `aria-haspopup` | Fixed | `aria-haspopup="menu"` added. |
| #607 item 2 DropdownMenuTrigger hover | Fixed | Added `web:hover:opacity-80` unconditionally (independent of `variant`); `onHoverIn`/`onHoverOut` were already forwarded via prop spread — added a regression test proving it. |
| #603 item 2 DropdownMenuItem description slot | Fixed | New `description`/`descriptionClassName` props mirroring `ListItem`. |
| #559 Switch `accessibilityLabelledBy` | Fixed (best-effort on Web) | Forwards a literal `aria-labelledby` alongside `accessibilityLabelledBy` on Web (same established pattern as `aria-checked`/`aria-busy`/`aria-controls` elsewhere in this package); also resolves to the enclosing `Field`'s label when the Switch has no own name. Cannot be verified against real react-native-web DOM output in this Jest environment (native-renderer only) — verified at the prop-contract level, matching this suite's existing convention for these fixes. |
| #570 Field duplicate accessible name | Fixed | New `Label` `presentational` prop; `Field`/`FormGroup` set it on their internally-rendered `Label` so it never carries its own `accessibilityLabel` — only the child control does (via its own prop or the `accessibilityLabelledBy` association). Standalone `<Label required>` usage (outside Field/FormGroup) is unaffected. |
| #571 Field/FormGroup reaching Switch/Checkbox/Radio | Fixed | `Switch`, `Checkbox`, and standalone `Radio` (not inside `RadioGroup`) now consume `FieldContext` for a labelledby/label fallback and hint; `Checkbox` also consumes `FormGroupContext` for disabled/hint propagation to a bare checkbox list. |
| #601 Field required English copy | Fixed | Added `Field.requiredLabel` (no default — "none"); `Checkbox`/`Radio`/`Switch` expose `aria-required` and only append `requiredLabel` (never a hardcoded "required") to their Field-derived fallback name. The old `requiredAccessibilityLabel` prop/default is kept unchanged (deprecated, not removed) because it is consumed by non-owned files (`input.tsx`, `date-picker-shared.tsx`, `date-time-picker-shared.tsx`) with existing passing tests asserting the old English default — removing it would break those out-of-scope files/tests. |
| #587 AlertDialog `role="alertdialog"` | **Not fixed — blocked by file ownership** | `AlertDialogContent` forwards all props to `DialogContent` (`dialog.tsx`, not owned by WS-A). `DialogContentProps` omits `role` entirely and `DialogContent` hardcodes `role="dialog"` after its prop spread, so `AlertDialogContent` has no way to override it without editing `dialog.tsx`. Needs a companion change in `dialog.tsx` by whichever workstream owns it (e.g. an internal `role` override prop). |
| #613 item 1 SegmentedControl radiogroup name | Fixed | `accessibilityLabel`/`accessibilityLabelledBy` forwarded, falling back to the enclosing `Field`'s label. |
| #600 SegmentedControl label wrap | Fixed | `w-full text-center` on the segment label `Text` so it can wrap within its `flex-1` item instead of clipping (same root cause as Button's documented `max-w-full` flexShrink note). |
| #610 PasswordInput visible toggle text | Fixed | Toggle `Button` children now render `toggleLabel` (derived from `showLabel`/`hideLabel`) instead of a hardcoded `'Show'`/`'Hide'` literal. |
| #611 item 2 Stepper orientation | Fixed | New `orientation?: 'horizontal' \| 'vertical'` prop (default `'vertical'`), adjusts container and item layout. |
| #611 item 3 Stepper 1-based clamp | Fixed | JSDoc documents the clamp; dev-mode `console.warn` when `Stepper.currentStep` or `StepperItem.step` is `< 1` (including `0`). |
| #611 item 4 disabled Switch contrast | Fixed | Disabled on-state track color changed from flat `accent-disabled` to `accent-primary/40`, keeping on/off distinguishable while disabled. |
| #603 item 1, #607 item 1, #611 items 1/5/6, #613 items 2–4 | Out of scope | Table density, Dialog nested role, Toolbar overflow, Select-in-Popover docs, Separator height, SelectValue empty-string, Badge outline, IconButton badge — all live in files not owned by WS-A (`table.tsx`, `dialog.tsx`, `select.tsx`, `separator.tsx`, `badge.tsx`, `icon-button.tsx`; no `Toolbar` component exists). |

## Files changed (packages/ui/src/components/)

`accordion.tsx`, `calendar.tsx`, `checkbox.tsx`, `collapsible.tsx`, `dropdown-menu.tsx`, `field-context.ts`, `field.tsx`, `form-group.tsx`, `label.tsx`, `pagination.tsx`, `password-input.tsx`, `progress.tsx`, `radio.tsx`, `segmented-control.tsx`, `stepper.tsx`, `switch.tsx`, `tabs.tsx` — all within WS-A's owned-file list. No files outside the owned list were modified (confirmed via `git status`). No exports changed in `packages/ui/src/index.ts` (`ui-exports:check` passes unchanged).

## Tests added (apps/showcase/__tests__/, all new files, named by behavior)

- `tabs-pagination-stepper-current-aria.test.tsx` — #553
- `accordion-collapsible-aria-expanded.test.tsx` — #555
- `progress-aria-value-range.test.tsx` — #556
- `calendar-selected-day-aria-selected.test.tsx` — #557
- `dropdown-menu-trigger-haspopup-hover.test.tsx` — #558, #607 item 2
- `dropdown-menu-item-description-slot.test.tsx` — #603 item 2
- `switch-labelledby-and-disabled-contrast.test.tsx` — #559, #571 (Switch), #611 item 4
- `checkbox-radio-field-form-group-context.test.tsx` — #571 (Checkbox, Radio)
- `field-label-accessible-name-dedup.test.tsx` — #570
- `field-required-aria-required-no-english-default.test.tsx` — #601
- `segmented-control-name-and-label-wrap.test.tsx` — #613 item 1, #600
- `password-input-visible-toggle-text.test.tsx` — #610
- `stepper-orientation-and-step-clamp-warning.test.tsx` — #611 items 2, 3

Notable testing detail: `aria-selected`/`aria-expanded` (and `aria-checked` already, elsewhere) are React Native compound `AccessibilityState` keys, so `Pressable` normalizes them away before a rendered host node is reachable via `@testing-library/react-native`'s query helpers. Tests for those specific props use raw `react-test-renderer` + a `Pressable`-instance finder (same convention as the existing `selection-control-aria.test.tsx`). `aria-current`/`aria-haspopup`/`aria-valuemin` etc. are not compound-state keys and are asserted directly via `render()` + `getByTestId`.

All new tests were written to fail before the corresponding source fix and pass after (verified manually during implementation, not just post-hoc).

## Gate results (exact commands)

- `pnpm --filter @beemvp/beeui-ui typecheck` → pass
- `pnpm --filter @beemvp/beeui-showcase typecheck` → pass
- `pnpm lint` → pass (`eslint packages/ui/src apps/demo/src --max-warnings=0`, 0 warnings/errors)
- `pnpm ui-exports:check` → pass, unchanged (62 public component subpaths) — exports were not touched, so `ui-exports:generate` was not needed
- `pnpm --filter @beemvp/beeui-showcase test` → pass, **98 suites / 951 tests** (85 suites / 904 tests pre-existing, all still green; 13 new suites / 47 new tests)
- `pnpm build` (`packages/core`, `packages/tokens`, `packages/ui`) → pass

Not run (out of WS-A's required-gate list, and touches generated docs owned by the docs pipeline, not this workstream): the root aggregate `pnpm typecheck`/`pnpm test` (includes docs/site/token/registry gates unrelated to this workstream). I did probe `docs:portal-pages:check`/`public-component-reference.mjs` directly to rule out a docs regression from source JSDoc changes; running the reference-page generator script in isolation (outside its full three-script chain) destructively rewrote all 62 component pages by dropping the "Live Web preview" sections another script in that chain is responsible for adding. I reverted all of `apps/docs/` before finishing (`git checkout -- apps/docs/`) — no docs files are part of this commit. If a full docs regen is needed for the new `orientation`/`requiredLabel`/`description` props, it should go through `pnpm docs:portal-pages:generate` (the full chain), and is a reasonable follow-up not required by WS-A's listed gates.

## Deviations / design notes

- **`Field.requiredAccessibilityLabel` kept, not removed.** #601 asks to stop injecting an English "required" default, but `FieldContextValue.requiredAccessibilityLabel` (default `'required'`) is read directly by `input.tsx`, `date-picker-shared.tsx`, and `date-time-picker-shared.tsx` — none owned by WS-A — and two existing tests (`accessibility-readonly.test.tsx`, `issue-15-alert-dialog-form-group.test.tsx`) assert that exact default string. Changing the default or removing the field would break those non-owned consumers and their currently-passing tests. Added `Field.requiredLabel` (no default) as the new, correctly-scoped mechanism instead, wired into the components WS-A does own (Checkbox/Radio/Switch). Full removal of the English default from `Input`/`DatePicker`/`DateTimePicker` needs a companion change from whichever workstream owns those files.
- **`aria-labelledby` takes precedence over `aria-label` in accessible-name computation** (WAI-ARIA accname), confirmed indirectly via `@testing-library/react-native`'s own label-resolution behavior during test-writing: a control with both props set resolves its name from the `accessibilityLabelledBy` target, not its own literal `accessibilityLabel`. This is why `Switch`/`Checkbox`/`Radio`/`SegmentedControl` mirror `Input`'s existing convention of setting both simultaneously rather than one to the exclusion of the other.
- Removed all issue-number references from source comments per the "no issue numbers in code comments" instruction; also removed them from new test `describe`/`it` titles and comments (kept only in this report and commit messages where explicitly requested).

## Unresolved / follow-up

1. #587 needs a `dialog.tsx` change outside WS-A's ownership (see above).
2. A full docs regen (`pnpm docs:portal-pages:generate`) for the new public props (`Stepper.orientation`, `Field.requiredLabel`, `DropdownMenuItem.description`/`descriptionClassName`) was not run — not a required WS-A gate, and the generator's three-script chain needs to run together to avoid corrupting pages (see Gate results above).
