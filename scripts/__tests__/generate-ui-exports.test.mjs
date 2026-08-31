import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildComponentExportsEntry,
  buildUiExportsField,
  detectComponentKind,
  parsePublicComponentNames,
} from '../generate-ui-exports.mjs';

test('parsePublicComponentNames extracts unique names in first-seen order', () => {
  const indexSource = `
    export { Accordion } from './components/accordion';
    export { AccordionContent } from './components/accordion';
    export { Button } from './components/button';
  `;
  assert.deepEqual(parsePublicComponentNames(indexSource), ['accordion', 'button']);
});

test('parsePublicComponentNames throws on a barrel with no component re-exports', () => {
  assert.throws(() => parsePublicComponentNames("export type { Foo } from '@beeui/core';"));
});

test('detectComponentKind: single-file component (e.g. button)', () => {
  const filenames = new Set(['button.tsx', 'card.tsx']);
  assert.deepEqual(detectComponentKind('button', filenames), {
    hasBase: true,
    hasNative: false,
    hasWeb: false,
  });
});

test('detectComponentKind: base + both platform overrides (e.g. sheet)', () => {
  const filenames = new Set(['sheet.tsx', 'sheet.native.tsx', 'sheet.web.tsx']);
  assert.deepEqual(detectComponentKind('sheet', filenames), {
    hasBase: true,
    hasNative: true,
    hasWeb: true,
  });
});

test('detectComponentKind: base + web-only override (e.g. table)', () => {
  const filenames = new Set(['table.tsx', 'table.web.tsx']);
  assert.deepEqual(detectComponentKind('table', filenames), {
    hasBase: true,
    hasNative: false,
    hasWeb: true,
  });
});

test('detectComponentKind: platform-only, no base (e.g. date-picker)', () => {
  const filenames = new Set(['date-picker.d.ts', 'date-picker.native.tsx', 'date-picker.web.tsx']);
  assert.deepEqual(detectComponentKind('date-picker', filenames), {
    hasBase: false,
    hasNative: true,
    hasWeb: true,
  });
});

test('detectComponentKind throws when a public component has no source file at all', () => {
  const filenames = new Set(['unrelated.tsx']);
  assert.throws(() => detectComponentKind('missing', filenames));
});

test('buildComponentExportsEntry: single-file component resolves every condition to one file', () => {
  const entry = buildComponentExportsEntry('button', { hasBase: true, hasNative: false, hasWeb: false });
  assert.equal(entry.source, './src/components/button');
  assert.equal(entry['react-native'], './dist/module/components/button.js');
  assert.equal(entry.browser, './dist/module/components/button.js');
  assert.equal(entry.default, './dist/module/components/button.js');
  assert.equal(entry.import.default, './dist/module/components/button.js');
  assert.equal(entry.import.types, './dist/typescript/module/components/button.d.ts');
  assert.equal(entry.require.default, './dist/commonjs/components/button.js');
  assert.equal(entry.require.types, './dist/typescript/commonjs/components/button.d.ts');
});

test('buildComponentExportsEntry: base + platform overrides splits react-native/browser, defaults to base', () => {
  const entry = buildComponentExportsEntry('sheet', { hasBase: true, hasNative: true, hasWeb: true });
  assert.equal(entry['react-native'], './dist/module/components/sheet.native.js');
  assert.equal(entry.browser, './dist/module/components/sheet.web.js');
  assert.equal(entry.default, './dist/module/components/sheet.js');
  assert.equal(entry.import.default, './dist/module/components/sheet.js');
  assert.equal(entry.require.default, './dist/commonjs/components/sheet.js');
});

test('buildComponentExportsEntry: base + web-only override leaves react-native on the base file', () => {
  const entry = buildComponentExportsEntry('table', { hasBase: true, hasNative: false, hasWeb: true });
  assert.equal(entry['react-native'], './dist/module/components/table.js');
  assert.equal(entry.browser, './dist/module/components/table.web.js');
  assert.equal(entry.default, './dist/module/components/table.js');
});

test('buildComponentExportsEntry: platform-only-no-base falls back the generic default to web', () => {
  const entry = buildComponentExportsEntry('date-picker', { hasBase: false, hasNative: true, hasWeb: true });
  assert.equal(entry['react-native'], './dist/module/components/date-picker.native.js');
  assert.equal(entry.browser, './dist/module/components/date-picker.web.js');
  assert.equal(entry.default, './dist/module/components/date-picker.web.js');
  assert.equal(entry.import.default, './dist/module/components/date-picker.web.js');
  assert.equal(entry.require.default, './dist/commonjs/components/date-picker.web.js');
});

test('buildComponentExportsEntry: types always resolve to the plain <name>.d.ts, never a platform-suffixed one', () => {
  const entry = buildComponentExportsEntry('date-picker', { hasBase: false, hasNative: true, hasWeb: true });
  assert.equal(entry.import.types, './dist/typescript/module/components/date-picker.d.ts');
  assert.equal(entry.require.types, './dist/typescript/commonjs/components/date-picker.d.ts');
});

test('buildUiExportsField preserves the barrel "." and "./package.json" entries and inserts subpaths between them', () => {
  const barrelExports = {
    '.': { source: './src/index.ts' },
    './package.json': './package.json',
  };
  const kindByName = new Map([
    ['button', { hasBase: true, hasNative: false, hasWeb: false }],
    ['sheet', { hasBase: true, hasNative: true, hasWeb: true }],
  ]);
  const field = buildUiExportsField(barrelExports, ['button', 'sheet'], kindByName);
  assert.deepEqual(Object.keys(field), ['.', './button', './sheet', './package.json']);
  assert.equal(field['.'], barrelExports['.']);
  assert.equal(field['./package.json'], './package.json');
});

test('buildUiExportsField is idempotent: re-running against its own previously generated output drops stale subpaths first', () => {
  const barrelExports = {
    '.': { source: './src/index.ts' },
    // Simulates a prior generator run's output plus a component since
    // removed from the barrel (e.g. renamed or deleted).
    './stale-component': { source: './src/components/stale-component' },
    './button': { source: './src/components/button' },
    './package.json': './package.json',
  };
  const kindByName = new Map([['button', { hasBase: true, hasNative: false, hasWeb: false }]]);
  const field = buildUiExportsField(barrelExports, ['button'], kindByName);
  assert.deepEqual(Object.keys(field), ['.', './button', './package.json']);
});

test('buildUiExportsField throws when the barrel is missing "." or "./package.json"', () => {
  assert.throws(() => buildUiExportsField({ './package.json': './package.json' }, [], new Map()));
  assert.throws(() => buildUiExportsField({ '.': {} }, [], new Map()));
});
