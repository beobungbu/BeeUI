import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateFootprintBudgets } from '../benchmark/lib/budget-evaluator.mjs';

function fakeResultSet(overrides = {}) {
  return {
    packages: {
      core: { name: '@beeui/core', packedGzipBytes: 25700 },
    },
    scenarios: [{ id: 'web/full-barrel', gzipBytes: 53555 }],
    ...overrides,
  };
}

function fakeBudgets(overrides = {}) {
  return {
    packages: {
      '@beeui/core': { baselineGzipBytes: 25700, warnPct: 0.1, failPct: 0.2 },
    },
    scenarios: {
      'web/full-barrel': { baselineGzipBytes: 53555, warnPct: 0.1, failPct: 0.2 },
    },
    ...overrides,
  };
}

test('evaluateFootprintBudgets passes rows at or below baseline', () => {
  const evaluation = evaluateFootprintBudgets(fakeResultSet(), fakeBudgets());
  assert.equal(evaluation.hasFailure, false);
  assert.equal(evaluation.hasWarning, false);
  assert.equal(evaluation.rows.length, 2);
  assert.ok(evaluation.rows.every((row) => row.status === 'pass'));
});

test('evaluateFootprintBudgets warns on drift beyond warnPct but within failPct', () => {
  const resultSet = fakeResultSet({
    packages: { core: { name: '@beeui/core', packedGzipBytes: 25700 * 1.15 } },
  });
  const evaluation = evaluateFootprintBudgets(resultSet, fakeBudgets());
  const coreRow = evaluation.rows.find((row) => row.id === '@beeui/core');
  assert.equal(coreRow.status, 'warn');
  assert.equal(evaluation.hasWarning, true);
  assert.equal(evaluation.hasFailure, false);
});

test('evaluateFootprintBudgets fails on drift beyond failPct', () => {
  const resultSet = fakeResultSet({
    scenarios: [{ id: 'web/full-barrel', gzipBytes: 53555 * 1.5 }],
  });
  const evaluation = evaluateFootprintBudgets(resultSet, fakeBudgets());
  const scenarioRow = evaluation.rows.find((row) => row.id === 'web/full-barrel');
  assert.equal(scenarioRow.status, 'fail');
  assert.equal(evaluation.hasFailure, true);
});

test('evaluateFootprintBudgets treats a shrink as pass, not a false failure', () => {
  const resultSet = fakeResultSet({
    packages: { core: { name: '@beeui/core', packedGzipBytes: 25700 * 0.5 } },
  });
  const evaluation = evaluateFootprintBudgets(resultSet, fakeBudgets());
  const coreRow = evaluation.rows.find((row) => row.id === '@beeui/core');
  assert.equal(coreRow.status, 'pass');
  assert.ok(coreRow.deltaPct < 0);
});

test('evaluateFootprintBudgets reports an unbudgeted package/scenario without failing', () => {
  const resultSet = fakeResultSet({
    packages: { tokens: { name: '@beeui/tokens', packedGzipBytes: 99000 } },
  });
  const evaluation = evaluateFootprintBudgets(resultSet, fakeBudgets());
  const tokensRow = evaluation.rows.find((row) => row.id === '@beeui/tokens');
  assert.equal(tokensRow.status, 'unbudgeted');
  assert.equal(tokensRow.baselineGzipBytes, null);
  assert.equal(evaluation.hasFailure, false);
});

test('evaluateFootprintBudgets rejects a missing result set or budgets object', () => {
  assert.throws(() => evaluateFootprintBudgets(null, fakeBudgets()), TypeError);
  assert.throws(() => evaluateFootprintBudgets(fakeResultSet(), null), TypeError);
});
