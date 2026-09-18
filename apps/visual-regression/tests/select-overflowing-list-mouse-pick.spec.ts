import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// The overflowing "Long list" fixture (120 options, a 220pt maxHeight
// SelectContent) is the exact shape a scrolling SelectContent swallows mouse
// presses on: the dropdown opens, the hit test finds the option, but the
// value never changes because the scroll container's own responder
// negotiation intercepts the press before the option's own press handler
// runs. A real Chromium mouse click (not a synthetic RTL fireEvent, which
// bypasses responder negotiation entirely) is required to prove this either
// way — this is why this proof lives in Playwright, not the Jest suite.
test('a mouse click on the last option of a 120-item overflowing Select picks it', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-long-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const content = page.getByTestId('select-showcase-long-content');
  await expect(content).toBeVisible();

  const lastOption = page.getByTestId('select-showcase-long-last');
  await lastOption.scrollIntoViewIfNeeded();
  await lastOption.click();

  await expect(content).toBeHidden();
  await expect(page.getByTestId('select-showcase-long-value')).toHaveText('Workspace 120');
});
