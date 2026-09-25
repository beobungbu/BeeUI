import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  CANDIDATE_GENERATORS,
  LOCKSTEP_MANIFESTS,
  assertValidCandidateVersion,
  collectPreviousVersionLiterals,
  setLockstepManifestVersions,
  setManifestVersion,
} from '../release/prepare-candidate.mjs';

test('accepts the stable version and a valid release candidate on that line', () => {
  assert.doesNotThrow(() => assertValidCandidateVersion('0.86.2', '0.86.2'));
  assert.doesNotThrow(() => assertValidCandidateVersion('0.86.2-rc.0', '0.86.2'));
  assert.doesNotThrow(() => assertValidCandidateVersion('0.86.2-rc.23', '0.86.2'));
});

test('rejects a version off the stable release line', () => {
  for (const invalid of ['0.86.3', '0.87.0-rc.1', '1.0.0', '0.86.2-rc.01', '0.86.2-rc.1-not-a-candidate', '0.86.2-beta.1']) {
    assert.throws(() => assertValidCandidateVersion(invalid, '0.86.2'), /is not valid for the 0\.86\.2 release line/, invalid);
  }
});

test('rejects an empty version argument', () => {
  assert.throws(() => assertValidCandidateVersion('', '0.86.2'), /non-empty version/);
  assert.throws(() => assertValidCandidateVersion(undefined, '0.86.2'), /non-empty version/);
});

test('setManifestVersion rewrites only the version field, byte-for-byte otherwise', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-prepare-candidate-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'packages/ui'), { recursive: true });
    const manifestPath = path.join(rootDir, 'packages/ui/package.json');
    const original = '{\n  "name": "@beemvp/beeui-ui",\n  "version": "0.86.2-rc.1",\n  "dependencies": {}\n}\n';
    fs.writeFileSync(manifestPath, original);

    setManifestVersion(rootDir, 'packages/ui/package.json', '0.86.2-rc.9');
    const rewritten = fs.readFileSync(manifestPath, 'utf8');
    assert.equal(rewritten, original.replace('0.86.2-rc.1', '0.86.2-rc.9'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('setManifestVersion fails closed when the manifest has no version field', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-prepare-candidate-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'packages/ui'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'packages/ui/package.json'), '{"name":"@beemvp/beeui-ui"}\n');
    assert.throws(() => setManifestVersion(rootDir, 'packages/ui/package.json', '0.86.2-rc.9'), /has no "version" field/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('setLockstepManifestVersions moves all four lockstep package manifests together', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-prepare-candidate-lockstep-'));
  try {
    for (const relPath of LOCKSTEP_MANIFESTS) {
      const absolute = path.join(rootDir, relPath);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, `${JSON.stringify({ name: relPath, version: '0.86.2-rc.1' })}\n`);
    }

    setLockstepManifestVersions(rootDir, '0.86.2-rc.9');

    for (const relPath of LOCKSTEP_MANIFESTS) {
      const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, relPath), 'utf8'));
      assert.equal(manifest.version, '0.86.2-rc.9', relPath);
    }
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('the lockstep manifest list is exactly the four released packages', () => {
  assert.deepEqual([...LOCKSTEP_MANIFESTS].sort(), [
    'packages/cli/package.json',
    'packages/core/package.json',
    'packages/tokens/package.json',
    'packages/ui/package.json',
  ]);
});

test('collectPreviousVersionLiterals finds the previous version in tracked files and ignores everything else', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-prepare-candidate-literals-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: rootDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: rootDir });
    fs.writeFileSync(path.join(rootDir, 'stale.md'), 'still on 0.86.2-rc.1 here\n');
    fs.writeFileSync(path.join(rootDir, 'fresh.md'), 'already on 0.86.2-rc.2\n');
    execFileSync('git', ['add', '-A'], { cwd: rootDir });
    execFileSync('git', ['commit', '--quiet', '-m', 'seed'], { cwd: rootDir });

    const hits = collectPreviousVersionLiterals(rootDir, '0.86.2-rc.1');
    assert.equal(hits.length, 1);
    assert.match(hits[0], /^stale\.md:1:/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('collectPreviousVersionLiterals returns an empty list with no previous version or no matches', () => {
  assert.deepEqual(collectPreviousVersionLiterals('/nonexistent', undefined), []);
});

test('the generator sequence mirrors the canonical docs generation order used to prepare rc.2/rc.3', () => {
  assert.deepEqual(CANDIDATE_GENERATORS, [
    'scripts/public-component-reference.mjs',
    'scripts/public-component-previews.mjs',
    'scripts/public-pattern-reference.mjs',
    'scripts/public-reference.mjs',
    'scripts/public-guide-data.mjs',
    'scripts/generate-docs-foundation.mjs',
    'scripts/generate-component-reference.mjs',
    'scripts/generate-llms-txt.mjs',
  ]);
});
