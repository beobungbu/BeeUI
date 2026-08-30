import { expect, test, type Page } from '@playwright/test';

// BeeUI 1.0 #154 (R4A.4) — real-browser Tooltip evidence against the Showcase
// Component Gallery's own "Tooltip" demo (`apps/showcase/component-gallery/
// component-gallery.tsx`), now that Tooltip is on the public `@beeui/ui` barrel
// (#155). The exact open/close-delay boundary, hoverable/dismissible/persistent
// state machine, and Web accessibility-relationship wiring are already pinned
// deterministically (fake timers, no real waits) by
// `apps/showcase/__tests__/issue-152-tooltip-web.test.tsx`, and real hover/focus/
// Escape evidence for those same behaviors already exists against the standalone
// fixture app in `apps/visual-regression/tests/tooltip-fixture.spec.ts`. This
// file's job is different: prove the same contract holds for the real,
// composed-app instance of Tooltip (not an isolated fixture), and cover the
// remaining #154 regression-matrix items that are integration-shaped rather than
// state-machine-shaped — nested Dialog/overlay scope (covered in
// `overlay-context.spec.ts`), RTL, and reduced motion. High-contrast content
// visibility is covered in `tooltip-fixture.spec.ts`, which (unlike this
// Showcase app) already has per-theme-project real-browser evidence wired up
// via its `?theme=` query param.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('reveals content on hover after the default openDelay, wires the accessible relationship, and Escape dismisses it', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('tooltip-demo-trigger');
  const content = page.getByTestId('tooltip-demo-content');

  await expect(content).toBeHidden();
  await trigger.hover();

  // Well under the 500ms default openDelay: must not have committed yet.
  await page.waitForTimeout(150);
  await expect(content).toBeHidden();

  await expect(content).toBeVisible({ timeout: 2_000 });
  await expect(content).toHaveAttribute('role', 'tooltip');
  await expect(content).toHaveAttribute('tabindex', '-1');
  const contentId = await content.getAttribute('id');
  expect(contentId).toBeTruthy();
  await expect(trigger).toHaveAttribute('aria-describedby', contentId ?? '');

  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
});

test('opens immediately on focus and never becomes a Tab stop itself', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('tooltip-demo-trigger');
  const content = page.getByTestId('tooltip-demo-content');

  await trigger.focus();
  await expect(content).toBeVisible();

  const contentId = await content.getAttribute('id');
  await page.keyboard.press('Tab');
  const activeElementId = await page.evaluate(() => document.activeElement?.id ?? null);
  expect(activeElementId).not.toBe(contentId);
});

test('remains operable when the document direction is RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  const trigger = page.getByTestId('tooltip-demo-trigger');
  const content = page.getByTestId('tooltip-demo-content');

  await trigger.focus();
  await expect(content).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
});

test('opens and dismisses under prefers-reduced-motion: reduce', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openComponentGallery(page);

  const trigger = page.getByTestId('tooltip-demo-trigger');
  const content = page.getByTestId('tooltip-demo-content');

  // Tooltip renders no enter/exit transition of its own (`docs/components.md`
  // "Tooltip contract") — this proves reduced motion has nothing to break, not
  // a motion-timing boundary.
  await trigger.focus();
  await expect(content).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
});
