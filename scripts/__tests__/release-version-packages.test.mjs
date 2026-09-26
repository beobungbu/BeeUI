import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { LOCKSTEP_MANIFESTS } from '../release/prepare-candidate.mjs';
import { assertLockstep, versionPackages } from '../release/version-packages.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const changesetBin = path.join(repoRoot, 'node_modules/@changesets/cli/bin.js');
const PACKAGE_NAMES = {
  'packages/ui/package.json': '@beemvp/beeui-ui',
  'packages/core/package.json': '@beemvp/beeui-core',
  'packages/tokens/package.json': '@beemvp/beeui-tokens',
  'packages/cli/package.json': '@beemvp/beeui-cli',
};

function writeJson(rootDir, relPath, value) {
  const file = path.join(rootDir, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readVersion(rootDir, relPath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relPath), 'utf8')).version;
}

// A minimal workspace with the real release policy, the real Changesets config and the four
// lockstep manifests at `version`.
function makeWorkspace(version) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-version-packages-'));
  for (const relPath of ['docs/dist-tag-policy.md', 'docs/registry-observation.json', '.changeset/config.json']) {
    fs.mkdirSync(path.dirname(path.join(rootDir, relPath)), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relPath), path.join(rootDir, relPath));
  }
  fs.writeFileSync(path.join(rootDir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  writeJson(rootDir, 'package.json', { name: 'beeui-workspace', private: true, version });
  writeJson(rootDir, 'web/worker/package.json', { name: 'worker', private: true, version });
  for (const [relPath, name] of Object.entries(PACKAGE_NAMES)) writeJson(rootDir, relPath, { name, version });
  // The leftover-literal report reads tracked files with `git grep`.
  execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
  return rootDir;
}

function setLockstep(rootDir, version) {
  for (const [relPath, name] of Object.entries(PACKAGE_NAMES)) writeJson(rootDir, relPath, { name, version });
}

function addPatchChangeset(rootDir, id) {
  fs.writeFileSync(path.join(rootDir, `.changeset/${id}.md`), `---\n"@beemvp/beeui-ui": patch\n---\n\n${id}\n`);
}

function changeset(rootDir, ...args) {
  execFileSync(process.execPath, [changesetBin, ...args], { cwd: rootDir, stdio: 'pipe' });
}

test('versionPackages accepts a lockstep bump on the release line and syncs the followers', () => {
  const rootDir = makeWorkspace('0.86.2-rc.3');
  try {
    const result = versionPackages({ rootDir, generators: [], changesetVersion: (dir) => setLockstep(dir, '0.86.2-rc.4') });
    assert.equal(result.previousVersion, '0.86.2-rc.3');
    assert.equal(result.version, '0.86.2-rc.4');
    assert.deepEqual(result.syncedFollowers, ['package.json', 'web/worker/package.json']);
    assert.equal(readVersion(rootDir, 'package.json'), '0.86.2-rc.4');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('versionPackages refuses a bump that leaves the stable release line', () => {
  const rootDir = makeWorkspace('0.86.2-rc.3');
  try {
    // What a `minor` changeset produces in the middle of the 0.86.2 line.
    assert.throws(
      () => versionPackages({ rootDir, generators: [], changesetVersion: (dir) => setLockstep(dir, '0.87.0-rc.0') }),
      /0\.87\.0-rc\.0 is not valid for the 0\.86\.2 release line/,
    );
    assert.equal(readVersion(rootDir, 'package.json'), '0.86.2-rc.3', 'followers must not move on a rejected bump');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('versionPackages refuses a run with no pending changeset', () => {
  const rootDir = makeWorkspace('0.86.2-rc.3');
  try {
    assert.throws(() => versionPackages({ rootDir, generators: [], changesetVersion: () => {} }), /no pending changeset moved the version/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('assertLockstep names every manifest when the fixed group splits', () => {
  const rootDir = makeWorkspace('0.86.2-rc.3');
  try {
    writeJson(rootDir, 'packages/cli/package.json', { name: '@beemvp/beeui-cli', version: '0.86.2-rc.9' });
    assert.throws(() => assertLockstep(rootDir), /packages\/cli\/package\.json=0\.86\.2-rc\.9/);
    assert.equal(LOCKSTEP_MANIFESTS.length, 4);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

// The adoption gate for Changesets prerelease mode in the middle of the 0.86.2 line: the
// installed Changesets, with the real fixed group, must continue the published rc numbering and
// then land exactly on the stable version. If an upgrade changes this arithmetic, this fails
// before a bump PR does.
test('the installed Changesets continues rc numbering from the manifest and exits to the stable version', () => {
  const rootDir = makeWorkspace('0.86.2-rc.3');
  const versions = () => Object.keys(PACKAGE_NAMES).map((relPath) => readVersion(rootDir, relPath));
  try {
    changeset(rootDir, 'pre', 'enter', 'rc');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(rootDir, '.changeset/pre.json'), 'utf8')), { mode: 'pre', tag: 'rc' });

    addPatchChangeset(rootDir, 'first-fix');
    changeset(rootDir, 'version');
    assert.deepEqual(versions(), Array(4).fill('0.86.2-rc.4'));

    addPatchChangeset(rootDir, 'second-fix');
    changeset(rootDir, 'version');
    assert.deepEqual(versions(), Array(4).fill('0.86.2-rc.5'));

    changeset(rootDir, 'pre', 'exit');
    changeset(rootDir, 'version');
    assert.deepEqual(versions(), Array(4).fill('0.86.2'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
