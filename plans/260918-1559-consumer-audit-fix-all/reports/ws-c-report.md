# WS-C — dialog, table, visual/dark, button family, list/chip/badge API gaps, toast/date-picker native

Branch: `ws/c-visual-api` @ `3fae63180f00418ed4172830fc283b3380b678ea`

## Per-issue status

| Issue | Item | Status | Notes |
|---|---|---|---|
| #593 | DialogTrigger variant="outline" paints primary label | Fixed | Root cause was in `button.tsx`: explicit `<ButtonLabel>` child never received Button's resolved variant. |
| #607 item 1 | Dialog two nested role="dialog" on Web | Fixed | Web: role/aria-modal/label moved to `<Modal>`'s forced owner; panel stays plain. Native unaffected. #607 item 2 (DropdownMenuTrigger hover) is out of scope (owned by another workstream). |
| #608 | DialogContent doesn't clip overflow | Fixed | `overflow-hidden` added to panel. |
| #604 | Web dark: TableHead `<th>` unset text color | Fixed | `text-foreground` added. |
| #595 | TableCell/TableHead no `align` prop | Fixed | `align: 'start'\|'center'\|'end'` on both platforms; `TableAlign` exported. |
| #596 | TableRow selected paints nothing | Fixed (real bug, not just cosmetic) | Class was already present (`bg-surface-raised`) but every light theme in the token set defines `surface-raised === surface`, so it was a no-op. Switched to `bg-primary/10`, guaranteed distinct from surface in every theme. |
| #615 | Web stacked layout drops row grouping | Fixed | `role="table"`/`"row"`/`"cell"`/`"rowgroup"` added for stacked layout. |
| #546 | Table web accessibilityLabel not bridged to aria-label | Fixed | `Table`/`TableRow`/`TableCell`/`TableHead` bridge `accessibilityLabel`/`accessibilityLabelledBy` → `aria-label`/`aria-labelledby`; explicit `aria-*` still wins. |
| #572 | TableRow has no onPress + undocumented pattern | Fixed | `onPress` on `TableRow` (native: Pressable + `accessibilityRole="button"`; Web: stays real `<tr>`/`role="row"`, adds `tabIndex`+Enter/Space keydown). Documented in Table docs page (`docs/component-reference.content.json` "table" entry → regenerated page). |
| #597 item 1 | labelClassName ignored on explicit ButtonLabel | Fixed | Same root-cause fix as #593. |
| #597 item 3 | Badge stretches in TableCell | Fixed | TableCell switched to row-direction layout (native) / inner flex-row wrapper (Web) instead of relying on stretch-by-default column layout. |
| #597 item 5 | ListItem loses accessible name when title is a node | Fixed | Recursive text-collector synthesizes the name from any node; explicit `accessibilityLabel` still wins. |
| #605 | Avatar fallback paints black in dark | Fixed (real latent bug found during verification) | `text-muted-foreground` was already in `avatarFallbackVariants`' base classes, but its own size-variant classes (`text-caption`/`text-label`/...) are custom typography-scale names that `tailwind-merge` misclassifies as color utilities, silently evicting the real color class from the merged string. Reordered so the color class survives the merge. |
| #568 | IconButton has no size prop | Fixed | `size` mirrors Button's scale (`sm`/`md`/`lg`/`icon`), applied as both height+width using existing control-size tokens (no new tokens needed); `sm` keeps the touch-target guard. |
| #613 item 4 | IconButton has no count slot | Fixed | `count` prop renders an `aria-hidden` overlay badge; numeric/string counts are folded into `accessibilityLabel`. |
| #602 | ButtonLabel clamps to one line, ignores numberOfLines | Fixed | `numberOfLines` was already forwarded correctly on an explicit `ButtonLabel` child; the real defect was Button's fixed `h-*` size classes clipping a wrapped 2nd line regardless. Changed `sm`/`md`/`lg` to `min-h-*` (icon stays fixed/square, by design). |
| #613 item 3 | Badge outline indistinguishable from disabled input | Fixed | `border-foreground/40` (theme-derived) instead of `border-border-strong`. |
| #573 item 1 | No static Chip tag variant | Fixed | `interactive={false}` renders a plain, roleless standalone Chip; always interactive inside a `ChipGroup`. |
| #573 item 2 | ChipGroup single mode can't deselect | Fixed | `allowDeselect` opt-in prop clears selection to the group's empty-string sentinel. |
| #573 item 3 | DatePicker.locale doesn't localize placeholder | Fixed | Small built-in dictionary (`en-US`, `vi-VN`) in `date-picker-locale.ts`; explicit `placeholder` still wins. |
| #566 item 3 | ListItem no active/selected prop | Fixed | `active` prop: `bg-primary/10` + `accessibilityState.selected` (native) + `aria-current` (Web). |
| #611 item 6 | Separator vertical needs explicit height | Already fixed in current source | `self-stretch` was already present; added regression test to lock it in. Docs callout for the composition pitfall is out of WS-C's docs scope (only Table page is owned). |
| #586 item 1 | Toast defaults to top on iOS | Fixed | Native now defaults to `bottom` safe-area anchor; Web keeps `top`. `placement` prop exists on `ToastRuntimeProvider` (internal — `BeeUIProvider`, owned by another file, doesn't yet forward a public prop for it; the default-based fix resolves the reported symptom without a public API change). |
| #586 item 2 | DatePicker forwards deprecated onChange | Fixed | Both platforms use `onValueChange`/`onDismiss` (verified against installed `@react-native-community/datetimepicker@9.1.0` source, which calls `warnIfOnChangeIsUsed`). |
| #587 (added mid-task) | AlertDialogContent hardcodes role="dialog" | Fixed | `DialogContent` gained an internal `role?: 'dialog'\|'alertdialog'` prop; `AlertDialogContent` (in `alert-dialog.tsx`, WS-A's file — coordinator authorized this edit) passes `role="alertdialog"` and excludes it from its own public prop type. On Web, `aria-modal` stays only on the react-native-web-forced Modal owner; the panel adds `role="alertdialog"` (a different role value than the outer's forced `dialog`, so this is not the "two nodes with the same role" shape #607 removed). |

