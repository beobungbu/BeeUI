import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import {
  collectPublicPatternViolations,
  extractPropsTypeSource,
  renderPublicPatternIndex,
  renderPublicPatternPage,
} from '../public-pattern-reference.mjs';

// Everything here is driven by synthetic pattern objects rather than the real repo, so a
// test failure points at the renderer, not at drift in apps/showcase/patterns content.
function makePattern(overrides = {}) {
  return {
    pack: 'auth',
    packTitle: 'Authentication + Onboarding',
    file: 'fixtures/fake-screen.tsx',
    slug: 'fake-screen',
    componentName: 'FakeScreen',
    propsType: 'FakeScreenProps',
    beeuiComponents: ['Button'],
    callbacks: ['onSubmit'],
    source: 'fixtures/fake-screen.tsx',
    title: 'Fake',
    purpose: 'A fake screen for tests.',
    excluded: 'Everything real.',
    route: '/docs/patterns/auth/fake-screen/',
    runtimeId: 'fake',
    stateTargets: [],
    showcaseHref: '/showcase/?surface=pattern&id=fake&embed=1',
    sourceHref: 'https://github.com/beobungbu/BeeUI/blob/main/fixtures/fake-screen.tsx',
    ...overrides,
  };
}

// Strips the YAML frontmatter block so body-heading assertions cannot be fooled by the
// `title:` line inside it.
function stripFrontmatter(page) {
  const closing = page.indexOf('\n---\n', 4);
  assert.ok(closing !== -1, 'page is missing a closing frontmatter delimiter');
  return page.slice(closing + '\n---\n'.length);
}

// --- extractPropsTypeSource (TypeScript compiler API, not regex) ------------

test('extractPropsTypeSource returns the verbatim type alias text', () => {
  const src = 'export type FooProps = {\n  onSubmit: () => void;\n};\n';
  assert.equal(extractPropsTypeSource(src, 'FooProps'), 'export type FooProps = {\n  onSubmit: () => void;\n};');
});

test('extractPropsTypeSource finds an interface declaration too', () => {
  const src = 'export interface BarProps {\n  value: string;\n}\n';
  assert.equal(extractPropsTypeSource(src, 'BarProps'), 'export interface BarProps {\n  value: string;\n}');
});

test('extractPropsTypeSource is not fooled by an unrelated type sharing a substring name', () => {
  const src = 'export type FooProps = { a: string };\nexport type FooPropsExtra = { b: string };';
  assert.equal(extractPropsTypeSource(src, 'FooProps'), 'export type FooProps = { a: string };');
});

test('extractPropsTypeSource returns null when the type name does not exist in the source', () => {
  const src = 'export type FooProps = { a: string };';
  assert.equal(extractPropsTypeSource(src, 'MissingProps'), null);
});

test('extractPropsTypeSource returns null for a falsy type name', () => {
  assert.equal(extractPropsTypeSource('export type X = {};', null), null);
  assert.equal(extractPropsTypeSource('export type X = {};', undefined), null);
});

// --- M4: the props type is embedded as a real fenced code block -------------

test('renderPublicPatternPage embeds the *ScreenProps fields as a fenced code block derived from the source file', () => {
  // symbolRouteMap() needs the real component registry, so this uses the real ROOT_DIR and
  // writes the synthetic screen fixture underneath it, cleaning up afterwards.
  const relSource = 'scripts/__tests__/.tmp-fixtures/fake-screen.tsx';
  const absSource = path.join(ROOT_DIR, relSource);
  fs.mkdirSync(path.dirname(absSource), { recursive: true });
  fs.writeFileSync(absSource, 'export type FakeScreenProps = {\n  loading?: boolean;\n  onSubmit: () => void;\n};\n');
  try {
    const pattern = makePattern({ source: relSource });
    const page = renderPublicPatternPage(pattern, ROOT_DIR);
    assert.ok(
      page.includes('```tsx\nexport type FakeScreenProps = {\n  loading?: boolean;\n  onSubmit: () => void;\n};\n```'),
      'expected a fenced tsx block with the real props fields',
    );
  } finally {
    fs.rmSync(path.dirname(absSource), { recursive: true, force: true });
  }
});

test('renderPublicPatternPage falls back to a plain notice when no props type is available', () => {
  const pattern = makePattern({ propsType: null });
  const page = renderPublicPatternPage(pattern, ROOT_DIR);
  assert.ok(page.includes('_No exported props type was found in the screen source._'));
  assert.ok(!page.includes('```tsx'));
});

test('renderPublicPatternPage states plainly that the screen is Showcase source, not a package export or Registry CLI content', () => {
  const pattern = makePattern({ propsType: null });
  const page = renderPublicPatternPage(pattern, ROOT_DIR);
  assert.match(page, /Showcase source you copy/);
  assert.match(page, /Registry CLI[\s\S]*does not carry pattern screens/);
});

// --- m2: the "same source" sentence is its own paragraph --------------------

test('renderPublicPatternPage keeps the "same source" sentence out of the last state-target list item', () => {
  const pattern = makePattern({
    propsType: null,
    stateTargets: [{ state: 'loading', href: '/showcase/?surface=pattern&id=fake&state=loading&embed=1' }],
  });
  const page = renderPublicPatternPage(pattern, ROOT_DIR);
  assert.ok(
    page.includes('- [`loading`](/showcase/?surface=pattern&id=fake&state=loading&embed=1)\n\nThe same source is available at'),
    'the sentence must be its own paragraph after the list',
  );
  assert.ok(
    !page.includes('- [`loading`](/showcase/?surface=pattern&id=fake&state=loading&embed=1) The same source is available at'),
    'the sentence must not be glued onto the last <li>',
  );
});

test('renderPublicPatternPage renders cleanly for a screen with zero state targets', () => {
  const pattern = makePattern({ propsType: null, stateTargets: [] });
  const page = renderPublicPatternPage(pattern, ROOT_DIR);
  assert.ok(page.includes('This screen exposes a single default state.\n\nThe same source is available at'));
  assert.ok(!page.includes('- [`'), 'a zero-state pattern must not leave a stray list bullet');
});

// --- M1: no duplicated body <h1> ---------------------------------------------

test('renderPublicPatternPage does not emit a body-level "# " heading (Starlight renders the frontmatter title)', () => {
  const pattern = makePattern({ propsType: null });
  const page = renderPublicPatternPage(pattern, ROOT_DIR);
  const body = stripFrontmatter(page);
  assert.ok(!/^# /m.test(body), 'detail page body must not contain a top-level "# " heading');
  // Sub-headings ("## ...") are expected and must be unaffected.
  assert.ok(/^## Preview/m.test(body));
});

test('renderPublicPatternIndex does not emit a body-level "# " heading', () => {
  const manifest = [makePattern({ propsType: null })];
  const page = renderPublicPatternIndex(manifest);
  const body = stripFrontmatter(page);
  assert.ok(!/^# /m.test(body), 'index page body must not contain a top-level "# " heading');
});

// --- Real-repo contract, kept as a smoke test alongside the synthetic cases --

test('the real repository satisfies the public pattern contract', () => {
  assert.deepEqual(collectPublicPatternViolations(ROOT_DIR), []);
});
