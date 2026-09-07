# Independent re-review — PR #483 (WBS-D030 / #457) after remediation

Reviewer: code-reviewer (fresh, independent; did not write this code and did not perform the first review)
Head reviewed: `feat/docs-457-first-success-onboarding` @ `4d44f07`
Stated base: `origin/development` @ `8226cd5` (this is the **merge base**; `origin/development` has since advanced to `3792d23` — see NEW-5)
Worktree state at start and end: **clean** (`git status --porcelain` empty both times). All mutation probes ran against a shadow root and a throwaway Wrangler fixture under `/private/tmp/...scratchpad/`. The only working-tree change is this untracked report file.

---

## Verdict

**ACCEPT.**

All three blockers are genuinely fixed, and I did not take the claims on trust:

- **B1** was verified against a **live Cloudflare static-assets runtime** (`wrangler@4.128.0 dev`), not against documentation. I reproduced the 404 with the pre-remediation rule shape and watched it become a single 308 with the shipped one.
- **B2** was verified by driving `collectRedirectViolations` with 14 synthetic rule sets, including every defeat vector named in the brief. Every convergence case that should be rejected is rejected.
- **B3** was verified by two mutations, including one harder than the one the author ran.

N5–N9 are real fixes verified against their cited sources. N2 is partially fixed and N10 is knowingly not fixed; both were non-blocking and stay non-blocking. Five new non-blocking observations are recorded below. None of them misleads a reader or breaks a route.

---

## Per-finding remediation verdicts

| # | Verdict | Evidence I personally observed |
| --- | --- | --- |
| **B1** | **VERIFIED FIXED** | `renderRedirectsFile` (`scripts/generate-docs-foundation.mjs:112-117`) emits a static line per rule then a dynamic line per rule; all 12 statics precede all 12 dynamics. Static target is the full destination with trailing slash (`/docs/getting-started /docs/start/ 308`) — correct, lands 200 in one hop. **Empirical, live Wrangler:** see the runtime table below. |
| **B2** | **VERIFIED FIXED** | Guard is now genuinely pair-level (`:137-152`): group by destination, require exactly one non-alias rule, require every alias's `aliasOf` to equal that canonical rule's own `fromPrefix`. I ran 14 adversarial rule sets — the original exploit and every variant named in the brief are rejected. Table below. |
| **B3** | **VERIFIED FIXED** (narrower than claimed) | `buildComposedRootFiles` (`scripts/build-public-worker.mjs:76-86`) returns the write set as a value; `public-worker.test.mjs:60-75` asserts all three keys and non-emptiness. **Mutation 1** (delete the `_redirects` key): `pass 4 / fail 1` **and** `check-public-web` exit 1 — the author's claim is true. **Mutation 2** (delete the whole write loop `:111-115`, keep the manifest): every listed check and all four test files stay **green**. That residual is caught by the CI smoke lane, not by the checklist — see NEW-1. |
| **N1** | **VERIFIED FIXED** | `buildRedirectRules` sorts by descending `fromPrefix.length` (`:100-102`), tested at `docs-foundation.test.mjs:155-159`; the nesting violation exists (`:154-161`) and I confirmed it fires on `/docs/` vs `/docs/gs/`. |
| **N2** | **PARTIALLY FIXED** | The `routePrefixes` check (`:165-169`) catches only **exact equality** with a mount. My probes: `/examples/legacy/` (nested under the real `/examples/` mount) → **accepted**; `/llms/`, whose emitted static form `/llms` collides with the real `/llms` mount → **accepted**. And I confirmed on live Wrangler that a redirect *does* beat a real asset: with `dist/components/index.html` present, `/components` still returned `308 -> /docs/components/`. The trapdoor N2 described is narrowed, not closed. No live collision today (`web/site` publishes no such path). |
| **N3** | **VERIFIED FIXED** | `buildComposedRootFiles` calls `readPublicSiteConfig(rootDir)`; the second hardcoded `web/public-site.config.json` literal is gone from `build-public-worker.mjs`. |
| **N4** | **VERIFIED FIXED** (main point) | `:111-115` checks `claimed.has(name)` and sets `claimed.set(name, 'composed root')` before writing. The secondary nit stands: `renderRedirectsFile([])` still returns `"\n"`, so a zero-rule config would write a whitespace-only file — unreachable from the current config. |
| **N5** | **VERIFIED FIXED** | `git diff 8226cd5 HEAD -- web/public-site.config.json` = **3 insertions, 0 deletions**, containing only the `movedRoutes` array. Original hand-maintained formatting restored; no semantic value changed. |
| **N6** | **VERIFIED FIXED** | `expo.md:91` now enumerates exactly the five guarded substrings and states "Nothing guards the `@source` lines, `dtsFile` or `extraThemes`". Matches `scripts/public-web-checks/start.mjs:33-40` one-for-one. |
| **N7** | **VERIFIED FIXED** | `start/index.md:109` now says the starter runs "`init`, then `add button popover`, then `doctor` — through the packed CLI binary rather than `pnpm beeui`", and that it asserts non-resolution of `@beemvp/beeui-ui`. `examples/source-ownership-starter/setup.sh` runs `node "${CLI_BIN}" init`, `add button popover`, `doctor` where `CLI_BIN=packages/cli/dist/beeui.mjs`, then the `require.resolve('@beemvp/beeui-ui')` guard. Exact match. |
| **N8** | **VERIFIED FIXED** | `bare-react-native.md:152-162` adds a "Run from" column plus a prose lead-in. I checked every row: row 1 `pnpm build` (root ✓); rows 2/4 `setup.sh`/`bundle.sh` (both `cd "$SCRIPT_DIR"` internally, so `examples/bare-rn-consumer` ✓); row 3 `cd app && …` ✓; row 5 output paths match `bundle.sh:20-31` (`build/index.android.bundle`, `build/main.jsbundle`) relative to `app/` ✓; rows 6-7 `scripts/verify-bare-consumer.sh` is root-relative ✓. |
| **N9** | **VERIFIED FIXED** | Repo-wide case-insensitive sweep for `getting.started` outside `plans/`, `dist/`, `.git/`: only the two intentional config redirect entries, one generator comment, and test assertions. `docs/index.md:14` and `theming/index.md:27` now read "Start"; `generate-llms-txt.mjs:360` and `llms-full.txt` now emit `Start:`. One cosmetic survivor outside the docs site: `apps/showcase/README.md:144` ("Getting started → Web"). |
| **N10** | **NOT FIXED (by design)** | Confirmed still present: `plans/260904-1619-GH-474-wbs-execution/plan.md` (112 lines) and the 328-line scout report remain in a D030-scoped PR. The PR comment states this is deliberate. Controller's call, not a defect. |

