import { expect, test } from '@playwright/test';

// Real-browser regression for #35: a consumer React context declared below
// BeeUIProvider must resolve to the provided value inside overlay content on web,
// where the transport uses ReactDOM.createPortal. "context: preserved" proves the
// provider value survived; "context: overlay-context-default" would be a failure.
const showcaseBaseUrl = 'http://127.0.0.1:4174';
const visualBaseUrl = 'http://127.0.0.1:4173';

async function openComponentGallery(page: import('@playwright/test').Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// #403 — Dialog's own focus trap (`useDialogFocusTrap` in `packages/ui/src/
// components/dialog.tsx`) moves focus to the panel's first focusable
// descendant on a deferred macrotask (`setTimeout(focusInitialTarget, 0)`)
// after the Dialog opens. A test that clicks the Dialog trigger and then
// immediately `.focus()`es a different element inside the panel (the nested
// Tooltip trigger, below) races that deferred steal: if the timer fires
// after the explicit `.focus()` call lands, it silently moves focus back
// off the Tooltip trigger, blurring it and closing the Tooltip before the
// assertion observes it open. This is a pure test-timing race — the trap
// itself is correct and single-shot per open — so waiting for the trap's
// own initial focus target to land first (any focus inside the dialog
// panel) fully resolves it without an arbitrary sleep.
async function waitForDialogFocusTrapSettled(
  page: import('@playwright/test').Page,
  dialogAccessibleName: string,
) {
  await expect(
    page.getByRole('dialog', { name: dialogAccessibleName }).locator(':focus'),
  ).toHaveCount(1);
}

test('preserves consumer context inside a web Popover', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-popover-trigger').click();
  await expect(page.getByTestId('overlay-context-popover-value')).toHaveText('context: preserved');
});

test('preserves consumer context inside a web DropdownMenu', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-menu-trigger').click();
  await expect(page.getByTestId('overlay-context-menu-value')).toHaveText('context: preserved');
});

// Tooltip (#154) opens on focus (immediate, no openDelay, ADR-005) — the
// deterministic way to reveal `TooltipContent` for a real-browser assertion
// without a timing dependence, exactly like `tooltip-fixture.spec.ts` already
// does for the standalone fixture app.
test('preserves consumer context inside a web Tooltip', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-tooltip-trigger').focus();
  await expect(page.getByTestId('overlay-context-tooltip-value')).toHaveText('context: preserved');
});

test('preserves consumer context inside a Popover nested in a Dialog', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-popover-trigger').click();
  await expect(page.getByTestId('overlay-context-dialog-popover-value')).toHaveText(
    'context: preserved',
  );
});

test('preserves consumer context inside a Tooltip nested in a Dialog', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await waitForDialogFocusTrapSettled(page, 'Dialog with a nested overlay');
  await page.getByTestId('overlay-context-dialog-tooltip-trigger').focus();
  await expect(page.getByTestId('overlay-context-dialog-tooltip-value')).toHaveText(
    'context: preserved',
  );
});

// #154's "nested Dialog/overlay scope" requirement: a Tooltip opened from inside
// a Dialog must dismiss child-first through the same scope-aware Escape routing
// Popover/DropdownMenu already prove above — Tooltip reuses `useOverlayDismissable`
// exactly like they do (ADR-005), not a second dismiss mechanism.
test('Web Escape is scope-aware: closes a dialog-nested Tooltip, Dialog stays open', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await waitForDialogFocusTrapSettled(page, 'Dialog with a nested overlay');
  await page.getByTestId('overlay-context-dialog-tooltip-trigger').focus();
  await expect(page.getByTestId('overlay-context-dialog-tooltip-value')).toHaveText(
    'context: preserved',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-context-dialog-tooltip-value')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-tooltip-trigger')).toBeVisible();
});

test('preserves context and selects in a DropdownMenu nested in a Dialog', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-menu-trigger').click();
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveText(
    'context: preserved',
  );
  await page.getByTestId('overlay-context-dialog-menu-item').click();
  await expect(page.getByTestId('overlay-context-dialog-menu-item')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-menu-action')).toHaveText(
    'menu action: selected',
  );
});

test('Web Escape is scope-aware: closes the dialog-nested menu, Dialog stays open', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-menu-trigger').click();
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveText(
    'context: preserved',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-menu-trigger')).toBeVisible();
});

// #68 — real-browser regression proving BeeThemeScope (a thin typed wrapper over
// Uniwind's own ScopedTheme) is resolved for Popover/DropdownMenu/Dialog content
// declared inside it on web, where the transport is `ReactDOM.createPortal`. This
// mirrors the #35 pattern above exactly: "theme: violet-dark" proves the scope
// survived the portal; anything else would be a failure. It also proves nested
// scopes render distinct values and a scope never leaks to a sibling outside it.
test('BeeThemeScope resolves for its own subtree', async ({ page }) => {
  await openComponentGallery(page);
  await expect(page.getByTestId('theme-scope-root-value')).toHaveText('theme: violet-dark');
});

test('a nested BeeThemeScope overrides its parent scope for its own subtree', async ({ page }) => {
  await openComponentGallery(page);
  await expect(page.getByTestId('theme-scope-nested-value')).toHaveText('theme: light');
});

test('BeeThemeScope does not leak into a sibling outside the scope', async ({ page }) => {
  await openComponentGallery(page);
  await expect(page.getByTestId('theme-scope-sibling-value')).not.toHaveText('theme: violet-dark');
});

test('BeeThemeScope resolves inside a web Popover portal', async ({ page }) => {
  await openComponentGallery(page);
  await page.getByTestId('theme-scope-popover-trigger').click();
  await expect(page.getByTestId('theme-scope-popover-value')).toHaveText('theme: violet-dark');
});

test('BeeThemeScope resolves inside a web DropdownMenu portal', async ({ page }) => {
  await openComponentGallery(page);
  await page.getByTestId('theme-scope-menu-trigger').click();
  await expect(page.getByTestId('theme-scope-menu-value')).toHaveText('theme: violet-dark');
});

test('BeeThemeScope resolves inside a web Dialog', async ({ page }) => {
  await openComponentGallery(page);
  await page.getByTestId('theme-scope-dialog-trigger').click();
  await expect(page.getByTestId('theme-scope-dialog-value')).toHaveText('theme: violet-dark');
});

// CASE C pins the exact registration-order failure mode. The hardening fixture
// commits Dialog + nested menu first, then opens the root Popover from a passive
// effect in a later commit. Therefore the root overlay is unquestionably the later
// registration; Escape must still route to the deeper modal scope.
test('Web Escape CASE C: later root Popover behind the dialog cannot steal Escape', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(`${visualBaseUrl}/?hardening=case-c`, { waitUntil: 'load' });

  await expect(page.getByTestId('hardening-casec-menu-item')).toBeVisible();
  await expect(page.getByTestId('hardening-casec-root-value')).toHaveText(
    'root-opened-after-menu',
  );
  await expect(page.getByTestId('hardening-casec-dialog-title')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('hardening-casec-menu-item')).toHaveCount(0);
  await expect(page.getByTestId('hardening-casec-menu-trigger')).toBeVisible();
  await expect(page.getByTestId('hardening-casec-dialog-title')).toBeVisible();
  await expect(page.getByTestId('hardening-casec-root-value')).toHaveText(
    'root-opened-after-menu',
  );
});
