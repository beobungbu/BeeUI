# Independent review — PR #485 (WBS-D031 / #458)

Reviewer: code-reviewer (independent; did not write this code)
Head **assigned for review**: `feat/docs-458-core-guides` @ `9ec743a`
Stated base: `origin/development` @ `aa9be37`
Diff: 40 files, +2078 / −226

**The head moved mid-review.** At review start `origin/feat/docs-458-core-guides` was `9ec743a`. At review end it is `2101ae8` (`fix(scripts): resolve generated docs routes in the internal-link check`, 1 file, +35/−8), pushed by the author while I was probing. Every finding below is stated against `9ec743a` as instructed, with an explicit "status on `2101ae8`" line where the newer commit changes it.

Worktree state: clean at start (`git status --porcelain` empty) and clean at end. All mutation probes ran against shadow roots under `/private/tmp/.../scratchpad/`. The only working-tree change is this untracked report. I did not create the transient `M scripts/public-web-checks/internal-links.mjs` I observed mid-session — that was the author's in-flight edit, since committed as `2101ae8`.

---

## Verdict

**HOLD / REQUEST CHANGES.**

The research quality is high. I spot-checked more than ten assertions across all seven guides against the actual source and the overwhelming majority are exactly right, down to `nativeHitTargetSensitive: true` being set on `rowHeight` alone, the eight `diff` status names matching `update-lib.mjs`'s `STATUS` map one-for-one, the `weekStartsOn` three-step precedence matching `resolveCalendarWeekStartsOn`, and the `border-strong`/`input` 3:1 accessibility-only carve-out matching `contrastContract.accessibilityOnlyPairs` verbatim. The `extractBeeuiImports` bug is real and the fix is correct. The generated-page 404 diagnosis is correct, and I confirmed it against the **live** dev origin.

I am holding for five reasons, in descending order of seriousness:

1. **The reviewed head was red on CI, and the PR body says nothing about it.** `verify-docs` and `build-and-local-smoke` both failed on `9ec743a`, both from the new `internal-links.mjs` check, with 19 false positives. The PR's verification table asserts `pnpm typecheck` PASS (exit 0) — true only on a machine that has already run `docs:build`, which is exactly the machine the author used and exactly not the machine CI uses. This is the failure mode this wave has been warned about: a green local table upstream of the gate that matters.
2. A troubleshooting entry's **Verify** commands exit 1 when run as instructed.
3. Three content assertions are wrong against source, in guides whose selling point is that they were read from source.
4. The new link checker cannot detect the bug class it was written for, and I defeated it four ways.
5. Two PR-body claims ("strict improvement", "25 entries") do not survive checking.

None of this is fatal to the lane. Findings 2–4 are small, local edits.

---

## Blocking findings

### B1 — The new internal-link check fails CI on a clean checkout (19 false positives)

`scripts/public-web-checks/internal-links.mjs:34-41` (at `9ec743a`)

```js
const known = new Set(collectDocsRoutes(rootDir, config.docsBase).map((entry) => entry.route));
```

`collectDocsRoutes` walks `apps/docs/src/content/docs` on disk. Four generated page families live there and are **gitignored** (`.gitignore:24-27`): `components/reference/`, `patterns/reference/`, `compatibility/current.md`, `guides/current-release.md`. They are written only by `apps/docs`'s `prebuild`/`predev`/`pretypecheck` hooks (`apps/docs/package.json:7,9,12`).

The `verify-docs` CI job (`.github/workflows/ci.yml:150-193`) does `checkout` → `pnpm install --frozen-lockfile` → `pnpm web:check`. Nothing generates docs content in between; there is no root `postinstall`/`prepare` (`package.json` has no install hook). In `pnpm typecheck`, `web:check` is step 6 and `pnpm build` is step 20 — the check runs before anything that could produce those files.

The code comment at `:38-40` asserts the opposite: *"collectDocsRoutes walks the content tree, so it sees generated pages only after the apps/docs pre-build hooks have written them. That is the same source docs:foundation:check reads, so a link that resolves here resolves there too."* The premise is stated and then not acted on.

Evidence, both directions:

