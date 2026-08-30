import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #177 (R4F.7) — Calendar/date visual and native runtime
// acceptance. Renders `apps/visual-regression/App.tsx`'s dedicated `date`
// fixture: a standalone bounded `Calendar`, plus form `DatePicker`/
// `DateTimePicker` instances in their default/invalid/disabled `Field`
// states, across the full canonical `visualThemes` x `visualViewports`
// matrix (see `playwright.config.ts`'s `canonicalProjects`) — the same
// mechanism `table-production.spec.ts` (#169) uses.
//
// This spec is the *visual* half of #177. It intentionally does not
// duplicate interaction/keyboard/focus-restoration/a11y-tree proof already
// established as real-browser evidence by:
//   - `date-picker-showcase.spec.ts` (#173) / `date-time-picker-showcase.spec.ts`
//     (#174) — Popover open/close/Escape/focus-restoration/disabled-day-skip/
//     PageDown navigation against the real `apps/showcase` Component Gallery.
//   - `calendar-accessibility-showcase.spec.ts` (#176) — full grid keyboard
//     contract, RTL keyboard mirroring, focus-visible outline, touch-target
//     geometry, large-text grid resilience, AM/PM keyboard operability.
// Native (iOS/Android) selection/presentation/dismiss-flow evidence is
// deterministic-contract evidence (RNTL against a mocked native-module
// boundary): `issue-173-date-picker-native.test.tsx` / `issue-174-date-time-
// picker-native.test.tsx`. Real on-device/simulator native runtime capture is
// explicitly deferred — see `docs/decisions/008-datetime-architecture.md`'s
// "#177 native runtime evidence" section and `docs/beeui-1.0-evidence-classes.md`.

async function gotoDateFixture(page: Page, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ fixture: 'date', ...params }).toString();
  await page.goto(`/?${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

test.describe('default state — full canonical theme x viewport matrix', () => {
  test('renders the bounded Calendar and DatePicker/DateTimePicker default/invalid/disabled states', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page, { theme: metadata.visualTheme });

    // Standalone Calendar: selected value, a min/max-bounded weekend day
    // disabled, everything visible with no overlap.
    const calendar = page.getByTestId('date-production-calendar');
    await expect(calendar).toBeVisible();
    const selectedDay = page.getByTestId('date-production-calendar-instance-day-2026-01-15');
    // Calendar communicates the selected day-cell state through its
    // accessible name (`aria-label`, e.g. "...Selected") rather than
    // `aria-selected` — the same contract
    // `calendar-accessibility-showcase.spec.ts` (#176) asserts.
    await expect(selectedDay).toHaveAttribute('aria-label', /Selected/);
    // 2026-01-10 is a Saturday — disabled by the weekend predicate, inside
    // the min(5)/max(25) bounded range, so both "disabled" and "min-max"
    // fixture bullets are proven by the same cell.
    const disabledDay = page.getByTestId('date-production-calendar-instance-day-2026-01-10');
    await expect(disabledDay).toHaveAttribute('aria-disabled', 'true');
    const outOfRangeDay = page.getByTestId('date-production-calendar-instance-day-2026-01-01');
    await expect(outOfRangeDay).toHaveAttribute('aria-disabled', 'true');

    // DatePicker: default (formatted value), invalid (Field error visible),
    // disabled (trigger reports disabled state, blocks opening).
    await expect(page.getByTestId('date-production-date-picker-default-value')).toHaveText(
      'Jan 15, 2026',
    );
    const datePickerInvalidGroup = page.getByTestId('date-production-date-picker');
    await expect(datePickerInvalidGroup.getByRole('alert')).toHaveText('This field is required');
    const disabledDatePickerTrigger = page.getByTestId('date-production-date-picker-disabled-trigger');
    await expect(disabledDatePickerTrigger).toHaveAttribute('aria-disabled', 'true');
    await disabledDatePickerTrigger.click({ force: true });
    await expect(page.getByTestId('date-production-date-picker-disabled-content')).toBeHidden();

    // DateTimePicker: default (formatted date+time value), invalid, disabled.
    await expect(page.getByTestId('date-production-date-time-picker-default-value')).toHaveText(
      'Jan 15, 2026, 1:30 PM',
    );
    const dateTimePickerInvalidGroup = page.getByTestId('date-production-date-time-picker');
    await expect(dateTimePickerInvalidGroup.getByRole('alert')).toHaveText('This field is required');
    const disabledDateTimePickerTrigger = page.getByTestId(
      'date-production-date-time-picker-disabled-trigger',
    );
    await expect(disabledDateTimePickerTrigger).toHaveAttribute('aria-disabled', 'true');
    await disabledDateTimePickerTrigger.click({ force: true });
    await expect(page.getByTestId('date-production-date-time-picker-disabled-content')).toBeHidden();

    await expect(page).toHaveScreenshot(
      `date-production--default--${metadata.visualTheme}--${metadata.visualViewport}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.0001,
      },
    );
  });
});

