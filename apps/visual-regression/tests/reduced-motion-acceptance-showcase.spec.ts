import { expect, test, type Page } from '@playwright/test';

// BeeUI issue #149 (R3.11) — cross-cutting reduced-motion acceptance sweep.
//
// Per-component `prefers-reduced-motion: reduce` proof already exists for
// Sheet (`sheet-showcase.spec.ts` "closes under prefers-reduced-motion:
// reduce without breaking dismissal") and Tooltip (`tooltip-showcase.spec.ts`
// "opens and dismisses under prefers-reduced-motion: reduce"). Web token
// generation itself is proven by `motion-reduced.spec.ts`. This file closes
// the remaining gap `docs/accessibility-contract.md` names as open for #149:
// real-browser evidence, against the actual Showcase Component Gallery, that
// Dialog/AlertDialog, Popover, DropdownMenu, Select, DatePicker, and Toast
// each still deliver their essential state change (open/dismiss, focus
// move/restore, selection) when the browser's motion preference is reduced.
//
// Dialog/AlertDialog additionally exercise a genuine fix this change makes:
// `DialogContent` now composes the ambient reduced-motion signal into its
// `animationType` default (`none` instead of `fade`) because React Native
// Web's `Modal`/`ModalAnimation` applies its fade keyframe unconditionally
// otherwise (verified against `react-native-web@0.21.0` source — see
// `dialog.tsx`'s `useReducedMotionPreference` docblock and the deterministic
// contract proof in `issue-149-reduced-motion-acceptance.test.tsx`). Every
// other surface here has no enter/exit transition of its own (verified by
// source inspection: no `Animated` import, no RN core `Modal`, no CSS
// transition class), so this file's job for them is to prove reduced motion
// has nothing to break, the same rationale already stated for Tooltip.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('Dialog opens and dismisses under prefers-reduced-motion: reduce', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'Open Dialog' });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Project settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('AlertDialog opens and its explicit action dismisses it under prefers-reduced-motion: reduce', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'Delete project' });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Delete this project?' });
  await expect(dialog).toBeVisible();

  // AlertDialog never dismisses via Escape by design (destructive
  // confirmation requires an explicit choice) — unaffected by, and not a
  // regression check for, reduced motion. Confirms the essential state
  // change (an explicit action still closes it) still occurs.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Popover opens and dismisses under prefers-reduced-motion: reduce', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'top', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const content = page.getByText('Top placement');
  await expect(content).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('DropdownMenu opens and dismisses under prefers-reduced-motion: reduce', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'Workspace menu' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const item = page.getByRole('menuitem', { name: 'Edit project' });
  await expect(item).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(item).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Select opens and selects from the keyboard under prefers-reduced-motion: reduce', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('select-showcase-placeholder-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await expect(page.getByTestId('select-showcase-placeholder-value')).toHaveText('Choose a role');

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('select-showcase-placeholder-content')).toBeVisible();
  await expect(page.getByTestId('select-showcase-placeholder-designer')).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('select-showcase-placeholder-engineer')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('select-showcase-placeholder-value')).toHaveText('Engineer');
  await expect(trigger).toBeFocused();
});

test('DatePicker opens the Calendar in a Popover and selects a date under prefers-reduced-motion: reduce', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByTestId('date-picker-showcase-controlled-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const focusedDay = page.getByTestId('date-picker-showcase-controlled-calendar-day-2026-01-15');
  await expect(focusedDay).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('date-picker-showcase-controlled-content')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Toast shows its essential content under prefers-reduced-motion: reduce', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  // Toast has no enter/exit transition of its own (`docs/toast.md`) — this
  // proves reduced motion has nothing to break, not a motion-timing
  // boundary, the same rationale already used for Tooltip.
  const trigger = page.getByRole('button', { name: 'Default', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  await expect(page.getByText('Saved')).toBeVisible();
});
