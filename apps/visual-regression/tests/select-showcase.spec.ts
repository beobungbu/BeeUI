import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('Select updates a persistent controlled value and restores trigger focus', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('select-showcase-controlled-value')).toHaveText('Pro');

  await trigger.click();
  await page.getByTestId('select-showcase-controlled-starter').click();

  await expect(page.getByTestId('select-showcase-controlled-value')).toHaveText('Starter');
  await expect(page.getByTestId('select-showcase-controlled-state')).toHaveText('value: starter');
  await expect(trigger).toBeFocused();
});

test('Select opens, navigates, and selects from the keyboard', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-placeholder-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await expect(page.getByTestId('select-showcase-placeholder-value')).toHaveText('Choose a role');

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('select-showcase-placeholder-content')).toBeVisible();
  await expect(page.getByTestId('select-showcase-placeholder-designer')).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('select-showcase-placeholder-engineer')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('select-showcase-placeholder-value')).toHaveText('Engineer');
  await expect(trigger).toBeFocused();
});

test('Escape dismisses Select without changing its selected value', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('select-showcase-controlled-content')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('select-showcase-controlled-content')).toBeHidden();
  await expect(page.getByTestId('select-showcase-controlled-value')).toHaveText('Pro');
  await expect(trigger).toBeFocused();
});

test('Select preserves a consumer Context.Provider through root portal content', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-context-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  await expect(page.getByTestId('select-showcase-context-probe')).toHaveText('context: preserved');
});

test('Dialog-nested Select uses the modal-local host and preserves consumer context', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const dialogTrigger = page.getByTestId('select-showcase-dialog-trigger');
  await dialogTrigger.scrollIntoViewIfNeeded();
  await dialogTrigger.click();
  await page.getByTestId('select-showcase-dialog-select-trigger').click();

  await expect(page.getByTestId('select-showcase-dialog-context-probe')).toHaveText(
    'context: preserved',
  );
  await page.getByTestId('select-showcase-dialog-alex').click();

  await expect(page.getByTestId('select-showcase-dialog-select-value')).toHaveText('Alex Morgan');
  await expect(page.getByText('Assign owner')).toBeVisible();
  await expect(page.getByTestId('select-showcase-dialog-select-trigger')).toBeFocused();
});

test('long Select list keeps the selected end of the list usable', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-long-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('select-showcase-long-value')).toHaveText('Workspace 118');
  await trigger.click();

  const last = page.getByTestId('select-showcase-long-last');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
  await last.click();

  await expect(page.getByTestId('select-showcase-long-value')).toHaveText('Workspace 120');
  await expect(trigger).toBeFocused();
});

test('Select remains usable at a narrow mobile viewport', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-narrow-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByText('Short option')).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(triggerBox!.x).toBeGreaterThanOrEqual(0);
  expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(320);
});
