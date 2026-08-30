// BeeUI issue #168 (R4E.5) — Table performance and scale acceptance, native
// lane. Registers the 100-row/500-row scale envelope on the native
// methodology, following `native/list-render.mjs`'s deferred-until-on-device
// pattern (see `docs/benchmark-harness.md` "Web vs native methodology"): off
// device this reports `deferred` with captured metadata and never fabricates
// a device timing. A real measurement requires an on-device (iOS Simulator /
// Android Emulator / device) runner, which would drive rendering N `TableRow`s
// via `table.tsx` and report per-frame samples through the same `deviceRunner`
// seam `runScenario` already supports.

import { defineScenario } from '../../lib/registry.mjs';

function defineNativeTableRenderScenario(rowCount) {
  return defineScenario({
    id: `native/table-render-${rowCount}`,
    title: `Native Table render/scroll frame cost — ${rowCount} rows (device-measured)`,
    platform: 'native',
    description:
      `Native methodology placeholder for the ${rowCount}-row scale envelope. ` +
      'Deferred off-device: real iOS Simulator/Android Emulator/device timings for ' +
      'rendering and scrolling an N-row `table.tsx` are supplied by an on-device ' +
      'runner, never fabricated on a JS host.',
    unit: 'ms/frame',
    warmup: 20,
    samples: 40,
    iterations: 1,
    candidate: {
      label: 'beeui-native-table',
      // Executed only by an on-device runner — see `native/list-render.mjs`.
      run: () => {
        throw new Error(
          `native/table-render-${rowCount} must be driven by an on-device runner; it is ` +
            'not executable on a JS host',
        );
      },
    },
  });
}

export default [defineNativeTableRenderScenario(100), defineNativeTableRenderScenario(500)];
