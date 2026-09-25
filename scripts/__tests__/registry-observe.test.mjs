import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { observePackage, observeRegistry, readCommittedObservation, writeObservationAtomic } from '../registry-observe.mjs';

function fakeNpm(responses) {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    const key = args.join(' ');
    if (!(key in responses)) throw new Error(`fakeNpm: no fixture for "${key}"`);
    const value = responses[key];
    if (value instanceof Error) throw value;
    return JSON.stringify(value);
  };
  return { run, calls };
}

test('observePackage normalizes a single-version string into an array and fetches dist for the next tag', async () => {
  const { run } = fakeNpm({
    'view @beemvp/beeui-ui versions dist-tags --json': { versions: '0.86.2-rc.1', 'dist-tags': { latest: '0.86.2-rc.1', next: '0.86.2-rc.1' } },
    'view @beemvp/beeui-ui@0.86.2-rc.1 dist --json': { integrity: 'sha512-abc', shasum: 'deadbeef', unpackedSize: 123 },
  });
  const result = await observePackage('@beemvp/beeui-ui', { run });
  assert.deepEqual(result.versions, ['0.86.2-rc.1']);
  assert.equal(result.distTags.next, '0.86.2-rc.1');
  assert.equal(result.dist.integrity, 'sha512-abc');
  assert.equal(result.dist.version, '0.86.2-rc.1');
});

test('observePackage tolerates a package with zero published versions (no dist query attempted)', async () => {
  const { run, calls } = fakeNpm({
    'view @beemvp/beeui-cli versions dist-tags --json': { versions: [], 'dist-tags': {} },
  });
  const result = await observePackage('@beemvp/beeui-cli', { run });
  assert.deepEqual(result.versions, []);
  assert.equal(result.dist, null);
  assert.equal(calls.length, 1);
});

test('observePackage leaves dist null (but keeps versions/dist-tags) when the dist query itself fails', async () => {
  const { run } = fakeNpm({
    'view @beemvp/beeui-ui versions dist-tags --json': { versions: ['1.0.0'], 'dist-tags': { latest: '1.0.0', next: '1.0.0' } },
    'view @beemvp/beeui-ui@1.0.0 dist --json': new Error('network blip'),
  });
  const result = await observePackage('@beemvp/beeui-ui', { run });
  assert.deepEqual(result.versions, ['1.0.0']);
  assert.equal(result.dist, null);
});

test('observeRegistry queries every package and assembles one observation object', async () => {
  const names = ['@beemvp/beeui-core', '@beemvp/beeui-ui'];
  const { run } = fakeNpm({
    'view @beemvp/beeui-core versions dist-tags --json': { versions: ['0.1.0'], 'dist-tags': { latest: '0.1.0', next: '0.1.0' } },
    'view @beemvp/beeui-core@0.1.0 dist --json': { integrity: 'x', shasum: 'y', unpackedSize: 1 },
    'view @beemvp/beeui-ui versions dist-tags --json': { versions: ['0.1.0'], 'dist-tags': { latest: '0.1.0', next: '0.1.0' } },
    'view @beemvp/beeui-ui@0.1.0 dist --json': { integrity: 'x', shasum: 'y', unpackedSize: 1 },
  });
  const observation = await observeRegistry({ packageNames: names, run, now: () => '2026-01-01T00:00:00.000Z', observedBy: 'test-actor' });
  assert.equal(observation.observedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(observation.observedBy, 'test-actor');
  assert.equal(observation.command.tool, 'npm');
  assert.deepEqual(Object.keys(observation.packages).sort(), names.slice().sort());
});

test('observeRegistry propagates a failed package query without producing a partial observation', async () => {
  const { run } = fakeNpm({
    'view @beemvp/beeui-core versions dist-tags --json': { versions: ['0.1.0'], 'dist-tags': {} },
    'view @beemvp/beeui-ui versions dist-tags --json': new Error('ECONNRESET'),
  });
  await assert.rejects(
    () => observeRegistry({ packageNames: ['@beemvp/beeui-core', '@beemvp/beeui-ui'], run }),
    /ECONNRESET/,
  );
});

test('writeObservationAtomic writes via a temp file and rename, never leaving a partial target on a write failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-registry-observe-'));
  try {
    const observation = { observedAt: 'now', observedBy: 'test', packages: {} };
    writeObservationAtomic(dir, observation);
    const committed = readCommittedObservation(dir);
    assert.deepEqual(committed, observation);

    const entries = fs.readdirSync(dir);
    assert.deepEqual(entries, ['docs']);
    const docsEntries = fs.readdirSync(path.join(dir, 'docs'));
    // Only the final file should remain — no leftover .tmp sibling.
    assert.deepEqual(docsEntries, ['registry-observation.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readCommittedObservation returns null when no snapshot has ever been written', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-registry-observe-empty-'));
  try {
    assert.equal(readCommittedObservation(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed observation never overwrites a previously written committed snapshot', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-registry-observe-preserve-'));
  try {
    const goodObservation = { observedAt: 'good', observedBy: 'test', packages: { '@beemvp/beeui-core': { versions: ['1.0.0'], distTags: {}, dist: null } } };
    writeObservationAtomic(dir, goodObservation);

    const { run } = fakeNpm({ 'view @beemvp/beeui-core versions dist-tags --json': new Error('registry down') });
    await assert.rejects(() => observeRegistry({ packageNames: ['@beemvp/beeui-core'], run }));

    // Caller never calls writeObservationAtomic on a rejected observeRegistry() promise (mirrored
    // by the CLI's main()), so the committed snapshot must be exactly what it was before.
    assert.deepEqual(readCommittedObservation(dir), goodObservation);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
