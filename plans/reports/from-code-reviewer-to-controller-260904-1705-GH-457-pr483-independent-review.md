# Independent review — PR #483 (WBS-D030 / #457)

Reviewer: code-reviewer (independent, did not write this code)
Branch: `feat/docs-457-first-success-onboarding` @ `60329e1`
Base: `origin/development` @ `8226cd505d1a3787a0ac8d2f233fa0e39a357205`
Worktree state at review start and end: **clean** (no modifications made; adversarial config probes were run against a symlink shadow root in the scratchpad, never against the repo).

---

## Verdict

**HOLD / REQUEST CHANGES.**

The content work is genuinely strong and unusually well-sourced — I spot-checked far more than six factual assertions and every version, command, expected-output string and provider claim I chased resolved to a real cited source, verbatim. Claim 2 (redirects declared but never served) is true and the fix direction is right.

But three things block:

1. The move **breaks a route that works today** — the no-trailing-slash form of every moved URL now 404s, which contradicts the PR's own stated goal.
2. **Claim 4 is false as implemented.** The duplicate-destination guard *was* weakened, and I demonstrated it empirically. The test that would catch this asserts the stricter rule against the wrong function, so it passes while the shipped guard does not enforce it.
3. The exact failure class this PR exists to fix — *an artifact is declared, validated, and never written* — is still unguarded. Nothing asserts `composeWorkerAssets()` emits `_redirects`.

---

## Blocking findings

### B1. Every moved route now 404s without a trailing slash — a regression this PR introduces

`scripts/generate-docs-foundation.mjs:105-108`

```js
export function renderRedirectsFile(rules) {
  const lines = rules.map((rule) => `${rule.fromPrefix}* ${rule.toPrefix}:splat ${rule.status}`);
  return `${lines.join('\n')}\n`;
}
```

Emitted rule: `/docs/getting-started/* /docs/start/:splat 308`.

`/docs/getting-started` (no trailing slash) does **not** match `/docs/getting-started/*` — the literal prefix including the trailing slash must match before the splat applies.

Before this PR, that URL worked. `web/worker/wrangler.jsonc` leaves `assets.html_handling` at its default `auto-trailing-slash`, and Cloudflare's documented table for that mode is explicit:

> `/folder` → **307 to `/folder/`**

So today `/docs/getting-started` → 307 → `/docs/getting-started/` → 200, because `apps/docs/dist/docs/getting-started/index.html` exists. After this PR that asset is gone (`pnpm docs:build` confirms: no `getting-started` output), no `_redirects` rule matches, the request falls through to `web/worker/src/index.mjs`'s `env.ASSETS.fetch(request)`, and `not_found_handling` is unset — a bare 404, not even the docs 404 page.

This applies to all five moved URLs (`/docs/getting-started`, `/docs/getting-started/expo`, …), which is exactly the shape an external inbound link or a pasted URL takes. The PR body claims "no legacy URL 404s"; for this shape, they now do, and only because of this PR.

**Fix.** Emit a static companion rule for the bare prefix alongside each dynamic rule, and order static before dynamic as Cloudflare requires ("Static redirects should appear before dynamic redirects"):

```
/docs/getting-started /docs/start/ 308      # static, emitted first
/docs/getting-started/* /docs/start/:splat 308
```

Add a case to `scripts/__tests__/docs-foundation.test.mjs` asserting both lines are present for every rule, and assert the static block precedes the dynamic block.

---

### B2. The duplicate-destination guard was weakened, not refined — claim 4 is false

`scripts/generate-docs-foundation.mjs:254-262`

```js
const aliasedDestinations = new Set(
  manifest.redirects.filter((redirect) => redirect.aliasOf).map((redirect) => redirect.toPrefix),
);
for (const redirect of manifest.redirects) {
  ...
  if (redirectDestinations.has(redirect.toPrefix) && !aliasedDestinations.has(redirect.toPrefix)) {
    violations.push(`ambiguous duplicate redirect destination ${redirect.toPrefix}.`);
  }
```

The exemption is keyed on the **destination**, not on the **alias pair**. Once any rule marks a destination as aliased, ambiguity detection for that destination is switched off entirely, for all rules, forever.

