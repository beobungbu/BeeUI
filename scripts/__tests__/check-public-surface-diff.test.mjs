import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  breakingFloor,
  classifyDiff,
  collectSurfaceDiffViolations,
  diffInventories,
  parseArgs,
  parseChangeset,
  readAddedChangesets,
  readBaseInventory,
} from '../check-public-surface-diff.mjs';

const row = (id, extra = {}) => ({ id, kind: 'ui-value', name: id, package: '@beemvp/beeui-ui', classification: 'consumer', family: 'x', ...extra });
const inventory = (...rows) => ({ schemaVersion: 1, rows });
const changeset = (bumps) => [{ name: 'x.md', bumps }];
const violations = (diff, changesets, rootVersion = '0.86.2') => collectSurfaceDiffViolations({ diff, changesets, rootVersion });

test('a removed row is breaking', () => {
  const diff = diffInventories(inventory(row('a'), row('b')), inventory(row('a')));
  assert.deepEqual(diff.removed, ['b']);
  assert.equal(classifyDiff(diff), 'breaking');
});

test('losing the root barrel while a subpath remains is breaking', () => {
  // Removing `alertBannerVariants` from `packages/ui/src/index.ts` kept the id — the row swapped
  // `family` for `subpath` — and the first version of this check read that as "none".
  const before = row('a', { family: 'alert-banner' });
  const after = { ...row('a'), family: undefined, subpath: './alert-banner' };
  delete after.family;
  const diff = diffInventories(inventory(before), inventory(after));
  assert.deepEqual(diff.changed, [{ id: 'a', what: 'reach', from: 'root', to: 'subpath:./alert-banner' }]);
  assert.equal(classifyDiff(diff), 'breaking');
});

test('a classification change needs a changeset but not a breaking bump; a package change is breaking', () => {
  // The nine values are all public-facing and three are list-driven from
  // docs/public-surface-owners.json; a move between them changes documentation, not reach.
  const demoted = diffInventories(inventory(row('a')), inventory(row('a', { classification: 'advanced-consumer' })));
  assert.equal(classifyDiff(demoted), 'additive');
  assert.equal(violations(demoted, []).length, 1);
  assert.deepEqual(violations(demoted, changeset({ '@beemvp/beeui-ui': 'patch' })), []);
  const moved = diffInventories(inventory(row('a')), inventory(row('a', { package: '@beemvp/beeui-core' })));
  assert.equal(classifyDiff(moved), 'breaking');
});

test('an added row is additive, and metadata changes are nothing', () => {
  assert.equal(classifyDiff(diffInventories(inventory(row('a')), inventory(row('a'), row('b')))), 'additive');
  const relocated = row('a', { source: 'elsewhere.tsx', primaryDocsOwner: '/docs/x/', ownerStatus: 'planned' });
  assert.equal(classifyDiff(diffInventories(inventory(row('a')), inventory(relocated))), 'none');
});

test('the bump a removal needs follows the workspace major', () => {
  // Written assuming 0.x while the workspace major was 20260902, where `minor` is a compatible
  // upgrade for every caret range and would have auto-installed the removal.
  assert.deepEqual(breakingFloor('0.86.2'), ['minor', 'major']);
  assert.deepEqual(breakingFloor('1.0.0'), ['major']);
  assert.deepEqual(breakingFloor('20260902.0.0'), ['major']);
});

test('a breaking diff needs a changeset at or above the floor on a public package', () => {
  const diff = diffInventories(inventory(row('a')), inventory());
  assert.equal(violations(diff, []).length, 1);
  assert.equal(violations(diff, changeset({ '@beemvp/beeui-ui': 'patch' })).length, 1, 'a patch does not cover a removal');
  assert.deepEqual(violations(diff, changeset({ '@beemvp/beeui-ui': 'minor' })), []);
  assert.equal(violations(diff, changeset({ '@beemvp/beeui-ui': 'minor' }), '20260902.0.0').length, 1, 'on a non-0.x major only major covers it');
  assert.deepEqual(violations(diff, changeset({ '@beemvp/beeui-ui': 'major' }), '20260902.0.0'), []);
  assert.equal(violations(diff, changeset({ 'some-other-pkg': 'major' })).length, 1, 'a non-public package does not count');
  assert.match(violations(diff, [])[0], /removed a/u, 'the message names what broke');
});

test('an additive diff needs any changeset on a public package', () => {
  const diff = diffInventories(inventory(), inventory(row('a')));
  assert.equal(violations(diff, []).length, 1);
  assert.deepEqual(violations(diff, changeset({ '@beemvp/beeui-ui': 'patch' })), []);
});

