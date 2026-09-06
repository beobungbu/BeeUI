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
  patternLayoutVocabularyViolations,
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
      // attributable rather than a floating assertion about "the pattern".
      assert.deepEqual([...facts.primitives.get('Screen')], ['screen.tsx']);
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
    const screenFile = pattern.source.split('/').pop();
    const responsiveBody = sectionBody(page, 'Responsive contract');
    const accessibilityBody = sectionBody(page, 'Accessibility');
    // A section that does not name the file it was read from is not scoped to anything.
    assert.ok(responsiveBody.includes(`\`${screenFile}\``), `${pattern.slug}: Responsive contract does not name its source`);
    assert.ok(accessibilityBody.includes(`\`${screenFile}\``), `${pattern.slug}: Accessibility does not name its source`);
    responsive.add(responsiveBody);
    accessibility.add(accessibilityBody);
  }
  // Measured on the 37 canonical patterns: 37 distinct bodies for each section. The floor is the
  // measured value, so a change that makes two pages agree — a fact dropped, a scope widened
  // back to a shared paragraph — fails here instead of shipping.
  assert.ok(manifest.length >= 37, `expected at least 37 canonical patterns, found ${manifest.length}`);
  assert.equal(responsive.size, manifest.length, 'two patterns share a Responsive contract body');
  assert.equal(accessibility.size, manifest.length, 'two patterns share an Accessibility body');
  assert.ok(responsive.size >= 37);
  assert.ok(accessibility.size >= 37);
});

// --- Real-repo contract, kept as a smoke test alongside the synthetic cases --

test('the real repository satisfies the public pattern contract', () => {
  assert.deepEqual(collectPublicPatternViolations(ROOT_DIR), []);
});
