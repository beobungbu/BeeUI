import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// BeeUI issue #174 (R4F.4, ADR-008 "DateTimePicker" contract). Browser interaction
// evidence for what Jest cannot prove: real DOM keyboard focus moving through the
// Popover-hosted Calendar grid, hour/minute digit-entry focus/typing, AM/PM toggling,
// Escape dismissal, and focus restoration to the trigger. Deterministic
// selection/clearing/bounds/Field-error/controlled-state coverage lives in
// `apps/showcase/__tests__/issue-174-date-time-picker-web.test.tsx`.

test('DateTimePicker opens Calendar+time in a Popover, selects a date from the keyboard, and edits the time', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-time-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-value')).toHaveText(
    'Jan 15, 2026, 1:30 PM',
  );

  await trigger.click();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const focusedDay = page.getByTestId('date-time-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(focusedDay).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByTestId('date-time-picker-showcase-controlled-calendar-day-2026-01-16'),
  ).toBeFocused();
  await page.keyboard.press('Enter');

  // Selecting a day does not close the popover — the time part is still editable.
  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeVisible();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-value')).toHaveText(
    'Jan 16, 2026, 1:30 PM',
  );

  const hourInput = page.getByTestId('date-time-picker-showcase-controlled-time-hour');
  await hourInput.fill('09');
  await hourInput.blur();

  await page
    .getByTestId('date-time-picker-showcase-controlled-content-done')
    .click();

  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeHidden();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-value')).toHaveText(
    'Jan 16, 2026, 9:30 PM',
  );
  await expect(page.getByTestId('date-time-picker-showcase-controlled-state')).toHaveText(
    'value: 2026-1-16 21:30',
  );
  await expect(trigger).toBeFocused();
});

test('Escape dismisses the DateTimePicker popover without changing the selected value', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-time-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('date-time-picker-showcase-controlled-value')).toHaveText(
    'Jan 15, 2026, 1:30 PM',
  );
  await expect(trigger).toBeFocused();
});

test('clearing a DateTimePicker value does not open its popover', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-time-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await page.getByTestId('date-time-picker-showcase-controlled-clear').click();

  await expect(page.getByTestId('date-time-picker-showcase-controlled-value')).toHaveText(
    'Select a date and time',
  );
  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('DateTimePicker 24h fixture hides the AM/PM control and skips a disabled weekend day', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-time-picker-showcase-bounded-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-time-picker-showcase-bounded-content')).toBeVisible();

  await expect(page.getByTestId('date-time-picker-showcase-bounded-time-period')).toHaveCount(0);

  // 2026-01-10 is a Saturday (weekend, disabled by the fixture's isDateDisabled).
  const disabledDay = page.getByTestId('date-time-picker-showcase-bounded-calendar-day-2026-01-10');
  await expect(disabledDay).toHaveAttribute('aria-disabled', 'true');
  await disabledDay.click({ force: true });
  await expect(page.getByTestId('date-time-picker-showcase-bounded-content')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('date-time-picker-showcase-bounded-content')).toBeHidden();
});
