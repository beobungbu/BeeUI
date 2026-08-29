import test from 'node:test';
import assert from 'node:assert/strict';

import { defineScenario } from '../benchmark/lib/registry.mjs';
import { runScenario, runScenarios } from '../benchmark/lib/runner.mjs';
import { collectEnvironmentMetadata } from '../benchmark/lib/metadata.mjs';
import { createResultSet, assertValidResultSet } from '../benchmark/lib/schema.mjs';
import { toJson, toSummary, hasBudgetFailure } from '../benchmark/lib/reporters.mjs';

function fakeClock(values) {
  let index = 0;
  return () => values[index++];
}

// candidate: two samples of window 2 -> median 2; baseline: window 1 -> median 1.
function overheadClock() {
  return fakeClock([0, 2, 10, 12, 0, 1, 5, 6]);
}

function webScenario(budget) {
  return defineScenario({
    id: 'web/overhead',
    title: 'Overhead',
    platform: 'web',
    warmup: 0,
    samples: 2,
    iterations: 1,
    candidate: { label: 'beeui', run: () => {} },
    baseline: { label: 'baseline', run: () => {} },
    ...(budget ? { budget } : {}),
  });
}

test('web scenario is measured and overhead is candidate/baseline median', () => {
  const result = runScenario(webScenario(), { clock: overheadClock() });
  assert.equal(result.status, 'measured');
  assert.equal(result.candidate.stats.median, 2);
  assert.equal(result.baseline.stats.median, 1);
  assert.equal(result.overheadRatio, 2);
  assert.equal(result.budgetStatus, 'n/a');
});

test('budget passes and fails against the overhead ratio', () => {
  const pass = runScenario(webScenario({ maxOverheadRatio: 2.5 }), { clock: overheadClock() });
  assert.equal(pass.budgetStatus, 'pass');

  const fail = runScenario(webScenario({ maxOverheadRatio: 1.5 }), { clock: overheadClock() });
  assert.equal(fail.budgetStatus, 'fail');
});

test('native scenario defers instead of fabricating numbers when no device runner is supplied', () => {
  const scenario = defineScenario({
    id: 'native/x',
    title: 'Native X',
    platform: 'native',
    candidate: {
      label: 'beeui-native',
      run: () => {
        throw new Error('must not run on a JS host');
      },
    },
  });
  const result = runScenario(scenario);
  assert.equal(result.status, 'deferred');
  assert.equal(result.candidate, null);
  assert.equal(result.baseline, null);
  assert.equal(result.overheadRatio, null);
  assert.equal(result.budgetStatus, 'n/a');
  assert.match(result.note, /deferred/);
});

test('native scenario is measured only through an injected device runner', () => {
  let received = null;
  const scenario = defineScenario({
    id: 'native/x',
    title: 'Native X',
    platform: 'native',
    candidate: { label: 'beeui-native', run: () => undefined },
  });
  const deviceRunner = ({ scenario: s, measurement }) => {
    received = { id: s.id, label: measurement.label };
    return [4, 4, 4];
  };
  const result = runScenario(scenario, { deviceRunner });
  assert.equal(result.status, 'measured');
  assert.equal(result.candidate.stats.median, 4);
  assert.deepEqual(received, { id: 'native/x', label: 'beeui-native' });
});

test('setup/teardown wrap a measured run', () => {
  const order = [];
  const scenario = defineScenario({
    id: 'web/hooks',
    title: 'Hooks',
    platform: 'web',
    warmup: 0,
    samples: 1,
    iterations: 1,
    setup: () => {
      order.push('setup');
      return 'ctx';
    },
    teardown: (ctx) => order.push(`teardown:${ctx}`),
    candidate: { label: 'beeui', run: () => order.push('run') },
  });
  runScenario(scenario, { clock: fakeClock([0, 1]) });
  assert.deepEqual(order, ['setup', 'run', 'teardown:ctx']);
});

test('metadata capture is deterministic under injected providers', () => {
  const metadata = collectEnvironmentMetadata({
    platform: 'web',
    now: () => '2026-01-01T00:00:00.000Z',
    env: { CI: 'true' },
    versions: { node: '24.13.1', v8: '13.6' },
    osInfo: {
      platform: 'linux',
      release: '6.0',
      arch: 'x64',
      cpuModel: 'Test CPU',
      cpuCores: 4,
      cpuSpeedMHz: 3200,
      totalMemoryBytes: 1024,
    },
    git: { sha: 'abc123', shortSha: 'abc123', branch: 'main', dirty: false },
    reactNative: '0.86.2',
  });
  assert.deepEqual(metadata, {
    timestamp: '2026-01-01T00:00:00.000Z',
    platform: 'web',
    ci: true,
    runtime: { name: 'node', node: '24.13.1', v8: '13.6' },
    os: { platform: 'linux', release: '6.0', arch: 'x64' },
    cpu: { model: 'Test CPU', cores: 4, speedMHz: 3200 },
    memory: { totalBytes: 1024 },
    reactNative: '0.86.2',
    git: { sha: 'abc123', shortSha: 'abc123', branch: 'main', dirty: false },
    device: null,
    browser: null,
  });
});

test('reporters emit machine JSON and a human summary; budget failure is detectable', () => {
  const metadata = collectEnvironmentMetadata({
    platform: 'web',
    now: () => '2026-01-01T00:00:00.000Z',
    env: {},
    versions: { node: '24.13.1', v8: '13.6' },
    osInfo: {
      platform: 'linux',
      release: '6.0',
      arch: 'x64',
      cpuModel: 'Test CPU',
      cpuCores: 4,
      cpuSpeedMHz: 3200,
      totalMemoryBytes: 1024,
    },
    git: { sha: 'abc123', shortSha: 'abc123', branch: 'main', dirty: false },
    reactNative: '0.86.2',
  });
  const results = runScenarios([webScenario({ maxOverheadRatio: 1.5 })], { clock: overheadClock() });
  const resultSet = assertValidResultSet(createResultSet({ metadata, results }));

  const json = toJson(resultSet);
  assert.deepEqual(JSON.parse(json), resultSet);

  const summary = toSummary(resultSet);
  assert.match(summary, /web\/overhead/);
  assert.match(summary, /schema:\s+1\.0\.0/);
  assert.match(summary, /FAIL/);
  assert.equal(hasBudgetFailure(resultSet), true);
});

test('deferred native result renders and validates end-to-end', () => {
  const metadata = collectEnvironmentMetadata({
    platform: 'native',
    now: () => '2026-01-01T00:00:00.000Z',
    env: {},
    versions: { node: '24.13.1', v8: '13.6' },
    osInfo: {
      platform: 'darwin',
      release: '25',
      arch: 'arm64',
      cpuModel: 'Apple',
      cpuCores: 8,
      cpuSpeedMHz: 0,
      totalMemoryBytes: 2048,
    },
    git: { sha: 'abc', shortSha: 'abc', branch: 'main', dirty: false },
    reactNative: '0.86.2',
  });
  const scenario = defineScenario({
    id: 'native/x',
    title: 'Native X',
    platform: 'native',
    candidate: { label: 'beeui-native', run: () => undefined },
  });
  const results = runScenarios([scenario]);
  const resultSet = assertValidResultSet(createResultSet({ metadata, results }));
  assert.match(toSummary(resultSet), /DEFERRED/);
  assert.equal(hasBudgetFailure(resultSet), false);
});
