import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import { buildPublicSurfaceInventory } from '../generate-public-surface-inventory.mjs';
import {
  ANY_COMMAND,
  buildReferenceManifest,
  classificationVaries,
  codeSpan,
  collectPublicReferenceViolations,
  describeExport,
  formatTokenValue,
  parseCliHelp,
  renderReferencePage,
  resolveExportedDeclaration,
  tokenGroupEntries,
} from '../public-reference.mjs';

const CONTENT = JSON.parse(
  await import('node:fs').then((fs) => fs.readFileSync(`${ROOT_DIR}/docs/reference.content.json`, 'utf8')),
);

// The point of deriving these pages from the inventory is that the ownership gate and the
// page a reader opens cannot disagree. If this drifts, "every public surface is documented"
// is back to being a claim about routing rather than about pages.
test('every reference-owned surface appears on exactly one generated page', () => {
  const inventory = buildPublicSurfaceInventory(ROOT_DIR);
  const expected = inventory.rows.filter((row) => row.primaryDocsOwner.startsWith('/docs/reference/'));
  const manifest = buildReferenceManifest(ROOT_DIR);

  const listed = manifest.flatMap((owner) => owner.rows.map((row) => row.id));
  assert.equal(listed.length, new Set(listed).size, 'a surface is listed on more than one page');
  assert.deepEqual([...listed].sort(), expected.map((row) => row.id).sort());
});

test('every generated page routes to the owner the inventory names', () => {
  for (const owner of buildReferenceManifest(ROOT_DIR)) {
    assert.equal(owner.route, `/docs/reference/${owner.slug}/`);
    for (const row of owner.rows) assert.equal(row.primaryDocsOwner, owner.route);
  }
});

test('the committed pages carry the surfaces and the curated prose', () => {
  for (const owner of buildReferenceManifest(ROOT_DIR)) {
    const page = renderReferencePage(owner, CONTENT);
    assert.match(page, /Generated file/u, `${owner.slug} must warn that it is generated`);
    assert.ok(page.includes(CONTENT.owners[owner.slug].intro.split('\n')[0]), `${owner.slug} lost its intro`);
    for (const row of owner.rows) {
      assert.ok(page.includes(`\`${row.name}\``), `${owner.slug} does not list ${row.name}`);
    }
  }
});

test('the real repository satisfies the reference contract', () => {
  assert.deepEqual(collectPublicReferenceViolations(ROOT_DIR), []);
});

// A reference owner without prose would publish a bare table of symbol names — technically
// complete and useless, which is exactly what #474's G2 gate rejects.
test('a reference owner with no curated entry is rejected', () => {
  const owners = buildReferenceManifest(ROOT_DIR);
  assert.ok(owners.length > 0);
  const stripped = { ...CONTENT, owners: { ...CONTENT.owners } };
  delete stripped.owners[owners[0].slug];
  assert.throws(
    () => {
      for (const owner of owners) renderReferencePage(owner, stripped);
    },
    /Cannot read|undefined/u,
  );
});

// ---------------------------------------------------------------------------------------------
// #474 M5 — no page opens with the old maintainer-issue-number admonition.
// ---------------------------------------------------------------------------------------------

test('a generated page never cites the ownership-gate issue number or a visible caution admonition', () => {
  const content = {
    owners: { widgets: { title: 'Widgets', description: 'd', intro: 'Widgets intro.' } },
  };
  const owner = { route: '/docs/reference/widgets/', slug: 'widgets', rows: [] };
  const page = renderReferencePage(owner, content, ROOT_DIR);
  assert.ok(!page.includes('#473'), 'page must not cite the internal ownership-gate issue number');
  assert.ok(!page.includes(':::caution'), 'page must not open with a visible caution admonition');
  assert.match(page, /<!--.*Generated file.*-->/su, 'the do-not-edit signal must survive as an HTML comment');
  // The marker replaces the old admonition right after the frontmatter, so it still renders
  // before the intro text — but as an invisible comment rather than a visible block.
  assert.ok(page.indexOf('<!--') < page.indexOf('Widgets intro.'), 'marker renders before the intro (immediately after frontmatter)');
});

// ---------------------------------------------------------------------------------------------
// #474 M3 — classification column is dropped when it carries no information.
// ---------------------------------------------------------------------------------------------

test('classificationVaries is false for a single constant value and true when values differ', () => {
  assert.equal(classificationVaries([{ classification: 'consumer' }, { classification: 'consumer' }]), false);
  assert.equal(classificationVaries([{ classification: 'consumer' }, { classification: 'advanced-consumer' }]), true);
});

