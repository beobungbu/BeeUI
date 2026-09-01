// #219: source-owned component update/diff assistance.
//
// Exercises `beeui diff`/`beeui update` end-to-end through `main()` (same
// harness style as scripts/__tests__/beeui.test.mjs) against the live
// repository registry, plus a handful of pure-function unit tests for the
// diff engine's classification/rendering helpers.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main } from '../beeui.mjs';
import {
  MANIFEST_FILENAME,
  classifyDiffEntry,
  diffLines,
  formatUnifiedDiff,
  readManifest,
} from '../../packages/cli/src/update-lib.mjs';

function capture() {
  let value = '';
  return {
    stream: { write(chunk) { value += String(chunk); } },
    value: () => value,
  };
}

async function run(projectRoot, args) {
  const stdout = capture();
  const stderr = capture();
  const code = await main(args, { cwd: projectRoot, stdout: stdout.stream, stderr: stderr.stream });
  return { code, stdout: stdout.value(), stderr: stderr.value() };
}

async function project(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'beeui-cli-diff-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

async function init(t) {
  const root = await project(t);
  assert.equal((await run(root, ['init'])).code, 0);
  return root;
}

async function withButtonAdded(t) {
  const root = await init(t);
  const addResult = await run(root, ['add', 'button']);
  assert.equal(addResult.code, 0, addResult.stderr);
  return root;
}

const buttonTarget = 'src/components/beeui/button.tsx';

test('diff reports nothing to compare before any component has been added', async (t) => {
  const root = await init(t);
  const result = await run(root, ['diff']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Nothing to diff: no components have been added/);
});

test('update reports nothing to sync before any component has been added', async (t) => {
  const root = await init(t);
  const result = await run(root, ['update']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Nothing to update: no components have been added/);
});

test('add writes a manifest recording every resolved file, including internal dependencies', async (t) => {
  const root = await withButtonAdded(t);
  const manifest = await readManifest(root);
  assert.deepEqual(Object.keys(manifest.entries).sort(), [
    'src/beeui/theme.css',
    'src/components/beeui/button.tsx',
    'src/components/beeui/text.tsx',
    'src/lib/beeui/cn.ts',
  ]);
  assert.equal(manifest.entries[buttonTarget].item, 'button');
  assert.match(manifest.entries[buttonTarget].contentHash, /^sha256:[0-9a-f]{64}$/);
});

test('diff with no explicit items reports every previously-added item as UNCHANGED', async (t) => {
  const root = await withButtonAdded(t);
  const result = await run(root, ['diff']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Comparing: button, text, theme/);
  for (const target of ['src/beeui/theme.css', buttonTarget, 'src/components/beeui/text.tsx', 'src/lib/beeui/cn.ts']) {
    assert.match(result.stdout, new RegExp(`UNCHANGED\\s+${target.replace(/\//g, '\\/')}`));
  }
  assert.doesNotMatch(result.stdout, /CONFLICT|LOCAL|UPSTREAM|MISSING|UNTRACKED/);
});

test('a local edit is classified as LOCAL and update leaves it untouched', async (t) => {
  const root = await withButtonAdded(t);
  const target = path.join(root, buttonTarget);
  const original = await readFile(target, 'utf8');
  await writeFile(target, `${original}\n// local tweak\n`, 'utf8');

  const diffResult = await run(root, ['diff', 'button']);
  assert.equal(diffResult.code, 0, diffResult.stderr);
  assert.match(diffResult.stdout, new RegExp(`LOCAL\\s+${buttonTarget.replace(/\//g, '\\/')}`));

  const updateResult = await run(root, ['update', 'button']);
  assert.equal(updateResult.code, 0, updateResult.stderr);
  assert.match(updateResult.stdout, /SKIP\s+src\/components\/beeui\/button\.tsx \(button\) — local-modified/);
  assert.equal(await readFile(target, 'utf8'), `${original}\n// local tweak\n`, 'local-modified files must never be rewritten by update');
});

test('a stale manifest baseline (simulated upstream change) is a CONFLICT once local also diverges, and only --force resolves it', async (t) => {
  const root = await withButtonAdded(t);
  const target = path.join(root, buttonTarget);
  const original = await readFile(target, 'utf8');
  await writeFile(target, `${original}\n// local tweak\n`, 'utf8');

  const manifestPath = path.join(root, MANIFEST_FILENAME);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.entries[buttonTarget].contentHash = `sha256:${'a'.repeat(64)}`;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const diffResult = await run(root, ['diff', 'button']);
  assert.equal(diffResult.code, 0, diffResult.stderr);
  assert.match(diffResult.stdout, new RegExp(`CONFLICT\\s+${buttonTarget.replace(/\//g, '\\/')}`));

  const withoutForce = await run(root, ['update', 'button']);
  assert.equal(withoutForce.code, 0, withoutForce.stderr);
  assert.match(withoutForce.stdout, /SKIP\*\s+src\/components\/beeui\/button\.tsx \(button\) — conflict/);
  assert.match(withoutForce.stdout, /rerun with 'beeui update --force'/);
  assert.equal(await readFile(target, 'utf8'), `${original}\n// local tweak\n`, 'a conflict must never be overwritten without --force');

  const withForce = await run(root, ['update', '--force', 'button']);
  assert.equal(withForce.code, 0, withForce.stderr);
  assert.match(withForce.stdout, /UPDATE\s+src\/components\/beeui\/button\.tsx \(button\) — conflict/);
  assert.equal(await readFile(target, 'utf8'), original, '--force must restore the canonical upstream content');

  const restoredManifest = await readManifest(root);
  assert.notEqual(restoredManifest.entries[buttonTarget].contentHash, `sha256:${'a'.repeat(64)}`, 'update must refresh the manifest baseline after a forced write');

  const cleanDiff = await run(root, ['diff', 'button']);
  assert.doesNotMatch(cleanDiff.stdout, /CONFLICT/);
});

test('diff on an item never added reports every file as NEW, and update can add it', async (t) => {
  const root = await init(t);
  const diffResult = await run(root, ['diff', 'button']);
  assert.equal(diffResult.code, 0, diffResult.stderr);
  assert.match(diffResult.stdout, new RegExp(`NEW\\s+${buttonTarget.replace(/\//g, '\\/')}`));
  assert.equal(await run(root, ['update', 'button']).then((r) => r.code), 0);
  assert.equal(await readFile(path.join(root, buttonTarget), 'utf8').then(() => true, () => false), true);
});

test('a tracked file deleted from disk is MISSING, and update restores it without --force', async (t) => {
  const root = await withButtonAdded(t);
  const target = path.join(root, 'src/components/beeui/text.tsx');
  await rm(target);

  const diffResult = await run(root, ['diff']);
  assert.match(diffResult.stdout, /MISSING\s+src\/components\/beeui\/text\.tsx/);

  const dryRun = await run(root, ['update', '--dry-run']);
  assert.equal(dryRun.code, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /UPDATE\s+src\/components\/beeui\/text\.tsx \(text\) — missing/);
  assert.match(dryRun.stdout, /Dry run: no files were written/);
  assert.equal(
    await readFile(target, 'utf8').then(() => true, () => false),
    false,
    '--dry-run must not restore the missing file',
  );

  const result = await run(root, ['update']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(await readFile(target, 'utf8'), /export/);
});

test('an untracked pre-existing file at a registry destination is UNTRACKED, and only --force adopts it', async (t) => {
  const root = await init(t);
  const target = path.join(root, buttonTarget);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, '// pre-existing, never added by beeui\n', 'utf8');

  const diffResult = await run(root, ['diff', 'button']);
  assert.match(diffResult.stdout, new RegExp(`UNTRACKED\\s+${buttonTarget.replace(/\//g, '\\/')}`));

  const withoutForce = await run(root, ['update', 'button']);
  assert.match(withoutForce.stdout, /SKIP\*\s+src\/components\/beeui\/button\.tsx \(button\) — untracked-conflict/);
  assert.equal(await readFile(target, 'utf8'), '// pre-existing, never added by beeui\n');

  const withForce = await run(root, ['update', '--force', 'button']);
  assert.equal(withForce.code, 0, withForce.stderr);
  assert.doesNotMatch(await readFile(target, 'utf8'), /pre-existing, never added/);
});

test('local content that happens to already match upstream is SYNCED, not a conflict', async (t) => {
  const root = await withButtonAdded(t);
  const manifestPath = path.join(root, MANIFEST_FILENAME);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.entries[buttonTarget].contentHash = `sha256:${'a'.repeat(64)}`;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const result = await run(root, ['diff', 'button']);
  assert.match(result.stdout, new RegExp(`SYNCED\\s+${buttonTarget.replace(/\//g, '\\/')}`));
  assert.doesNotMatch(result.stdout, /CONFLICT/);

  const updateResult = await run(root, ['update', 'button']);
  assert.equal(updateResult.code, 0, updateResult.stderr);
  assert.match(updateResult.stdout, /SKIP\s+src\/components\/beeui\/button\.tsx \(button\) — local-matches-upstream/);
});

test('an unknown diff/update option fails clearly without mutation', async (t) => {
  const root = await withButtonAdded(t);
  const diffResult = await run(root, ['diff', '--bogus']);
  assert.equal(diffResult.code, 1);
  assert.match(diffResult.stderr, /unknown diff option '--bogus'/);

  const updateResult = await run(root, ['update', '--bogus']);
  assert.equal(updateResult.code, 1);
  assert.match(updateResult.stderr, /unknown update option '--bogus'/);
});

test('a malformed beeui.manifest.json fails clearly rather than being guessed at', async (t) => {
  const root = await withButtonAdded(t);
  await writeFile(path.join(root, MANIFEST_FILENAME), '{ not json', 'utf8');
  const result = await run(root, ['diff']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /malformed beeui\.manifest\.json/);
});

test('an unsupported beeui.manifest.json schemaVersion fails clearly rather than being migrated automatically', async (t) => {
  const root = await withButtonAdded(t);
  const manifestPath = path.join(root, MANIFEST_FILENAME);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.schemaVersion = 2;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  const result = await run(root, ['diff']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /unsupported beeui\.manifest\.json schemaVersion '2'/);
});

test('a symlinked beeui.manifest.json is rejected rather than followed', async (t) => {
  const root = await withButtonAdded(t);
  const manifestPath = path.join(root, MANIFEST_FILENAME);
  const real = await readFile(manifestPath, 'utf8');
  const decoyPath = path.join(root, 'decoy-manifest.json');
  await writeFile(decoyPath, real, 'utf8');
  await rm(manifestPath);
  await symlink(decoyPath, manifestPath);

  const result = await run(root, ['diff']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /manifest crosses symbolic link/);
});

test('diff/update require an initialized project, matching add', async (t) => {
  const root = await project(t);
  const diffResult = await run(root, ['diff']);
  assert.equal(diffResult.code, 1);
  assert.match(diffResult.stderr, /BeeUI is not initialized in this project/);

  const updateResult = await run(root, ['update']);
  assert.equal(updateResult.code, 1);
  assert.match(updateResult.stderr, /BeeUI is not initialized in this project/);
});

test('help output documents diff and update', async (t) => {
  const root = await project(t);
  const result = await run(root, ['help']);
  for (const needle of ['beeui diff', 'beeui update', 'beeui update --force']) {
    assert.ok(result.stdout.includes(needle), `help output missing '${needle}'`);
  }
});

test('classifyDiffEntry covers every (baseline, local, registry) triangle deterministically', () => {
  assert.equal(classifyDiffEntry({ registryContent: 'a', localContent: null, baselineHash: null }).status, 'new');
  assert.equal(classifyDiffEntry({ registryContent: 'a', localContent: null, baselineHash: 'sha256:x' }).status, 'missing');
  assert.equal(classifyDiffEntry({ registryContent: 'a', localContent: 'a', baselineHash: null }).status, 'unchanged');
  assert.equal(classifyDiffEntry({ registryContent: 'a', localContent: 'b', baselineHash: null }).status, 'untracked-conflict');

  const baseline = classifyDiffEntry({ registryContent: 'a', localContent: 'a', baselineHash: null }).localHash;
  assert.equal(classifyDiffEntry({ registryContent: 'a', localContent: 'a', baselineHash: baseline }).status, 'unchanged');
  assert.equal(classifyDiffEntry({ registryContent: 'b', localContent: 'a', baselineHash: baseline }).status, 'upstream-changed');
  assert.equal(classifyDiffEntry({ registryContent: 'a', localContent: 'c', baselineHash: baseline }).status, 'local-modified');
  assert.equal(classifyDiffEntry({ registryContent: 'c', localContent: 'c', baselineHash: baseline }).status, 'local-matches-upstream');
  assert.equal(classifyDiffEntry({ registryContent: 'b', localContent: 'c', baselineHash: baseline }).status, 'conflict');
});

test('diffLines produces a minimal, deterministic line-level edit script', () => {
  const lines = diffLines('a\nb\nc\n', 'a\nx\nc\n');
  assert.deepEqual(lines, ['  a', '- b', '+ x', '  c', '  ']);
});

test('formatUnifiedDiff collapses long unchanged runs but keeps context around each change', () => {
  const before = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
  const after = before.replace('line10', 'CHANGED');
  const formatted = formatUnifiedDiff(before, after, { context: 2 });
  assert.ok(formatted.some((line) => /unchanged line/.test(line)), 'expected a collapsed-context summary line');
  assert.ok(formatted.some((line) => line === '- line10'));
  assert.ok(formatted.some((line) => line === '+ CHANGED'));
  assert.ok(formatted.some((line) => line === '  line8'), 'expected 2 lines of leading context');
  assert.ok(formatted.some((line) => line === '  line12'), 'expected 2 lines of trailing context');
});