- **Reproduced locally.** Shadow root with the four generated families removed → `collectViolations` returns 19 violations.
- **Confirmed on real CI.** `verify-docs` job `101023506864` on `9ec743a`: `Verify public docs and Web source contracts :: failure`, log ends with the identical 19 `internal-links.mjs:` lines. `build-and-local-smoke` job `101023441188` failed the same way: `Public Web quality gate failed:` + the same 19.

**Fix (already applied by the author):** derive generated routes from the same manifests the generators consume rather than from files on disk.

**Status on `2101ae8`:** fixed. `generatedDocsRoutes()` builds the set from `buildPublicComponentManifest` / `buildPublicPatternManifest` plus four literal routes. CI `verify-docs` on `2101ae8` is **pass** (job `101027015157`). I could not re-run my CI-condition probe locally because my shadow root lacks the Pattern Gallery runtime registry, so I am relying on the green CI job for that half.

**Residual, carried forward as N3 below:** `2101ae8` hardcodes `/docs/compatibility/current/` and `/docs/guides/current-release/` as string literals (`internal-links.mjs:27-28`), duplicating the two output paths `scripts/public-guide-data.mjs:35-36` writes. The next rename of those files will silently desynchronise the checker instead of failing it — the same class of coupling that produced this PR's original 404.

**Process finding, not fixed by `2101ae8`:** the PR body's verification table needs to say what it actually covers. "PASS (exit 0)" for `pnpm typecheck` on a warm tree is not evidence about a cold CI checkout, and the body should not present a self-run table without the CI status next to it.

### B2 — A troubleshooting entry's Verify commands exit 1 when run as written

`apps/docs/src/content/docs/guides/troubleshooting.md:483-497`, entry "Registry, exports, and source drift apart":

- **Applies to:** the repository.
- **Verify:**
  ```bash
  pnpm beeui -- doctor
  pnpm beeui -- diff
  ```

Observed, from this checkout's root, Node 24.13.1:

```
BeeUI CLI error: BeeUI is not initialized in this project; run 'pnpm beeui -- init' first
doctor exit=1
BeeUI CLI error: BeeUI is not initialized in this project; run 'pnpm beeui -- init' first
diff exit=1
```

There is no `beeui.config.json` at the repo root and there should not be: `doctor`/`diff` call `readConfig(projectRoot)` where `projectRoot` is `getProjectRoot(cwd)` (`packages/cli/src/beeui.mjs:269,287,347`), and `pnpm beeui` runs with cwd at the BeeUI repo root. Both commands are consumer-project commands presented as repository verification.

This matters more than a broken snippet because the page's own schema (`:21`) defines **Verify** as "The command whose success proves it", and step 1 of "Still stuck" (`:504`) tells the reader "Re-read the entry's **Verify** command and run it verbatim". A contributor following that instruction is led toward `pnpm beeui -- init` at the BeeUI repo root, which writes a stray `beeui.config.json` into the monorepo.

**Fix:** point the Verify at the repository's actual registry/export verification — `pnpm ui-exports:check`, `pnpm docs:contract:check`, `node ./scripts/check-doc-examples.mjs` — or re-scope the entry's "Applies to" to a consumer project that has already run `init`.

### B3 — Density guide states the wrong set of density consumers; `Table` is missing

`apps/docs/src/content/docs/guides/density.md:47` (the "Consumed by" column) and `:71` (the ownership table) both say the density variables are read by `ListItem`, `FormGroup` and `Field`.

`Table` reads them too:

- `packages/ui/src/components/table.tsx:296` — `min-h-density-row-height ... ios:min-h-touch-target android:min-h-touch-target`
- `packages/ui/src/components/table.tsx:107`, `:191`, `:214` — `gap-density-row-gap`
- `packages/ui/src/components/table.web.tsx:223`, `:261` — `gap-density-row-gap`

Repo-wide, the consumers are exactly `list-item.tsx`, `field.tsx`, `form-group.tsx`, `table.tsx`, `table.web.tsx`.

