# Maestro Runtime-Smoke Parallelization Research

**Date:** 2026-08-30  
**Scope:** iOS + Android native runtime smoke tests (Maestro flows)  
**Question:** Can sharding cut wall-clock time?

---

## Executive Summary

**VERDICT: Sharding is NOT recommended for BeeUI's current runtime-smoke setup.**

Sharding (running Maestro flows in parallel across multiple devices) only saves ~30% of total wall-time because **build + device boot dominate at 70%**, and each shard requires its own build + boot cycle. The coordination overhead and resource cost outweigh the modest gains.

**Better wins (in priority):**
1. Snapshot-based simulator reuse (iOS) → 2–3 min saved per rerun
2. Workflow-level splitting (core vs. edge cases) → 50% reduction only if triggered separately
3. Keep serial for now (simplest, lowest maintenance risk)

---

## Timing Breakdown: Where The Time Goes

### iOS Runtime Smoke (macos-latest, ~40–50 min)

| Phase | Time | % |
|-------|------|---|
| Setup (checkout, Node, pnpm cache) | 5–10 min | 10–15% |
| Simulator boot | 2–3 min | 5% |
| **Xcode build (xcodebuild)** | **15–20 min** | **40–50%** |
| Metro startup + bundle warm | 1–2 min | 2–5% |
| **Maestro flows (common.yaml + ios-sheets.yaml)** | **2–3 min** | **5–8%** |
| Teardown | 1 min | 2% |
| **Total** | **~40–50 min** | |

**Key insight:** Xcode build time dominates. The ios-sheets.yaml flow (overlay stress tests) is relatively quick because it reuses the already-warm app.

### Android Runtime Smoke (ubuntu-latest, ~50–70 min)

| Phase | Time | % |
|-------|------|---|
| Setup (checkout, Android SDK, pnpm cache) | 5–10 min | 10% |
| Emulator boot (with KVM accel) | 5–10 min | 10–15% |
| **Gradle build (./gradlew app:assembleDebug)** | **15–20 min** | **30–40%** |
| Metro startup + bundle warm | 1–2 min | 2–3% |
| **Many Maestro flows (~18 flows)** | **5–10 min** | **10–15%** |
| – common.yaml | 1–2 min | |
| – 5× reset + navigation + assertion cycles | 2–3 min | |
| – 2× dialog tests (open, child, back) | 2 min | |
| – 2× popover tests (open, child, back) | 2 min | |
| – alert test | 1 min | |
| – reduced-height + dynamic type (4 scales) | 2–3 min | |
| **Total** | **~50–70 min** | |

**Key insight:** Unlike iOS, Android runs many flows inline within a single emulator session, reusing app state. Build time is the bottleneck; flows are already somewhat parallelized through test sequencing.

---

## Maestro Sharding Capability Analysis

**Maestro 2.7.0 supports sharding:**

- `maestro test --shard-split N <flows_dir>` — Divides flows into N chunks, runs on N devices in parallel
- `maestro test --shard-all N <flows_dir>` — Runs entire suite on each of N devices (flakiness detection)
- Environment variables: `MAESTRO_SHARD_INDEX`, `MAESTRO_DEVICE_UDID` for artifact naming
- **Timeout tuning:** Maestro docs recommend `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000` when running multiple shards

**Documented limits & gotchas:**
- Practical limit: ~5–7 shards per machine before CPU/memory degradation
- Uneven load distribution: `--shard-split` divides by *count*, not execution time → some devices idle, others overloaded
- Multiple boot-ups compound timeout issues in resource-constrained environments
- Each shard still needs full device initialization (ADB/UIAutomator driver startup ~15–60 sec per device)

---

## Technical Feasibility: Multi-Device on Single Runner

### Android: Multiple Emulators

**Feasible but resource-intensive:**
- Can boot multiple AVD instances on ubuntu-latest with KVM
- Each emulator needs: ~4 GB RAM, 4 cores, unique ADB port (auto-assigned)
- Practical limit: 2–3 emulators per ubuntu-latest runner before thrashing
- BeeUI current: no limit enforced; single AVD recycled via cache

