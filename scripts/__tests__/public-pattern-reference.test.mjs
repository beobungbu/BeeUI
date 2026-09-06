import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import {
  ALL_PATTERN_NONE_CLAIMS,
  BEEUI_LAYOUT_PRIMITIVES,
  buildPublicPatternManifest,
  collectPatternDerivedClaimViolations,
  collectPatternSourceFiles,
  collectPublicPatternViolations,
  extractPatternLayoutFacts,
  extractPropsTypeSource,
  extractPatternComposedFamilies,
  patternBranchAnalysis,
  patternFileLabel,
  patternLayoutVocabularyViolations,
  patternOpaqueShapeViolations,
  PATTERN_BREAKPOINT_NONE_CLAIM,
  PATTERN_COMPOSED_NONE_CLAIM,
  PATTERN_HORIZONTAL_NONE_CLAIM,
  PATTERN_LAYOUT_NONE_CLAIM,
  PATTERN_PLATFORM_API_NONE_CLAIM,
  PATTERN_PLATFORM_CLASS_NONE_CLAIM,
  PATTERN_ROLES_NONE_CLAIM,
  PATTERN_SCROLL_NONE_CLAIM,
  PATTERN_STATES_NONE_CLAIM,
  PATTERN_VIEWPORT_NONE_CLAIM,
  PATTERN_WIDTH_NONE_CLAIM,
  publishedComposedFamilies,
  publishedFactGroups,
  renderPublicPatternIndex,
  renderPublicPatternPage,
  sectionBody,
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

// --- Derived per-pattern Responsive contract and Accessibility --------------
//
// Both sections used to be one paragraph repeated on all 37 pages. The tests below hold the
// three rules that replaced it: a fact names the files it was read from, a negative is scoped to
// those files, and an independent grep of the same source refuses any negative it refutes and
// any positive naming a token the source does not contain.

const FIXTURE_DIR = 'scripts/__tests__/.tmp-pattern-fixtures';

// Writes a synthetic screen (and whatever it imports) under ROOT_DIR, because the derivation
// reads from disk, and hands back a rel() that turns a fixture name into a repo-relative path.
function withFixture(files, run) {
  const abs = path.join(ROOT_DIR, FIXTURE_DIR);
  fs.rmSync(abs, { recursive: true, force: true });
  for (const [name, source] of Object.entries(files)) {
    const target = path.join(abs, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
  try {
    return run((name) => `${FIXTURE_DIR}/${name}`);
  } finally {
    fs.rmSync(abs, { recursive: true, force: true });
  }
}

function fixtureFiles(names, rel) {
  return names.map((name) => ({
    path: rel(name),
    source: fs.readFileSync(path.join(ROOT_DIR, rel(name)), 'utf8'),
  }));
}

test('collectPatternSourceFiles returns the screen first and every pattern-local file it imports', () => {
  withFixture(
    {
      'screen.tsx': "import { Button } from '@beemvp/beeui-ui';\nimport { Shell } from './shell';\nexport const S = () => <Shell><Button /></Shell>;\n",
      'shell.tsx': "import { gap } from './a-layout';\nexport const Shell = () => <Screen style={{ gap }} />;\n",
      'a-layout.ts': 'export const gap = 8;\n',
    },
    (rel) => {
      const files = collectPatternSourceFiles(rel('screen.tsx'), ROOT_DIR);
      // Entry first so the scope sentence starts with the screen; the rest alphabetical so
      // reordering imports cannot churn every page.
      assert.deepEqual(files.map((file) => file.path.split('/').pop()), ['screen.tsx', 'a-layout.ts', 'shell.tsx']);
    },
  );
});

test('collectPatternSourceFiles refuses an import that leaves the pattern source bound', () => {
  withFixture(
    {
      'nested/screen.tsx': "import { x } from '../outside';\nexport const S = () => x;\n",
      'outside.tsx': 'export const x = 1;\n',
    },
    (rel) => {
      const files = collectPatternSourceFiles(rel('nested/screen.tsx'), ROOT_DIR);
      assert.deepEqual(files.map((file) => file.path.split('/').pop()), ['screen.tsx']);
    },
  );
});

test('collectPatternSourceFiles does not follow a type-only import', () => {
  withFixture(
    {
      // The real case: `account-settings/screens/settings-screen.tsx` imports a theme type from
      // the Appearance screen. Following it published Appearance's layout primitives and
      // `accessibilityLabel` as facts about Settings.
      'screen.tsx':
        "import type { Theme } from './other-screen';\n" +
        "import { type Only, type AlsoOnly } from './all-type-only';\n" +
        "import { Shell } from './shell';\n" +
        'export const S = (t: Theme) => <Shell>{t as unknown as Only & AlsoOnly}</Shell>;\n',
      'other-screen.tsx': 'export type Theme = "light";\nexport const Other = () => <Box accessibilityLabel="other" />;\n',
      'all-type-only.tsx': 'export type Only = 1;\nexport type AlsoOnly = 2;\nexport const Never = () => <HStack />;\n',
      'shell.tsx': 'export const Shell = () => <Screen />;\n',
    },
    (rel) => {
      const files = collectPatternSourceFiles(rel('screen.tsx'), ROOT_DIR);
      assert.deepEqual(files.map((file) => file.path.split('/').pop()), ['screen.tsx', 'shell.tsx']);
      const facts = extractPatternLayoutFacts(files);
      assert.deepEqual([...facts.primitives.keys()], ['Screen'], 'a type-only import contributes no rendered primitive');
    },
  );
});

test('collectPatternSourceFiles returns nothing for a source that does not exist', () => {
  assert.deepEqual(collectPatternSourceFiles('apps/showcase/patterns/nope/screens/nope.tsx', ROOT_DIR), []);
  assert.deepEqual(collectPatternSourceFiles(null, ROOT_DIR), []);
});

test('extractPatternLayoutFacts reads each responsive fact out of the JSX and class strings', () => {
  withFixture(
    {
      'screen.tsx':
        "import { Platform, ScrollView, useWindowDimensions } from 'react-native';\n" +
        'export const S = () => {\n' +
        '  const { width } = useWindowDimensions();\n' +
        "  const pad = Platform.OS === 'web' ? 8 : 0;\n" +
        '  return (\n' +
        '    <Screen contentWidth="sm">\n' +
        '      <ScrollView horizontal className="md:flex-row web:py-12 max-w-md" />\n' +
        '      <VStack>{width + pad}</VStack>\n' +
        '    </Screen>\n' +
        '  );\n' +
        '};\n',
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx'], rel));
      assert.deepEqual([...facts.primitives.keys()].sort(), ['Screen', 'VStack']);
      assert.deepEqual([...facts.scrollContainers.keys()], ['ScrollView']);
      assert.deepEqual([...facts.horizontal.keys()], ['horizontal']);
      assert.deepEqual([...facts.widths.keys()].sort(), ['contentWidth="sm"', 'max-w-md']);
      assert.deepEqual([...facts.breakpointClasses.keys()], ['md:flex-row']);
      assert.deepEqual([...facts.platformClasses.keys()], ['web:py-12']);
      assert.deepEqual([...facts.platformApi.keys()], ['Platform.OS']);
      assert.deepEqual([...facts.viewport.keys()], ['useWindowDimensions']);
      // Every fact carries the file it was read from, which is what makes the rendered line
      // attributable rather than a floating assertion about "the pattern", and the conditions
      // under which that file declares it — none here, so the empty condition.
      assert.deepEqual([...facts.primitives.get('Screen').keys()], ['screen.tsx']);
      assert.deepEqual([...facts.primitives.get('Screen').get('screen.tsx')], ['']);
    },
  );
});

test('extractPatternLayoutFacts does not read horizontal={false} as a horizontal-scrolling declaration', () => {
  withFixture(
    { 'screen.tsx': 'export const S = () => <ScrollView horizontal={false} />;\n' },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx'], rel));
      assert.equal(facts.horizontal.size, 0, 'the vertical default written out is not a horizontal declaration');
      assert.deepEqual([...facts.scrollContainers.keys()], ['ScrollView']);
    },
  );
});

test('extractPatternLayoutFacts does not read class names out of comments', () => {
  withFixture(
    {
      'screen.tsx':
        '// md:flex-row max-w-lg web:px-8 were considered here and rejected.\n' +
        '/* lg:grid */\n' +
        'export const S = () => <VStack className="gap-4" />;\n',
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx'], rel));
      assert.equal(facts.breakpointClasses.size, 0);
      assert.equal(facts.platformClasses.size, 0);
      assert.equal(facts.widths.size, 0);
    },
  );
});

test('extractPatternLayoutFacts counts only Platform.OS and Platform.select as platform branching', () => {
  withFixture(
    { 'screen.tsx': 'export const S = () => <VStack>{Platform.Version}</VStack>;\n' },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx'], rel));
      assert.equal(facts.platformApi.size, 0, 'reading Platform.Version is not a platform branch');
    },
  );
});

// --- Prop-conditional branches ----------------------------------------------
//
// A pack-local shell returns one of two layouts depending on a prop the screen fixes. Reading it
// as a flat bag of JSX published `contentWidth="md"` on six account-settings pages whose screens
// never pass `keyboardAware`, and hid the `max-w-[680px]` that does apply. The invariant these
// tests hold: no page publishes a fact from a branch its screen does not select, and a fact that
// survives from a branch always names the condition that selects it.

const BRANCHING_SHELL =
  'export function Shell({ children, wide = false }) {\n' +
  '  if (wide) {\n' +
  '    return <Screen contentWidth="md">{children}</Screen>;\n' +
  '  }\n' +
  '  return <Box className="mx-auto max-w-[680px] web:py-10">{children}</Box>;\n' +
  '}\n';

test('a fact from a branch the screen does not select is not published at all', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell><VStack /></Shell>;\n",
      'shell.tsx': BRANCHING_SHELL,
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      // `<Shell>` passes no `wide`, so the default branch is the one that renders.
      assert.deepEqual([...facts.primitives.keys()].sort(), ['Box', 'VStack']);
      assert.deepEqual([...facts.widths.keys()], ['max-w-[680px]']);
      assert.deepEqual([...facts.scrollContainers.keys()], []);
      // The surviving branch fact names the condition that selects it; the screen's own
      // unconditional `VStack` carries no clause.
      assert.deepEqual([...facts.widths.get('max-w-[680px]').get('shell.tsx')], ['the branch taken when `wide` is false']);
      assert.deepEqual([...facts.primitives.get('VStack').get('screen.tsx')], ['']);
    },
  );
});