The omission is compounded at `:130`: *"A compact table embedded in an otherwise spacious screen is not supported today"* — which a reader will take to mean `Table` is density-blind. The truth is the opposite: `Table` is density-aware, and what is unsupported is *per-subtree* density, which is a different statement. As written the guide will make a reader believe a `Table` inside a `compact` app renders at fixed metrics.

The canonical `docs/density.md:61-63` carries the same omission, so this is inherited rather than invented — but #458's whole premise, and the PR body's phrasing ("read from source rather than assumed"), is that these guides were derived from source, and source disagrees.

**Fix:** add `Table` to both the "Consumed by" column and the ownership row, and rewrite the limitation to say per-subtree density rather than implying tables are exempt. Fixing `docs/density.md` at the same time is the durable version.

### B4 — Density guide's headline magnitude number contradicts its own arithmetic

`apps/docs/src/content/docs/guides/density.md:51-54`:

> in a ten-row settings list: `compact` renders roughly 440px of row height plus 72px of gaps, `comfortable` 560px plus 108px, and `spacious` 640px plus 144px — about a 190px difference across one screen of rows

The three per-mode figures are correct against `densityMetrics` (`packages/tokens/src/index.ts:434-450`): 10 rows × 44/56/64, 9 gaps × 8/12/16. Totals are 512 / 668 / 784 px. The deltas are 156 (compact→comfortable), 116 (comfortable→spacious), 272 (compact→spacious). No pair produces ~190.

This is the one number a skimming reader will carry away, and it is wrong by a wide margin in the direction that undersells the feature.

**Fix:** state the pair explicitly — "about 270px between `compact` and `spacious`".

### B5 — Date & time guide overstates the null-clear contract to cover `Calendar`

`apps/docs/src/content/docs/guides/date-time.md:43-44`:

> All three are **controlled**: `value` is required and may be `null`. `null` from `onValueChange` means an explicit clear.

The first sentence is right for all three (`calendar.tsx:63`, `date-picker-shared.tsx:76`, `date-time-picker-shared.tsx:96` all declare `value: T | null` as required). The second is not:

- `packages/ui/src/components/calendar.tsx:57` — `onValueChange?: (date: CalendarDate) => void;` — **not nullable**
- `packages/ui/src/components/date-picker-shared.tsx:61` — `onValueChange?: (date: CalendarDate | null) => void;`
- `packages/ui/src/components/date-time-picker-shared.tsx:79` — `onValueChange?: (value: DateTimePickerValue | null) => void;`

`Calendar` has no clear path through `onValueChange`; the callback fires only from a cell press (`calendar.tsx:254`). A reader writing a shared `(v: CalendarDate | null) => void` handler against "all three" gets a type error at the `Calendar` call site, and a reader expecting a `Calendar` clear affordance will not find one.

**Fix:** scope the sentence — "`DatePicker` and `DateTimePicker` emit `null` for an explicit clear; `Calendar` emits only a selected date, so clearing is the caller's own control."

---

## Non-blocking findings

### N1 — The link checker cannot detect the bug class it was written for

Still true on `2101ae8`. `contentPathToRoute` (`scripts/generate-docs-foundation.mjs:37-48`) strips only the `.md`/`.mdx` extension and does no Astro slugification, so the route manifest — and therefore `known` — records `foo.bar.md` as `/docs/foo.bar/` while Astro serves `/docs/foobar/`.

Probe: added `apps/docs/src/content/docs/probe.dotted.md` to a shadow root and a link to `/docs/probe.dotted/` → **0 violations**. The checker's own error text (`:68-70`) advertises the rule it does not implement.

Live confirmation the rule is real (dev origin, no redirect follow):

| Request | Status |
| --- | --- |
| `https://beeui-dev.beemvp.com/docs/compatibility/current.generated/` | **404** |
| `https://beeui-dev.beemvp.com/docs/compatibility/currentgenerated/` | 200 |
| `https://beeui-dev.beemvp.com/docs/migration/current-release.generated/` | **404** |
| `https://beeui-dev.beemvp.com/docs/migration/current-releasegenerated/` | 200 |

