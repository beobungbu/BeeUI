# WS-D2 report — docs: components, props generator, patterns, llms, site structure

Branch: `ws/d2-docs-components` (built on `fix/consumer-audit-batch` @ e437553, merged with
`fix/consumer-audit-batch`'s later WS-D1 fixes and WS-C's merge point). Base worktree was
created at `development` HEAD (e8b8de0) instead of `fix/consumer-audit-batch`; merged the
latter in explicitly at the start (git operations logged, no conflicts) to get the shared plan
files and WS-D1's fixes.

## Per-issue status

| Issue | Status | Notes |
| --- | --- | --- |
| #560 llms-components.txt/`/docs/ai/` never link Props pages | Fixed | Both surfaces now state "Props tables live at `/docs/components/<name>/`" with a worked link. |
| #567 llms-components.txt claims DatePicker native-only | Fixed | Rewrote the "Platform behavior (summary)" bullet in `generate-llms-txt.mjs` to state the real platform-split truth (native system picker / Web Calendar-in-Popover). |
| #565 `*Trigger` is a pressable; IconButton nesting | Fixed | Structural detection in `public-component-reference.mjs` (a `*TriggerProps` whose resolved shape carries `loading`) adds a composition-rule callout to DropdownMenuTrigger, PopoverTrigger, TooltipTrigger, SheetTrigger, DialogTrigger, AlertDialogTrigger pages. |
| #573 item 4 Accordion shadcn `type` callout | Fixed | `docs/component-reference.content.json` `notes` field. |
| #573 item 5 generalize nested-pressable rule | Fixed | One shared rule added to llms-full.txt Architecture invariants and Learn > Composition model, naming `*Trigger`, `ListItem.trailing`, `SettingsItem`+`AlertDialogTrigger`. |
| #573 items 1–3 (Chip static variant, ChipGroup deselect, DatePicker locale copy) | Not fixed — out of ownership | Component API/behavior changes in `packages/ui/src`, not docs. |
| #592 item 3 DropdownMenuTrigger is a full Button | Fixed | Covered by the same #565 callout (structural, not name-specific — fires on any `*TriggerProps` resolving to a real pressable shape). |
| #592 item 1 OTPInput segmented appearance / item 2 Switch Uniwind warning | Not fixed — out of ownership | Component API/behavior in `packages/ui/src`. |
| #569 Timeline `TimelineStatus` literal values undocumented | Fixed | Generator gap: `TimelineStatus` is a non-barrel-exported local type alias; `component-props-lib.mjs` now inlines a field's own literal-union type when its alias isn't in the family's public `Exported types` list (same fix also resolved #580 item 2, see below). |
| #578 "Verified example source" fragments (7 pages) | Fixed | `public-component-previews.mjs` now recovers real imports, enclosing-scope state (climbing past inline callbacks, not stopping at the first one), sibling top-level helper declarations, and a labeled typed placeholder for a prop the fixture's own component receives. Verified with a throwaway tsc harness (not committed): Button, Field, Input, Dialog, Select, Sheet fully typecheck as pasted. Toast's third example (a bulk-queue snippet cut below its own `for` loop) still needs the loop header — narrow residual gap, documented below. |
| #579 PaginationItem.page / BeeThemeScope required-vs-optional | Already fixed on disk | Verified via `docs:reference:check`/`docs:portal-pages:check` before any edits — the union/discriminated-arm renderer already labels required/optional per variant correctly. No change needed; issue can be closed as already resolved by a prior commit. |
| #580 item 1: 30 defaults rendered "—" | Mostly fixed | `component-props-lib.mjs`: (a) `extractDefaults` now scans every component file, not just the family's own, recovering a `loading = false` default declared on `Button` for the 11 `*Trigger`/`*Close`/`*Action`/`*Cancel` pressables that alias `ButtonProps`; (b) a destructured default naming an identifier imported from a sibling file (`DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL`) now resolves through the import, recovering `clearAccessibilityLabel` on DatePicker/DateTimePicker; (c) a prop forwarded verbatim, unmodified, to a same-named prop on a different BeeUI component (`nextMonthAccessibilityLabel={nextMonthAccessibilityLabel}` into `Calendar`) now inherits that component's own default. Residual "—" cells (Breadcrumb.separator, Calendar locale/weekStartsOn/visibleMonth, Select.maxHeight, etc.) are genuinely conditional/computed values, not simple literals — the generator's own tested design principle is to never guess a call-expression/computed default, and forcing one would be less accurate than the current Description-column prose, which already states the real behavior. |
| #580 item 2: 2 phantom type names (`FontFamily`, `NumericVariant`) | Fixed | Same mechanism as #569: `resolveLocalNonExportedLiteralAlias` in `component-props-lib.mjs` inlines a field's literal-union/`keyof typeof` type when the named alias is not in the family's barrel-exported type list, checked against `component.types` (the same list "Exported types" renders from), not the file-local `export` keyword. |
| #580 item 2: 2 undocumented Table props (`columnIndex`) | Not fixed — needs WS-C coordination | `columnIndex` is `@internal`-tagged in `table.tsx`, which this generator's own `@internal` filtering deliberately hides from every Props table (existing, correct behavior for genuinely-internal props elsewhere). Fixing it requires either changing the shared `@internal` semantics (risks regressing the 60+ other components that rely on it) or a Table-specific override, and any fix would touch `components/table.md`, which I do not own. Flagging for WS-C. |
| #582 30 of 37 pattern blocks reference undefined domain types | Fixed | `public-pattern-reference.mjs`: `renderPropsBlock` now resolves every capitalized, type-shaped identifier a pattern's props type references — same file, then one hop through a relative import, recursively via a fixed-point closure — and inlines the real declaration, prefixed with a comment naming its source file. Verified: extracted all 37 "State and callback contract" blocks and ran `tsc --strict` against them with a throwaway harness (not committed) — **0 errors**. |
| #582 Table guide's responsive snippet | Not fixed — out of ownership | `apps/docs/src/content/docs/guides/table.md` is explicitly excluded (WS-C). |
| #585 site-level fix 1 (two publication stories) | Fixed within ownership | Component pages' "Distribution status" note, llms.txt family, AI cookbook, and `/docs/ai/` now all read `docs/dist-tag-policy.md` and state the real npm-published truth. Start/guides pages are WS-D1's ownership (already fixed per their report). |
| #585 site-level fix 2 (maintainer's-seat writing) | Not addressed | Broad, subjective, cross-cutting; not attempted given time budget — flagging for a follow-up pass. |
| #585 site-level fix 3 (no audience/prerequisite line on 30/52 pages) | Not addressed | Same reason; would need a page-by-page pass across dirs I own and dirs I don't. |
| #585 site-level fix 4 (accessibility task guides have no task) | Not addressed | Time budget; `accessibility/keyboard-focus.md` and `native-assistive-tech.md` need a rewrite pass, not attempted. |
| #585 site-level fix 5 (CLI invocation inconsistency) | Not audited | Time budget. |
| #585 site-level fix 6 (Theming `@source` lines) | Out of ownership | `theming/` belongs to WS-D1. |
| #585 site-level fix 7 (component template: define Registry once, prerequisites line, self-contained examples, real platform difference) | Partially fixed | Self-contained examples = #578 (fixed). "Define Registry once" / prerequisites line / platform-difference wording were not touched — would require editing the shared page template in `public-component-reference.mjs`, a larger prose pass not attempted given time budget. |
| #590 item 1 responsive.md vs learn/responsive-model.md | Fixed | `responsive.md` now states explicitly it is the short summary and cross-links to Learn as the authority (kept both pages — many generated pattern pages and other docs link `/docs/responsive/`; a redirect/removal was judged too large a structural change for this pass). Registry/CLI-reference/compatibility duplication items are outside my ownership (guides/, reference/cli.md content is shared with WS-D1's registry/compatibility work). |
| #590 item 2 accessibility sidebar order | Fixed | Reordered `astro.config.mjs` sidebar to match the index page (Keyboard & focus first); set `prev: false` on `accessibility/index.md` so it no longer points "Previous" at the last pattern page. |
| #590 item 3 Learn examples with undeclared prop types | Fixed | Declared `AppShellProps`, `CurrencySelectProps`, `EmailFormProps` in ownership-model.md/composition-model.md/forms-model.md. Verified with a throwaway tsc harness (not committed) against the built `@beemvp/beeui-ui` package — all three typecheck. |
| #590 item 4 Reference Core: 12 undocumented values | Fixed without touching `packages/core/src` | `packages/core/src/**` is WS-B's exclusive file ownership. Added a `valueDescriptions` fallback map to `docs/reference.content.json` and a matching fallback in `public-reference.mjs` (JSDoc always wins when present, matching the Props-table glossary's own precedence rule) — fills all 13 rows that showed "—" (issue said 12; the real count on disk was 13, all filled). |
| #590 item 5 `Text.numeric` crashes on invalid literal | Not fixed — out of ownership | Runtime robustness fix in `packages/ui/src`. |
| #590 item 6 site availability (CDN stalls) | Not applicable | Operational/infrastructure, not a docs-content fix. |
| #566 item 5 OTPInput.onChange event shape | Fixed | `docs/component-reference.content.json` `notes` field on `otp-input`. |
| #566 item 6 `/sitemap-index.xml` empty at site root | Fixed | `build-public-worker.mjs` now composes a real, deterministic `sitemap-index.xml` at the site root pointing at `/sitemap.xml` and `/docs/sitemap-index.xml`. Verified via new unit tests; could not verify against the live Worker deployment (no access to it from this environment). |
| #566 items 1, 2, 3, 4 | Not fixed — out of ownership | Peer-table completeness / RN pin / ListItem prop / version-string paragraph are WS-D1 (already reported fixed) or component-API (`ListItem` prop) work. |
| #611 item 5 Select inside Popover is supported | Fixed | `docs/component-reference.content.json` `notes` field on `select`. |
| #611 items 1–4, 6 | Not fixed — out of ownership | Toolbar overflow primitive, Stepper orientation/clamp, disabled-Switch contrast, Separator height are component API/behavior in `packages/ui/src`. |
| #594 chart token path (`chart.series-1` not `colors.chart-series-1`) | Fixed | `docs/component-reference.content.json` `notes` field on `use-bee-token`, cross-linking `/docs/reference/tokens/`. `reference/tokens.md` itself is generated read-only inventory (no prose slot for this); the clarification lives on the page a reader actually calls `useBeeToken` from. |
| #599 typography scale reachable only via Text `variant` | Partially fixed | `use-bee-token`'s note states typography is not one of the runtime-readable categories and points at the Text component page. Did not add a `variant` → font-size/weight/line-height mapping table to `components/text.md` (generated page, would need a new template section) or to `reference/tokens.md` (WS-D1 already added a typography-scale section to `theming/index.md` per their report) — given the overlap with WS-D1's existing fix, judged lower priority under the time budget. |
| #543 AI-agent cookbook / llms unpublished claims (handed off from WS-D1) | Fixed | Same `dist-tag-policy.md`-driven fix as #545/#560/#567 covers this: `docs/ai-agent-cookbook.md`, `/docs/ai/`, and the whole llms.txt family now state the real npm-published state everywhere I found a hardcoded "UNPUBLISHED"/"remain unpublished" string, including all 61 generated component pages (table.md excluded, needs WS-C to regenerate after merge — see below). |
| #545 system/light/dark theme docs (handed off from WS-D1) | Fixed | llms-full.txt "Runtime theme switching" section and the cookbook's Recipe F now state the `'system' \| 'light' \| 'dark'` contract and the known `setTheme('system')` restore-semantics gap, mirroring `theming/index.md`'s wording (WS-D1). |
| #594 (also listed in handoff) | Fixed | See above. |
| #599 (also listed in handoff) | Partially fixed | See above. |
| #566 item 5 (also listed in handoff) | Fixed | Duplicate of the item already in my original scope; done once. |

