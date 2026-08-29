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

## CI

The harness is pure Node with no external dependencies, so `pnpm bench:web` and
`pnpm bench:test` are callable in any Node CI job. `pnpm bench:test` also runs as
part of `pnpm test`. The native lane requires an on-device runner to produce
`measured` results; without one it deterministically reports `deferred`.
