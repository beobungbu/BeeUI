import { densityModes, type DensityMode } from '@beemvp/beeui-tokens';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #169 (R4E.6) — Table production patterns and visual acceptance.
// Renders `apps/visual-regression/App.tsx`'s dedicated `table` fixture: a
// realistic admin/CRM finance-transactions list (long Vietnamese/English
// customer names, large tabular-numeral currency amounts, status badges, two
// embedded per-row actions) in both `layout="scroll"` and `layout="stacked"`.
//
// This spec is deliberately NOT named `*showcase*.spec.ts` so it runs under
// the canonical `visualThemes` x `visualViewports` matrix (see
// `playwright.config.ts`'s `canonicalProjects`), giving real light/dark/
// high-contrast x narrow-phone/desktop screenshot coverage for free — the
// same mechanism `visual.spec.ts` uses for every other first-class scenario.
// Interaction-heavy proof (embedded-action tab order, sort/select keyboard
// behavior) already lives in `table-showcase.spec.ts` (#166) against the
// separate `apps/showcase` component gallery; this spec is the visual/
// production-pattern half (#169), against this app's own deterministic
// fixture.

const financeTransactionIds = [
  'TXN-2026-000482',
  'TXN-2026-000483',
  'TXN-2026-000484',
] as const;

const longVietnameseCustomer = 'Nguyễn Thị Thanh Hương';
const longEnglishCustomer = 'Alexander Bartholomew Worthington-Fitzgerald III';

async function gotoTableFixture(
  page: Page,
  params: Record<string, string>,
) {
  const query = new URLSearchParams(params).toString();
  await page.goto(`/?fixture=table&${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

test.describe('default state — full canonical theme x viewport matrix', () => {
  test('renders both layouts with no overflow/clipping of long names or large amounts', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoTableFixture(page, { theme: metadata.visualTheme });

    // Both responsive presentations render their full row set.
    for (const testId of ['table-production-scroll', 'table-production-stacked']) {
      const section = page.getByTestId(testId);
      await expect(section).toBeVisible();
      for (const transactionId of financeTransactionIds) {
        await expect(section.getByTestId(`transaction-row-${transactionId}`)).toBeVisible();
      }
    }

    // Long Vietnamese/English customer names render in full (not clipped) in
    // both layouts — a real HTML `<table>` has no fixed column width by
    // default, so the scroll layout widens/scrolls instead of truncating.
    const longNameLocators = [longVietnameseCustomer, longEnglishCustomer].flatMap((name) => [
      page.getByTestId('table-production-scroll').getByText(name),
      page.getByTestId('table-production-stacked').getByText(name),
    ]);
    for (const locator of longNameLocators) {
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(box, 'long customer name must have real, non-zero layout geometry').not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
    }

    // Large formatted currency amounts (both VND and USD, including a
    // 7-figure value) render fully, right-aligned via tabular numerals.
    const largeAmount = page.getByTestId('table-production-scroll').getByText(/\$1,234,567\.89/);
    await expect(largeAmount).toBeVisible();

    await expect(page).toHaveScreenshot(
      `table-production--default--${metadata.visualTheme}--${metadata.visualViewport}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.0001,
      },
    );
  });
});

test.describe('density — compact/comfortable/spacious', () => {
  for (const density of densityModes as readonly DensityMode[]) {
    test(`density ${density}`, async ({ page }, testInfo: TestInfo) => {
      const metadata = testInfo.project.metadata as VisualProjectMetadata;
      test.skip(
        metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
        'Density (#74 token axis) is orthogonal to appearance/viewport — one project is sufficient proof.',
      );

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await gotoTableFixture(page, { density, theme: 'light' });

      // `TableRow` (`table.web.tsx`, `layout="scroll"`) intentionally sets no
      // `min-h-density-row-height` on the real `<tr>` it renders — browsers do
      // not reliably honor `min-height` on table-row boxes, so a real
      // `<table>` row's height is left to its cells' own padding instead
      // (ADR-007's native file, by contrast, is a plain flex `View` and does
      // apply the row-height token directly). `layout="stacked"`'s `TableBody`
      // DOES reuse the same `--spacing-density-row-gap` token `ListItem`
      // already proves in `density.spec.ts` (`gap-density-row-gap`, a flex
      // `row-gap`) — that is the real, working density signal to assert here.
      const rowGapPx = await page.evaluate(() => {
        const body = document.querySelector('[data-testid="finance-table-stacked-body"]');
        return body ? Number.parseFloat(getComputedStyle(body as Element).rowGap) : Number.NaN;
      });
      const expectedRowGapPx = { compact: 8, comfortable: 12, spacious: 16 }[density];
      expect(rowGapPx).toBe(expectedRowGapPx);

      await expect(page).toHaveScreenshot(`table-production--density-${density}--light--desktop.png`, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.0001,
      });
    });
  }
});

