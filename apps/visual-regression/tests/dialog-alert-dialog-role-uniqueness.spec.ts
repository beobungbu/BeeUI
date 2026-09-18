import { expect, test } from '@playwright/test';

// react-native-web's own `Modal` forces `role="dialog"` + `aria-modal="true"`
// on its own owner node once open, with no prop BeeUI can pass to change it —
// so an `AlertDialog`, which needs the more specific `role="alertdialog"`,
// needs its own correction of that forced value. This proves the real-browser
// DOM shape both `Dialog` and `AlertDialog` produce: `page.getByRole('dialog')`
// (unfiltered) must be a strict-mode-safe single match for an open `Dialog`,
// and an open `AlertDialog` must expose `alertdialog` alone — no `dialog` node
// anywhere in the document while it is open.
test('an open Dialog exposes exactly one [role="dialog"] node and zero [role="alertdialog"] nodes', async ({
  page,
}) => {
  await page.goto('/?scenario=dialog-open', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('an open AlertDialog exposes exactly one [role="alertdialog"] node and zero [role="dialog"] nodes', async ({
  page,
}) => {
  await page.goto('/?scenario=alert-dialog-open', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  await expect(page.locator('[role="alertdialog"]')).toHaveCount(1);
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toBeVisible();
});
