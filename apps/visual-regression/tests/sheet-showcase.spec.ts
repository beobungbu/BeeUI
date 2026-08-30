import { expect, test, type Page } from '@playwright/test';

// BeeUI 1.0 #159 (R4B.4) — real-browser evidence for the Sheet Web policy
// (ADR-006 `docs/decisions/006-sheet-gesture-engine.md`): open/close, Escape,
// backdrop press, Tab focus-trap/restoration, responsive layout, and RTL.
// The demo fixture lives in `apps/showcase/component-gallery/component-gallery.tsx`
// ("Sheet" section) with a Search `Input` + `SheetClose` button so the panel
// has exactly two focusable descendants to exercise the trap against.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('opens via trigger, closes via SheetClose, and restores trigger focus', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('sheet-demo-trigger');
  await trigger.click();

  const content = page.getByTestId('sheet-demo-content');
  await expect(content).toBeVisible();
  await expect(content).toHaveAttribute('role', 'dialog');
  await expect(content).toHaveAttribute('aria-modal', 'true');

  await page.getByTestId('sheet-demo-close').click();
  await expect(content).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Escape closes the Sheet and restores trigger focus', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('sheet-demo-trigger');
  await trigger.click();
  await expect(page.getByTestId('sheet-demo-content')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('sheet-demo-content')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('backdrop press closes the Sheet', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('sheet-demo-trigger');
  await trigger.click();
  await expect(page.getByTestId('sheet-demo-content')).toBeVisible();

  // The backdrop spans the full viewport; (10, 10) is guaranteed clear of the
  // bottom-anchored panel regardless of viewport size.
  await page.getByTestId('sheet-demo-overlay').click({ position: { x: 10, y: 10 } });

  await expect(page.getByTestId('sheet-demo-content')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('traps Tab focus within the panel and wraps at both ends', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('sheet-demo-trigger').click();
  await expect(page.getByTestId('sheet-demo-content')).toBeVisible();

  const input = page.getByTestId('sheet-demo-input');
  const close = page.getByTestId('sheet-demo-close');

  // Opening the Sheet moves focus to its first focusable descendant.
  await expect(input).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  // Forward Tab from the last focusable element wraps to the first.
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();

  // Backward Tab from the first focusable element wraps to the last.
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();

  await close.click();
  await expect(page.getByTestId('sheet-demo-content')).toBeHidden();
});

test('renders edge-to-edge at a compact viewport and capped/centered at an expanded viewport', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openComponentGallery(page);

  const panel = page.getByTestId('sheet-demo-content');
  await page.getByTestId('sheet-demo-trigger').click();
  await expect(panel).toBeVisible();

  const compactBox = await panel.boundingBox();
  expect(compactBox).not.toBeNull();
  expect(compactBox!.x).toBeLessThan(2);
  expect(compactBox!.width).toBeGreaterThan(380);

  await page.getByTestId('sheet-demo-close').click();
  await expect(panel).toBeHidden();

  // `medium`/`expanded` breakpoint (768px+, `docs/responsive-layout.md`):
  // the panel caps at the existing `max-w-dialog` (512px) content width and
  // centers instead of spanning edge-to-edge.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId('sheet-demo-trigger').click();
  await expect(panel).toBeVisible();

  const expandedBox = await panel.boundingBox();
  expect(expandedBox).not.toBeNull();
  expect(expandedBox!.width).toBeLessThan(560);
  expect(expandedBox!.x).toBeGreaterThan(300);
});

test('remains operable when the document direction is RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  const trigger = page.getByTestId('sheet-demo-trigger');
  await trigger.click();
  await expect(page.getByTestId('sheet-demo-content')).toBeVisible();
  await expect(page.getByTestId('sheet-demo-input')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sheet-demo-content')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('closes under prefers-reduced-motion: reduce without breaking dismissal', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openComponentGallery(page);

  const trigger = page.getByTestId('sheet-demo-trigger');
  await trigger.click();
  await expect(page.getByTestId('sheet-demo-content')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sheet-demo-content')).toBeHidden();
  await expect(trigger).toBeFocused();
});
