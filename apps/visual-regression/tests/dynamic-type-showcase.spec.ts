import { expect, test, type Locator, type Page } from '@playwright/test';

// BeeUI 1.0 #143 — Dynamic Type / font-scaling contract, real-browser evidence
// (independent review C1, PR #269).
//
// Why this file exists: `apps/showcase/__tests__/dynamic-type-contract.test.tsx`
// stubs `PixelRatio.getFontScale()` under `jest-expo`, but no BeeUI component
// reads that value, so that suite renders an identical tree at every stress
// level — it proves the *policy* (no component forks on font scale, no
// component disables scaling, every fixed-height row is documented) but it
// does not, and cannot, prove that rendered text metrics actually change as
// the OS/browser scales text. This file is the missing piece: it runs a real
// Chromium layout engine (via the existing `apps/visual-regression` Playwright
// harness) against the live Component Gallery build served by
// `scripts/serve-showcase.mjs`, and measures real bounding boxes.
//
// Two independent, honestly-distinguished scaling axes are exercised, per
// `docs/dynamic-type.md`'s corrected model:
//   1. Root font-size override — a stand-in for the OS/browser default
//      text-size preference that `rem`-based semantic typography responds to.
//      This changes `documentElement`'s font-size only.
//   2. CSS `zoom` — Chromium's implementation of real browser page zoom
//      (Cmd/Ctrl +). Page zoom scales *all* CSS px (paddings, borders, gaps),
//      not just `rem`-sized text, which is the distinction #143's independent
//      review required `docs/dynamic-type.md` to state accurately (C3). Using
//      `zoom` here is what makes this page-zoom evidence, not another
//      root-font-size run under a different name.
//
// Coverage matches the review's stated minimum: the two components this issue
// changed (`SelectTrigger`, `PaginationItem` — both switched `h-*` to
// `min-h-*`) and two representative fixed-height exceptions from
// `FIXED_HEIGHT_ALLOWLIST` (`Button`, `Input`, both `h-control-*`).
//
// Evidence class — stated honestly: this is real Chromium/Web layout
// evidence. It does not exercise iOS/Android native text rendering (see
// docs/dynamic-type.md's Evidence section for why a native device/simulator
// pass is SKIPPED for #143) and it does not exercise every component on the
// audited surface — only the four called out by the review as the minimum
// representative set. It also does not, by itself, distinguish `min-h-*`
// from a reverted bare `h-*` on Web (see the inline comment on the
// root-font-size test below for the verified reason why, and why that
// class-level regression proof correctly stays the job of the deterministic
// jest suite instead).

const showcaseBaseUrl = 'http://127.0.0.1:4174';
const BASE_ROOT_FONT_SIZE_PX = 16;
// Mirrors FONT_SCALE_STRESS_LEVELS in apps/showcase/__tests__/helpers/dynamic-type.ts,
// minus the 1x baseline (captured separately, unscaled).
const SCALE_STEPS = [1.3, 1.5, 2] as const;

type TargetName = 'select-trigger' | 'pagination-item' | 'save-button' | 'email-input';

const targets: Record<TargetName, { testId: string; label: string }> = {
  'select-trigger': {
    testId: 'select-showcase-controlled-trigger',
    label: 'SelectTrigger (this issue’s min-h-11 fix)',
  },
  'pagination-item': {
    testId: 'dynamic-type-pagination-item-1',
    label: 'PaginationItem (this issue’s min-h-10 fix)',
  },
  'save-button': {
    testId: 'dynamic-type-save-button',
    label: 'Button size="sm" (representative FIXED_HEIGHT_ALLOWLIST exception)',
  },
  'email-input': {
    testId: 'dynamic-type-email-input',
    label: 'Input (representative FIXED_HEIGHT_ALLOWLIST exception)',
  },
};

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

function locatorFor(page: Page, name: TargetName): Locator {
  return page.locator(`[data-testid="${targets[name].testId}"]`);
}

type Metrics = {
  height: number;
  width: number;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  text: string | null;
};

