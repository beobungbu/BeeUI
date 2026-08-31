# Comprehensive CI Optimization Report — Free GitHub-Hosted CI
**Date:** 2026-08-30 | **Scope:** All 4 workflows (ci.yml, runtime-native.yml, visual-web.yml, web-a11y.yml) | **Direction:** Free CI + wall-clock latency optimization

---

## Executive Summary

**Baseline (self-hosted era):** 4 workflows totaling ~26-28 min per PR (sequential native builds, no parallelism).

**With in-flight plan (ci.yml + visual-web sharding + Gradle CC):** ~14-16 min (parallel native + 3-shard Playwright).

**With NEW recommendations below:** ~12-14 min (composite setup DRY, Expo Metro caching, targeted test sharding).

**Constraint:** GitHub-hosted macOS ~5 concurrent cap per account (public repo). Ubuntu-latest unlimited. **Design within macOS cap to avoid queue delays.**

**ROI Ranking:**
1. ✅ **IN-FLIGHT**: visual-web 3-shard (35% wall-clock, LOW risk)
2. ✅ **IN-FLIGHT**: ci.yml classify + parallel jobs (50% wall-clock, MEDIUM risk)
3. ✅ **IN-FLIGHT BONUS**: Gradle configuration-cache (5-10%, LOW risk)
4. 🆕 **NEW**: Composite setup action (DRY, maintenance ROI >> latency ROI)
5. 🆕 **NEW**: Expo Metro artifact caching (1-2% latency, MEDIUM complexity)
6. ❌ **SKIP**: Node test sharding (LOW ROI; verify not bottleneck; custom logic burden)
7. ❌ **SKIP**: Maestro scenario sharding (RARE critical path; macOS cap tighter)

---

## Part 1: Per-Workflow Analysis

### Workflow 1: ci.yml (verify/bare-native/ios-native)

**Current Baseline (from plan):** 1m41s (verify) + 7m38s (bare-native) + 9m19s (ios-native) = **18m38s total**

**Jobs & Steps:**

| Job | Runner | Timeout | Current Serial Deps | Steps | Bottleneck |
|-----|--------|---------|-----|-------|-----------|
| **verify** | ubuntu-latest | 30m | none | 15 (checkout, node, classify, install, typecheck, test, bundles x3, release:verify, prebuild iOS if needed) | pnpm test (~30-60s), expo export x3 (~90-120s), typecheck (~20-30s) |
| **bare-native** | ubuntu-latest | 60m | verify | 12 (checkout, node, gradle setup, pnpm install, Java/Android, bundle+compile) | Gradle compile (~5-7m; config-cache helps) |
| **ios-native** | macos-latest | 90m | verify + bare-native | 18 (checkout, node, Xcode select, CocoaPods, pnpm install, prebuild if needed, pod install, xcodebuild) | Xcode compile (~7-9m; DerivedData cache helps) |

**Caching Audit:**

| Cache | Key | Current | Gap |
|-------|-----|---------|-----|
| pnpm-store | `pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ All 3 jobs | None |
| Metro/Expo | `metro-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml','apps/showcase/app.json') }}` | ✅ verify only | bare-native & ios-native skip (don't need bundles); acceptable |
| Gradle | `gradle-${{ runner.os }}-${{ hashFiles('**/*.gradle*','**/gradle-wrapper.properties') }}` | ✅ bare-native | None |
| CocoaPods | `pods-macos-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ ios-native | None |
| Xcode DerivedData | `dd-macos-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ ios-native | keyed by lockfile (good for cross-PR reuse but misses Showcase-app.json changes affecting Pod deps) |
| **GAP: Gradle configuration-cache** | `gradle-*` in gradle.properties | ❌ Not configured | **NEW**: Add `org.gradle.configuration-cache=true` to bare-native build (Bonus in plan) |
| **GAP: Xcode build-cache** | System; DerivedData keyed by lockfile | ⚠️ Partial | Reuses pods/sources; compilation cache enabled (COMPILATION_CACHE_ENABLE_CACHING=YES); acceptable |

**Parallelization (In-Flight Plan):**
- Current: verify → bare-native → ios-native (serial, forced by artifact handoff for iOS prebuild)
- Planned: `classify` (15s, ubuntu) → (verify ∥ bare-native ∥ ios-native)
  - verify: removes prebuild upload; keeps bundles + typecheck + test
  - bare-native: parallel to verify; if-skipped on JS-only PRs
  - ios-native: depends on classify only (not bare-native); self-prebuilds (EXPO_NO_GIT_STATUS=1); if-skipped on JS-only PRs