So the PR's diagnosis is correct and the rename genuinely fixes two live 404s — but the mutation test the PR cites ("it fails on the exact pre-existing `/docs/compatibility/current.generated/` link") passes only because the *file was renamed out from under the manifest*, not because the checker understands dots. Re-add a dotted filename tomorrow and the checker is blind again. A `slugifySegment` step in `contentPathToRoute` (which also fixes `docs:foundation:check`'s manifest) would close it.

### N2 — Four more ways to defeat the link checker

All probed against a shadow root; all still hold on `2101ae8`.

| Probe | Result | Why |
| --- | --- | --- |
| `[tail](/docs/cli/does-not-exist/)` | accepted | `redirectSources.some(p => normalized.startsWith(p))` (`:64`) admits any descendant of a redirect source. 308s to `/docs/guides/cli-source-ownership/does-not-exist/` → 404. |
| `[ghost](/docs/theming/branding/no/such/page/)` | accepted | same |
| `[titled](/docs/totally-invented/ "Title")` | accepted | `LINK_RE` (`:14`) requires `)` immediately after the path; a markdown link title makes the whole link invisible to the regex. A fully invented route escapes. |
| `[rel](../nope/broken/)` | accepted | relative links documented out of scope — but Starlight does not validate them either, so nothing does. |
| `[q](/docs/start/?tab=expo)` | **false positive** | `[^)\s#]*` excludes `#` but not `?`, so the query string is captured into the path and never matches a route. |

Cheap improvements: allow an optional `?…` alongside the existing `#…`; make the redirect check resolve `fromPrefix → toPrefix` and then re-test the rewritten path against `known`, instead of accepting on prefix alone.

### N3 — The `2101ae8` fix reintroduces hardcoded generated-output paths

`scripts/public-web-checks/internal-links.mjs:26-28` now literally spells `/docs/compatibility/current/` and `/docs/guides/current-release/`, which duplicates the two paths `scripts/public-guide-data.mjs:35-36` writes. Importing those constants (or exporting them from `public-guide-data.mjs`) keeps the next rename a compile-level break rather than a silent acceptance.

### N4 — `web/public-site.config.json:107` still pins a moved route

`"migrationHref": "/docs/migration/"` — now a redirect prefix, not a page. It flows through `scripts/generate-docs-foundation.mjs:209` into the published `apps/docs/public/release-state.json`, which today serves that exact string. It resolves in one 308, so nothing is broken, but it makes the PR-body claim "every inbound link move[s] together" untrue, and the internal-link checker does not look at JSON. Should be `/docs/guides/migration-versioning/`.

### N5 — The `component-reference.md` diff is not a "strict improvement"

The PR body says the calendar family "now cites `issue-172-calendar`, `issue-175-date-i18n-component-matrix` and `issue-176-calendar-date-a11y` instead of a generic perf test".

`apps/showcase/__tests__/perf-render-commit.test.tsx:1-25` imports `Calendar` from `@beemvp/beeui-ui` (12 `Calendar` occurrences in the file). It was a legitimate calendar fixture. It was not corrected — it was **displaced** by `pickExamples`'s `limit = 3` (`scripts/generate-component-reference.mjs:68-79`): all four candidates rank 3 (`__tests__`), and alphabetical order puts `issue-17x` ahead of `perf-render-commit`.

The regex fix and the new entries are genuinely good; the characterisation is not. I confirmed the underlying bug independently by running both regexes over the five affected fixtures:

| Fixture | old regex | new regex |
| --- | --- | --- |
| `issue-172-calendar` | `["CalendarDate } from '@beemvp/beeui-core';\nimport { Calendar", "CalendarVisibleMonth"]` | `["Calendar","CalendarVisibleMonth"]` |
| `issue-68-theme-scope` | `["defineThemeRegistry } from '@beemvp/beeui-tokens';\nimport *", "Dialog", …]` | `["BeeThemeScope","Dialog", …]` |

So the old regex was genuinely broken exactly as described, and `[^}]` is the right fix. The theme-scope entry is a pure addition with no loss.

### N6 — `[^}]` narrows one previously-working input

Probed against the real `extractBeeuiImports`:

