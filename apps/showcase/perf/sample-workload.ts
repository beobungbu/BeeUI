/**
 * Warm-up + measured sampling loops for the component-render benchmark lane
 * (BeeUI issues #180/#181/#182, extending the #179 benchmark harness).
 *
 * This is a deliberate, documented, behavior-locked port of
 * `scripts/benchmark/lib/sampler.mjs`'s `runSamples` algorithm: run `warmup`
 * discarded iterations first (JIT/inline-cache/lazy-allocation steady state),
 * then time `samples` measured iterations, each batching `iterations` calls
 * into one clock window and recording the per-operation duration.
 *
 * It is a port rather than a direct import because the harness (#179) is
 * dependency-free ESM (`.mjs`, no bundler), while this app's Jest config runs
 * `.ts(x)` through Babel/CommonJS with no ESM interop enabled — `import()` of
 * an `.mjs` file requires `--experimental-vm-modules`, and `require()` of an
 * `.mjs` file is not valid CommonJS. Enabling either just to reach one
 * dependency-free file was judged riskier than this small, locked port. The
 * part that actually matters for correctness — descriptive statistics, the
 * result schema, and reporting — is NOT duplicated: raw durations collected
 * here are handed to `scripts/benchmark/collect-component-results.mjs`, which
 * calls the real `summarizeSamples`/`createResultSet`/`toJson`/`toSummary`
 * from `scripts/benchmark/lib/*.mjs` unmodified. Keep this loop identical to
 * `runSamples` if that algorithm ever changes.
 */

import { performance } from 'node:perf_hooks';

export type SampleWorkloadOptions = {
  fn: (iteration: number) => unknown;
  warmup?: number;
  samples?: number;
  iterations?: number;
};

export function sampleWorkload({
  fn,
  warmup = 5,
  samples = 30,
  iterations = 1,
}: SampleWorkloadOptions): number[] {
  for (let w = 0; w < warmup; w += 1) {
    for (let i = 0; i < iterations; i += 1) fn(i);
  }

  const durations: number[] = new Array(samples);
  for (let s = 0; s < samples; s += 1) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) fn(i);
    const end = performance.now();
    durations[s] = (end - start) / iterations;
  }
  return durations;
}

export type SampleWorkloadAsyncOptions = {
  fn: (iteration: number) => Promise<unknown>;
  /**
   * Optional per-iteration reset run AFTER each timed `fn` call (and after
   * each warm-up call), excluded from the timed window. Used to restore
   * steady-state harnesses between samples (e.g. closing an overlay after
   * timing its open) without that reset cost polluting the measured latency.
   */
  reset?: (iteration: number) => unknown | Promise<unknown>;
  warmup?: number;
  samples?: number;
  iterations?: number;
};

// Async twin used only where the real component contract settles
// asynchronously (anchored-overlay open transitions — see
// perf-overlay-latency.test.tsx). Same warm-up/measure structure; `await`s
// each call instead of running it synchronously, and can exclude an untimed
// `reset` step from the measured window.
export async function sampleWorkloadAsync({
  fn,
  reset,
  warmup = 5,
  samples = 30,
  iterations = 1,
}: SampleWorkloadAsyncOptions): Promise<number[]> {
  for (let w = 0; w < warmup; w += 1) {
    for (let i = 0; i < iterations; i += 1) {
      await fn(i);
      if (reset) await reset(i);
    }
  }

  const durations: number[] = new Array(samples);
  for (let s = 0; s < samples; s += 1) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) await fn(i);
    const end = performance.now();
    durations[s] = (end - start) / iterations;
    if (reset) {
      for (let i = 0; i < iterations; i += 1) await reset(i);
    }
  }
  return durations;
}
