# WS-H · docs + registry close-out for everything merged (A–F) and the D2 leftovers

Owned: apps/docs/**, docs/*.content.json, docs/component-reference.md (generated), docs/public-surface.inventory.json (generated + acknowledge), registry/**, llms*.txt (generated), scripts/** docs generators only if a generator bug blocks you, apps/showcase examples only if a docs page needs a registered example for a new prop. Do NOT edit packages/** (WS-G is still editing packages/tokens and two date-picker web files).

Currently failing gates on the integration branch (fix them first):
- `pnpm registry:verify` → missing registry entry: toolbar (new component from WS-F; see registry/ for how other components are registered, then `pnpm registry:test`).
- `pnpm docs:contract:check` → add a content entry for Toolbar in docs/component-reference.content.json (purpose, sections the generator requires), then `pnpm docs:contract:generate`.
- `pnpm docs:surface:check` → the new `./toolbar` subpath needs a published page /docs/components/toolbar/ that names it; `pnpm docs:surface:generate && pnpm docs:surface:acknowledge`.
- `pnpm docs:portal-pages:check` → `pnpm docs:portal-pages:generate` (icon-button.md and others stale).

Docs content to write (read the "Docs text to publish" sections in reports/ws-e-report.md and ws-f-report.md; props tables come from the generator, you write usage prose + examples):
1. New Toolbar component page (Toolbar, ToolbarItem, priority collapse, overflow menu, a11y). Showcase example already exists from WS-F; register it if the page needs it.
2. Tabs page: `TabsList scrollable`, `addon`, `TabsTrigger closable/onClose/closeAccessibilityLabel`, selection-moves-to-neighbour rule (POS open-orders example).
3. OTPInput page: `appearance="segmented"`; also document `onChange` event shape if D2 did not.
4. Table page: `density` prop with the 48 row token, `TableCell align`, `TableRow selected/onPress` (WS-C wrote a pattern note; verify it survived regeneration), and decide #580's "2 undocumented Table props" (columnIndex etc.): if they are internal, hide them from the props table via the generator's existing internal-marking convention; if public, document them.
5. Toast page: `BeeUIProvider toastPlacement` + native default bottom. Field page: `requiredLabel` + the new no-English-default contract. Stepper: `orientation`. DropdownMenuItem: `description`. IconButton: `size`, `count`. ListItem: `active`. Chip: static variant; ChipGroup deselect. Screen: `scroll`. SearchInput: `trailing`. SegmentedControl: `accessibilityLabel`. PasswordInput: visible show/hide labels. Check each page after regeneration and add one usage sentence + example where the generator only emits the props row.
6. Input page: publish WS-E's #606 text (react-native-web stops keydown bubbling; use capture-phase listeners; code sample).
7. #599: the typography mapping table (Text variant ↔ scale step) on reference/tokens.md and the Text page (D2 skipped it).
8. #585 leftover site-level items 2, 3, 4, 5, 7 (read `gh issue view 585 --repo beobungbu/BeeUI` and reports/ws-d2-report.md for what was already done).
9. Theming page: add the note that BeeThemeScope on Web depends on the scoped selector emission fixed in WS-G (keep it short; WS-G may still be in flight — describe the contract, not the internals).

Gates (all must pass): `pnpm registry:verify && pnpm registry:test`, `pnpm docs:contract:check`, `pnpm docs:surface:check`, `pnpm docs:portal-pages:check`, `pnpm docs:examples:check`, `pnpm docs:patterns:check`, `pnpm llms:check`, `pnpm ai-contract:check`, `pnpm docs:reference:check`, `pnpm docs:public-truth:check`, `pnpm site:contract:check`, `pnpm docs:a11y:check`, `pnpm docs:search:check`, `pnpm docs:budget:check`, `pnpm --filter @beemvp/beeui-showcase example-registry:check`, and `pnpm docs:build`.