### B2 — adversarial probe results (`collectRedirectViolations`, run against a shadow root)

| Probe | Result |
| --- | --- |
| two unrelated canonicals → one destination | **REJECTED** `ambiguous duplicate redirect destination /docs/start/` |
| the original B2 exploit (alias + `/docs/quickstart/` + `/docs/intro/` → `/docs/start/`) | **REJECTED** — the exact input that passed silently before |
| alias chain (C aliases an alias) | **REJECTED** `…aliases /gs/, not the canonical source /docs/gs/` |
| group with zero canonical rules (all aliases) | **REJECTED** |
| self-alias inside a converging group | **REJECTED** |
| two aliases of the same canonical | accepted — correct; behaviorally unambiguous |
| duplicate identical source | **REJECTED** `duplicate redirect source /dup/` (see NEW-2) |
| same object twice in the array | **REJECTED** via duplicate-source; shadow loop correctly stayed silent (identity guard works) |
| nested sources `/docs/` + `/docs/gs/` | **REJECTED** — shadow **and** route-collision |
| self-alias, **single-rule** group | accepted (see NEW-3) |
| `aliasOf` naming a prefix absent from the manifest, single-rule group | accepted (see NEW-3) |
| alias claiming a canonical that redirects elsewhere | accepted (see NEW-3) |
| redirect source nested under a real route mount | accepted (see N2) |
| bare static form colliding with a route mount | accepted (see N2) |

**No false positives on the real config:** `validateDocsFoundation(ROOT_DIR)` deep-equals `[]`, and the O(n²) shadow loop cannot report a rule against itself (`rule === other` identity guard, confirmed by the same-object probe).

### B1 — live Cloudflare runtime evidence

Ran `wrangler@4.128.0 dev` over a static-assets fixture, then over the **actual emitted file** (24 rules, Wrangler logged `✨ Parsed 24 valid redirect rules`).

| Request | Pre-remediation shape (dynamic rules only) | Shipped shape (`4d44f07`) |
| --- | --- | --- |
| `/docs/getting-started` | **404** | `308 -> /docs/start/` |
| `/docs/getting-started/` | `308 -> /docs/start/` | `308 -> /docs/start/` |
| `/docs/getting-started/expo` | — | `308 -> /docs/start/expo` |
| `/docs/getting-started/expo/` | — | `308 -> /docs/start/expo/` |
| `/docs/getting-started/a/b/c` | — | `308 -> /docs/start/a/b/c` (nested descendants carry) |
| `/docs/getting-started?a=1&b=2` | — | `308 -> /docs/start/?a=1&b=2` (**query preserved**) |
| `/docs/getting-started/expo?a=1` | — | `308 -> /docs/start/expo?a=1` |
| `/docs/getting-started/#frag` | — | `308 -> /docs/start/` |
| `/getting-started`, `/getting-started/`, `/getting-started/expo/` | — | `308 -> /docs/start/`, `/docs/start/`, `/docs/start/expo/` |
| `/cli`, `/theming/dark/` | — | `308 -> /docs/cli/`, `308 -> /docs/theming/dark/` |
| `/docs/Getting-Started` | 404 | **404** — `_redirects` matching is case-sensitive |

