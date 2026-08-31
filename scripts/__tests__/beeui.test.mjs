import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkNodeVersion, main } from '../beeui.mjs';
import {
  CONFIG_FILENAME,
  REPO_ROOT,
  buildAddPlan,
  loadRegistry,
  publicItems,
  readConfig,
  validateRegistry,
  verifyRegistrySourceIntegrity,
} from '../registry-lib.mjs';

function sha256Hex(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// Builds a minimal, self-contained "bundled mode" fixture (registry.json +
// one source file + a matching sha256 integrity.json) in a fresh temp
// directory, mirroring the shape `packages/cli/scripts/build.mjs` produces
// for a real published package. Used to unit-test the #216 integrity
// verification path without requiring a full `pnpm --filter @beeui/cli run
// build` (that end-to-end path is covered separately by `pnpm cli:smoke`).
async function integrityFixture(t) {
  // Canonicalize: on macOS, os.tmpdir() paths often cross a symlinked segment
  // (e.g. `/var` -> `/private/var`), and validateRegistry()'s source-realpath
  // check compares this directory against the *realpath* of files inside it —
  // an un-canonicalized `dir` would spuriously look like it "escapes" itself.
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'beeui-integrity-')));
  t.after(async () => rm(dir, { recursive: true, force: true }));

  const sourceRelative = 'demo.tsx';
  const sourceContent = 'export const Demo = 1;\n';
  await writeFile(path.join(dir, sourceRelative), sourceContent, 'utf8');

  const registry = {
    schemaVersion: 1,
    items: [
      {
        name: 'demo',
        type: 'component',
        public: true,
        files: [
          {
            source: sourceRelative,
            target: { root: 'components', path: 'demo.tsx' },
            transforms: [],
          },
        ],
        registryDependencies: [],
        dependencies: {},
        peerDependencies: {},
      },
    ],
  };
  const registryPath = path.join(dir, 'registry.json');
  const rawRegistry = `${JSON.stringify(registry, null, 2)}\n`;
  await writeFile(registryPath, rawRegistry, 'utf8');

  const integrityPath = path.join(dir, 'integrity.json');
  const manifest = {
    schemaVersion: 1,
    algorithm: 'sha256',
    cliVersion: '0.0.0-fixture',
    registry: sha256Hex(rawRegistry),
    sources: { [sourceRelative]: sha256Hex(sourceContent) },
  };
  await writeFile(integrityPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { dir, registryPath, integrityPath, sourceRelative, sourceContent, manifest, rawRegistry };
}

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
  const root = await mkdtemp(path.join(os.tmpdir(), 'beeui-cli-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

async function init(t) {
  const root = await project(t);
  const result = await run(root, ['init']);
  assert.equal(result.code, 0, result.stderr);
  return root;
}

async function exists(file) {
  try {
    await readFile(file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function canonicalRegistryObject() {
  return JSON.parse(await readFile(path.join(REPO_ROOT, 'registry', 'registry.json'), 'utf8'));
}

test('checkNodeVersion accepts the tested Node 24 line', () => {
  assert.doesNotThrow(() => checkNodeVersion('v24.13.1'));
  assert.doesNotThrow(() => checkNodeVersion('v25.0.0'));
});

test('checkNodeVersion rejects an unsupported Node major with an actionable message', () => {
  assert.throws(() => checkNodeVersion('v22.10.0'), /unsupported Node\.js version v22\.10\.0.*Node >=24/s);
  assert.throws(() => checkNodeVersion('v18.20.4'), /unsupported Node\.js version/);
});

test('main() surfaces the Node-version error through the CLI error path', async (t) => {
  const root = await project(t);
  const originalVersion = process.version;
  Object.defineProperty(process, 'version', { value: 'v20.0.0', configurable: true });
  try {
    const result = await run(root, ['help']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /unsupported Node\.js version v20\.0\.0/);
  } finally {
    Object.defineProperty(process, 'version', { value: originalVersion, configurable: true });
  }
});

test('init creates a deterministic config in a clean project', async (t) => {
  const root = await project(t);
  const result = await run(root, ['init']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, CONFIG_FILENAME), 'utf8')), {
    schemaVersion: 1,
    componentsDir: 'src/components/beeui',
    libDir: 'src/lib/beeui',
    themeFile: 'src/beeui/theme.css',
  });
});

test('repeated init is idempotent', async (t) => {
  const root = await init(t);
  const before = await readFile(path.join(root, CONFIG_FILENAME), 'utf8');
  const second = await run(root, ['init']);
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /already exists and is valid; nothing changed/);
  assert.equal(await readFile(path.join(root, CONFIG_FILENAME), 'utf8'), before);
});

test('list output is stable and sorted', async (t) => {
  const root = await project(t);
  const first = await run(root, ['list']);
  const second = await run(root, ['list']);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  const names = first.stdout.trim().split('\n');
  assert.deepEqual(names, [
    'accordion', 'alert-banner', 'alert-dialog', 'app-header', 'avatar', 'badge',
    'bottom-action-bar', 'box', 'breadcrumb', 'button', 'calendar', 'card', 'checkbox', 'chip', 'collapsible',
    'date-picker', 'date-time-picker', 'description-list', 'dialog', 'dropdown-menu', 'field', 'form-group', 'form-message',
    'icon-button', 'input', 'keyboard-aware-screen', 'label', 'link', 'list-group', 'list-item', 'metadata-row',
    'otp-input', 'pagination', 'password-input', 'popover', 'progress', 'radio', 'safe-area',
    'screen', 'search-input', 'section', 'segmented-control', 'select', 'separator', 'sheet', 'skeleton',
    'spinner', 'stack', 'stat', 'state-message', 'stepper', 'switch', 'table', 'tabs', 'text', 'textarea',
    'theme', 'theme-scope', 'timeline', 'toast', 'tooltip', 'use-bee-token', 'visually-hidden',
  ]);
});

test('add theme explicitly copies canonical token CSS', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'theme']);
  assert.equal(result.code, 0, result.stderr);
  const theme = await readFile(path.join(root, 'src/beeui/theme.css'), 'utf8');
  assert.match(theme, /--color-primary:/);
  assert.match(result.stdout, /tailwindcss@>=4 <5/);
  assert.match(result.stdout, /uniwind@>=1\.10\.1 <2/);
});

