import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// Root cause (see plans/260918-1559-consumer-audit-fix-all/reports/ws-e-report.md
// section 6): `scripts/generate-tokens.mjs` used to emit every brand/appearance
// block nested inside a single top-level `:root { }` wrapper in
// `packages/tokens/src/theme.css`. Tailwind compiled that to
// `:root:where(.violet-dark, .violet-dark *)`, which can only ever match the
// document's actual `<html>` element — a `BeeThemeScope`-applied class on a
// nested element could never satisfy it, so neither a semantic utility
// (`bg-primary`) nor `useBeeToken` ever saw the scoped value on Web.
//
// Drives the dedicated `theme-scope-tokens` fixture (global reader, a Violet
// scope at the opposite appearance, and a Violet scope nested inside that at
// the global's own appearance — `apps/visual-regression/App.tsx`'s
// `ThemeScopeTokensFixture`) at `light` only: brand/appearance scoping itself
// is orthogonal to the light/dark/high-contrast appearance axis the canonical
// scenarios already cover, matching `scoped-preview.spec.ts`'s own rationale.
test('BeeThemeScope scopes semantic CSS variables and useBeeToken on Web', async ({ page }, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light',
    'Theme-scope CSS/token scoping is proven once, at light — the appearance axis is covered elsewhere.',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?fixture=theme-scope-tokens&theme=${metadata.visualTheme}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

  const readerIds = ['theme-scope-tokens-global', 'theme-scope-tokens-scoped', 'theme-scope-tokens-nested'];

  // #552 — a real computed `bg-primary` background must differ between the
  // global reader, the Violet scope, and the Violet scope nested inside it:
  // three distinct runtime themes (the fixture's global theme, and Violet at
  // each of the two appearances), three distinct computed colors.
  const backgrounds = await Promise.all(
    readerIds.map((testId) =>
      page.getByTestId(testId).evaluate((node) => getComputedStyle(node).backgroundColor),
    ),
  );
  expect(new Set(backgrounds).size).toBe(backgrounds.length);

  // #550 — `useBeeToken('colors.primary')`, rendered as visible text by each
  // reader, must resolve the nearest `BeeThemeScope` the same way: three
  // distinct values, not the global value leaking into the scoped/nested
  // readers.
  const tokenTexts = await Promise.all(
    readerIds.map((testId) => page.getByTestId(`${testId}-token-primary`).innerText()),
  );
  expect(tokenTexts.every((text) => text.length > 0)).toBe(true);
  expect(new Set(tokenTexts).size).toBe(tokenTexts.length);

  // The DOM-computed `bg-primary` swatch and the `useBeeToken` text readout
  // must agree with each other on every reader — proving #550 and #552 share
  // the same underlying scoped CSS-variable value, not two independently
  // "correct" but disagreeing mechanisms.
  for (let index = 0; index < readerIds.length; index += 1) {
    const [r, g, b] = backgrounds[index].match(/\d+/g)!.map(Number);
    const tokenHex = tokenTexts[index].trim().toLowerCase();
    expect(tokenHex).toMatch(/^#[0-9a-f]{6}$/);
    const tokenRgb = [1, 3, 5].map((offset) => Number.parseInt(tokenHex.slice(offset, offset + 2), 16));
    expect([r, g, b]).toEqual(tokenRgb);
  }
});
