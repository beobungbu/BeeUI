# Issue #179 (R5.1 benchmark harness) — implementation report

## Status: BLOCKED (branch-name/duplicate-work collision discovered pre-push)

## What was built

Full R5.1 benchmark harness implemented and self-tested in
`/Users/textsoft/workspace/beeui-wt-179` (branch `feat/179-benchmark-harness`,
base `main@d99f9dd`, local commit `1845d6e` — **not pushed**):

- `apps/benchmark/` — new Expo + Playwright app:
  - `src/harness/benchmark-harness.tsx` + `stats.ts` (+ `stats.test.ts`, 5
    passing unit tests) — warm-up/sample loop driving real React commits via
    `useLayoutEffect` timestamps, publishes to
    `window.__BEEUI_BENCHMARK_RESULT__`.
  - `src/scenarios/{types,registry,render-stress}.ts(x)` — scenario registry
    (extensibility point for R5.2–R5.7); smoke scenario compares real BeeUI
    `Button/Card/Text` against a hand-written RN+Uniwind baseline.
  - `runner/{run.mjs,metadata.mjs}` — Playwright-driven CLI: builds, serves,
    drives headless Chromium, collects OS/CPU/Node/git SHA/RN/React/
    Uniwind/Expo/browser metadata, writes JSON + Markdown summary.
  - `README.md` — Web methodology (implemented) vs. native methodology
    (documented-only, explicitly deferred — device access is CI/owner-gated).
  - `.github/workflows/benchmark.yml` — `workflow_dispatch`-only.
- Root `package.json`: added `bench:web` script, wired benchmark's test into
  root `pnpm test`.
- Verified locally: `pnpm hygiene:check`, full `pnpm typecheck` (all 7
  workspace projects, including `apps/benchmark`), full `pnpm test` (51 jest
  suites / 561 tests + 5 new benchmark unit tests + registry verify/test —
  all green), and an actual end-to-end run: built the Web bundle, launched
  Chromium, produced real `results/web-*.json` + `.summary.md` output.

## Why this is blocked, not done

`git push -u origin feat/179-benchmark-harness` was rejected
(non-fast-forward). Investigation:

- `gh issue view 179` still shows **OPEN**, and `main@d99f9dd` (my assigned
  base) has no benchmark harness — so being dispatched to build it looked
  correct from that angle.
- But **PR #289** (`feat(perf): reproducible cross-platform benchmark
  harness`, owner-authored, merged `2026-08-29T16:43:46Z`) already closes
  #179, on the identical branch name `feat/179-benchmark-harness`, with a
  different architecture: dependency-free `scripts/benchmark/` (pure Node
  CLI, in-process sampler — no Expo/Playwright/browser render), documented in
  `docs/benchmark-harness.md`, wired into root `test` via `bench:test`.
- PR #289's base was `integration/beeui-1.0-overnight-2026-08-29`; the
  corresponding integration-train PR **#288 is CLOSED (not merged)**, so that
  completed work never landed on `main` — which is why the issue still shows
  open and my dispatch onto `main@d99f9dd` didn't see it.
- Net: two independent implementations of #179 now exist under the same
  branch name — theirs already reviewed/merged into a stranded integration
  branch, mine complete and self-tested locally. I did not force-push,
  rename, or open a PR, since reconciling this is an orchestrator decision,
  not something to resolve unilaterally.

## Recommendation (for orchestrator)

One of:
1. Discard this worktree's implementation — treat #289 (already merged into
   the integration branch) as authoritative once that integration branch is
   revived/merged to `main`.
2. Revive/merge `integration/beeui-1.0-overnight-2026-08-29` (or cherry-pick
   `531ca32`) onto `main` directly to close #179 with the existing work.
3. If the Playwright/real-browser-render methodology in this worktree is
   preferred over the in-process Node sampler in #289, push this work to a
   **new** branch name (not `feat/179-benchmark-harness`) and open it as an
   alternative/superseding candidate PR for explicit comparison.

No destructive git action was taken; nothing was pushed; remote branch/PR
#289 is untouched.

## Files (local only, not pushed)

- `/Users/textsoft/workspace/beeui-wt-179/apps/benchmark/**`
- `/Users/textsoft/workspace/beeui-wt-179/.github/workflows/benchmark.yml`
- `/Users/textsoft/workspace/beeui-wt-179/package.json`, `.gitignore`,
  `pnpm-lock.yaml` (diffs)
- Local commit: `1845d6e` on branch `feat/179-benchmark-harness`, base
  `d99f9dd`

```
Status: BLOCKED
Summary: Built and self-tested a complete alternate #179 harness (all green locally), but discovered PR #289 already implemented and merged #179 under the same branch name into an unmerged integration branch (#288 closed) — stopped before push/PR to avoid clobbering existing merged work; needs orchestrator decision on reconciliation.
Concerns/Blockers: Two divergent #179 implementations exist (mine: apps/benchmark, Playwright/browser-rendered; theirs, PR #289: scripts/benchmark, dependency-free in-process sampler, merged into integration/beeui-1.0-overnight-2026-08-29 which is itself unmerged to main). Need explicit instruction: discard my branch, rename it for a second candidate, or revive/merge the integration branch instead.
```
