import { expect, test } from '@playwright/test';

// #143 — the Dynamic Type acceptance fixture must remain reachable from the
// Showcase home at the top audited text scale. This is a screen-level
// accessibility contract, not an AppHeader component workaround: even a
// correctly wrapping header can become tall when its title, description and
// trailing control all scale, so home chrome must not permanently reserve
// viewport height that makes the catalog unreachable.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

test('Showcase home keeps the Dynamic Type acceptance launcher reachable at 2x text scale', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });

  const launcher = page.getByTestId('showcase-open-dynamic-type');
  await launcher.scrollIntoViewIfNeeded();
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(page.getByTestId('dynamic-type-ready')).toBeVisible();
});