test('a section with constant classification drops the column; a varying one keeps it', () => {
  const owner = {
    route: '/docs/reference/registry/',
    slug: 'registry',
    rows: [
      { kind: 'registry-item', name: 'theme', classification: 'source-ownership-public', source: 'registry/registry.json' },
    ],
  };
  const content = { owners: { registry: { title: 't', description: 'd', intro: 'i' } } };
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-reference-registry-'));
  fs.mkdirSync(path.join(rootDir, 'registry'), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, 'registry/registry.json'),
    JSON.stringify({ items: [{ name: 'theme', files: [], registryDependencies: [], peerDependencies: {} }] }),
  );
  const page = renderReferencePage(owner, content, rootDir);
  assert.ok(!page.includes('Classification'), 'a constant classification must not get its own column');
});

// ---------------------------------------------------------------------------------------------
// #474 M3 — codeSpan fences long enough to survive backticks already in the content (TypeScript
// template-literal types print with their own backticks).
// ---------------------------------------------------------------------------------------------

test('codeSpan fences one backtick longer than the longest backtick run in the content', () => {
  assert.equal(codeSpan('plain text'), '` plain text `');
  assert.equal(codeSpan('`--color-${Token}`'), '`` `--color-${Token}` ``');
  assert.equal(codeSpan('a `` b `` c'), '``` a `` b `` c ```');
});

// ---------------------------------------------------------------------------------------------
// #474 M3 — TypeScript-derived signatures (core-value/core-type/token-runtime-*). Synthetic
// source only: this must not depend on the real repository having any particular shape.
// ---------------------------------------------------------------------------------------------

test('describeExport derives a function signature and the JSDoc first sentence', () => {
  const source = `
/**
 * Adds two calendar-safe numbers together. Never called with NaN.
 * @param a first operand
 */
export function addSafe(a: number, b: number): number {
  return a + b;
}
`;
  const described = describeExport(source, 'fixture.ts', 'addSafe');
  assert.equal(described.signature, '(a: number, b: number): number');
  assert.equal(described.description, 'Adds two calendar-safe numbers together.');
});

test('describeExport prefers the `satisfies` type as the signature for a typed data constant', () => {
  const source = `
export const byBrand = {
  bee: { light: "light" },
} as const satisfies Record<string, Record<string, string>>;
`;
  const described = describeExport(source, 'fixture.ts', 'byBrand');
  assert.equal(described.signature, 'Record<string, Record<string, string>>');
});

test('describeExport derives an arrow-function-const signature', () => {
  const source = `export const double = (n: number): number => n * 2;`;
  const described = describeExport(source, 'fixture.ts', 'double');
  assert.equal(described.signature, '(n: number): number');
});

test('describeExport prints a type alias body as its signature', () => {
  const source = `
/** A point on a 2D plane. */
export type Point = { x: number; y: number };
`;
  const described = describeExport(source, 'fixture.ts', 'Point');
  // The TypeScript printer pretty-prints an object type literal across multiple lines; the
  // renderer (not describeExport) is responsible for collapsing that to a single table cell, so
  // this asserts on the raw printer output rather than a rendering concern.
  assert.equal(described.signature.replace(/\s+/gu, ' ').trim(), '{ x: number; y: number; }');
  assert.equal(described.description, 'A point on a 2D plane.');
});

test('describeExport returns null for a name the file does not declare', () => {
  assert.equal(describeExport('export const a = 1;', 'fixture.ts', 'doesNotExist'), null);
});

// ---------------------------------------------------------------------------------------------
// #474 M3 — resolving a barrel-exported symbol to the file that actually declares it. This is
// the fix for "the same link to the barrel file, 25 times": every row should link to (and derive
// its signature from) its real implementation file.
// ---------------------------------------------------------------------------------------------

