// Public entry point for the BeeUI benchmark harness.
//
// Programmatic consumers (tests, future scenarios, CI glue) import from here.
// The CLI (cli.mjs) is the command-line front end over the same API.

export * from './lib/statistics.mjs';
export * from './lib/sampler.mjs';
export * from './lib/metadata.mjs';
export * from './lib/schema.mjs';
export * from './lib/registry.mjs';
export * from './lib/runner.mjs';
export * from './lib/reporters.mjs';
export { SCENARIOS, buildDefaultRegistry } from './scenarios/index.mjs';
