// Scenario registration point.
//
// R5.2–R5.7 (#180–#186) add their scenarios here: import the scenario module and
// list it below. No new runner or bespoke script is required — the registry,
// sampler and reporters handle any registered scenario.

import { ScenarioRegistry } from '../lib/registry.mjs';
import webVariantClassResolution from './web/variant-class-resolution.mjs';
import webTableRender from './web/table-render.mjs';
import nativeListRender from './native/list-render.mjs';
import nativeTableRender from './native/table-render.mjs';

export const SCENARIOS = [
  webVariantClassResolution,
  ...webTableRender,
  nativeListRender,
  ...nativeTableRender,
];

export function buildDefaultRegistry() {
  return new ScenarioRegistry().registerAll(SCENARIOS);
}