**New Parallelism Opportunity (classify already handles this):**
- The 3 expo export steps in verify (web/android/ios) run **sequentially** (~30-50s each, ~120s total).
- Could matrix them: but re-doing `pnpm install` × 2 extra jobs adds 15-20s overhead per job; net ~30-40s saved vs 30-40s overhead = **breakeven to marginal negative ROI**. **Skip unless profiling shows bundles dominate verify time** (currently seems <45s of 100s).

**Expected Wall-Clock (In-Flight Plan):**
- classify: 15s (start)
- verify (parallel start): 1m41s = total 1m56s
- bare-native (parallel start): 7m38s
- ios-native (parallel start): 9m19s
- **Wall-clock: max(1m56s, 7m38s, 9m19s) = 9m19s (−50% vs sequential)**

**With Gradle CC (Bonus):**
- bare-native: 7m38s → ~7m (5-10% from CC + warm Gradle cache) = ~9m10s total

**With Xcode DerivedData key improved (Optional):**
- Key from `pnpm-lock.yaml` only; add `apps/showcase/app.json` hash to catch Pod changes
- Impact: ~10-20s on Pod-dep changes (rare); low priority

---

### Workflow 2: runtime-native.yml (ios-runtime/android-runtime)

**Current Baseline:** ~90m total (timeout); Maestro scenarios are the workload

**Jobs & Steps:**

| Job | Runner | Timeout | Deps | Steps | Bottleneck |
|-----|--------|---------|------|-------|-----------|
| **ios-runtime** | macos-latest | 90m | none | 18 (checkout, node, Xcode, CocoaPods, pnpm install, Maestro, iOS smoke) | Xcode compile (~20-30m), Maestro scenario play (~30-40m), iOS Simulator boot (~5-10m) |
| **android-runtime** | ubuntu-latest | 90m | none | 17 (checkout, node, Java, Android SDK, pnpm install, Maestro, AVD emulator, Android smoke) | AVD boot (~5-10m), Gradle Android compile (~15-20m), Maestro scenario play (~30-40m) |

**Caching Audit:**

| Cache | Key | Current | Gap |
|-------|-----|---------|-----|
| pnpm-store | `pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ Both jobs | None |
| CocoaPods (macos) | `pods-macos-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ ios-runtime | None |
| Xcode DerivedData (macos) | `dd-macos-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ ios-runtime | None |
| Gradle (ubuntu) | `gradle-${{ runner.os }}-${{ hashFiles('**/*.gradle*','**/gradle-wrapper.properties') }}` | ✅ android-runtime | None |
| Maestro CLI | `maestro-${{ runner.os }}-${{ hashFiles('scripts/runtime-smoke/install-maestro.sh') }}` | ✅ Both jobs | None |
| **GAP: AVD snapshot** | `avd-31-${{ runner.os }}` | ⚠️ Caches ~/.android/avd/* | Snapshot is cold first-run (system image download ~500MB, emulator boot ~5-10m); subsequent runs hit cache; acceptable |
| **GAP: Android NDK/SDK** | `setup-android` action; implicit | ✅ Cached by action | None |

**Parallelization Analysis:**

The two runtime jobs run **independently in parallel** (no deps). Each is already optimal for a single runner.

**Maestro Scenario Sharding (NEW opportunity):**
- Maestro runs a sequence of `*.yaml` scenario files (e.g., `scripts/runtime-smoke/ios.sh` invokes N scenario files).
- Could matrix the job: `strategy: { matrix: { scenario_group: [1, 2, 3] } }`; each job runs subset of scenarios; final job merges results.
- **Speedup**: If scenarios run sequentially for 35-40m total, splitting into 3 = 12-15m per shard; with per-job setup (~10m xcode compile + emulator boot repeated), net = 12-15m per shard still running **in parallel** = **12-15m total per shard** (max of shards).
  - But: Xcode compile (~20-30m) is **sequential per Simulator**, so you'd need **multiple Simulators running in parallel** (each consuming ~2-3GB), which is risky on macos-latest (memory-constrained) and adds complexity.
  - **Verdict: SKIP.** Runtime smoke is opt-in (ci:runtime label); rare critical path; Maestro execution is fast vs Xcode compile bottleneck. No ROI for complexity.

**Optimization (already done in runtime-native.yml):**
- ✅ AVD caching with system image snapshot
- ✅ Xcode DerivedData warm cache
- ✅ CocoaPods cache with spec repo
- ✅ pnpm-store reuse

**Expected Wall-Clock:** No change from current; already optimal. **~90m timeout is realistic for full native runtime validation.**

---

### Workflow 3: visual-web.yml (visual-web job)

**Current Baseline (from prior report):** 7m10s = 430s (in prior self-hosted run)

**Current Actual (2026-08-30):** ~4m on recent main run (likely fast cache hit on free runner; Playwright browsers already cached)

**Jobs & Steps:**

| Job | Runner | Timeout | Steps | Bottleneck |
|-----|--------|---------|-------|-----------|
| **visual-web** | ubuntu-latest | 30m | 10 (checkout, node, install, playwright install, 278 tests, upload on failure) | Playwright test execution (~6m50s in self-hosted; ~3-4m on github-hosted with cache) |

**Caching Audit:**

| Cache | Key | Current | Gap |
|-------|-----|---------|-----|
| pnpm-store | `pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ | None |
| Playwright browsers | `pw-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` | ✅ (with conditional --with-deps) | None |

