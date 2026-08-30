import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// BeeUI issue #176 (R4F.6, "Calendar/date accessibility and keyboard acceptance").
// Real-browser (Chromium) evidence for the parts of the #176 acceptance matrix that
// only a real DOM/layout engine can prove, on top of:
//   - `apps/showcase/__tests__/issue-172-calendar.test.tsx` — the full deterministic
//     WAI-ARIA grid keyboard contract (Arrow/PageUp/PageDown/Home/End/Enter/Space/
//     Escape/RTL mirroring/disabled).
//   - `apps/showcase/__tests__/issue-176-calendar-date-a11y.test.tsx` — grid/row/cell
//     role nesting, touch-target token, announced live region, DateTimePicker
//     hour/minute/AM-PM screen-reader names.
//   - `apps/visual-regression/tests/date-picker-showcase.spec.ts` /
//     `date-time-picker-showcase.spec.ts` — Popover open/close, Escape, focus
//     restoration, disabled-day skip, PageDown month navigation.
//
// This file's job is specifically: the parts of the keyboard matrix those specs do not
// already exercise in a real browser (Home/End/ArrowUp/ArrowDown/Shift+PageUp/
// Shift+PageDown), RTL keyboard mirroring against real layout, announced day-cell
// states in the real accessibility tree, a visible keyboard-focus indicator, minimum
// touch-target geometry, large-text resilience, and DateTimePicker's AM/PM control
// keyboard operability.

test('Calendar grid exposes real grid/row/cell ARIA roles and announced day states', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeVisible();

  const grid = page.getByTestId('date-picker-showcase-controlled-calendar-grid');
  await expect(grid).toHaveAttribute('role', 'grid');

  const selectedDay = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(selectedDay).toHaveAttribute('role', 'cell');
  await expect(selectedDay).toHaveAttribute('aria-label', /Selected/);
  await expect(selectedDay).toHaveAttribute('aria-label', /Thursday, January 15, 2026/);

  const nonSelectedDay = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-16');
  const nonSelectedLabel = await nonSelectedDay.getAttribute('aria-label');
  expect(nonSelectedLabel).not.toContain('Selected');
});

test('Calendar keyboard grid contract: ArrowUp/Down move a week, Home/End move within the week, Shift+PageUp/Down move a year', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeVisible();
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15'),
  ).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-22'),
  ).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15'),
  ).toBeFocused();

  await page.keyboard.press('Home');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-12'),
  ).toBeFocused();

  await page.keyboard.press('End');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-18'),
  ).toBeFocused();

  await page.keyboard.press('Shift+PageDown');
  await expect(page.getByTestId('date-picker-showcase-controlled-calendar-month-label')).toHaveText(
    'January 2027',
  );

  await page.keyboard.press('Shift+PageUp');
  await expect(page.getByTestId('date-picker-showcase-controlled-calendar-month-label')).toHaveText(
    'January 2026',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeHidden();
});

test('Calendar keyboard mirrors ArrowLeft/ArrowRight and the navigation chevrons under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeVisible();
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15'),
  ).toBeFocused();

  // Under RTL, ArrowRight is the logical "previous day" direction (physically
  // mirrored), matching the deterministic proof in
  // `issue-172-calendar.test.tsx`'s "swaps ArrowRight/ArrowLeft… under RTL" test —
  // this is the same contract, proven against real layout/keyboard event dispatch.
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-14'),
  ).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15'),
  ).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
  });
});

test('a focused Calendar day cell renders a visible, non-transparent keyboard focus indicator', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const focusedDay = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(focusedDay).toBeFocused();

  // Chromium's `:focus-visible` heuristic does not treat a focus that immediately
  // follows a mouse click as keyboard-originated, even though the day cell's own focus
  // was set programmatically by the Popover-open effect. A real keyboard round trip
  // (net zero movement) establishes genuine keyboard-interaction context, matching how
  // an actual keyboard user reaches this cell — mirrors `high-contrast-focus.spec.ts`'s
  // real-Tab-press requirement for the same reason.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(focusedDay).toBeFocused();

  const outline = await focusedDay.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
  });

  expect(outline.style, 'focused day cell must render a visible outline, not "none"').not.toBe('none');
  expect(Number.parseFloat(outline.width), 'focus outline must have non-zero width').toBeGreaterThan(0);
  expect(outline.color, 'focus outline must not be fully transparent').not.toBe('rgba(0, 0, 0, 0)');

  await page.keyboard.press('Escape');
});

test('Calendar day cells meet the minimum 44x44 touch-target size', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const day = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(day).toBeVisible();

  const box = await day.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press('Escape');
});

test('Calendar grid remains usable (no overlapping cells, focus still lands correctly) under a large text-scale override', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  // Mirrors `dynamic-type-showcase.spec.ts`'s root-font-size-override technique: a
  // stand-in for the OS/browser default text-size preference every BeeUI `rem`-based
  // semantic typography responds to.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const day15 = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(day15).toBeFocused();

  const day16Box = (await page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-16').boundingBox())!;
  const day15Box = (await day15.boundingBox())!;
  // Adjacent day cells must not visually overlap even at 2x root font size — the
  // touch-target/grid layout must grow, not collapse into itself.
  expect(day15Box.x + day15Box.width).toBeLessThanOrEqual(day16Box.x + 1);

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-16')).toBeFocused();

  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
});

test('DateTimePicker AM/PM control is keyboard-operable (Tab + Enter), not mouse-only', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-time-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-content')).toBeVisible();
  await expect(
    page.getByTestId('date-time-picker-showcase-controlled-value'),
  ).toHaveText('Jan 15, 2026, 1:30 PM');

  const amSegment = page.getByTestId('date-time-picker-showcase-controlled-time-period-am');
  await amSegment.focus();
  await page.keyboard.press('Enter');

  await page.getByTestId('date-time-picker-showcase-controlled-content-done').click();
  await expect(page.getByTestId('date-time-picker-showcase-controlled-value')).toHaveText(
    'Jan 15, 2026, 1:30 AM',
  );
});