This settles three things the first review could only infer:

1. **B1's premise was correct.** With the dynamic rule alone, `/docs/getting-started` returned a bare 404. The 307 auto-trailing-slash hop fires only while the folder asset exists (`/docs/start` → `307 -> /docs/start/` in the same run; `/docs/no-such-thing` → 404).
2. **The splat matches the empty string**, so `/docs/getting-started/` was already covered pre-fix. The regression was confined to the bare form, exactly as B1 stated — no wider and no narrower.
3. **Query strings are preserved automatically**, so the `preserveQuery` intent holds at runtime even though nothing reads the field (NEW-4).

Case sensitivity (`/docs/Getting-Started` → 404) is **not** a regression: those paths 404ed before the move too, since asset lookup is equally case-sensitive.

The static rule for the legacy `/components` prefix does pre-empt a real asset at that path — but `/components/` was already shadowed by the dynamic rule before this change (`/components` → `307` → `/components/` → `308`), so the static rule only removes a hop. **No new shadow surface.**

---

## New findings introduced by, or left open after, the remediation

All non-blocking.

**NEW-1 (Medium). The write loop is still untested; only the manifest is.**
Deleting `scripts/build-public-worker.mjs:111-115` while leaving `buildComposedRootFiles` intact leaves **every command in the PR's verification table green** — all four test files, `check-public-web`, `check-public-site-contract`, `generate-docs-foundation --check`. I proved this by mutation. The PR comment's "Verified by mutation" refers to the weaker mutation (removing one key), which the test does catch.
Mitigating: the deleted loop also drops `build-identity.json`, and the CI lane `build-and-local-smoke` (`.github/workflows/beeui-web.yml:114-146`) composes the real artifact and `curl --fail`s `/api/health`, which would 503. So the residual is covered by CI, not by the checklist.
Not mitigated: **no check anywhere asserts that a redirect actually redirects.** The smoke lane curls eight URLs; none is a legacy path. One line closes it end to end and is the check that would have caught the original defect at the layer that mattered:
```bash
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/docs/getting-started)" = "308"
```

**NEW-2 (Low). The new shadow check emits a self-referential message for equal-prefix duplicates.**
Two distinct rule objects with the same `fromPrefix` pass the `rule === other` identity guard and each report `redirect source /dup/ shadows the more specific /dup/` — twice, alongside the correct `duplicate redirect source /dup/`. Nonsense text, no behavioral effect, no false positive on the real config (sources are unique). Guard with `other.fromPrefix !== rule.fromPrefix` instead of object identity.

**NEW-3 (Low). `aliasOf` is unvalidated outside a converging group.**
`collectRedirectViolations` only inspects `aliasOf` when `group.length > 1`. A rule that aliases itself, aliases a prefix absent from the manifest, or claims a canonical whose destination is different, all pass silently in a single-rule group — and the dangling `aliasOf` is then published into `route-manifest.json` as public data. Unreachable from config today because `aliasOf` is derived in `buildRedirectRules`, never author-supplied. But `collectRedirectViolations` is now an **exported, test-driven contract**, so the hole is real for any future caller. One line: reject `aliasOf` that is not in `sources`.

**NEW-4 (Informational, pre-existing). `preserveSuffix` / `preserveQuery` are declared, typed, published, asserted — and read by nothing.**
Hardcoded `true` at `generate-docs-foundation.mjs:82-83,96-97`; typed at `apps/docs/src/lib/foundation-contract.ts:94-95`; asserted at `docs-foundation.test.mjs:230`. `renderRedirectsFile` hardcodes splat and query behavior and never consults them. This is the same declared-but-unconsumed shape as the defect the PR exists to fix, one notch weaker (the behavior happens to match reality — I confirmed query preservation on live Wrangler). This PR extends the fields to the moved-route rules and adds the test assertion, so it is worth naming even though it predates the change.

**NEW-5 (Process). The branch is behind `development`, and the PR's "pre-existing base failure" note is now stale.**
`origin/development` has advanced to `3792d23` (`Merge pull request #480 from beobungbu/fix/release-ruleset-drift`, plus `ab1cc8b fix(ci): restore the required-check and native-compile gates`). PR #480 is precisely the fix for the `check-release-ruleset` failure this PR's verification table cites as an unfixable base breakage. On `4d44f07` the failure still reproduces (`Job "bare-bundle" not found under jobs:`) because the branch predates the fix. After rebasing, `pnpm typecheck` should run to completion for the first time — **re-run it post-rebase before merge**; it has never actually completed on this change.
Note also that `check-release-ruleset.mjs` exits **0** while printing `Release ruleset check failed` — the failure does not set an exit code on this head. That is #480's territory, not this PR's.

