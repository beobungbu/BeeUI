#!/usr/bin/env node
// End-to-end smoke test for the packed @beemvp/beeui-cli package (#209 acceptance).
//
// Builds dist/ (if missing) and then runs the built dist/beeui.mjs binary —
// not the packages/cli/src dev source, and not the monorepo — as a child
// process against a throwaway consumer directory, proving the *published
// artifact* (bundled registry + bundled sources) works standalone:
//   - `init` creates a config,
//   - `add sheet` (a #355-affected item with a deep @beemvp/beeui-tokens subpath
//     import, per docs/registry-cli.md) copies its full dependency closure,
//   - the copied source keeps a resolvable `@beemvp/beeui-tokens` import and
//     reports it as a missing consumer dependency (the #355 regression this
//     CLI must not reintroduce),
//   - no `@beemvp/beeui-core` or `workspace:*` leaks survive into copied source,
//   - every relative import in the copied file set resolves to a real file
//     on disk in the consumer fixture.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_BIN = path.join(PACKAGE_ROOT, 'dist', 'beeui.mjs');

function runCli(args, cwd) {
  // `stdio: ['ignore', 'pipe', 'pipe']` is explicit rather than relying on the
  // 'pipe' shorthand default: Node's synchronous execFileSync additionally
  // streams a child's stderr straight through to this process's own real
  // stderr as it runs (independent of the captured `.stderr` buffer used on
  // throw), which would otherwise make every expected-failure adversarial
  // check below print its "BeeUI CLI error: ..." line to the console even
  // though the smoke test itself passes — confusing to read even though
  // harmless.
  return execFileSync(process.execPath, [DIST_BIN, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Runs the packed CLI expecting a non-zero exit and returns its stderr, so
// adversarial cases can assert on the *reason* for failure rather than only
// "it failed". `execFileSync` throws on non-zero exit with `.stderr`/`.status`
// populated; any other kind of thrown error (e.g. an assertion from the
// caller's own success branch) is rethrown unchanged.
function runCliExpectFailure(args, cwd) {
  try {
    runCli(args, cwd);
  } catch (error) {
    if (typeof error.status !== 'number') throw error;
    return String(error.stderr ?? '');
  }
  throw new Error(`expected 'beeui ${args.join(' ')}' to fail, but it exited 0`);
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
    assert.match(addOutput, /@beemvp\/beeui-tokens@0\.1\.0 \[missing from package\.json\]/);

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
    assert.match(sheetWeb, /from '@beemvp\/beeui-tokens'/, 'sheet.web.tsx must keep its resolvable @beemvp/beeui-tokens import');
    assert.match(sheetWeb, /from '@beemvp\/beeui-tokens\/motion-runtime'/);
    assert.doesNotMatch(sheetWeb, /@beemvp\/beeui-core/);
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
    // #216: the packed artifact must report its bundled registry delivery
    // mode and that its checksum manifest was actually swept, not just print
    // a generic "OK".
    assert.match(doctorOutput, /registry delivery: bundled \(\d+ source checksums verified\)/);

    // #210: `version`/`--version`/`-v` all report the packed package's own
    // name/version (read from its own package.json, never hardcoded/faked).
    const packedManifest = JSON.parse(await readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
    for (const flag of ['version', '--version', '-v']) {
      // eslint-disable-next-line no-await-in-loop -- small fixed list, sequential subprocess calls
      const versionOutput = runCli([flag], consumerRoot);
      assert.equal(versionOutput.trim(), `${packedManifest.name} ${packedManifest.version}`);
    }

  } finally {
    await rm(consumerRoot, { recursive: true, force: true });
  }

  await runIntegrityTamperChecks();

  process.stdout.write(
    '@beemvp/beeui-cli smoke: PASS (packed dist/beeui.mjs end-to-end add + import resolution + #355 @beemvp/beeui-tokens closure ' +
      '+ #216 tampered-bundle rejection)\n',
  );
}

// #216 adversarial check: the packed CLI ships a sha256 checksum manifest
// (dist/registry/integrity.json) alongside its bundled registry/sources.
// Tampering with either a bundled source file or the bundled registry.json
// itself after the build (simulating a corrupted install or a supply-chain
// modification of the installed package) must be detected and rejected —
// never silently copied into a consumer project, and never silently loaded.
// This mutates real files under `dist/` and always restores them, even on
// failure, so a real build artifact is exercised without leaving the
// repository's working tree dirty.
async function withRestoredFile(filePath, mutate) {
  const original = await readFile(filePath, 'utf8');
  try {
    await mutate(original);
  } finally {
    await writeFile(filePath, original, 'utf8');
  }
}

async function runIntegrityTamperChecks() {
  const tamperedSource = path.join(PACKAGE_ROOT, 'dist', 'registry', 'sources', 'packages/ui/src/components/button.tsx');
  await withRestoredFile(tamperedSource, async (original) => {
    await writeFile(tamperedSource, `${original}\n// tampered by cli smoke integrity check\n`, 'utf8');
    const consumerRoot = await mkdtemp(path.join(os.tmpdir(), 'beeui-cli-smoke-tamper-source-'));
    try {
      runCli(['init'], consumerRoot);
      const stderr = runCliExpectFailure(['add', 'button'], consumerRoot);
      assert.match(stderr, /registry integrity check failed: bundled source 'packages\/ui\/src\/components\/button\.tsx' checksum mismatch/);
      assert.ok(
        !existsSync(path.join(consumerRoot, 'src/components/beeui/button.tsx')),
        'tampered source must not be copied into the consumer project',
      );
    } finally {
      await rm(consumerRoot, { recursive: true, force: true });
    }
  });

  const registryPath = path.join(PACKAGE_ROOT, 'dist', 'registry', 'registry.json');
  await withRestoredFile(registryPath, async (original) => {
    await writeFile(registryPath, `${original}\n`, 'utf8');
    const consumerRoot = await mkdtemp(path.join(os.tmpdir(), 'beeui-cli-smoke-tamper-registry-'));
    try {
      const stderr = runCliExpectFailure(['list'], consumerRoot);
      assert.match(stderr, /registry integrity check failed: bundled registry\.json checksum mismatch/);
    } finally {
      await rm(consumerRoot, { recursive: true, force: true });
    }
  });
}

main().catch((error) => {
  process.stderr.write(`@beemvp/beeui-cli smoke: FAIL\n${error.stack ?? error}\n`);
  process.exitCode = 1;
});