| Input | Result |
| --- | --- |
| `import { Button, /* } */ Text } from '@beemvp/beeui-ui';` | `[]` — old lazy form extracted both |
| `const x = '}'; import { Button } from '@beemvp/beeui-ui';` | `["Button"]` ✓ |
| multi-line list | ✓ (covered by the new test) |
| `import React, { Button } from '…'` | `[]` (pre-existing, unchanged) |
| `import { Button as Btn } from '…'` | `["Button as Btn"]` (pre-existing, unchanged — alias not split) |

A `}` inside a block comment in an import list is the one regression. Vanishingly unlikely in a doc fence, and worth accepting — but the fix is described as unconditional, and it is not.

### N7 — The new gitignore filenames lose a useful signal

`.gitignore` moves from `compatibility/current.generated.md` / `migration/current-release.generated.md` to `compatibility/current.md` / `guides/current-release.md`. The `.generated` marker was doing real work: it told a contributor at a glance not to hand-edit, and it is exactly the trap the troubleshooting guide's own "A docs page is missing, empty, or contradicts the source" entry warns about. `guides/current-release.md` now sits in a directory of hand-authored guides and will be silently ignored if someone writes it by hand. `current-generated.md` / `current-release-generated.md` — dash, not dot — would keep both the marker and the working route.

### N8 — Two contradictory committed numbers for the same benchmark

`apps/docs/src/content/docs/guides/table.md:227-228` reports ~0.10 ms / ~0.44 ms, matching `apps/docs/src/content/docs/components/table.md:29-30`. `docs/performance-baseline-report.md:106-107` reports ~0.073 ms / ~0.36 ms for the same two scenarios. Both claim the same Apple M1 dev host and the same harness. Pre-existing contradiction, not introduced here — but the new guide propagates one side of it under a "harness-measured evidence" heading without noting the other, which is worth reconciling while this area is open.

### N9 — `/docs/theming/` is a dead end for the pages that left it

`apps/docs/src/content/docs/theming/index.md` now has exactly one `/docs/` link, to `/docs/start/`. It links to neither `/docs/guides/branding/` nor `/docs/guides/density/`, despite the guides index (`guides/index.md:60`) describing Theming as "the semantic token contract that Branding and Density build on". The sidebar still reaches them, so no route is broken; a reader who lands on Theming from search has no in-page path onward.

### N10 — CLI guide implies a project-targeting capability that does not exist

`guides/cli-source-ownership.md:18`: "Run from a BeeUI repository checkout, pointed at the consumer project you are evaluating", immediately above a block starting `pnpm beeui -- init`.

There is no targeting flag. `getProjectRoot(cwd)` (`packages/cli/src/registry-lib.mjs`) is the only mechanism and `pnpm beeui` runs with cwd at the BeeUI repo root, so that sequence initialises and copies into the BeeUI checkout itself. `start/index.md:109` already describes the correct pattern (invoke the packed binary from inside the consumer directory) — this page should say the same thing. Same root cause as B2.

### N11 — Branding table names the token group where readers will type the category

`guides/branding.md:174` lists `motionDuration` as runtime-overridable. That is correct as a `themeOverrideClassification` group name, but the `defineThemeOverrides` category key is `motion` (`packages/tokens/src/index.ts:911-916`; `docs/theming.md:352` uses `colors`/`radius`/`motion`). Line 113 says "`motion` values to `ms`" in prose, but the table is what gets copied. Naming both — "`motionDuration` (category `motion`)" — removes the trip hazard.

### N12 — Branding's `useBeeToken` example is DOM-only

`guides/branding.md:78-86` renders `<svg><rect fill={fill} rx={radius} … /></svg>`. Those are DOM elements; in a React Native app this does not render, and every other example in the file is RN-safe. `check-doc-examples` validates imported symbols, not compilation, so nothing catches it. `react-native-svg` is not a BeeUI peer, so the honest version is probably a comment marking it as web-only pseudocode.

### N13 — PR-body entry count

The body says troubleshooting has "25 entries on one schema". The page has 26 `###` entries.

---

## Assertions I checked and confirmed against source

Recording these so the next reviewer does not redo them.