test('add button copies the source-owned vertical slice', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'button']);
  assert.equal(result.code, 0, result.stderr);
  for (const relative of [
    'src/components/beeui/button.tsx',
    'src/components/beeui/text.tsx',
    'src/lib/beeui/cn.ts',
    'src/beeui/theme.css',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);
  assert.match(result.stdout, /class-variance-authority@0\.7\.1/);
  assert.match(result.stdout, /clsx@2\.1\.1/);
  assert.match(result.stdout, /tailwind-merge@3\.6\.0/);
});

test('button resolves Text, core cn, and theme transitively', async (t) => {
  const root = await init(t);
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const config = await readConfig(root);
  const plan = await buildAddPlan({ projectRoot: root, registry, config, requestedItems: ['button'] });
  assert.deepEqual(plan.resolvedItems, ['core-cn', 'theme', 'text', 'button']);
});

test('add multiple components resolves a union without duplicate writes', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'card', 'badge']);
  assert.equal(result.code, 0, result.stderr);
  for (const relative of [
    'src/components/beeui/badge.tsx',
    'src/components/beeui/card.tsx',
    'src/components/beeui/text.tsx',
    'src/lib/beeui/cn.ts',
    'src/beeui/theme.css',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);
  assert.equal((result.stdout.match(/src\/lib\/beeui\/cn\.ts/g) ?? []).length, 1);
});

test('repeated add treats identical files as unchanged', async (t) => {
  const root = await init(t);
  assert.equal((await run(root, ['add', 'button'])).code, 0);
  const second = await run(root, ['add', 'button']);
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /UNCHANGED src\/components\/beeui\/button\.tsx/);
  assert.doesNotMatch(second.stdout, /OVERWRITE/);
});

test('collision rejection does not overwrite a consumer file', async (t) => {
  const root = await init(t);
  const target = path.join(root, 'src/components/beeui/button.tsx');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, '// consumer-owned\n');
  const result = await run(root, ['add', 'button']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /refusing to overwrite existing files/);
  assert.equal(await readFile(target, 'utf8'), '// consumer-owned\n');
});

test('--overwrite is explicit and restores canonical transformed source', async (t) => {
  const root = await init(t);
  const target = path.join(root, 'src/components/beeui/button.tsx');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, '// consumer-owned\n');
  const result = await run(root, ['add', '--overwrite', 'button']);
  assert.equal(result.code, 0, result.stderr);
  const output = await readFile(target, 'utf8');
  assert.match(result.stdout, /OVERWRITE src\/components\/beeui\/button\.tsx/);
  assert.match(output, /import \{ cn \} from '\.\.\/\.\.\/lib\/beeui\/cn';/);
  assert.doesNotMatch(output, /@beeui\/core/);
});

test('--dry-run performs no filesystem mutation', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', '--dry-run', 'button']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Dry run: no files were written/);
  assert.equal(await exists(path.join(root, 'src/components/beeui/button.tsx')), false);
  assert.equal(await exists(path.join(root, 'src/beeui/theme.css')), false);
});

test('unknown component returns non-zero without mutation', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'not-a-component']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /unknown or unsupported registry item/);
  assert.equal(await exists(path.join(root, 'src')), false);
});

test('malformed config returns non-zero without mutation', async (t) => {
  const root = await project(t);
  await writeFile(path.join(root, CONFIG_FILENAME), '{not json');
  const result = await run(root, ['add', 'button']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /malformed beeui\.config\.json/);
  assert.equal(await exists(path.join(root, 'src')), false);
});

test('config path traversal is rejected', async (t) => {
  const root = await project(t);
  await writeFile(path.join(root, CONFIG_FILENAME), JSON.stringify({
    schemaVersion: 1,
    componentsDir: '../outside',
    libDir: 'src/lib/beeui',
    themeFile: 'src/beeui/theme.css',
  }));
  const result = await run(root, ['add', 'button']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /must not contain '\.\.'/);
});

