import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #152 — real-browser hover/focus/delay/Escape evidence for the
// Tooltip Web contract (`docs/decisions/005-tooltip-contract.md`), driven by
// the `tooltip` fixture in `apps/visual-regression/App.tsx`.
//
// Deliberately NOT part of `visualScenarios`/`visual.spec.ts`'s canonical
// matrix (interactive specs live in their own file the same way
// `high-contrast-focus.spec.ts`/`scoped-preview.spec.ts` already do) and
// restricted to one project (`light`/`desktop`): this proves interaction
// behavior, not a themed pixel diff, so it does not need the full
// theme × viewport cross-product.
//
// The exact-millisecond open/close delay boundary is already pinned
// deterministically (fake timers, no real waits) by
// `apps/showcase/__tests__/issue-152-tooltip-web.test.tsx`. This file's job
// per the ADR's own evidence split is different: prove a *real* mouse/keyboard
// event actually drives the behavior in a real browser — bounded, generous
// real waits (well under/over the fixture's configured delay) are the
// appropriate tool here, not a re-proof of the exact boundary.
const fixtureUrl = 'http://127.0.0.1:4173/?fixture=tooltip';

async function gotoFixture(page: Page) {
  await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

// Real DOM `click()` instead of Playwright's synthetic mouse-move+down+up
// `.click()`: a Tooltip trigger also participates in the hover-open state
// machine, and (like `select-showcase.spec.ts`'s theme-toggle button already
// does for the same reason) routing through an actual pointer gesture here is
// incidental to what this test proves and has been flaky against BeeUI's
// hover-aware Pressable wiring in this harness.
async function clickTrigger(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((element) => (element as HTMLElement).click());
}

test.beforeEach(({}, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'Interaction behavior only needs to be proven once, not per theme/viewport.',
  );
});

test('hover reveals content only after the ~500ms default openDelay, then Escape dismisses it', async ({
  page,
}) => {
  await gotoFixture(page);

  const trigger = page.getByTestId('tooltip-default-trigger');
  const content = page.getByTestId('tooltip-default-content');

  await expect(content).toBeHidden();
  await trigger.hover();

  // Well under the 500ms openDelay: must not have committed yet.
  await page.waitForTimeout(150);
  await expect(content).toBeHidden();

  // Comfortably past the openDelay: must have committed by now.
  await expect(content).toBeVisible({ timeout: 2_000 });
  await expect(content).toHaveAttribute('role', 'tooltip');
  const contentId = await content.getAttribute('id');
  expect(contentId).toBeTruthy();
  await expect(trigger).toHaveAttribute('aria-describedby', contentId ?? '');

  // Dismissible (WCAG 1.4.13): Escape closes without any pointer/focus movement.
  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
});

test('never becomes a Tab stop and never receives focus itself', async ({ page }) => {
  await gotoFixture(page);

  const trigger = page.getByTestId('tooltip-default-trigger');
  const content = page.getByTestId('tooltip-default-content');

  await trigger.focus();
  await expect(content).toBeVisible();
  await expect(content).toHaveAttribute('tabindex', '-1');
  const contentId = await content.getAttribute('id');
  expect(contentId).toBeTruthy();

  // A keyboard user tabbing away from the trigger must land on the NEXT real
  // Tab stop, never on the tooltip bubble itself (ADR-005 "no focus transfer
  // into content").
  await page.keyboard.press('Tab');
  const activeElementId = await page.evaluate(() => document.activeElement?.id ?? null);
  expect(activeElementId).not.toBe(contentId);
});

test('cancels a pending open when the pointer leaves before openDelay elapses', async ({ page }) => {
  await gotoFixture(page);

  const trigger = page.getByTestId('tooltip-fast-trigger');
  const content = page.getByTestId('tooltip-fast-content');
  const heading = page.getByText('Tooltip', { exact: true });

  // The fixture's "fast" instance uses a 300ms openDelay specifically so this
  // quick enter/leave sequence (a handful of milliseconds of real Playwright
  // action time) has a comfortable margin under it.
  await trigger.hover();
  await heading.hover();

  await page.waitForTimeout(400); // past the 300ms openDelay the pointer never stayed for
  await expect(content).toBeHidden();
});

test('keyboard focus opens immediately and Tab-away closes immediately', async ({ page }) => {
  await gotoFixture(page);

  const trigger = page.getByTestId('tooltip-default-trigger');
  const content = page.getByTestId('tooltip-default-content');

  await trigger.focus();
  await expect(content).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(content).toBeHidden();
});

test('a controlled Tooltip mirrors its own onOpenChange from a press', async ({ page }) => {
  await gotoFixture(page);

  const content = page.getByTestId('tooltip-controlled-content');
  const state = page.getByTestId('tooltip-controlled-state');

  await expect(state).toHaveText('open: false');
  await expect(content).toBeHidden();

  await clickTrigger(page, 'tooltip-controlled-trigger');
  await expect(state).toHaveText('open: true');
  await expect(content).toBeVisible();

  await clickTrigger(page, 'tooltip-controlled-trigger');
  await expect(state).toHaveText('open: false');
  await expect(content).toBeHidden();
});

test('a visible tooltip bubble matches the representative visual baseline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoFixture(page);

  await page.getByTestId('tooltip-default-trigger').focus();
  await expect(page.getByTestId('tooltip-default-content')).toBeVisible();

  await expect(page).toHaveScreenshot('tooltip-open--light--desktop.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.0001,
  });
});