## Generators/scripts changed (and why each fix generalizes)

- `scripts/generate-llms-txt.mjs` — reads `docs/dist-tag-policy.md` via `extractPublicationPolicy` (imported from `check-public-doc-truth.mjs`, the same function the site's own publication-truth check uses) instead of a hardcoded `UNPUBLISHED_NOTE`; fixed the DatePicker platform-behavior bullet; added the system/light/dark section; added the nested-pressable architecture invariant; linked Props pages in the "How to read this" section.
- `scripts/check-ai-agent-contract.mjs` — same policy-driven branch for the cookbook's distribution-status checks (`states the current npm publication status` / `does not carry a stale unpublished claim` replace the old unconditional `states the UNPUBLISHED status`).
- `scripts/component-props-lib.mjs` — `extractDefaults` scans every component file (not just the family's own) for a destructured default; a destructured default naming an identifier imported from a sibling file now resolves through that import; a prop forwarded verbatim into a same-named prop on a different BeeUI component inherits that component's default; a field's type resolves to its real literal union when its named alias is not part of the family's barrel-exported type list.
- `scripts/public-component-reference.mjs` — reads the same publication policy for the per-page "Distribution status" note (was hardcoded on all 62 pages); adds the pressable-trigger composition-rule callout.
- `scripts/public-component-previews.mjs` — recovers real imports/scope state/sibling helpers/prop placeholders for excerpted "Verified example source" blocks (#578).
- `scripts/public-pattern-reference.mjs` — resolves and inlines domain fixture types into pattern "State and callback contract" blocks (#582); dropped a stale "before public CLI publication" phrase.
- `scripts/public-reference.mjs` — `valueDescriptions` curated fallback for a Reference value with no JSDoc.
- `scripts/build-public-worker.mjs` — composes a real root `sitemap-index.xml`.
- `docs/component-reference.content.json`, `docs/reference.content.json` — curated prose additions (Accordion shadcn note, Select-in-Popover, OTPInput.onChange, useBeeToken chart-token path, 13 Reference Core value descriptions). Note: these two JSON files sit at the repo root under `docs/`, not under `apps/docs/src/content/docs/`; they are the designated curated-content sidecars for generators I own (the *only* mechanism those generators read prose from), so I treated editing them as within the "docs generators" ownership grant. Flagging this interpretation explicitly in case the controller disagrees.
- `docs/ai-agent-cookbook.md` — repo-root file, not under `apps/docs/`. Edited per the coordinator's explicit mid-task handoff (cross-referenced against WS-D1's own completion report, which explicitly excludes it and asks for D2/an LLM-surface owner). Flagging the same way.

## File ownership notes / conflicts

- **`components/table.md`**: every `docs:portal-pages:generate` run regenerates all 62 component pages, including `table.md` (owned by WS-C). Every commit in this branch reverts `table.md` to its committed state before committing, so **no commit here touches it**. `pnpm docs:portal-pages:check` currently fails with exactly one line — `table.md is stale` — because the fixed generators (Distribution-status wording, pressable-trigger callout if it ever applied, defaults/type fixes) would change it too. **WS-C needs to run `pnpm docs:portal-pages:generate` once after merging this branch** to pick up the corrected generator output for Table's own page (mainly the Distribution-status paragraph and, if relevant, any Props-table `columnIndex` decision).
- No other file ownership conflicts encountered.

## Gate results (exact commands, run from repo root after `corepack pnpm install --frozen-lockfile` and `pnpm build` — the latter needed only for the tsc verification harnesses, not for the docs gates themselves)

```
pnpm docs:reference:check       → PASS (5 owner pages, 219 public surfaces)
pnpm docs:surface:check         → PASS (683 rows owned)
pnpm docs:portal-pages:check    → FAIL, scoped to `table.md` only (see above; expected/documented)
pnpm docs:a11y:check            → PASS (after `pnpm docs:build`)
pnpm docs:examples:check        → PASS (238 docs scanned)
pnpm docs:patterns:check        → PASS (37 screens)
pnpm llms:check                 → PASS
pnpm ai-contract:check          → PASS
pnpm docs:contract:check        → PASS
pnpm docs:build                 → PASS (152 pages; 28/28 search-intent queries; page budget, social-card, keyboard-scroll gates all pass)
```

Node test suites run (all green):
```
node --test scripts/__tests__/generate-llms-txt.test.mjs        → 11/11
node --test scripts/__tests__/ai-agent-contract.test.mjs        → 16/16
node --test scripts/__tests__/public-component-reference.test.mjs → 164/164 (slow: ~7 min/run, TS-checker-heavy)
node --test scripts/__tests__/public-component-previews.test.mjs  → 34/34 (3 new tests added)
node --test scripts/__tests__/public-pattern-reference.test.mjs   → 85/85 (2 new tests added)
node --test scripts/__tests__/public-reference.test.mjs           → 23/23 (1 new test added)
node --test scripts/__tests__/public-worker.test.mjs              → 7/7 (2 new tests added)
node --test scripts/__tests__/public-web.test.mjs                 → 9/9 (full aggregate contract, unaffected)
```

## #578/#582 tsc verification method

Both issues explicitly asked for the pasted blocks to be proven runnable via a real `tsc` pass,
not just generator self-consistency. Method (harness never committed, lived under
`apps/showcase/.verify-*-tmp/` transiently and was deleted before every commit — verified via
`git status` after each cleanup):

1. Ran `pnpm build` once (`packages/core`, `packages/tokens`, `packages/ui`) so `@beemvp/beeui-ui`
   resolves through its real, normal package resolution (`node_modules/@beemvp/beeui-ui` →
   `dist/typescript/...`) instead of fighting the source tree's own internal type-augmentation
   setup (`packages/ui/src/types/react-native-classname.d.ts`, Uniwind's `className` augmentation)
   from a foreign tsconfig.
2. Ran `apps/showcase`'s own `uniwind generate-artifacts` once (`apps/showcase/uniwind-types.d.ts`
   is gitignored and regenerated on demand — this reproduces the exact gap WS-D1 already
   documented and fixed in `start/expo.md` for #562, just needed locally too).
3. For #578: extracted each of the 7 named pages' full "Verified example source" section
   (imports block + each fixture-state/placeholder/excerpt group) into one `.tsx` per page,
   wrapped each excerpt in its own function. Typechecked with a `tsconfig.json` extending
   `apps/showcase/tsconfig.json` unmodified (so module resolution, Uniwind's `className`
   augmentation, and `customConditions` all match the real app exactly).
4. For #582: extracted each of the 37 pattern pages' "State and callback contract" fenced block
   (pure type declarations, no imports) into its own `.ts` and typechecked with a minimal strict
   `tsconfig.json` (no BeeUI/RN dependency needed — these blocks are type-only).
5. Deleted the harness directories/files after each verification pass; `git status` confirmed
   clean before every commit.

Result: 6/7 #578 pages (Button, Field, Input, Dialog, Select, Sheet) and 37/37 #582 pattern
blocks compile with **zero errors**. Toast's third example needs its enclosing `for` loop header
(see the #578 row above) — a narrower, still-real gap in the same mechanism, not fixed given the
time budget; the recovered imports/state for Toast's first two examples are correct and verified.

## Unresolved questions / items needing owner or cross-workstream attention

1. **`components/table.md` regeneration** — see File ownership notes above. WS-C should run
   `pnpm docs:portal-pages:generate` after merging this branch.
2. **#580 item 2, `columnIndex` on Table** — needs a decision from WS-C: either loosen the
   `@internal`-filtering rule specifically for a field that is `@internal`-tagged but still
   present in the shipped public `.d.ts` (a real design change to a shared generator rule used
   by 60+ other components), or accept a Table-specific override. Not attempted here since any
   fix touches `table.md`.
3. **`docs/component-reference.content.json` and `docs/reference.content.json` ownership** —
   edited as the only mechanism to add curated prose for generators I own; flagging in case this
   should have gone through a different owner.
4. **`docs/ai-agent-cookbook.md` ownership** — edited per the coordinator's live handoff
   message and cross-referenced against WS-D1's own report recommending D2 pick it up; flagging
   since it sits outside the phase file's literal "File Ownership" list.
5. **#585 site-level fixes 2, 3, 4, 5, 7 (partial)** — not attempted; each is a real,
   larger prose-quality pass (audience/prerequisite lines across 30+ pages, accessibility
   task-guide rewrites, CLI-invocation-consistency audit, component-template Registry/
   prerequisites wording) that did not fit the time budget alongside the generator-level fixes,
   which were judged higher-leverage (each fixes many pages at once) and were prioritized.
6. **#599 mapping table** — a `variant` → font-size/weight/line-height table on `components/text.md`
   or `reference/tokens.md` was not added; WS-D1's `theming/index.md` typography-scale section
   may already cover this need — worth checking before assigning further work here.