test('registry validator rejects a missing dependency name', async () => {
  const registry = await canonicalRegistryObject();
  registry.items.find((item) => item.name === 'button').registryDependencies.push('missing-item');
  await assert.rejects(() => validateRegistry(registry, { checkSources: false }), /missing registry dependency 'missing-item'/);
});

test('registry validator rejects dependency cycles', async () => {
  const registry = await canonicalRegistryObject();
  registry.items.find((item) => item.name === 'core-cn').registryDependencies.push('button');
  await assert.rejects(() => validateRegistry(registry, { checkSources: false }), /dependency cycle detected/);
});

test('registry validator rejects duplicate item names', async () => {
  const registry = await canonicalRegistryObject();
  registry.items.push(structuredClone(registry.items[0]));
  await assert.rejects(() => validateRegistry(registry, { checkSources: false }), /duplicate registry item name/);
});

test('registry validator rejects duplicate target paths', async () => {
  const registry = await canonicalRegistryObject();
  const card = registry.items.find((item) => item.name === 'card');
  card.files[0].target = structuredClone(registry.items.find((item) => item.name === 'button').files[0].target);
  await assert.rejects(() => validateRegistry(registry, { checkSources: false }), /duplicate registry target/);
});

test('registry validator rejects source traversal', async () => {
  const registry = await canonicalRegistryObject();
  registry.items[0].files[0].source = '../../outside.ts';
  await assert.rejects(() => validateRegistry(registry, { checkSources: false }), /must not contain '\.\.'/);
});

test('deterministic plan is independent of requested item order', async (t) => {
  const root = await init(t);
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const config = await readConfig(root);
  const a = await buildAddPlan({ projectRoot: root, registry, config, requestedItems: ['button', 'card'] });
  const b = await buildAddPlan({ projectRoot: root, registry, config, requestedItems: ['card', 'button'] });
  const compact = (plan) => ({
    requestedItems: plan.requestedItems,
    resolvedItems: plan.resolvedItems,
    files: plan.files.map(({ item, source, targetRelative, content, action }) => ({ item, source, targetRelative, content, action })),
    requirements: plan.requirements,
    themeFile: plan.themeFile,
  });
  assert.deepEqual(compact(a), compact(b));
});

// Regression for #355: this check used to run against a curated file list that
// happened to exclude every file affected by the `@beeui/tokens` runtime-import
// gap (sheet, popover, dropdown-menu, select, toast, tooltip, theme-scope,
// use-bee-token, overlay-runtime), so the gap shipped undetected through CI for
// every one of those already-public items. It now resolves and inspects *every*
// public registry item (which transitively pulls in every internal utility item
// too, e.g. core-cn/core-overlay/overlay-runtime/use-direction), so no future
// item can skip this invariant by not being named in a hand-picked list.
//
// `@beeui/core` and `workspace:*`/monorepo-relative-path references must never
// survive into copied source (ADR-011 D5: `@beeui/core` is vendored-by-transform).
// `@beeui/tokens` is the one intentional exception — ADR-011 D5 resolves it by
// declaring `@beeui/tokens` as a consumer dependency instead of vendoring it, so
// a bare `@beeui/tokens` specifier is expected to remain; the CLI recording it as
// a consumer dependency is proven separately below.
test('copied source contains no @beeui/core, workspace:*, or monorepo-relative-path leaks across the full registry', async (t) => {
  const root = await init(t);
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const config = await readConfig(root);
  const plan = await buildAddPlan({ projectRoot: root, registry, config, requestedItems: publicItems(registry) });
  const inspected = plan.files.filter((file) => /\.(?:tsx?|mjs|cjs)$/.test(file.targetRelative));
  assert.ok(inspected.length > 0, 'expected at least one copied source file to inspect');
  // Scoped to actual import/require specifiers (quoted module strings), not prose —
  // several files reference `@beeui/core` in JSDoc/comments (e.g. calendar-locale.ts
  // documents its relationship to `@beeui/core`'s CalendarDate boundary) without
  // importing it, which is not a workspace leak.
  const importSpecifier = /(?:from|require\()\s*['"]([^'"]+)['"]/g;
  for (const file of inspected) {
    for (const match of file.content.matchAll(importSpecifier)) {
      const specifier = match[1];
      assert.notEqual(specifier, 'workspace:*', `${file.targetRelative}: ${specifier}`);
      assert.doesNotMatch(specifier, /^@beeui\/core(?:\/|$)/, `${file.targetRelative}: ${specifier}`);
      assert.doesNotMatch(specifier, /packages\//, `${file.targetRelative}: ${specifier}`);
    }
  }
});

// Closure proof for #355 (ADR-011 D5): `@beeui/tokens` is a published package
// (D1), so the fix is to *record* it as a consumer dependency rather than
// vendor a subset of it into the copied source the way `@beeui/core` is
// vendored-by-transform. This performs a real `beeui add` of one single-file
// affected item (`dropdown-menu`) and one multi-platform affected item with a
// deep subpath import (`sheet`, which also imports `@beeui/tokens/motion-runtime`)
// into a clean temp consumer, and proves both halves of the fix together:
// the copied source keeps the resolvable `@beeui/tokens` import (no vendoring,
// no dangling/rewritten specifier, no `@beeui/core` or workspace leak), and the
// CLI plan actually reports `@beeui/tokens` as a consumer dependency
// requirement rather than silently dropping it.
test('#355: beeui add records @beeui/tokens as a consumer dependency for every affected item', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'dropdown-menu', 'sheet']);
  assert.equal(result.code, 0, result.stderr);

  const dropdownMenu = await readFile(path.join(root, 'src/components/beeui/dropdown-menu.tsx'), 'utf8');
  assert.match(dropdownMenu, /from '@beeui\/tokens'/, 'dropdown-menu must keep its resolvable @beeui/tokens import');
  assert.doesNotMatch(dropdownMenu, /@beeui\/core/);

  const sheetWeb = await readFile(path.join(root, 'src/components/beeui/sheet.web.tsx'), 'utf8');
  assert.match(sheetWeb, /from '@beeui\/tokens'/);
  assert.match(sheetWeb, /from '@beeui\/tokens\/motion-runtime'/);
  assert.doesNotMatch(sheetWeb, /@beeui\/core/);

  const sheetNative = await readFile(path.join(root, 'src/components/beeui/sheet.native.tsx'), 'utf8');
  assert.match(sheetNative, /from '@beeui\/tokens'/);
  assert.doesNotMatch(sheetNative, /@beeui\/core/);

  for (const source of [dropdownMenu, sheetWeb, sheetNative]) {
    assert.doesNotMatch(source, /workspace:\*/);
    assert.doesNotMatch(source, /\.\.\/.*packages\//);
  }

  assert.match(result.stdout, /@beeui\/tokens@0\.1\.0 \[missing from package\.json\]/);
});

