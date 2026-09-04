import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174/showcase/';

function targetUrl(query: string) {
  return `${showcaseBaseUrl}?${query}`;
}

async function expectActiveTarget(page: Page, label: string) {
  await expect(page.getByTestId('showcase-active-example-label')).toHaveText(label);
}

test('opens a real Button/basic target directly and preserves it across reload', async ({ page }) => {
  await page.goto(targetUrl('surface=component&id=button&example=basic'), { waitUntil: 'load' });

  await expect(page.getByTestId('addressable-component-gallery')).toBeVisible();
  await expectActiveTarget(page, 'button / basic');
  await expect(page.locator('[data-showcase-target-active="true"]')).toHaveText('Primary action');
  await expect(page).toHaveURL(/\/showcase\/\?surface=component&id=button&example=basic/u);

  await page.reload({ waitUntil: 'load' });
  await expectActiveTarget(page, 'button / basic');
  await expect(page.locator('[data-showcase-target-active="true"]')).toHaveText('Primary action');
});

test('opens a form target at the actual Field fixture', async ({ page }) => {
  await page.goto(targetUrl('surface=component&id=field&example=basic'), { waitUntil: 'load' });

  await expectActiveTarget(page, 'field / basic');
  // The focused element is the whole Field (label + control + helper text); a required
  // Field's label renders "Email *", so assert containment rather than exact text.
  await expect(page.locator('[data-showcase-target-active="true"]')).toContainText('Email');
  await expect(page.getByTestId('component-gallery-field')).toHaveAttribute('data-showcase-target-active', 'true');
});

test('selects distinct Select examples and synchronizes Back/Forward with the URL', async ({ page }) => {
  await page.goto(targetUrl('surface=component&id=select&example=uncontrolled'), { waitUntil: 'load' });

  await expectActiveTarget(page, 'select / uncontrolled');
  await expect(page.getByTestId('select-showcase-placeholder-trigger')).toBeVisible();
  await expect(page.getByTestId('select-showcase-placeholder-trigger')).toHaveAttribute('data-showcase-target-active', 'true');

  await page.getByTestId('showcase-example-states').click();
  await expect(page).toHaveURL(/surface=component&id=select&example=states/u);
  await expectActiveTarget(page, 'select / states');
  await expect(page.getByTestId('select-showcase-disabled-trigger')).toHaveAttribute('data-showcase-target-active', 'true');

  await page.goBack();
  await expect(page).toHaveURL(/surface=component&id=select&example=uncontrolled/u);
  await expectActiveTarget(page, 'select / uncontrolled');
  await expect(page.getByTestId('select-showcase-placeholder-trigger')).toHaveAttribute('data-showcase-target-active', 'true');

  await page.goForward();
  await expect(page).toHaveURL(/surface=component&id=select&example=states/u);
  await expectActiveTarget(page, 'select / states');
});

test('opens each claimed coverage class at a different element', async ({ page }) => {
  // Guards the #472 rule that a complex component cannot satisfy coverage with one sample:
  // two classes of the same component must not highlight the same node.
  const seen = new Map<string, string>();

  for (const example of ['basic', 'states', 'accessibility', 'composition']) {
    await page.goto(targetUrl(`surface=component&id=toast&example=${example}`), { waitUntil: 'load' });
    await expectActiveTarget(page, `toast / ${example}`);
    const active = page.locator('[data-showcase-target-active="true"]');
    await expect(active).toHaveCount(1);
    const label = (await active.textContent())?.trim() ?? '';
    expect(label).not.toBe('');
    expect([...seen.values()]).not.toContain(label);
    seen.set(example, label);
  }

  expect(seen.size).toBe(4);
});

test('opens representative overlay, data and date/time component fixtures exactly', async ({ page }) => {
  const cases = [
    { id: 'sheet', assertion: 'sheet-demo-trigger' },
    { id: 'table', assertion: 'table-showcase' },
    { id: 'date-picker', assertion: 'showcase-exact-fixture' },
    { id: 'date-time-picker', assertion: 'showcase-exact-fixture' },
  ];

  for (const entry of cases) {
    await page.goto(targetUrl(`surface=component&id=${entry.id}&example=basic`), { waitUntil: 'load' });
    await expectActiveTarget(page, `${entry.id} / basic`);
    await expect(page.getByTestId(entry.assertion)).toBeVisible();
    await expect(page.locator('[data-showcase-target-active="true"]')).toHaveCount(1);
  }
});

test('opens one exact pattern target from every production domain', async ({ page }) => {
  for (const patternId of ['sign-in', 'dashboard-overview', 'product-feed', 'profile']) {
    await page.goto(targetUrl(`surface=pattern&id=${patternId}`), { waitUntil: 'load' });
    await expect(page.getByTestId(`pattern-preview-${patternId}`)).toBeVisible();
    await expect(page.getByTestId('showcase-active-example')).toContainText(`${patternId} /`);
    await expect(page).toHaveURL(new RegExp(`/showcase/\\?surface=pattern&id=${patternId}`, 'u'));
  }
});

test('opens an exact non-default pattern state and keeps Back/Forward deterministic', async ({ page }) => {
  await page.goto(targetUrl('surface=pattern&id=sign-in&state=invalid'), { waitUntil: 'load' });

  await expect(page.getByTestId('pattern-preview-sign-in')).toBeVisible();
  await expect(page.getByTestId('showcase-active-example')).toContainText('sign-in / invalid');

  await page.getByRole('button', { name: 'Show Loading state' }).click();
  await expect(page).toHaveURL(/surface=pattern&id=sign-in&state=loading/u);
  await expect(page.getByTestId('showcase-active-example')).toContainText('sign-in / loading');

  await page.goBack();
  await expect(page).toHaveURL(/surface=pattern&id=sign-in&state=invalid/u);
  await expect(page.getByTestId('showcase-active-example')).toContainText('sign-in / invalid');

  await page.goForward();
  await expect(page).toHaveURL(/surface=pattern&id=sign-in&state=loading/u);
  await expect(page.getByTestId('showcase-active-example')).toContainText('sign-in / loading');

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('showcase-active-example')).toContainText('sign-in / loading');
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
  await expectActiveTarget(page, 'button / basic');
  await expect(page.locator('[data-showcase-target-active="true"]')).toHaveText('Primary action');
});