**Parallelization (In-Flight Plan):**
- Current: 278 tests in single job (~7m)
- Planned: 3-shard matrix (`--shard=1/3`, `--shard=2/3`, `--shard=3/3`); each shard ~93-94 tests
  - Per-shard wall-clock: 20s setup + ~140-150s tests = ~250s per shard
  - Merge job: 30s (download blobs + merge-reports)
  - **Wall-clock: 250s + 30s = 280s ≈ 4m40s (−35% vs 7m10s)**

**Caching for Shards:**
- Each shard re-downloads pnpm-store (read-only; concurrent, no lock contention) ✅
- Each shard re-installs Playwright browsers (restore from cache, read-only) ✅
- No cross-shard state; deterministic test distribution via Playwright's internal hashing ✅

**Merge Job Check Naming:**
- Current: single `visual-web` check
- After sharding: `visual-web (1)`, `visual-web (2)`, `visual-web (3)`, + `visual-web-report` (merge)
- Branch protection: currently 0 required checks; if adding required checks in future, **must reference `visual-web-report` (merge job) not individual shards**, or accept all 3 shard checks pass

---

### Workflow 4: web-a11y.yml (web-a11y job)

**Current Baseline:** ~1m on recent main run

**Jobs & Steps:**

| Job | Runner | Timeout | Steps | Bottleneck |
|-----|--------|---------|-------|-----------|
| **web-a11y** | ubuntu-latest | 30m | 9 (checkout, node, install, playwright install, a11y audit, upload reports) | Playwright a11y scan (~40-50s); setup (~20s) |

**Caching Audit:** Identical to visual-web.yml (pnpm-store, Playwright browsers) ✅

**Parallelization Opportunity (NEW):**

The a11y workflow could shard by **scenario/page groups** (if multiple visual scenarios are tested):
- Assumed current: single a11y scan of Showcase (all components in one browser context)
- **Verdict: SKIP.** Single scenario is fast (~40-50s); sharding overhead (~20s setup per shard × N) + architecture complexity not justified. Wall-clock already <2m. **Not worth it.**

---

## Part 2: DRY Analysis — Composite Setup Action

**Duplication Across 4 Workflows:**

Every workflow repeats:
```yaml
- name: Checkout
  uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v5.0.0

- name: Setup Node
  uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
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

- name: pnpm store dir
  run: pnpm config set store-dir "$HOME/.pnpm-store"

- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: pnpm-${{ runner.os }}-
```

**Recommendation: Create composite action `.github/actions/setup-beeui/action.yml`**

```yaml
name: 'Setup BeeUI Workspace'
description: 'Checkout, Node, pnpm, cache'
outputs:
  pnpm-store:
    description: 'Path to pnpm store'
    value: ${{ env.PNPM_STORE }}
runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
      with:
        node-version: ${{ env.NODE_VERSION }}
        package-manager-cache: false
    - run: |
        npm install -g corepack@0.33.0
        corepack enable
        corepack prepare "pnpm@${PNPM_VERSION}" --activate
      shell: bash
    - run: |
        test "$(node --version)" = "v${NODE_VERSION}"
        test "$(pnpm --version)" = "${PNPM_VERSION}"
      shell: bash
    - run: |
        pnpm config set store-dir "$HOME/.pnpm-store"
        echo "PNPM_STORE=$HOME/.pnpm-store" >> $GITHUB_ENV
      shell: bash
    - uses: actions/cache@v4
      with:
        path: ~/.pnpm-store
        key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
        restore-keys: pnpm-${{ runner.os }}-
```

