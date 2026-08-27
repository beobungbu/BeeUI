import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  screenshotName,
  visualScenarios,
  type VisualProjectMetadata,
} from '../src/visual-contract';

const beeLightFoundationStatusContract = {
  Success: 'rgb(5, 46, 22)',
  Warning: 'rgb(31, 41, 55)',
} as const;

const beeLightFoundationExpectedDiffPixels = 414;

async function assertBeeLightFoundationMigration(
  page: Page,
  testInfo: TestInfo,
  snapshot: string,
) {
  const statusRects: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (const [label, color] of Object.entries(beeLightFoundationStatusContract)) {
    const status = page.getByText(label, { exact: true });
    await expect(status).toHaveCount(1);
    await expect(status).toHaveCSS('color', color);

    statusRects.push(
      await status.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        };
      }),
    );
  }

  const actual = await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });
  const expected = readFileSync(testInfo.snapshotPath(snapshot));

  const comparison = await page.evaluate(
    async ({ actualBase64, expectedBase64, rects }) => {
      async function decode(base64: string) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      }

      const [actualImage, expectedImage] = await Promise.all([
        decode(actualBase64),
        decode(expectedBase64),
      ]);

      if (
        actualImage.width !== expectedImage.width ||
        actualImage.height !== expectedImage.height
      ) {
        return {
          dimensionsMatch: false,
          diffPixels: -1,
          outsideDiffPixels: -1,
        };
      }

      const canvas = document.createElement('canvas');
      canvas.width = actualImage.width;
      canvas.height = actualImage.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('2D canvas unavailable for visual comparison');

      context.drawImage(actualImage, 0, 0);
      const actualPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(expectedImage, 0, 0);
      const expectedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

      let diffPixels = 0;
      let outsideDiffPixels = 0;

      for (let offset = 0, pixel = 0; offset < actualPixels.length; offset += 4, pixel += 1) {
        const differs =
          actualPixels[offset] !== expectedPixels[offset] ||
          actualPixels[offset + 1] !== expectedPixels[offset + 1] ||
          actualPixels[offset + 2] !== expectedPixels[offset + 2] ||
          actualPixels[offset + 3] !== expectedPixels[offset + 3];

        if (!differs) continue;
        diffPixels += 1;

        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        const insideStatusLabel = rects.some(
          (rect) =>
            x >= Math.floor(rect.x) - 1 &&
            x < Math.ceil(rect.x + rect.width) + 1 &&
            y >= Math.floor(rect.y) - 1 &&
            y < Math.ceil(rect.y + rect.height) + 1,
        );

        if (!insideStatusLabel) outsideDiffPixels += 1;
      }

      return { dimensionsMatch: true, diffPixels, outsideDiffPixels };
    },
    {
      actualBase64: actual.toString('base64'),
      expectedBase64: expected.toString('base64'),
      rects: statusRects,
    },
  );

  expect(comparison.dimensionsMatch).toBe(true);
  expect(comparison.outsideDiffPixels).toBe(0);
  expect(comparison.diffPixels).toBe(beeLightFoundationExpectedDiffPixels);
}

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

    if (scenario.id === 'foundation' && metadata.visualTheme === 'light') {
      await assertBeeLightFoundationMigration(page, testInfo, snapshot);
      return;
    }

    await expect(page).toHaveScreenshot(snapshot, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
}