async function measure(page: Page, name: TargetName): Promise<Metrics> {
  const locator = locatorFor(page, name);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Fixture element missing or not visible: ${targets[name].testId}`);
  const overflow = await locator.evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    text: node.textContent,
  }));
  return { height: box.height, width: box.width, ...overflow };
}

async function setRootFontSize(page: Page, scale: number) {
  await page.evaluate((px) => {
    document.documentElement.style.fontSize = `${px}px`;
  }, BASE_ROOT_FONT_SIZE_PX * scale);
}

async function resetRootFontSize(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
}

async function setPageZoom(page: Page, scale: number) {
  await page.evaluate((zoom) => {
    document.body.style.zoom = String(zoom);
  }, scale);
}

async function resetPageZoom(page: Page) {
  await page.evaluate(() => {
    document.body.style.zoom = '';
  });
}

const GROWABLE_TARGETS: TargetName[] = ['select-trigger', 'pagination-item'];
const FIXED_EXCEPTION_TARGETS: TargetName[] = ['save-button', 'email-input'];
const ALL_TARGETS: TargetName[] = [...GROWABLE_TARGETS, ...FIXED_EXCEPTION_TARGETS];

test.describe('Dynamic Type / font-scaling — real browser evidence (#143 review C1)', () => {
  test('root font-size scaling (OS/browser default text-size proxy): rendered height grows and content is never clipped', async ({ page }) => {
    test.setTimeout(90_000);
    await openComponentGallery(page);

    const baseline: Record<TargetName, Metrics> = {} as Record<TargetName, Metrics>;
    for (const name of ALL_TARGETS) {
      baseline[name] = await measure(page, name);
      // Sanity: the fixture actually renders the expected, non-empty text
      // (email-input has no value/text — it is measured for geometry only).
      if (name !== 'email-input') {
        expect(baseline[name].text?.length ?? 0).toBeGreaterThan(0);
      }
    }

    for (const scale of SCALE_STEPS) {
      await setRootFontSize(page, scale);

      for (const name of ALL_TARGETS) {
        const metrics = await measure(page, name);

        // Real scaled-render proof: rendered height at this scale must
        // actually be taller than the unscaled baseline — a stubbed-but-unread
        // scale value (the jest-expo gap this file exists to close) would
        // leave this identical to baseline.
        expect(metrics.height).toBeGreaterThan(baseline[name].height);

        // No vertical or horizontal clipping at any audited scale: the
        // element's own scrollable content never exceeds its visible box.
        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

        // The full label text is still present (not swapped for an ellipsis
        // or emptied) at every scale.
        if (name !== 'email-input') {
          expect(metrics.text).toBe(baseline[name].text);
        }
      }

      // The two components this issue corrected (`min-h-11`/`min-h-10`) must
      // grow proportionally with the root font-size scale, not merely "some
      // amount" — real evidence that their rendered row height tracks scaled
      // text rather than staying pinned near the unscaled baseline.
      //
      // Honest limitation, verified by hand: this assertion alone does NOT
      // distinguish `min-h-11`/`min-h-10` from a reverted bare `h-11`/`h-10`.
      // Manually reverting both classes and rerunning this exact spec against
      // the rebuilt showcase still passes it, because every BeeUI Web sizing
      // token (`h-*` and `min-h-*` alike) and every semantic typography role
      // resolve through the same `rem`-based theme variables (see
      // `docs/dynamic-type.md`), so a *fixed* `h-11` row's own height scales
      // in lockstep with its text under both the root-font-size and CSS
      // `zoom` axes on Web — and `SelectValue`'s own content never needs a
      // second line (`numberOfLines={1}` by design), so a fixed-height row
      // never gets a chance to fall short of it here. That lockstep-scaling
      // property is a genuine, useful thing to have proven about the Web
      // platform (it is why `docs/dynamic-type.md` says Web scaling is safe
      // by construction as long as sizes stay `rem`-based) — but it also
      // means the `min-h-*` vs `h-*` class distinction this issue's fix
      // encodes is a native-relevant, source-level contract (React Native
      // layout heights are static `dp`/`pt` values that do not themselves
      // grow with OS Dynamic Type the way `rem` grows with root font-size;
      // only `min-height` lets the row's flex layout grow to fit larger
      // scaled text there), which is exactly what the deterministic
      // `fixes SelectTrigger and PaginationItem to grow instead of clipping
      // at scale` test in `dynamic-type-contract.test.tsx` proves by
      // asserting the literal class string — this real-browser test proves a
      // different, complementary thing (actual scaled rendering happens and
      // is never clipped), not a substitute for that class-level guard.
      for (const name of GROWABLE_TARGETS) {
        const metrics = await measure(page, name);
        expect(metrics.height).toBeGreaterThanOrEqual(baseline[name].height * scale * 0.9);
      }

      await resetRootFontSize(page);
    }
  });

  test('CSS zoom scaling (real browser page-zoom evidence, distinct from rem/root-font-size): all four controls scale and remain unclipped', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await openComponentGallery(page);

    const baseline: Record<TargetName, Metrics> = {} as Record<TargetName, Metrics>;
    for (const name of ALL_TARGETS) {
      baseline[name] = await measure(page, name);
    }

    for (const scale of SCALE_STEPS) {
      await setPageZoom(page, scale);

      for (const name of ALL_TARGETS) {
        const metrics = await measure(page, name);

        // Page zoom in Chromium (`zoom`) scales the whole box model — border
        // and padding included, not only `rem`-sized text — which is exactly
        // the corrected docs/dynamic-type.md claim (C3): zoom is a separate,
        // broader browser-level mechanism from rem-based typography, not
        // something rem "makes work". Height is the robust, monotonic proof
        // of that here: it grows at every step for every target. Width is
        // measured but deliberately not asserted to grow monotonically —
        // for a percentage/flex-basis child inside a viewport-width-
        // constrained row (as these fixtures are, at the 390px mobile
        // viewport this project uses), `zoom` recomputes the child's share
        // of its container in the zoomed coordinate space, which can make a
        // full-width row narrower at one zoom step and wider at the next.
        // That non-monotonic width behavior is itself real, honestly-
        // reported evidence that page zoom is not a simple rem/text-only
        // scale-up — it is recorded via the annotation below rather than
        // asserted against, so this test does not overclaim a guarantee the
        // real browser does not provide.
        expect(metrics.height).toBeGreaterThan(baseline[name].height);
        testInfo.annotations.push({
          type: 'zoom-width-sample',
          description: `${name} @ ${scale}x zoom: width ${baseline[name].width.toFixed(1)} -> ${metrics.width.toFixed(1)}px`,
        });

        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

        if (name !== 'email-input') {
          expect(metrics.text).toBe(baseline[name].text);
        }
      }

      await resetPageZoom(page);
    }
  });

  test('SelectValue keeps its documented single-line truncation under real root font-size scaling', async ({ page }) => {
    test.setTimeout(90_000);
    await openComponentGallery(page);

    // Regression companion to the jest-level `numberOfLines={1}` prop
    // assertion in dynamic-type-contract.test.tsx: proves the *rendered* DOM
    // node stays a single visual line (its own content is not vertically
    // wrapped inside itself) as the row around it grows, under a real layout
    // engine, at the top of BeeUI's audited scale range.
    await setRootFontSize(page, 2);
    const value = page.locator('[data-testid="select-showcase-controlled-value"]');
    const box = await value.boundingBox();
    const lineHeight = await value.evaluate((node) =>
      parseFloat(getComputedStyle(node as HTMLElement).lineHeight || '0'),
    );
    expect(box).not.toBeNull();
    // A single line of text renders at (approximately) one line-height tall;
    // multi-line wrap would at least double it. Generous tolerance accounts
    // for engine sub-pixel rounding, not for an actual second line.
    expect(box!.height).toBeLessThan(lineHeight * 1.5);
    await resetRootFontSize(page);
  });
});