test('#355: the CLI detects an already-declared @beeui/tokens consumer dependency', async (t) => {
  const root = await init(t);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'consumer', dependencies: { '@beeui/tokens': '^0.1.0' } }, null, 2),
  );
  const result = await run(root, ['add', 'popover']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /@beeui\/tokens@0\.1\.0 \[declared in dependencies as \^0\.1\.0\]/);
});

test('copied TypeScript/TSX passes transpile syntax smoke when TypeScript is installed', async (t) => {
  let ts;
  try {
    const imported = await import('typescript');
    ts = imported.default ?? imported;
  } catch {
    t.skip('TypeScript package is installed by pnpm in the real repository; unavailable in this synthetic harness');
    return;
  }
  const root = await init(t);
  const result = await run(root, ['add', 'button', 'input', 'badge', 'card', 'separator']);
  assert.equal(result.code, 0, result.stderr);
  const files = [
    path.join(root, 'src/components/beeui/badge.tsx'),
    path.join(root, 'src/components/beeui/button.tsx'),
    path.join(root, 'src/components/beeui/card.tsx'),
    path.join(root, 'src/components/beeui/field-context.ts'),
    path.join(root, 'src/components/beeui/input.tsx'),
    path.join(root, 'src/components/beeui/separator.tsx'),
    path.join(root, 'src/components/beeui/text.tsx'),
    path.join(root, 'src/lib/beeui/cn.ts'),
  ];
  for (const file of files) {
    const output = ts.transpileModule(await readFile(file, 'utf8'), {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const errors = (output.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors, [], `${file}: ${errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('; ')}`);
  }
});

test('relative imports in copied source resolve inside the consumer fixture', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'button', 'input', 'badge', 'card', 'separator']);
  assert.equal(result.code, 0, result.stderr);
  const dir = path.join(root, 'src/components/beeui');
  for (const file of ['badge.tsx', 'button.tsx', 'input.tsx']) {
    const source = await readFile(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
      const base = path.resolve(dir, match[1]);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
      let found = false;
      for (const candidate of candidates) {
        if (await exists(candidate)) { found = true; break; }
      }
      assert.equal(found, true, `${file} unresolved relative import ${match[1]}`);
    }
  }
});

test('preflight collision prevents all partial writes', async (t) => {
  const root = await init(t);
  const collision = path.join(root, 'src/components/beeui/button.tsx');
  await mkdir(path.dirname(collision), { recursive: true });
  await writeFile(collision, '// collision\n');
  const result = await run(root, ['add', 'button', 'badge']);
  assert.equal(result.code, 1);
  assert.equal(await readFile(collision, 'utf8'), '// collision\n');
  for (const relative of [
    'src/components/beeui/badge.tsx',
    'src/components/beeui/text.tsx',
    'src/lib/beeui/cn.ts',
    'src/beeui/theme.css',
  ]) assert.equal(await exists(path.join(root, relative)), false, `${relative} should not be partially written`);
});

test('popover resolves the core-overlay module rewrite and anchored overlay runtime', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'popover']);
  assert.equal(result.code, 0, result.stderr);
  const popover = await readFile(path.join(root, 'src/components/beeui/popover.tsx'), 'utf8');
  assert.doesNotMatch(popover, /@beeui\/core/);
  assert.match(popover, /from '\.\.\/\.\.\/lib\/beeui\/core\/index';/);
  for (const relative of [
    'src/components/beeui/overlay-runtime.tsx',
    'src/components/beeui/overlay-transport.web.tsx',
    'src/components/beeui/overlay-transport.native.tsx',
    'src/lib/beeui/core/index.ts',
    'src/lib/beeui/core/utils/anchored-overlay.ts',
    'src/lib/beeui/core/utils/overlay-runtime.ts',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);
});

