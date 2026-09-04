import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractBeeuiAddItems,
  extractShowcaseLinks,
  findHallucinatedSymbols,
  isIdentifier,
  readBarrelSymbols,
  readPublicAddTargets,
  runChecks,
} from '../check-doc-examples.mjs';

// --- Pure helper unit tests -------------------------------------------------

test('isIdentifier accepts JS identifiers and rejects placeholders', () => {
  assert.equal(isIdentifier('Button'), true);
  assert.equal(isIdentifier('useToast'), true);
  assert.equal(isIdentifier('…'), false);
  assert.equal(isIdentifier('<Name>'), false);
  assert.equal(isIdentifier(''), false);
});

test('findHallucinatedSymbols ignores placeholders and flags unknown symbols', () => {
  const valid = new Set(['Button', 'Card']);
  const src = "import { Button, … } from '@beemvp/beeui-ui';\nimport { Nope } from '@beemvp/beeui-ui';";
  assert.deepEqual(findHallucinatedSymbols(src, valid), ['Nope']);
});

test('findHallucinatedSymbols passes when all imports are real', () => {
  const valid = new Set(['Button', 'Card']);
  const src = "import { Button, Card } from '@beemvp/beeui-ui';";
  assert.deepEqual(findHallucinatedSymbols(src, valid), []);
});

test('extractBeeuiAddItems captures real tokens and skips placeholders', () => {
  const text = '`pnpm beeui add button` `pnpm beeui add --overwrite popover theme` `pnpm beeui add <component>`';
  assert.deepEqual(extractBeeuiAddItems(text), ['button', 'popover', 'theme']);
});

test('extractShowcaseLinks returns only showcase targets, without anchors', () => {
  const text = '[a](../apps/showcase/x.tsx#frag) [b](theming.md) [c](../apps/showcase/y.tsx)';
  assert.deepEqual(extractShowcaseLinks(text), ['../apps/showcase/x.tsx', '../apps/showcase/y.tsx']);
});

// --- Canonical-fact tests ---------------------------------------------------

test('the barrel exposes the real component symbols and theme is an add target', () => {
  const symbols = readBarrelSymbols();
  assert.ok(symbols.has('Button'));
  assert.ok(symbols.has('useToast'));
  const addTargets = readPublicAddTargets();
  assert.ok(addTargets.has('button'));
  assert.ok(addTargets.has('theme'));
});

// --- Integration test (against the real repo) -------------------------------

test('runChecks passes for the committed docs', () => {
  const { ok, results } = runChecks();
  const failed = results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`);
  assert.ok(ok, `doc-example checks failed:\n${failed.join('\n')}`);
});
