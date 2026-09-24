import { expect, test, type Page } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

// #571 (rc.2 verification, PARTIAL): a Switch inside a `Field` already gets
// its accessible name via `aria-labelledby`; a Checkbox *list* inside a
// `FormGroup`, however, got no `aria-labelledby`/`aria-describedby` to the
// legend or error, no `aria-invalid`, and no `group` ancestor at all. This
// asserts the real, browser-computed accessible tree for the
// "Assign to stores" FormGroup+Checkbox fixture in the Component Gallery
// (Forms card), not just the literal HTML attribute values.
test('a Checkbox list inside an invalid, required FormGroup gets group role/name/description/invalid', async ({
  page,
}) => {
  await openComponentGallery(page);

  const group = page.getByTestId('stores-form-group');
  await group.scrollIntoViewIfNeeded();

  // Real role/name resolution — proves `role="group"` plus the
  // `aria-labelledby` relationship to the legend actually computes the
  // group's accessible name, not just that the attribute is present.
  const groupByRole = page.getByRole('group', { name: 'Assign to stores' });
  await expect(groupByRole).toHaveCount(1);
  await expect(group).toHaveAttribute('role', 'group');

  // Described by the visible error text (invalid by default: no store is
  // pre-selected in the fixture).
  const describedBy = await group.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const helperText = page.locator(`#${describedBy}`);
  await expect(helperText).toHaveText('Select at least one store.');

  await expect(group).toHaveAttribute('aria-invalid', 'true');

  // Each Checkbox keeps its own accessible name (its own label) — the group
  // relationship must not overwrite/duplicate onto the individual items.
  const storeA = page.getByTestId('stores-checkbox-store-a');
  await expect(storeA).toHaveAttribute('aria-required', 'true');
  await expect(page.getByRole('checkbox', { name: 'Store A' })).toHaveCount(1);

  // Selecting a store clears the invalid state — aria-invalid/aria-describedby
  // reflect the live FormGroup state, not a static snapshot.
  await storeA.click();
  await expect(group).not.toHaveAttribute('aria-invalid');
  await expect(group).not.toHaveAttribute('aria-describedby');
});
