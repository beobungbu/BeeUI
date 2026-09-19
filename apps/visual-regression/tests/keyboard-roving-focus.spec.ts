import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// WS-I — real-browser evidence for Web arrow-key roving-tabindex navigation on
// `TabsList scrollable` (#591) and `Toolbar` (#611 item 1): the newly-focused control
// actually receives `document.activeElement`, and the newly-focused Tabs trigger actually
// scrolls into view under a real layout engine — jest's `onLayout`+`fireEvent` approximation
// (`tabs-scrollable-arrow-key-roving-focus.test.tsx`/`toolbar-arrow-key-roving-focus.test.tsx`)
// cannot prove either. Restricted to one project — this behavior is orthogonal to the
// light/dark/high-contrast appearance axis and the mobile/desktop viewport axis, matching
// `high-contrast-focus.spec.ts`'s own precedent for interaction-only specs.

async function gotoFixture(page: import('@playwright/test').Page, theme: string, dir?: 'rtl') {
  const dirParam = dir ? `&dir=${dir}` : '';
  await page.goto(`/?fixture=keyboard-roving-focus&theme=${theme}${dirParam}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

async function activeTestId(page: import('@playwright/test').Page) {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? null);
}

// Asserts the given testId's element is fully within the scrollable container's clipped
// bounds — real proof the roving-focus scroll-into-view effect actually moved the strip,
// not just that the correct trigger received DOM focus.
async function expectFullyVisibleWithin(
  page: import('@playwright/test').Page,
  containerTestId: string,
  targetTestId: string,
) {
  // Layout settles a frame or two after the scroll on slower CI runners, so poll
  // instead of reading the boxes once.
  await expect(async () => {
    const containerBox = await page.getByTestId(containerTestId).boundingBox();
    const targetBox = await page.getByTestId(targetTestId).boundingBox();
    expect(containerBox, `${containerTestId} must be visible`).not.toBeNull();
    expect(targetBox, `${targetTestId} must be visible`).not.toBeNull();
    expect(targetBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
    expect(targetBox!.x + targetBox!.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  }).toPass({ timeout: 5_000 });
}

test('TabsList scrollable: arrow keys move real DOM focus with wrap-around and scroll the current trigger into view', async ({
  page,
}, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'Keyboard roving-focus behavior is orthogonal to theme/viewport — proven once.',
  );

  await gotoFixture(page, metadata.visualTheme);
  await page.getByTestId('roving-tabs-trigger-1').focus();
  expect(await activeTestId(page)).toBe('roving-tabs-trigger-1');

  for (let step = 2; step <= 6; step += 1) {
    await page.keyboard.press('ArrowRight');
    expect(await activeTestId(page)).toBe(`roving-tabs-trigger-${step}`);
    await expectFullyVisibleWithin(page, 'roving-tabs-list', `roving-tabs-trigger-${step}`);
  }

  // Wraps from the last trigger back to the first.
  await page.keyboard.press('ArrowRight');
  expect(await activeTestId(page)).toBe('roving-tabs-trigger-1');

  await page.keyboard.press('End');
  expect(await activeTestId(page)).toBe('roving-tabs-trigger-6');
  await expectFullyVisibleWithin(page, 'roving-tabs-list', 'roving-tabs-trigger-6');

  await page.keyboard.press('Home');
  expect(await activeTestId(page)).toBe('roving-tabs-trigger-1');
  await expectFullyVisibleWithin(page, 'roving-tabs-list', 'roving-tabs-trigger-1');

  // Arrow-key roving focus never changes `Tabs`'s own selection.
  const selectedTrigger = page.getByTestId('roving-tabs-trigger-1');
  await expect(selectedTrigger).toHaveAttribute('aria-selected', 'true');
});

test('TabsList scrollable: RTL flips ArrowLeft/ArrowRight for real DOM focus', async ({ page }, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'Keyboard roving-focus behavior is orthogonal to theme/viewport — proven once.',
  );

  await gotoFixture(page, metadata.visualTheme, 'rtl');
  await page.getByTestId('roving-tabs-trigger-1').focus();

  // In RTL, ArrowLeft is "forward" (next).
  await page.keyboard.press('ArrowLeft');
  expect(await activeTestId(page)).toBe('roving-tabs-trigger-2');

  await page.keyboard.press('ArrowRight');
  expect(await activeTestId(page)).toBe('roving-tabs-trigger-1');
});

test('Toolbar: arrow keys reach the overflow trigger as the last stop and wrap back', async ({
  page,
}, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'Keyboard roving-focus behavior is orthogonal to theme/viewport — proven once.',
  );

  await gotoFixture(page, metadata.visualTheme);
  // The narrow `Toolbar` container collapses "Filter"/"Export" into the overflow menu,
  // leaving "Search" and the overflow trigger as the only two roving-sequence stops.
  // `:visible` excludes `Toolbar`'s own hidden natural-width measurement pass, which
  // renders every item (including collapsed ones) under the same `testID`.
  const visibleSearch = page.locator('[data-testid="roving-toolbar-search"]:visible');
  const visibleFilter = page.locator('[data-testid="roving-toolbar-filter"]:visible');
  await expect(visibleSearch).toBeVisible();
  await expect(visibleFilter).toHaveCount(0);
  await expect(page.getByTestId('roving-toolbar-overflow-trigger')).toBeVisible();

  await visibleSearch.focus();
  expect(await activeTestId(page)).toBe('roving-toolbar-search');

  await page.keyboard.press('ArrowRight');
  expect(await activeTestId(page)).toBe('roving-toolbar-overflow-trigger');

  // Wraps back to the first visible item.
  await page.keyboard.press('ArrowRight');
  expect(await activeTestId(page)).toBe('roving-toolbar-search');

  await page.keyboard.press('End');
  expect(await activeTestId(page)).toBe('roving-toolbar-overflow-trigger');

  await page.keyboard.press('Home');
  expect(await activeTestId(page)).toBe('roving-toolbar-search');
});