test('the other branch is published, and named, when the screen selects it', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell wide><VStack /></Shell>;\n",
      'shell.tsx': BRANCHING_SHELL,
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      assert.deepEqual([...facts.widths.keys()], ['contentWidth="md"']);
      assert.deepEqual([...facts.widths.get('contentWidth="md"').get('shell.tsx')], ['the branch taken when `wide` is true']);
      assert.deepEqual([...facts.primitives.keys()].sort(), ['Screen', 'VStack']);
    },
  );
});

test('a screen that renders both branches publishes both, each under its own condition', () => {
  withFixture(
    {
      'screen.tsx':
        "import { Shell } from './shell';\n" +
        'export const S = ({ done }) => (done ? <Shell><VStack /></Shell> : <Shell wide><VStack /></Shell>);\n',
      'shell.tsx': BRANCHING_SHELL,
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      assert.deepEqual([...facts.widths.keys()].sort(), ['contentWidth="md"', 'max-w-[680px]']);
      // Neither reading is "the branch taken": the screen renders the shell twice, once each way.
      assert.deepEqual([...facts.widths.get('contentWidth="md"').get('shell.tsx')], ['only when `wide` is true']);
      assert.deepEqual([...facts.widths.get('max-w-[680px]').get('shell.tsx')], ['only when `wide` is false']);
    },
  );
});

