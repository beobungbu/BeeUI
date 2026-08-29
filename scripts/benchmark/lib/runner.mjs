// Scenario runner.
//
// Turns a registered scenario into a schema-conformant result record. This is
// where the Web and native methodologies deliberately diverge:
//
//   Web:    the workload runs in-process through the sampler on this host and is
//           measured directly.
//   Native: real timings can only come from an on-device app runner. Off-device
//           (local dev box, JS CI) there is no honest number to report, so the
//           runner returns a `deferred` result carrying the environment metadata
//           and an explanation — it never fabricates device timings. When a
//           device runner IS supplied (on-device CI, #180+ scenarios), the same
//           code path produces a measured result from the samples it returns.

import { runSamples, defaultClock } from './sampler.mjs';
import { summarizeSamples } from './statistics.mjs';

const NATIVE_DEFERRED_NOTE =
  'native runtime measurement deferred: no on-device runner supplied on this host. ' +
  'Real device/simulator timings are produced by an on-device runner in CI or a ' +
  'later native scenario, never fabricated here.';

function deferredResult(scenario, note) {
  return {
    id: scenario.id,
    title: scenario.title,
    platform: scenario.platform,
    unit: scenario.unit,
    status: 'deferred',
    warmup: scenario.warmup,
    samples: scenario.samples,
    iterations: scenario.iterations,
    candidate: null,
    baseline: null,
    overheadRatio: null,
    budget: scenario.budget,
    budgetStatus: 'n/a',
    note,
  };
}

function measure(scenario, unit, { clock, deviceRunner }) {
  if (unit === null) return null;
  let samples;
  if (scenario.platform === 'native') {
    samples = deviceRunner({ scenario, measurement: unit });
    if (!Array.isArray(samples) || samples.length === 0) {
      throw new Error(`device runner returned no samples for scenario "${scenario.id}"`);
    }
  } else {
    ({ samples } = runSamples({
      fn: unit.run,
      warmup: scenario.warmup,
      samples: scenario.samples,
      iterations: scenario.iterations,
      clock,
    }));
  }
  return { label: unit.label, stats: summarizeSamples(samples) };
}

export function runScenario(scenario, { clock = defaultClock, deviceRunner = null } = {}) {
  if (scenario.platform === 'native' && typeof deviceRunner !== 'function') {
    return deferredResult(scenario, NATIVE_DEFERRED_NOTE);
  }

  const context = scenario.setup ? scenario.setup() : undefined;
  try {
    const candidate = measure(scenario, scenario.candidate, { clock, deviceRunner });
    const baseline = measure(scenario, scenario.baseline, { clock, deviceRunner });

    // Overhead is candidate relative to baseline on the same host in the same
    // run — a controlled reference, not a cross-framework marketing comparison.
    let overheadRatio = null;
    if (baseline && baseline.stats.median !== 0) {
      overheadRatio = candidate.stats.median / baseline.stats.median;
    }

    let budgetStatus = 'n/a';
    if (scenario.budget) {
      if (overheadRatio === null) {
        budgetStatus = 'n/a';
      } else {
        budgetStatus = overheadRatio <= scenario.budget.maxOverheadRatio ? 'pass' : 'fail';
      }
    }

    return {
      id: scenario.id,
      title: scenario.title,
      platform: scenario.platform,
      unit: scenario.unit,
      status: 'measured',
      warmup: scenario.warmup,
      samples: scenario.samples,
      iterations: scenario.iterations,
      candidate,
      baseline,
      overheadRatio,
      budget: scenario.budget,
      budgetStatus,
      note: scenario.description,
    };
  } finally {
    if (scenario.teardown) scenario.teardown(context);
  }
}

export function runScenarios(scenarios, options = {}) {
  return scenarios.map((scenario) => runScenario(scenario, options));
}

export { NATIVE_DEFERRED_NOTE };
