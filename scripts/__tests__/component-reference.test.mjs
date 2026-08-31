import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractBeeuiImports,
  getPublicComponents,
  isProviderRequired,
  usageForComponent,
} from '../component-docs-lib.mjs';
import {
  REQUIRED_SECTIONS,
  buildDocument,
  readContent,
  runStructuralChecks,
} from '../generate-component-reference.mjs';

// --- Pure helper unit tests -------------------------------------------------

test('extractBeeuiImports collects symbols and strips type qualifiers', () => {
  const src = "import { Button, ButtonLabel, type ButtonProps } from '@beemvp/beeui-ui';\nimport { Card } from '@beemvp/beeui-ui';";
  assert.deepEqual([...extractBeeuiImports(src)].sort(), ['Button', 'ButtonLabel', 'ButtonProps', 'Card']);
});

test('extractBeeuiImports ignores non-@beeui imports', () => {
  const src = "import * as React from 'react';\nimport { View } from 'react-native';";
  assert.equal(extractBeeuiImports(src).size, 0);
});

test('isProviderRequired flags overlay/toast components and clears leaf components', () => {
  assert.equal(isProviderRequired('popover', []), true);
  assert.equal(isProviderRequired('date-picker', ['core-overlay', 'popover']), true);
  assert.equal(isProviderRequired('button', ['core-cn', 'text', 'theme']), false);
  // safe-area exports the provider itself, so it is never a provider "consumer".
  assert.equal(isProviderRequired('safe-area', ['overlay-runtime', 'toast']), false);
});

test('usageForComponent returns files importing any of the component values', () => {
  const usage = new Map([
    ['Button', new Set(['apps/showcase/a.tsx'])],
    ['ButtonLabel', new Set(['apps/showcase/b.tsx'])],
  ]);
  const component = { values: ['Button', 'ButtonLabel'] };
  assert.deepEqual(usageForComponent(component, usage), ['apps/showcase/a.tsx', 'apps/showcase/b.tsx']);
});

// --- Contract integration tests (against the real repo) ---------------------

test('there are 62 public components and each maps to barrel exports', () => {
  const components = getPublicComponents();
  assert.equal(components.length, 62);
  for (const component of components) {
    assert.ok(component.values.length > 0, `${component.name} has no exported values`);
    assert.match(component.cliAdd, /^pnpm beeui -- add /);
  }
});

test('every public component has a curated content entry with a purpose', () => {
  const components = getPublicComponents();
  const content = readContent();
  for (const component of components) {
    const entry = content.components[component.name];
    assert.ok(entry, `missing content entry for ${component.name}`);
    assert.ok(entry.purpose && entry.purpose.trim().length > 0, `empty purpose for ${component.name}`);
  }
});

test('generated document contains every required section for every component', () => {
  const doc = buildDocument();
  const blocks = doc.split(/^## /m).slice(1);
  assert.equal(blocks.length, 62);
  for (const block of blocks) {
    for (const section of REQUIRED_SECTIONS) {
      assert.ok(block.includes(`**${section}`), `missing "${section}" in:\n${block.slice(0, 60)}`);
    }
  }
});

test('runStructuralChecks passes for the committed repo', () => {
  const { ok, results } = runStructuralChecks();
  const failed = results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`);
  assert.ok(ok, `structural checks failed:\n${failed.join('\n')}`);
});
