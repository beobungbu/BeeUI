import { expect, test, type Page } from '@playwright/test';

// BeeUI 1.0 #166 (R4E.3) — real-browser proof of Table's Web semantics and
// keyboard behavior, per ADR-007 ("Platform rendering strategy" — real HTML
// table elements on Web, no ARIA grid). This complements:
//   - `apps/showcase/__tests__/table.test.tsx` (native/default file, RN
//     accessibility props via @testing-library/react-native);
//   - the `component-gallery-table` axe-core scenario
//     (`apps/visual-regression/src/a11y-scenarios.ts`), which proves no
//     serious/critical automatable WCAG violation.
// This file proves what axe cannot: real `<table>`/`<th scope>` markup,
// `aria-sort` state transitions driven by actual clicks/keyboard activation,
// normal-tab-order reachability (no custom roving-tabindex grid), and RTL
// column-order semantics.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

test('renders a real <table> with <th scope="col"> header/cell association', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  const table = scope.getByRole('table');
  await expect(table).toBeVisible();
  expect(await table.evaluate((node) => node.tagName)).toBe('TABLE');

  const nameHeader = scope.getByRole('columnheader', { name: /Name/ });
  expect(await nameHeader.evaluate((node) => node.tagName)).toBe('TH');
  expect(await nameHeader.getAttribute('scope')).toBe('col');
  expect(await nameHeader.getAttribute('aria-sort')).toBe('none');

  const roleHeader = scope.getByRole('columnheader', { name: 'Role' });
  expect(await roleHeader.getAttribute('scope')).toBe('col');

  // First data cell in the "Ada Lovelace" row is a real <td>.
  const firstDataCell = scope.getByRole('cell').first();
  expect(await firstDataCell.evaluate((node) => node.tagName)).toBe('TD');
});

test('does not overstate ARIA grid behavior', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  // ADR-007 non-goal: no custom roving-tabindex grid navigation, so no
  // `role="grid"`/"gridcell" — plain `table`/`row`/`columnheader`/`cell` only.
  const gridCount = await scope.locator('[role="grid"], [role="gridcell"], [role="rowheader"]').count();
  expect(gridCount).toBe(0);
});

test('sort trigger sits in normal tab order right after the header select-all checkbox and real keyboard activation toggles aria-sort and row order', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  const sortButton = scope.getByRole('columnheader', { name: /Name/ }).getByRole('button');
  const nameHeader = scope.getByRole('columnheader', { name: /Name/ });

  // Real, *relative* tab-order proof: seed focus on the preceding interactive
  // control (the header select-all checkbox) and press one real Tab — no
  // fixed/absolute page-load Tab count, which would be brittle against
  // unrelated gallery changes above this section. Landing on the sort
  // trigger proves normal DOM tab order reaches it with no custom
  // roving-tabindex grid interception (ADR-007 non-goal).
  await scope.getByRole('checkbox', { name: 'Select all team members' }).focus();
  await page.keyboard.press('Tab');
  await expect(sortButton).toBeFocused();
  expect(await sortButton.evaluate((node) => node.tagName)).toBe('BUTTON');

  const firstNameCell = () => scope.getByRole('row').nth(1).getByRole('cell').nth(1);
  await expect(firstNameCell()).toHaveText('Ada Lovelace');

  await page.keyboard.press('Enter');
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  await expect(firstNameCell()).toHaveText('Ada Lovelace');

  await page.keyboard.press('Enter');
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(firstNameCell()).toHaveText('Grace Hopper');

  await page.keyboard.press('Enter');
  await expect(nameHeader).toHaveAttribute('aria-sort', 'none');
});

test('sort trigger has a visible keyboard focus indicator', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  const sortButton = scope.getByRole('columnheader', { name: /Name/ }).getByRole('button');

  // Real Tab-driven focus (not `.focus()`): Chromium's `:focus-visible`
  // heuristic is input-modality-aware, so a keyboard-originated focus is
  // required for a faithful proof here — the same reason
  // `high-contrast-focus.spec.ts` drives focus via `page.keyboard.press`.
  await scope.getByRole('checkbox', { name: 'Select all team members' }).focus();
  await page.keyboard.press('Tab');
  await expect(sortButton).toBeFocused();

  const outline = await sortButton.evaluate((node) => {
    const style = getComputedStyle(node);
    return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
  expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
});

test('row selection via a keyboard-operable Checkbox sets aria-selected on the row', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  const adaCheckbox = scope.getByRole('checkbox', { name: 'Select Ada Lovelace' });
  const adaRow = scope.getByRole('row').filter({ has: page.getByText('Ada Lovelace') });

  await expect(adaRow).toHaveAttribute('aria-selected', 'false');

  await adaCheckbox.focus();
  await expect(adaCheckbox).toBeFocused();
  // `Checkbox`'s own established Web keyboard contract activates on Enter
  // (verified directly against the pre-existing, Table-independent "Accept
  // terms" Checkbox elsewhere in this gallery) — Table only has to compose
  // it correctly, not redefine its keyboard contract.
  await page.keyboard.press('Enter');

  await expect(adaRow).toHaveAttribute('aria-selected', 'true');
  await expect(adaCheckbox).toHaveAttribute('aria-checked', 'true');

  // Select-all reflects a mixed state via `aria-checked="mixed"`, not a false
  // "fully selected"/"fully unselected" claim — this is real tri-state proof,
  // not a snapshot of implementation detail.
  const selectAll = scope.getByRole('checkbox', { name: 'Select all team members' });
  await expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

  await page.keyboard.press('Enter');
  await expect(adaRow).toHaveAttribute('aria-selected', 'false');
});