The PR body asserts the opposite: *"rather than weakening the guard, rules record which prefix they alias and the guard allows a shared destination only when an alias relationship explains it."* That is not what the code does.

I proved it by running `validateDocsFoundation()` against a shadow root (symlinked repo, real copy of `web/public-site.config.json`, no repo mutation):

| Injected `movedRoutes` entries | Result |
| --- | --- |
| baseline (unchanged) | no violations (expected) |
| `+ /docs/quickstart/ -> /docs/start/` (vacant prefix, unrelated to the alias) | **NO VIOLATIONS — guard did not fire** |
| `+ /docs/quickstart/` and `+ /docs/intro/`, both `-> /docs/start/` | **NO VIOLATIONS — guard did not fire** |
| control: `+ /docs/quickstart/` and `+ /docs/intro/`, both `-> /docs/learn/` (non-aliased destination) | `ambiguous duplicate redirect destination /docs/learn/.` |

Two arbitrary unrelated prefixes claiming `/docs/start/` pass silently. The control confirms the guard still works on any destination that is *not* aliased — so the weakening is precisely scoped to the destinations the aliasing was introduced for.

**Compounding this: the test creates false confidence.** `scripts/__tests__/docs-foundation.test.mjs:163-186` (`'only alias rules may share a redirect destination'`) *does* implement the correct pair-level rule — it requires each aliasing rule's `aliasOf` to name an actual redirect source, and requires the converging set to contain both an alias and a non-alias. But it asserts that against `buildRedirectRules(readPublicSiteConfig(ROOT_DIR))` — the current 12-rule production config — not against `validateDocsFoundation()`. It re-implements the guard rather than exercising it, and it only ever sees the one config that already satisfies it. This is a phantom test: it executes code and proves nothing about the shipped guard's behavior under the input it is supposed to reject.

**Fix.** Move the pair-level logic into `validateDocsFoundation` — allow a duplicate only when exactly one rule in the converging set carries `aliasOf`, and that `aliasOf` value is itself a redirect source in the manifest. Then rewrite the test to drive `validateDocsFoundation` against synthetic configs (both the accepted alias case and the rejected unrelated-convergence case), rather than asserting properties of the current config.

---

### B3. The bug being fixed is still unguarded — nothing asserts `_redirects` is written

`scripts/build-public-worker.mjs:76-84`, `:110`