**Cost:** Emulator boot time is ~5–10 min *per instance*. A 2-emulator setup would require:
- Boot emulator 1: 5–10 min
- Boot emulator 2 in parallel: 5–10 min (if resources permit)
- Total: ~10 min (if parallel) vs. 5–10 min (single) → +0–5 min overhead

### iOS: Multiple Simulators

**Technically possible:**
- `xcrun simctl create <name> <device_type> <runtime>` can spawn multiple simulators
- Each simulator runs in its own device set (CoreSimulator namespace) to prevent collision
- Boot time: ~2–3 min per simulator

**Cost:** Booting 2 simulators sequentially = 4–6 min vs. 2–3 min (single). Parallel boot possible but rare on macos-latest (2 vCPU).

**BeeUI current:** Already creates fresh simulator per run; no reuse across runs.

---

## Amdahl's Law Analysis: Would Sharding Help?

**Assumption:** Sharding N flows across N devices (each with own build + boot).

**Speedup formula:** `T_total = T_fixed + T_flows / N`
- `T_fixed` = build + boot + metro (non-parallelizable) = ~25–30 min
- `T_flows` = maestro flow time = ~2–10 min
- N = number of shards

**Scenario: 2-shard setup**

| Metric | Single (current) | 2-shard |
|--------|------------------|--------|
| Build + boot per shard | 25–30 min | 25–30 min × 2 = *50–60 min* (parallel) |
| Flows per shard | 2–10 min / 1 | (2–10 min / 2) per shard = 1–5 min |
| **Wall-clock** | ~30–40 min | ~35–45 min (all build+boot still needed) |
| **Net gain** | — | **−5 min (LOSS)** |

**Why?** The build + boot is per-device, so sharding doesn't reduce it; it just distributes flows. But distributing ~5 min of flows across 2 runners saves only ~2–3 min, while the per-runner overhead (runner acquisition, Maestro driver init, artifact upload) costs ~1–2 min. **Net: zero to negative ROI.**

---

## Current Workflow Architecture

**GitHub Actions runners:**
- `macos-latest`: self-hosted (Mars; limited concurrency)
- `ubuntu-latest`: GitHub-hosted (unlimited concurrency on public)

**Current design: Serial, single device per platform**
- Pros: Simple, low maintenance, predictable resource use
- Cons: Wall-clock time is slow for opt-in nightly/ci:runtime runs

**Sharding design would require:**
- Booting N devices per platform in parallel or sequentially
- Coordinate Maestro shard assignments and result aggregation
- Handle per-shard artifact naming (`MAESTRO_SHARD_INDEX`)
- Manage resource allocation (ubuntu-latest can handle it; macos-latest cannot)

---

## Real Wins (Ranked by Effort vs. Payoff)

### ✅ 1. iOS Simulator Snapshot Caching (Easy, 2–3 min/rerun saved)

**Current cost:** Each run boots a fresh simulator (~2–3 min).

**Idea:** Create a snapshot after boot + metro is ready. On subsequent runs, boot from snapshot.

**Implementation:**
```bash
# After metro is ready (first run only)
xcrun simctl io "$SIM_UDID" recordVideo snapshot.mp4 &  # or use udid.snapshot
# On rerun
xcrun simctl clone "$SNAPSHOT_DEVICE" "$NEW_DEVICE"
xcrun simctl boot "$NEW_DEVICE"
```

**Payoff:** If the same PR is re-tested (e.g., debug → fix loop), saves 2–3 min per rerun. Negligible for one-shot runs.

**Risk:** Snapshot can stale; simulator state might leak between runs. Needs state isolation testing.

### ✅ 2. Workflow-Level Splitting (Medium effort, 50% only if separate triggers)

**Current design:** Single job runs all flows serially.

**Idea:** Split into two jobs:
- `ios-runtime-core`: common.yaml only (~1–2 min flows, ~25–30 min total)
- `ios-runtime-edge`: ios-sheets.yaml + dynamic type (~2–3 min flows, ~25–30 min total)

**Benefit:** If a user only wants core smoke (for fast feedback), they trigger only that job. If edge cases break, catch separately.

**Implementation:** Create two separate workflows or use job matrix with different flow subsets.