test('a value written into both arms of one condition is published without a clause', () => {
  withFixture(
    {
      // Rendered both ways, as `change-password-screen.tsx` renders its shell, so both arms live.
      'screen.tsx':
        "import { Shell } from './shell';\n" +
        'export const S = ({ done }) => (done ? <Shell><VStack /></Shell> : <Shell wide><VStack /></Shell>);\n',
      'shell.tsx':
        'export function Shell({ children, wide = false }) {\n' +
        '  if (wide) {\n' +
        '    return <Box className="web:py-10">{children}</Box>;\n' +
        '  }\n' +
        '  return <Box className="web:py-10">{children}</Box>;\n' +
        '}\n',
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      // Both arms declare it, so the condition decides nothing and naming it would say less than
      // saying nothing.
      assert.deepEqual([...facts.platformClasses.get('web:py-10').get('shell.tsx')], ['']);
    },
  );
});

test('a class inside a prop ternary is scoped to the arm the screen selects', () => {
  const shell =
    'export function Shell({ children, compact = false }) {\n' +
    "  return <Box className={compact ? 'px-5 py-6' : 'px-5 web:py-12'}>{children}</Box>;\n" +
    '}\n';
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell compact><VStack /></Shell>;\n",
      'shell.tsx': shell,
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      assert.equal(facts.platformClasses.size, 0, '`web:py-12` is in the arm a compact screen does not take');
    },
  );
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell><VStack /></Shell>;\n",
      'shell.tsx': shell,
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      assert.deepEqual([...facts.platformClasses.get('web:py-12').get('shell.tsx')], ['the branch taken when `compact` is false']);
    },
  );
});

test('a branch nothing in the read set resolves keeps both arms, each named', () => {
  withFixture(
    {
      // `Shell` is never rendered here, so neither arm can be ruled out.
      'screen.tsx': "import { helper } from './shell';\nexport const S = () => <VStack>{helper}</VStack>;\n",
      'shell.tsx': `export const helper = 1;\n${BRANCHING_SHELL}`,
    },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      assert.deepEqual([...facts.widths.get('contentWidth="md"').get('shell.tsx')], ['only when `wide` is true']);
      assert.deepEqual([...facts.widths.get('max-w-[680px]').get('shell.tsx')], ['only when `wide` is false']);
    },
  );
});

test('extractPatternLayoutFacts reads arbitrary and multi-segment max-w classes', () => {
  withFixture(
    { 'screen.tsx': 'export const S = () => <Box className="max-w-[680px] max-w-screen-md max-w-3xl maxw-8" />;\n' },
    (rel) => {
      const facts = extractPatternLayoutFacts(fixtureFiles(['screen.tsx'], rel));
      // `max-w-[680px]` is the spelling `settings-screen-shell.tsx` uses; reading only the scale
      // form published "no width constraint" reasoning on six pages that have one.
      assert.deepEqual([...facts.widths.keys()].sort(), ['max-w-3xl', 'max-w-[680px]', 'max-w-screen-md']);
    },
  );
});

test('the source oracle refuses a fact lifted out of a branch the screen does not select', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell><VStack /></Shell>;\n",
      'shell.tsx': BRANCHING_SHELL,
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const page = '\n## Responsive contract\n\n- **Width constraint:** `contentWidth="md"` (`shell.tsx`).\n\n## Accessibility\n\n- x\n\n## Related\n';
      const violations = collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR);
      assert.equal(violations.length, 1, JSON.stringify(violations));
      assert.match(violations[0], /publishes `contentWidth="md"` as a derived fact/);
    },
  );
});

test('the source oracle refuses a branch-only fact published with no condition', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell><VStack /></Shell>;\n",
      'shell.tsx': BRANCHING_SHELL,
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const bare = '\n## Responsive contract\n\n- **Width constraint:** `max-w-[680px]` (`shell.tsx`).\n\n## Accessibility\n\n- x\n\n## Related\n';
      const violations = collectPatternDerivedClaimViolations(bare, pattern, ROOT_DIR);
      assert.equal(violations.length, 1, JSON.stringify(violations));
      assert.match(violations[0], /publishes `max-w-\[680px\]` from `shell\.tsx` with no condition/);

      // The same fact with its condition named is exactly what the page should publish.
      const named = '\n## Responsive contract\n\n- **Width constraint:** `max-w-[680px]` (`shell.tsx`, the branch taken when `wide` is false).\n\n## Accessibility\n\n- x\n\n## Related\n';
      assert.deepEqual(collectPatternDerivedClaimViolations(named, pattern, ROOT_DIR), []);
    },
  );
});

