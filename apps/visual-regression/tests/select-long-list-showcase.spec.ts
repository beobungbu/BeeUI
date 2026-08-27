import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('long Select opens with its selected option already visible', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-long-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const content = page.getByTestId('select-showcase-long-content');
  const selected = page.getByRole('option', { name: 'Workspace 118' });
  await expect(content).toBeVisible();
  await expect(selected).toBeVisible();

  const contentBox = await content.boundingBox();
  const selectedBox = await selected.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(selectedBox).not.toBeNull();
  expect(selectedBox!.y).toBeGreaterThanOrEqual(contentBox!.y);
  expect(selectedBox!.y + selectedBox!.height).toBeLessThanOrEqual(
    contentBox!.y + contentBox!.height,
  );
});
