import { expect, test } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

function targetUrl(query: string) {
  return `${showcaseBaseUrl}/?${query}`;
}

test('opens a canonical component target directly and preserves it across reload', async ({ page }) => {
  await page.goto(targetUrl('surface=component&id=button&example=basic'), { waitUntil: 'load' });

  await expect(page.getByTestId('addressable-component-gallery')).toBeVisible();
  await expect(page.getByTestId('showcase-active-example')).toContainText('button / basic');
  await expect(page.getByTestId('showcase-active-example-source')).toContainText('apps/showcase/');
  await expect(page).toHaveURL(/surface=component&id=button&example=basic/u);

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('showcase-active-example')).toContainText('button / basic');
});

test('opens an exact pattern state and keeps Back/Forward deterministic', async ({ page }) => {
  await page.goto(targetUrl('surface=pattern&id=sign-in&state=invalid'), { waitUntil: 'load' });

  await expect(page.getByTestId('pattern-preview-sign-in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Invalid state' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Show Loading state' }).click();
  await expect(page).toHaveURL(/surface=pattern&id=sign-in&state=loading/u);
  await expect(page.getByRole('button', { name: 'Show Loading state' })).toHaveAttribute('aria-selected', 'true');

  await page.goBack();
  await expect(page).toHaveURL(/surface=pattern&id=sign-in&state=invalid/u);
  await expect(page.getByRole('button', { name: 'Show Invalid state' })).toHaveAttribute('aria-selected', 'true');

  await page.goForward();
  await expect(page).toHaveURL(/surface=pattern&id=sign-in&state=loading/u);
  await expect(page.getByRole('button', { name: 'Show Loading state' })).toHaveAttribute('aria-selected', 'true');

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByRole('button', { name: 'Show Loading state' })).toHaveAttribute('aria-selected', 'true');
});

test('shows explicit recovery for a stale target instead of falling back silently', async ({ page }) => {
  await page.goto(targetUrl('surface=component&id=removed-component&example=basic'), { waitUntil: 'load' });

  await expect(page.getByTestId('showcase-target-error')).toBeVisible();
  await expect(page.getByTestId('showcase-target-error-message')).toContainText('removed-component');
  await expect(page.getByTestId('showcase-home')).toHaveCount(0);
});

test('keeps the legacy component query readable during migration', async ({ page }) => {
  await page.goto(targetUrl('component=button'), { waitUntil: 'load' });

  await expect(page.getByTestId('addressable-component-gallery')).toBeVisible();
  await expect(page.getByTestId('showcase-active-example')).toContainText('button / basic');
});
