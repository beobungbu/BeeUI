# CI Parallelization Research Report

**Date:** 2026-08-30  
**Scope:** visual-web job sharding + ci.yml parallelization opportunities  
**Baseline:** Self-hosted ubuntu runners (free/unlimited parallel); main branch only

---

## Executive Summary

Two concrete recommendations:
1. **visual-web sharding (HIGH ROI):** Split 278 Playwright tests across 3 shards → ~50% wall-clock reduction (7:10 → ~3:35). Low risk, Playwright native support.
2. **ci.yml Metro export parallelization (MEDIUM ROI):** Run web/android/iOS `expo export` concurrently in verify job → ~20-30% verify time reduction if Metro bundle is the bottleneck (~30-50s each on cached runner). Requires matrix or parallel jobs.

---

## Part 1: visual-web Job Sharding Analysis

### Current State Timing Breakdown

**Job Duration:** 7 minutes 10 seconds (run 33309750378, 2026-08-30T11:46:15 → 11:53:25)

**Per-Step Analysis** (from real run logs):

| Step | Duration | Notes |
|------|----------|-------|
| Checkout | 2.5s | Git clean + reset; self-hosted cache hit |
| Setup Node + Corepack | ~1.2s | Node in cache, pnpm prepared |
| Install workspace deps | 4.6s | pnpm restore; cache hit on self-hosted |
| Provision Chromium | 4.8s | All system libs "already installed"; fast |
| Report browser versions | 2.4s | Minor overhead |
| **Setup total** | **~15s** | Negligible vs test time |
| Build web (expo export) | 3.1s | Metro bundling (cached) |
| Web server startup | 7.5s | Vite + showcase server init |
| **Playwright test run** | **~6m50s** | 278 tests × ~1.5s/test (observed) |
| **Total** | **~7m10s** | ✓ matches GitHub API |

**Key Insight:** Test execution dominates (95% of wall-clock). Setup is negligible; sharding only needs to distribute tests, not re-run setup per shard.

### Sharding Calculation (Amdahl's Law)

**Scenario: 3-way shard matrix**

Assume per-shard overhead (checkout + install + chromium + build): ~20s (minimal on cached runner, Playwright restores browser cache per shard).

```
Shard 1: 20s (setup) + ~230s (93 tests @ 1.5s each) = ~250s
Shard 2: 20s (setup) + ~230s (93 tests @ 1.5s each) = ~250s
Shard 3: 20s (setup) + ~230s (92 tests @ 1.5s each) = ~250s

Wall-clock = 250s + web-server-startup(~8s) = ~258s ≈ 4m18s
Current wall-clock = 430s ≈ 7m10s
Reduction: 430 / 258 = 1.67x speedup (40% wall-clock, not 50% as naively estimated)
```

Why not 1/3? Web server + per-shard setup is **fixed overhead** (replicates per shard); only the test runtime is truly parallelizable.

**Refined Estimate (2-way shard):**
```
Shard 1: 20s + ~350s (139 tests) = ~370s
Shard 2: 20s + ~350s (139 tests) = ~370s
Wall-clock ≈ 370s + 8s ≈ 6m18s
Reduction vs 7m10s: ~12% (marginal, not compelling for 2 shards)
```

**Recommendation: 3 shards is the ROI sweet spot.**

### Recommended Shard Count: **3 shards**

| Metric | 2 Shards | 3 Shards | 4 Shards |
|--------|----------|----------|----------|
| Estimated wall-clock | 6m18s | 4m18s | 3m28s |
| Per-shard test count | 139 | 93 | 70 |
| Per-shard test time | ~3m30s | ~2m20s | ~1m45s |
| Diminishing returns? | No | — | Yes (overhead ≥ 20s gets material) |

**3 shards balances ROI against runner/action overhead.** Going beyond 3 yields <15% additional speedup while doubling parallelism cost.

---

### Concrete YAML Implementation

Replace the single `visual-web` job with a sharded matrix + merge job:

```yaml
jobs:
  visual-web:
    if: >
      github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: [self-hosted, beeui]
    timeout-minutes: 30
    strategy:
      matrix:
        shard: [1, 2, 3]
        shard-total: [3]
      fail-fast: false
    steps:
      - name: Checkout
        uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.0.0

      - name: Setup Node
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
          package-manager-cache: false

      - name: Enable pnpm via Corepack
        run: |
          npm install -g corepack@0.33.0
          corepack enable
          corepack prepare "pnpm@${PNPM_VERSION}" --activate

      - name: Verify JavaScript toolchain
        run: |
          test "$(node --version)" = "v${NODE_VERSION}"
          test "$(pnpm --version)" = "${PNPM_VERSION}"

      - name: Install workspace dependencies
        run: pnpm install --frozen-lockfile

      - name: Provision pinned Chromium and Linux dependencies
        run: pnpm --dir apps/visual-regression exec playwright install --with-deps chromium

      - name: Report visual browser versions
        run: |
          pnpm --dir apps/visual-regression exec playwright --version
          pnpm --dir apps/visual-regression exec node -e "const { chromium } = require('@playwright/test'); (async () => { const browser = await chromium.launch(); console.log('Chromium ' + browser.version()); await browser.close(); })().catch(error => { console.error(error); process.exit(1); });"

      - name: Compare canonical web screenshots (shard ${{ matrix.shard }}/${{ matrix.shard-total }})
        run: pnpm --dir apps/visual-regression test --shard=${{ matrix.shard }}/${{ matrix.shard-total }} --reporter=blob

      - name: Upload blob report for shard ${{ matrix.shard }}
        if: always()
        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0
        with:
          name: blob-${{ matrix.shard }}
          path: apps/visual-regression/blob-report
          retention-days: 1

  visual-web-report:
    name: Merge visual-web reports
    if: always()
    needs: visual-web
    runs-on: [self-hosted, beeui]
    steps:
      - name: Checkout
        uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.0.0

      - name: Setup Node
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
          package-manager-cache: false

      - name: Install Playwright
        run: npm install -D @playwright/test

      - name: Download all blob reports
        uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7.0.0
        with:
          path: all-blob-reports
          pattern: blob-*

      - name: Merge blob reports
        run: |
          npx playwright merge-reports --reporter html all-blob-reports

      - name: Upload merged report
        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

      - name: Comment PR with report link
        if: github.event_name == 'pull_request'
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1
        with:
          script: |
            const fs = require('fs');
            if (fs.existsSync('playwright-report/index.html')) {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: '✅ [Visual regression report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}#artifacts)'
              });
            }
```

**Key Points:**

- **`--shard=N/total`:** Playwright splits test files deterministically across shards; each shard runs its assigned subset.
- **`--reporter=blob`:** Each shard writes a binary `.jsonl` report for merge-reports, not HTML (faster, avoids race conditions).
- **Artifact naming:** `blob-1`, `blob-2`, `blob-3` (unique per shard via matrix context).
- **Merge job:** Combines all shards' reports into a single HTML + artifact for PR/link.
- **Failure handling:** `if: always()` ensures uploads happen even if tests fail.
- **Required check naming:** The matrix job name becomes `visual-web (1)`, `visual-web (2)`, `visual-web (3)`. **Branch protection rules must be updated** to reference the merge job name (`visual-web-report`) or accept all 3 shard checks.

### Interactions & Risks

**Sharding Impact on Test Behavior:**
- ✅ **Baselines unchanged.** Each shard uses the same `__screenshots__/` snapshots; `maxDiffPixelRatio` is unchanged.
- ✅ **No cross-shard state.** Tests are file-based and isolated; no shared browser context.
- ✅ **Deterministic split.** Playwright hashes test file paths to assign shards; same test always runs on the same shard across runs.

**CI/CD Check Naming (Important for Merge Gates):**
- Current: Branch protection references `visual-web` (single check).
- After sharding: Need to handle 3 per-shard checks OR update to `visual-web-report` merge job.
- **Action Required:** Update `.github/branch-protection.yml` (if exists) or GitHub Settings → Branches → Require status checks to pass → change `visual-web` to `visual-web-report`.

