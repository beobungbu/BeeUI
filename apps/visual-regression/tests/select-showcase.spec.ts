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

test('Escape dismisses a dialog-local Select before a root Select behind the Dialog', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const open = page.getByTestId('select-showcase-scope-open');
  await open.scrollIntoViewIfNeeded();
  await open.click();

  const rootTrigger = page.getByTestId('select-showcase-scope-root-trigger');
  const childTrigger = page.getByTestId('select-showcase-scope-child-trigger');
  await expect(rootTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(childTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('select-showcase-scope-child-content')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(childTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('select-showcase-scope-child-content')).toBeHidden();
  await expect(rootTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('select-showcase-scope-dialog-title')).toBeVisible();
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

test('Select remains collision-safe at a narrow mobile viewport', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-narrow-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByText('Short option')).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const contentBox = await page.getByTestId('select-showcase-narrow-content').boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(triggerBox!.x).toBeGreaterThanOrEqual(0);
  expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(320);
  expect(contentBox!.x).toBeGreaterThanOrEqual(0);
  expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(320);
  expect(contentBox!.y).toBeGreaterThanOrEqual(0);
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(640);
});

test('two Selects remain usable when opened sequentially', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const firstTrigger = page.getByTestId('select-showcase-controlled-trigger');
  const secondTrigger = page.getByTestId('select-showcase-placeholder-trigger');
  await firstTrigger.scrollIntoViewIfNeeded();
  await firstTrigger.click();
  await expect(page.getByTestId('select-showcase-controlled-content')).toBeVisible();

  const secondBox = await secondTrigger.boundingBox();
  expect(secondBox).not.toBeNull();
  await page.mouse.click(secondBox!.x + secondBox!.width / 2, secondBox!.y + secondBox!.height / 2);
  await expect(page.getByTestId('select-showcase-controlled-content')).toBeHidden();

  if (await page.getByTestId('select-showcase-placeholder-content').isHidden()) {
    await secondTrigger.click();
  }
  await expect(page.getByTestId('select-showcase-placeholder-content')).toBeVisible();
});

test('a programmatic theme switch while Select is open preserves value and overlay state', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('select-showcase-controlled-content')).toBeVisible();
  const before = await page.getByTestId('select-showcase-controlled-value').textContent();

  const themeButton = page.getByRole('button', { name: /^Theme .* Switch to / });
  await themeButton.evaluate((element) => (element as HTMLElement).click());

  await expect(page.getByTestId('select-showcase-controlled-content')).toBeVisible();
  await expect(page.getByTestId('select-showcase-controlled-value')).toHaveText(before ?? 'Pro');
});
