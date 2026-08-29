// Warm-up + sampling engine.
//
// Strategy (documented in docs/benchmark-harness.md):
//   1. Run `warmup` discarded samples first so the JIT, inline caches and any
//      lazy allocation reach steady state before anything is recorded.
//   2. Run `samples` measured samples. Each sample times `iterations` calls of
//      the workload and records the per-operation duration, so fast operations
//      are batched into a measurable window instead of fighting clock
//      granularity.
//
// The clock is injectable. Production uses a monotonic high-resolution clock;
// tests inject a deterministic fake clock so sampling math is verified exactly,
// with no reliance on wall-clock timing.

import { performance } from 'node:perf_hooks';

export function defaultClock() {
  return performance.now();
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be an integer >= 1, received: ${String(value)}`);
  }
}

function assertNonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be an integer >= 0, received: ${String(value)}`);
  }
}

export function runSamples({
  fn,
  warmup = 5,
  samples = 30,
  iterations = 1,
  clock = defaultClock,
} = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('runSamples requires a workload function `fn`');
  }
  if (typeof clock !== 'function') {
    throw new TypeError('runSamples requires a `clock` function');
  }
  assertNonNegativeInteger('warmup', warmup);
  assertPositiveInteger('samples', samples);
  assertPositiveInteger('iterations', iterations);

  // Warm-up: run and discard. The return value is intentionally ignored, but we
  // still call the workload so its side effects (cache priming) happen.
  for (let w = 0; w < warmup; w += 1) {
    for (let i = 0; i < iterations; i += 1) {
      fn(i);
    }
  }

  const durations = new Array(samples);
  for (let s = 0; s < samples; s += 1) {
    const start = clock();
    for (let i = 0; i < iterations; i += 1) {
      fn(i);
    }
    const end = clock();
    durations[s] = (end - start) / iterations;
  }

  return { samples: durations, warmup, iterations };
}
