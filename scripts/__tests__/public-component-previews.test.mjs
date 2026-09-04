import assert from 'node:assert/strict';
import test from 'node:test';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  collectExcerptCitationViolations,
  derivedBindingNames,
  excerptMatchesAnchor,
  isSyntacticallyWholeExcerpt,
  excerptFixture,
  familyUsageRanges,
  renderPreviewAddon,
} from '../public-component-previews.mjs';

// The gallery fixture is the right source — it is the largest typechecked surface exercising
// real public API — but inlining it whole put 1083 lines of unrelated component source on 51 of
// 62 pages. These drive the slicer with synthetic fixtures, so they fail if the slicing stops
// working; asserting against the real gallery would pass on any output that merely looked long.

function fixtureOf(lines) {
  return lines.join('\n');
}

const FAMILY = { name: 'accordion', title: 'Accordion', values: ['Accordion', 'AccordionItem'] };

test('a small fixture is still shown whole', () => {
  const source = fixtureOf(['export const A = () => <Accordion />;']);
  const result = excerptFixture(source, FAMILY, 'small.tsx');
  assert.equal(result.whole, true);
  assert.deepEqual(result.excerpts, []);
});

test('a large fixture is reduced to the lines where the family is used', () => {
  const filler = Array.from({ length: 200 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf([...filler, '<Accordion value="a">', '  <AccordionItem />', '</Accordion>', ...filler]);
  const result = excerptFixture(source, FAMILY, 'large.tsx');

  assert.equal(result.whole, false);
  assert.equal(result.excerpts.length, 1);
  assert.deepEqual(result.excerpts[0], {
    start: 201,
    end: 203,
    // The anchor is the node's own first line, derived without any line number — it is what
    // lets a corrupted line derivation be caught instead of agreeing with itself.
    anchor: '<Accordion value="a">',
    text: '<Accordion value="a">\n  <AccordionItem />\n</Accordion>',
  });
});

// The excerpt's line numbers are the whole basis for claiming it is the same executable source.
test('every excerpt matches the exact lines it names', () => {
  const filler = Array.from({ length: 100 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf([...filler, '<Accordion />', ...filler, '<AccordionItem />', ...filler]);
  const lines = source.split('\n');
  for (const part of excerptFixture(source, FAMILY, 'large.tsx').excerpts) {
    assert.equal(lines.slice(part.start - 1, part.end).join('\n'), part.text);
  }
});

// `useToast` is called, never rendered. Matching only JSX tags left those families falling
// through to the whole-file branch — the exact case the slicer exists to fix.
test('a family used through a hook rather than a tag is still located', () => {
  const filler = Array.from({ length: 200 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf([...filler, 'const { toast } = useToast();', ...filler]);
  const result = excerptFixture(source, { name: 'toast', title: 'Toast', values: ['useToast'] }, 'large.tsx');

  assert.equal(result.whole, false);
  assert.equal(result.excerpts.length, 1);
  assert.match(result.excerpts[0].text, /useToast\(\)/u);
});

// `<Screen>` opens at the top of the gallery and closes at the bottom, so quoting the element
// quotes the file. Past the size threshold only the opening tag is kept.
test('a wrapper element contributes its opening tag, not everything it contains', () => {
  const body = Array.from({ length: 120 }, (_, index) => `  <Other id={${index}} />`);
  const source = fixtureOf(['<Accordion testID="root">', ...body, '</Accordion>', ...body]);
  const result = excerptFixture(source, FAMILY, 'wrapper.tsx');

  assert.equal(result.whole, false);
  assert.deepEqual(result.excerpts, [
    { start: 1, end: 1, text: '<Accordion testID="root">', openingTagOnly: true, anchor: '<Accordion testID="root">' },
  ]);
  // The page must not then claim the omitted remainder belongs to other families: for a wrapper
  // it is this family's own children.
  assert.equal(result.excerpts.every((part) => part.openingTagOnly), true);
});

test('the excerpt stays inside a line and region budget, and reports what it left out', () => {
  const block = ['<Accordion>', ...Array.from({ length: 30 }, () => '  <AccordionItem />'), '</Accordion>'];
  const gap = Array.from({ length: 10 }, () => 'const gap = 1;');
  const source = fixtureOf(Array.from({ length: 12 }, () => [...block, ...gap]).flat());
  const result = excerptFixture(source, FAMILY, 'many.tsx');

  const total = result.excerpts.reduce((sum, part) => sum + (part.end - part.start + 1), 0);
  assert.ok(result.excerpts.length <= 6, `kept ${result.excerpts.length} regions`);
  assert.ok(total <= 120, `kept ${total} lines`);
  assert.equal(result.omittedRegions, result.totalRegions - result.excerpts.length);
  assert.ok(result.omittedRegions > 0);
});

// Both regions must differ in size, or a stable sort preserves file order anyway and the
// assertion passes with the sort deleted — which is what an earlier version of this test did.
test('excerpts are returned in file order even when selection ordered them by size', () => {
  const filler = Array.from({ length: 60 }, (_, index) => `const filler${index} = ${index};`);
  const big = ['<Accordion>', '  <AccordionItem a />', '  <AccordionItem b />', '  <AccordionItem c />', '</Accordion>'];
  const source = fixtureOf([...filler, ...big, ...filler, '<AccordionItem solo />', ...filler]);
  const excerpts = excerptFixture(source, FAMILY, 'ordered.tsx').excerpts;

  assert.equal(excerpts.length, 2);
  assert.ok(excerpts[0].start < excerpts[1].start, 'excerpts must be returned in file order, not selection order');
  // The small region is selected last but printed first only if the sort survives.
  assert.equal(excerpts[0].text.split('\n').length, big.length);
});

test('regions closer together than the merge gap become one excerpt', () => {
  const filler = Array.from({ length: 80 }, (_, index) => `const filler${index} = ${index};`);
  const near = ['<Accordion a />', 'const between = 1;', '<Accordion b />'];
  const source = fixtureOf([...filler, ...near, ...filler]);
  const merged = excerptFixture(source, FAMILY, 'merge.tsx').excerpts;

  assert.equal(merged.length, 1, 'two uses one line apart must merge into a single excerpt');
  assert.equal(merged[0].start, 81);
  assert.equal(merged[0].end, 83);
  assert.match(merged[0].text, /between/u, 'the merged excerpt must include the lines between the two uses');
});

test('regions further apart than the merge gap stay separate', () => {
  const filler = Array.from({ length: 80 }, (_, index) => `const filler${index} = ${index};`);
  const gap = Array.from({ length: 10 }, () => 'const gap = 1;');
  const source = fixtureOf([...filler, '<Accordion a />', ...gap, '<Accordion b />', ...filler]);
  assert.equal(excerptFixture(source, FAMILY, 'nomerge.tsx').excerpts.length, 2);
});

// The region cap and the line cap are separate limits; a test that only exercises one leaves
// the other free to be raised to infinity with a green suite.
test('the region cap is enforced independently of the line budget', () => {
  const gap = Array.from({ length: 10 }, () => 'const gap = 1;');
  const one = ['<Accordion>', '  <AccordionItem />', '</Accordion>'];
  const source = fixtureOf(Array.from({ length: 20 }, () => [...one, ...gap]).flat());
  const result = excerptFixture(source, FAMILY, 'regions.tsx');

  const total = result.excerpts.reduce((sum, part) => sum + (part.end - part.start + 1), 0);
  assert.ok(total < 120, 'this fixture must stay under the line budget so the region cap is what binds');
  assert.equal(result.excerpts.length, 6);
  assert.equal(result.totalRegions, 20);
  assert.equal(result.omittedRegions, 14);
});

// `const toast = useToast();` is one line and true; the eight `toast.show({...})` calls are the
// example. Smallest-first alone shipped the declaration as the whole "verified example source".
test('a substantive region wins the budget over a one-line declaration', () => {
  const filler = Array.from({ length: 80 }, (_, index) => `const filler${index} = ${index};`);
  const big = ['<Accordion>', ...Array.from({ length: 8 }, () => '  <AccordionItem />'), '</Accordion>'];
  const source = fixtureOf(['const solo = Accordion;', ...filler, ...big, ...filler]);
  const excerpts = excerptFixture(source, FAMILY, 'priority.tsx', ).excerpts;

  assert.equal(excerpts[0].start, 1, 'the one-line region is still in file order when both fit');
  assert.ok(
    excerpts.some((part) => part.end - part.start + 1 === big.length),
    'the multi-line usage must be kept, not crowded out by the declaration',
  );
});

test('a family reached through a hook binding is followed to the calls on it', () => {
  const filler = Array.from({ length: 80 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf([
    'const toast = useToast();',
    ...filler,
    'toast.show({',
    "  title: 'Saved',",
    "  tone: 'success',",
    '});',
    ...filler,
  ]);
  const family = { name: 'toast', title: 'Toast', values: ['useToast'] };
  const result = excerptFixture(source, family, 'hook.tsx');

  assert.deepEqual([...derivedBindingNames(source, family, 'hook.tsx')], ['toast']);
  assert.ok(
    result.excerpts.some((part) => part.text.includes('toast.show({')),
    'the calls on the hook binding are the example, not the declaration alone',
  );
});

// A lone `<Spinner />` is a true and empty example.
test('a lone one-line use is widened to the smallest enclosing example', () => {
  const filler = Array.from({ length: 80 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf([
    ...filler,
    '<Box className="flex-row gap-2">',
    '  <Accordion />',
    '  <Other />',
    '</Box>',
    ...filler,
  ]);
  const excerpts = excerptFixture(source, FAMILY, 'widen.tsx').excerpts;

  assert.equal(excerpts.length, 1);
  assert.match(excerpts[0].text, /<Box className="flex-row gap-2">/u);
  assert.match(excerpts[0].text, /<Accordion \/>/u);
});

// --- selection order ----------------------------------------------------------------------
// An earlier version of this file tested the budget but never the order the budget is spent in,
// so reverting substantive-first to plain smallest-first left the suite green — while toast's
// entire example became `const toast = useToast();`.
test('a one-line declaration does not consume the budget ahead of real examples', () => {
  const gap = Array.from({ length: 6 }, () => 'const gap = 1;');
  const block = ['<Accordion>', ...Array.from({ length: 20 }, () => '  <AccordionItem />'), '</Accordion>'];
  // Seven one-line uses and four 22-line uses: smallest-first spends the whole budget on the
  // one-liners; substantive-first keeps the blocks.
  const source = fixtureOf([
    ...Array.from({ length: 7 }, () => ['const solo = Accordion;', ...gap]).flat(),
    ...Array.from({ length: 4 }, () => [...block, ...gap]).flat(),
  ]);
  const kept = excerptFixture(source, FAMILY, 'order.tsx').excerpts;

  const multiLine = kept.filter((part) => part.end - part.start + 1 > 1);
  assert.ok(multiLine.length >= 2, `expected real examples to win the budget, kept ${JSON.stringify(kept.map((p) => [p.start, p.end]))}`);
});

// --- the guard itself ---------------------------------------------------------------------
// The suite above drives the slicer. Every check inside collectPublicComponentPreviewViolations
// could be replaced with `if (false)` and stay green, because nothing exercised the guard.
// These drive it with a synthetic component and fixture on disk.
function guardFixture({ pageMutator = (page) => page, excerptMutator = (excerpt) => excerpt, extraSource = [] } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-preview-guard-'));
  const fixtureRel = 'fixture/gallery.tsx';
  fs.mkdirSync(path.join(rootDir, 'fixture'), { recursive: true });
  const filler = Array.from({ length: 200 }, (_, index) => `const filler${index} = ${index};`);
  const lines = [
    "import { Accordion, AccordionItem } from '@beemvp/beeui-ui';",
    ...filler,
    '<Accordion value="a">',
    '  <AccordionItem />',
    '</Accordion>',
    ...filler,
    ...extraSource,
  ];
  const source = lines.join('\n');
  fs.writeFileSync(path.join(rootDir, fixtureRel), source);

  const component = { name: 'accordion', title: 'Accordion', values: ['Accordion', 'AccordionItem'] };
  const excerpt = excerptMutator(excerptFixture(source, component, fixtureRel), lines);
  const descriptor = {
    component: component.name,
    title: component.title,
    fixture: fixtureRel,
    source,
    excerpt,
    fixtureLineCount: source.split('\n').length,
    sourceHref: `https://example.invalid/${fixtureRel}`,
    showcaseHref: 'https://example.invalid/showcase',
    anatomy: '- root',
  };
  return { rootDir, component, descriptor, page: pageMutator(renderPreviewAddon(descriptor)) };
}

function guardViolations(fixture) {
  return collectExcerptCitationViolations(fixture.rootDir, fixture.component, fixture.descriptor, fixture.page);
}

test('the citation guard accepts a correct excerpt', () => {
  const fixture = guardFixture();
  try {
    assert.deepEqual(guardViolations(fixture), []);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

// The anchor is captured from the AST node, so a wrong citation cannot satisfy it by moving
// both sides together — which is what defeated every comparison between the excerpt and its own
// cited range.
test('the citation guard rejects an excerpt that lost the source it was built from', () => {
  const fixture = guardFixture({
    excerptMutator: (excerpt) => ({
      ...excerpt,
      excerpts: excerpt.excerpts.map((part) => ({ ...part, anchor: '<Accordion value="somethingElse">' })),
    }),
  });
  try {
    assert.ok(guardViolations(fixture).some((v) => /does not contain the source it was built from/u.test(v)));
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test('the citation guard rejects a range that points at other lines', () => {
  const fixture = guardFixture({
    excerptMutator: (excerpt) => ({
      ...excerpt,
      excerpts: excerpt.excerpts.map((part) => ({ ...part, start: part.start + 40, end: part.end + 40 })),
    }),
  });
  try {
    const violations = guardViolations(fixture);
    assert.ok(violations.length > 0, 'a shifted citation must be reported');
    assert.ok(violations.some((v) => /does not match|occurs at/u.test(v)), violations.join(' | '));
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test('the citation guard rejects an excerpt that never mentions the family', () => {
  const fixture = guardFixture({
    excerptMutator: (excerpt) => ({
      ...excerpt,
      excerpts: excerpt.excerpts.map((part) => ({ ...part, start: 2, end: 4, text: 'const filler0 = 0;\nconst filler1 = 1;\nconst filler2 = 2;' })),
    }),
  });
  try {
    assert.ok(guardViolations(fixture).some((v) => /does not mention any export/u.test(v)));
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test('the citation guard rejects an excerpt whose brackets are left open', () => {
  const fixture = guardFixture({
    extraSource: ['<Accordion onPress={() => {', '  doThing();', '}} />'],
    // Cite only the first two lines of that block: a real slice of the file, containing the
    // family and its own first line, but cut where an excerpt would never be cut.
    excerptMutator: (excerpt, lines) => {
      const start = lines.findIndex((line) => line.startsWith('<Accordion onPress=')) + 1;
      return {
        ...excerpt,
        excerpts: [{
          start,
          end: start + 1,
          anchor: '<Accordion onPress={() => {',
          text: lines.slice(start - 1, start + 1).join('\n'),
        }],
      };
    },
  });
  try {
    assert.ok(guardViolations(fixture).some((v) => /whole syntactic unit/u.test(v)), guardViolations(fixture).join(' | '));
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test('the citation guard rejects a visible label that disagrees with the anchor', () => {
  const fixture = guardFixture({
    pageMutator: (page) => page.replace(/\[lines (\d+)–(\d+)\]/u, (_m, a, b) => `[lines ${Number(a) + 500}–${Number(b) + 500}]`),
  });
  try {
    assert.ok(guardViolations(fixture).some((v) => /visible line label/u.test(v)));
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

// Both the generator and the guard route their anchor comparison through this predicate, so
// this test pins both call sites rather than only whichever one a fixture happens to reach.
test('the anchor predicate rejects text that lost the node it was built from', () => {
  assert.equal(excerptMatchesAnchor('<Accordion value="a">\n  <AccordionItem />', '<Accordion value="a">'), true);
  assert.equal(excerptMatchesAnchor('const filler0 = 0;', '<Accordion value="a">'), false);
  // A range with no anchor (a merged span) is not judged by this predicate.
  assert.equal(excerptMatchesAnchor('anything', undefined), true);
});

test('the citation guard rejects an excerpt cut across syntactic boundaries', () => {
  // A window shifted off a statement boundary leaves brackets open — the cheapest signal that a
  // range was not cut where excerpts are cut.
  assert.equal(isSyntacticallyWholeExcerpt('<Accordion onPress={() => {\n  doThing();'), false);
  assert.equal(isSyntacticallyWholeExcerpt('  doThing();\n}} />'), false);
  assert.equal(isSyntacticallyWholeExcerpt('<Accordion onPress={() => doThing()} />'), true);
  // The opening-tag case is deliberately a fragment and must stay accepted.
  assert.equal(isSyntacticallyWholeExcerpt('<Screen testID="root">', true), true);
  assert.equal(isSyntacticallyWholeExcerpt('const half = {', true), false);
});
