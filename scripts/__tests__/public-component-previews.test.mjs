import assert from 'node:assert/strict';
import test from 'node:test';

import { derivedBindingNames, excerptFixture, familyUsageRanges } from '../public-component-previews.mjs';

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
  assert.deepEqual(result.excerpts[0], { start: 201, end: 203, text: '<Accordion value="a">\n  <AccordionItem />\n</Accordion>' });
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
    { start: 1, end: 1, text: '<Accordion testID="root">', openingTagOnly: true },
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