test('the source oracle does not demand a condition for a fact the file states unconditionally', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell><VStack /></Shell>;\n",
      // `max-w-[680px]` appears outside the branch as well as inside it.
      'shell.tsx':
        'export function Shell({ children, wide = false }) {\n' +
        '  if (wide) {\n' +
        '    return <Screen contentWidth="md">{children}</Screen>;\n' +
        '  }\n' +
        '  return <Box className="max-w-[680px]">{children}</Box>;\n' +
        '}\n' +
        'export const outer = <Box className="max-w-[680px]" />;\n',
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const page = '\n## Responsive contract\n\n- **Width constraint:** `max-w-[680px]` (`shell.tsx`).\n\n## Accessibility\n\n- x\n\n## Related\n';
      assert.deepEqual(collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR), []);
    },
  );
});

test('the oracle blanks the branch the screen does not select, reading the source as text', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell><VStack /></Shell>;\n",
      'shell.tsx': BRANCHING_SHELL,
    },
    (rel) => {
      const analysis = patternBranchAnalysis(fixtureFiles(['screen.tsx', 'shell.tsx'], rel));
      const shell = analysis.find((file) => file.name === 'shell.tsx');
      // The oracle reaches the same conclusion as the AST extractor by counting braces and
      // quotes, sharing no code with it, so a disagreement surfaces as a violation.
      assert.ok(!shell.live.includes('contentWidth'), shell.live);
      assert.ok(shell.live.includes('max-w-[680px]'), shell.live);
      assert.ok(shell.stripped.includes('contentWidth'), 'the unblanked source still has both arms');
    },
  );
});

test('publishedFactGroups reads a value, its files and its condition back off the page', () => {
  const section = '- **Width constraint:** `max-w-[680px]` (`shell.tsx`, the branch taken when `wide` is false), `contentWidth="sm"` (`a.tsx`, `b.tsx`).\n';
  assert.deepEqual(publishedFactGroups(section), [
    { value: 'max-w-[680px]', files: ['shell.tsx'], condition: 'the branch taken when `wide` is false' },
    { value: 'contentWidth="sm"', files: ['a.tsx', 'b.tsx'], condition: '' },
  ]);
});

// --- Shapes the derivation cannot see ---------------------------------------
//
// None of these occurs in `apps/showcase/patterns/**` today. Each one would make a real fact
// invisible to both the AST extractor and the textual oracle — an aliased `<Scroller />` would
// publish "no scroll container" — so the day one appears it has to stop CI, not ship a page.

const OPAQUE_SOURCE = new Map([
  ['a qualified JSX tag', "import * as RN from 'x';\nexport const S = () => <RN.ScrollView />;\n"],
  ['a namespace import', "import * as RN from 'react-native';\nexport const S = () => null;\n"],
  ['an aliased import', "import { ScrollView as Scroller } from 'react-native';\nexport const S = () => <Scroller />;\n"],
  ['element access', "export const S = () => Platform['OS'];\n"],
  ['a destructure', 'export const S = () => { const { OS } = Platform; return OS; };\n'],
  ['a dynamic import', "export const S = () => import('./shell');\n"],
  ['require', "export const S = () => require('./shell');\n"],
]);

for (const [shape, source] of OPAQUE_SOURCE) {
  test(`the generator refuses ${shape}, which neither derivation can read`, () => {
    const violations = patternOpaqueShapeViolations([{ path: 'patterns/screen.tsx', source }]);
    assert.ok(violations.length > 0, `nothing refused ${shape}`);
    assert.match(violations[0], /which the pattern fact derivation cannot see/);
  });
}

test('the generator accepts the qualified tags and imports that hide nothing', () => {
  const files = [
    { path: 'patterns/screen.tsx', source: "import * as React from 'react';\nexport const S = () => <React.Fragment />;\n" },
    { path: 'patterns/other.tsx', source: "import { Button as Cta } from '@beemvp/beeui-ui';\nexport const O = () => <Cta />;\n" },
  ];
  // `React.Fragment` and an aliased `Button` cannot turn a tracked primitive into silence.
  assert.deepEqual(patternOpaqueShapeViolations(files), []);
});

test('renderPublicPatternPage scopes every negative to the files it read and names them', () => {
  withFixture(
    { 'screen.tsx': "import { Button } from '@beemvp/beeui-ui';\nexport const S = () => <Button />;\n" },
    (rel) => {
      const page = renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR);
      const responsive = sectionBody(page, 'Responsive contract');
      assert.match(responsive, /Read from the screen file alone: `screen\.tsx`\./);
      // The negative names its scope. A categorical "this pattern does not scroll horizontally"
      // is a claim about files the scan never opened.
      assert.ok(responsive.includes(`${PATTERN_HORIZONTAL_NONE_CLAIM} in \`screen.tsx\`.`));
      assert.ok(responsive.includes(`${PATTERN_VIEWPORT_NONE_CLAIM} in \`screen.tsx\`.`));
      const a11y = sectionBody(page, 'Accessibility');
      assert.ok(a11y.includes(`${PATTERN_ROLES_NONE_CLAIM} set in \`screen.tsx\`.`));
      // The composed family is linked, not summarised: restating Button's roles here would be a
      // second copy that drifts from the page deriving them.
      assert.match(a11y, /\[`Button`\]\(\/docs\/components\/button\/\)/);
      assert.ok(!a11y.includes('roles and states it sets are restated'));
    },
  );
});

