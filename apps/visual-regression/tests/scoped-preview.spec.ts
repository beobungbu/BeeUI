import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #68 — a scoped Brand A/B preview. Deliberately NOT part of
// `visualScenarios`/`visual.spec.ts`'s canonical matrix — this proves
// `BeeThemeScope` brand selection itself, which is orthogonal to the
// light/dark/high-contrast appearance axis those scenarios already cover.
// Drives the dedicated `scoped-preview` fixture (Bee and Violet rendered side
// by side through `BeeThemeScope`, from `apps/visual-regression/App.tsx`'s
// `ScopedPreviewFixture`) at `light` only, mobile + desktop.
test('scoped preview: Bee vs Violet', async ({ page }, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light',
    'Scoped brand selection (#68) is proven once, at light — the appearance axis is covered elsewhere.',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?fixture=scoped-preview&theme=${metadata.visualTheme}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  // Prove the two scopes actually resolved different `colors.primary` values —
  // the Button in each scope renders with its own brand's primary fill, not a
  // shared/leaked one.
  const primaryButtonBackgrounds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="button"]'))
      .filter((node) => node.textContent?.includes('Primary action'))
      .map((node) => getComputedStyle(node as Element).backgroundColor),
  );
  expect(primaryButtonBackgrounds).toHaveLength(2);
  expect(primaryButtonBackgrounds[0]).not.toBe(primaryButtonBackgrounds[1]);

  await expect(page).toHaveScreenshot(
    `scoped-preview--${metadata.visualTheme}--${metadata.visualViewport}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    },
  );
});
