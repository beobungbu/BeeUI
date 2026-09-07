import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildPublicSurfaceInventory,
  parseDirectExports,
  ownerRouteViolation,
  parseModuleExports,
  resolveOwnerRoutes,
  validateInventoryFreshness,
  validatePublicSurfaceInventory,
} from '../generate-public-surface-inventory.mjs';
import { ROOT_DIR } from '../component-docs-lib.mjs';

test('direct export parser distinguishes values and types', () => {
  const parsed = parseDirectExports(`
    export const valueA = 1;
    export function valueB() {}
    export type TypeA = string;
    export interface TypeB { value: string }
    export { valueC, type TypeC } from './other';
  `);
  assert.deepEqual(parsed.values, ['valueA', 'valueB', 'valueC']);
  assert.deepEqual(parsed.types, ['TypeA', 'TypeB', 'TypeC']);
});

test('module export parser follows relative export-star barrels', () => {
  const parsed = parseModuleExports('packages/tokens/src/index.ts', ROOT_DIR);
  assert.ok(parsed.values.includes('defineThemeRegistry'));
  assert.ok(parsed.values.includes('applyThemeOverrides'));
  assert.ok(parsed.values.includes('defineTokenReader'));
  assert.ok(parsed.types.includes('ThemeRegistryDefinition'));
});

test('derived inventory covers each required public-surface class', () => {
  const inventory = buildPublicSurfaceInventory(ROOT_DIR);
  const kinds = new Set(inventory.rows.map((row) => row.kind));
  for (const kind of [
    'ui-value',
    'ui-type',
    'package-export',
    'token-group',
    'token-runtime-value',
    'token-runtime-type',
    'core-value',
    'core-type',
    'cli-command',
    'cli-flag',
    'registry-item',
  ]) {
    assert.ok(kinds.has(kind), `missing public-surface kind ${kind}`);
  }
});

test('each derived row has one stable id, one primary owner and a classification', () => {
  const inventory = buildPublicSurfaceInventory(ROOT_DIR);
  assert.ok(inventory.rows.length > 100, 'inventory should enumerate symbols/subpaths, not only package families');
  assert.equal(new Set(inventory.rows.map((row) => row.id)).size, inventory.rows.length);
  for (const row of inventory.rows) {
    assert.match(row.primaryDocsOwner, /^\/docs\//u, row.id);
    assert.ok(row.classification, row.id);
    assert.ok(row.source, row.id);
  }
});

test('important small public symbols, star exports and machine subpaths cannot disappear silently', () => {
  const ids = new Set(buildPublicSurfaceInventory(ROOT_DIR).rows.map((row) => row.id));
  for (const id of [
    '@beemvp/beeui-ui:value:DialogClose',
    '@beemvp/beeui-ui:value:SelectValue',
    '@beemvp/beeui-ui:value:useToast',
    '@beemvp/beeui-ui:value:BeeUIProvider',
    '@beemvp/beeui-ui:value:useBeeToken',
    '@beemvp/beeui-tokens:value:defineThemeRegistry',
    '@beemvp/beeui-tokens:value:applyThemeOverrides',
    '@beemvp/beeui-tokens:value:defineTokenReader',
    '@beemvp/beeui-tokens:type:ThemeRegistryDefinition',
    '@beemvp/beeui-tokens:export:./theme.css',
    '@beemvp/beeui-tokens:export:./tokens.json',
    '@beemvp/beeui-tokens:export:./tokens.resolver.json',
    '@beemvp/beeui-tokens:export:./lifecycle.json',
    '@beemvp/beeui-cli:command:update',
    '@beemvp/beeui-cli:flag:--force',
    '@beemvp/beeui-tokens:export:./motion-runtime',
    '@beemvp/beeui-tokens:value:resolveNativeMotion',
    '@beemvp/beeui-tokens:type:NativeMotionPlan',
    // Reachable only through a public subpath, never through the root barrel.
    '@beemvp/beeui-ui:value:ToastRuntimeProvider',
    '@beemvp/beeui-ui:value:semanticTypographyClasses',
    '@beemvp/beeui-ui:value:getTextareaWebMinHeight',
  ]) {
    assert.ok(ids.has(id), `missing required surface ${id}`);
  }
});

test('subpath-only symbols inherit the docs owner of the family that exposes them', () => {
  const rows = new Map(buildPublicSurfaceInventory(ROOT_DIR).rows.map((row) => [row.id, row]));
  assert.equal(rows.get('@beemvp/beeui-ui:value:ToastRuntimeProvider').primaryDocsOwner, '/docs/components/toast/');
  assert.equal(rows.get('@beemvp/beeui-ui:value:ToastRuntimeProvider').subpath, './toast');
  assert.equal(rows.get('@beemvp/beeui-tokens:value:resolveNativeMotion').subpath, './motion-runtime');
});

test('resolution-only export subpaths are not treated as documented surfaces', () => {
  const rows = buildPublicSurfaceInventory(ROOT_DIR).rows;
  assert.deepEqual(rows.filter((row) => row.name === './package.json'), []);
  for (const row of rows) {
    assert.doesNotMatch(row.primaryDocsOwner, /package\.json/u, row.id);
  }
});

test('every owner route resolves inside a ratified docs IA section', () => {
  const { sectionPrefixes, published } = resolveOwnerRoutes(ROOT_DIR);
  const rows = buildPublicSurfaceInventory(ROOT_DIR).rows;
  for (const row of rows) {
    assert.ok(
      sectionPrefixes.some((prefix) => row.primaryDocsOwner.startsWith(prefix)),
      `${row.id} owner ${row.primaryDocsOwner} escapes the ratified IA`,
    );
    assert.equal(row.ownerStatus, published.has(row.primaryDocsOwner) ? 'published' : 'planned', row.id);
  }
});

// The per-row assertion above already ties ownerStatus to whether the page exists. This
// proves `planned` is still reachable, which used to be shown by the inventory simply having
// unwritten pages in it — true while 663 of 683 surfaces were undocumented, and no longer a
// property of a finished program. Coverage must stay unclaimable for a page nobody wrote,
// even once every page has been written.
test('an owner route with no page is planned, not published', () => {
  const { published } = resolveOwnerRoutes(ROOT_DIR);
  const unwritten = '/docs/reference/nobody-wrote-this/';
  assert.equal(published.has(unwritten), false);
  assert.equal(published.has('/docs/components/button/'), true);
});

test('an owner route outside the ratified IA is a violation', () => {
  const sectionPrefixes = ['/docs/components/', '/docs/reference/'];
  assert.equal(ownerRouteViolation({ id: 'x', primaryDocsOwner: '/docs/reference/tokens/' }, sectionPrefixes), null);
  assert.match(
    ownerRouteViolation({ id: 'x', primaryDocsOwner: '/docs/invented/' }, sectionPrefixes) ?? '',
    /outside every ratified docs IA section/u,
  );
  assert.match(ownerRouteViolation({ id: 'x', primaryDocsOwner: '' }, sectionPrefixes) ?? '', /no valid primary docs owner/u);
});

test('committed inventory must stay fresh', () => {
  assert.deepEqual(validateInventoryFreshness(ROOT_DIR), []);
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-surface-fresh-'));
  try {
    assert.match(validateInventoryFreshness(rootDir)[0] ?? '', /is missing/u);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('system-wide surface validation has zero orphan/release-truth violations', () => {
  assert.deepEqual(validatePublicSurfaceInventory(ROOT_DIR), []);
});
