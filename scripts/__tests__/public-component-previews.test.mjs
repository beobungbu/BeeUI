import assert from 'node:assert/strict';
import test from 'node:test';

import { excerptFixture, familyUsageRanges } from '../public-component-previews.mjs';

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
  assert.deepEqual(result.excerpts, [{ start: 1, end: 1, text: '<Accordion testID="root">' }]);
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

test('excerpts are returned in file order', () => {
  const filler = Array.from({ length: 60 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf([...filler, '<Accordion />', ...filler, '<AccordionItem />', ...filler]);
  const starts = excerptFixture(source, FAMILY, 'ordered.tsx').excerpts.map((part) => part.start);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
});

test('an import of the family name is not treated as a usage', () => {
  const filler = Array.from({ length: 200 }, (_, index) => `const filler${index} = ${index};`);
  const source = fixtureOf(["import { Accordion } from '@beemvp/beeui-ui';", ...filler]);
  assert.deepEqual(familyUsageRanges(source, FAMILY, 'imports.tsx'), []);
});

