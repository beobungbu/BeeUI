import { expect, test } from '@playwright/test';

// Real-browser regression for #35: a consumer React context declared below
// BeeUIProvider must resolve to the provided value inside overlay content on web,
// where the transport uses ReactDOM.createPortal. "context: preserved" proves the
// provider value survived; "context: overlay-context-default" would be a failure.
const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: import('@playwright/test').Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('preserves consumer context inside a web Popover', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-popover-trigger').click();
  await expect(page.getByTestId('overlay-context-popover-value')).toHaveText('context: preserved');
});

test('preserves consumer context inside a web DropdownMenu', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-menu-trigger').click();
  await expect(page.getByTestId('overlay-context-menu-value')).toHaveText('context: preserved');
});

test('preserves consumer context inside a Popover nested in a Dialog', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-popover-trigger').click();
  await expect(page.getByTestId('overlay-context-dialog-popover-value')).toHaveText(
    'context: preserved',
  );
});

test('preserves context and selects in a DropdownMenu nested in a Dialog', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-menu-trigger').click();
  // Opens inside the modal and preserves consumer context.
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveText(
    'context: preserved',
  );
  // Selects and closes the menu (the item disappears), recording the action.
  await page.getByTestId('overlay-context-dialog-menu-item').click();
  await expect(page.getByTestId('overlay-context-dialog-menu-item')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-menu-action')).toHaveText(
    'menu action: selected',
  );
});