test('the read-scope sentence describes the closure it actually walked, not a direct-import list', () => {
  withFixture(
    {
      // `screen.tsx` imports `shell.tsx`; `deep.tsx` arrives through `shell.tsx`, so "the 2 files
      // it imports" would assert a relation the screen does not have.
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell />;\n",
      'shell.tsx': "import { deep } from './deep';\nexport const Shell = () => <Box>{deep}</Box>;\n",
      'deep.tsx': 'export const deep = 1;\n',
    },
    (rel) => {
      const page = renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR);
      const responsive = sectionBody(page, 'Responsive contract');
      assert.match(responsive, /the 2 pattern-local files in its runtime import closure, direct and transitive/);
      assert.ok(!responsive.includes('files it imports'), 'the closure is not a direct-import list');
    },
  );
});

test('the scroll negative is scoped to elements and hands the question to the family that scrolls', () => {
  withFixture(
    {
      'screen.tsx':
        "import { KeyboardAwareScreen } from '@beemvp/beeui-ui';\n" +
        'export const S = () => <KeyboardAwareScreen><Box /></KeyboardAwareScreen>;\n',
    },
    (rel) => {
      const responsive = sectionBody(
        renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR),
        'Responsive contract',
      );
      // `KeyboardAwareScreen` composes a `ScrollView`, so "no scroll container is rendered" was
      // the wrong answer to the question the label asks. What this file can decide is elements.
      assert.ok(responsive.includes('no `ScrollView`, `FlatList`, `SectionList` or `VirtualizedList` element'), responsive);
      assert.match(responsive, /scrolling is owned by the composed `KeyboardAwareScreen`, whose own page derives it/);
      assert.ok(!responsive.includes('no scroll container is rendered'), 'the categorical wording must be gone');
    },
  );
});

test('the scroll negative stays plain when nothing in the read set composes a scrolling family', () => {
  withFixture(
    { 'screen.tsx': "import { Box } from '@beemvp/beeui-ui';\nexport const S = () => <Box />;\n" },
    (rel) => {
      const responsive = sectionBody(
        renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR),
        'Responsive contract',
      );
      assert.ok(!responsive.includes('scrolling is owned by'), responsive);
    },
  );
});

// One source per registered negative, chosen to refute exactly that claim. The table is asserted
// to be total: an oracle added without a refuting source fails here rather than sitting in the
// list looking like a guard.
const REFUTING_SOURCE = new Map([
  [PATTERN_LAYOUT_NONE_CLAIM, 'export const S = () => <Screen />;\n'],
  [PATTERN_SCROLL_NONE_CLAIM, 'export const S = () => <ScrollView />;\n'],
  [PATTERN_HORIZONTAL_NONE_CLAIM, 'export const S = () => <ScrollView horizontal />;\n'],
  [PATTERN_WIDTH_NONE_CLAIM, 'export const S = () => <Screen contentWidth="sm" />;\n'],
  [PATTERN_BREAKPOINT_NONE_CLAIM, 'export const S = () => <View className="md:flex-row" />;\n'],
  [PATTERN_PLATFORM_CLASS_NONE_CLAIM, 'export const S = () => <View className="web:py-12" />;\n'],
  [PATTERN_PLATFORM_API_NONE_CLAIM, "export const S = () => (Platform.OS === 'web' ? null : null);\n"],
  [PATTERN_VIEWPORT_NONE_CLAIM, 'export const S = () => useWindowDimensions().width;\n'],
  [PATTERN_ROLES_NONE_CLAIM, 'export const S = () => <View accessibilityRole="button" />;\n'],
  [PATTERN_STATES_NONE_CLAIM, 'export const S = () => <View accessibilityLabel="Close" />;\n'],
  [PATTERN_COMPOSED_NONE_CLAIM, "import { Button } from '@beemvp/beeui-ui';\nexport const S = () => <Button />;\n"],
]);

// A page carrying one claim and nothing else, so a violation can only come from that claim.
function pageWithClaim(claim) {
  return `\n## Responsive contract\n\n- ${claim} in \`screen.tsx\`.\n\n## Accessibility\n\n- ${claim} in \`screen.tsx\`.\n\n## Related\n`;
}

// A page whose Accessibility section carries only the composed-family line, so a violation can
// only have come from that line.
function composedPage(entries) {
  return '\n## Responsive contract\n\n- x\n\n## Accessibility\n\n' +
    `- **Semantics inherited from composed BeeUI families:** ${entries} — each family's own page ` +
    'derives the roles and states it sets; they are not restated here.\n\n## Related\n';
}

test('every registered negative claim has a source that refutes it', () => {
  assert.deepEqual(
    ALL_PATTERN_NONE_CLAIMS.filter((claim) => !REFUTING_SOURCE.has(claim)),
    [],
    'a negative with no refuting source in this table is an unguarded claim',
  );
});

for (const claim of REFUTING_SOURCE.keys()) {
  test(`the source oracle refuses "${claim}" when the source refutes it`, () => {
    withFixture({ 'screen.tsx': REFUTING_SOURCE.get(claim) }, (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const violations = collectPatternDerivedClaimViolations(pageWithClaim(claim), pattern, ROOT_DIR);
      assert.ok(violations.length > 0, `nothing refused the false claim ${claim}`);
    });
  });
}

test('the source oracle stays silent on a claim the source does not refute', () => {
  // Guards the table above from passing on a probe that matches anything: this source refutes
  // none of the claims, so every one of them must survive it.
  withFixture({ 'screen.tsx': 'export const S = () => null;\n' }, (rel) => {
    const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
    for (const claim of REFUTING_SOURCE.keys()) {
      assert.deepEqual(collectPatternDerivedClaimViolations(pageWithClaim(claim), pattern, ROOT_DIR), [], claim);
    }
  });
});

