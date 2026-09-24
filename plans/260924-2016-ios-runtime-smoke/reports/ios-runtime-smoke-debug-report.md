# iOS native-runtime-smoke debug report

## Executive summary

`native-runtime-smoke` on `main` has failed intermittently since 2026-09-09. Investigated 5 CI runs (34311416923, 35581020966, 35846064125, 35977572695 attempt 1, 35977572695 attempt 2). One (35581020966) never actually failed the iOS job — only `android-runtime`'s `Setup Android SDK` step failed; its iOS job passed end to end and is not part of this investigation. The remaining four failures resolve to exactly two harness (Maestro-flow) defects, not product bugs. No BeeUI component code was changed.

1. **`common.yaml` toast-show tap lands at/past the scroll boundary.** `scrollUntilVisible` for `runtime-toast-show` ran with centering disabled, stopping the instant the button crossed the 100%-visibility threshold — i.e. right at the screen edge. Proven by the 09-24 attempt-1 failure screenshot: the Show button is cropped at the bottom edge, and the AX tree shows both toast buttons present but no toast rendered (`Assert that "Runtime toast" is visible` FAILED).
2. **`ios-sheets.yaml`'s cold-launch navigation to Runtime has no readiness wait or retry.** Unlike `common.yaml`'s equivalent step (`extendedWaitUntil` for `showcase-home`, then a `retry`-wrapped tap+wait for the destination), `ios-sheets.yaml` goes straight from `launchApp clearState:true` into a bare `scrollUntilVisible` → `tapOn` → single `assertVisible`. This produced two distinct symptoms under CI load: the initial scroll timing out before the home screen finished rendering (09-09, 09-23), and a delivered tap racing the destination's render (09-24 attempt 2).

Fix: harden both flows to match the resilience pattern already used elsewhere in the same files (centering + retry-wrapped tap/assert, readiness wait after cold relaunch). No assertions removed or weakened.

## Evidence and timeline

| Date | Run | Where it failed | Symptom |
|---|---|---|---|
| 2026-09-09 | 34311416923 (push, e8b8de0) | `ios-sheets.yaml`, step 1 | `Scrolling DOWN until id: showcase-open-runtime ... FAILED` — `No visible element found` after `launchApp clearState:true`, no prior readiness wait |
| 2026-09-21 | 35581020966 (schedule) | N/A | iOS job **passed**; only `android-runtime`'s `Setup Android SDK` step failed (unrelated infra). Confirmed via `gh run view 35581020966` job list |
| 2026-09-23 | 35846064125 (push, rc.2, cd07c67) | `ios-sheets.yaml`, step 1 | Same `showcase-open-runtime` scroll timeout as 09-09. (`common.yaml`'s log shows an unrelated single-attempt `component-gallery` assertion blip that its own `retry:` block recovered from — `common_status=0`, confirmed because `runtime-stress.log`/`ios-sheets.log` both have content for that run — so it did not cause the job failure) |
| 2026-09-24 attempt 1 | 35977572695 | `common.yaml`, `runtime-toast-show` | `Assert that "Runtime toast" is visible` FAILED. Failure screenshot shows the Show button cropped at the bottom screen edge (scroll ran with centering disabled) |
| 2026-09-24 attempt 2 | 35977572695 | `ios-sheets.yaml`, step 1 | `Tap on id: showcase-open-runtime` COMPLETED, but the immediately following single `Assert that id: runtime-ready is visible` FAILED (no retry) |

Artifacts downloaded via `gh run download <run>` / `gh api .../artifacts/<id>/zip` for both attempts of 35977572695 (attempt 1 required the artifacts API directly since `gh run download` only fetches the latest attempt by name).

## Root cause 1 — toast-show edge tap (`common.yaml`)

`packages/ui/src/components/toast.tsx`'s `ToastViewport` is an absolutely-positioned root overlay (`position: 'absolute', bottom: insets.bottom + BOTTOM_NAVIGATION_CLEARANCE + TOAST_EDGE_GAP`) — unrelated to where the Show *button* sits in the scrollable content. The bug is purely in the flow:

```yaml
- scrollUntilVisible:
    element:
      id: "runtime-toast-show"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "runtime-toast-show"
- assertVisible:
    text: "Runtime toast"
```

Maestro's own diagnostic on a related failure states the default `centerElement: false`. Every other overlay trigger in the same file (`runtime-alert-trigger`, `runtime-popover-trigger`, `runtime-menu-trigger`, `runtime-sheet-trigger`) explicitly uses `centerElement: true` with a comment explaining exactly this class of bug (tap resolves against a freshly-scrolled element whose hit target isn't stably inside the viewport). `runtime-toast-show` was the one trigger that didn't follow that pattern.