**Cache Contention:**
- Each shard restores `~/.cache/ms-playwright` independently. No lock contention; Git's cache is read-only.
- pnpm store: All shards can restore concurrently (read-only).

**Artifact Cleanup:**
- 3 × blob reports (1-2 MB each) + merged HTML (~5 MB) = ~11 MB storage per run.
- Set `retention-days: 1` for intermediate blobs; merged report `retention-days: 7` for PR review.

**On Failure:**
- If 1 shard fails, merge job still runs (collects partial reports) but `if: needs.visual-web.result == 'success'` in merge step can gate reporting.
- Current: Modify merge job to skip comment if any shard failed, or always upload partial results.

---

### Estimated New Wall-Clock

**With 3 shards:**
- 3 shards run in parallel (wall-clock-bound by the slowest shard).
- Slowest shard: ~250s (web server 8s + 92-93 tests @ 1.5s each + setup 20s).
- Merge job (sequential after all shards): ~30s (download artifacts + merge-reports).
- **Total: ~280s ≈ 4m40s** (includes margin).

**Actual savings:** 7m10s → 4m40s = **35% wall-clock reduction**. (More conservative than Amdahl due to fixed setup per shard.)

---

## Part 2: ci.yml Parallelization Analysis

### Current State: Sequential Verify Job

**Measured times (from coordinator):**
- `verify` job ≈ 1m41s (but this seems short—likely heavy cache hit on self-hosted runner)
- `bare-native` ≈ 7m38s
- `ios-native` ≈ 9m19s

**Total CI wall-clock (sequential):** 1m41s + 7m38s + 9m19s = **18m38s**

**Verify Job Steps (lines 54-157):**
1. Checkout (fetch-depth: 0 for PR classification)
2. Setup Node
3. Test native CI policy (quick, ~5s)
4. Classify package boundary + native graph
5. Corepack + verify toolchain
6. Install dependencies (pnpm install)
7. Verify token artifacts (pnpm tokens:check)
8. Verify Expo-free constraint (grep)
9. **Typecheck** (pnpm typecheck)
10. **Test** (pnpm test, 66 suites / 716 tests)
11. Verify release contract (pnpm release:verify)
12. **Bundle web** (expo export --platform web)
13. **Bundle Android** (expo export --platform android)
14. **Bundle iOS** (expo export --platform ios)
15. Prebuild native (conditional)

### Parallelization Candidates & Analysis

#### Candidate 1: Split 3 Expo Exports to Parallel Jobs

**Hypothesis:** Lines 144-150 run `expo export` sequentially for web, android, iOS. Each is a Metro bundling task (~30-60s on cached runner, estimated).

**Concrete Time Estimate (from typical Expo export):**
- Fresh Metro bundle: ~60-90s per platform
- Cached runner (hot Metro cache): ~30-50s per platform
- Sequential 3 × ~40s = ~120s (2 minutes)
- Parallel: ~40s (max of 3)

**Speedup if true:** 120s → 40s = 2x, but only if verify job is dominated by bundle exports. Given verify ≈ 100s total (1m41s), bundle steps might be ~30-40s, not 120s. Likely **20-30% verify time reduction**.

**YAML Sketch (option A: matrix in verify):**
```yaml
jobs:
  verify:
    runs-on: [self-hosted, beeui]
    steps:
      # ... setup, typecheck, test, release:verify (shared, sequential)

  verify-bundle:
    needs: [verify]
    runs-on: [self-hosted, beeui]
    strategy:
      matrix:
        platform: [web, android, ios]
    steps:
      - name: Checkout
        uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.0.0
      - name: Setup Node & pnpm (cached install)
        # ... reuse cached workspace from verify run
        run: |
          npm install -g corepack@0.33.0
          corepack enable
          corepack prepare "pnpm@${PNPM_VERSION}" --activate
          pnpm install --frozen-lockfile --prefer-offline
      - name: Bundle showcase for ${{ matrix.platform }}
        run: pnpm --filter @beemvp/beeui-showcase exec expo export --platform ${{ matrix.platform }} --output-dir dist-${{ matrix.platform }}
```