test('embedded row action sits in normal tab order right after its row checkbox, skipping non-interactive cells', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  const editButton = scope.getByRole('button', { name: 'Edit Ada Lovelace' });

  // The Name/Role/Status cells between the row checkbox and the Edit action
  // hold no focusable control, so one real Tab from the checkbox must land
  // directly on the action — proving normal DOM tab order without a focus
  // trap or an unreachable/skipped interactive cell.
  await scope.getByRole('checkbox', { name: 'Select Ada Lovelace' }).focus();
  await page.keyboard.press('Tab');
  await expect(editButton).toBeFocused();
  expect(await editButton.getAttribute('tabindex')).not.toBe('-1');
});

test('layout="stacked" renders a labelled block list, not a <table>', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase-stacked');
  await scope.scrollIntoViewIfNeeded();

  expect(await scope.locator('table').count()).toBe(0);

  // Each value gets its column label inline (ADR-007 responsive strategy) —
  // proves the label/value pairing actually renders, not just that a `<table>`
  // is absent. `TableHeader` itself still mounts (hidden, `display: none`) so
  // its `TableHead` cells keep registering column labels — its own (hidden)
  // "Role" text is first in DOM order, so `.last()` targets a real, visible
  // row's inferred label instead.
  await expect(scope.getByText('Ada Lovelace')).toBeVisible();
  await expect(scope.getByText('Role').last()).toBeVisible();
});

test('RTL: the scroll container adopts dir="rtl" and visually reverses column order', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  // `useDirection()` re-reads the Web ambient authority (`document.
  // documentElement.dir`) on every render but subscribes to nothing (ADR-004
  // "no second global state engine") — the host application is documented to
  // own triggering a re-render when the ambient direction changes. Flipping
  // `dir` and then forcing an unrelated re-render (the theme toggle) is
  // therefore the correct way to exercise this contract, not a workaround.
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await page.getByTestId('component-gallery-theme-toggle').click();

  const table = scope.getByRole('table');
  const rtlWrapper = table.locator('xpath=ancestor::div[@dir="rtl"][1]');
  await expect(rtlWrapper).toHaveCount(1);

  const selectHeader = scope.getByRole('columnheader').first();
  const actionsHeader = scope.getByRole('columnheader').last();
  const selectBox = await selectHeader.boundingBox();
  const actionsBox = await actionsHeader.boundingBox();
  expect(selectBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();

  // "Select" is the first header in DOM order; under RTL a real HTML table
  // renders it visually on the right, past the "Actions" header that is last
  // in DOM order — proving column order follows `useDirection()`, not a
  // hardcoded physical left-to-right assumption.
  expect(selectBox!.x).toBeGreaterThan(actionsBox!.x);
});

test('table text remains visible and unclipped at large root font size (200%-equivalent)', async ({ page }) => {
  await openComponentGallery(page);
  const scope = page.getByTestId('table-showcase');
  await scope.scrollIntoViewIfNeeded();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px'; // 2x the 16px baseline
  });

  const nameHeader = scope.getByRole('columnheader', { name: /Name/ });
  const firstNameCell = scope.getByRole('row').nth(1).getByRole('cell').nth(1);
  await expect(nameHeader).toBeVisible();
  await expect(firstNameCell).toHaveText('Ada Lovelace');

  // The scroll container — not the `<table>` itself — must carry the
  // horizontal-overflow escape hatch (ADR-007 "Responsive mobile strategy"),
  // so a wide table at large text never hides a column instead of scrolling
  // to it.
  const overflowX = await scope.evaluate((node) => {
    const container = node.querySelector('table')?.parentElement;
    return container ? getComputedStyle(container).overflowX : null;
  });
  expect(overflowX).toBe('auto');
});