test.describe('open Calendar popover', () => {
  test('DatePicker opens its bounded Calendar in a Popover', async ({ page }, testInfo: TestInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'The open-Calendar visual surface is proven once — theme/viewport crossing is already covered by the default-state matrix above.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page);

    await page.getByTestId('date-production-date-picker-default-trigger').click();
    const content = page.getByTestId('date-production-date-picker-default-content');
    await expect(content).toBeVisible();
    await expect(content.getByRole('grid')).toBeVisible();
    await expect(
      page.getByTestId('date-production-date-picker-default-calendar-day-2026-01-10'),
    ).toHaveAttribute('aria-disabled', 'true');

    await expect(page).toHaveScreenshot('date-production--open-date-picker--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });

  test('DateTimePicker opens its bounded Calendar and time controls in a Popover', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'The open-Calendar visual surface is proven once — theme/viewport crossing is already covered by the default-state matrix above.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page);

    await page.getByTestId('date-production-date-time-picker-default-trigger').click();
    const content = page.getByTestId('date-production-date-time-picker-default-content');
    await expect(content).toBeVisible();
    await expect(content.getByRole('grid')).toBeVisible();
    await expect(page.getByTestId('date-production-date-time-picker-default-time-hour')).toBeVisible();

    await expect(page).toHaveScreenshot('date-production--open-date-time-picker--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});

test.describe('RTL', () => {
  test('Calendar navigation chevrons and grid mirror under RTL', async ({ page }, testInfo: TestInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'RTL mirroring proof does not need a full theme/viewport crossing.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page, { dir: 'rtl' });

    const calendar = page.getByTestId('date-production-calendar-instance');
    await expect(calendar).toBeVisible();

    // Under RTL, "previous month" is the logical-start action, which mirrors
    // to the physical right — matching the same ArrowLeft/ArrowRight-mirroring
    // contract `calendar-accessibility-showcase.spec.ts` proves via real
    // keyboard events; this is the equivalent static-geometry proof for the
    // chevrons themselves.
    const previousMonthBox = await page
      .getByTestId('date-production-calendar-instance-previous-month')
      .boundingBox();
    const nextMonthBox = await page
      .getByTestId('date-production-calendar-instance-next-month')
      .boundingBox();
    expect(previousMonthBox).not.toBeNull();
    expect(nextMonthBox).not.toBeNull();
    expect(previousMonthBox!.x).toBeGreaterThan(nextMonthBox!.x);

    await expect(page).toHaveScreenshot('date-production--rtl--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});

test.describe('large text (200%-equivalent)', () => {
  test('Calendar day cells and picker triggers remain visible and unclipped', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'Large-text overflow proof does not need a full theme/viewport crossing.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px'; // 2x the 16px baseline
    });

    const day15 = page.getByTestId('date-production-calendar-instance-day-2026-01-15');
    const day16 = page.getByTestId('date-production-calendar-instance-day-2026-01-16');
    await expect(day15).toBeVisible();
    await expect(day16).toBeVisible();
    const day15Box = (await day15.boundingBox())!;
    const day16Box = (await day16.boundingBox())!;
    // Adjacent day cells must not visually overlap even at 2x root font size.
    expect(day15Box.x + day15Box.width).toBeLessThanOrEqual(day16Box.x + 1);

    await expect(page.getByTestId('date-production-date-picker-default-value')).toBeVisible();

    await expect(page).toHaveScreenshot('date-production--large-text--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
  });
});

test.describe('locale — vi-VN', () => {
  test('Calendar month label and picker values render Vietnamese Intl formatting', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'Locale-formatting proof does not need a full theme/viewport crossing.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page, { locale: 'vi-VN' });

    await expect(page.getByTestId('date-production-calendar-instance-month-label')).toHaveText(
      'tháng 1 năm 2026',
    );

    await expect(page).toHaveScreenshot('date-production--locale-vi--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});

test.describe('narrow phone / tablet viewport', () => {
  test('renders without horizontal page overflow at a 360px narrow-phone width', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'This test drives its own explicit viewport size — one project run is sufficient.',
    );

    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page);

    const documentOverflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(documentOverflowsX).toBe(false);
    await expect(page.getByTestId('date-production-calendar')).toBeVisible();

    await expect(page).toHaveScreenshot('date-production--viewport-narrow--light.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });

  test('renders without horizontal page overflow at a 768px tablet width', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'This test drives its own explicit viewport size — one project run is sufficient.',
    );

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDateFixture(page);

    const documentOverflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(documentOverflowsX).toBe(false);
    await expect(page.getByTestId('date-production-calendar')).toBeVisible();

    await expect(page).toHaveScreenshot('date-production--viewport-tablet--light.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});