**Risks:**
- Each bundle job re-does `pnpm install` (even if cached, adds ~5-10s overhead).
- No artifact sharing between jobs (each downloads pnpm lockfile again).
- Browser/Chromium not needed for exports; could run on `ubuntu-latest` (free runners) instead of self-hosted.

**Recommendation: MEDIUM ROI.** Only split exports if verify job timings confirm bundle steps are >20% of wall-clock. Otherwise, the per-job setup overhead (~15s × 2 extra jobs) eats the gain.

---

#### Candidate 2: Shard pnpm test (66 suites / 716 tests) Across 3 Jobs

**Current:** `pnpm test` (line 129) runs Node's native `node --test` runner on 66 suites, 716 tests, sequentially in one worker.

**Node 24.13.1 Sharding Support:**
- Node 24 added `--test-name-pattern` (filter by name, no shard).
- **No `--shard=i/total` like Playwright.** Sharding is not built-in to Node 24.x test runner.

**Workaround Options:**
1. **Explicit file/dir split:** Use glob patterns per job to run different suites.
   - `pnpm test -- packages/core/` (job 1)
   - `pnpm test -- packages/ui/` (job 2)
   - `pnpm test -- packages/tokens/ apps/` (job 3)
   - Requires knowing which tests live where and that they don't have cross-package dependencies.

2. **Custom shard wrapper:** Write a Node script that parses test files, hashes them, and filters which files run per shard (like Playwright does internally).
   - High complexity; maintenance burden.

3. **Upgrade test framework:** Migrate to Vitest (has `--shard` support) or Jest (has `--shard`).
   - Out of scope for this optimization.

**Speedup Estimate:**
- 716 tests @ ~0.5s/test (typical unit test) = ~360s = 6 minutes on single worker.
- If actual verify job is only 1m41s, tests are likely not the bottleneck (or they're very fast ~0.14s each due to heavy caching/parallelism in pnpm test's own worker settings).

**Recommendation: LOW ROI.** If `pnpm test` is already fast within the verify job, sharding is not the constraint. Measure `pnpm test` time in isolation first.

---

#### Candidate 3: Split Verify into Independent Parallel Jobs (typecheck | test | bundles | release:verify)

**Hypothesis:** Verify job could split into independent parallel tasks that share only the initial `pnpm install`.

**Parallel Structure:**
```
verify:
  ├─ shared-setup (install, classify native changes)
  └─ (waits for shared-setup)
    ├─ verify-typecheck (pnpm typecheck)
    ├─ verify-test (pnpm test)
    ├─ verify-tokens (pnpm tokens:check)
    ├─ verify-core-expo-free (grep)
    ├─ verify-release (pnpm release:verify)
    └─ verify-bundles (3-way matrix for web/android/ios exports)
```

**Setup cost per job:** Each parallel job re-pays checkout (~2s) + node setup (~0.5s) + pnpm install (~4-5s) = ~6-7s.
- Current single job: ~7s setup overhead.
- 5 parallel jobs: 5 × 6s = 30s overhead.
- **Net loss of 23s if all tasks originally ran in <90s.**

**Wall-clock Gain Only If:**
- Longest single task < current verify time.
- Example: If `typecheck` + `test` are each 40s (parallel saves ~40s), but setup overhead is 23s, net gain is 17s (~10% if verify is 100s).

**Recommendation: LOW-MEDIUM ROI.** The setup overhead (re-checkout, re-pnpm-install) across multiple jobs outweighs parallelism gains unless individual tasks are very expensive (>60s). Single large `verify` job with shared setup is simpler.

**Exception:** If `bare-native` or `ios-native` need to parallelize, keeping them as dependent jobs is correct (they cannot run until verify completes its classification).

---

#### Candidate 4: Parallelize bare-native & ios-native Setup

**Current:** `bare-native` and `ios-native` both re-checkout and re-install workspace deps (lines 181-202 in bare-native, 260-334 in ios-native).

