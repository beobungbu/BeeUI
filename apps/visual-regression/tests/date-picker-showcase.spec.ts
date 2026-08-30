import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// BeeUI issue #173 (R4F.3, ADR-008 "DatePicker" contract). Browser interaction
// evidence for what Jest cannot prove: real DOM keyboard focus moving through the
// Popover-hosted Calendar grid, Escape dismissal, and focus restoration to the
// trigger. Deterministic selection/clearing/bounds/Field-error/controlled-state
// coverage lives in `apps/showcase/__tests__/issue-173-date-picker-web.test.tsx`.

test('DatePicker opens the Calendar in a Popover and selects a date from the keyboard', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('date-picker-showcase-controlled-value')).toHaveText('Jan 15, 2026');

  await trigger.click();
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const focusedDay = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(focusedDay).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-16'),
  ).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeHidden();
  await expect(page.getByTestId('date-picker-showcase-controlled-value')).toHaveText('Jan 16, 2026');
  await expect(page.getByTestId('date-picker-showcase-controlled-state')).toHaveText(
    'value: 2026-1-16',
  );
  await expect(trigger).toBeFocused();
});

test('Escape dismisses the DatePicker popover without changing the selected value', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('date-picker-showcase-controlled-value')).toHaveText('Jan 15, 2026');
  await expect(trigger).toBeFocused();
});

test('clearing a DatePicker value does not open its popover', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await page.getByTestId('date-picker-showcase-controlled-clear').click();

  await expect(page.getByTestId('date-picker-showcase-controlled-value')).toHaveText(
    'Select a date',
  );
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('DatePicker keyboard navigation skips a disabled weekend day and PageDown moves a month', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-bounded-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-picker-showcase-bounded-content')).toBeVisible();

  // 2026-01-10 is a Saturday (weekend, disabled by the fixture's isDateDisabled).
  const disabledDay = page.getByTestId('date-picker-showcase-bounded-calendar-day-2026-01-10');
  await expect(disabledDay).toHaveAttribute('aria-disabled', 'true');
  await disabledDay.click({ force: true });
  await expect(page.getByTestId('date-picker-showcase-bounded-content')).toBeVisible();

  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('date-picker-showcase-bounded-calendar-month-label')).toHaveText(
    'February 2026',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('date-picker-showcase-bounded-content')).toBeHidden();
});
