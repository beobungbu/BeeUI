import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractExportedComponentName,
  extractExportedPropsType,
  extractPropCallbacks,
  getPatternScreens,
} from '../component-docs-lib.mjs';
import {
  REQUIRED_SECTIONS,
  buildDocument,
  readContent,
  runStructuralChecks,
} from '../generate-pattern-library.mjs';

// --- Pure helper unit tests -------------------------------------------------

test('extractExportedComponentName reads the exported function name', () => {
  const src = 'export function SignInScreen(props) { return null; }';
  assert.equal(extractExportedComponentName(src, 'sign-in-screen.tsx'), 'SignInScreen');
});

test('extractExportedPropsType reads the exported Props type name', () => {
  const src = 'export type SignInScreenProps = {\n  email: string;\n};';
  assert.equal(extractExportedPropsType(src), 'SignInScreenProps');
});

test('extractPropCallbacks collects on* callbacks from the props type body', () => {
  const src = 'export type XProps = {\n  email: string;\n  onSubmit: () => void;\n  onEmailChange?: (v: string) => void;\n};';
  assert.deepEqual(extractPropCallbacks(src), ['onEmailChange', 'onSubmit']);
});

// --- Integration tests (against the real repo) ------------------------------

test('there are 37 pattern screens across four packs, each fully derived', () => {
  const screens = getPatternScreens();
  assert.equal(screens.length, 37);
  const packs = new Set(screens.map((s) => s.pack));
  assert.deepEqual([...packs].sort(), ['account-settings', 'auth', 'commerce-social', 'dashboard-finance']);
  for (const screen of screens) {
    assert.ok(screen.componentName, `no component name for ${screen.file}`);
    assert.ok(screen.propsType, `no props type for ${screen.file}`);
  }
});

test('every screen has a content entry with purpose and excluded prose', () => {
  const screens = getPatternScreens();
  const content = readContent();
  for (const screen of screens) {
    const entry = content.screens[screen.slug];
    assert.ok(entry, `missing content entry for ${screen.slug}`);
    assert.ok(entry.purpose?.trim(), `empty purpose for ${screen.slug}`);
    assert.ok(entry.excluded?.trim(), `empty excluded for ${screen.slug}`);
  }
});

test('generated document contains every required section for every screen', () => {
  const doc = buildDocument();
  const blocks = doc.split(/^### /m).slice(1);
  assert.equal(blocks.length, 37);
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