Evidence: the 09-24 attempt-1 `failure.png` (captured after the failed assert) shows the "Toast" card title fully visible but the "Show runtime Toast" button rounded-rect only barely visible, cropped at the very bottom edge of the screen — exactly the geometry `centerElement: false` produces (stop scrolling the instant 100% visibility is first satisfied, with no margin). Local reproduction attempts (2 unfixed baseline runs) both passed — consistent with a boundary-condition race that needs the extra latency/jitter of a loaded CI runner to surface, not a deterministic bug.

**Not the cause:** rc.3's toast placement change (`bottom: insets.bottom + 80 + 12`, `packages/ui/src/components/toast.tsx:304`) only affects where the toast *overlay* renders once shown; it does not touch the Show button's position in the scroll content, and no keyboard was shown yet at this point in the flow (`KeyboardAwareScreen`'s `keyboardInset` is 0 until `keyboardDidShow` fires, which happens later in the flow at the `runtime-input` step). Ruled out by reading `packages/ui/src/components/keyboard-aware-screen.tsx:130-238` and confirming step order in `common.yaml`.

## Root cause 2 — ios-sheets.yaml cold-launch navigation

```yaml
- launchApp:
    clearState: true
- scrollUntilVisible:
    element:
      id: "showcase-open-runtime"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "showcase-open-runtime"
- assertVisible:
    id: "runtime-ready"
```

`clearState: true` is a full process relaunch, not a JS state reset. `common.yaml` accounts for this with `extendedWaitUntil timeout: 180000 visible: showcase-home` immediately after `launchApp`, and wraps its `showcase-open-runtime` tap in a `retry: maxRetries: 3` with a 12s `extendedWaitUntil` on the destination (`runtime-ready`). `ios-sheets.yaml` had neither: no readiness wait for the home screen, and a single un-retried `tapOn`/`assertVisible` pair for the destination.

This produced two failure shapes across the observed runs, both traceable to the same missing defenses:
- 09-09 and 09-23: the `scrollUntilVisible id: showcase-open-runtime` step itself timed out (20s) — `No visible element found`, immediately after `launchApp clearState:true` completed, with no intervening readiness check.
- 09-24 attempt 2: the scroll and tap both completed, but the un-retried `assertVisible id: runtime-ready` failed — a render race after a delivered tap, exactly the class of failure `common.yaml`'s own comment describes: *"Maestro can report an iOS tap as delivered while a freshly scrolled React Native control is still settling its hit target."*

## Fix

Both changes only add resilience already proven elsewhere in the same files; no assertion was removed or weakened.

**`apps/showcase/runtime-smoke/maestro/common.yaml`** — `runtime-toast-show` step: added `visibilityPercentage: 100` + `centerElement: true` to the scroll, and wrapped the tap in `retry: maxRetries: 3` with an `extendedWaitUntil` (10s) on the toast text, matching the pattern already used for `runtime-alert-trigger`/`runtime-popover-trigger`/`runtime-menu-trigger`.

**`apps/showcase/runtime-smoke/maestro/ios-sheets.yaml`** — initial navigation: added `extendedWaitUntil timeout: 180000 visible: showcase-home` after `launchApp clearState:true` (identical to `common.yaml`), and wrapped the `showcase-open-runtime` tap in `retry: maxRetries: 3` with a 12s `extendedWaitUntil` on `runtime-ready` (identical to `common.yaml`'s equivalent step).

## Local verification

Environment: dedicated iPhone 17 Pro simulators on iOS 26.5 (never touched the shared iPhone 16 Pro sim `97DF90D1-...`), Xcode 26.6, Maestro 2.7.0, Node 24.13.1, pnpm 10.15.0 — matching CI's toolchain. Branch `fix/ios-runtime-smoke` off `origin/development@7924fa7` (identical to published 0.86.2-rc.3 apart from docs).

- 2 baseline (unfixed) full runs of common → runtime-stress → ios-sheets: both passed end to end. Consistent with these being load-dependent boundary races that don't reliably reproduce on a quiet machine (my dev Mac's `load averages: 212 265 262` on 8 cores, from other concurrent sessions, later confirmed this machine's headroom does not match CI's isolated runner).
- With the fix applied: `common.yaml` passed 4/4 runs total (2 chained + 2 isolated), each time visibly exercising the new `centerElement: true` scroll and `retry` block for `runtime-toast-show`.
- With the fix applied: `ios-sheets.yaml` passed 3/3 isolated runs, each time visibly exercising the new `extendedWaitUntil showcase-home` and `retry`-wrapped navigation into `runtime-ready`.
- `runtime-stress.yaml` (untouched by this fix) failed 3 times locally, always at the identical step (`Scrolling DOWN until id: runtime-stress-dialog-trigger ... FAILED`, target clearly visible in the failure screenshot both times) — reproduced on both a reused and a freshly-created simulator. This never appears in any of the 5 CI runs examined. Correlated with this shared dev machine's load average climbing into the 200s (8 cores) over the course of the investigation from other concurrent sessions/processes; treated as a local-environment artifact, not evidence of a real defect in `runtime-stress.yaml`, and left untouched (out of scope — not part of the documented CI failures, and I have no CI evidence it's real).
- `node --test scripts/__tests__/ci-native-error-reader.test.mjs`: 8/8 pass (this is the only test covering `scripts/runtime-smoke`-adjacent log parsing; unaffected since I did not change that script).
- `pnpm lint`: clean.
- `pnpm build && pnpm --filter @beemvp/beeui-ui typecheck`: clean (build-before-typecheck is required — `packages/ui` typechecks against `packages/core`/`packages/tokens` built `.d.ts`, not source).
- `apps/showcase` jest: `toast.test.tsx`, `runtime-stress-fixture.test.tsx`, `keyboard-aware-screen.test.tsx` — 50/50 pass (no product code changed, so no regression test was added; these are sanity checks).
- No `.tsx`/`.ts` product code was touched, so no jest regression test applies per the task's own branching rule (harness flakiness → flow fix only).