test.describe('loading / empty / error production states', () => {
  // Both `layout="scroll"` and `layout="stacked"` render the same state, so
  // every assertion below matches twice — `.first()` scopes to "at least one
  // real, visible instance exists" rather than requiring the two layouts to
  // be individually addressed here (their layout-specific rendering is
  // already covered by the default-state test above).
  const stateFixtures = [
    {
      state: 'loading',
      testId: 'table-loading-row',
      assert: async (page: Page) => {
        await expect(page.getByRole('progressbar').first()).toBeVisible();
      },
    },
    {
      state: 'empty',
      testId: 'table-empty-row',
      assert: async (page: Page) => {
        await expect(page.getByText('No transactions found').first()).toBeVisible();
      },
    },
    {
      state: 'error',
      testId: 'table-error-row',
      assert: async (page: Page) => {
        await expect(page.getByText('Something went wrong').first()).toBeVisible();
        await expect(
          page.getByText('We could not load transactions. Please retry.').first(),
        ).toBeVisible();
      },
    },
  ] as const;

  for (const fixture of stateFixtures) {
    test(`${fixture.state} state composes as a single full-width spanning cell`, async (
      { page },
      testInfo: TestInfo,
    ) => {
      const metadata = testInfo.project.metadata as VisualProjectMetadata;
      test.skip(
        metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
        'Request-state composition does not need a full theme/viewport crossing.',
      );

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await gotoTableFixture(page, { state: fixture.state, theme: 'light' });

      await expect(page.getByTestId(fixture.testId).first()).toBeVisible();
      await fixture.assert(page);

      await expect(page).toHaveScreenshot(`table-production--state-${fixture.state}--light--desktop.png`, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.0001,
      });
    });
  }
});

test.describe('RTL', () => {
  test('scroll layout reverses column order under RTL', async ({ page }, testInfo: TestInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'Column-order reversal proof does not need a full theme/viewport crossing.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoTableFixture(page, { dir: 'rtl', theme: 'light' });

    const tableScope = page.getByTestId('finance-table-scroll');
    const table = tableScope.locator('table');
    const rtlWrapper = table.locator('xpath=ancestor::div[@dir="rtl"][1]');
    await expect(rtlWrapper).toHaveCount(1);

    const headers = tableScope.getByRole('columnheader');
    const firstHeaderBox = await headers.first().boundingBox();
    const lastHeaderBox = await headers.last().boundingBox();
    expect(firstHeaderBox).not.toBeNull();
    expect(lastHeaderBox).not.toBeNull();
    // "Transaction" is first in DOM order; under RTL a real HTML table renders
    // it visually on the right, past "Actions" (last in DOM order).
    expect(firstHeaderBox!.x).toBeGreaterThan(lastHeaderBox!.x);

    await expect(page).toHaveScreenshot('table-production--rtl--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});

test.describe('large text (200%-equivalent)', () => {
  test('long customer names and large amounts remain visible and unclipped', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'Large-text overflow proof does not need a full theme/viewport crossing.',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoTableFixture(page, { theme: 'light' });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px'; // 2x the 16px baseline
    });

    await expect(page.getByTestId('table-production-scroll').getByText(longEnglishCustomer)).toBeVisible();

    // The scroll container — not the `<table>` itself — carries the
    // horizontal-overflow escape hatch, so a wide table at large text scrolls
    // to a column instead of clipping it.
    const overflowX = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="finance-table-scroll"] table')?.parentElement;
      return container ? getComputedStyle(container).overflowX : null;
    });
    expect(overflowX).toBe('auto');

    await expect(page).toHaveScreenshot('table-production--large-text--light--desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});

test.describe('large phone / tablet viewport', () => {
  test('renders without horizontal page overflow at a 768px tablet width', async (
    { page },
    testInfo: TestInfo,
  ) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(
      metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
      'This test drives its own explicit viewport size — one project run is sufficient.',
    );

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoTableFixture(page, { theme: 'light' });

    // The page itself never grows a horizontal scrollbar — only the scroll
    // container inside `layout="scroll"` may.
    const documentOverflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(documentOverflowsX).toBe(false);

    await expect(page.getByTestId('table-production-stacked')).toBeVisible();

    await expect(page).toHaveScreenshot('table-production--tablet--light.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.0001,
    });
  });
});