test('resolveExportedDeclaration follows a named re-export to the file that declares the symbol', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-reference-resolve-'));
  fs.mkdirSync(path.join(rootDir, 'src/utils'), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, 'src/index.ts'),
    `export { addOne } from './utils/math';\nexport * from './utils/extra';\n`,
  );
  fs.writeFileSync(
    path.join(rootDir, 'src/utils/math.ts'),
    `/** Increments by one. */\nexport function addOne(n: number): number {\n  return n + 1;\n}\n`,
  );
  fs.writeFileSync(path.join(rootDir, 'src/utils/extra.ts'), `export const extra = 1;\n`);

  const found = resolveExportedDeclaration('src/index.ts', 'addOne', rootDir);
  assert.ok(found, 'expected the barrel chase to resolve addOne');
  assert.equal(found.relPath, 'src/utils/math.ts', 'must link to the real declaring file, not the barrel');

  const foundViaStar = resolveExportedDeclaration('src/index.ts', 'extra', rootDir);
  assert.ok(foundViaStar, 'expected the export * chase to resolve extra');
  assert.equal(foundViaStar.relPath, 'src/utils/extra.ts');
});

test('resolveExportedDeclaration returns null instead of throwing when a symbol cannot be found', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-reference-resolve-miss-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src/index.ts'), `export const known = 1;\n`);
  assert.equal(resolveExportedDeclaration('src/index.ts', 'unknown', rootDir), null);
});

// ---------------------------------------------------------------------------------------------
// #474 M3 — token groups render resolved values, not just the group name.
// ---------------------------------------------------------------------------------------------

test('formatTokenValue renders a dimension, a string, an array and a cssValue extension', () => {
  assert.equal(formatTokenValue({ $value: { value: 16, unit: 'px' } }), '16px');
  assert.equal(formatTokenValue({ $value: 'system' }), '"system"');
  assert.equal(formatTokenValue({ $value: ['a', 'b'] }), '[a, b]');
  assert.equal(
    formatTokenValue({
      $value: { color: {}, offsetX: {} },
      $extensions: { 'com.beeui': { cssValue: '0 1px 3px rgb(0 0 0 / 0.1)' } },
    }),
    '0 1px 3px rgb(0 0 0 / 0.1)',
  );
});

test('tokenGroupEntries resolves a publicName override and sorts by the resolved name', () => {
  const group = {
    $type: 'dimension',
    $description: 'ignored group metadata',
    b: { $value: { value: 1, unit: 'px' } },
    'a-raw': { $value: { value: 2, unit: 'px' }, $extensions: { 'com.beeui': { publicName: 'z-renamed' } } },
  };
  const entries = tokenGroupEntries(group);
  assert.deepEqual(entries.map(([name]) => name), ['b', 'z-renamed']);
});

test('tokenGroupEntries returns nothing for a missing or malformed group', () => {
  assert.deepEqual(tokenGroupEntries(undefined), []);
  assert.deepEqual(tokenGroupEntries(null), []);
});

// ---------------------------------------------------------------------------------------------
// #474 M3 — a CLI flag documented under more than one "X options:" section is attached to every
// command that accepts it, keeping each command's own wording.
// ---------------------------------------------------------------------------------------------

const SYNTHETIC_HELP_SOURCE = `
const HELP = \`Fixture CLI

Usage:
  fixture help
  fixture add --dry-run <items...>
  fixture update --dry-run [items...]

Commands:
  help                 Show this help.
  add <items...>       Copy source, spanning
                       two lines of prose.
  update [items...]    Re-sync source.

Add options:
  --dry-run            Preview the add plan.

Update options:
  --dry-run            Preview the update plan.

Exit codes:
  0                    Success.
\`;

if (command === 'help' || command === '--help' || command === '-h') {
  return 0;
}
`;

test('parseCliHelp attaches a shared flag to every command that documents it, with each wording kept', () => {
  const { commands, flagsByCommand } = parseCliHelp(SYNTHETIC_HELP_SOURCE);
  assert.equal(commands.get('add'), 'Copy source, spanning two lines of prose.');
  assert.equal(commands.get('update'), 'Re-sync source.');

  const dryRun = flagsByCommand.get('--dry-run');
  assert.deepEqual([...dryRun.keys()].sort(), ['add', 'update']);
  assert.equal(dryRun.get('add'), 'Preview the add plan.');
  assert.equal(dryRun.get('update'), 'Preview the update plan.');
});

test('parseCliHelp derives a global alias flag from the command === checks, not a hand-written list', () => {
  const { flagsByCommand } = parseCliHelp(SYNTHETIC_HELP_SOURCE);
  const help = flagsByCommand.get('--help');
  assert.ok(help, 'expected --help to be derived from the command === alias check');
  assert.equal(help.get(ANY_COMMAND), 'Show this help.');
});

test('parseCliHelp throws when the source has no HELP template literal', () => {
  assert.throws(() => parseCliHelp('export const notHelp = 1;'), /HELP template/u);
});
