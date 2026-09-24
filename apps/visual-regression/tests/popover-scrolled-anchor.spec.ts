import { expect, test, type Page } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// A Popover opened from a trigger the user scrolled to must open beside that
// trigger, whatever its content height. The app root is one viewport tall and
// the fixture overflows it, so scrolling moves the root overlay host partly
// above the window. Collision bounds derived from that host shrink to the part
// of it still on screen, which is shorter than the popover and does not contain
// the trigger, and every popover then lands at the same spot however tall it is
// — adjacent to the trigger for at most one content height. Several heights,
// on both sides of the trigger, keep that coincidence from passing.

const SIDE_OFFSET = 8; // PopoverContent's default `sideOffset`.
const TRIGGER_VIEWPORT_TOP = 520;

async function openScrolledPopover(page: Page, contentHeight: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?fixture=popover-scrolled-anchor&contentHeight=${contentHeight}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  const trigger = page.getByTestId('popover-scrolled-anchor-trigger');
  // Scroll so the trigger sits at a fixed viewport offset: room for up to ~500px
  // above it and ~220px below, so short content opens below and tall content
  // flips above.
  await trigger.evaluate((element, top) => {
    const documentTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, documentTop - top);
  }, TRIGGER_VIEWPORT_TOP);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await trigger.click();
  const content = page.getByTestId('popover-scrolled-anchor-content');
  await expect(content).toBeVisible();
  return { content, trigger };
}

for (const { contentHeight, side } of [
  { contentHeight: 96, side: 'below' },
  { contentHeight: 180, side: 'below' },
  { contentHeight: 360, side: 'above' },
  { contentHeight: 468, side: 'above' },
  { contentHeight: 488, side: 'above' },
] as const) {
  test(`a ${contentHeight}px Popover opens ${side} its scrolled-to trigger`, async ({ page }, testInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'Placement geometry does not depend on theme; one desktop viewport is enough.',
    );

    const { content, trigger } = await openScrolledPopover(page, contentHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const triggerBox = (await trigger.boundingBox())!;
    const contentBox = (await content.boundingBox())!;

    // The page did not move while opening: the trigger is where it was scrolled to.
    expect(triggerBox.y).toBeCloseTo(TRIGGER_VIEWPORT_TOP, 0);
    for (const box of [triggerBox, contentBox]) {
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight);
    }

    const gap =
      side === 'below'
        ? contentBox.y - (triggerBox.y + triggerBox.height)
        : triggerBox.y - (contentBox.y + contentBox.height);
    expect(gap).toBeGreaterThanOrEqual(SIDE_OFFSET - 1);
    expect(gap).toBeLessThanOrEqual(SIDE_OFFSET + 1);
  });
}
