import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPublicSurfaceInventory,
  parseDirectExports,
  parseModuleExports,
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
  ]) {
    assert.ok(ids.has(id), `missing required surface ${id}`);
  }
});

test('system-wide surface validation has zero orphan/release-truth violations', () => {
  assert.deepEqual(validatePublicSurfaceInventory(ROOT_DIR), []);
});