---

## Verification table — observed, not claimed

Node 24.13.1, `LANG=LC_ALL=en_US.UTF-8`, run at `4d44f07`.

| Check | PR comment claims | I observed | Match |
| --- | --- | --- | --- |
| `check-repo-hygiene` | PASS | exit 0 — "file modes + committed LF + final LF" | ✅ |
| `check-public-doc-truth` | PASS | exit 0 | ✅ |
| `check-public-site-contract` | PASS | exit 0 | ✅ |
| `generate-docs-foundation --check` | PASS | exit 0 | ✅ |
| `check-public-surface-ownership` | PASS | exit 0 — 683 derived rows; 20 published / 663 ratified-but-unwritten | ✅ |
| `check-public-web` | PASS | exit 0 | ✅ |
| `check-doc-examples` | PASS | exit 0 | ✅ |
| `generate-llms-txt --check` | PASS | exit 0 — "all links resolve" | ✅ |
| `docs-foundation.test.mjs` | 16/16 | **pass 16, fail 0** | ✅ |
| `public-worker.test.mjs` | 5/5 | **pass 5, fail 0** | ✅ |
| `public-web.test.mjs` | PASS | **pass 9, fail 0** | ✅ |
| `public-site-contract.test.mjs` | PASS | **pass 5, fail 0** | ✅ |
| `pnpm docs:build` | PASS, 140 pages | exit 0, "140 page(s) built"; all five `/start/*` present; zero `getting-started` paths in `dist` | ✅ |
| `check-release-ruleset` | pre-existing base failure | reproduces — but **fixed on `development` by #480**; see NEW-5 | ⚠️ stale |

Additional checks I ran that the PR comment does not cover:

| Check | Result |
| --- | --- |
| All 17 internal links in the three remediated pages resolve to a built page | ✅ every one |
| `git diff 8226cd5 HEAD -- web/public-site.config.json` | ✅ **+3 / -0** |
| Real emitted `_redirects` parsed by Wrangler | ✅ "Parsed 24 valid redirect rules" |
| 14 live HTTP probes against Wrangler static assets | ✅ table above |
| 14 adversarial rule sets against `collectRedirectViolations` | ✅ table above |
| Mutation: drop `_redirects` key from `buildComposedRootFiles` | ✅ fails (4/1) + `check-public-web` exit 1 |
| Mutation: delete the write loop in `composeWorkerAssets` | ⚠️ **all checks stay green** (NEW-1) |
| Working tree clean at start and end | ✅ |

---

## Regression sweep

Nothing the first review passed has broken. All eight scripts, all four test files (now 35 assertions vs 11+? at the previous head) and `docs:build` are green at `4d44f07`. Test count went **up** in every touched file and no assertion was weakened or deleted — I diffed `docs-foundation.test.mjs` and `public-worker.test.mjs` against the merge base and every prior test survives; the phantom test called out in B2 was **replaced** by five synthetic-input tests that drive the guard directly, including three that must fail.

`scripts/check-release-ruleset.mjs`, `docs/release-ruleset.md`, `release-ruleset-contract.test.mjs` and `ios-build-cache-contract.test.mjs` appear in `git diff origin/development` only because the branch is behind `3792d23`; against the true merge base `8226cd5` this PR does not touch them. Not scope creep.

---

## Recommended actions

1. **Rebase onto `origin/development` (`3792d23`) and re-run `pnpm typecheck` end to end.** It has never completed on this change; #480 removed the reason it could not. (NEW-5)
2. **Add one 308 assertion to the `build-and-local-smoke` lane.** Cheapest possible closure of the last layer of the exact failure class this PR exists to fix. (NEW-1)
3. Optional, one line each: guard the shadow check on prefix inequality rather than object identity (NEW-2); reject `aliasOf` values absent from `sources` (NEW-3).
4. Optional: extend the `routePrefixes` collision check to reject a redirect source **nested under** a mount, and to check the emitted bare form too. (N2)
5. Optional: `apps/showcase/README.md:144` still says "Getting started". (N9 residual)

---

## Unresolved questions for the controller

1. Carried forward from the first review and still open: should `assets.not_found_handling` be set to `404-page`? I confirmed on live Wrangler that an unmatched path returns a bare 404 with no docs 404 page, even though `apps/docs/dist/404.html` exists. Pre-existing and out of D030 scope.
2. `docsFoundation.sections[start].status` is still `"foundation"` now that the section carries five real pages. Who flips it, and to what?
3. N10 stands as an accepted scope decision — confirm the controller is content with 440 lines of #474-wide plan/scout artifacts landing under a D030 PR.
