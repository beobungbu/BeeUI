import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI 1.0 #154 (R4A.4) — high-contrast content-visibility evidence for
// Tooltip. Kept in its own file (not appended to `tooltip-fixture.spec.ts`,
// which gates every test in that file to the `light`/`desktop` project via a
// file-level `beforeEach`, since #152's interaction/delay proofs only need to
// run once) so this orthogonal per-theme concern gets its own per-project
// gating instead of being silently skipped everywhere by that unrelated gate.
//
// Unlike the Showcase app (`tooltip-showcase.spec.ts`), this fixture app
// already reads a `?theme=` query param into `Uniwind.setTheme`
// (`App.tsx`'s `useVisualReadiness`), so it is the right place for a
// per-high-contrast-theme real-browser check — the same reason
// `high-contrast-focus.spec.ts` uses its own dedicated fixture rather than
// the Showcase app.
for (const theme of ['high-contrast-light', 'high-contrast-dark'] as const) {
  test(`Tooltip content border/background remain non-transparent under ${theme}`, async ({
    page,
  }, testInfo: TestInfo) => {
    const metadata = testInfo.project.metadata as VisualProjectMetadata;
    test.skip(metadata.visualTheme !== theme, `Scoped to the ${theme} project only.`);
    test.skip(
      metadata.visualViewport !== 'desktop',
      'Theme contrast does not need a second viewport crossing.',
    );

    await page.goto(`http://127.0.0.1:4173/?fixture=tooltip&theme=${theme}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

    const trigger = page.getByTestId('tooltip-default-trigger');
    const content = page.getByTestId('tooltip-default-content');
    await trigger.focus();
    await expect(content).toBeVisible();

    const style = await content.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { backgroundColor: computed.backgroundColor, borderColor: computed.borderColor };
    });
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  });
}
