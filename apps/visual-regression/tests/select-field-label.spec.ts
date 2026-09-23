import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// A Select inside a Field must be that field's control the way an Input is: named by the field
// label through `aria-labelledby` (so `getByLabel(<field label>)` finds exactly the combobox),
// never by its placeholder, with the field's required/invalid state on the combobox itself.
// The fixture renders an Input and three Selects in the same Field layout.

function skipOutsideLightDesktop(testInfo: TestInfo) {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'Accessible-name wiring is orthogonal to theme and viewport — proven once.',
  );
}

async function gotoFixture(page: Page, fixture: string) {
  await page.goto(`/?fixture=${fixture}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

test('getByLabel(<field label>) resolves the Select trigger inside a Field, as it does the Input', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page, 'select-field');

  await expect(page.getByLabel('Tên sản phẩm')).toHaveCount(1);
  await expect(page.getByLabel('Tên sản phẩm')).toHaveAttribute('data-testid', 'field-input');

  const byLabel = page.getByLabel('Cửa hàng nhận');
  await expect(byLabel).toHaveCount(1);
  await expect(byLabel).toHaveAttribute('data-testid', 'field-select-trigger');
  await expect(page.getByRole('combobox', { name: 'Cửa hàng nhận' })).toHaveCount(1);

  const trigger = page.getByTestId('field-select-trigger');
  await expect(trigger).toHaveAttribute('aria-labelledby', 'field-select-label');
  await expect(trigger).toHaveAccessibleName('Cửa hàng nhận');
  // The placeholder is the value shown, not the name.
  await expect(page.getByRole('combobox', { name: 'Chọn cửa hàng' })).toHaveCount(0);
});

test('a Select inside a required Field is required, and one inside an invalid Field is invalid', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page, 'select-field');

  const required = page.getByTestId('field-select-trigger');
  await expect(required).toHaveAttribute('aria-required', 'true');
  await expect(required).not.toHaveAttribute('aria-invalid', /.*/);

  const invalid = page.getByRole('combobox', { name: 'Kho xuất' });
  await expect(invalid).toHaveCount(1);
  await expect(invalid).toHaveAttribute('aria-invalid', 'true');
  await expect(invalid).not.toHaveAttribute('aria-required', /.*/);

  const plain = page.getByRole('combobox', { name: 'Kho nhập' });
  await expect(plain).toHaveCount(1);
  await expect(plain).not.toHaveAttribute('aria-required', /.*/);
  await expect(plain).not.toHaveAttribute('aria-invalid', /.*/);
});

// The Field renders its description/error text without an id and publishes no id for it in its
// context, so no field control (Input included) can point `aria-describedby` at it; the helper
// text only reaches native assistive tech as `accessibilityHint`. Enable once Field exposes the
// helper text's id.
test.fixme('Input and Select inside a Field are described by the field helper text', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page, 'select-field');

  await expect(page.getByTestId('field-input')).toHaveAccessibleDescription('Tên hiển thị trên hóa đơn');
  await expect(page.getByTestId('field-select-trigger')).toHaveAccessibleDescription(
    'Cửa hàng giao hàng cho đơn này',
  );
  await expect(page.getByTestId('field-select-invalid-trigger')).toHaveAccessibleDescription(
    'Chọn một cửa hàng',
  );
});

test('a bare SelectValue shows the built-in placeholder in the Select locale', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page, 'select-minimal-route');

  await expect(page.getByTestId('select-bare-default-value')).toHaveText('Select an option');
  await expect(page.getByTestId('select-bare-vi-value')).toHaveText('Chọn một mục');
  await expect(page.getByTestId('select-bare-vi-trigger')).toHaveAccessibleName('Chọn một mục');
});
