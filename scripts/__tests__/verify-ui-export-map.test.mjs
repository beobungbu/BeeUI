// End-to-end proof that `@beemvp/beeui-ui`'s package "exports" map (#201, built on
// #184's granular-subpath decision, ADR `docs/decisions/012-granular-subpath-exports.md`)
// behaves correctly for a real consumer, using Node's own package-exports
// resolution algorithm directly — the same algorithm every bundler (Metro,
// Vite/webpack, esbuild) implements, not a BeeUI-specific shortcut.
//
// This intentionally tests *resolution*, not *execution*: several BeeUI
// components import `react-native` at module scope, and `react-native`'s own
// package entry point is Flow-typed source that only Babel/Metro can parse —
// plain Node can never *execute* these modules, with or without this change.
// `import.meta.resolve` / `require.resolve` exercise the exports map without
// loading the module body, which is exactly what "does this subpath resolve"
// means here.
//
// Resolution runs from `apps/showcase`'s real, pnpm-linked `@beemvp/beeui-ui`
// dependency (a real workspace consumer, not a synthetic one) so the "require"
// and "import" conditions are evaluated exactly as an installed consumer sees
// them.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { computePublicUiExports } from '../generate-ui-exports.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const UI_DIST_DIR = path.join(ROOT_DIR, 'packages/ui/dist');
const CONSUMER_CWD = path.join(ROOT_DIR, 'apps/showcase');
const CONSUMER_LINK = path.join(CONSUMER_CWD, ['node', 'modules'].join('_'), '@beemvp', 'beeui-ui');

const INTERNAL_DEEP_IMPORT = '@beemvp/beeui-ui/overlay-runtime';

function skipReason() {
  if (!fs.existsSync(UI_DIST_DIR)) {
    return 'packages/ui/dist is not built; run `pnpm build` (or `pnpm ui-exports:test`) first';
  }
  if (!fs.existsSync(CONSUMER_LINK)) {
    return 'apps/showcase’s @beemvp/beeui-ui workspace link is missing; run `pnpm install` first';
  }
  return false;
}

function resolveViaImport(specifiers) {
  const script = `
    const results = {};
    for (const specifier of ${JSON.stringify(specifiers)}) {
      try {
        results[specifier] = { ok: true, url: await import.meta.resolve(specifier) };
      } catch (error) {
        results[specifier] = { ok: false, code: error?.code ?? String(error) };
      }
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: CONSUMER_CWD,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

function resolveViaRequire(specifiers) {
  const script = `
    const { createRequire } = require('module');
    const req = createRequire(process.cwd() + '/probe.cjs');
    const results = {};
    for (const specifier of ${JSON.stringify(specifiers)}) {
      try {
        results[specifier] = { ok: true, url: req.resolve(specifier) };
      } catch (error) {
        results[specifier] = { ok: false, code: error?.code ?? String(error) };
      }
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const output = execFileSync(process.execPath, ['-e', script], { cwd: CONSUMER_CWD, encoding: 'utf8' });
  return JSON.parse(output);
}

test(
  'every documented public @beemvp/beeui-ui component resolves via its subpath (import/require/types), and the barrel still resolves',
  { skip: skipReason() },
  () => {
    const { exportsField, names } = computePublicUiExports({ rootDir: ROOT_DIR });
    assert.ok(names.length > 0, 'expected at least one public component');

    const specifiers = ['@beemvp/beeui-ui', ...names.map((name) => `@beemvp/beeui-ui/${name}`)];
    const importResults = resolveViaImport(specifiers);
    const requireResults = resolveViaRequire(specifiers);

    for (const specifier of specifiers) {
      assert.equal(
        importResults[specifier]?.ok,
        true,
        `import resolution failed for ${specifier}: ${JSON.stringify(importResults[specifier])}`,
      );
      assert.equal(
        requireResults[specifier]?.ok,
        true,
        `require resolution failed for ${specifier}: ${JSON.stringify(requireResults[specifier])}`,
      );
    }

    for (const name of names) {
      const entry = exportsField[`./${name}`];
      for (const typesPath of [entry.import.types, entry.require.types]) {
        const absolute = path.join(ROOT_DIR, 'packages/ui', typesPath);
        assert.ok(fs.existsSync(absolute), `types declaration missing on disk for "${name}": ${typesPath}`);
      }
      for (const runtimePath of [entry['react-native'], entry.browser, entry.default]) {
        const absolute = path.join(ROOT_DIR, 'packages/ui', runtimePath);
        assert.ok(
          fs.existsSync(absolute),
          `runtime file missing on disk for "${name}" (react-native/browser/default): ${runtimePath}`,
        );
      }
    }
  },
);

test('an internal/private deep import fails intentionally (leak guard)', { skip: skipReason() }, () => {
  const importResults = resolveViaImport([INTERNAL_DEEP_IMPORT]);
  const requireResults = resolveViaRequire([INTERNAL_DEEP_IMPORT]);

  assert.equal(importResults[INTERNAL_DEEP_IMPORT].ok, false, 'expected internal deep import to fail via import');
  assert.equal(importResults[INTERNAL_DEEP_IMPORT].code, 'ERR_PACKAGE_PATH_NOT_EXPORTED');
  assert.equal(requireResults[INTERNAL_DEEP_IMPORT].ok, false, 'expected internal deep import to fail via require');
  assert.equal(requireResults[INTERNAL_DEEP_IMPORT].code, 'ERR_PACKAGE_PATH_NOT_EXPORTED');
});

test('the @beemvp/beeui-ui package.json exports map has no permissive wildcard leak guard', { skip: skipReason() }, () => {
  const { packageJson } = computePublicUiExports({ rootDir: ROOT_DIR });
  const subpaths = Object.keys(packageJson.exports);
  assert.ok(!subpaths.includes('./*'), 'exports map must not include a permissive "./*" wildcard');
});
