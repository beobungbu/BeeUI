#!/usr/bin/env node
// End-to-end smoke test for the packed @beeui/cli package (#209 acceptance).
//
// Builds dist/ (if missing) and then runs the built dist/beeui.mjs binary —
// not the packages/cli/src dev source, and not the monorepo — as a child
// process against a throwaway consumer directory, proving the *published
// artifact* (bundled registry + bundled sources) works standalone:
//   - `init` creates a config,
//   - `add sheet` (a #355-affected item with a deep @beeui/tokens subpath
//     import, per docs/registry-cli.md) copies its full dependency closure,
//   - the copied source keeps a resolvable `@beeui/tokens` import and
//     reports it as a missing consumer dependency (the #355 regression this
//     CLI must not reintroduce),
//   - no `@beeui/core` or `workspace:*` leaks survive into copied source,
//   - every relative import in the copied file set resolves to a real file
//     on disk in the consumer fixture.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_BIN = path.join(PACKAGE_ROOT, 'dist', 'beeui.mjs');

function runCli(args, cwd) {
  return execFileSync(process.execPath, [DIST_BIN, ...args], { cwd, encoding: 'utf8' });
}

async function fileExists(file) {
  try {
    await readFile(file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function main() {
  if (!existsSync(DIST_BIN)) {
    execFileSync(process.execPath, [path.join(PACKAGE_ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });
  }
  assert.ok(existsSync(path.join(PACKAGE_ROOT, 'dist', 'registry', 'registry.json')), 'bundled registry.json must exist after build');

  const consumerRoot = await mkdtemp(path.join(os.tmpdir(), 'beeui-cli-smoke-'));
  try {
    const initOutput = runCli(['init'], consumerRoot);
    assert.match(initOutput, /Created beeui\.config\.json/);

    const addOutput = runCli(['add', 'sheet'], consumerRoot);
    assert.match(addOutput, /core-cn -> theme -> text -> button -> core-overlay -> overlay-runtime -> sheet/);
    assert.match(addOutput, /@beeui\/tokens@0\.1\.0 \[missing from package\.json\]/);

    const dir = path.join(consumerRoot, 'src/components/beeui');
    const requiredFiles = [
      'sheet.tsx',
      'sheet.web.tsx',
      'sheet.native.tsx',
      'button.tsx',
      'text.tsx',
      'overlay-runtime.tsx',
    ];
    for (const file of requiredFiles) {
      assert.ok(await fileExists(path.join(dir, file)), `expected copied file missing: ${file}`);
    }

    const sheetWeb = await readFile(path.join(dir, 'sheet.web.tsx'), 'utf8');
    assert.match(sheetWeb, /from '@beeui\/tokens'/, 'sheet.web.tsx must keep its resolvable @beeui/tokens import');
    assert.match(sheetWeb, /from '@beeui\/tokens\/motion-runtime'/);
    assert.doesNotMatch(sheetWeb, /@beeui\/core/);
    assert.doesNotMatch(sheetWeb, /workspace:\*/);

    // Import-resolution check is scoped to the requested item's own files
    // (matching the equivalent check in scripts/__tests__/beeui.test.mjs).
    // `overlay-runtime.tsx` is intentionally excluded here: it imports the
    // platform-suffixed `./overlay-transport` (resolved via
    // `.web.tsx`/`.native.tsx`/`.d.ts`, never a bare `.tsx`), which the naive
    // fixed-extension probe below cannot resolve.
    for (const file of ['sheet.tsx', 'sheet.web.tsx', 'sheet.native.tsx']) {
      const source = await readFile(path.join(dir, file), 'utf8');
      for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
        const base = path.resolve(dir, match[1]);
        const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
        let found = false;
        for (const candidate of candidates) {
          // eslint-disable-next-line no-await-in-loop -- small fixed candidate list, sequential is clearer than Promise.any here
          if (await fileExists(candidate)) {
            found = true;
            break;
          }
        }
        assert.ok(found, `${file}: unresolved relative import ${match[1]}`);
      }
    }

    const doctorOutput = runCli(['doctor'], consumerRoot);
    assert.match(doctorOutput, /BeeUI doctor OK/);

    process.stdout.write('@beeui/cli smoke: PASS (packed dist/beeui.mjs end-to-end add + import resolution + #355 @beeui/tokens closure)\n');
  } finally {
    await rm(consumerRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`@beeui/cli smoke: FAIL\n${error.stack ?? error}\n`);
  process.exitCode = 1;
});