test('changeset frontmatter is read with or without quotes', () => {
  assert.deepEqual(parseChangeset('---\n"@beemvp/beeui-ui": minor\n\'@beemvp/beeui-core\': patch\n---\n\nnote\n'), {
    '@beemvp/beeui-ui': 'minor',
    '@beemvp/beeui-core': 'patch',
  });
  assert.deepEqual(parseChangeset('no frontmatter'), {});
});

test('only changesets added relative to the base count', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-changesets-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'base');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, '.changeset'));
  fs.writeFileSync(path.join(dir, '.changeset/stale.md'), '---\n"@beemvp/beeui-ui": minor\n---\nold\n');
  fs.writeFileSync(path.join(dir, '.changeset/README.md'), 'readme');
  git('add', '.'); git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'work');
  fs.writeFileSync(path.join(dir, '.changeset/fresh.md'), '---\n"@beemvp/beeui-core": patch\n---\nnew\n');
  git('add', '.'); git('commit', '-q', '-m', 'work');
  fs.writeFileSync(path.join(dir, '.changeset/local.md'), '---\n"@beemvp/beeui-cli": major\n---\nuncommitted\n');

  const names = readAddedChangesets('base', dir).map((entry) => entry.name).sort();

  // A pending `minor` already on the base branch used to satisfy every later breaking change.
  assert.deepEqual(names, ['.changeset/fresh.md', '.changeset/local.md']);

  // `changeset version` deletes what it consumes; a name in the base diff may no longer exist.
  fs.unlinkSync(path.join(dir, '.changeset/fresh.md'));
  assert.deepEqual(readAddedChangesets('base', dir).map((entry) => entry.name), ['.changeset/local.md']);
});

test('the base is fetched on demand in a shallow checkout, and named when that fails', () => {
  const upstream = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-upstream-'));
  const g = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  g(upstream, 'init', '-q', '-b', 'development'); g(upstream, 'config', 'user.email', 't@t'); g(upstream, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(upstream, 'docs'));
  fs.writeFileSync(path.join(upstream, 'docs/public-surface.inventory.json'), JSON.stringify(inventory(row('a'))));
  g(upstream, 'add', '.'); g(upstream, 'commit', '-q', '-m', 'base');
  const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-shallow-'));
  execFileSync('git', ['clone', '-q', '--depth=1', '--no-tags', '--branch', 'development', upstream, shallow], { stdio: 'ignore' });
  // A depth-1 clone of a branch still carries origin/<branch>; drop it to model a CI checkout of a sha.
  g(shallow, 'update-ref', '-d', 'refs/remotes/origin/development');

  assert.deepEqual(readBaseInventory('origin/development', shallow).rows.map((r) => r.id), ['a']);
  assert.throws(() => readBaseInventory('origin/nope', shallow), /could not be fetched/u);
});

test('a missing base ref or inventory fails with a sentence, not a stack', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-noref-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  assert.throws(() => readBaseInventory('does-not-exist', dir), /base ref "does-not-exist" is not available locally/u);
  assert.throws(() => parseArgs(['--base']), /--base needs a ref/u);
  assert.deepEqual(parseArgs([]), { ref: 'origin/development' });
});


test('the root, worker and Expo identities follow the packages after a bump', async () => {
  const { syncRootVersion } = await import('../sync-root-version.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-sync-'));
  for (const [file, body] of [
    ['packages/ui/package.json', '{\n  "name": "@beemvp/beeui-ui",\n  "version": "0.87.0"\n}\n'],
    ['package.json', '{\n  "name": "beeui-workspace",\n  "private": true,\n  "version": "0.86.2"\n}\n'],
    ['web/worker/package.json', '{ "version": "0.86.2" }\n'],
    ['apps/demo/app.json', '{\n  "expo": {\n    "name": "demo",\n    "version": "0.86.2"\n  }\n}\n'],
  ]) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), body);
  }

  const result = syncRootVersion(dir);

  // `changeset version` cannot reach these: the root is private and not a workspace member.
  assert.equal(result.version, '0.87.0');
  assert.deepEqual(result.changed.sort(), ['apps/demo/app.json', 'package.json', 'web/worker/package.json']);
  assert.match(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), /"private": true,\n  "version": "0.87.0"/u, 'only the version value changes');
  assert.deepEqual(syncRootVersion(dir).changed, [], 'idempotent');
});
