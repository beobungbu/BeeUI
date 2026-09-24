# WS6 — Docs: SheetProvider, upgrade notes, charts, #585/#590 sweep

Branch `ws6-docs-sheetprovider-and-charts` (from `243c4ae` on `fix/rc2-consumer-verification`),
worktree `/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-a484e7e632edf1926`.

Note on report location: the task asked for this report under
`.../beeui-portal-pages-ci-e8e1fc/plans/.../reports/`, but this worktree-isolated agent can only
write inside its own worktree, so this copy is at the equivalent path inside
`agent-a484e7e632edf1926`. Same relative path, same filename.

## What changed and where

### #629 docs half — SheetProvider native root wiring

rc.1's guidance (`GestureHandlerRootView > BottomSheetModalProvider > BeeUIProvider`) is fatal on
rc.2 without `SheetProvider`; per instructions this documents the requirement, not the crash.

- `scripts/generate-llms-txt.mjs` — the stale `Sheet` line (`requires GestureHandlerRootView +
  BottomSheetModalProvider at the app root`) in `buildPatterns()`'s composition guidance was the
  only place the *generator source* still taught rc.1 wiring; fixed, and added a `SheetProvider`
  paragraph to `buildFull()`'s "Provider and safe-area setup" section, a `SheetProvider` bullet to
  its "Overlay model (summary)", and a `SheetProvider` pointer to `buildIndex()`'s "Optional"
  section (so llms.txt itself now has a hit). Also added `apps/docs/src/content/docs/components/
  sheet.md` to `LINKED_PATHS` (referenced from the new prose). Regenerated `llms.txt`,
  `llms-full.txt`, `llms-patterns.txt` (`llms-components.txt` already listed `SheetProvider` since
  it derives straight from the barrel export list — untouched). All three named outputs now
  contain `SheetProvider`.
- `apps/docs/src/content/docs/start/expo.md`, `apps/docs/src/content/docs/start/
  bare-react-native.md` — new "## Sheet on native (optional)" section: `BeeUIProvider >
  SheetProvider > app`, explicit "remove the outer `BottomSheetModalProvider`" migration note,
  `bridgeContexts` guidance, link to the Sheet component reference. Also added an
  "Already on `0.86.2-rc.1`?" pointer near each page's Prerequisites line.
- `apps/docs/src/content/docs/start/provider-safe-area.md` — "Overlay scopes" section now notes
  Sheet's extra native `SheetProvider` requirement with links to the two Start pages.
- `docs/ai-agent-cookbook.md` — fixed four separate copies of the stale
  `GestureHandlerRootView + BottomSheetModalProvider` instruction (the "Overlays / Sheet" bullet,
  the "Common failure recovery" table row, Recipe E). The table row previously said `Sheet`
  "throws at runtime" without a provider — reworded to state the requirement only, per the
  "do not describe what happens when it is missing" instruction (a fail-soft fix is tracked
  separately, W1).
- `docs/decisions/013-production-demo-architecture.md` — D2's "wired exactly as
  `apps/showcase/app-providers.native.tsx`" line still named the raw
  `GestureHandlerRootView`/`BottomSheetModalProvider` pair; `apps/showcase/app-providers.native.tsx`
  actually mounts `SheetProvider` (verified by reading the file). Corrected to match.