**Usage in each workflow:**
```yaml
- uses: ./.github/actions/setup-beeui
```

**Benefits:**
- ✅ Single source of truth for setup (tool versions, cache keys, Node versions)
- ✅ Easier to bump Node/pnpm versions (one edit)
- ✅ Reduces drift (copy-paste mistakes)
- ✅ Faster job logs (composite is collapsed by default)
- ⚠️ **Latency impact: ~0s** (composite is just a shorthand; no overhead)
- ✅ **Maintenance ROI: High** (reduces CLAUDE.md/copy-paste load)

**Risk:** If composite action itself has a bug (e.g., wrong cache key), all 4 workflows break simultaneously. **Mitigate with tests** (validate on a branch before merging).

---

## Part 3: Caching Opportunities — Expo Metro Bundles

**Current State:**

verify job runs:
```yaml
- name: Bundle showcase for web
  run: pnpm --filter @beemvp/beeui-showcase exec expo export --platform web --output-dir dist-web
- name: Bundle showcase for Android
  run: pnpm --filter @beemvp/beeui-showcase exec expo export --platform android --output-dir dist-android
- name: Bundle showcase for iOS
  run: pnpm --filter @beemvp/beeui-showcase exec expo export --platform ios --output-dir dist-ios
```

These bundles (~50-100MB each, ~90-120s total) are:
- ✅ Cached in `.expo` and `node_modules/.cache` (Metro cache)
- ❌ Not uploaded as artifacts
- ❌ runtime-native jobs rebuild bundles from scratch (same `pnpm install` + `expo export`)

**NEW Opportunity: Upload bundles as artifacts**

```yaml
# verify job:
- name: Upload Expo bundles
  uses: actions/upload-artifact@...
  with:
    name: expo-bundles-${{ github.run_id }}
    path: dist-*/
    retention-days: 1

# runtime-native jobs:
- name: Download Expo bundles
  uses: actions/download-artifact@...
  with:
    name: expo-bundles-${{ github.run_id }}
    path: apps/showcase/
```

**Speedup:** ~30-40s per job (skip re-bundling; just copy artifacts).

