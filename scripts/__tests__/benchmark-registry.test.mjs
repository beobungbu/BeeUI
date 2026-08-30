import test from 'node:test';
import assert from 'node:assert/strict';

import { defineScenario, ScenarioRegistry } from '../benchmark/lib/registry.mjs';
import { buildDefaultRegistry, SCENARIOS } from '../benchmark/scenarios/index.mjs';

test('defineScenario normalizes defaults and shorthand run', () => {
  const scenario = defineScenario({
    id: 'web/example',
    title: 'Example',
    platform: 'web',
    run: () => 1,
  });
  assert.equal(scenario.unit, 'ms/op');
  assert.equal(scenario.warmup, 5);
  assert.equal(scenario.samples, 30);
  assert.equal(scenario.iterations, 1);
  assert.equal(scenario.candidate.label, 'beeui');
  assert.equal(typeof scenario.candidate.run, 'function');
  assert.equal(scenario.baseline, null);
  assert.ok(Object.isFrozen(scenario));
});

test('defineScenario rejects malformed scenarios', () => {
  assert.throws(() => defineScenario({ id: 'Bad Id', title: 't', platform: 'web', run: () => {} }), TypeError);
  assert.throws(() => defineScenario({ id: 'ok', title: '', platform: 'web', run: () => {} }), TypeError);
  assert.throws(() => defineScenario({ id: 'ok', title: 't', platform: 'desktop', run: () => {} }), RangeError);
  assert.throws(() => defineScenario({ id: 'ok', title: 't', platform: 'web' }), TypeError);
  assert.throws(
    () => defineScenario({ id: 'ok', title: 't', platform: 'web', run: () => {}, samples: 0 }),
    RangeError,
  );
  assert.throws(
    () =>
      defineScenario({
        id: 'ok',
        title: 't',
        platform: 'web',
        run: () => {},
        budget: { maxOverheadRatio: 0 },
      }),
    RangeError,
  );
});

test('registry rejects duplicate ids and orders deterministically', () => {
  const registry = new ScenarioRegistry();
  registry.register({ id: 'web/b', title: 'B', platform: 'web', run: () => {} });
  registry.register({ id: 'web/a', title: 'A', platform: 'web', run: () => {} });
  registry.register({ id: 'native/c', title: 'C', platform: 'native', run: () => {} });

  assert.deepEqual(registry.ids(), ['native/c', 'web/a', 'web/b']);
  assert.deepEqual(
    registry.list().map((s) => s.id),
    ['native/c', 'web/a', 'web/b'],
  );
  assert.deepEqual(
    registry.byPlatform('web').map((s) => s.id),
    ['web/a', 'web/b'],
  );
  assert.equal(registry.has('web/a'), true);
  assert.equal(registry.get('missing'), null);

  assert.throws(
    () => registry.register({ id: 'web/a', title: 'dup', platform: 'web', run: () => {} }),
    /duplicate scenario id/,
  );
});

test('default registry hosts the harness self-test scenarios plus #168 Table scenarios, without bespoke scripts', () => {
  const registry = buildDefaultRegistry();
  assert.ok(SCENARIOS.length >= 2);
  assert.deepEqual(registry.byPlatform('web').map((s) => s.id), [
    'web/table-render-100',
    'web/table-render-500',
    'web/table-row-update',
    'web/variant-class-resolution',
  ]);
  assert.deepEqual(registry.byPlatform('native').map((s) => s.id), [
    'native/list-render',
    'native/table-render-100',
    'native/table-render-500',
  ]);
});
