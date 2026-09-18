import { expect, test } from '@playwright/test';

// BeeUI issue #548 — a real external Web consumer's app root (matching the
// maintained `global.css` contract: `html, body, #root { min-height: 100% }`,
// which does not by itself establish a definite viewport-height containing
// block) computed to its short content height instead of the browser
// viewport, so a bottom-anchored Sheet's backdrop covered only that short
// content area and left the rest of the viewport uncovered. This fixture's
// app root is deliberately one line of text and a trigger button — far
// shorter than the viewport — the exact precondition the issue reports.
test('the Sheet backdrop covers the full viewport when the app root is shorter than the viewport', async ({
  page,
}) => {
  await page.goto('/?fixture=sheet-short-root', { waitUntil: 'domcontentloaded' });

  const rootBox = await page.getByTestId('sheet-short-root-fixture').boundingBox();
  const viewportSize = page.viewportSize();
  expect(rootBox).not.toBeNull();
  expect(viewportSize).not.toBeNull();
  // Confirms the precondition: the app root really is shorter than the
  // viewport before the Sheet ever opens.
  expect(rootBox!.height).toBeLessThan(viewportSize!.height);

  await page.getByTestId('sheet-short-root-trigger').click();
  const overlay = page.getByTestId('sheet-short-root-overlay');
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();
  expect(overlayBox!.x).toBe(0);
  expect(overlayBox!.y).toBe(0);
  expect(overlayBox!.width).toBe(viewportSize!.width);
  expect(overlayBox!.height).toBe(viewportSize!.height);
});