The premise of this PR is a failure mode: *the redirect manifest was declared in config, published into `route-manifest.json`, and validated for duplicates/loops/cycles by two separate checks — and none of that noticed nothing ever wrote it to disk.* That mode survived multiple merged PRs (#440, #442, #448) precisely because every green check was upstream of the write.

The fix adds `writeRedirects(rootDir, outDir)`. The new tests cover `buildRedirectRules` and `renderRedirectsFile` in isolation. **No test calls `composeWorkerAssets()` and asserts `_redirects` exists in `outDir`.** Delete line 110 tomorrow and every check in the PR's own verification table still passes — including `docs:foundation:check`, `site:contract:check`, `check-public-web`, and all 11 unit tests. The repeat of the exact bug just fixed is invisible to CI.

For reference, `renderWorkerHeaders` has the same gap (tested as a pure function; `writeHeaders`/`composeWorkerAssets` untested), so this is a pre-existing pattern — but this PR is the one that identified the pattern as a production defect and is the right place to close it.

**Fix.** Add a test that runs `composeWorkerAssets` against a temp `outDir` with stub build outputs (or, cheaper, factor the write list into an asserted manifest) and asserts both `_headers` and `_redirects` are present and non-empty. Consider also adding `_redirects` to `web/public-site.config.json#buildOutputs` so `check-public-site-contract` has something to enforce.

---

## Non-blocking findings

### N1. `renderRedirectsFile` sorts alphabetically, but Cloudflare applies top-most match

`scripts/generate-docs-foundation.mjs:100`, `:105-108`

Rules are ordered by `fromPrefix.localeCompare`. Cloudflare: *"The order of your redirects matter. If there are multiple redirects for the same source path, the top-most redirect is applied."* ASCII sort puts shorter prefixes first, so a future broader rule (`/docs/` → …) would sort *above* and permanently shadow `/docs/getting-started/`. No current pair nests, so there is no live bug — but the invariant encoded in the sort is the wrong one, and nothing in `validateDocsFoundation` rejects a redirect source that is a prefix of another redirect source. Sort by descending `fromPrefix.length` (specificity) and add a nesting violation.

### N2. Nothing validates that a redirect prefix shadows a real asset

Cloudflare, same page: *"Redirects are always followed, regardless of whether or not an asset matches the incoming request."* Now that `_redirects` is actually served, the eleven legacy prefixes (`/components/`, `/patterns/`, `/cli/`, `/theming/`, …) permanently 308 away anything published at those root paths.

I checked the composed asset tree and there is **no collision today** — `web/dist` only produces `/index.html`, `/assets/*`, `/changelog/`, `/examples/**`, `/robots.txt`, `/sitemap.xml`, `/llms*.txt`, plus `/docs/**`, `/showcase/**`, `/demo/**`. So this is latent, not live. But it is a new trapdoor introduced by this PR: adding a `/patterns/` landing page later would silently 404-by-redirect with every check green. `validateDocsFoundation` already checks moved routes against `docsRoutes`; it should also check redirect sources against `config.routes` prefixes and the landing/discovery output paths.

### N3. `writeRedirects` reimplements an existing utility and hardcodes the config path

`scripts/build-public-worker.mjs:80-83`

```js
const config = JSON.parse(fs.readFileSync(path.join(rootDir, 'web/public-site.config.json'), 'utf8'));
```

`readPublicSiteConfig(rootDir)` (`scripts/public-site-contract-lib.mjs:22-24`) does exactly this, and `build-public-worker.mjs` already imports from that module on line 10. This is a second config-read path with a duplicated literal path constant that will silently diverge if `CONFIG_PATH` moves or the reader ever gains validation. Use the existing helper.

### N4. `_headers` and `_redirects` bypass the asset-collision map

`scripts/build-public-worker.mjs:73`, `:82` write after all `copyOutput` calls and never register in `claimed`. If any upstream build ever emitted a root `_redirects`, it would be silently overwritten instead of raising the `asset collision:` error the function exists to raise. Also `renderRedirectsFile([])` returns `"\n"`, so an empty rule set still writes a whitespace-only file.

### N5. 263 lines of the 267-line `web/public-site.config.json` diff are pure whitespace

Semantic delta, computed by flattening both versions and diffing leaves:

```
/docsFoundation/movedRoutes[0]/fromPrefix : None -> '/docs/getting-started/'
/docsFoundation/movedRoutes[0]/toPrefix   : None -> '/docs/start/'
/docsFoundation/movedRoutes[0]/status     : None -> 308
/docsFoundation/movedRoutes[0]/ownerIssue : None -> 457
```

Everything else is the file being re-emitted from `JSON.stringify(…, 2)`, converting the repo's existing one-line-per-record style to fully expanded. The file is hand-maintained (not generated — no script writes it), there is no Prettier config, and nothing required the reformat. It makes the highest-consequence file in this PR the hardest one to review. Restore the original formatting and land only the four-field addition.

### N6. `expo.md` overstates the drift guard

`apps/docs/src/content/docs/start/expo.md`, step 3: *"These files are drift-guarded against this page."*

`scripts/public-web-checks/start.mjs` guards five substrings across both fixture and doc: the three `@import` lines, `withUniwindConfig`, and `cssEntryFile: './global.css'`. It does **not** guard the two `@source` lines — which the same page calls load-bearing (*"without them … every component renders unstyled"*) — nor `dtsFile`, nor `extraThemes`, nor anything in `index.js`. The guard is also presence-in-both, not equality, so a fixture could change an `@source` path and the doc would silently become wrong. Either narrow the sentence to what is actually guarded, or extend the guard to cover the `@source` lines.

### N7. `start/index.md` misdescribes what `examples/source-ownership-starter` runs

The page presents this block and says the starter *"runs exactly this flow"*:

```bash
pnpm beeui -- list
pnpm beeui -- add --dry-run button
pnpm beeui -- add button
pnpm beeui -- doctor
```

`examples/source-ownership-starter/setup.sh:51-58` runs `beeui init`, `beeui add button popover`, `beeui doctor` — via the **packed** `packages/cli/dist/beeui.mjs`, not `pnpm beeui`. It never runs `list` or `add --dry-run`, and the doc omits `init`. All four commands exist in the CLI, so nothing is fabricated, but "runs exactly this flow" is not true of the cited source and the PR claims content is sourced only from executable examples.

### N8. `bare-react-native.md` Verify table mixes working directories

Rows 2–5 (`bash setup.sh`, `bash bundle.sh`, `cd app && …`) are relative to `examples/bare-rn-consumer`, which is where step 1 leaves the reader. Rows 6–7 give `bash scripts/verify-bare-consumer.sh android-build` / `ios-build`, which are repo-root-relative and fail as written from the starter directory. The subcommands themselves are real (`scripts/verify-bare-consumer.sh:307-320`). Add the `cd` or make the paths absolute-from-root explicit.

### N9. IA rename is not carried into link text

The route and sidebar are now "Start", but `apps/docs/src/content/docs/index.md:14` and `theming/index.md:27` still render the link text "Getting Started", and `scripts/generate-llms-txt.mjs:360` still emits a `Getting started:` heading. Cosmetic, but this PR's premise is that two names for one thing is the failure pattern that put B010 on HOLD twice.

### N10. Plan/scout artifacts are #474-wide in a D030-scoped PR

`plans/260904-1619-GH-474-wbs-execution/plan.md` (112 lines) and `plans/reports/scout-…-d-wave-source-evidence-report.md` (328 lines) cover the whole D/E wave including D033/#463 and E040/#459. 440 of the PR's 1753 added lines are outside the stated scope. Not harmful, but it should be called out rather than folded in silently.

---

## Claims I could not verify

- **Live Cloudflare behavior.** No request was made against a deployed Worker. B1 and N2 are derived from the current Cloudflare Workers static-assets documentation (`/workers/static-assets/redirects/`, last updated 2026-08-25; `/routing/advanced/html-handling/`, 2026-04-23) applied to `web/worker/wrangler.jsonc`, not from an observed 404. The PR body flags this same limitation honestly.
- **Recorded acceptance numbers.** `663 modules` / `~3.5 MB` (Expo), `568 modules` / `0.41 kB` / `574 kB` (Web), `~2.3 MB` (bare RN) all match the committed starter READMEs verbatim (`examples/expo-package-consumer/README.md:53,63,66,68`; `examples/web-consumer/README.md:38-42`; `examples/bare-rn-consumer/README.md:76`). I did not re-run the starters, so I verified the citation, not the number.
- **`pnpm build`, `pnpm test`, native lanes.** Not run; out of scope for this review and owned by CI.
- **`react@19.2.3` in the bare path.** `examples/bare-rn-consumer/setup.sh` pins `react-dom@19.2.3` explicitly; `react` comes from the RN 0.86.2 CLI template. The doc's prerequisites row is consistent with `docs/compatibility-matrix.md:177`, but the starter does not pin it directly.
- **GitHub `blob/main/` source-authority links.** All 15 targets exist in this worktree; I did not confirm they exist on `main`, which is behind `development`.

---

## Content fact-check (D) — assertions I chased to source

All verified true unless noted.

| Assertion | Cited source | Result |
| --- | --- | --- |
| Node `24.13.1`, pnpm `10.15.0`, React `19.2.3`, RN `0.86.2`, Expo `~57.0.0`, RNW `0.21.0`, Tailwind `4.3.3`, Uniwind `1.10.1` | `docs/compatibility-matrix.md:40-50,174-183`; `.nvmrc`; `package.json:10,12` | ✅ exact |
| `engine-strict=true` | `.npmrc:3` | ✅ |
| Expo prereq table (12 rows incl. `@expo/metro-runtime@~57.0.12`, `react-native-teleport@~1.1.13`) | `examples/expo-package-consumer/setup.sh` `RUNTIME_DEPS` | ✅ one-for-one |
| `==> Setup complete. Run: bash bundle.sh` | same, final line | ✅ verbatim |
| `OK: Expo export produced Android, iOS, and Web bundle output under dist/.` | `examples/expo-package-consumer/bundle.sh` | ✅ verbatim |
| `Expected Android bundle output missing under dist/_expo/static/js/android` | same | ✅ verbatim |
| `global.css`, `metro.config.js`, `index.js` quoted "verbatim" | the three fixture files | ✅ byte-identical |
| Web prereq table incl. `vite@8.2.2`, `vite-plugin-rnw@0.0.12`, `class-variance-authority@0.7.1` | `examples/web-consumer/setup.sh` `RUNTIME_DEPS`/`DEV_DEPS` | ✅ exact |
| `==> Setup complete. Run: npm run build`; Expo-absence guard message | same | ✅ verbatim |
| `vite.config.ts` "three plugins, in this order"; `src/global.css`; `src/main.tsx` | fixture files | ✅ byte-identical |
| `npm run preview` exists; `<div id="root">` | `examples/web-consumer/package.json`, `index.html:9-10` | ✅ |
| axe tags `wcag2a/wcag2aa/wcag21a/wcag21aa`, serious/critical gate, `vite preview` | `scripts/verify-web-consumer.sh:297,341-368,462` | ✅ verbatim |
| Bare prereqs incl. `@react-native-community/cli@20.2.0` | `examples/bare-rn-consumer/setup.sh` `CLI_VERSION`/`PINNED_DEPS` | ✅ |
| `This bare RN consumer unexpectedly resolves the Expo runtime.`; `app/ is missing; run setup.sh first.`; `OK: both Android and iOS Metro bundles produced non-empty output.` | `setup.sh`, `bundle.sh` | ✅ verbatim |
| `src-overrides/` holds exactly four files; `metro.config.js`/`global.css`/`index.js` verbatim; `BackHandler` wiring | `examples/bare-rn-consumer/src-overrides/*` | ✅ (`index.js` snippet drops a `/** @format */` header — immaterial) |
| `android-build` / `ios-build` actions; `app-debug.apk`; `pod install` + `xcodebuild` | `scripts/verify-bare-consumer.sh:267-268,286,294,314-317` | ✅ |
| `packages/ui/dist is missing. Run "pnpm build" …` | `examples/scripts/pack-beeui-packages.mjs:58` | ✅ |
| **Provider asymmetry (claim 6)** — overlay yields to parent, toast always creates | `overlay-runtime.tsx:661-665` (`const parent = React.useContext(...); if (parent) return <>{children}</>;`) vs `toast.tsx:243` (`ToastRuntimeProvider` unconditionally builds state) | ✅ **true** |
| Provider composition order in the ASCII diagram | `safe-area.tsx:51-57` — SafeAreaProvider → Toast → Overlay → Uniwind bridge | ✅ exact |
| Root overlay scope depth `0`; nested = parent+1; dismissal = deepest, ties by most recent | `overlay-runtime.tsx:608,723,142-149` | ✅ |
| `BeeUI anchored overlays require BeeUIProvider at the application root.` | `overlay-runtime.tsx:53,113,680` | ✅ verbatim |
| `BeeUI toast APIs require BeeUIProvider at the application root.` | `toast.tsx:292` | ✅ verbatim |
| `TypeError: BeeUI toast show() requires a non-empty string title.` | `toast.tsx:99` | ✅ verbatim |
| `SafeArea` defaults to all edges | `safe-area.tsx:68-69` | ✅ |
| `syncUniwindInsets` default `true` | `safe-area.tsx:47` | ✅ |
| `pnpm --filter @beemvp/beeui-showcase build:web` / `@beemvp/beeui-demo build:web` | both package.json `scripts` | ✅ |
| `pnpm beeui -- list` / `add --dry-run` / `doctor` exist | `packages/cli/src/beeui.mjs:55,66,264` | ✅ (but see **N7**) |
| Starter "runs exactly this flow" | `examples/source-ownership-starter/setup.sh:51-61` | ❌ **N7** |
| "These files are drift-guarded against this page" | `scripts/public-web-checks/start.mjs:30-38` | ⚠️ **N6** — partial |

**Link integrity.** All 16 `/docs/…` links in the five new pages resolve to a built page; `/showcase/` and `/demo/` are the only non-docs internal links; all 15 GitHub `blob|tree/main/` targets exist in-tree.

**C — dangling references.** Repo-wide grep for `getting-started` outside `plans/` returns only intentional survivors: the two `web/public-site.config.json` redirect entries, the generator comment, and the three test assertions. No content, sidebar, `llms*.txt`, `web/site`, `scripts`, `examples` or README reference is stale. `apps/docs/dist` contains no `getting-started` path.

**E — publication truth.** All five pages lead with an explicit unpublished caution, every install command routes through `pnpm pack` tarballs or the repo-local CLI, no `@beemvp/beeui-*` registry install appears anywhere, and no stable target version is stated. `check-public-doc-truth.mjs` only pattern-matches registry install commands, so I also read the pages by eye — they do not mislead. This claim holds.

---

## Verification table — observed, not claimed

Node 24.13.1, `LANG=LC_ALL=en_US.UTF-8`, run at PR head.

| Check | PR body claims | I observed | Match |
| --- | --- | --- | --- |
| `check-repo-hygiene` | PASS | PASS (exit 0) | ✅ |
| `check-public-doc-truth` | PASS | PASS (exit 0) | ✅ |
| `check-public-site-contract` | PASS | PASS (exit 0) | ✅ |
| `generate-docs-foundation --check` | PASS | PASS (exit 0) | ✅ |
| `check-public-surface-ownership` | PASS, 683 rows / 20 published | PASS — "683 derived rows; 20 owned by a published docs page, 663 by a ratified-but-unwritten page" | ✅ |
| `check-public-web` | PASS | PASS (exit 0) | ✅ |
| `check-doc-examples` | PASS | PASS (exit 0) | ✅ |
| `generate-llms-txt --check` | PASS | PASS (exit 0) | ✅ |
| `node --test scripts/__tests__/docs-foundation.test.mjs` | PASS 11/11 | PASS 11/11, 0 fail | ✅ (see **B2** — one of them proves less than it appears to) |
| `pnpm docs:build` | PASS, 140 pages, `/start/*` present, no `/getting-started/*` | PASS, "140 page(s) built", all five `/start/*` in output, zero `getting-started` paths in `dist` | ✅ |
| `check-release-ruleset` | pre-existing failure, unrelated | `Release ruleset check failed: Job "bare-bundle" not found under jobs:` — PR touches no `.github/` file, so pre-existing confirmed | ✅ |

No discrepancy between the PR's table and what I observed. The table is accurate; the problem is what it does not cover (**B1**, **B3**) and one test that reports green for a rule the shipped code does not enforce (**B2**).

---

## Recommended actions, in order

1. **B1** — emit static bare-prefix rules ahead of the dynamic splat rules; test both.
2. **B2** — move pair-level alias validation into `validateDocsFoundation`; rewrite the test to drive the guard with synthetic accept/reject configs. Correct the PR body, which currently states the opposite of what the code does.
3. **B3** — assert `composeWorkerAssets()` writes `_redirects` (and `_headers`).
4. **N5** — revert the `web/public-site.config.json` whitespace churn to a four-field diff before this lands; it is the file with the highest blast radius here.
5. **N1, N2** — specificity ordering plus a redirect-source/asset-collision violation.
6. **N3, N4** — use `readPublicSiteConfig`; register the two written files in `claimed`.
7. **N6, N7, N8** — three doc corrections; each is a sentence.
8. **N9, N10** — optional, but N9 is cheap and on-theme.

---

## Unresolved questions for the controller

1. Was the `web/public-site.config.json` reformat deliberate (a decision to switch that file to expanded JSON) or incidental tooling output? If deliberate it should be its own commit with a stated rationale; if incidental it should be reverted.
2. Should `assets.not_found_handling` be set to `404-page` in `web/worker/wrangler.jsonc`? It is unset today, so any miss — including the **B1** shape — returns a bare Cloudflare 404 rather than the docs 404 page. Pre-existing, out of D030 scope, but this PR is the first to make misses reachable in a new way.
3. `docsFoundation.sections[start].status` is still `"foundation"` now that the section carries real content. Is that field expected to change state, and who owns flipping it?