test('the source oracle refuses a published fact that appears in no source file', () => {
  withFixture({ 'screen.tsx': 'export const S = () => <VStack />;\n' }, (rel) => {
    const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
    const page = '\n## Responsive contract\n\n- **BeeUI layout primitives rendered:** `BottomActionBar` (`screen.tsx`).\n\n## Accessibility\n\n- x\n\n## Related\n';
    const violations = collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /publishes `BottomActionBar` as a derived fact/);
  });
});

test('the source oracle does not read the file names a fact was attributed to as facts', () => {
  withFixture({ 'screen.tsx': 'export const S = () => <VStack />;\n' }, (rel) => {
    const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
    const page = '\n## Responsive contract\n\n- **BeeUI layout primitives rendered:** `VStack` (`screen.tsx`).\n\n## Accessibility\n\n- x\n\n## Related\n';
    assert.deepEqual(collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR), []);
  });
});

test('the page is refused when it denies layout primitives its own Composition list names', () => {
  withFixture({ 'screen.tsx': 'export const S = () => null;\n' }, (rel) => {
    const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: ['Screen', 'Button'] });
    const violations = collectPatternDerivedClaimViolations(pageWithClaim(PATTERN_LAYOUT_NONE_CLAIM), pattern, ROOT_DIR);
    assert.ok(violations.some((violation) => violation.includes('`Screen`')));
    assert.ok(!violations.some((violation) => violation.includes('`Button`')), 'Button is not a layout primitive');
  });
});

test('the page is refused when it publishes a value that is not an accessibility role', () => {
  withFixture({ 'screen.tsx': "export const S = () => <View accessibilityRole={mode === 'single' ? 'radiogroup' : undefined} />;\n" }, (rel) => {
    const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
    const page = '\n## Responsive contract\n\n- x\n\n## Accessibility\n\n- **Roles this screen sets itself:** `radiogroup` (`screen.tsx`), `single` (`screen.tsx`).\n\n## Related\n';
    const violations = collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR);
    // Exactly one: `radiogroup` is a role and `screen.tsx` is a file name, not a role that
    // happens to be missing from the vocabulary.
    assert.equal(violations.length, 1);
    assert.match(violations[0], /publishes `single` as an accessibility role, which is not one/);
  });
});

test('the accessibility line attributes each fact to the files that set it, not to the whole read set', () => {
  withFixture(
    {
      'screen.tsx': "import { Card } from '@beemvp/beeui-ui';\nimport { Tile } from './tile';\nexport const S = () => <Card accessibilityLabel=\"Summary\"><Tile /></Card>;\n",
      'tile.tsx': 'export const Tile = () => <View accessibilityRole="button" accessible />;\n',
    },
    (rel) => {
      const page = renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR);
      const a11y = sectionBody(page, 'Accessibility');
      assert.ok(a11y.includes('**Roles this screen sets itself:** `button` (`tile.tsx`).'), a11y);
      // `accessibilityLabel` is set only by the screen and `accessible` only by the tile. A
      // single "read from `screen.tsx`, `tile.tsx`" clause would assert both of both.
      assert.ok(a11y.includes('`accessibilityLabel` (`screen.tsx`), `accessible` (`tile.tsx`)'), a11y);
    },
  );
});

// --- Composed families: rendered, not imported ------------------------------

// A shell whose two returns render different BeeUI families, so "what it imports" and "what this
// screen renders" are different sets — the shape `account-settings/components/
// settings-screen-shell.tsx` has, and the reason six pages named `KeyboardAwareScreen` as a
// family whose semantics they inherit for screens that never render it.
const COMPOSING_SHELL =
  "import { Box, KeyboardAwareScreen, Screen } from '@beemvp/beeui-ui';\n" +
  'export function Shell({ keyboardAware = false, children }) {\n' +
  '  if (keyboardAware) {\n' +
  '    return <KeyboardAwareScreen><Box>{children}</Box></KeyboardAwareScreen>;\n' +
  '  }\n' +
  '  return <Screen><Box>{children}</Box></Screen>;\n' +
  '}\n';

test('a family the read set imports but does not render under the selected branch is not named as composed', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell />;\n",
      'shell.tsx': COMPOSING_SHELL,
    },
    (rel) => {
      const files = collectPatternSourceFiles(rel('screen.tsx'), ROOT_DIR);
      assert.deepEqual([...extractPatternComposedFamilies(files).keys()].sort(), ['Box', 'Screen']);
      const a11y = sectionBody(
        renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR),
        'Accessibility',
      );
      assert.ok(!a11y.includes('KeyboardAwareScreen'), a11y);
      // `Box` is rendered in both arms, so the condition decides nothing and it carries no clause;
      // `Screen` exists only in the arm this screen takes, and says so.
      assert.match(a11y, /\[`Box`\]\(\/docs\/components\/box\/\),/);
      assert.match(a11y, /\[`Screen`\]\([^)]*\) \(`shell\.tsx`, the branch taken when `keyboardAware` is false\)/);
    },
  );
});

test('a family rendered in both arms of a screen that selects both is named under each condition', () => {
  withFixture(
    {
      'screen.tsx':
        "import { Shell } from './shell';\n" +
        'export const S = () => <><Shell /><Shell keyboardAware /></>;\n',
      'shell.tsx': COMPOSING_SHELL,
    },
    (rel) => {
      const a11y = sectionBody(
        renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR),
        'Accessibility',
      );
      assert.match(a11y, /\[`KeyboardAwareScreen`\]\([^)]*\) \(`shell\.tsx`, only when `keyboardAware` is true\)/);
      assert.match(a11y, /\[`Screen`\]\([^)]*\) \(`shell\.tsx`, only when `keyboardAware` is false\)/);
    },
  );
});