| Assertion | Source | Verdict |
| --- | --- | --- |
| Exactly three density modes `compact`/`comfortable`/`spacious`, default `comfortable` | `tokens.json` `$extensions.com.beeui.densityIntents`; `packages/tokens/src/index.ts:417-431` | ✅ |
| Only `rowHeight`/`rowGap`/`formGap` participate; the 3×3 pixel table (44/56/64, 8/12/16, 4/8/12) | `packages/tokens/src/index.ts:434-450` | ✅ exact |
| CSS variable names `--spacing-density-row-height` / `-row-gap` / `-form-gap` | `packages/tokens/src/index.ts:460-464` | ✅ |
| 44px floor enforced at codegen, opt-in, `rowGap`/`formGap` unguarded | `scripts/generate-tokens.mjs:1490-1503`; `tokens.json` `rowHeight.$extensions.com.beeui.nativeHitTargetSensitive: true`, absent on the other two; `controlSize.touchTarget = 44px` | ✅ exact |
| `ListItem` carries a defensive `ios:/android:min-h-touch-target` floor | `packages/ui/src/components/list-item.tsx:94` | ✅ |
| `applyDensity(uniwind, runtimeTheme, mode)` targets one theme; unknown mode throws | `packages/tokens/src/index.ts:486-508` | ✅ |
| `pageGutter`'s `compact`/`regular`/`spacious` are an unrelated build-time axis | `tokens.json` `tokens.pageGutter`; `responsiveLayoutClassification` | ✅ |
| Six real runtime themes, four brand + two accessibility, two registries | `runtimeThemeNames` (4) + `accessibilityRuntimeThemeNames` (2); `beeThemeRegistry` / `beeAccessibilityThemeRegistry` | ✅ |
| 34 semantic color roles, 10 chart roles | counted from `semanticColorTokens` / `chartColorTokens` | ✅ both exact |
| Runtime-overridable set is `colors` + `radius` + `motion` and nothing else | `themeOverrideCategories` (`index.ts:900-918`); `themeOverrideClassification` flags only `radius`/`motionDuration` | ✅ (naming nit at N11) |
| `border-strong` vs `input` certified 3:1 for high-contrast only | `contrastContract.accessibilityOnlyPairs`, verbatim including the tracked-gap note | ✅ exact |
| `BeeThemeScope` throws on unknown brand/appearance/theme | `packages/ui/src/components/theme-scope.tsx:60-64,151` | ✅ |
| CLI commands are exactly `help version init list add doctor verify diff update`, no others | `packages/cli/src/beeui.mjs` `HELP:46-98` and the dispatch at `:246-368` | ✅ no real command omitted, none invented |
| Flags `--all`/`--dry-run`/`--overwrite` (add), `--dry-run`/`--force` (update); `diff` takes no flags | `parseAddArgs:126-153`, `parseDiffArgs:155-162`, `parseUpdateArgs:164-179` | ✅ |
| Exit codes 0 and 1 only, reason on stderr | `main()` returns 0 on every success path; single `catch` writes to stderr and returns 1 | ✅ |
| All eight `diff` statuses and what `update` does with each | `update-lib.mjs:294-301` (`STATUS` map) and `buildUpdatePlan:337-360` | ✅ all eight rows exact, including `LOCAL` never touched even with `--force` |
| Config is exactly four fields with those defaults | `registry-lib.mjs:77-80`, allow-list at `:377`, `.css` guard at `:382` | ✅ |
| `theme` is a real `add` target | `registry/registry.json` — `{"name":"theme","public":true,…}` | ✅ |
| 15 quoted troubleshooting error strings appear verbatim in the file cited | `overlay-runtime.tsx`, `toast.tsx` (×2), `pack-beeui-packages.mjs:58`, `bare-rn-consumer/bundle.sh:11`, `expo-package-consumer/bundle.sh`, `verify-web-consumer.sh:451,459`, `verify-bare-consumer.sh:138`, `web-consumer/setup.sh:48`, `source-ownership-starter/setup.sh`, `registry-lib.mjs` (×4), `beeui.mjs` | ✅ all 15 |
| RN `>=0.86.0 <0.87.0` tested at `0.86.2`; 0.85 no evidence; 0.87 tested and excluded via `react-native-safe-area-context@5.7.0` `Unresolved reference 'uiImplementation'` | `packages/ui/package.json` peers; `docs/compatibility-matrix.md:43-45,51` | ✅ exact, including the CI run reference |
| Expo SDK `~57.0.0` / `@expo/metro-runtime ~57.0.12`; Expo is not a peer | `docs/compatibility-matrix.md:46` | ✅ |
| Optional native peer ranges (bottom-sheet, reanimated, gesture-handler, worklets, datetimepicker) | `packages/ui/package.json` `peerDependencies` + `peerDependenciesMeta` | ✅ all five exact |
| Web toolchain pins: `react-native-web@0.21.0`, `vite-plugin-rnw@0.0.12`, `@tailwindcss/vite@4.3.3` | `examples/web-consumer/setup.sh:16,31,32` | ✅ |
| Five-line CSS entry | matches `start/web.md:90-95` | ✅ |
| `CalendarDate` = `{year,month,day}` 1-based; `ClockTime` = `{hour,minute}`; both timezone-free | `packages/core/src/utils/calendar-date.ts:17-27` | ✅ |
| `parseISODateString` never calls `new Date`/`Date.parse`; returns `null` on malformed | `calendar-date.ts:205-215` | ✅ |
| `toLocalDate`/`fromLocalDate`/`clockTimeFromLocalDate` are the only `Date` boundary, local getters only | `calendar-date.ts:223-245` | ✅ |
| `locale` explicit-only, defaults `'en-US'`, no ambient detection | `calendar-locale.ts:14,57-60` | ✅ |
| `weekStartsOn` precedence: prop → `Intl.Locale` weekInfo (feature-detected, both shapes) → static Monday | `calendar-locale.ts:35-77` | ✅ exact, including the `getWeekInfo`/`weekInfo` dual detection |
| Table perf numbers | match `components/table.md:29-30` (see N8 for the contradiction with the baseline report) | ⚠️ |
| Lockstep version across core/tokens/ui; CLI same channel scheme | all five manifests at `20260902.0.0`; `docs/dist-tag-policy.md:32-33,68,75` | ✅ |
| `latest`/`next` semantics, first `latest` is `20260902.0.0`, owner-gated at #254 | `docs/dist-tag-policy.md:32-53` | ✅ |
| Route moves: sidebar slugs, `guides.mjs`, `discovery.mjs`, `llms-full.txt`, `public-*-reference.mjs`, `build-public-discovery.mjs` all repointed | diff + repo-wide sweep | ✅ (one survivor — N4) |
| No surviving `/docs/cli/`, `/docs/troubleshooting/`, `/docs/migration/`, `/docs/theming/branding/`, `/docs/theming/density/` outside the redirect manifest | repo-wide grep excluding `dist`/`plans`/`node_modules` | ✅ except N4 |
| Moved-route destinations are validated to exist | `generate-docs-foundation.mjs:340-342`. **Mutation-verified:** typo'd `/docs/guides/migration-versionning/` → `moved docs route /docs/migration/ redirects to /docs/guides/migration-versionning/, which has no page.` | ✅ |
| Public-surface inventory unchanged at 683 / 20 published | `check-public-surface-ownership.mjs` output | ✅ |
| Sidebar has no dead slugs | Starlight throws on an unknown sidebar slug; `docs:build` completed 142 pages | ✅ |