// Regression for #155: `tooltip.web.tsx`/`tooltip.native.tsx`/`tooltip-shared.tsx` all
// import the local `./use-direction` helper (ADR-004), which — unlike `./text`/
// `./overlay-runtime` — is not part of `@beeui/core` and previously had no registry
// item of its own (a latent gap shared with `popover`/`dropdown-menu`/`select`, which
// import it the same way). This proves the new `use-direction` registry item actually
// resolves every relative import in the full copied `tooltip` file set, not just that
// the individual files exist.
test('tooltip resolves the core-overlay module rewrite, overlay runtime, and use-direction utility', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'tooltip']);
  assert.equal(result.code, 0, result.stderr);
  const dir = path.join(root, 'src/components/beeui');

  for (const relative of [
    'src/components/beeui/tooltip-shared.tsx',
    'src/components/beeui/tooltip.web.tsx',
    'src/components/beeui/tooltip.native.tsx',
    'src/components/beeui/tooltip.d.ts',
    'src/components/beeui/use-direction.ts',
    'src/components/beeui/overlay-runtime.tsx',
    'src/lib/beeui/core/index.ts',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);

  const useDirection = await readFile(path.join(dir, 'use-direction.ts'), 'utf8');
  assert.doesNotMatch(useDirection, /@beeui\/core/);
  assert.match(useDirection, /from '\.\.\/\.\.\/lib\/beeui\/core\/index';/);

  for (const file of ['tooltip-shared.tsx', 'tooltip.web.tsx', 'tooltip.native.tsx', 'use-direction.ts']) {
    const source = await readFile(path.join(dir, file), 'utf8');
    // Strip comments first: `tooltip-shared.tsx`'s own doc comments discuss the
    // `./tooltip` platform-resolution specifier in prose (e.g. "so `import ... from
    // './tooltip'` resolves to..."), which would otherwise false-positive as an
    // unresolved import.
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const match of withoutComments.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
      const base = path.resolve(dir, match[1]);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
      let found = false;
      for (const candidate of candidates) {
        if (await exists(candidate)) { found = true; break; }
      }
      assert.equal(found, true, `${file} unresolved relative import ${match[1]}`);
    }
  }
});

// Issue #170: `table.tsx`/`table.web.tsx` import the local `./use-direction` helper
// (column order under RTL) exactly like `tooltip`, so `table` must declare it as a
// registry dependency — otherwise `beeui add table` would copy a broken relative
// import, exactly the gap #155 fixed for `tooltip`.
test('table resolves the use-direction and use-required-callback-warning utilities', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'table']);
  assert.equal(result.code, 0, result.stderr);
  const dir = path.join(root, 'src/components/beeui');

  for (const relative of [
    'src/components/beeui/table.tsx',
    'src/components/beeui/table.web.tsx',
    'src/components/beeui/table-shared.ts',
    'src/components/beeui/use-direction.ts',
    'src/components/beeui/use-required-callback-warning.ts',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);

  for (const file of ['table.tsx', 'table.web.tsx']) {
    const source = await readFile(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
      const base = path.resolve(dir, match[1]);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
      let found = false;
      for (const candidate of candidates) {
        if (await exists(candidate)) { found = true; break; }
      }
      assert.equal(found, true, `${file} unresolved relative import ${match[1]}`);
    }
  }
});