## File ownership note

`alert-dialog.tsx` is **not** in WS-C's owned-file list (owned by WS-A, branch `ws/a-a11y-forms`, reported finished). The coordinator explicitly authorized this one edit mid-task for #587 and instructed noting the merge order: **this branch's `alert-dialog.tsx` change must land after `ws/a-a11y-forms` merges** (rebase/reconcile if WS-A also touched that file in the interim).

Also touched, outside the original owned-file list, as necessary side effects of the above fixes (all governance/test-infrastructure, not component behavior):
- `apps/showcase/__tests__/helpers/dynamic-type.ts` — added `icon-button.tsx` to `FIXED_HEIGHT_ALLOWLIST` (new legitimate fixed-square control-size classes).
- `scripts/public-component-reference.mjs` — added `alertdialog` to `KNOWN_ACCESSIBILITY_ROLES`; bumped `PROP_DESCRIPTION_FLOOR` 640→648 and `PROP_DISTINCT_DESCRIPTION_FLOOR` 302→310 (ratchets that must track the real measured total after adding documented props).
- `scripts/__tests__/public-component-reference.test.mjs` — updated two golden assertions that encoded the pre-fix API shape (IconButton had no `size`; Table had no axis of its own) to the new correct shape.
- `docs/component-reference.content.json` — added the `align` prop mention + the row-to-detail pattern paragraph to the `table` entry (source for the Table docs page).
- Regenerated (not hand-edited) `docs/component-reference.md` and `apps/docs/src/content/docs/components/{alert-dialog,avatar,badge,button,chip,dialog,icon-button,list-item,separator,table,toast}.md` via `pnpm docs:contract:generate` / `pnpm docs:portal-pages:generate`.