---

## Claims I could not verify

1. **Redirect behavior for the five new moved routes.** No deployed Worker carries them. The live dev origin still serves the pre-move state (`/docs/cli/`, `/docs/troubleshooting/`, `/docs/migration/`, `/docs/theming/branding/`, `/docs/theming/density/` all return **200** today), so the 308s are proven only by the manifest contract and unit tests. The PR states this limitation itself; I am recording it because the previous lane (#457/PR #483) was held to a live-Wrangler standard for the same class of change, and this lane was not.
2. **`build-and-local-smoke` on `2101ae8`** was still `pending` when I finished. It failed on `9ec743a` from the same root cause as B1, so it should clear, but I did not observe it green.
3. **The `2101ae8` fix under true CI conditions, independently.** My shadow root could not reach `buildPublicPatternManifest` (missing Pattern Gallery runtime registry). I am relying on the green `verify-docs` job for that half rather than my own probe.
4. **`Vite 8.2.2`** in `troubleshooting.md:293` — I confirmed the other three version pins on that line against `examples/web-consumer/setup.sh` but did not locate the Vite pin.

---

## Verification table (what I actually ran, Node 24.13.1, pnpm 10.15.0)

Run on `9ec743a` with a warm tree (generated docs content present), except where noted.

| Check | Result |
| --- | --- |
| `node ./scripts/check-repo-hygiene.mjs` | exit 0 |
| `node ./scripts/check-public-doc-truth.mjs` | exit 0 |
| `node ./scripts/check-public-site-contract.mjs` | exit 0 |
| `node ./scripts/generate-docs-foundation.mjs --check` | exit 0 |
| `node ./scripts/check-public-surface-ownership.mjs` | exit 0 — 683 rows, 20 published |
| `node ./scripts/check-public-web.mjs` | exit 0 **warm** / **exit 1 with 19 violations cold** (B1) |
| `node ./scripts/check-doc-examples.mjs` | exit 0 |
| `node ./scripts/generate-llms-txt.mjs --check` | exit 0 |
| `node ./scripts/generate-component-reference.mjs --check` | exit 0 |
| `pnpm typecheck` | exit 0 (full 21-step chain incl. `release-ruleset:check`, which now passes — the pre-existing `bare-bundle` failure recorded in my memory is resolved) |
| `pnpm test` | exit 0 — 103 pass, 0 fail |
| `pnpm docs:build` | exit 0 — 142 pages |
| **CI `verify-docs` @ `9ec743a`** | **FAIL** (job 101023506864) |
| **CI `build-and-local-smoke` @ `9ec743a`** | **FAIL** (job 101023441188) |
| CI `verify-docs` @ `2101ae8` | pass (job 101027015157) |
| Live dev origin: dotted generated routes | 404 on `.generated`, 200 on `generated` — PR's diagnosis confirmed |
| Mutation: typo'd moved-route destination | correctly rejected by `docs:foundation:check` |
| Mutation: `probe.dotted.md` + `/docs/probe.dotted/` link | **accepted** — N1 |
| Mutation: `/docs/cli/does-not-exist/` | **accepted** — N2 |
| Mutation: `/docs/theming/branding/no/such/page/` | **accepted** — N2 |
| Mutation: `[x](/docs/totally-invented/ "Title")` | **accepted** — N2 |
| Mutation: `[q](/docs/start/?tab=expo)` | **false positive** — N2 |
| `node ./scripts/beeui.mjs doctor` / `diff` from repo root | exit 1 both — B2 |
| Old vs new `extractBeeuiImports` on the five changed fixtures | old genuinely mangled; new correct — regex fix confirmed |
| `pnpm docs:build` page count vs PR claim | 142 = 142 ✅ |
| Worktree at start / end | clean / clean |

---

## Recommended actions

1. Land the B1 remediation (`2101ae8`) — done — and add the CI status to the PR body's verification table. State explicitly that the local table was produced on a warm tree.
2. Fix B2: repoint the "Registry, exports, and source drift apart" Verify at repository-level checks.
3. Fix B3: add `Table` to both density-consumer lists, and rewrite the "compact table" limitation to say per-subtree density. Update `docs/density.md` in the same pass.
4. Fix B4: replace "about a 190px difference" with the correct 272px compact→spacious figure.
5. Fix B5: scope the null-clear sentence to `DatePicker`/`DateTimePicker`.
6. Fix N4: repoint `migrationHref`.
7. Correct the PR body's "strict improvement" (N5) and "25 entries" (N13) claims.
8. Consider, in this PR or a follow-up: slugify in `contentPathToRoute` (N1), resolve-then-recheck for redirect targets and `?`-tolerant `LINK_RE` (N2), de-duplicate the generated output paths (N3), and dash-not-dot generated filenames (N7).
9. Defer: N6, N8–N12 are small and can ride a later docs pass.