test('the source oracle refuses a page naming a family the read set does not render under the selected branch', () => {
  withFixture(
    {
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell />;\n",
      'shell.tsx': COMPOSING_SHELL,
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const page = composedPage('[`KeyboardAwareScreen`](/docs/components/keyboard-aware-screen/)');
      const violations = collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR);
      assert.ok(
        violations.some((violation) => /names `KeyboardAwareScreen` as a composed BeeUI family, but no file it reads renders/u.test(violation)),
        violations.join('\n'),
      );
    },
  );
});

test('the source oracle refuses a composed family published without the condition that selects it', () => {
  withFixture(
    {
      // Both arms are selected here, so nothing is blanked and `KeyboardAwareScreen` is live —
      // the fact is true, but only under a condition, and the bare line does not say so.
      'screen.tsx':
        "import { Shell } from './shell';\n" +
        'export const S = () => <><Shell /><Shell keyboardAware /></>;\n',
      'shell.tsx': COMPOSING_SHELL,
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const page = composedPage('[`KeyboardAwareScreen`](/docs/components/keyboard-aware-screen/)');
      const violations = collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR);
      assert.deepEqual(violations.map((violation) => violation.replace(/^[^:]+: /u, '')), [
        'names `KeyboardAwareScreen` as a composed BeeUI family with no condition, but every file ' +
        'that renders it does so only inside a prop-conditional branch (`keyboardAware`).',
      ]);
    },
  );
});

test('the source oracle accepts a composed family that carries its condition', () => {
  withFixture(
    {
      'screen.tsx':
        "import { Shell } from './shell';\n" +
        'export const S = () => <><Shell /><Shell keyboardAware /></>;\n',
      'shell.tsx': COMPOSING_SHELL,
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), beeuiComponents: [] });
      const page = composedPage(
        '[`KeyboardAwareScreen`](/docs/components/keyboard-aware-screen/) (`shell.tsx`, only when `keyboardAware` is true)',
      );
      assert.deepEqual(collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR), []);
    },
  );
});

test('publishedComposedFamilies reads a family and its clause back off the page, and no module specifier', () => {
  const section =
    '- **Semantics inherited from composed BeeUI families:** [`Box`](/docs/components/box/), ' +
    '[`Screen`](/docs/components/screen/) (`shell.tsx`, the branch taken when `keyboardAware` is false)' +
    " — each family's own page derives the roles and states it sets; they are not restated here.\n" +
    '- **Rendered from `@beemvp/beeui-ui` with no public component page:** `NotAFamily`.\n';
  assert.deepEqual(publishedComposedFamilies(section), [
    { name: 'Box', condition: '' },
    { name: 'Screen', condition: 'the branch taken when `keyboardAware` is false' },
    { name: 'NotAFamily', condition: '' },
  ]);
});

test('a rendered BeeUI export with no public component page is listed separately and unlinked', () => {
  withFixture(
    {
      'screen.tsx':
        "import { Box, NotAPublishedFamily } from '@beemvp/beeui-ui';\n" +
        'export const S = () => <Box><NotAPublishedFamily /></Box>;\n',
    },
    (rel) => {
      const a11y = sectionBody(
        renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR),
        'Accessibility',
      );
      assert.ok(
        a11y.includes('**Rendered from `@beemvp/beeui-ui` with no public component page:** `NotAPublishedFamily`.'),
        a11y,
      );
    },
  );
});

test('a composite condition is a branch to neither derivation, so no clause is published or demanded', () => {
  withFixture(
    {
      // `actionLabel && onAction ? …` is the shape `dashboard-finance/components/section-header
      // .tsx` uses. The extractor resolves a branch only when the whole condition is a prop
      // identifier, and the textual oracle has to draw the same line: reading this as a branch on
      // `onAction` blanked text the extractor kept, and the two disagreed on a true fact.
      'screen.tsx': "import { Shell } from './shell';\nexport const S = () => <Shell />;\n",
      'shell.tsx':
        "import { Button, Screen } from '@beemvp/beeui-ui';\n" +
        'export function Shell({ label, onAction }) {\n' +
        '  return <Screen>{label && onAction ? <Button onPress={onAction} /> : null}</Screen>;\n' +
        '}\n',
    },
    (rel) => {
      const pattern = makePattern({ source: rel('screen.tsx'), propsType: null, beeuiComponents: [] });
      const page = renderPublicPatternPage(pattern, ROOT_DIR);
      const a11y = sectionBody(page, 'Accessibility');
      assert.match(a11y, /\[`Button`\]\(\/docs\/components\/button\/\),/);
      assert.ok(!a11y.includes('only when `onAction`'), a11y);
      assert.deepEqual(collectPatternDerivedClaimViolations(page, pattern, ROOT_DIR), []);
    },
  );
});

// --- File identity ----------------------------------------------------------

