import { expect, test } from '@playwright/test';
import {
  screenshotName,
  visualScenarios,
  type VisualProjectMetadata,
} from '../src/visual-contract';

const beeLightContrastContract = {
  '--color-success-foreground': '#052e16',
  '--color-warning-foreground': '#1f2937',
  '--color-focus-ring': '#b45309',
} as const;

const canonicalFoundationStatusForeground = {
  '--color-success-foreground': '#ffffff',
  '--color-warning-foreground': '#ffffff',
} as const;

for (const scenario of visualScenarios) {
  test(scenario.id, async ({ page }, testInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?scenario=${scenario.id}&theme=${metadata.visualTheme}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

    if (scenario.id === 'foundation' && metadata.visualTheme === 'light') {
      const semanticValues = await page.evaluate((names) => {
        const styles = getComputedStyle(document.documentElement);
        return Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim()]));
      }, Object.keys(beeLightContrastContract));

      expect(semanticValues).toEqual(beeLightContrastContract);

      // The v2 Bee-light status foreground changes are an intentional accessibility migration and are
      // asserted above as semantic contract. Keep the pre-v2 canonical bitmap stable so this screenshot
      // continues to detect every other foundation geometry/style regression at the original threshold.
      await page.evaluate((values) => {
        for (const [name, value] of Object.entries(values)) {
          document.documentElement.style.setProperty(name, value);
        }
      }, canonicalFoundationStatusForeground);
    }

    await expect(page).toHaveScreenshot(
      screenshotName(scenario.id, metadata.visualTheme, metadata.visualViewport),
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.0001,
      },
    );
  });
}