## Files changed

Component sources: `packages/ui/src/components/{dialog,alert-dialog,button,table-shared,table,table.web,icon-button,badge,avatar,chip,list-item,toast,date-picker-locale,date-picker.native,date-picker.web}.tsx|ts`, `packages/ui/src/index.ts` (added `TableAlign` export).

New tests (behavior-named, no issue numbers): `dialog-web-modal-owner`, `button-label-variant-inheritance-and-wrap`, `table-cell-alignment-and-content-hug`, `table-row-selected-contrast`, `table-web-structure-and-accessibility`, `icon-button-size-and-count`, `badge-outline-contrast`, `avatar-fallback-contrast`, `chip-static-tag-and-group-deselect`, `list-item-active-state-and-node-title-name`, `separator-vertical-stretch`, `date-picker-locale-placeholder` (all under `apps/showcase/__tests__/`).

Updated existing tests to match corrected behavior (previously encoded the buggy contract): `issue-173-date-picker-native.test.tsx` (onChange→onValueChange/onDismiss), `toast.test.tsx` (top→bottom default + new Web-default test), `issue-15-alert-dialog-form-group.test.tsx` (role dialog→alertdialog).

## Gate results

| Command | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase test` (full suite) | pass — 97 suites / 967 tests |
| `pnpm ui-exports:generate && pnpm ui-exports:check` | pass (no manifest change needed — `table` subpath already registered) |
| `pnpm docs:contract:generate` / `pnpm docs:contract:check` | pass |
| `pnpm docs:portal-pages:generate` / `pnpm docs:portal-pages:check` | pass |
| `pnpm docs:examples:check` | pass |
| `pnpm docs:patterns:check` | pass |
| `pnpm docs:contract:test` / `docs:examples:test` / `docs:patterns:test` / `docs:portal-pages:test` | pass (164/10/278/9 tests respectively) |

## Concerns / caveats

- Playwright visual-regression coverage (`apps/visual-regression/`) was not run in this sandbox (no browser). The #607/#587 Web-role fix is verified at the "props passed to `<Modal>`/panel" level under `@testing-library/react-native`, not against a real rendered DOM — that gap is explicitly called out in the new test file's comments. Existing Playwright specs referencing `getByRole('dialog', {name: ...})` should still pass unchanged (name-filtered queries already disambiguated before this fix; the fix reduces the match count from 2 to 1).
- Toast `placement` is not reachable via any public prop today (`ToastRuntimeProvider` is internal; `BeeUIProvider`, which mounts it, is owned by another file/workstream). The platform-default fix resolves #586-1's reported symptom; exposing a public `placement` prop on `BeeUIProvider` would need to be threaded through by whichever workstream owns `safe-area.tsx`/`BeeUIProvider`.
- #611 item 6 (Separator) and #596 (TableRow selected) were reported as still-broken by the audit but the underlying `self-stretch`/`selected` class was already present in current source before this workstream started — #596 turned out to still be a real bug (token collapse in light themes), fixed; #611-6 appears already correct (a regression test was added to lock it in, and I could not find or reproduce a remaining defect within WS-C's file ownership — its docs callout is out of scope for this page).

Status: DONE
Branch: ws/c-visual-api @ 3fae63180f00418ed4172830fc283b3380b678ea
Summary: All WS-C issues (dialog, table, button/icon-button/badge/chip/list-item/avatar/separator/toast/date-picker) plus the coordinator-added #587 (AlertDialog role) are fixed with regression tests; lint/typecheck/full test suite/all docs gates are green.
Concerns: Toast placement has no public prop path yet (default-only fix); alert-dialog.tsx edit must merge after ws/a-a11y-forms; Playwright-level verification of the Web dialog-role fix is not run in this sandbox.
