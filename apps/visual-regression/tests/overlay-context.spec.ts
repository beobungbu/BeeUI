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

test('Web Escape is scope-aware: closes the dialog-nested menu, Dialog stays open', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-menu-trigger').click();
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveText(
    'context: preserved',
  );

  // Escape is dispatched to the topmost active scope (the open modal), so it closes
  // the modal-local menu — the visible Dialog child — first. The Dialog stays open
  // and the modal boundary blocks Escape from reaching any root overlay behind it.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-menu-trigger')).toBeVisible();
});

// CASE C — a root-scope Popover and a Dialog-nested DropdownMenu open at once
// (different scopes). A flat global stack could make the root Popover topmost;
// with per-scope stacks, Escape routes to the active modal scope (the menu) and
// never dismisses the root Popover behind the modal.
test('Web Escape CASE C: a root Popover behind the dialog menu is not dismissed by Escape', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  // One control opens the root Popover (root scope) and the Dialog + its menu
  // (modal scope) with independent open states.
  await page.getByTestId('overlay-context-casec-open').click();
  await expect(page.getByTestId('overlay-context-casec-menu-value')).toHaveText(
    'context: preserved',
  );
  await expect(page.getByTestId('overlay-context-casec-root-value')).toHaveText(
    'context: preserved',
  );

  // One Escape: the modal-local menu (the visible dialog child) closes first; the
  // Dialog stays open and the root Popover behind it remains.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-context-casec-menu-value')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-casec-menu-trigger')).toBeVisible();
  await expect(page.getByTestId('overlay-context-casec-root-value')).toHaveText(
    'context: preserved',
  );
});
