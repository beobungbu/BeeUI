// Native methodology placeholder scenario.
//
// This registers the native path so it is discoverable, callable and
// schema-shaped, WITHOUT fabricating device numbers. Off-device (local dev box,
// JS CI) the runner returns a `deferred` result: metadata is captured, but no
// timing is invented. A real measurement is produced only when an on-device
// runner is supplied — an iOS Simulator / Android Emulator / device driver in
// CI, or a later native scenario under #180+.
//
// `candidate.run` describes the workload an on-device runner would drive. It is
// intentionally not executed on a JS host; the native runner path uses an
// injected deviceRunner to obtain real samples.

import { defineScenario } from '../../lib/registry.mjs';

export default defineScenario({
  id: 'native/list-render',
  title: 'Native list render/scroll frame cost (device-measured)',
  platform: 'native',
  description:
    'Native methodology placeholder. Deferred off-device: real iOS Simulator / ' +
    'Android Emulator / device timings are supplied by an on-device runner, never ' +
    'fabricated on a JS host.',
  unit: 'ms/frame',
  warmup: 30,
  samples: 60,
  iterations: 1,
  candidate: {
    label: 'beeui-native',
    // Executed only by an on-device runner. Present so the workload contract is
    // explicit and the scenario is a real, registered target.
    run: () => {
      throw new Error(
        'native/list-render must be driven by an on-device runner; it is not ' +
          'executable on a JS host',
      );
    },
  },
});