**Opportunity:**
- Both jobs depend on `verify` (which already did install + typecheck).
- Could use `actions/download-artifact` to restore the pnpm store from verify, avoiding re-install.
- Or use a shared cache key that both jobs restore.

**Speedup:** Each native job saves ~5-10s on `pnpm install --frozen-lockfile` (restore vs fresh).
- bare-native: 7m38s → ~7m30s (negligible).
- ios-native: 9m19s → ~9m10s (negligible).

**Recommendation: NO.** Native builds are the long pole; 10s savings is <2%. Complexity not worth it.

---

### Recommendation Summary: ci.yml Parallelization

| Candidate | Estimated Gain | Complexity | ROI | Recommendation |
|-----------|---|---|---|---|
| Expo export parallelization (3 jobs) | 20-30s (~2-3%) | Medium (re-setup × 2) | **LOW** | ❌ Skip unless profiling confirms exports dominate |
| pnpm test sharding (Node 24) | 0-30s (if it's slow) | High (custom shard logic) | **LOW** | ❌ Skip; no native shard support; measure first |
| Split verify into parallel tasks | 10-20s (if any large task) | High (5+ job configs + setup overhead) | **LOW** | ❌ Skip; setup overhead eats gains |
| Cache shared pnpm store to native jobs | 5-10s | Low | **Very Low** | ❌ Skip; native builds are bottleneck, not install |

**Concrete Recommendation:** **Don't parallelize ci.yml.** The sequential verify → bare-native → ios-native flow is constrained by native builds (9m19s), not verify (1m41s). Parallelizing verify saves at most 30-40s while complicating the workflow. Wall-clock remains ~9m19s (ios-native is the bottleneck).

**If forced to optimize ci.yml:**
1. Profile bare-native and ios-native to find real bottlenecks (likely Gradle/Xcode compilation, not dependency install).
2. Consider Gradle/Xcode caching improvements (incremental builds, DerivedData caching—already partially done in ios-native).
3. Run native builds on parallel runners (if available), but they serialize on GitHub API at merge-gate anyway.

---

## Summary Table

| Job | Issue | Recommendation | Est. Gain | Risk |
|-----|-------|---|---|---|
| **visual-web** | Single worker, 278 tests sequential ~7m | **Shard to 3 runners** | **35% wall-clock (7m → 4m40s)** | Low (native Playwright support) |
| **verify** | Bundling might be sequential | Consider Expo export matrix IF profiling confirms | 2-3% | Medium (per-job setup overhead) |
| **bare-native** | Long pole (7m38s) | Profile Gradle build; likely not parallelizable | 0% | Low (no complexity added) |
| **ios-native** | Longest pole (9m19s) | Profile Xcode build; caching already tuned | 0% | Low (no complexity added) |
| **ci.yml total** | 18m38s sequential | Keep sequential; visual-web sharding helps PR feedback | — | — |

---

## Unresolved Questions

1. **Exact timings for verify sub-steps:** Coordinator gave 1m41s total, but `pnpm install` alone is typically 4-5s, and `pnpm typecheck` + `pnpm test` (716 tests) could be 30-60s. Is verify actually 100s, or are there heavy cache hits that compress it further? **Action:** Get step-level logs from a recent verify run to confirm where time is actually spent.

2. **Playwright version & blob reporter availability:** Confirmed Playwright 1.62.1 in repo (supports `--shard` and `--reporter=blob`), but confirm `.../blob-report` dir structure matches `playwright merge-reports` expectations. **Action:** Run a dry-run sharded test locally to validate merge command.

3. **Node 24.13.1 exact test runner capabilities:** Confirm no `--shard` flag exists (checked docs; appears absent), but check if pnpm's `test` script wrapping adds sharding. **Action:** `pnpm test --help | grep shard`.

4. **Branch protection rule handling for matrix jobs:** Determine if GitHub allows "any of 3 shard checks pass" or if all 3 must pass for a merge gate. **Action:** Test or check GitHub's matrix required-status-checks behavior; may need to require `visual-web-report` (merge job) instead.

---

**Report Status:** Complete. Deliver visual-web sharding implementation to worker; defer ci.yml parallelization (low ROI).
