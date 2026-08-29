import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEMA_VERSION,
  createResultSet,
  validateResultSet,
  assertValidResultSet,
} from '../benchmark/lib/schema.mjs';

const stats = {
  count: 3,
  mean: 1,
  median: 1,
  min: 1,
  max: 1,
  stdev: 0,
  cv: 0,
  p95: 1,
  p99: 1,
};

const metadata = { platform: 'web' };

function measuredResult(overrides = {}) {
  return {
    id: 'web/x',
    title: 'X',
    platform: 'web',
    unit: 'ms/op',
    status: 'measured',
    warmup: 1,
    samples: 3,
    iterations: 1,
    candidate: { label: 'beeui', stats },
    baseline: null,
    overheadRatio: null,
    budget: null,
    budgetStatus: 'n/a',
    note: null,
    ...overrides,
  };
}

test('createResultSet stamps the versioned envelope', () => {
  const set = createResultSet({ metadata, results: [] });
  assert.equal(set.schemaVersion, SCHEMA_VERSION);
  assert.equal(typeof set.tool, 'string');
  assert.equal(set.metadata, metadata);
  assert.deepEqual(set.results, []);
});

test('a well-formed measured result set validates', () => {
  const set = createResultSet({ metadata, results: [measuredResult()] });
  const { valid, errors } = validateResultSet(set);
  assert.deepEqual(errors, []);
  assert.equal(valid, true);
  assert.equal(assertValidResultSet(set), set);
});

test('cv may be null but other stats must be finite numbers', () => {
  const nullCv = createResultSet({
    metadata,
    results: [measuredResult({ candidate: { label: 'b', stats: { ...stats, cv: null } } })],
  });
  assert.equal(validateResultSet(nullCv).valid, true);

  const badMedian = createResultSet({
    metadata,
    results: [measuredResult({ candidate: { label: 'b', stats: { ...stats, median: 'x' } } })],
  });
  assert.equal(validateResultSet(badMedian).valid, false);
});

test('deferred results must omit measurements and carry a note', () => {
  const good = createResultSet({
    metadata: { platform: 'native' },
    results: [
      measuredResult({
        platform: 'native',
        status: 'deferred',
        candidate: null,
        baseline: null,
        note: 'deferred: no device',
      }),
    ],
  });
  assert.equal(validateResultSet(good).valid, true);

  const bad = createResultSet({
    metadata: { platform: 'native' },
    results: [
      measuredResult({
        platform: 'native',
        status: 'deferred',
        candidate: { label: 'beeui', stats },
        note: 'deferred: no device',
      }),
    ],
  });
  const { valid, errors } = validateResultSet(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('must not carry measurements')));

  const noNote = createResultSet({
    metadata: { platform: 'native' },
    results: [measuredResult({ platform: 'native', status: 'deferred', candidate: null, note: null })],
  });
  assert.equal(validateResultSet(noNote).valid, false);
});

test('schema version mismatch and structural problems are reported', () => {
  assert.equal(validateResultSet(null).valid, false);
  const wrongVersion = { ...createResultSet({ metadata, results: [] }), schemaVersion: '0.0.0' };
  assert.equal(validateResultSet(wrongVersion).valid, false);

  const missingResults = { schemaVersion: SCHEMA_VERSION, tool: 't', metadata, results: 'nope' };
  assert.equal(validateResultSet(missingResults).valid, false);

  assert.throws(() => assertValidResultSet(wrongVersion), /invalid benchmark result set/);
});

test('a measured result missing its candidate is invalid', () => {
  const set = createResultSet({
    metadata,
    results: [measuredResult({ candidate: null })],
  });
  assert.equal(validateResultSet(set).valid, false);
});
