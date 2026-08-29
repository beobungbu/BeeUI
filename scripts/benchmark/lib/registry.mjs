// Scenario registry.
//
// This is the mechanism that lets R5.2–R5.7 (#180–#186) host their scenarios
// without bespoke per-scenario scripts: each scenario module calls
// `defineScenario(...)` and registers the result. The harness discovers, filters
// and runs whatever is registered. Adding a scenario is data, not a new runner.
//
// A scenario shape:
//   {
//     id:        string  unique kebab-case identifier, e.g. 'web/list-render'
//     title:     string  human label
//     platform:  'web' | 'native'
//     description?: string
//     unit?:     string  measurement unit label (default 'ms/op')
//     warmup?:   int >= 0 discarded samples (default 5)
//     samples?:  int >= 1 measured samples (default 30)
//     iterations?: int >= 1 workload calls timed per sample (default 1)
//     candidate: { label: string, run: (i) => unknown }   the thing measured
//     baseline?: { label: string, run: (i) => unknown }   optional reference
//     budget?:   { maxOverheadRatio: number }              optional regression gate
//   }
//
// Shorthand: a scenario may pass `run` (and optional `label`) instead of a
// `candidate` object; it is normalized to a candidate.

const ID_PATTERN = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

function normalizeMeasurement(raw, fallbackLabel) {
  if (raw == null) return null;
  if (typeof raw === 'function') {
    return { label: fallbackLabel, run: raw };
  }
  if (typeof raw !== 'object' || typeof raw.run !== 'function') {
    throw new TypeError(`measurement must be a function or { label, run }, received: ${String(raw)}`);
  }
  return {
    label: typeof raw.label === 'string' && raw.label.length > 0 ? raw.label : fallbackLabel,
    run: raw.run,
  };
}

function normalizeInteger(name, value, fallback, minimum) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${minimum}, received: ${String(value)}`);
  }
  return value;
}

export function defineScenario(scenario) {
  if (scenario === null || typeof scenario !== 'object') {
    throw new TypeError('scenario must be an object');
  }
  const { id, title, platform } = scenario;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new TypeError(`scenario.id must be kebab/slash-case, received: ${String(id)}`);
  }
  if (typeof title !== 'string' || title.length === 0) {
    throw new TypeError(`scenario.title must be a non-empty string (id: ${id})`);
  }
  if (platform !== 'web' && platform !== 'native') {
    throw new RangeError(`scenario.platform must be 'web' or 'native' (id: ${id})`);
  }

  const candidate = normalizeMeasurement(
    scenario.candidate ?? scenario.run,
    scenario.label ?? 'beeui',
  );
  if (candidate === null) {
    throw new TypeError(`scenario "${id}" must define a candidate workload (candidate or run)`);
  }
  const baseline = normalizeMeasurement(scenario.baseline, 'baseline');

  let budget = null;
  if (scenario.budget != null) {
    const maxOverheadRatio = scenario.budget.maxOverheadRatio;
    if (typeof maxOverheadRatio !== 'number' || !Number.isFinite(maxOverheadRatio) || maxOverheadRatio <= 0) {
      throw new RangeError(`scenario "${id}" budget.maxOverheadRatio must be a positive number`);
    }
    budget = { maxOverheadRatio };
  }

  return Object.freeze({
    id,
    title,
    platform,
    description: typeof scenario.description === 'string' ? scenario.description : null,
    unit: typeof scenario.unit === 'string' && scenario.unit.length > 0 ? scenario.unit : 'ms/op',
    warmup: normalizeInteger('warmup', scenario.warmup, 5, 0),
    samples: normalizeInteger('samples', scenario.samples, 30, 1),
    iterations: normalizeInteger('iterations', scenario.iterations, 1, 1),
    candidate: Object.freeze(candidate),
    baseline: baseline ? Object.freeze(baseline) : null,
    budget: budget ? Object.freeze(budget) : null,
    setup: typeof scenario.setup === 'function' ? scenario.setup : null,
    teardown: typeof scenario.teardown === 'function' ? scenario.teardown : null,
  });
}

export class ScenarioRegistry {
  #scenarios = new Map();

  register(scenario) {
    const defined = defineScenario(scenario);
    if (this.#scenarios.has(defined.id)) {
      throw new Error(`duplicate scenario id: "${defined.id}"`);
    }
    this.#scenarios.set(defined.id, defined);
    return defined;
  }

  registerAll(scenarios) {
    for (const scenario of scenarios) this.register(scenario);
    return this;
  }

  has(id) {
    return this.#scenarios.has(id);
  }

  get(id) {
    return this.#scenarios.get(id) ?? null;
  }

  ids() {
    return [...this.#scenarios.keys()].sort();
  }

  // Deterministic ordering: sorted by id so result sets are stable across runs.
  list() {
    return this.ids().map((id) => this.#scenarios.get(id));
  }

  byPlatform(platform) {
    return this.list().filter((scenario) => scenario.platform === platform);
  }
}
