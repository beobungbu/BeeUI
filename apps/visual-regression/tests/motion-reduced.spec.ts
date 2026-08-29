import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

async function rootMotionVariables(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const durationMs = (property: string) => {
      const value = style.getPropertyValue(property).trim();
      if (value.endsWith('ms')) return Number.parseFloat(value);
      if (value.endsWith('s')) return Number.parseFloat(value) * 1000;
      return Number.NaN;
    };

    return {
      enterDurationMs: durationMs('--motion-overlay-enter-duration'),
      enterSpatial: style.getPropertyValue('--motion-overlay-enter-spatial').trim(),
      exitDurationMs: durationMs('--motion-overlay-exit-duration'),
      exitSpatial: style.getPropertyValue('--motion-overlay-exit-spatial').trim(),
      disclosureDurationMs: durationMs('--motion-disclosure-duration'),
      disclosureSpatial: style.getPropertyValue('--motion-disclosure-spatial').trim(),
    };
  });
}

test('semantic motion CSS responds to prefers-reduced-motion without changing final-state rendering', async ({ page }, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/?scenario=foundation&theme=${metadata.visualTheme}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  expect(await rootMotionVariables(page)).toEqual({
    enterDurationMs: 200,
    enterSpatial: '1',
    exitDurationMs: 120,
    exitSpatial: '1',
    disclosureDurationMs: 200,
    disclosureSpatial: '1',
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await rootMotionVariables(page)).exitDurationMs).toBeCloseTo(0.01, 6);

  expect(await rootMotionVariables(page)).toEqual({
    // opacity-or-state keeps the fade timing but removes scale/translation.
    enterDurationMs: 200,
    enterSpatial: '0',
    // immediate intents collapse timing and spatial motion.
    exitDurationMs: 0.01,
    exitSpatial: '0',
    disclosureDurationMs: 0.01,
    disclosureSpatial: '0',
  });

  // Reduced motion changes transition policy, not the rendered destination.
  await expect(page.getByText('Foundation')).toBeVisible();
});