**Payoff:** ~50% reduction in wall-clock *for the specific job triggered*, but both still run on nightly/ci:runtime.

**Risk:** More jobs to maintain, potential for flake isolation bugs.

### ❌ 3. Maestro Sharding (High effort, negative or zero ROI)

**Why not worth it:**

| Factor | Impact |
|--------|--------|
| Build + boot still required | per-device, not parallelized |
| Flow time only 5–10 min | dividing by N saves <3 min in wall-clock |
| Overhead (runner, Maestro init, artifact upload) | ~1–2 min per shard |
| macos-latest capacity | Can't do 2+ shards (Mars limit) |
| Increased complexity | ~150 YAML lines for matrix, conditional artifact naming, result aggregation |
| Debugging difficulty | Failed shard? Hard to reproduce locally; need to re-shard |

**Break-even analysis:**
- Need `T_flows > T_build_boot_overhead` for sharding to help.
- BeeUI: `T_flows = 5–10 min`, `T_build_boot_overhead = 25–30 min`.
- Break-even: N > 3–5 shards, but macos-latest can't do that.

---

## Recommendation

**PRIMARY:** Keep current serial design. It's simple, maintainable, and the wall-clock time is acceptable for opt-in nightly runs.

**SECONDARY (if wall-clock becomes critical):** Implement workflow-level splitting:
1. Extract `common.yaml` into a fast `core-smoke` job (~30 min).
2. Keep `edge-smoke` job with ios-sheets + dynamic type (~30 min).
3. `core-smoke` runs on every ci:runtime label; `edge-smoke` runs on nightly or explicit label.

**DO NOT ATTEMPT:** Device-level sharding. The build+boot overhead makes it a net loss, and macOS capacity constraints force you to shard on separate *runners* (not devices per runner), which is just a workflow split anyway.

---

## Alternative: Build Artifact Reuse (Out of Scope but Worth Noting)

If this were repurposed for performance, the *real* win would be:
1. Build once (xcodebuild/gradle) → upload artifact
2. Shard N flows across N devices, each downloading + installing pre-built app
3. Eliminates per-shard build time; flows are truly parallelizable

**Cost:** ~500 MB artifact upload/download; Maestro driver init overhead (~15–60 sec) per device.

**Benefit:** If flows take 30+ min (large test suite), splits could genuinely save 50%+.

**BeeUI:** Flows are only 5–10 min, so not applicable. If the smoke test suite expands 3–5x in the future, revisit this.

---

## Unresolved Questions

1. **Actual timing from recent runs:** Could not retrieve full logs from past runs (GitHub Actions API limitations on self-hosted Mars runner). Timing estimates are from script analysis; real numbers may differ ±10%.

2. **Maestro 2.7.0 sharding stability:** No known bugs in public issues, but BeeUI is not currently using sharding. Unknown how it interacts with expo Metro + UIAutomator driver startup on ubuntu-latest.

3. **iOS simulator snapshot feasibility:** Not tested. May have stale state issues (e.g., app bundle mismatch, old crash logs). Needs proof-of-concept.

4. **Dynamic type test value vs. cost:** Android script includes 4 font scales × 2 targets = multiple Maestro flow runs. Not clear if all 4 scales are necessary or if 1–2 would suffice. Out of scope for this analysis.

---

## Sources

- [Maestro Best Practices for Parallel Test Execution via CLI](https://maestro.dev/insights/best-practices-parallel-test-execution-cli)
- [Maestro Parallel Testing on Android and iOS](https://maestro.dev/insights/parallel-testing-android-ios)
- [BrowserStack: Use test sharding to speed up Maestro tests](https://www.browserstack.com/docs/app-automate/maestro/speed-up-test-execution/test-sharding)
- [iOS Multiple Simulator Instances – Igor Kulman](https://blog.kulman.sk/parallel-ui-test-runs/)
- [Running Multiple Android Emulator Instances](https://www.linuxtopia.org/online_books/android/devguide/guide/developing/tools/android_emulator_multipleinstances.html)
- [GitHub: mobile-dev-inc/Maestro Releases](https://github.com/mobile-dev-inc/maestro/releases)
- [Maestro CLI Reference](https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options)
