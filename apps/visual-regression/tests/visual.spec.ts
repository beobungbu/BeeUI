import { expect, test } from '@playwright/test';
import {
  screenshotName,
  visualScenarios,
  type VisualProjectMetadata,
} from '../src/visual-contract';

for (const scenario of visualScenarios) {
  test(scenario.id, async ({ page }, testInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?scenario=${scenario.id}&theme=${metadata.visualTheme}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

    const snapshot = screenshotName(
      scenario.id,
      metadata.visualTheme,
      metadata.visualViewport,
    );

    await expect(page).toHaveScreenshot(snapshot, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
}
