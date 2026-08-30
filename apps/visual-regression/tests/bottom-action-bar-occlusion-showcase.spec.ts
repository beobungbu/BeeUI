import { expect, test, type Page } from '@playwright/test';

// #281 — the Component Gallery's fixed-looking BottomActionBar ("Cancel" /
// "Save changes") sits below the scrollable content region as a pinned
// (non-scrolling) sibling of the header. Both the header and the action
// bar grow with root font-size / page zoom (Dynamic Type, #143), and both
// squeeze the scrollable middle region's height every time either grows.
// Once their combined height leaves less room than a single content row
// needs, `scrollIntoView` can only partially reveal that row: its
// unclipped geometric center then lands on the BottomActionBar's real
// on-screen rect, so Playwright's (and any coordinate-based) hit-testing
// reports the bar "intercepting pointer events" for content that has
// actually just been squeezed out of its own viewport — not a real
// stacking/z-index overlap, but the practical symptom is identical: a
// control the user scrolled to is not clickable.
//
// The fix gives the scroll region a rem-scaled `min-h-24` floor
// (component-gallery.tsx) so it can never collapse below a size that
// comfortably fits a scaled row, at any of the zoom levels below. On a
// small/short viewport this can push total content taller than the
// viewport — the page then falls back to ordinary document-level
// scrolling instead of corrupting hit-testing for in-view content.
//
// This is deliberately reproduced on a short, narrow viewport (320x568 —
// a real small-phone size) where the squeeze is most severe, plus the
// showcase's standard 390-wide viewport at a higher stress scale, so the
// matrix fails on the pre-fix layout and passes once the floor is applied.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await expect(page.getByRole('heading', { name: 'Component Gallery' })).toBeVisible();
}

const scenarios = [
  { viewport: { width: 320, height: 568 }, scales: [1.5, 1.8, 2, 2.5] },
  { viewport: { width: 390, height: 844 }, scales: [2, 2.5, 3] },
] as const;

for (const { viewport, scales } of scenarios) {
  test(`keeps a scrolled-to control clickable (not blocked by BottomActionBar) at ${viewport.width}x${viewport.height} across the large-text stress matrix`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await openComponentGallery(page);

    const target = page.locator('[data-testid="select-showcase-controlled-trigger"]');

    for (const scale of scales) {
      await page.evaluate((nextScale) => {
        document.documentElement.style.fontSize = `${16 * nextScale}px`;
      }, scale);

      await target.scrollIntoViewIfNeeded();

      // A real click, not just a visibility check: this is what the
      // Playwright actionability engine does when it finds a covering
      // element — it times out with "<bar> ... intercepts pointer
      // events" instead of clicking through to the trigger.
      await target.click({ timeout: 10_000 });

      await expect(
        target,
        `select-showcase-controlled-trigger did not open after click at ${scale}x/${viewport.width}px`,
      ).toHaveAttribute('aria-expanded', 'true');

      // Close it back out so the next scale iteration starts from a
      // known, closed state.
      await page.keyboard.press('Escape');
      await expect(target).toHaveAttribute('aria-expanded', 'false');
    }

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
  });
}