test('a file named on a pattern page resolves to exactly one source file', () => {
  const byLabel = new Map();
  for (const pattern of buildPublicPatternManifest(ROOT_DIR)) {
    for (const file of collectPatternSourceFiles(pattern.source, ROOT_DIR)) {
      const label = patternFileLabel(file.path);
      if (!byLabel.has(label)) byLabel.set(label, new Set());
      byLabel.get(label).add(file.path);
    }
  }
  const ambiguous = [...byLabel].filter(([, paths]) => paths.size > 1).map(([label]) => label);
  assert.deepEqual(ambiguous, [], 'a name that stands for two different source files cannot be resolved by a reader');
  // The two files this rule exists for: same basename, different pack, different content.
  assert.ok(byLabel.has('commerce-social/components/screen-shell.tsx'));
  assert.ok(byLabel.has('dashboard-finance/components/screen-shell.tsx'));
  assert.equal(
    patternFileLabel('apps/showcase/patterns/commerce-social/components/screen-shell.tsx'),
    'commerce-social/components/screen-shell.tsx',
  );
});

// --- Platform-scoped accessibility facts -------------------------------------

test('an accessibility fact a pattern sets on one platform only is published with that platform named', () => {
  withFixture(
    {
      'screen.tsx':
        "import { Platform } from 'react-native';\n" +
        "import { Box } from '@beemvp/beeui-ui';\n" +
        "export const S = () => (Platform.OS === 'ios'\n" +
        '  ? <Box accessibilityRole="header" />\n' +
        '  : <Box accessibilityLabel="Summary" />);\n',
    },
    (rel) => {
      const a11y = sectionBody(
        renderPublicPatternPage(makePattern({ source: rel('screen.tsx'), propsType: null }), ROOT_DIR),
        'Accessibility',
      );
      // A pattern can branch on `Platform.OS` exactly as a component can, so the platform-qualified
      // form is reachable from pattern source, not only from a platform-suffixed component file.
      assert.ok(a11y.includes('**Roles this screen sets itself:** `header` (iOS; `screen.tsx`).'), a11y);
      assert.ok(a11y.includes('`accessibilityLabel` (Android and Web; `screen.tsx`)'), a11y);
    },
  );
});

test('the layout-primitive vocabulary names only real public BeeUI exports', () => {
  assert.ok(BEEUI_LAYOUT_PRIMITIVES.length > 0);
  assert.deepEqual(patternLayoutVocabularyViolations(ROOT_DIR), []);
});

// --- Distinctness: the sections are per-pattern facts, not one shared paragraph

test('every pattern page derives its own Responsive contract and Accessibility body', () => {
  const manifest = buildPublicPatternManifest(ROOT_DIR);
  const responsive = new Set();
  const accessibility = new Set();
  for (const pattern of manifest) {
    const page = renderPublicPatternPage(pattern, ROOT_DIR);
    const screenFile = patternFileLabel(pattern.source);
    const responsiveBody = sectionBody(page, 'Responsive contract');
    const accessibilityBody = sectionBody(page, 'Accessibility');
    // A section that does not name the file it was read from is not scoped to anything.
    assert.ok(responsiveBody.includes(`\`${screenFile}\``), `${pattern.slug}: Responsive contract does not name its source`);
    assert.ok(accessibilityBody.includes(`\`${screenFile}\``), `${pattern.slug}: Accessibility does not name its source`);
    responsive.add(responsiveBody);
    accessibility.add(accessibilityBody);
  }
  // 37 distinct whole bodies — but the `Read from …` preamble names the screen file, so it alone
  // makes every body unique and this assertion cannot fail on any change to the facts. It is kept
  // because it is cheap, and it is not the guard; the guard is the next test.
  assert.ok(manifest.length >= 37, `expected at least 37 canonical patterns, found ${manifest.length}`);
  assert.equal(responsive.size, manifest.length, 'two patterns share a Responsive contract body');
  assert.equal(accessibility.size, manifest.length, 'two patterns share an Accessibility body');
});

// The bullet list with the preamble and every file attribution removed: what the page says about
// the screen, minus what it says about which files it read.
function factBodyOf(section) {
  return section
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .join('\n')
    .replace(/`[^`]+\.(?:tsx?|json|md)`/gu, '')
    .replace(/[\s,;]+/gu, ' ')
    .trim();
}

test('the fact bodies themselves differ from page to page, not just the file lists', () => {
  const clusters = { 'Responsive contract': new Map(), Accessibility: new Map() };
  for (const pattern of buildPublicPatternManifest(ROOT_DIR)) {
    const page = renderPublicPatternPage(pattern, ROOT_DIR);
    for (const heading of Object.keys(clusters)) {
      const body = factBodyOf(sectionBody(page, heading));
      clusters[heading].set(body, (clusters[heading].get(body) ?? 0) + 1);
    }
  }

  // Measured on the 37 canonical patterns, preamble and file names stripped. The floors are the
  // measured values, so replacing the bullet lists with one shared sentence — the pre-PR defect,
  // which the whole-body assertion above survives because the preamble carries it — drops the
  // distinct count to 1 and raises the largest cluster to 37, and fails here twice.
  const measured = {
    'Responsive contract': { distinct: 21, largestCluster: 4 },
    Accessibility: { distinct: 36, largestCluster: 2 },
  };
  for (const [heading, floor] of Object.entries(measured)) {
    const counts = clusters[heading];
    assert.ok(
      counts.size >= floor.distinct,
      `${heading}: ${counts.size} distinct fact bodies, below the measured ${floor.distinct}`,
    );
    const largest = Math.max(...counts.values());
    assert.ok(
      largest <= floor.largestCluster,
      `${heading}: ${largest} pages share one fact body, above the measured ${floor.largestCluster}`,
    );
  }
});

// --- Real-repo contract, kept as a smoke test alongside the synthetic cases --

test('the real repository satisfies the public pattern contract', () => {
  assert.deepEqual(collectPublicPatternViolations(ROOT_DIR), []);
});