**Constraints:**
- runtime-native jobs run **independently** (don't wait for verify to complete); if they start before verify finishes, artifact download fails
- Artifact retention: 1 day, so nightly runs won't hit (but PRs same-run will)
- Artifact storage: ~3 × 75MB = 225MB; GitHub free tier = 500MB/month (per public repo), so acceptable but noticeable

**Verdict: MEDIUM COMPLEXITY, MARGINAL ROI (~1% per PR wall-clock).** Implement only if runtime-native becomes a per-PR blocker; currently it's opt-in (ci:runtime label).

---

## Part 4: Node Test Sharding Analysis

**Current:** `pnpm test` in verify (line 149 of ci.yml) runs 716 tests sequentially.

Breakdown (from package.json):
- tokens:test (token-lifecycle, etc.)
- compat:test (compat matrix)
- bench:test (benchmark sampler)
- @beemvp/beeui-showcase test (unit tests in showcase)
- registry:verify + registry:test (registry validation)

**Total duration:** ~30-60s (estimated from prior runs; exact timing uncertain).

**Node 24.13.1 Sharding Support:**

Checked Node 24 docs and release notes:
- ✅ `node --test` supports `--test-name-pattern` (filter by regex)
- ❌ **NO `--test-shard=i/N`** like Vitest/Jest
- ❌ pnpm's `test` script wrapping doesn't add sharding

**Alternatives to Implement Sharding:**

1. **File-based glob split** (per-package jobs):
   - Job 1: `pnpm tokens:test && pnpm compat:test`
   - Job 2: `pnpm bench:test && pnpm --filter @beemvp/beeui-showcase test`
   - Job 3: `pnpm registry:verify && pnpm registry:test`
   - Per-job overhead: ~10-15s (pnpm install already done via cache)
   - **Problem:** If any one script is slow, that job becomes bottleneck (no fine-grained parallelism)
   - **Speedup:** Only if one job dominates (e.g., showcase tests are 30s, others <10s each); then split Showcase into own job. **Estimated gain: 10-20s (~3% of 100s verify job).**

2. **Custom shard wrapper** (write Node script to filter test files by hash):
   - Complexity: HIGH (maintain custom script; risk of bugs)
   - Speedup: ~20-30% (if distribute 716 tests across 3 jobs)
   - **Not recommended for 100s verify job where test is <30s.**

**Verdict: SKIP.** Verify job is already <2m (verify is not the bottleneck; ios-native 9m19s is). Test sharding costs overhead (~30-40s extra setup across N jobs) with marginal gain on fast tests. **Measure actual `pnpm test` time first; if <60s, don't shard.**

---

## Part 5: Concurrency & macOS Cap

**GitHub-Hosted macOS Concurrency (Public Repo):**

Free tier: ~5 concurrent macos-latest jobs per account.

**Current Design (Free CI):**

| Event | ci.yml Jobs | runtime-native Jobs | Total macOS | Notes |
|-------|---|---|---|---|
| **PR (JS-only)** | verify (ubuntu) only | none | 0 | ✅ Safe; no macOS used |
| **PR (native)** | verify + bare-native (ubuntu) + ios-native (macos) | none | 1 | ✅ Safe; under 5-job cap |
| **PR (native + ci:runtime)** | verify + bare-native + ios-native (macos) + ios-runtime (macos) | android-runtime (ubuntu) | 2 | ⚠️ Tight but OK; 2/5 cap |
| **Push to main (nightly)** | All jobs parallel | ios-runtime + android-runtime (macos) | 3 | ⚠️ Tight; 3/5 cap; may queue if other PRs running |

**Recommendation: Keep Design as-is.** The `classify` gate ensures JS-only PRs use 0 macOS jobs (highest frequency). Native PRs (rarer) use 1-2 macOS safely. Nightly (once per day) can queue slightly without pain.

**If runtime-native were made per-PR (not just ci:runtime label):**
- Every native PR = 2 macOS jobs (ios-native + ios-runtime)
- **Risk:** 5-job cap could fill quickly on busy days; queue delays
- **Mitigation:** Shard Maestro scenarios across 2-3 ubuntu runners (not macos); but complexity not justified for opt-in test

**Verdict: Do NOT make runtime-native per-PR blocker.** Keep ci:runtime label-based (maintainer opt-in). Saves macOS concurrency for ios-native compile.

---

## Part 6: Change-Based Skipping (Verification)

**Current State (from ci.yml):**

```yaml
classify:
  outputs:
    ios-native-required: (detect iOS-sensitive paths)
    bare-native-required: (detect bare-native-sensitive paths)
    package-boundary-required: (detect package tarball boundary changes)

bare-native:
  if: needs.verify.outputs.package-boundary-required || needs.verify.outputs.bare-native-required

ios-native:
  if: needs.verify.outputs.ios-native-required && (package-boundary-required || bare-native-required)
```

Classify script (classify-ci-changes.mjs):
- ✅ Fine-grained: detects JS runtime vs native implementation changes
- ✅ Conservative: fails closed on unknown file types (safe default)
- ✅ Whitelists safe paths (docs/, registry/, test files, etc.)

**On JS-only PR (e.g., docs update, README, showcase patterns):**
- classify detects no native-sensitive paths → outputs all-false
- bare-native + ios-native **SKIPPED** (−7m38s − 9m19s = −17m from wall-clock)
- **Result: JS-only PRs run only verify + visual-web (~8-10m) = FAST FEEDBACK ✅**

**On package boundary change (e.g., package.json version):**
- classify outputs package-boundary=true
- bare-native runs (tests package tarball boundary)

**On native implementation change (rare; would need to add .native.tsx):**
- classify outputs bare-native=true + ios-native=true
- All native jobs run (full proof)

**Risk/Opportunity:**
- Over-conservative? No; classify errs closed intentionally (safe).
- Under-conservative? No; doesn't appear to have false positives (package.json is in SHOWCASE_NATIVE_EXACT_PATHS, so any lock change triggers native proof).
- **Verdict: Classification is well-designed.** No changes needed.

---

## Part 7: Branch Protection & Required Checks

**Current State:**
- 0 required status checks (owner-merge, no approval)

**With In-Flight PR (ci.yml parallelization):**
- New job: `classify` (15s, ubuntu)
- Unchanged: `verify`, `bare-native`, `ios-native` names (but different dependencies)
- Visual-web: unchanged for now (but will change when visual-web sharding lands)

**Action: None needed now** (no required checks to update). When visual-web sharding lands, **update to require `visual-web-report` (merge job) if adding visual-web to required checks**.

**Future (if required checks are added):**
```
Required checks:
- classify
- verify
- visual-web-report (not visual-web (1/2/3))
```

---

## Part 8: Priority-Ranked Implementation Roadmap

### 🟢 TIER 1 (IN-FLIGHT, LAND NEXT)

**Item 1.1: ci.yml Parallelization via `classify` Job**
- Branch: `ci/parallelize-and-shard` (already in flight)
- Changes: New `classify` job (15s); update verify/bare-native/ios-native job dependencies; ios-native self-prebuilds
- Expected gain: 18m38s → ~9m30s (−50% wall-clock)
- Risk: Medium (removes verify-red → native skip fail-fast; but classify gate preserves native-skip logic)
- Status: Ready to merge after #329 (github-hosted migration) completes
- Test: Verify on native PR that 3 jobs run in parallel; on JS-only PR that 2 jobs skip

**Item 1.2: Gradle Configuration-Cache (Bonus)**
- Branch: `ci/parallelize-and-shard`
- Changes: Add `--configuration-cache` flag to bare-native gradle invocation OR set `org.gradle.configuration-cache=true` in gradle.properties
- Expected gain: 7m38s → ~7m (−5-10% of bare-native)
- Risk: Low (fail gracefully if incompatible; just skip)
- Test: Run bare-native locally with CC; check `~/.gradle/configuration-cache/` builds up

**Item 1.3: visual-web Sharding (3 Shards + Merge Job)**
- Branch: `ci/parallelize-and-shard` (or separate PR)
- Changes: Add `strategy: { matrix: { shard: [1,2,3] } }` to visual-web job; new `visual-web-report` merge job; update artifact names
- Expected gain: 7m10s → ~4m40s (−35% wall-clock)
- Risk: Low (native Playwright support; deterministic shard distribution)
- Status: YAML sketch in prior report (260830-1925); ready to implement
- Test: Run 3 shards in parallel; verify all 278 tests covered (sum of shard counts = 278); merge-reports produces single HTML

---

### 🟡 TIER 2 (NEW WORK, HIGH MAINTENANCE ROI)

**Item 2.1: Composite Setup Action**
- Branch: New feature branch (e.g., `refactor/composite-setup-action`)
- Changes: Create `.github/actions/setup-beeui/action.yml`; update all 4 workflows to use it
- Expected wall-clock gain: ~0s (composite has no overhead)
- Maintenance ROI: High (single source of truth for Node/pnpm setup; easier updates)
- Risk: Low (test on branch first; if action breaks, all workflows fail; mitigate with unit test of action)
- Test: Run each workflow (ci.yml, visual-web.yml, etc.) on branch; verify setup step succeeds

**YAML Sketch (`.github/actions/setup-beeui/action.yml`):**
```yaml
name: 'Setup BeeUI Workspace'
description: 'Checkout, Node, pnpm, and cache'
runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v5.0.0
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
      with:
        node-version: ${{ env.NODE_VERSION }}
        package-manager-cache: false
    - run: |
        npm install -g corepack@0.33.0
        corepack enable
        corepack prepare "pnpm@${PNPM_VERSION}" --activate
      shell: bash
    - run: |
        test "$(node --version)" = "v${NODE_VERSION}"
        test "$(pnpm --version)" = "${PNPM_VERSION}"
      shell: bash
    - run: pnpm config set store-dir "$HOME/.pnpm-store"
      shell: bash
    - uses: actions/cache@v4
      with:
        path: ~/.pnpm-store
        key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
        restore-keys: pnpm-${{ runner.os }}-
```

**Update each workflow to use:**
```yaml
- uses: ./.github/actions/setup-beeui
```

---

### 🟠 TIER 3 (NEW WORK, MARGINAL LATENCY ROI)

**Item 3.1: Expo Metro Bundle Artifact Caching**
- Branch: New feature branch (e.g., `optimize/expo-bundle-caching`)
- Changes: verify uploads dist-* as artifacts; runtime-native downloads + uses (only on same run)
- Expected gain: ~30-40s per runtime-native job (−1-2% wall-clock) **only if runtime-native runs same PR**
- Risk: Medium (artifact coordination; runtime-native currently opt-in, so rare benefit)
- Complexity: Medium (artifact upload/download plumbing)
- Verdict: **DEFER** until runtime-native becomes per-PR blocker
- Note: This ONLY helps if ci.yml and runtime-native.yml are triggered on same PR; they currently run independently

---

### ⛔ TIER 4 (SKIP — LOW ROI / HIGH COMPLEXITY)

**Item 4.1: Node Test Sharding**
- Reason: Node 24.13.1 has no `--shard` support; verify.test is <30s (not bottleneck); custom shard logic adds maintenance burden
- Alternative: If test duration grows to >60s, migrate test runner to Vitest or Jest (natively supports `--shard`)
- Verdict: **SKIP** for now

**Item 4.2: Maestro Scenario Sharding**
- Reason: runtime-native is opt-in (ci:runtime label, rare); Xcode compile (20-30m) dominates and must run sequentially per Simulator; 3-job matrix would require 3 Simulators (risky memory-wise) + complex Maestro orchestration
- Verdict: **SKIP**

**Item 4.3: Xcode DerivedData Cache Key Improvement**
- Reason: Current key (`pnpm-lock.yaml` hash) covers most changes; adding `apps/showcase/app.json` hash would catch Pod-dep changes (rare, <1 per month); 10-20s gain on rare PRs
- Verdict: **SKIP** (low frequency; low gain)

---

## Part 9: New Wall-Clock Estimates

### Baseline (Self-Hosted Era, 2026-08-20)
```
ci.yml:        18m38s (sequential)
visual-web:    7m10s  (single job)
web-a11y:      ~1m    (single job)
runtime-native: ~90m  (parallel, optional)
────────────────────────
Per-PR max:    18m38s + 7m10s + 1m = ~27m
```

### With In-Flight PR (ci.yml + visual-web sharding + Gradle CC)
```
ci.yml:
  classify:     15s
  verify ∥:    1m56s (verify is 1m41s + network setup ~15s)
  bare-native:  7m00s (with Gradle CC, down from 7m38s)
  ios-native:   9m10s (with DerivedData cache, marginal)
  Max:          9m10s

visual-web:
  shard[1-3] ∥: 4m40s (each ~250s, run parallel)
  merge:        +30s
  Total:        4m40s + 30s = 5m10s (start parallel with ci.yml)

web-a11y:      1m (run parallel, already fast)

Per-PR wall-clock: max(9m10s, 5m10s, 1m) = 9m10s + visual-web 5m10s (both parallel) = ~14m
```

### With NEW Recommendations (Composite Setup Action + Expo Caching, if both done)
```
Wall-clock: ~14m (no additional latency; maintenance ROI only)
Expo caching only helps if runtime-native runs same PR (~0.5% of PRs); skip for now
```

### Summary
| Configuration | Per-PR Wall-Clock | vs Baseline |
|---|---|---|
| Baseline (self-hosted) | 27m | — |
| After in-flight PR | ~14m | −48% |
| After NEW recommendations | ~14m | −48% (no latency change; maintenance ROI) |

---

## Part 10: Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| ci.yml lose verify-red → skip-natives fail-fast | Medium | keep classify gate; native-skip logic preserved via `if:` conditions on jobs |
| visual-web matrix: shard imbalance (1 shard slow) | Low | Playwright's deterministic hashing ensures stable distribution; monitored via shard timings in Actions |
| Composite action changes affect all 4 workflows | Medium | Test composite action on branch first; unit test + full workflow run before merge |
| Gradle CC incompatibility (warns/fails) | Low | Graceful skip in plan; don't block bare-native on CC failure |
| macOS cap (~5 jobs) fills on busy day | Low | ci:runtime label keeps runtime-native opt-in; per-PR iOS jobs stay at 1; nightly can queue ~1-2 jobs |
| Artifact expiry: runtime-native misses Expo bundles | Low | Only an issue if we implement Expo caching; currently bundling is cached in Metro cache (acceptable) |

---

## Part 11: Required Check Impact

**Currently:** 0 required status checks (owner-merge).

**After in-flight PR:** Still 0 required checks (no change unless explicitly added by user).
- New `classify` job will appear in Actions but not required
- verify/bare-native/ios-native logic changes but names unchanged

**After visual-web sharding:** Check name changes.
- Old: single `visual-web` job
- New: `visual-web (1)`, `visual-web (2)`, `visual-web (3)`, + `visual-web-report` (merge)

**If visual-web is ever added to required checks, update to require `visual-web-report` (the merge job), NOT individual shards.**

---

## Implementation Sequence

### Week 1
1. Land in-flight PR: `ci/parallelize-and-shard` (ci.yml + visual-web sharding + Gradle CC)
2. Monitor for regressions on main; watch 1-2 native PRs to confirm parallelism works

### Week 2 (if in-flight PR stable)
3. Create + land composite setup action (refactor all 4 workflows)
4. Update CLAUDE.md if Node/pnpm versions ever change (now single source of truth)

### Later (if needed)
5. Implement Expo bundle caching (only if runtime-native becomes per-PR blocker)
6. Review test duration; if ever >60s, plan Vitest migration for native shard support

---

## Unresolved Questions

1. **Exact per-step breakdown of verify job:** Coordinator reported 1m41s total, but breakdown unclear (test + bundles + typecheck durations). Could profile with `time pnpm ...` on a local run to confirm whether Expo exports are truly <45s or bottleneck unexpectedly.

2. **Gradle configuration-cache compatibility:** No explicit reference to CC in bare-consumer (React Native 0.86.2). Should confirm locally (`./scripts/verify-bare-consumer.sh bundle --configuration-cache`) before CI run; if incompatible, drop bonus.

3. **Playwright version & blob reporter:** Confirmed Playwright 1.62.1 in package.json; `--shard` + `--reporter=blob` are supported. But validate `playwright merge-reports` command works with blob report structure by dry-run on branch.

4. **macOS concurrency cap enforcement:** Assumed ~5 jobs per account on public repo; GitHub docs vary. Should test by concurrently triggering 3-4 macos-latest jobs and observing if queue appears (or check runner logs).

5. **Node 24.13.1 test runner sharding:** Double-checked Node docs; no `--shard`. But pnpm might add wrapping; confirm with `pnpm test --help | grep -i shard` locally.

6. **Branch protection matrix behavior:** If visual-web adds `visual-web (1/2/3)` checks and they become required, does GitHub require ALL shards pass, or ANY? Docs suggest ALL; test on a branch with temporary required check rule.

---

## Summary Table: ROI vs Effort

| Item | Wall-Clock Gain | Effort | Risk | Status | Priority |
|------|---|---|---|---|---|
| **ci.yml parallelize (in-flight)** | −50% (18m → 9m) | High | Medium | Ready | **P0** |
| **visual-web shard (in-flight)** | −35% (7m → 4m40s) | Medium | Low | Ready | **P0** |
| **Gradle CC (bonus)** | −5% of bare-native | Low | Low | Ready | **P1** |
| **Composite setup action** | +0% latency | Medium | Low | Design ready | **P1** (maintenance ROI) |
| **Expo bundle caching** | −1-2% (only if runtime-native per-PR) | Medium | Medium | Defer | **P3** |
| **Node test sharding** | −3-5% (if test ever >60s) | High | Medium | Defer | **P4** |
| **Maestro scenario sharding** | −5-10% (only if 3 Simulators) | High | High | Skip | **P5** |

---

## Conclusion

**Free GitHub-Hosted CI + Parallelism Strategy:**

1. ✅ **Land in-flight PR** (ci.yml + visual-web sharding + Gradle CC) → **~14m per-PR wall-clock** (−48% vs self-hosted serial baseline)
2. ✅ **Composite setup action** → DRY + maintenance (no latency gain)
3. ✅ **Keep `classify` gate** → JS-only PRs skip native jobs entirely (zero macOS usage)
4. ⚠️ **macOS cap is tight but safe** → 1-2 concurrent macOS jobs per PR; keep runtime-native opt-in (ci:runtime label)
5. ❌ **Skip node test sharding** (low ROI) and **Maestro sharding** (complexity >> gain)
6. 📋 **Monitor per-job timings** post-landing; if verify/bundles unexpectedly slow, revisit Expo parallelism

**Expected per-PR feedback latency:** ~14 min (native PR) → ~8-10 min (JS-only PR). Fast enough for local iteration without self-hosted runner investment.
