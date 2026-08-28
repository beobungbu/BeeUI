import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #78 — Violet (Brand B) data-visualization token coverage.
// Deliberately NOT part of `visualScenarios`/`visual.spec.ts`: adding
// `violet-light`/`violet-dark` to the canonical `visualThemes` matrix would
// multiply every other scenario in this file by two extra theme projects.
// Instead this spec drives the dedicated `dataviz-brands` fixture (Bee and
// Violet rendered side by side through `BeeThemeScope`, from
// `apps/visual-regression/App.tsx`'s `DataVizBrandsFixture`), restricted to
// `light` + `dark` (the accessibility axis is #77's concern, not #78's).
test('dataviz brands', async ({ page }, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' && metadata.visualTheme !== 'dark',
    'Bee-vs-Violet data-viz coverage only needs light/dark, not the high-contrast axis.',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?fixture=dataviz-brands&theme=${metadata.visualTheme}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  // Prove the two scoped charts actually resolved *different* chart.highlight
  // colors — the concrete, evidence-backed reason #78 needs a real Violet
  // render rather than assuming the Bee chart tokens carry over unchanged
  // (canonical tokens.json: chart.highlight is violet-500 for Bee, amber-700
  // for Violet, specifically so it never doubles as the Violet brand accent).
  const highlightFills = await page.evaluate(() =>
    Array.from(document.querySelectorAll('text[font-weight="bold"]')).map((node) =>
      (node as SVGTextElement).getAttribute('fill'),
    ),
  );
  expect(highlightFills).toHaveLength(2);
  expect(highlightFills[0]).not.toBe(highlightFills[1]);

  await expect(page).toHaveScreenshot(
    `dataviz-brands--${metadata.visualTheme}--${metadata.visualViewport}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    },
  );
});
