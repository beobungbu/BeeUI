import { densityModes, type DensityMode } from '@beeui/tokens';
import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #74 — application density visual acceptance. Deliberately NOT
// part of `visualScenarios`/`visual.spec.ts`'s canonical scenario x theme x
// viewport matrix: density is an axis orthogonal to appearance/accessibility,
// so crossing it with all four `visualThemes` would only add redundant
// baselines. This spec renders the one `density` fixture (a representative
// list/table row group plus a form/settings group, from
// `apps/visual-regression/App.tsx`'s `DensityFixture`) across its own three
// modes, restricted to `light` + one `dark` project per viewport — light
// alone already proves the metric change; `dark` proves it composes with the
// appearance axis without a second full crossing.
for (const density of densityModes as readonly DensityMode[]) {
  test(`density ${density}`, async ({ page }, testInfo: TestInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' && metadata.visualTheme !== 'dark',
      'Density (#74) is orthogonal to the high-contrast accessibility axis — light/dark is sufficient proof.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?fixture=density&density=${density}&theme=${metadata.visualTheme}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

    // `comfortable` never calls `applyDensity` (see `DensityFixture`), so its
    // computed row height is the plain default the class already resolves to —
    // proving "comfortable matches the current default metrics" is provable by
    // reading the same computed style compact/spacious also get measured with,
    // not by a separate hardcoded pixel constant.
    const rowHeightPx = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="density-row-1"]');
      return row ? Number.parseFloat(getComputedStyle(row as Element).minHeight) : Number.NaN;
    });
    const expectedRowHeightPx = { compact: 44, comfortable: 56, spacious: 64 }[density];
    expect(rowHeightPx).toBe(expectedRowHeightPx);

    await expect(page).toHaveScreenshot(
      `density--${density}--${metadata.visualTheme}--${metadata.visualViewport}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.0001,
      },
    );
  });
}
