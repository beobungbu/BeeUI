# BeeUI benchmark harness

Reproducible performance measurement infrastructure for BeeUI (roadmap R5.1,
issue #179). This document is the methodology of record; the code lives under
`scripts/benchmark/`.

The harness is infrastructure, not a set of final numbers. Per `docs/roadmap.md`
it "may start early, but measurements wait for the surfaces being measured"
(#180–#186). Its job is to make future measurements comparable, honest and
callable both locally and in CI.

## What it produces

Each run emits two outputs from one result set:

- **Machine-readable JSON** written to `.artifacts/benchmark/<platform>-<sha>.json`
  (the `.artifacts/` directory is gitignored). This is the stable, full-precision
  record for trend and regression tracking.
- **Human-readable summary** printed to stdout: environment provenance plus a
  per-scenario table with median, p95, coefficient of variation, and budget
  status.

The JSON envelope is versioned (`schemaVersion`) and validated before it is
written, so a malformed result fails loudly instead of corrupting a history
series.

## Running it

```bash
pnpm bench:web              # run the Web lane
pnpm bench:native           # run the native lane (deferred off-device, see below)
pnpm bench -- --list        # list registered scenarios
pnpm bench -- --platform web --scenario web/variant-class-resolution
pnpm bench -- --platform web --samples 100 --warmup 30   # override sampling
pnpm bench:test             # run the harness unit tests
```

The CLI exits non-zero when a budgeted scenario is over budget (a regression
gate), unless `--no-fail` is passed.

## Environment metadata

Every result set records the environment it was produced on: timestamp,
platform lane, CI flag, Node/V8 runtime, OS/CPU/arch/memory, React Native
version, and git SHA/branch/dirty state. Native device/build and Web browser
fields are populated only when a runner can actually observe them; otherwise
they are `null` rather than guessed.

## Warm-up and sampling strategy

Sampling is deterministic in structure (see `scripts/benchmark/lib/sampler.mjs`):

1. **Warm-up.** `warmup` samples are executed and discarded so the JIT, inline
   caches and lazy allocation reach steady state before anything is recorded.
2. **Measured samples.** `samples` measured samples are taken. Each sample times
   `iterations` calls of the workload and records the *per-operation* duration,
   so fast operations are batched into a measurable window instead of fighting
   clock granularity.
3. **Statistics.** From the per-op durations the harness computes count, mean,
   median, min, max, sample standard deviation (Bessel-corrected), coefficient
   of variation, p95 and p99. Percentiles use the linear (type-7) method.

The **coefficient of variation** is the primary determinism indicator: a high CV
means the host produced a noisy signal for that scenario and the median should be
treated with caution. Trend/regression consumers should compare medians on
low-CV runs and prefer the same class of machine (ideally the CI runner) across
data points.

## Web vs native methodology (kept separate on purpose)

Web and native are separate lanes; one invocation runs one lane and writes one
coherent result set. They are never conflated into a single number.

- **Web.** The workload runs in-process on this host through the sampler and is
  measured directly. Node-hosted Web samples have no browser, so `browser` is
  `null`; a browser-driven runner may supply it. This is *deterministic-contract*
  / self-hosted evidence — not browser-interaction or native evidence.
- **Native.** Real native timings can only come from an on-device app runner
  (iOS Simulator / Android Emulator / device). Off-device — a local dev box or a
  JS-only CI job — there is no honest number to report, so the runner returns a
  **`deferred`** result: it captures metadata and states why, and never
  fabricates device timings. When an on-device runner is supplied (on-device CI,
  or a native scenario under #180+), the same code path produces a `measured`
  result from the samples that runner returns.

This matches `docs/beeui-1.0-evidence-classes.md`: always state the strongest
evidence class actually obtained. A deferred native result is not a native-runtime
measurement.

## Overhead vs a baseline (not cross-framework marketing)

A scenario may declare an optional `baseline` workload alongside its `candidate`.
Both run on the same host in the same run, and the harness reports
`overheadRatio = candidate.median / baseline.median`. The baseline is a
*controlled reference for the same output* (for example, two implementations of
the same className resolution), not a rival framework. The harness intentionally
does not compare unrelated framework architectures, which would be marketing
rather than a regression signal.

An optional `budget.maxOverheadRatio` turns a scenario into a regression gate.

## Registering scenarios (how R5.2–R5.7 plug in)

Scenarios are data, not new scripts. Each scenario is defined with
`defineScenario(...)` and registered. R5.2–R5.7 (#180–#186) add a scenario module
and list it in `scripts/benchmark/scenarios/index.mjs`; the registry, sampler,
statistics and reporters handle it with no bespoke per-scenario runner.

```js
import { defineScenario } from '../../lib/registry.mjs';

export default defineScenario({
  id: 'web/my-scenario',          // unique, kebab/slash-case
  title: 'Human readable title',
  platform: 'web',                // 'web' | 'native'
  warmup: 20,
  samples: 40,
  iterations: 50,
  unit: 'ms/op',
  candidate: { label: 'beeui', run: () => doWork() },
  baseline: { label: 'baseline', run: () => doBaseline() }, // optional
  budget: { maxOverheadRatio: 1.25 },                       // optional gate
});
```

The registry rejects duplicate ids and lists scenarios in a deterministic order,
so shared result sets are stable across runs.

## Reference scenarios shipped with the harness

- `web/variant-class-resolution` — a self-contained Web workload that resolves
  component variant/size/state to className strings for a 200-row list. It exists
  to prove the Web sampling mechanics end-to-end and to demonstrate the
  candidate-vs-baseline methodology. It is **not** an authoritative BeeUI
  performance claim; real component scenarios arrive with #180+.
- `native/list-render` — the native path, registered and callable but deferred
  off-device. It documents the workload an on-device runner would drive and
  proves the native path is structured and honest without fabricating numbers.
- `web/table-render-100` / `web/table-render-500` (issue #168, R4E.5) — the
  first real per-component scenario: Table's actual per-row/per-cell Web hot
  path (`cn()` className resolution, the column-label registry, sort-glyph
  lookup) at the accepted 100-row/500-row scale envelope
  (`docs/decisions/007-table-datatable-architecture.md`). A full render pass
  measures well under 1ms at both scales on a representative dev host (see
  `apps/docs/src/content/docs/components/table.md`'s Performance section for
  the recorded numbers) — comfortably inside a 16ms frame budget — which is
  the evidence this ADR's virtualization decision gates on: no default/adapter
  virtualization is currently justified. Both scenarios also carry a
  `budget.maxOverheadRatio` regression gate — see "Regression budgets" below.
- `web/table-row-update` (issue #168) — contrasts the cost floor an optimized/
  memoized consumer gets for a single row's selection/sort-driven recompute
  against a full 100-row recompute, budgeted so a regression that makes a
  single-row update scale with total row count fails CI. Table's own
  unmemoized-by-default reality (every row's render function re-runs on a
  sibling's selection change, and `React.memo` is a verified mitigation) is
  proven separately in
  `apps/showcase/__tests__/table-performance.test.tsx`, not in this harness.
- `native/table-render-100` / `native/table-render-500` (issue #168) — the
  native side of the same 100/500-row envelope, deferred off-device like
  `native/list-render`.

## Component lane (R5.2–R5.4, #180–#182)

Real render/commit, overlay open-latency and theme-runtime scenarios need an
actual React/React Native component tree — something this dependency-free ESM
harness cannot mount itself (no bundler, no DOM/RN runtime). `apps/showcase`'s
existing Jest + `@testing-library/react-native` setup already mounts real
BeeUI components with the same mocks its own component tests use, so it plays
the role a native `deviceRunner` plays for `runner.mjs`'s native lane: it
supplies real samples this host cannot otherwise produce, and never fabricates
a number it did not receive.

The handoff is a raw-samples JSON contract, not a code import, because the
harness is ESM (`.mjs`) and this app's Jest config runs `.ts(x)` through
Babel/CommonJS with no ESM interop enabled:

1. `pnpm --filter @beeui/showcase bench` runs
   `apps/showcase/__tests__/perf-render-commit.test.tsx`,
   `perf-overlay-latency.test.tsx` and `perf-theme-runtime.test.tsx`. Each
   mounts real components, times them with `apps/showcase/perf/sample-workload.ts`
   (a documented, behavior-locked port of this file's own `runSamples`
   warm-up/measure algorithm — see that file's header for why it is a port,
   not an import), and writes raw per-scenario durations to
   `.artifacts/benchmark/raw/*.json`.
2. `node scripts/benchmark/collect-component-results.mjs` (or `pnpm
   bench:components`, which chains both steps) reads those raw files and turns
   them into the SAME schema-conformant result set `cli.mjs` produces, calling
   this harness's own `summarizeSamples`/`createResultSet`/`toJson`/`toSummary`
   unmodified — no duplicated statistics or schema logic.

Component-lane results are recorded with `platform: 'web'`: they run through
`react-test-renderer`, not a browser or an on-device runner, so per
`docs/beeui-1.0-evidence-classes.md` they are *deterministic-contract*
evidence (the same class as this repo's own component tests), not
browser-interaction or native-runtime evidence. Where the real component
contract only settles asynchronously (anchored-overlay positioning) or where a
real device/browser distinction genuinely matters, the scenario file's own
comments say so.

## Bundle & package footprint baseline (R5.5, #183)

`scripts/benchmark/footprint.mjs` is a **separate script**, not a registered
scenario: it measures *bytes* for a fixed, real point-in-time layout, not
*time* across warm-up/sample iterations, so none of the sampler/statistics
machinery above applies. It reuses this harness's git-provenance helper
(`lib/metadata.mjs`) and its JSON+summary dual-output convention, and its pure
analysis helpers live in `lib/footprint-analysis.mjs` (unit-tested in
`scripts/__tests__/footprint-analysis.test.mjs`, run as part of `bench:test`).

It measures the **release-ready package layout** landed by #200 (dual
ESM/CJS + `.d.ts` `dist/` output, conditional `exports`, `src/` kept for the
Registry source-ownership path) — not raw TypeScript source. Run it with:

```bash
pnpm bench:footprint   # chains `pnpm build` first, then measures
```

It reports two honestly-separated things (see
`docs/beeui-1.0-evidence-classes.md`):

1. **Packed tarball sizes** — real `npm pack --dry-run --json --ignore-scripts`
   output for `@beeui/core`, `@beeui/tokens`, `@beeui/ui` against whatever
   `dist/` already exists on disk. `--ignore-scripts` is required: `npm pack`
   otherwise always runs the `prepack` lifecycle script (`pnpm run build`),
   which both rebuilds redundantly on every invocation and interleaves
   build-tool log lines with stdout ahead of the JSON payload. The script
   fails loudly (`assertBuilt()`) if `dist/module/index.js` is missing for any
   package, rather than silently packing a stale or empty tree.
2. **Clean-consumer bundle contribution** — esbuild bundles of small synthetic
   entry points that alias `@beeui/*` bare specifiers straight to the real
   built `dist/module/index.js` (the exact file every `exports` condition that
   matters for a bundler — `react-native`, `import`, `browser`, `default` —
   already resolves to) and mark every one of `@beeui/ui`'s peerDependencies
   (required and optional) `external`, so the number is what BeeUI's own code
   contributes, not what the consumer's platform already supplies. This is an
   **esbuild-bundled proxy over real built output, not a real Metro/webpack/
   Vite build** — it is reported as such. A real Metro/Vite compile-succeeds
   proof for an actual npm-installed clean consumer is
   `scripts/verify-bare-consumer.sh` / `scripts/verify-web-consumer.sh`'s job
   (ADR-011); this script's job is comparative bytes, not re-proving
   resolution.

A `native/*`-labeled scenario is a **native-extension-priority proxy**
(`resolveExtensions` prefers `*.native.js` before plain `*.js`, mirroring
Metro's platform-file convention) — not a real on-device or Metro-bundled
number, exactly like `native/list-render`'s `deferred` honesty rule above.

Scenarios also include **direct dist-module imports** that bypass the
`@beeui/ui` barrel (e.g. `web/single-component-direct` imports
`dist/module/components/button.js` directly). Today's public `exports` map
has no per-component subpath — only `.` and `./package.json` — so these are
not a resolvable import path for a real consumer yet; they exist to measure,
with real built bytes, what a future granular subpath export (#184's
decision) would cost against the barrel. The recorded baseline is
`docs/bundle-footprint-baseline.md`.

## Regression budgets (R5.7, #185)

Turning measured baseline data into a pass/fail gate uses two separate
mechanisms, chosen per #185's rule to not invent thresholds before data
exists and to avoid brittle absolute-millisecond gates on a noisy host. Both
are machine-checkable config, not judgment calls made at review time.

### Timing scenarios: relative overhead-ratio budgets

Any registered scenario with a `candidate`/`baseline` pair (see "Overhead vs
a baseline" above) can declare `budget: { maxOverheadRatio: N }`. This is the
ONLY budget shape used for wall-clock timing, and deliberately so: because
`candidate` and `baseline` run on the same host in the same process in the
same invocation, their ratio self-normalizes away host speed differences —
it is a controlled relative comparison, not an absolute millisecond gate on a
possibly-noisy runner.

Two scenarios currently carry this budget:

- `web/table-row-update`: `maxOverheadRatio: 0.2` — a single memoized row's
  update must stay under 20% of a full 100-row recompute (it is 1/100th of
  the table ideally; 0.2 leaves generous headroom while still catching a
  regression that makes a single-row update scale with total row count).
- `web/table-render-100` / `web/table-render-500`: `maxOverheadRatio: 15` —
  real `cn()`/twMerge resolution vs. naive string concatenation. Repeated
  local runs on a representative dev host land consistently in the ~8-9.5x
  range at both scales (the ratio tracks twMerge's per-call cost, not row
  count); 15x is comfortably above that observed ceiling.

The harness's own component-render/overlay-latency/theme-runtime scenarios
(`apps/showcase/__tests__/perf-*.test.tsx`) are deliberately **not** budgeted
this way today: they measure a single workload with no baseline pair (e.g.
"mount 500 Buttons"), and a real run on this repo's dev host recorded
coefficients of variation up to 227% for some overlay/render scenarios under
Jest + `@testing-library/react-native` — exactly the noisy-runner case #185
says to avoid gating on with an absolute number. Adding a budget to one of
these needs either a controlled baseline pair (so the ratio can self-
normalize, as above) or materially reduced host noise; neither exists yet, so
per #185's "do not invent thresholds before data exists," none is added. This
is a scope decision, not an oversight — see
`docs/performance-baseline-report.md` for the recorded numbers and CVs.

### Package/bundle footprint: percentage-of-baseline budgets with a two-tier policy

Bytes are not wall-clock timing: the same source, `esbuild`, and `npm`
versions produce the same packed/bundled byte counts on any host, so there is
no noisy-runner case to guard against here — a percentage-of-baseline
tolerance is the appropriate, and simpler, budget shape.

`scripts/benchmark/footprint-budgets.mjs` records, for every package
(`@beeui/core`/`tokens`/`ui`) and every bundle scenario in
`docs/bundle-footprint-baseline.md`, a `baselineGzipBytes` value copied
verbatim from that committed baseline, plus a two-tier tolerance:

- `warnPct: 0.10` — growth beyond 10% is reported as an informational WARN;
  it does not fail the check. This covers legitimate small growth (a new
  prop, variant, or patch-level dependency bump) without demanding a budget
  PR for every routine change.
- `failPct: 0.20` — growth beyond 20% FAILS the check. This is chosen well
  above the ~1% organic drift actually observed rebuilding at the same
  commit on a different host (`@beeui/ui` measured 500.0 KiB vs. the
  committed 495.3 KiB baseline — environment/dependency-resolution noise, not
  a regression), so it only trips on a materially sized regression: an
  accidentally un-externalized peer, a new always-bundled dependency, or the
  barrel/tree-shaking behavior regressing.

`scripts/benchmark/lib/budget-evaluator.mjs` is the pure comparison function
(unit-tested in `scripts/__tests__/budget-evaluator.test.mjs`, run as part of
`bench:test`); `scripts/benchmark/budget-check.mjs` is the I/O wrapper that
reads the most recent `pnpm bench:footprint` output and reports pass/warn/fail
per package and scenario. Run both with:

```bash
pnpm bench:budget   # chains `pnpm bench:footprint`, then checks it
```

Exit code is non-zero only on an actual FAIL row; a WARN-only run still exits
0, per #185's rule to treat severe regressions separately from informational
drift. A scenario measured but absent from the budget config is reported as
`unbudgeted` (visible, never failing) rather than silently ungated or
silently blocking — this matters when a future issue (e.g. #184's granular
exports) adds new scenarios to `footprint.mjs`.

**Updating a budget.** Bump `baselineGzipBytes` in the same PR that
intentionally grows a package or scenario's real footprint, with fresh
`pnpm bench:footprint` numbers in the PR description and
`docs/bundle-footprint-baseline.md` updated to match — the same review bar as
any other public-contract change. A budget must never be raised just to
silence a failure without that evidence attached.

## CI

The harness is pure Node with no external dependencies, so `pnpm bench:web`,
`pnpm bench:test` and `pnpm bench:budget` are callable in any Node CI job.
`pnpm bench:web`/`pnpm bench:native` already exit non-zero on their own
`maxOverheadRatio` budget failures (see "Regression budgets" above);
`pnpm bench:budget` is the separate check for the package/bundle footprint
budgets, since those are measured by `footprint.mjs`, not `cli.mjs`.
`pnpm bench:test` also runs as part of `pnpm test`. The native lane requires an on-device runner to produce
`measured` results; without one it deterministically reports `deferred`. The
component lane's Jest suites (`perf-*.test.tsx`) also run as part of
`pnpm --filter @beeui/showcase test` (and therefore `pnpm test`), since they are
deterministic pass/fail checks with no invented millisecond gate — only
`pnpm bench:components`'s separate collection step, not the test run itself,
produces the timing artifact.
