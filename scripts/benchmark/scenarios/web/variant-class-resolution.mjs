// Representative Web sample scenario.
//
// Purpose: prove the harness mechanics end-to-end on the Web methodology with a
// real, deterministic workload — not to publish an authoritative BeeUI number.
// Per docs/roadmap.md, #179 builds the harness while real measurements wait for
// the surfaces being measured (#180–#186).
//
// What it measures: producing className strings for a simulated list render,
// which is the Web styling hot path. It contrasts two honest, controlled
// implementations of the SAME output on the SAME host:
//
//   candidate "static-map"  — resolve variant+size+state to a complete literal
//                             class string via a precomputed lookup. This mirrors
//                             the BeeUI/Uniwind rule (AGENTS.md): map dynamic
//                             state to complete, statically-discoverable class
//                             strings, never build utilities dynamically.
//   baseline  "dynamic-concat" — assemble the same class string by concatenating
//                             fragments at call time (the pattern the rule avoids).
//
// The "overhead ratio" is candidate-vs-baseline on one host in one run: a
// controlled reference, not a cross-framework marketing comparison.

import { defineScenario } from '../../lib/registry.mjs';

const VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'];
const SIZES = ['sm', 'md', 'lg'];
const STATES = ['default', 'pressed', 'disabled', 'focus'];

const ROW_COUNT = 200;

// Precomputed complete literal class strings, keyed by the full descriptor. This
// is the artifact a build-time-static styling approach would resolve against.
const STATIC_CLASS_MAP = (() => {
  const map = new Map();
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      for (const state of STATES) {
        map.set(
          `${variant}:${size}:${state}`,
          `beeui-item beeui-item--${variant} beeui-item--${size} is-${state}`,
        );
      }
    }
  }
  return map;
})();

// A fixed, deterministic list of descriptors so every sample does identical work.
const ROWS = Array.from({ length: ROW_COUNT }, (_, index) => ({
  variant: VARIANTS[index % VARIANTS.length],
  size: SIZES[index % SIZES.length],
  state: STATES[index % STATES.length],
}));

function resolveStatic(row) {
  return STATIC_CLASS_MAP.get(`${row.variant}:${row.size}:${row.state}`);
}

function resolveDynamic(row) {
  let className = 'beeui-item';
  className += ' beeui-item--' + row.variant;
  className += ' beeui-item--' + row.size;
  className += ' is-' + row.state;
  return className;
}

// A sink that prevents the engine from eliding the work as dead code, while
// staying deterministic (independent of measured timings).
function renderPass(resolve) {
  let checksum = 0;
  for (let r = 0; r < ROWS.length; r += 1) {
    const className = resolve(ROWS[r]);
    checksum += className.length;
  }
  return checksum;
}

export default defineScenario({
  id: 'web/variant-class-resolution',
  title: 'Web variant className resolution for a 200-row list',
  platform: 'web',
  description:
    'Harness self-demonstration workload: resolve component variant/size/state to ' +
    'className strings for a 200-row list. Proves Web sampling mechanics; not an ' +
    'authoritative BeeUI performance claim.',
  unit: 'ms/render-pass',
  warmup: 20,
  samples: 40,
  iterations: 50,
  candidate: { label: 'static-map', run: () => renderPass(resolveStatic) },
  baseline: { label: 'dynamic-concat', run: () => renderPass(resolveDynamic) },
});
