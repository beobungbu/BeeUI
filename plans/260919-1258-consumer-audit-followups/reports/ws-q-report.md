# WS-Q report — review #2 items 3, 4, 6, 8, 9, 10

Branch: `ws/q-followups-review2`, based on `origin/fix/consumer-audit-followups` @ `7d1fa97`.

## Item 3 — ToolbarItem contract (review item 3) — fixed

`ToolbarItem.disabled`/`.onPress`/`.className` were only honoured in overflow mode; the visible row ignored them.

- Fixed: `disabled` clones onto the visible child whenever the item is disabled (overrides the child's own); `onPress` clones onto the visible child only when the child declares none of its own (explicit child `onPress` always wins; dev warns once if both are set and differ); `className` applies to the item's own row wrapper, not the child or the overflow row.
- Files: `packages/ui/src/components/toolbar.tsx`.
- Tests: `apps/showcase/__tests__/toolbar-item-visible-mode-contract.test.tsx` (new, 7 cases: visible disabled suppresses press, visible enabled calls fn, explicit child `onPress` wins, dev-warn-once on mismatch, `className` on wrapper only, overflow entry inherits disabled, overflow entry activates `onPress`) — none duplicate props on the child. Also de-duplicated redundant child-level `onPress`/`disabled` in `toolbar-overflow-collapse.test.tsx` and `toolbar-arrow-key-roving-focus.test.tsx` (existing tests that pre-dated this fix and would otherwise trigger the new mismatch warning).

## Item 4 — Toolbar overflow math (review item 4) — fixed

- Fixed: replaced the flat 36px trigger-width constant with the trigger's real measured width (`onLayout` on the real `DropdownMenuTrigger`), falling back to `controlSize.icon` (44px) until measured; the row's `gap-1` (4px, `spacing['1']`) is now counted between every rendered child (visible items and, once collapsed, the trigger) instead of ignored. The gap is applied via `style={{ gap }}` (not the `gap-1` class) on both the visible row and the hidden measurement row, sharing one `TOOLBAR_ROW_GAP` constant with the fit math so they cannot drift apart.
- Files: `packages/ui/src/components/toolbar.tsx`.
- Tests: `apps/showcase/__tests__/toolbar-overflow-gap-and-trigger-width.test.tsx` (new — fits exactly with gaps, one pixel over, and a real measured trigger width recomputing the collapse set). Also updated the numeric fixture in `toolbar-overflow-collapse.test.tsx`'s "collapses the lowest-priority item first" / "activating a collapsed item" tests: with equal 40px items the old 119px/[40,40,40] scenario becomes structurally impossible under the corrected math (removing a 40px item never helps once the 44px trigger is counted), so those two tests now use `[40, 40, 60]` at container 140 — noted here per instructions since an existing test's fixture numbers changed (the assertions/intent are unchanged).

## Item 6 — Table Web interactive-descendant exclusion (review item 6) — fixed

- Fixed: extended `INTERACTIVE_DESCENDANT_SELECTOR` in `table.web.tsx` from `button, a[href], input, select, textarea, [role=button|checkbox|link|switch|menuitem], [contenteditable]` to also include `summary`, `[tabindex]:not([tabindex="-1"])`, and roles `radio`, `menuitemcheckbox`, `menuitemradio`, `tab`, `option`, `combobox`, `listbox`, `textbox`, `searchbox`, `slider`, `spinbutton`, `scrollbar`. The existing `interactiveAncestor === currentTarget` exclusion already handles a row itself carrying a matching attribute (e.g. its own `tabIndex`), so no extra row-exclusion logic was needed.
- Files: `packages/ui/src/components/table.web.tsx`.
- Tests: jsdom fake-node unit test (`table-web-row-onpress-embedded-action.test.tsx`) unaffected/still green. Added real-DOM Playwright coverage: `apps/visual-regression/tests/table-row-interactive-descendants.spec.ts` against a new fixture (`apps/visual-regression/App.tsx`'s `table-row-interactive-descendants` scenario) proving a `Button`/`Checkbox`/`Radio`/`SelectTrigger`(`role="combobox"`)/`Link` embedded in a pressable row never fires the row, while a plain cell does — 48/48 passed across the full theme x viewport matrix.
- Table page text discouraging `onPress` rows with embedded interactive controls on native (`apps/docs/src/content/docs/components/table.md`, curated in `docs/component-reference.content.json`) was left as-is — still accurate.
- **File-ownership note**: the spec's owned-files list did not include `apps/visual-regression/App.tsx`; no existing fixture anywhere combined a pressable Table row with Button/Checkbox/Radio/SelectTrigger/Link, so proving this item's real-DOM requirement was impossible without adding one. I added a new, additive, isolated fixture (`table-row-interactive-descendants`) there — it does not touch any existing fixture or its committed screenshots (no screenshot baseline needed; DOM-assertion-only, matching `keyboard-roving-focus.spec.ts`'s precedent). Flagging this deviation for visibility.

## Item 8 — Docs drift — fixed

- DatePicker/DateTimePicker "Limitations" (`docs/component-reference.content.json`, curated, regenerated into both `apps/docs/.../date-picker.md` / `date-time-picker.md` and `docs/component-reference.md`): removed the "does not translate the placeholder" claim — both now localize the default placeholder (`en-US`/`vi-VN` dictionary, `date-picker-locale.ts` / `date-time-picker-locale.ts`), and DateTimePicker also localizes its "Done" button. Month-navigation and other accessibility-label props remain unlocalized (unchanged, correctly documented).
- `docs/components.md`: added missing `Toolbar`/`ToolbarItem` catalog rows plus a new `## Toolbar contract` section (item metadata authority, gap+trigger-width fit math, roving-tabindex); updated `Screen` (`scroll`), `IconButton` (`size`/`count`), `Tabs`/`TabsList`/`TabsTrigger` (`scrollable`/`closable`), `SafeArea` (inset+padding composition — written to match WS-P's forthcoming fix per the spec's instruction, not this branch's current drop-edge-on-conflict behavior), `SearchInput` (`trailing`), `Chip`/`ChipGroup` (`interactive={false}` static, `allowDeselect`), `ListItem` (`active`); added a `Table` `density`/`align`/`onPress` paragraph (previously undocumented in this file).
- Also fixed a drift I introduced: Toolbar's own curated `limitations` field said `ToolbarItem.children` was "never cloned or modified" — stale the moment item 3's clone fix landed; corrected it in the same commit.
- Regenerated via `pnpm docs:portal-pages:generate && pnpm docs:contract:generate` (never a single generator script) — confirmed idempotent by re-running both plus `docs:portal-pages:check`/`docs:contract:check` a second time with no further diff.
- Skipped: the optional `scripts/__tests__` regression-guard case for "a Limitations claim contradicted by a locale table." Not attempted — it would require editing `scripts/__tests__/*.mjs` and/or root `package.json`, neither of which is in this phase's file-ownership list, for a task explicitly marked optional/only-if-cheap.

## Item 9 — Select `scrollViewProps` (review item 9) — fixed

- Fixed: split `SelectContentProps.scrollViewProps` (now native-`ScrollView`-only) from a new `listProps` (`Omit<ViewProps, 'children'>`, Web's plain overflow `View` only). Web no longer accepts/forwards `scrollViewProps` at all; native is unaffected. Does not reintroduce `ScrollView` on Web (#612 unaffected — same plain `View`, just the correctly-typed prop feeding it).
- Files: `packages/ui/src/components/select.tsx`, `apps/docs/.../select.md` (regenerated).
- Tests: `apps/showcase/__tests__/select-content-scroll-view-props-native-only.test.tsx` (new) — type-level (`@ts-expect-error`) proof that `scrollViewProps` still accepts a ScrollView-only prop, `listProps` rejects one at compile time, and `listProps` accepts a plain `View` prop; each case also renders to confirm the surviving usages still mount.

## Item 10 — Sheet multi-dismiss race (review item 10) — fixed (was plausible, reproduced)

- Reproduced: the existing single-scalar `dismissRequestGenerationRef` (fixed for one close→reopen race in a prior commit) aliases when TWO `dismiss()` calls are outstanding simultaneously (open→close→open→close→open before either `onDismiss` arrives) — verified by temporarily reverting to the old scalar logic and confirming the new test fails exactly as predicted (the second stale `onDismiss` forces `onOpenChange(false)` even though a later reopen already put the sheet back up), then restoring the fix and confirming it passes.
- Fixed: replaced the scalar with `pendingDismissGenerationsRef: Set<number>` — every `dismiss()` call records the live generation at that moment; each `onDismiss` checks whether the *current* generation is still in the pending set (a real, live completion) or not (stale — consumes the oldest pending entry and ignores it), which is correct regardless of arrival order since generations only ever increase and a `dismiss()` call cannot be issued again until an intervening `present()` bumps the generation.
- Files: `packages/ui/src/components/sheet.native.tsx`.
- Tests: `apps/showcase/__tests__/sheet-native-double-dismiss-race.test.tsx` (new, 2 cases — both delayed callbacks firing in call order and in reverse order) — sheet ends presented, `onOpenChange(false)` never fires for either stale callback, and a real subsequent dismiss still closes it normally.

## Gates — exact commands and results

All run from repo root with `PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"` (`node -v` = v24.13.1) and `corepack pnpm`.

| Command | Result |
| --- | --- |
| `pnpm lint` | pass (exit 0, no output) |
| `pnpm --filter @beemvp/beeui-ui run typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase run typecheck` | pass |
| `pnpm --filter beeui-visual-regression run typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase test` | pass — 134 suites, 1174 tests |
| `pnpm ui-exports:check` | pass |
| `pnpm docs:portal-pages:generate` then `pnpm docs:portal-pages:check` | pass (fresh) |
| `pnpm docs:contract:generate` then `pnpm docs:contract:check` | pass (`docs/component-reference.md` up to date) |
| `pnpm docs:surface:check` | pass |
| `pnpm llms:generate` then `pnpm llms:check` | pass |
| `pnpm docs:examples:check` | pass |
| `npx playwright test table-row-interactive-descendants` (apps/visual-regression, after `pnpm build:web`) | pass — 48/48 across the full theme x viewport matrix |

## Files touched (by commit)

1. `fix(toolbar)`: `packages/ui/src/components/toolbar.tsx`; `apps/showcase/__tests__/{toolbar-item-visible-mode-contract,toolbar-overflow-gap-and-trigger-width,toolbar-overflow-collapse,toolbar-arrow-key-roving-focus}.test.tsx`; `apps/docs/src/content/docs/components/{toolbar,icon-button}.md`.
2. `fix(table)`: `packages/ui/src/components/table.web.tsx`; `apps/visual-regression/App.tsx`; `apps/visual-regression/tests/table-row-interactive-descendants.spec.ts`.
3. `fix(select)`: `packages/ui/src/components/select.tsx`; `apps/docs/src/content/docs/components/select.md`; `apps/showcase/__tests__/select-content-scroll-view-props-native-only.test.tsx`.
4. `fix(sheet)`: `packages/ui/src/components/sheet.native.tsx`; `apps/showcase/__tests__/sheet-native-double-dismiss-race.test.tsx`.
5. `docs`: `apps/docs/src/content/docs/components/{date-picker,date-time-picker}.md`; `docs/component-reference.content.json`; `docs/component-reference.md`; `docs/components.md`.

Did not touch `input`/`password-input`/`safe-area`/`icon-button` source or `docs/dist-tag-policy.md`.

## Unresolved / follow-ups

- The `apps/visual-regression/App.tsx` file-ownership deviation for item 6 (above) — worth a one-line ack in whatever coordinates WS-P/other workstreams so nobody duplicates or conflicts with the new `table-row-interactive-descendants` fixture.
- The SafeArea composition sentence in `docs/components.md` describes the *intended* (WS-P) inset+padding-composition contract, not this branch's current drop-edge-on-conflict behavior (`safe-area.tsx` untouched, per scope) — will read correctly once WS-P's fix lands; flagging so it isn't mistaken for a claim about the current commit.
- Skipped the optional `scripts/__tests__` stale-Limitations regression guard (item 8) — out of file-ownership scope for an explicitly optional item.