- **Not touched, already correct** (verified by reading, not edited): `docs/components.md`'s
  "Sheet boundary" section and `apps/docs/src/content/docs/components/sheet.md` (generated from
  `sheet.native.tsx`'s JSDoc) both already document `SheetProvider` fully and correctly —
  the crash issue's report predates these fixes. `packages/ui/src/components/sheet.native.tsx`
  and `sheet-context-bridge.tsx` were read only, to confirm the exact API
  (`SheetProvider`, `SheetProviderProps`, `bridgeContexts`) before writing docs — not modified
  (component code is out of scope for this workstream).

### rc.1 → rc.2 upgrade notes

- `CHANGELOG.md` — new "### Upgrading from 0.86.2-rc.1" subsection inside the existing
  `## [0.86.2-rc.2]` entry, explicitly labelled *"Added to this entry after `0.86.2-rc.2`
  publication ... Not part of the original rc.2 release notes above."* Covers: (1) SheetProvider
  wiring change, (2) context bridging, (3) `Calendar` `role="gridcell"` on Web / `getByRole`
  selector update, (4) the five droppable workarounds (density="dense48", `TableRow onPress`,
  scrollable/closable `Tabs`, `DropdownMenuTrigger` hover, `Button` label wrap at large text).
  No "workarounds you still need" list, per instructions.
- `apps/docs/src/content/docs/guides/migration-versioning.md` — matching
  "## Upgrading from 0.86.2-rc.1 to 0.86.2-rc.2" section with the same four items and worked
  code where useful; also fixed a now-false claim in the page's intro ("there is still no older
  public BeeUI version to migrate from" — false since rc.1 is public).
- Linked from `apps/docs/src/content/docs/start/index.md`, `start/expo.md`, and
  `start/bare-react-native.md`.
- Each of the four upgrade-notes claims was verified against source before writing, not
  inferred from the plan: `Sheet`/`SheetProvider` wiring and `bridgeContexts` from
  `packages/ui/src/components/sheet.native.tsx` and `sheet-context-bridge.tsx`; `Calendar`
  `role="gridcell"` from `packages/ui/src/components/calendar.tsx:436`; `Table density="dense48"`
  from `packages/ui/src/components/table-shared.ts:50`; `TableRow onPress` from
  `packages/ui/src/components/table.tsx:274`; `Tabs` scrollable/closable and `DropdownMenuTrigger`
  hover affordance (`web:hover:opacity-80`, `dropdown-menu.tsx:239`) and `Button`'s `max-w-full` +
  `min-h-*` + `ButtonLabel numberOfLines` wrap contract (`button.tsx:14-56`) all read directly
  from `packages/ui/src/components/*.tsx`. No component code was changed.

### #594 — chart.series-1 example

- `docs/reference.content.json` — appended a "### Chart token example" subsection to the
  `tokens` owner's `notes` field: a worked `useBeeToken('chart.series-1')` /
  `useBeeToken('chart.positive')` snippet, explicitly contrasted with the non-typechecking
  `colors.chart-series-1`, and the full ten-name `chartColorTokens` list. Verified against
  `packages/tokens/src/index.ts` (`chartColorTokens`, `beeTokenReaderCategories.chart`) before
  writing — the doc's own reference page (`/docs/reference/tokens/`, the URL named in the issue)
  had a token-name table but no runtime-read example anywhere; `docs/theming.md` and
  `docs/component-reference.content.json` already had one each, so only the reference-hub page
  was missing it.
- Regenerated `apps/docs/src/content/docs/reference/tokens.md` via
  `pnpm docs:reference:generate`; `pnpm docs:reference:check` and `docs:reference:test` pass.

### #585 / #590 sweep

Both issues' rc.2-verification comment lists items the reviewer did not re-score (not
necessarily still broken). Table below: what I found on inspection, what I fixed, what remains.

