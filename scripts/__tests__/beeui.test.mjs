import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main } from '../beeui.mjs';
import {
  CONFIG_FILENAME,
  REPO_ROOT,
  buildAddPlan,
  loadRegistry,
  readConfig,
  validateRegistry,
} from '../registry-lib.mjs';

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
    'description-list', 'dialog', 'dropdown-menu', 'field', 'form-group', 'form-message',
    'icon-button', 'input', 'keyboard-aware-screen', 'label', 'link', 'list-group', 'list-item', 'metadata-row',
    'otp-input', 'pagination', 'password-input', 'popover', 'progress', 'radio', 'safe-area',
    'screen', 'search-input', 'section', 'segmented-control', 'select', 'separator', 'sheet', 'skeleton',
    'spinner', 'stack', 'stat', 'state-message', 'stepper', 'switch', 'table', 'tabs', 'text', 'textarea',
    'theme', 'theme-scope', 'timeline', 'toast', 'use-bee-token', 'visually-hidden',
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

test('copied source contains no workspace references or BeeUI monorepo imports', async (t) => {
  const root = await init(t);
  const result = await run(root, ['add', 'button', 'input', 'badge', 'card', 'separator']);
  assert.equal(result.code, 0, result.stderr);
  const files = [
    'badge.tsx', 'button.tsx', 'card.tsx', 'field-context.ts', 'input.tsx', 'separator.tsx', 'text.tsx',
  ];
  for (const file of files) {
    const source = await readFile(path.join(root, 'src/components/beeui', file), 'utf8');
    assert.doesNotMatch(source, /workspace:\*/);
    assert.doesNotMatch(source, /@beeui\//);
    assert.doesNotMatch(source, /\.\.\/.*packages\//);
  }
  const cn = await readFile(path.join(root, 'src/lib/beeui/cn.ts'), 'utf8');
  assert.doesNotMatch(cn, /workspace:\*|@beeui\/|\.\.\/.*packages\//);
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

test('doctor validates config and registry without mutating the project', async (t) => {
  const root = await init(t);
  const before = await readFile(path.join(root, CONFIG_FILENAME), 'utf8');
  const result = await run(root, ['doctor']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /BeeUI doctor OK/);
  assert.equal(await readFile(path.join(root, CONFIG_FILENAME), 'utf8'), before);
  assert.equal(await exists(path.join(root, 'src')), false);
});