// Issue #161: `sheet.tsx`/`sheet.web.tsx`/`sheet.native.tsx` import the local
// `./button`, `./overlay-runtime`, and `./text` modules, and `sheet.native.tsx`
// additionally requires the optional `@gorhom/bottom-sheet` native adapter plus
// its own Reanimated/Gesture-Handler/Worklets peers (ADR-006). This proves the
// full copied `sheet` file set — including its `overlay-runtime` dependency
// closure — resolves every relative import, the same class of check #155/#170
// already run for `tooltip`/`table`, and that the four sheet-only optional
// native peers are reported exactly once and only for `sheet`.
test('sheet resolves its button/overlay-runtime/text dependency closure and reports optional native peers only for itself', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'sheet']);
  assert.equal(result.code, 0, result.stderr);
  const dir = path.join(root, 'src/components/beeui');

  assert.match(result.stdout, /core-cn -> theme -> text -> button -> core-overlay -> overlay-runtime -> sheet/);

  for (const relative of [
    'src/components/beeui/sheet.tsx',
    'src/components/beeui/sheet.web.tsx',
    'src/components/beeui/sheet.native.tsx',
    'src/components/beeui/button.tsx',
    'src/components/beeui/text.tsx',
    'src/components/beeui/overlay-runtime.tsx',
    'src/components/beeui/overlay-transport.web.tsx',
    'src/components/beeui/overlay-transport.native.tsx',
    'src/components/beeui/overlay-transport.d.ts',
    'src/components/beeui/overlay-transport-shared.tsx',
    'src/components/beeui/overlay-dismiss-events.ts',
    'src/components/beeui/overlay-dismiss-events.web.ts',
    'src/components/beeui/overlay-host-mode.ts',
    'src/lib/beeui/core/index.ts',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);

  for (const file of ['sheet.tsx', 'sheet.web.tsx', 'sheet.native.tsx']) {
    const source = await readFile(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
      const base = path.resolve(dir, match[1]);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
      let found = false;
      for (const candidate of candidates) {
        if (await exists(candidate)) { found = true; break; }
      }
      assert.equal(found, true, `${file} unresolved relative import ${match[1]}`);
    }
  }

  const expectedPeers = [
    '@gorhom/bottom-sheet@>=5.2 <6',
    'react-native-reanimated@>=4.5 <5',
    'react-native-gesture-handler@>=2.32 <3',
    'react-native-worklets@>=0.10 <1',
  ];
  for (const peer of expectedPeers) {
    const [name] = peer.split('@>=');
    const occurrences = result.stdout.split(name).length - 1;
    assert.equal(occurrences, 1, `expected exactly one report of ${name}, got ${occurrences}`);
    assert.match(result.stdout, new RegExp(peer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

// Issue #178: `calendar.tsx` imports the local `./use-direction` helper (same RTL
// mirroring as `tooltip`/`table`) and mixes `cn` with `calendar-date` functions/types
// from `@beeui/core`, so it must resolve through `core-overlay` (which bundles
// `calendar-date.ts` alongside `cn`/`anchored-overlay`/`overlay-runtime`) rather than
// the plain `core-cn` utility. `date-picker` and `date-time-picker` each declare
// `calendar` plus their own multi-file (`*.d.ts`/`*.native.tsx`/`*.web.tsx`/
// `*-shared.tsx`/`*-locale.ts`) source sets. This proves the full copied file set for
// all three resolves every local relative import, the same class of gap #155 and #170
// fixed for `tooltip` and `table`.
test('calendar/date-picker/date-time-picker resolve calendar-date, core-overlay, and use-direction closures', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'calendar', 'date-picker', 'date-time-picker']);
  assert.equal(result.code, 0, result.stderr);
  const dir = path.join(root, 'src/components/beeui');

  for (const relative of [
    'src/components/beeui/calendar.tsx',
    'src/components/beeui/calendar-locale.ts',
    'src/components/beeui/date-picker.d.ts',
    'src/components/beeui/date-picker.native.tsx',
    'src/components/beeui/date-picker.web.tsx',
    'src/components/beeui/date-picker-shared.tsx',
    'src/components/beeui/date-picker-locale.ts',
    'src/components/beeui/date-time-picker.d.ts',
    'src/components/beeui/date-time-picker.native.tsx',
    'src/components/beeui/date-time-picker.web.tsx',
    'src/components/beeui/date-time-picker-shared.tsx',
    'src/components/beeui/date-time-picker-locale.ts',
    'src/components/beeui/use-direction.ts',
    'src/lib/beeui/core/index.ts',
    'src/lib/beeui/core/utils/calendar-date.ts',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);

  const calendar = await readFile(path.join(dir, 'calendar.tsx'), 'utf8');
  assert.doesNotMatch(calendar, /@beeui\/core/);
  assert.match(calendar, /from '\.\.\/\.\.\/lib\/beeui\/core\/index';/);

  for (const file of [
    'calendar.tsx',
    'calendar-locale.ts',
    'date-picker.d.ts',
    'date-picker.native.tsx',
    'date-picker.web.tsx',
    'date-picker-shared.tsx',
    'date-picker-locale.ts',
    'date-time-picker.d.ts',
    'date-time-picker.native.tsx',
    'date-time-picker.web.tsx',
    'date-time-picker-shared.tsx',
    'date-time-picker-locale.ts',
  ]) {
    const source = await readFile(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
      const base = path.resolve(dir, match[1]);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
      let found = false;
      for (const candidate of candidates) {
        if (await exists(candidate)) { found = true; break; }
      }
      assert.equal(found, true, `${file} unresolved relative import ${match[1]}`);
    }
  }
});

test('doctor validates config and registry without mutating the project', async (t) => {
  const root = await init(t);
  const before = await readFile(path.join(root, CONFIG_FILENAME), 'utf8');
  const result = await run(root, ['doctor']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /BeeUI doctor OK/);
  assert.equal(await readFile(path.join(root, CONFIG_FILENAME), 'utf8'), before);
  assert.equal(await exists(path.join(root, 'src')), false);
});

// #210: doctor reports its registry delivery mode explicitly. In this test
// harness the CLI always runs in repository-local dev mode (no bundled
// integrity.json exists next to packages/cli/src/registry-lib.mjs), so it
// must say so rather than silently omitting the fact. The bundled/"integrity
// verified" branch is exercised end-to-end against the real built artifact by
// `pnpm cli:smoke` (packages/cli/scripts/smoke.mjs), and at the unit level by
// the `verifyRegistrySourceIntegrity` fixture tests below.
test('doctor reports dev-mode registry delivery when no bundled manifest exists', async (t) => {
  const root = await init(t);
  const result = await run(root, ['doctor']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /registry delivery: dev \(live monorepo source tree, no bundled checksum manifest\)/);
});

// ---------------------------------------------------------------------------
// #210: command contract
// ---------------------------------------------------------------------------

test('version/--version/-v print the installed package name and version and accept no arguments', async (t) => {
  const root = await project(t);
  for (const flag of ['version', '--version', '-v']) {
    // eslint-disable-next-line no-await-in-loop -- sequential CLI invocations, clarity over throughput
    const result = await run(root, [flag]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout.trim(), /^@beeui\/cli \d+\.\d+\.\d+/);
  }
  const withArgs = await run(root, ['version', 'extra']);
  assert.equal(withArgs.code, 1);
  assert.match(withArgs.stderr, /'version' does not accept arguments/);
});

test('help/--help/-h produce identical, stable usage text listing the full command contract', async (t) => {
  const root = await project(t);
  const [help, longFlag, shortFlag] = await Promise.all([
    run(root, ['help']),
    run(root, ['--help']),
    run(root, ['-h']),
  ]);
  assert.equal(help.code, 0);
  assert.equal(help.stdout, longFlag.stdout);
  assert.equal(help.stdout, shortFlag.stdout);
  for (const needle of ['beeui version', 'beeui add --all', 'beeui doctor', '--dry-run', '--overwrite', 'Exit codes:']) {
    assert.ok(help.stdout.includes(needle), `help output missing '${needle}'`);
  }
});

test('unknown top-level command fails clearly without mutation', async (t) => {
  const root = await project(t);
  const result = await run(root, ['nuke']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /unknown command 'nuke'/);
});

test('add requires either explicit items or --all, and rejects combining both', async (t) => {
  const root = await init(t);
  const neither = await run(root, ['add']);
  assert.equal(neither.code, 1);
  assert.match(neither.stderr, /requires at least one component name, or use --all/);

  const both = await run(root, ['add', '--all', 'button']);
  assert.equal(both.code, 1);
  assert.match(both.stderr, /does not accept explicit item names/);
  assert.equal(await exists(path.join(root, 'src')), false);
});

test('unknown add option fails clearly without mutation', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', '--bogus', 'button']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /unknown add option '--bogus'/);
  assert.equal(await exists(path.join(root, 'src')), false);
});

test('add --all resolves and copies the complete public registry surface', async (t) => {
  const root = await init(t);
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const dryRunResult = await run(root, ['add', '--all', '--dry-run']);
  assert.equal(dryRunResult.code, 0, dryRunResult.stderr);
  assert.ok(publicItems(registry).length > 0, 'sanity: registry has public components to compare against');
  // The requested-item set for --all must equal 'list' exactly (every
  // directly-addable public item, not only public *components*).
  const listResult = await run(root, ['list']);
  const listedNames = listResult.stdout.trim().split('\n').sort();
  const requestedLine = dryRunResult.stdout.split('\n').find((line) => line.startsWith('Requested: '));
  const requestedNames = requestedLine.replace('Requested: ', '').split(', ').sort();
  assert.deepEqual(requestedNames, listedNames);
  assert.equal(await exists(path.join(root, 'src')), false, '--dry-run must not mutate the filesystem');

  const applied = await run(root, ['add', '--all']);
  assert.equal(applied.code, 0, applied.stderr);
  for (const relative of [
    'src/components/beeui/button.tsx',
    'src/components/beeui/table.tsx',
    'src/components/beeui/sheet.web.tsx',
    'src/beeui/theme.css',
  ]) assert.equal(await exists(path.join(root, relative)), true, relative);
});

// ---------------------------------------------------------------------------
// #211: adversarial / public-threat security tests
// ---------------------------------------------------------------------------

test('hostile add item-name arguments are rejected before any filesystem mutation', async (t) => {
  const root = await init(t);
  for (const hostile of ['../../etc/passwd', '/etc/passwd', 'button/../../evil', 'button\0evil', 'BUTTON', '']) {
    // eslint-disable-next-line no-await-in-loop -- each case must independently prove no mutation occurred
    const result = await run(root, ['add', hostile]);
    assert.equal(result.code, 1, `expected '${hostile}' to be rejected`);
    assert.match(result.stderr, /invalid registry item name|unknown or unsupported registry item/, `'${hostile}'`);
    // eslint-disable-next-line no-await-in-loop -- see above
    assert.equal(await exists(path.join(root, 'src')), false, `'${hostile}' must not write any files`);
  }
});

test('add refuses to write through a symlinked componentsDir segment (destination symlink race)', async (t) => {
  const root = await init(t);
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'beeui-outside-'));
  t.after(async () => rm(outsideDir, { recursive: true, force: true }));

  await mkdir(path.join(root, 'src/components'), { recursive: true });
  await symlink(outsideDir, path.join(root, 'src/components/beeui'), 'dir');

  const result = await run(root, ['add', 'button']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /symbolic link|escapes the project root/);
  assert.deepEqual(await readdir(outsideDir), [], 'no files may be written through the symlink into the outside directory');
});

