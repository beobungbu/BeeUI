import { expect, test, type Locator, type Page } from '@playwright/test';

// #146 (R3.8) — the cross-cutting keyboard/focus acceptance matrix.
//
// Individual component issues already own and test their *local* keyboard
// contract (Select: select-showcase.spec.ts; DatePicker/DateTimePicker:
// date-picker-showcase.spec.ts / date-time-picker-showcase.spec.ts; Table:
// table-showcase.spec.ts; Sheet: sheet-showcase.spec.ts; Tooltip:
// tooltip-fixture.spec.ts). This file is #146's own verification layer: it
// exercises the surfaces that coverage list names but no existing spec
// drives with real keyboard input (Buttons disabled-skip, Forms order/focus-
// visibility, Tabs, DropdownMenu, Dialog, AlertDialog), plus a high-contrast/
// unbranded-focus-visibility check for the two primitives that do not build
// on `Button`/`Input`.
//
// Every interaction below is a real `page.keyboard.press`/`.focus()` +
// keyboard transition — never a synthetic `onKeyDown` prop call — per the
// issue's own DoD ("real keyboard-driven Playwright tests exercise
// transitions rather than `.focus()` shortcuts for behavioral proof"). Two
// genuine, pre-existing keyboard/focus defects surfaced while writing these
// tests and were fixed as part of this change (see `docs/keyboard-focus-
// acceptance-matrix.md` "Findings fixed by this change" for the full
// rationale and evidence):
//   1. `DialogContent`/`AlertDialogContent` did not trap Tab on Web, so a
//      keyboard user could Tab from an open Dialog straight into background
//      page content ("no focus behind overlays").
//   2. `DropdownMenuContent` computed a roving-tabindex "current" item but
//      never moved real DOM focus onto it, so Tab/Arrow keys never reached
//      an open menu at all; the trigger also never regained focus on close.
const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

async function focusVisibleOutline(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
}

test.describe('Buttons — disabled-item skipping in Tab order (#146)', () => {
  test('Tab skips both a disabled Button and a loading Button in one pass', async ({ page }) => {
    await openComponentGallery(page);
    await page.getByRole('button', { name: 'Outline action' }).focus();

    // Document order: Outline action -> Ghost action -> Destructive action ->
    // Disabled action -> Loading action -> Default (Toast). A real keyboard
    // Tab must skip both the disabled and the loading Button.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Ghost action' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Destructive action' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Default' })).toBeFocused();
  });
});

test.describe('Forms — logical order and a real focus indicator (#146)', () => {
  test('Tab reaches the next Input in document order and it carries a real focus indicator', async ({
    page,
  }) => {
    await openComponentGallery(page);
    // Document order: Project name (invalid, enabled) -> Managed field
    // (Field disabled=true) -> Notes (Textarea). A `Field disabled` Input maps
    // to React Native's `editable={false}` (see `input.tsx`), not a real HTML
    // `disabled` attribute — RN has no native web-form "disabled" concept,
    // only "editable". Unlike a disabled Button (a real `<button disabled>`,
    // fully removed from the Tab order — see the Buttons describe block
    // above), a `Field disabled` Input therefore stays a real Tab stop; it is
    // only non-editable. This intentionally differs from Button's contract,
    // matches native iOS/Android accessibility conventions (a read-only text
    // field is still focus-reachable there), and is not a #146 regression —
    // see docs/keyboard-focus-acceptance-matrix.md "Known gaps".
    const managedField = page.getByPlaceholder('Disabled by field context');
    await page.getByPlaceholder('Invalid value').focus();

    await page.keyboard.press('Tab');
    await expect(managedField).toBeFocused();

    const outline = await focusVisibleOutline(managedField);
    expect(outline.style, 'a focused Input must have a visible focus outline').not.toBe('none');
    expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
  });
});

