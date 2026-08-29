import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';
const stressScales = [1, 1.3, 1.5, 2] as const;

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await expect(page.getByRole('heading', { name: 'Component Gallery' })).toBeVisible();
}

test('keeps AppHeader title and content usable at 390px across the large-text stress matrix', async ({ page }) => {
  await openComponentGallery(page);

  const title = page.getByRole('heading', { name: 'Component Gallery' });
  const deepControl = page.getByTestId('select-showcase-controlled-trigger');

  for (const scale of stressScales) {
    await page.evaluate((nextScale) => {
      document.documentElement.style.fontSize = `${16 * nextScale}px`;
    }, scale);

    const metrics = await title.evaluate((element) => {
      const titleRect = element.getBoundingClientRect();
      const titleColumn = element.parentElement;
      const header = titleColumn?.parentElement;
      const headerSafeArea = header?.parentElement;
      const contentSafeArea = headerSafeArea?.nextElementSibling;

      if (!titleColumn || !header || !contentSafeArea) {
        throw new Error('Component Gallery AppHeader structure changed; update the large-text regression seam.');
      }

      const titleColumnRect = titleColumn.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const contentRect = contentSafeArea.getBoundingClientRect();

      return {
        contentHeight: contentRect.height,
        headerHeight: headerRect.height,
        titleColumnWidth: titleColumnRect.width,
        titleWidth: titleRect.width,
      };
    });

    expect(metrics.titleColumnWidth, `title column width at ${scale}x`).toBeGreaterThan(96);
    expect(metrics.titleWidth, `title width at ${scale}x`).toBeGreaterThan(96);
    expect(metrics.contentHeight, `scroll region height at ${scale}x`).toBeGreaterThan(96);
    expect(metrics.headerHeight, `header height at ${scale}x`).toBeLessThan(844 - 96);

    await deepControl.scrollIntoViewIfNeeded();
    await expect(deepControl, `deep Component Gallery control remains reachable at ${scale}x`).toBeVisible();
  }
});