test('a symlinked beeui.config.json is rejected rather than followed', async (t) => {
  const root = await project(t);
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'beeui-outside-cfg-'));
  t.after(async () => rm(outsideDir, { recursive: true, force: true }));
  const outsideConfig = path.join(outsideDir, 'evil.json');
  await writeFile(
    outsideConfig,
    JSON.stringify({
      schemaVersion: 1,
      componentsDir: 'src/components/beeui',
      libDir: 'src/lib/beeui',
      themeFile: 'src/beeui/theme.css',
    }),
  );
  await symlink(outsideConfig, path.join(root, CONFIG_FILENAME), 'file');

  const result = await run(root, ['doctor']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /config crosses symbolic link/);
});

test('loadRegistry rejects malformed registry JSON', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'beeui-registry-json-'));
  t.after(async () => rm(dir, { recursive: true, force: true }));
  const registryPath = path.join(dir, 'registry.json');
  await writeFile(registryPath, '{not valid json');
  await assert.rejects(() => loadRegistry({ repoRoot: REPO_ROOT, registryPath }), /malformed registry JSON/);
});

// ---------------------------------------------------------------------------
// #216: registry delivery + integrity strategy
// ---------------------------------------------------------------------------

test('loadRegistry accepts a bundled registry whose checksum matches its integrity manifest', async (t) => {
  const fixture = await integrityFixture(t);
  const registry = await loadRegistry({
    repoRoot: fixture.dir,
    registryPath: fixture.registryPath,
    integrityPath: fixture.integrityPath,
  });
  assert.equal(registry.items[0].name, 'demo');
});