test.describe('Tabs — logical Tab order (#146)', () => {
  test('Tab reaches both TabsTrigger elements in document order and Enter activates the unselected tab', async ({
    page,
  }) => {
    await openComponentGallery(page);
    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    const detailsTab = page.getByRole('tab', { name: 'Details' });

    await overviewTab.focus();
    await expect(page.getByText('Overview content is mounted for the active tab.')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(detailsTab).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByText('Details content is mounted only when selected.')).toBeVisible();
    await expect(page.getByText('Overview content is mounted for the active tab.')).toHaveCount(0);
  });

  test('a keyboard-focused TabsTrigger has a real, non-transparent focus indicator', async ({ page }) => {
    await openComponentGallery(page);
    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    const detailsTab = page.getByRole('tab', { name: 'Details' });

    // Real Shift+Tab-driven focus (not `.focus()`): Chromium's `:focus-visible`
    // heuristic is input-modality-aware, so a keyboard-originated focus
    // transition is required for a faithful proof here — the same reason
    // `table-showcase.spec.ts`'s "sort trigger has a visible keyboard focus
    // indicator" test focuses an adjacent element first, then reaches the
    // real target via a genuine key press.
    await detailsTab.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(overviewTab).toBeFocused();

    const outline = await focusVisibleOutline(overviewTab);
    expect(outline.style, 'TabsTrigger focus outline must be visible, not "none"').not.toBe('none');
    expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('DropdownMenu — real keyboard-driven open/navigate/dismiss (#146)', () => {
  async function openWorkspaceMenu(page: Page) {
    await openComponentGallery(page);
    const trigger = page.getByRole('button', { name: 'Workspace menu' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await menu.waitFor({ state: 'visible' });
    return { menu, trigger };
  }

  test('Enter opens the menu and moves real focus onto the first enabled item, skipping the disabled one', async ({
    page,
  }) => {
    const { menu } = await openWorkspaceMenu(page);
    const editItem = menu.getByRole('menuitem').filter({ hasText: 'Edit project' });
    await expect(editItem).toBeFocused();
  });

  test('ArrowDown cycles only through enabled items, wraps at the end, and Escape restores focus to the trigger', async ({
    page,
  }) => {
    const { menu, trigger } = await openWorkspaceMenu(page);
    const editItem = menu.getByRole('menuitem').filter({ hasText: 'Edit project' });
    const toolbarItem = menu.getByRole('menuitem').filter({ hasText: 'Show toolbar' });
    const compactItem = menu.getByRole('menuitem').filter({ hasText: 'Compact' });
    const comfortableItem = menu.getByRole('menuitem').filter({ hasText: 'Comfortable' });

    // "Archive unavailable" sits between "Edit project" and "Show toolbar" in
    // document order; a real ArrowDown must skip straight past it.
    await page.keyboard.press('ArrowDown');
    await expect(toolbarItem).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(compactItem).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(comfortableItem).toBeFocused();

    // Wraps back to the first enabled item, never landing on the disabled one.
    await page.keyboard.press('ArrowDown');
    await expect(editItem).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('the disabled item never receives focus and Enter activates the focused item', async ({ page }) => {
    const { menu } = await openWorkspaceMenu(page);
    const archiveItem = menu.getByRole('menuitem').filter({ hasText: 'Archive unavailable' });
    await expect(archiveItem).not.toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByText('Last action: Edit project')).toBeVisible();
    await expect(menu).toBeHidden();
  });

  test('a keyboard-focused menu item has a real, non-transparent focus indicator', async ({ page }) => {
    const { menu } = await openWorkspaceMenu(page);
    const editItem = menu.getByRole('menuitem').filter({ hasText: 'Edit project' });
    await expect(editItem).toBeFocused();

    const outline = await focusVisibleOutline(editItem);
    expect(outline.style, 'DropdownMenuItem focus outline must be visible, not "none"').not.toBe('none');
    expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('Dialog — Tab focus-trap, no focus behind the overlay, and focus restoration (#146)', () => {
  async function openDialog(page: Page) {
    await openComponentGallery(page);
    const trigger = page.getByRole('button', { name: 'Open Dialog' });
    await trigger.click();
    // Named, not `.filter({ hasText })`: the modal boundary wrapper
    // (`ModalOverlayHost`'s `accessibilityViewIsModal` View) also resolves to
    // `role="dialog"` on Web and contains this same text, so a text filter
    // matches two elements (a Playwright strict-mode violation). The actual
    // `DialogContent` is the one with the accessible name.
    const dialog = page.getByRole('dialog', { name: 'Project settings' });
    await dialog.waitFor({ state: 'visible' });
    // Readiness contract, not a fixed sleep: the dialog's own dismiss scope
    // (Escape/backdrop routing) and its Web focus-trap both settle slightly
    // after the DOM node itself becomes visible+labelled (mirrors
    // `awaitSettledModalOwners` in `src/a11y-scenarios.ts` for the identical
    // reason — RNW's `Modal` has its own mount/active-transition lifecycle).
    // The trap's own initial-focus move is the concrete, already-proven
    // signal that this settling has completed.
    await expect(dialog.getByRole('textbox')).toBeFocused();
    // `animationType="fade"` (the DialogContent default) still has an
    // in-flight RNW `Modal` entrance transition at this exact point — the
    // DOM node, its role/label, and this trap's own initial focus move can
    // all settle before that transition finishes. A `keydown` dispatched
    // mid-transition is unreliable, so this trailing wait is a concrete,
    // bounded buffer past that transition, not a substitute readiness signal.
    await page.waitForTimeout(250);
    return { dialog, trigger };
  }

  test('opening moves real focus into the dialog instead of leaving it on the trigger', async ({ page }) => {
    const { dialog } = await openDialog(page);
    await expect(dialog.getByRole('textbox')).toBeFocused();
  });

  test('Tab wraps forward within the dialog and never reaches background page content', async ({ page }) => {
    const { dialog } = await openDialog(page);
    const input = dialog.getByRole('textbox');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const save = dialog.getByRole('button', { name: 'Save changes' });

    await expect(input).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(save).toBeFocused();
    // Forward wrap: back to the first focusable element, not to any
    // background trigger (e.g. "Delete project" / "Open Sheet" / "Workspace
    // menu", which sit later in document order behind this modal).
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
  });

  test('Shift+Tab wraps backward within the dialog', async ({ page }) => {
    const { dialog } = await openDialog(page);
    const input = dialog.getByRole('textbox');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const save = dialog.getByRole('button', { name: 'Save changes' });

    await expect(input).toBeFocused();
    // Backward wrap: from the first focusable element to the last.
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(input).toBeFocused();
  });

  test('Escape closes the dialog and restores focus to its trigger', async ({ page }) => {
    const { dialog, trigger } = await openDialog(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('AlertDialog — focus-trap and intentional non-dismissal by Escape (#146)', () => {
  async function openAlertDialog(page: Page) {
    await openComponentGallery(page);
    const trigger = page.getByRole('button', { name: 'Delete project' });
    await trigger.click();
    // See the `openDialog` comment above: named, not `.filter({ hasText })`.
    const alertDialog = page.getByRole('dialog', { name: 'Delete this project?' });
    await alertDialog.waitFor({ state: 'visible' });
    return { alertDialog, trigger };
  }

  test('opening focuses Cancel first (never the destructive action) and Tab wraps between the two actions', async ({
    page,
  }) => {
    const { alertDialog } = await openAlertDialog(page);
    const cancel = alertDialog.getByRole('button', { name: 'Cancel' });
    const destructive = alertDialog.getByRole('button', { name: 'Delete permanently' });

    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(destructive).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
  });

  test('Escape does not dismiss an AlertDialog; explicit Cancel does and restores focus', async ({ page }) => {
    const { alertDialog, trigger } = await openAlertDialog(page);

    // Matches the documented contract (docs/components.md "AlertDialogContent"):
    // backdrop presses never dismiss an AlertDialog. This regression guard
    // proves physical Escape does not accidentally acquire that behavior
    // either — an AlertDialog only closes from an explicit action.
    await page.keyboard.press('Escape');
    await expect(alertDialog).toBeVisible();

    await alertDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(alertDialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
