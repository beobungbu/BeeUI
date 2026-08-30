# CI speedup — parallelize ci.yml native chain + shard visual-web

Owner-authorized 2026-08-30. Land as ONE follow-up PR off `main` AFTER #329 (github-hosted
migration + visual guard retirement) merges. Repo public → github-hosted runners free + parallel.

## Goal
1. ci.yml: break the serial `verify → bare-native → ios-native` (~18m38s) into 3 parallel jobs
   behind a fast `classify` gate → ~9–11m (−45-50%), while KEEPING change-based native-skipping.
2. visual-web: shard the Playwright suite across 3 runners → ~7m10s → ~4m40s (−35%).
3. Bonus: Gradle configuration-cache for bare-native.

## Part A — ci.yml parallelization
Current graph (self-hosted-era serialization):
- `verify` (no needs) computes classification outputs + builds iOS prebuild artifact `ios-prebuild-<run_id>`.
- `bare-native` needs [verify], `if:` verify.outputs.{package-boundary,bare-native}-required.
- `ios-native` needs [verify, **bare-native**], `if:` verify.outputs.ios-native-required &&
  (package-boundary||bare-native); DOWNLOADS verify's ios-prebuild artifact.

Redesign:
1. New job `classify` (ubuntu-latest, ~15s): checkout (fetch-depth 0) + Node + run
   `scripts/classify-ci-changes.mjs` (the same BEEUI_BASE_SHA/HEAD_SHA + BEEUI_FORCE_NATIVE logic
   currently in verify's `native-changes` step). Expose outputs: ios-native, package-boundary,
   bare-native, showcase-native (+ reason aliases). No install/build — classification only.
2. `verify`: `needs: [classify]`; drop its own `native-changes` classification step (moved to classify);
   reference `needs.classify.outputs.*` where it used `steps.native-changes.outputs.*`. REMOVE the
   "Generate native projects with Expo Prebuild" + "Upload generated iOS project source" steps
   (ios-native self-prebuilds now). Keep install/tokens/typecheck/test/release-verify/bundles.
3. `bare-native`: `needs: [classify]`; `if:` uses `needs.classify.outputs.*`. Runs parallel to verify.
4. `ios-native`: `needs: [classify]` (DROP bare-native + verify deps); `if:` uses
   `needs.classify.outputs.*`. REPLACE "Download generated iOS project source" with an own
   `expo prebuild --clean --no-install` step (working-directory apps/showcase, EXPO_NO_GIT_STATUS=1),
   same as verify used to do. Everything downstream (pod install, xcodebuild) unchanged.
5. Keep the fork-guard `if:` prefix on every job (`github.event_name != 'pull_request' || head.repo==repo`).
   Keep least-privilege `permissions: contents: read`. Keep concurrency group.

Trade-off (accepted): lose verify-red→skip-natives fail-fast; native-skipping via classify preserved.

Check-name impact: new `classify` check + unchanged verify/bare-native/ios-native names. Branch
protection currently has NO required status checks (0-approval owner-merge), so no gate breakage —
but note it in the PR.

## Part B — visual-web sharding (from researcher report 260830-1925)
- Matrix `strategy: { fail-fast: false, matrix: { shard: [1,2,3] } }` on the test job.
- Test step: `pnpm --dir apps/visual-regression test --shard=${{ matrix.shard }}/3 --reporter=blob`.
- Upload each shard's blob report as artifact `blob-${{ matrix.shard }}` (if: always()).
- New dependent `visual-web-report` job: download all blob artifacts, `playwright merge-reports
  --reporter=html`, upload combined HTML. This becomes the human-facing result check.
- Preserve pnpm-store + `~/.cache/ms-playwright` caches + fork-guard + permissions on each shard.
- Sharding does NOT touch baselines or maxDiffPixelRatio — snapshots identical per shard.

## Part C — Gradle configuration-cache (bonus)
- bare-native gradle invocation: add `--configuration-cache` (or `org.gradle.configuration-cache=true`
  in gradle.properties for the bare consumer). Verify the build is CC-compatible; if it warns/fails,
  drop it (don't block the PR on it). Keep the existing `~/.gradle/caches`+`wrapper` actions/cache.

## Acceptance
- ci.yml: on a native PR, classify→(verify∥bare-native∥ios-native) visible as parallel in Actions;
  wall-clock materially < 18m. On a JS-only PR, bare-native+ios-native still SKIP.
- visual-web: 3 shards run parallel; `visual-web-report` merges to one HTML; all 278 tests covered
  (sum of shard counts == total); green.
- No baseline diffs; no threshold change. `pnpm typecheck` + local `node --test` for any changed
  scripts green. tsc clean.

## Sequencing / isolation
- ONE branch `ci/parallelize-and-shard` off `main` AFTER #329 merges. One worktree. One PR.
- Do not touch runtime-native.yml / web-a11y.yml (short, setup-bound — sharding won't help).

## Phase 2 — follow-up AFTER this PR merges (from comprehensive research
## report `plans/reports/researcher-260830-1956-comprehensive-ci-optimization-freeci-report.md`)
Research confirms this PR is the primary win (per-PR ~27m→~14m native / ~8-10m JS-only). Only ONE
further item has clear value; deeper sharding is low-ROI (native builds are single compiles that
can't shard; unit suite <30s; Node 24 has no native --shard; Maestro is opt-in).
- **P1 — composite setup action** `.github/actions/setup-beeui`: DRY the duplicated
  checkout+setup-node+corepack+pnpm-store-cache+install block across all 4 workflows into one
  composite action (single source for NODE_VERSION/PNPM_VERSION + cache keys). Maintenance/drift
  win, not wall-clock. MUST land after this PR (same files). Verify all 4 workflows still green.
- **Deferred (low ROI, do NOT do unless a metric changes):** Expo bundle caching (~1-2%, only if
  runtime-native goes per-PR); Node unit-test sharding (skip); Maestro scenario sharding (opt-in,
  macOS cap tight). Native-build acceleration beyond Gradle CC (ccache/warm DerivedData) — revisit
  only if the iOS/Android build time is measured as the dominant PR-latency complaint.
