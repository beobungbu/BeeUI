import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  screenshotName,
  visualScenarios,
  type VisualProjectMetadata,
  type VisualTheme,
} from '../src/visual-contract';

const beeLightFoundationStatusContract = {
  Success: 'rgb(5, 46, 22)',
  Warning: 'rgb(31, 41, 55)',
} as const;

const beeLightFoundationExpectedDiffPixels = 723;

const controlBoundaryContract = {
  light: {
    border: 'rgb(133, 144, 162)',
    input: 'rgb(255, 255, 255)',
  },
  dark: {
    border: 'rgb(102, 112, 133)',
    input: 'rgb(18, 24, 32)',
  },
} as const satisfies Record<VisualTheme, { border: string; input: string }>;

type NodeFsModule = {
  readFileSync(path: string): Uint8Array;
};

type NodeProcessWithBuiltinModules = {
  getBuiltinModule(name: 'fs'): NodeFsModule;
};

type PixelRect = { x: number; y: number; width: number; height: number };

function readSnapshotBytes(path: string) {
  const nodeProcess = (
    globalThis as typeof globalThis & { process: NodeProcessWithBuiltinModules }
  ).process;
  return nodeProcess.getBuiltinModule('fs').readFileSync(path);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function assertBeeLightFoundationMigration(
  page: Page,
  testInfo: TestInfo,
  snapshot: string,
) {
  const statusRects: PixelRect[] = [];

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
  const expected = readSnapshotBytes(testInfo.snapshotPath(snapshot));

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
      actualBase64: bytesToBase64(actual),
      expectedBase64: bytesToBase64(expected),
      rects: statusRects,
    },
  );

  expect(comparison.dimensionsMatch).toBe(true);
  expect(comparison.outsideDiffPixels).toBe(0);
  expect(comparison.diffPixels).toBe(beeLightFoundationExpectedDiffPixels);
}

async function assertControlBoundaryMigration(
  page: Page,
  testInfo: TestInfo,
  snapshot: string,
  theme: VisualTheme,
  controls: readonly Locator[],
) {
  const contract = controlBoundaryContract[theme];
  const controlRects: PixelRect[] = [];

  for (const control of controls) {
    await expect(control).toHaveCount(1);
    await expect(control).toBeVisible();
    await expect(control).toHaveCSS('border-top-color', contract.border);
    await expect(control).toHaveCSS('border-top-width', '1px');
    await expect(control).toHaveCSS('background-color', contract.input);
    controlRects.push(
      await control.evaluate((node) => {
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
  const expected = readSnapshotBytes(testInfo.snapshotPath(snapshot));

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
          outsideBoundaryDiffPixels: -1,
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
      let outsideBoundaryDiffPixels = 0;

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
        const insideBoundaryBand = rects.some((rect) => {
          const left = Math.floor(rect.x);
          const top = Math.floor(rect.y);
          const right = Math.ceil(rect.x + rect.width);
          const bottom = Math.ceil(rect.y + rect.height);

          // rounded-md is a 6px radius. A changed 1px border affects the straight
          // 3px perimeter plus anti-aliased pixels inside the rounded corner arc.
          // Keep that allowance local to an 8px corner zone; changes in control
          // text, fill, layout, or the rest of the surrounding surface still fail.
          const insideOuterBox =
            x >= left - 2 && x < right + 2 && y >= top - 2 && y < bottom + 2;
          if (!insideOuterBox) return false;

          const insideStraightPerimeter =
            x < left + 3 ||
            x >= right - 3 ||
            y < top + 3 ||
            y >= bottom - 3;

          const cornerExtent = 8;
          const insideRoundedCornerZone =
            (x < left + cornerExtent && y < top + cornerExtent) ||
            (x >= right - cornerExtent && y < top + cornerExtent) ||
            (x < left + cornerExtent && y >= bottom - cornerExtent) ||
            (x >= right - cornerExtent && y >= bottom - cornerExtent);

          return insideStraightPerimeter || insideRoundedCornerZone;
        });

        if (!insideBoundaryBand) outsideBoundaryDiffPixels += 1;
      }

      return { dimensionsMatch: true, diffPixels, outsideBoundaryDiffPixels };
    },
    {
      actualBase64: bytesToBase64(actual),
      expectedBase64: bytesToBase64(expected),
      rects: controlRects,
    },
  );

  expect(comparison.dimensionsMatch).toBe(true);
  expect(comparison.diffPixels).toBeGreaterThan(0);
  expect(comparison.outsideBoundaryDiffPixels).toBe(0);
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

    if (scenario.id === 'forms') {
      await assertControlBoundaryMigration(page, testInfo, snapshot, metadata.visualTheme, [
        page.locator('input[aria-label="Email, required"]'),
        page.locator('textarea[aria-label="Notes"]'),
        page.locator('input[aria-label="Password"]'),
      ]);
      return;
    }

    if (scenario.id === 'dialog-open') {
      await assertControlBoundaryMigration(page, testInfo, snapshot, metadata.visualTheme, [
        page.locator('input[aria-label="Baseline note"]'),
      ]);
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
