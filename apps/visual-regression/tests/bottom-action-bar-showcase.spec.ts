import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';
const VIEWPORT = { width: 1024, height: 800 };

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// Scrolls the actual scrollable ancestor of `testId` to its true maximum
// scrollTop (not merely "enough to be minimally visible", which is all
// `scrollIntoViewIfNeeded` guarantees). This is the real worst case the
// issue describes: a user who has scrolled all the way down.
async function scrollAncestorToMax(page: Page, testId: string) {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    let node: HTMLElement | null = el as HTMLElement | null;
    while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement;
    if (node) node.scrollTop = node.scrollHeight;
  }, testId);
}

test.describe('BottomActionBar never occludes or intercepts scroll content near the viewport bottom (#281)', () => {
  test('1x baseline: the last scrollable item is reachable and clickable at the true bottom of the page', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize(VIEWPORT);
    await openComponentGallery(page);

    const target = page.getByTestId('component-gallery-footer-link');
    await scrollAncestorToMax(page, 'component-gallery-footer-link');
    await expect(target).toBeVisible();
    await target.click({ timeout: 8_000 });
  });

  // Root cause: the fixed BottomActionBar sits in a normal flex column next
  // to the scrollable content (it is not a CSS `position: fixed` overlay
  // painted on top of it — verified directly in this repo's DOM). The
  // ScrollView's own `contentContainerStyle.paddingBottom` therefore has to
  // reserve at least the bar's real rendered height (bar + its bottom
  // safe-area inset) so the last item's trailing whitespace, once scrolled
  // fully into view, never sits flush against — or behind — the bar. Before
  // this fix that reservation was a hardcoded `120` that had no relationship
  // to the bar's actual size and would silently drift out of date the
  // moment the bar's real content (button count/labels, safe-area, a future
  // larger touch-target pass, …) made it taller than 120px.
  //
  // This test proves the CONTRACT directly rather than relying on organic
  // page-wide text scaling to happen to overflow the hardcoded 120px: the
  // Component Gallery's current content has enough of its own incidental
  // trailing whitespace (the section's own bottom padding) that a plain
  // root-font-size bump alone doesn't reliably overflow a fixed 120px
  // reservation, which would make an end-to-end scale+click test flaky
  // evidence for this specific regression. Forcing the bar's rendered
  // height directly (a deterministic stand-in for "the bar became taller
  // than 120px for any reason") is what makes this reproduce every time,
  // and is exactly the scenario the issue's own DoD names: "reserve bottom
  // space (bar height + safe-area) behind the fixed bar".
  test('the reserved scroll-bottom space always covers the fixed bar\'s actual rendered height, not a stale guess', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize(VIEWPORT);
    await openComponentGallery(page);

    const bar = page.getByTestId('component-gallery-bottom-action-bar');

    // Force the bar dramatically taller than the pre-fix hardcoded 120px
    // reservation could ever cover — a stand-in for large text, more
    // content, a deeper safe-area, or any future change to the bar itself.
    await page.addStyleTag({
      content: '[data-testid="component-gallery-bottom-action-bar"] { padding-top: 400px !important; }',
    });
    // Let the onLayout-driven remeasurement (this fix's mechanism) settle.
    await page.waitForTimeout(300);

    const barHeight = (await bar.boundingBox())?.height;
    expect(barHeight).not.toBeNull();
    // Sanity: the forced style actually grew the bar well past the old
    // hardcoded reservation, so this is a meaningful assertion below.
    expect(barHeight!).toBeGreaterThan(300);

    const scrollPaddingBottomPx = await page.evaluate(() => {
      const link = document.querySelector('[data-testid="component-gallery-footer-link"]');
      let node: HTMLElement | null = link as HTMLElement | null;
      while (node && !node.style.paddingBottom) node = node.parentElement;
      return node ? Number.parseFloat(node.style.paddingBottom) : null;
    });
    expect(scrollPaddingBottomPx).not.toBeNull();

    // The load-bearing assertion: reserved trailing scroll space must cover
    // the bar's real height. A reverted fix always reports `120` here,
    // which is trivially less than the ~400px+ forced bar height above —
    // this line is what fails when the fix is reverted.
    expect(scrollPaddingBottomPx!).toBeGreaterThanOrEqual(barHeight!);

    // Behavioral confirmation on top of the geometric proof: the last item,
    // scrolled fully to the bottom of a now much-shorter visible content
    // area, must still be visible above the bar and clickable — not merely
    // "some padding number is big enough" but "a real click succeeds".
    const target = page.getByTestId('component-gallery-footer-link');
    await scrollAncestorToMax(page, 'component-gallery-footer-link');
    const targetBox = await target.boundingBox();
    const barBox = await bar.boundingBox();
    expect(targetBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
    await target.click({ timeout: 8_000 });
  });
});
