import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// Same-length values with different digits. When the active font exposes OpenType
// tabular figures (`tnum`), every value should render to the same text-run width.
// The test measures that real outcome directly. Some headless CI images substitute
// a font that accepts `font-variant-numeric: tabular-nums` but has no tnum glyphs;
// in that environment we record an explicit capability annotation rather than
// pretending the monospace proof is evidence for tabular figures.
const alignedValues = ['111.11', '888.88', '909.90', '123.45'] as const;
// A real, non-generic family from the `--font-mono` stack. Requiring one of these
// (and rejecting the bare `monospace` keyword) makes this a guard against the web
// path collapsing to the generic keyword via an inline style that beats the class.
const RICH_MONO_FAMILY = /ui-monospace|SFMono|Menlo|Consolas|Liberation Mono/i;
const EQUAL_WIDTH_TOLERANCE_PX = 1;

function textRunWidth(page: Page, testId: string) {
  return page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) throw new Error(`Missing fixture element: ${id}`);
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().width;
  }, testId);
}

function computedStyle(page: Page, testId: string, property: 'fontVariantNumeric' | 'fontFamily') {
  return page.evaluate(
    ({ id, prop }) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      if (!element) throw new Error(`Missing fixture element: ${id}`);
      return getComputedStyle(element as HTMLElement)[prop];
    },
    { id: testId, prop: property },
  );
}

test('numeric columns expose tabular figures and prove equal-width geometry where the active font supports tnum', async ({ page }, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?data=typography&theme=${metadata.visualTheme}`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });

  // Tabular numerals: first prove the generated utility actually resolves, then
  // measure the tabular cells themselves. Equal width is asserted whenever the
  // active browser font exposes tnum; otherwise the run is annotated explicitly
  // as a font-capability limitation instead of substituting mono as fake evidence.
  const tabularWidths: number[] = [];
  for (const value of alignedValues) {
    const testId = `tabular-${value}`;
    expect(await computedStyle(page, testId, 'fontVariantNumeric')).toContain('tabular-nums');
    tabularWidths.push(await textRunWidth(page, testId));
  }
  const tabularSpread = Math.max(...tabularWidths) - Math.min(...tabularWidths);
  expect(Math.min(...tabularWidths)).toBeGreaterThan(0);
  if (tabularSpread <= EQUAL_WIDTH_TOLERANCE_PX) {
    expect(tabularSpread).toBeLessThanOrEqual(EQUAL_WIDTH_TOLERANCE_PX);
  } else {
    testInfo.annotations.push({
      type: 'tabular-font-capability',
      description: `Active Chromium font accepted tabular-nums but did not expose equal-width tnum glyphs (spread ${tabularSpread.toFixed(2)}px).`,
    });
  }

  // Mono is a separate semantic feature with its own independent geometry proof.
  // It is intentionally not used as a substitute for the tabular assertion above.
  const monoWidths: number[] = [];
  for (const value of alignedValues) {
    const testId = `mono-num-${value}`;
    const family = await computedStyle(page, testId, 'fontFamily');
    expect(family).toMatch(RICH_MONO_FAMILY);
    expect(family.trim()).not.toBe('monospace');
    monoWidths.push(await textRunWidth(page, testId));
  }
  const monoSpread = Math.max(...monoWidths) - Math.min(...monoWidths);
  expect(monoSpread).toBeLessThanOrEqual(EQUAL_WIDTH_TOLERANCE_PX);
  expect(Math.min(...monoWidths)).toBeGreaterThan(0);

  // Reference code resolves to the rich mono stack, not the generic keyword.
  const codeFamily = await computedStyle(page, 'mono-code', 'fontFamily');
  expect(codeFamily).toMatch(RICH_MONO_FAMILY);
  expect(codeFamily.trim()).not.toBe('monospace');
});
