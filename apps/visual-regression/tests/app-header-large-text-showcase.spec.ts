import { expect, test, type Page } from '@playwright/test';

// Regression coverage for #284: AppHeader's leading/trailing columns are
// `shrink-0` (native-Yoga-matching) while the title/description column sits
// at `flex-1 min-w-0` (flex-basis 0%). On RN-Web, once leading + trailing's
// natural (rem-scaling) width exceeds the row width — which happens at ~1.3x
// root font-size on a 390px row — the browser clamps the title column to
// ~0px width. The `<h1>` then wraps one character per line and the header's
// own height balloons (verified: 1.3x -> ~1605px, 2x -> ~3253px on a 390px
// row), squeezing the sibling flex-1 scroll region toward 0 height so
// everything below (incl. BottomActionBar) becomes unreachable.
const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

async function setRootFontScale(page: Page, scale: number) {
  await page.evaluate((px) => {
    document.documentElement.style.fontSize = `${px}px`;
  }, 16 * scale);
}

async function resetRootFontScale(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
}

/**
 * Measures the AppHeader title text width and the AppHeader row height by
 * walking up from the title heading to its nearest ancestor with exactly
 * three children (leading, title/description, trailing) — the AppHeader
 * row's own DOM shape. Component Gallery composes AppHeader with both a
 * `leading` (Back button + Avatar) and a `trailing` (ThemeToggle), which is
 * exactly the shape the verified root cause requires to reproduce.
 */
async function measureAppHeaderRow(page: Page) {
  const title = page.getByRole('heading', { name: 'Component Gallery' });
  return title.evaluate((node: HTMLElement) => {
    let element: HTMLElement | null = node;
    let row: HTMLElement | null = null;
    for (let depth = 0; depth < 10 && element; depth += 1) {
      const parent: HTMLElement | null = element.parentElement;
      if (parent && parent.children.length === 3) {
        row = parent;
        break;
      }
      element = parent;
    }
    if (!row) throw new Error('Could not locate the AppHeader row from its title.');
    return {
      titleWidth: node.getBoundingClientRect().width,
      rowHeight: row.getBoundingClientRect().height,
    };
  });
}

test.describe('AppHeader stays usable at large text on a narrow viewport (#284)', () => {
  test.afterEach(async ({ page }) => {
    await resetRootFontScale(page).catch(() => undefined);
  });

  test('title column never collapses toward 0 width and header height stays a sane multiple of its 1x height at 1.3x-2x root text scale', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openComponentGallery(page);

    const baseline = await measureAppHeaderRow(page);
    // Sanity: the 1x baseline itself must be a real, multi-word-wrapped title,
    // not already degenerate.
    expect(baseline.titleWidth).toBeGreaterThan(50);
    expect(baseline.rowHeight).toBeLessThan(250);

    for (const scale of [1.3, 2]) {
      await setRootFontScale(page, scale);
      const measurement = await measureAppHeaderRow(page);

      // Pre-fix this column clamps to ~0px (observed ~16px, effectively one
      // glyph, at 1.3x on this exact fixture) and the title wraps one
      // character per line. A usable title column must retain real,
      // multi-character wrap width regardless of how much leading/trailing
      // content shares the row.
      expect(measurement.titleWidth).toBeGreaterThan(50);

      // Pre-fix the row height balloons unboundedly with scale (verified
      // ~1605px at 1.3x, ~3253px at 2x on this exact fixture — 9x-19x the 1x
      // height) because the collapsed title wraps one character per line.
      // A bounded fix grows roughly linearly with the text scale instead.
      expect(measurement.rowHeight).toBeLessThan(baseline.rowHeight * 5);
    }
  });

  test('BottomActionBar stays within the initial viewport instead of being pushed off by an exploded AppHeader, at 1.3x-2x root text scale', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openComponentGallery(page);

    // The trailing ThemeToggle sits inside the AppHeader row itself, near the
    // top of the page, so it stays reachable regardless of the header's own
    // height — the guard here is on the row's *width* handling, covered by
    // the width/height test above. Confirm it independently anyway so a
    // trailing-specific regression (e.g. pushed off the row width) is caught
    // too.
    for (const scale of [1.3, 2]) {
      await setRootFontScale(page, scale);
      const themeToggle = page.getByRole('button', { name: /^Theme .* Switch to / });
      await expect(themeToggle).toBeInViewport();
    }
    await resetRootFontScale(page);

    for (const scale of [1.3, 2]) {
      await setRootFontScale(page, scale);

      // BottomActionBar sits in a normal-flow sibling *below* the AppHeader
      // and the flex-1 scroll region, with no fixed/sticky positioning.
      // Pre-fix, AppHeader's exploded height (verified ~1605px at 1.3x,
      // ~3253px at 2x on this exact fixture) pushes it thousands of pixels
      // past the 844px-tall viewport, so a user landing on the page cannot
      // see or reach it without first discovering they need to scroll past
      // the broken header. Asserting an *unscrolled* toBeInViewport() (no
      // scrollIntoViewIfNeeded) is what catches that regression; a bounded
      // header keeps it visible without any scrolling at all.
      const saveChanges = page.getByRole('button', { name: 'Save changes' });
      await expect(saveChanges).toBeInViewport();
      await saveChanges.click();

      const cancel = page.getByRole('button', { name: 'Cancel' });
      await expect(cancel).toBeInViewport();
    }
  });
});