test('loadRegistry rejects a bundled registry.json whose checksum does not match the integrity manifest', async (t) => {
  const fixture = await integrityFixture(t);
  await writeFile(fixture.registryPath, `${fixture.rawRegistry}\n// tampered`, 'utf8');
  await assert.rejects(
    () =>
      loadRegistry({
        repoRoot: fixture.dir,
        registryPath: fixture.registryPath,
        integrityPath: fixture.integrityPath,
      }),
    /registry integrity check failed: bundled registry\.json checksum mismatch/,
  );
});

test('loadRegistry requires an integrity manifest when a bundled one is expected but missing', async (t) => {
  const fixture = await integrityFixture(t);
  await assert.rejects(
    () =>
      loadRegistry({
        repoRoot: fixture.dir,
        registryPath: fixture.registryPath,
        integrityPath: path.join(fixture.dir, 'does-not-exist.json'),
      }),
    /integrity manifest is missing or unreadable/,
  );
});

test('buildAddPlan rejects a bundled source file whose content does not match its recorded checksum', async (t) => {
  const fixture = await integrityFixture(t);
  await writeFile(path.join(fixture.dir, fixture.sourceRelative), `${fixture.sourceContent}// tampered\n`, 'utf8');

  const registry = await validateRegistry(JSON.parse(fixture.rawRegistry), { repoRoot: fixture.dir, checkSources: true });
  const projectRoot = await init(t);
  const config = await readConfig(projectRoot);
  await assert.rejects(
    () =>
      buildAddPlan({
        projectRoot,
        registry,
        config,
        requestedItems: ['demo'],
        sourcesRoot: fixture.dir,
        integrityPath: fixture.integrityPath,
      }),
    /registry integrity check failed: bundled source 'demo\.tsx' checksum mismatch/,
  );
  assert.equal(await exists(path.join(projectRoot, 'src/components/beeui/demo.tsx')), false);
});

test('buildAddPlan succeeds for a bundled source file whose checksum matches', async (t) => {
  const fixture = await integrityFixture(t);
  const registry = await validateRegistry(JSON.parse(fixture.rawRegistry), { repoRoot: fixture.dir, checkSources: true });
  const projectRoot = await init(t);
  const config = await readConfig(projectRoot);
  const plan = await buildAddPlan({
    projectRoot,
    registry,
    config,
    requestedItems: ['demo'],
    sourcesRoot: fixture.dir,
    integrityPath: fixture.integrityPath,
  });
  assert.equal(plan.files[0].action, 'create');
});

test('verifyRegistrySourceIntegrity reports dev mode when no bundled manifest applies', async () => {
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const result = await verifyRegistrySourceIntegrity(registry, { sourcesRoot: REPO_ROOT, integrityPath: null });
  assert.deepEqual(result, { mode: 'dev', verifiedCount: 0 });
});

test('verifyRegistrySourceIntegrity sweeps and verifies every bundled source checksum', async (t) => {
  const fixture = await integrityFixture(t);
  const registry = await validateRegistry(JSON.parse(fixture.rawRegistry), { repoRoot: fixture.dir, checkSources: true });
  const result = await verifyRegistrySourceIntegrity(registry, { sourcesRoot: fixture.dir, integrityPath: fixture.integrityPath });
  assert.deepEqual(result, { mode: 'bundled', verifiedCount: 1 });
});

test('verifyRegistrySourceIntegrity detects a tampered bundled source outside of any add request', async (t) => {
  const fixture = await integrityFixture(t);
  await writeFile(path.join(fixture.dir, fixture.sourceRelative), `${fixture.sourceContent}// tampered\n`, 'utf8');
  const registry = await validateRegistry(JSON.parse(fixture.rawRegistry), { repoRoot: fixture.dir, checkSources: true });
  await assert.rejects(
    () => verifyRegistrySourceIntegrity(registry, { sourcesRoot: fixture.dir, integrityPath: fixture.integrityPath }),
    /registry integrity check failed: bundled source 'demo\.tsx' checksum mismatch/,
  );
});