| # | Item | Source | Status found | Action |
| --- | --- | --- | --- | --- |
| 1 | Overlapping pages restate each other | #585 pattern 1 / #590 item 1 | `responsive.md` <-> `learn/responsive-model.md` and `compatibility/index.md`'s toolchain table already carry explicit "this is the short summary, X is the authority" / "repeated here intentionally because..." notes — already fixed. `registry/` <-> `cli-source-ownership` <-> `reference/cli` already coherent (concept page -> npx walkthrough w/ explicit maintainer-mode section -> flag lookup table, each cross-linking, no restated command styles). `release-security/index.md` duplicated the Start install command verbatim — **fixed**: replaced with a pointer to Start. | Docs-fixed (this workstream) |
| 2 | Maintainer's-seat wording on consumer pages | #585 pattern 2 | `guides/troubleshooting.md`'s "CLI and source-ownership conflicts" section (7 entries) and one entry under "Unsupported compatibility combinations" told a consumer to run `pnpm beeui ...` — a workspace-local script that does not exist in a consumer's project — for real CLI error strings a published-CLI consumer would also hit. `cli-source-ownership.md`/`reference/cli.md` already handled this correctly (explicit "Repository-local maintainer mode" section). | **Fixed** (this workstream): switched the primary command in every affected entry to `npx @beemvp/beeui-cli@next <command>`, with the `pnpm beeui` checkout-equivalent noted inline; added a scoping sentence at the section head. |
| 3 | No audience/prerequisite line on 30/52 pages | #585 pattern 3 | 41/48 non-component/non-pattern pages already had one. `learn/index.md` and `start/provider-safe-area.md` (hand-authored) did not. The five generated `reference/*.md` pages also lack one — that field is not part of `public-reference.mjs`'s schema (title/description/intro/notes); adding it needs a generator schema change. | **Fixed** learn/index.md and provider-safe-area.md (this workstream). Reference pages' missing Prerequisites needs a **generator change**, out of scope for a docs-sources-only workstream — flagged below. |
| 4 | Accessibility task guides contain no task | #585 pattern 4 | Comment says landed in #617; not flagged "not re-scored" in the rc.2 verification comment. Not independently re-audited here (out of the explicit "not re-scored" list). | No action |
| 5 | CLI invocation inconsistent (`pnpm beeui` vs `npx @beemvp/beeui-cli@next`) | #585 pattern 5 / #590 item 1 | Same root cause as row 2 above; `troubleshooting.md` was the one page still inconsistent. | **Fixed** as part of row 2's edit |
| 6 | Theming `@source`, Start defers config to repo path | #585 pattern 6 | rc.2-verification comment says "Confirmed." | Already fixed, no action |
| 7 | Component template: define Registry once, prerequisites line, self-contained example, platform difference | #585 pattern 7 | rc.2-verification comment says "Confirmed" for Prerequisites line + self-contained examples; read `apps/docs/src/content/docs/components/sheet.md` directly and confirmed it defines **Registry** inline once, bolded, with no repeat. | Already fixed, no action |
| — | Inline definition of "Registry" | #585 pattern 7 / general | `registry/index.md` defines it in its first paragraph; generated component pages (checked `sheet.md`) define it once per page; `reference/cli.md` and `cli-source-ownership.md` both link back to `/docs/registry/` rather than redefining it. | Already fixed, no action |
| 2 | Accessibility sidebar order | #590 item 2 | rc.2-verification: "Fixed" | No action |
| 3 | Learn examples reference undeclared types | #590 item 3 | rc.2-verification: "Fixed" | No action |
| 4 | Reference Core: 12 values with no description | #590 item 4 | rc.2-verification: "sampled 3 of 12." Re-checked all 12 names (`cn`, `clampCalendarDate`, `constrainOverlayViewportToKeyboard`, `createOverlayDismissStack`, `getSafeAreaCollisionPadding`, `isCalendarDateDisabled`, `isCalendarDateWithinRange`, `isLeapYear`, `isSameCalendarDate`, `isValidCalendarDate`, `mergeOverlayCollisionPadding`, `resolveAnchoredOverlayPosition`, `windowRectToHostRect`) against the current generated `apps/docs/src/content/docs/reference/core.md` — **all 12 now have a real description**. | Already fully fixed (JSDoc in `packages/core`, not touched here), no action |
| 5 | `Text.numeric` crashes on an invalid literal | #590 item 5 | `numericVariantFontVariants[numeric] is not iterable` — needs a defensive-lookup fix in `packages/ui/src/components/text.tsx`. Component code. | **Runtime-remaining** — not fixed here (out of scope: "Do not change component code under packages/") |
| 6 | Site availability (hosting/ops) | #590 item 6 | Explicitly out of scope per this workstream's instructions | Out of scope, no action |

**Docs-fixed this pass:** release-security duplicate install block; troubleshooting.md's
maintainer-seat CLI wording (7 entries, the concrete remaining CLI-invocation-consistency and
consumer-seat-wording defect); Prerequisites lines on learn/index.md and provider-safe-area.md.

