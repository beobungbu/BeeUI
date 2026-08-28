import { expect, test, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// BeeUI issue #77 — active keyboard-focus visual acceptance for the
// high-contrast themes. A static page-load screenshot never exercises
// `:focus-visible`, so this spec drives real keyboard interaction: it Tabs
// to a Button (on the plain background), an Input (inside a raised Card), or a
// Link (on a muted surface) — the `high-contrast-focus` fixture from
// `apps/visual-regression/App.tsx` — and captures the DOM mid-focus, plus
// asserts the resolved `outline` geometry.
//
// Deliberately NOT part of `visualScenarios`/`visual.spec.ts`'s canonical
// matrix (interactive specs live in their own file the same way
// `motion-reduced.spec.ts` and `data-typography.spec.ts` already do), and
// restricted to `desktop` only — the focus-ring proof does not need a second
// viewport crossing.
//
// One test PER (target, theme): each test takes exactly one screenshot, so a
// baseline mismatch on one target never prevents the others from rendering
// (which matters for regenerating platform-correct baselines on the CI runner).
const focusTargets = [
  // `tabIndex` = how many Tab presses from page load reach this element, in
  // document order (button → input → link).
  { testId: 'focus-target-button', label: 'button', tabPresses: 1, assertBrandedRing: true },
  { testId: 'focus-target-input', label: 'input', tabPresses: 2, assertBrandedRing: true },
  // Link carries no explicit `bee-focus-ring` utility class today, so it is
  // only asserted against the weaker "some visible focus indicator exists"
  // contract, not the exact #77 focus-ring geometry Button/Input opt into.
  { testId: 'focus-target-link', label: 'link', tabPresses: 3, assertBrandedRing: false },
] as const;

for (const theme of ['high-contrast-light', 'high-contrast-dark'] as const) {
  for (const target of focusTargets) {
    test(`Tab-driven keyboard focus is visible on ${target.label} (${theme})`, async ({ page }, testInfo: TestInfo) => {
      const metadata = testInfo.project.metadata as VisualProjectMetadata;
      test.skip(metadata.visualTheme !== theme, `Scoped to the ${theme} project only.`);
      test.skip(
        metadata.visualViewport !== 'desktop',
        'Keyboard-focus geometry does not need a second viewport crossing.',
      );

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/?fixture=high-contrast-focus&theme=${metadata.visualTheme}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

      // Real keyboard interaction — not `.focus()` — so this exercises the same
      // `:focus-visible` path a keyboard user actually triggers.
      for (let press = 0; press < target.tabPresses; press += 1) {
        await page.keyboard.press('Tab');
      }

      const focusedTestId = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? null,
      );
      expect(focusedTestId, `Tab x${target.tabPresses} should land on ${target.testId}`).toBe(target.testId);

      const outline = await page.evaluate((testId) => {
        const element = document.querySelector(`[data-testid="${testId}"]`);
        if (!element) return null;
        const style = getComputedStyle(element);
        return {
          color: style.outlineColor,
          style: style.outlineStyle,
          width: style.outlineWidth,
        };
      }, target.testId);

      expect(outline, `${target.testId} must exist in the DOM`).not.toBeNull();
      expect(outline!.style, `${target.testId} focus outline must be visible, not "none"`).not.toBe('none');
      const outlineWidthPx = Number.parseFloat(outline!.width);
      expect(outlineWidthPx, `${target.testId} focus outline must have non-zero width`).toBeGreaterThan(0);
      expect(
        outline!.color,
        `${target.testId} focus outline must not be fully transparent`,
      ).not.toBe('rgba(0, 0, 0, 0)');

      if (target.assertBrandedRing) {
        // Button/Input opt into the `bee-focus-ring` utility, so they must
        // render #77's exact focus-ring geometry (`focusRing.width` = 2px).
        expect(outline!.width).toBe('2px');
      }

      await expect(page).toHaveScreenshot(
        `high-contrast-focus--${target.label}--${metadata.visualTheme}--${metadata.visualViewport}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          maxDiffPixelRatio: 0.0001,
        },
      );
    });
  }
}
