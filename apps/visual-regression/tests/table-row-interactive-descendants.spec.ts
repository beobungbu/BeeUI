import { expect, test, type Page } from '@playwright/test';

// BeeUI #618 (Astra review #2, item 6): `table.web`'s pressable-`TableRow` interactive-
// descendant exclusion selector used to miss most of BeeUI's own interactive roles (radio,
// combobox, tab, option, menuitemcheckbox/radio, slider, spinbutton, textbox, searchbox,
// listbox) — activating one of those inside a pressable row also fired the row's own
// `onPress`. The exclusion reads real ancestor DOM nodes via `Element.closest`, which jsdom
// (`table-web-row-onpress-embedded-action.test.tsx`'s fake-node harness) only approximates —
// this file proves it against a real browser DOM instead. Restricted to one project: this
// behavior is orthogonal to the light/dark/high-contrast appearance axis and the
// mobile/desktop viewport axis, matching `keyboard-roving-focus.spec.ts`'s own precedent for
// interaction-only specs.

async function gotoFixture(page: Page) {
  await page.goto('/?fixture=table-row-interactive-descendants', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

async function rowPressCount(page: Page): Promise<number> {
  const text = await page.getByTestId('interactive-descendants-row-press-count').textContent();
  const match = /Row press count: (\d+)/.exec(text ?? '');
  if (!match) throw new Error(`unexpected row press count text: ${text}`);
  return Number(match[1]);
}

test('activating the embedded Button does not fire the row', async ({ page }) => {
  await gotoFixture(page);
  await expect(page.getByTestId('interactive-descendants-button')).toHaveAttribute('role', 'button');

  await page.getByTestId('interactive-descendants-button').click();

  expect(await rowPressCount(page)).toBe(0);
});

test('activating the embedded Checkbox does not fire the row', async ({ page }) => {
  await gotoFixture(page);
  const checkbox = page.getByRole('checkbox', { name: 'Select row' });
  await expect(checkbox).toHaveAttribute('aria-checked', 'false');

  await checkbox.click();

  await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  expect(await rowPressCount(page)).toBe(0);
});

test('activating the embedded Radio does not fire the row', async ({ page }) => {
  await gotoFixture(page);
  const radio = page.getByRole('radio', { name: 'One' });
  await expect(radio).toHaveAttribute('role', 'radio');

  await radio.click();

  expect(await rowPressCount(page)).toBe(0);
});

test('opening the embedded Select trigger does not fire the row', async ({ page }) => {
  await gotoFixture(page);
  const trigger = page.getByTestId('interactive-descendants-select-trigger');
  await expect(trigger).toHaveAttribute('role', 'combobox');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(await rowPressCount(page)).toBe(0);

  // Picking an option is itself another embedded-interactive activation — proves the
  // listbox option's own `[role="option"]` is excluded too, not just the trigger.
  await page.getByTestId('interactive-descendants-select-beta').click();
  expect(await rowPressCount(page)).toBe(0);
});

test('activating the embedded Link does not fire the row', async ({ page }) => {
  await gotoFixture(page);
  const link = page.getByRole('link', { name: 'Details' });
  await expect(link).toHaveAttribute('role', 'link');

  await link.click();

  expect(await rowPressCount(page)).toBe(0);
});

test('clicking a plain cell with no interactive descendant fires the row', async ({ page }) => {
  await gotoFixture(page);

  await page.getByTestId('interactive-descendants-plain-cell').click();

  expect(await rowPressCount(page)).toBe(1);

  await page.getByTestId('interactive-descendants-plain-cell').click();

  expect(await rowPressCount(page)).toBe(2);
});
