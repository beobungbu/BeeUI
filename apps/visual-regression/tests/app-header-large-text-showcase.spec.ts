import { expect, test, type Page } from '@playwright/test';

// #284 — AppHeader large-text collapse regression.
//
// At ~1.3x root font-size and above on a narrow viewport, AppHeader's
// leading/trailing controls no longer fit beside the title on one row. On
// the unfixed component (`flex-row items-center`, title `min-w-0 flex-1`,
// trailing `shrink-0`) the title column is crushed toward zero width and the
// grown header squeezes the scrollable content region toward zero height,
// making content unreachable. The fix lets the header row wrap
// (`flex-wrap`, title `min-w-32 flex-1`, trailing `ml-auto shrink-0`) so it
// degrades by adding rows instead of destroying the title column.
//
// Measurement seams are explicit testIDs (`component-gallery-header`,
// `component-gallery-theme-toggle`) rather than DOM parent/sibling
// traversal, so unrelated Showcase structure changes cannot silently
// invalidate the regression.
//
// Matrix: two narrow widths (390px — the issue's reproduction, 360px — the
// narrowest common Android width) x the #143 stress scales 1/1.3/1.5/2.

const showcaseBaseUrl = 'http://127.0.0.1:4174';
const stressScales = [1, 1.3, 1.5, 2] as const;
const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await expect(page.getByRole('heading', { name: 'Component Gallery' })).toBeVisible();
}

type Box = { x: number; y: number; width: number; height: number };

function overlapsHorizontallyOnSameRow(a: Box, b: Box): boolean {
  const verticalOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (verticalOverlap <= 1) return false; // different wrap rows — no conflict
  const horizontalOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return horizontalOverlap > 1;
}

for (const viewport of viewports) {
  test(`keeps AppHeader title and content usable at ${viewport.width}px across the large-text stress matrix`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await openComponentGallery(page);

    const header = page.getByTestId('component-gallery-header');
    const title = page.getByRole('heading', { name: 'Component Gallery' });
    const themeToggle = page.getByTestId('component-gallery-theme-toggle');
    const deepControl = page.getByTestId('select-showcase-controlled-trigger');

    for (const scale of stressScales) {
      await page.evaluate((nextScale) => {
        document.documentElement.style.fontSize = `${16 * nextScale}px`;
        window.scrollTo(0, 0);
      }, scale);

      const [headerBox, titleBox, toggleBox] = await Promise.all([
        header.boundingBox(),
        title.boundingBox(),
        themeToggle.boundingBox(),
      ]);
      if (!headerBox || !titleBox || !toggleBox) {
        throw new Error(`AppHeader fixture boxes missing at ${scale}x/${viewport.width}px`);
      }

      // 1. The title column never collapses: the rendered heading keeps a
      // readable width instead of being crushed by leading/trailing.
      expect(titleBox.width, `title width at ${scale}x/${viewport.width}px`).toBeGreaterThan(96);

      // 2. The header never consumes the viewport: a usable content region
      // (>= 96px) remains below it, so the page stays scrollable/usable.
      expect(
        headerBox.y + headerBox.height,
        `content region below header at ${scale}x/${viewport.width}px`,
      ).toBeLessThan(viewport.height - 96);

      // 3. Wrapping never overlays the title and the trailing control: they
      // either share a row without horizontal intersection or occupy
      // different wrap rows.
      expect(
        overlapsHorizontallyOnSameRow(titleBox, toggleBox),
        `title/trailing overlap at ${scale}x/${viewport.width}px`,
      ).toBe(false);

      // 4. The trailing control stays inside the viewport and interactive
      // (not pushed off the right edge by the grown title/leading).
      expect(toggleBox.x, `trailing left edge at ${scale}x/${viewport.width}px`).toBeGreaterThanOrEqual(0);
      expect(
        toggleBox.x + toggleBox.width,
        `trailing right edge at ${scale}x/${viewport.width}px`,
      ).toBeLessThanOrEqual(viewport.width + 1);
      await expect(themeToggle, `trailing visible at ${scale}x/${viewport.width}px`).toBeVisible();

      // 5. Deep gallery content stays reachable — the user-level symptom
      // #284 was filed about (targets near the bottom becoming unusable).
      await deepControl.scrollIntoViewIfNeeded();
      await expect(
        deepControl,
        `deep Component Gallery control remains reachable at ${scale}x/${viewport.width}px`,
      ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
  });
}
