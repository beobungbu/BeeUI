# WS-H — docs + registry close-out — implementation report

Branch: `ws/h-docs-closeout`, created from `fix/consumer-audit-batch` @ `507f191` (the worktree's
own checkout had drifted to an unrelated `worktree-agent-*` head; the branch was created directly
from `507f191` — the commit the spec/report files describe — to match the integration branch, same
drift pattern earlier workstreams recorded).

Final commit: `025bdce781e42d70be06f23c9bfbd3e70aa20758`

## Currently-failing gates named in the spec (fixed first)

| Gate | Fix |
| --- | --- |
| `pnpm registry:verify` | Added a `toolbar` registry entry (`registry/registry.json`), plus fixed core-cn transform drift already present on disk for `box`/`icon-button`/`safe-area`/`search-input` (each imports `cn` from `@beemvp/beeui-core` but had `transforms: []` and no `core-cn` dependency — a pre-existing bug the CLI's own copied-source integrity test caught once exercised). |
| `pnpm docs:contract:check` | Added a `toolbar` entry to `docs/component-reference.content.json`, ran `pnpm docs:contract:generate`. |
| `pnpm docs:surface:check` | Registered a Toolbar Showcase fixture + generated/acknowledged the surface inventory (see below). |
| `pnpm docs:portal-pages:check` | Regenerated after all content/generator changes; passes. |

## Per-spec-item status

1. **New Toolbar component page** — Done. `docs/component-reference.content.json` entry added;
   registered in `registry/registry.json` (`core-cn`, `dropdown-menu` deps); categorized under
   "Actions & controls" (`scripts/public-component-reference.mjs`). WS-F's own showcase example was
   a `__tests__/*.test.tsx` file that imports a private `packages/ui/src/...` path, so it fails the
   generator's public-boundary-fixture rule — added a new public-boundary fixture
   `apps/showcase/component-gallery/toolbar-showcase.tsx` and wired it into
   `example-registry.ts`/`component-coverage.ts`/`addressable-component-gallery.tsx`/
   `component-gallery.tsx`. Generated page: `apps/docs/src/content/docs/components/toolbar.md`.
2. **Tabs page** (`scrollable`, `addon`, `closable`/`onClose`/`closeAccessibilityLabel`,
   selection-moves-to-neighbour) — Done. Added to `tabs`'s `behavior`/`limitations` in
   `docs/component-reference.content.json`.
3. **OTPInput `appearance="segmented"`** — Done, added to `otp-input`'s `behavior`/`limitations`.
   `onChange` event shape was already documented in `notes` (D2).
4. **Table `density`, `TableCell align`, `TableRow selected/onPress`** — Done. `align`/`onPress`
   were already documented (D2/WS-C); added `density` to `behavior`. `#580`'s "2 undocumented Table
   props" (`columnIndex` on `TableCellProps`/`TableHeadProps`) — verified on disk: both already
   carry `@internal` tags on the shared `TableColumnPositionProps` mixin, and the generated
   `table.md` already has no `columnIndex` row — **already resolved by the existing internal-marking
   convention**, no action needed.
5. **Toast `BeeUIProvider.toastPlacement`**, **Field `requiredLabel`**, **Stepper `orientation`**,
   **DropdownMenuItem `description`**, **IconButton `size`/`count`**, **ListItem `active`**, **Chip
   static variant / ChipGroup deselect**, **Screen `scroll`**, **SearchInput `trailing`**,
   **SegmentedControl `accessibilityLabel`**, **PasswordInput show/hide labels** — Done, all added
   to the respective `docs/component-reference.content.json` entries. Two pre-existing **stale**
   claims found and corrected while doing this: IconButton's limitations said "a size prop is not
   accepted" (false — `size` is inherited from `ButtonProps` and used), and PasswordInput's
   limitations said the toggle text is "a hardcoded English Show/Hide" (false — `showLabel`/
   `hideLabel` already drive the rendered text per the component's own comment). Chip's "static
   variant" is `interactive={false}` and ChipGroup's "deselect" is `allowDeselect` — both already
   implemented in `packages/ui/src` (contradicting `ws-d2-report.md`'s "not fixed — out of
   ownership" note for `#573` items 1–2, which must have been written against an earlier commit).
6. **Input page #606 keydown-bubble text** — Done, published verbatim (condensed) from
   `ws-e-report.md`'s "Docs text to publish" block into `input`'s `notes`.
7. **#599 typography mapping** — Done. Added a `variant` ↔ `fontSize`/`lineHeight`/weight table to
   `reference/tokens.md` (via `docs/reference.content.json`'s `tokens.notes`) and a cross-link note
   on the `text` component page.
8. **#585 site-level items 2, 3, 4, 5, 7** — Partial (see breakdown below).
9. **Theming page / WS-G note** — Done. Added a short paragraph to `theming/index.md`'s "Brand scope
   and density" section describing the Web scoping contract (per-theme un-anchored class selector,
   nearest-ancestor CSS custom-property resolution) per the coordinator's exact brief, without
   describing WS-G's internal generator mechanics.

### #585 breakdown

| Item | Status | Notes |
| --- | --- | --- |
| 2. Maintainer's-seat writing on consumer pages | **Not attempted** | Broad, subjective, cross-cutting prose pass across an unbounded page set; reviewed `guides/troubleshooting.md` (heavy `pnpm beeui` usage) and judged a safe rewrite out of this session's time budget — flagging for a dedicated pass. |
| 3. No audience/prerequisite line on 30/52 hand-written pages | **Not attempted** (component template's line partially overlaps, see item 7) | Same reason as item 2 — a page-by-page audit of the 52 hand-written pages was not done. |
| 4. Accessibility "task guides" contain no task | **Done** | Added a numbered, concrete "Task: verify..." section to both `accessibility/keyboard-focus.md` and `accessibility/native-assistive-tech.md`. |
| 5. CLI invocation inconsistency | **Partial** | Audited all pages using `pnpm beeui`/`npx @beemvp/beeui-cli`. Fixed the one clear defect: `reference/cli.md` (via `docs/reference.content.json`) led with the repo-local `pnpm beeui <command>` form with no mention of the published CLI at all — now leads with `npx @beemvp/beeui-cli@next <command>` and demotes `pnpm beeui` to the explicit maintainer-checkout case, matching `guides/cli-source-ownership.md`'s existing convention. `guides/troubleshooting.md`'s pervasive `pnpm beeui` usage was reviewed and left — a maintainer-tone rewrite of a 500+-line page, same as item 2. |
| 7. Component template (Registry defined once, prerequisites line, self-contained examples, real platform difference) | **Partial** | "Self-contained examples" = `#578`, already fixed (WS-D2). Added: a **Prerequisites** bullet to every generated component page's Identity section, and a one-time plain-language definition of "Registry" the first time it is used substantively (Import section), instead of repeating the bare term 6+ times with no definition — both via `scripts/public-component-reference.mjs`, so the fix applies to all 63 pages at once. **Not attempted**: "state the actual platform difference" (the generic `renderPlatformImplementation` wording) — a larger, per-component-accurate rewrite not done given the time budget. |

## Gate results (exact commands, all green)

```
pnpm registry:verify && pnpm registry:test          → PASS (71 items, 63 public components; 103/103 tests)
pnpm docs:contract:check                             → PASS (63 components, docs/component-reference.md up to date)
pnpm docs:surface:check                              → PASS (692 derived rows, inventory fresh, blobs acknowledged)
pnpm docs:portal-pages:check                         → PASS (component + pattern pages match generators)
pnpm docs:examples:check                             → PASS (239 docs scanned)
pnpm docs:patterns:check                              → PASS (37 screens)
pnpm llms:check                                       → PASS
pnpm ai-contract:check                                → PASS (public-component count claims accurate — 63)
pnpm docs:reference:check                             → PASS (5 owner pages, 219 public surfaces)
pnpm docs:public-truth:check                          → PASS
pnpm site:contract:check                              → PASS
pnpm docs:a11y:check                                  → PASS
pnpm docs:search:check                                → PASS (28/28 queries)
pnpm docs:budget:check                                → PASS (153 pages, largest 22.9 KB gzipped / 32 KB budget)
pnpm --filter @beemvp/beeui-showcase example-registry:check → PASS (63 public components + 37 pattern sources)
pnpm docs:build                                       → PASS (153 pages; 28/28 search-intent; page budget/social-card/keyboard-scroll all pass)
```

Additional verification beyond the spec's required list, run because generator/showcase files were
touched:

```
pnpm --filter @beemvp/beeui-showcase typecheck        → PASS
pnpm --filter @beemvp/beeui-showcase test             → PASS (123 suites / 1108 tests)
pnpm build (root: core/tokens/ui)                     → PASS
node --test scripts/__tests__/public-component-reference.test.mjs   → PASS (283/283; found and fixed two
  hardcoded ratchet-floor constants — PROP_DESCRIPTION_FLOOR 648→674, PROP_DISTINCT_DESCRIPTION_FLOOR
  310→333 — that must track the real measured count after Toolbar's props were added)
node --test scripts/__tests__/component-reference.test.mjs          → PASS (8/8; fixed two hardcoded
  "62 public components" assertions → 63)
node --test scripts/__tests__/beeui.test.mjs                        → PASS (103/103; fixed a hardcoded
  sorted-name-list fixture missing "toolbar")
```

## Pages changed

Generated (regenerated via the generators, not hand-edited): all 63 `apps/docs/src/content/docs/components/*.md`
(new: `toolbar.md`; content changes on `chip`, `date-picker`, `date-time-picker`, `dropdown-menu`,
`field`, `icon-button`, `input`, `list-item`, `otp-input`, `password-input`, `safe-area`, `screen`,
`search-input`, `segmented-control`, `stepper`, `table`, `tabs`, `text`, `toast`; every page also
gained the new Prerequisites bullet + Registry definition; line-number shifts on the rest from the
new Toolbar section inserted into `component-gallery.tsx`), all 37 pattern pages under
`apps/docs/src/content/docs/patterns/**` (CLI dist-tag pin fix), `apps/docs/src/content/docs/reference/tokens.md`
and `reference/cli.md`, `docs/component-reference.md`, `llms.txt`/`llms-full.txt`/`llms-components.txt`.

Hand-authored: `apps/docs/src/content/docs/theming/index.md` (BeeThemeScope Web scoping note),
`apps/docs/src/content/docs/accessibility/keyboard-focus.md` and `native-assistive-tech.md`
(concrete verification tasks), `apps/docs/src/content/docs/guides/density.md` (corrected stale
"Table has no per-instance density override" claim).

Curated-content sidecars (source of the generated prose above): `docs/component-reference.content.json`,
`docs/reference.content.json`. Also touched, following WS-D2's own precedent for this exact file
(outside this phase's literal ownership list but the only path to fix an `ai-contract:check`
failure caused directly by this workstream's registry addition): `docs/ai-agent-cookbook.md`
(stale "62 public component modules" → 63).

Registry/CLI: `registry/registry.json` (new `toolbar` entry; `core-cn` transform/dependency fix on
4 pre-existing entries). Showcase (new public-boundary fixture, per the spec's "apps/showcase
examples only if a docs page needs a registered example for a new prop" allowance):
`apps/showcase/component-gallery/toolbar-showcase.tsx` (new), `component-gallery.tsx`,
`addressable-component-gallery.tsx`, `example-registry.ts`, `component-coverage.ts`.

Generators (scripts/**, edited only where a generator bug/gap blocked a required gate or an
explicit spec item): `scripts/public-component-reference.mjs` (Toolbar category rule, Prerequisites
+ Registry-definition template change, ratchet-floor constants), `scripts/public-pattern-reference.mjs`
(pin the published CLI dist-tag in the generated "Source ownership" section — was hardcoded
unpinned, failing `docs:public-truth:check` on all 37 pattern pages once BeeUI's publication state
flipped to "published"). Tests updated to match (`scripts/__tests__/beeui.test.mjs`,
`component-reference.test.mjs`, `public-component-reference.test.mjs`).

## Items needing code changes (not doable from owned files)

- Item 5's `#573`-adjacent "DatePicker locale copy" gap is real and still open in
  `packages/ui/src` (`placeholder`/`previousMonthAccessibilityLabel`/`nextMonthAccessibilityLabel`
  have hardcoded English defaults independent of `locale`) — documented accurately in both
  `date-picker`/`date-time-picker`'s `limitations`, not fixed (out of file ownership).
- `#585` items 2/3/5(partial)/7(partial) — see breakdown table; each needs a dedicated prose pass,
  not a mechanical fix.

## Unresolved / follow-ups

1. `docs/density.md` (repo-root, not under `apps/docs/**` or `docs/*.content.json` — outside this
   phase's literal ownership) still doesn't mention Table's `density` prop; the equivalent
   consumer-facing page (`apps/docs/src/content/docs/guides/density.md`) was fixed since it is
   owned.
2. `pnpm docs:surface:diff` (not in the spec's required Gates list) reports the 9 new public
   surfaces added since `origin/development` as additive-only and asks for a changeset
   (`pnpm changeset`) — not run here; release/versioning is a different workstream's concern and
   the gate is not in this phase's required list.
3. #585 items 2/3/5(partial)/7(partial) as listed above.

Status: DONE_WITH_CONCERNS
Branch: ws/h-docs-closeout @ 025bdce781e42d70be06f23c9bfbd3e70aa20758
Summary: Fixed all 4 named failing gates plus all 15 required Gates in the spec (all green, plus full showcase/build/portal-pages-test verification); documented every spec item 1–9, most fully, `#585` items 2/3/5/7 partially per the documented scope decisions above.
Concerns: `#585` items 2 and 3 (maintainer's-seat writing, 30 missing prerequisite lines on hand-written pages) were not attempted — genuine broad prose passes outside a mechanical fix's time budget; DatePicker/DateTimePicker's locale-doesn't-translate-placeholder gap is a real code defect documented but not fixable from owned files.