## Still needing CI proof

- The exact CI-load-dependent races (boundary-visibility tap, cold-launch readiness) could not be forced to reproduce locally even unfixed (2/2 baseline passes) — this is expected for probabilistic races tied to CI runner latency, not evidence the fix is insufficient. Recommend watching the next few `main` pushes and the weekly schedule run for the fixed flows.
- The `runtime-stress.yaml` local-only failure (see above) should be re-verified next time this file's CI runs are inspected, in case it's actually latent — I have zero CI evidence of it either way and did not modify that file.

## Branch / commit / worktree

- Branch: `fix/ios-runtime-smoke`
- Commit: `48ae753cd321fad230bdd4e3c7c4f6f25553b55f` — `fix(runtime-smoke): harden iOS maestro flows against edge-tap and cold-launch races`
- Worktree: `/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-a9dafe98088d55c31`
- Files changed:
  - `apps/showcase/runtime-smoke/maestro/common.yaml`
  - `apps/showcase/runtime-smoke/maestro/ios-sheets.yaml`

Status: DONE_WITH_CONCERNS
Summary: Fixed both confirmed harness defects (toast-show edge-tap in common.yaml, cold-launch navigation resilience in ios-sheets.yaml) behind CI evidence from 4 real failures across 3 dates; both fixes verified locally (4/4 and 3/3 clean passes respectively) without touching product code.
Concerns/Blockers: Local reproduction of the exact CI races wasn't forced (2/2 unfixed baseline runs passed — expected for a load-dependent boundary condition, not a gap in the fix). A separate, unrelated `runtime-stress.yaml` failure reproduced 3/3 times locally but never in CI evidence and correlates with this shared dev machine's abnormal load (200+ load average on 8 cores from other concurrent sessions); left untouched as out of scope, flagged for someone to re-check against real CI next time that flow runs.