**Runtime-remaining (component code, other workstreams):** `Text.numeric` invalid-literal crash
(#590 item 5). The reference/*.md Prerequisites-line gap is a generator-schema change, not
component code, but is likewise out of this workstream's docs-sources-only scope.

## Checks

- `pnpm llms:check` — **PASS**
- `pnpm llms:test` — **PASS** (11/11)
- `pnpm docs:reference:check` — **PASS** (5 owner pages, 219 surfaces)
- `pnpm docs:reference:test` — **PASS** (23/23)
- `pnpm docs:public-truth:check` — **PASS** (re-run after all edits)
- `pnpm docs:examples:check` — **PASS** (re-run after all edits)
- `pnpm ai-contract:check` — **PASS** (re-run after all edits)
- `pnpm docs:portal-pages:check` — **PASS** ("Portal page freshness check passed", confirmed after a ~13-minute run under extreme host contention)
- `pnpm docs:examples:test` — **PASS** (10/10, including "runChecks passes for the committed docs")
- `pnpm web:check` — **PASS** ("Public Web quality gate passed.", confirmed after a ~46-minute run under sustained extreme host contention)

Host load (`uptime`) was 130–280 for the whole session — many concurrent worktree agents
sharing this machine. `docs:portal-pages:check`, ordinarily fast, took ~13 minutes here;
`web:check` runs a full Astro site build (`scripts/public-web-checks/seo.mjs` builds into a
temp dir before reading `index.html`/`sitemap.xml`/etc.), which is inherently the heaviest of
the required checks and took ~46 minutes wall-clock under this load. Both eventually passed
cleanly with no violations reported.

Before the run completed, every substring assertion in `web:check`'s two submodules whose
`REQUIRED` file lists overlap edited files (`scripts/public-web-checks/guides.mjs`,
`scripts/public-web-checks/start.mjs`) was also manually verified by direct grep against the
edited files, as a faster independent cross-check — all held, consistent with the eventual
clean pass.

`docs:portal-pages:generate` was **not** run (only `--check` variants of portal-page-adjacent
scripts were used); no component portal pages were regenerated, matching the constraint.

**All required checks are now green.**

Manually verified (spot checks, since the two slow checks reproduce this mechanically):
`pnpm web:check`'s per-file assertions (`scripts/public-web-checks/guides.mjs`,
`start.mjs`) require specific substrings on the exact files this workstream touched
(`troubleshooting.md`, `migration-versioning.md`, `release-security/index.md`, `expo.md`,
`bare-react-native.md`, `provider-safe-area.md`); every required substring (canonical
`github.com` link, no stub language, `bash setup.sh`/`bash bundle.sh`/`npx expo start`, the
`@import`/`withUniwindConfig`/`cssEntryFile` triples, `Metro bundling`, `Nested BeeUIProvider
behavior`/`Overlay scopes`/`Toast scope`/the exact `edges={['top', 'left', 'right']}` string)
is still present after editing — confirmed by direct grep against each file.

## Files changed

- `CHANGELOG.md`
- `docs/ai-agent-cookbook.md`
- `docs/decisions/013-production-demo-architecture.md`
- `docs/reference.content.json`
- `scripts/generate-llms-txt.mjs`
- `llms.txt`, `llms-full.txt`, `llms-patterns.txt` (regenerated)
- `apps/docs/src/content/docs/guides/migration-versioning.md`
- `apps/docs/src/content/docs/guides/troubleshooting.md`
- `apps/docs/src/content/docs/learn/index.md`
- `apps/docs/src/content/docs/reference/tokens.md` (regenerated)
- `apps/docs/src/content/docs/release-security/index.md`
- `apps/docs/src/content/docs/start/index.md`
- `apps/docs/src/content/docs/start/expo.md`
- `apps/docs/src/content/docs/start/bare-react-native.md`
- `apps/docs/src/content/docs/start/provider-safe-area.md`

No `packages/` component code was changed.
