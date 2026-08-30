import { expect, test, type Locator, type Page } from '@playwright/test';

// BeeUI 1.0 #142 (R3.4) — post-#139/#140/#141 RTL component stress matrix.
// #140 already converted the reusable component set to logical start/end
// semantics; #141 already proved the anchored-overlay set (Popover,
// DropdownMenu, Select) mirrors correctly under real Chromium RTL. Several
// of #142's other enumerated components already shipped their own dedicated
// RTL acceptance alongside their own feature work:
//   - Table/DataTable column-order mirroring: `table-showcase.spec.ts`,
//     `table-production.spec.ts` ("RTL" describe blocks).
//   - Calendar navigation-chevron mirroring and ArrowLeft/ArrowRight
//     keyboard mirroring: `calendar-accessibility-showcase.spec.ts`,
//     `date-production.spec.ts` ("RTL" describe block).
//   - Sheet operability under RTL (open/focus/Escape/close):
//     `sheet-showcase.spec.ts`.
//   - Tooltip operability under RTL (open/Escape):
//     `tooltip-showcase.spec.ts`.
//   - Sheet unclipped-primary-action under a real RTL (Arabic) content
//     profile at multiple viewports: `l10n-stress-showcase.spec.ts`.
// This file does not re-derive or duplicate any of that — it closes the
// remaining gap #142's issue body enumerates "beyond overlays": Breadcrumb,
// Pagination, Stepper, Tabs, SegmentedControl, ListItem/SettingsItem,
// AppHeader, forms, and navigation rows (DescriptionItem/MetadataRow) — plus
// DatePicker's own trailing clear/disclosure control, which the existing
// Calendar-focused RTL specs above never exercise (they cover the Calendar
// grid/chevrons, not the DatePicker field trigger row around it).
//
// Same seam as #141/#144 (ADR-004): `document.documentElement.dir = 'rtl'`
// is the single Web ambient-direction authority every BeeUI component reads
// through `useDirection()`.
//
// Named `*-showcase.spec.ts` deliberately, mirroring `overlay-rtl-showcase.
// spec.ts` and `l10n-stress-showcase.spec.ts`: `playwright.config.ts`'s
// `canonicalProjects` ignores any spec whose name contains `showcase`, and
// the dedicated `showcase-integration` project (390x844, light theme) is the
// only project that runs it.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

async function openComponentGallery(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

async function setRtl(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function assertNoViewportHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
  });
  // +1px tolerance for sub-pixel layout rounding, not a real overflow.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

// Reads the resolved physical left/right CSS box-model values directly —
// stronger, pixel-precise evidence than bounding-box arithmetic for proving
// whether a spacing utility is *logical* (mirrors under `dir="rtl"`) or
// merely *physical* (stays on the same side regardless of `dir`).
async function computedSides(locator: Locator, property: 'margin' | 'padding') {
  return locator.evaluate((el, prop) => {
    const style = getComputedStyle(el as HTMLElement);
    return {
      left: parseFloat(style.getPropertyValue(`${prop}-left`)) || 0,
      right: parseFloat(style.getPropertyValue(`${prop}-right`)) || 0,
    };
  }, property);
}

// ---------------------------------------------------------------------------
// Breadcrumb — layout mirroring (matrix: "logical order and alignment").
// breadcrumb.tsx has no per-item direction-specific code; item order relies
// on ordinary flex-row mirroring under the ambient `dir` (ADR-004 "Layout
// mirroring"), which is a live CSS cascade — no re-render is needed for it
// to take effect, unlike a value computed once from `useDirection()` at
// render time (see the AppHeader/DatePicker sections below, where that
// distinction matters).
// ---------------------------------------------------------------------------

test('Breadcrumb items mirror visual order under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const projects = page.getByRole('link', { name: 'Projects' });
  const current = page.getByText('BeeUI', { exact: true }).last();
  await projects.scrollIntoViewIfNeeded();

  const ltrProjects = await box(projects);
  const ltrCurrent = await box(current);
  // LTR: "Projects" (first item) renders left of "BeeUI" (current item).
  expect(ltrProjects.x).toBeLessThan(ltrCurrent.x);

  await setRtl(page);
  await projects.scrollIntoViewIfNeeded();
  const rtlProjects = await box(projects);
  const rtlCurrent = await box(current);
  // RTL: same DOM order, mirrored visual position — "Projects" now renders
  // right of "BeeUI".
  expect(rtlProjects.x).toBeGreaterThan(rtlCurrent.x);
});

// ---------------------------------------------------------------------------
// Pagination — icon direction + interaction order stays coherent (matrix:
// "icons that should mirror do" + "interaction order... remain coherent").
// Previous/next are logical navigation affordances (pagination.tsx); the
// glyphs flip under RTL, and pressing the item labeled "Previous page" must
// still move to the numerically lower page regardless of which visual side
// it now renders on.
// ---------------------------------------------------------------------------

test('Pagination previous/next glyphs mirror and keep their logical (not visual) meaning under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const previous = page.getByRole('button', { name: 'Previous page' });
  const next = page.getByRole('button', { name: 'Next page' });
  await previous.scrollIntoViewIfNeeded();

  const ltrPrevious = await box(previous);
  const ltrNext = await box(next);
  expect(ltrPrevious.x).toBeLessThan(ltrNext.x);

  await setRtl(page);
  await previous.scrollIntoViewIfNeeded();
  const rtlPrevious = await box(previous);
  const rtlNext = await box(next);
  // RTL: same DOM order, mirrored visual position.
  expect(rtlPrevious.x).toBeGreaterThan(rtlNext.x);

  // Page starts at 2 (component-gallery.tsx `useState(2)`). Pressing the
  // item still labeled "Previous page" must move selection to page 1 — the
  // logical action does not change even though it now renders on the visual
  // right. `selected` styling (border-primary/bg-primary,
  // `pagination.tsx`'s `PaginationItem`) is the only DOM-observable proxy
  // for selection here — role="button" does not carry `aria-selected`.
  await previous.click();
  const pageOne = page.getByRole('button', { name: 'Page 1' });
  const pageTwo = page.getByRole('button', { name: 'Page 2' });
  await expect(pageOne).toHaveClass(/bg-primary/);
  await expect(pageTwo).not.toHaveClass(/bg-primary/);
});

// ---------------------------------------------------------------------------
// Stepper — start/end semantics (matrix: "logical order and alignment").
// stepper.tsx has no direction-specific code; its step badge/title row relies
// on ordinary flex-row mirroring under the ambient `dir` (ADR-004 "Layout
// mirroring"). Real evidence that reliance actually holds for this specific
// row, not just the ones #140/#141 already covered.
// ---------------------------------------------------------------------------

test('Stepper step badge and title mirror sides under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  // Step 3 ("Overlays") is the Stepper's current step (`useState(3)` in
  // component-gallery.tsx), so its badge renders the literal digit "3" —
  // steps 1/2 render a "✓" complete-glyph instead, which this test does not
  // need.
  const step = page.getByRole('button', { name: 'Overlays' });
  await step.scrollIntoViewIfNeeded();
  const badge = step.getByText('3', { exact: true });
  const title = step.getByText('Overlays', { exact: true });

  const ltrBadge = await box(badge);
  const ltrTitle = await box(title);
  expect(ltrBadge.x).toBeLessThan(ltrTitle.x);

  await setRtl(page);
  await step.scrollIntoViewIfNeeded();
  const rtlBadge = await box(badge);
  const rtlTitle = await box(title);
  expect(rtlBadge.x).toBeGreaterThan(rtlTitle.x);
});

// ---------------------------------------------------------------------------
// Tabs — layout mirroring (matrix: "logical order and alignment").
// ---------------------------------------------------------------------------

test('TabsTrigger order mirrors visually under RTL while selection stays logical', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const overview = page.getByRole('tab', { name: 'Overview' });
  const details = page.getByRole('tab', { name: 'Details' });
  await overview.scrollIntoViewIfNeeded();

  const ltrOverview = await box(overview);
  const ltrDetails = await box(details);
  expect(ltrOverview.x).toBeLessThan(ltrDetails.x);

  await setRtl(page);
  await overview.scrollIntoViewIfNeeded();
  const rtlOverview = await box(overview);
  const rtlDetails = await box(details);
  expect(rtlOverview.x).toBeGreaterThan(rtlDetails.x);

  // Interaction stays coherent: selecting "Details" under RTL still mounts
  // the Details panel, not Overview's.
  await details.click();
  await expect(page.getByText('Details content is mounted only when selected.')).toBeVisible();
});

// ---------------------------------------------------------------------------
// SegmentedControl — layout mirroring (matrix: "logical order and
// alignment").
// ---------------------------------------------------------------------------

test('SegmentedControl item order mirrors visually under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const list = page.getByRole('radio', { name: 'List' });
  const grid = page.getByRole('radio', { name: 'Grid' });
  await list.scrollIntoViewIfNeeded();

  const ltrList = await box(list);
  const ltrGrid = await box(grid);
  expect(ltrList.x).toBeLessThan(ltrGrid.x);

  await setRtl(page);
  await list.scrollIntoViewIfNeeded();
  const rtlList = await box(list);
  const rtlGrid = await box(grid);
  expect(rtlList.x).toBeGreaterThan(rtlGrid.x);
});

// ---------------------------------------------------------------------------
// ListItem / SettingsItem — start/end semantics (matrix: "logical order").
// The "Profile" row's trailing Badge (list-item.tsx's logical `trailing`
// slot) must swap to the opposite visual side of the title under RTL.
// ---------------------------------------------------------------------------

test('ListItem trailing content mirrors to the opposite side of the title under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  // The row's own accessible name only includes primitive (string/number)
  // trailing content (list-item.tsx's `getPrimitiveAccessibilityLabel`) —
  // the trailing `<Badge>` here is an element, not a primitive, so it is
  // excluded from the computed name. Filtering by literal DOM text content
  // ("Open your profile" — this row's unique description) finds the row
  // reliably instead.
  const row = page.getByRole('button').filter({ hasText: 'Open your profile' });
  await row.scrollIntoViewIfNeeded();
  const title = row.getByText('Profile', { exact: true });
  const trailing = row.getByText('Active', { exact: true });

  const ltrTitle = await box(title);
  const ltrTrailing = await box(trailing);
  expect(ltrTitle.x).toBeLessThan(ltrTrailing.x);

  await setRtl(page);
  await row.scrollIntoViewIfNeeded();
  const rtlTitle = await box(title);
  const rtlTrailing = await box(trailing);
  expect(rtlTitle.x).toBeGreaterThan(rtlTrailing.x);
});

// DescriptionItem/MetadataRow (a "navigation row" pattern shared with
// SettingsItem) — label (start) / value (end) must swap sides under RTL.
test('DescriptionItem label/value row mirrors start/end sides under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const label = page.getByText('Runtime', { exact: true });
  await label.scrollIntoViewIfNeeded();
  const value = page.getByText('React Native 0.86.2', { exact: true });

  const ltrLabel = await box(label);
  const ltrValue = await box(value);
  expect(ltrLabel.x).toBeLessThan(ltrValue.x);

  await setRtl(page);
  await label.scrollIntoViewIfNeeded();
  const rtlLabel = await box(label);
  const rtlValue = await box(value);
  expect(rtlLabel.x).toBeGreaterThan(rtlValue.x);
});

// ---------------------------------------------------------------------------
// AppHeader — layout mirroring + logical margin (matrix: "logical order and
// alignment", "required content is not clipped"). At a narrow viewport the
// header's leading/trailing controls wrap onto their own line; the trailing
// control must stay anchored to its *logical* end (visual left in RTL) by
// the same small margin that anchors it to the visual right in LTR.
// ---------------------------------------------------------------------------

test('AppHeader leading/trailing controls mirror sides under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const back = page.getByTestId('component-gallery-back');
  const themeToggle = page.getByTestId('component-gallery-theme-toggle');
  await back.scrollIntoViewIfNeeded();

  const ltrBack = await box(back);
  const ltrTrailing = await box(themeToggle);
  expect(ltrBack.x).toBeLessThan(ltrTrailing.x);

  await setRtl(page);
  await back.scrollIntoViewIfNeeded();
  const rtlBack = await box(back);
  const rtlTrailing = await box(themeToggle);
  expect(rtlBack.x).toBeGreaterThan(rtlTrailing.x);
});

test('AppHeader trailing control stays anchored to its logical end when wrapped onto its own row under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Narrow enough that the header's leading + min-width title + trailing
  // controls cannot share one row, forcing `flex-wrap` to push the trailing
  // control onto its own line — the only situation where `app-header.tsx`'s
  // wrap-time margin utility (rather than ordinary flex-row main-axis
  // placement) determines the trailing control's side.
  await page.setViewportSize({ width: 320, height: 700 });
  await openComponentGallery(page);

  const back = page.getByTestId('component-gallery-back');
  const themeToggle = page.getByTestId('component-gallery-theme-toggle');
  // `app-header.tsx` wraps `trailing` in a `Box` carrying the wrap-time
  // margin utility — one level above the rendered control itself.
  const trailingWrapper = themeToggle.locator('xpath=..');

  const backBox = await box(back);
  const trailingBox = await box(themeToggle);
  // Confirms the wrap actually happened for this assertion to be meaningful.
  expect(trailingBox.y).toBeGreaterThan(backBox.y + backBox.height / 2);

  // `margin-inline-start: auto` on the wrapper absorbs the wrapped row's
  // remaining space on the trailing control's *logical start* side, which
  // is what keeps it anchored to its logical end. In LTR that resolves to a
  // large `margin-left` and a ~zero `margin-right`.
  const ltrMargin = await computedSides(trailingWrapper, 'margin');
  expect(ltrMargin.left).toBeGreaterThan(20);
  expect(ltrMargin.right).toBeLessThanOrEqual(1);

  await setRtl(page);
  const rtlTrailingBox = await box(themeToggle);
  expect(rtlTrailingBox.y).toBeGreaterThan((await box(back)).y + backBox.height / 2);

  // Under RTL, "inline start" resolves to the physical right — a genuinely
  // logical margin mirrors to a large `margin-right` and a ~zero
  // `margin-left`. A physical (not logical) margin utility would leave
  // `margin-left` unchanged from the LTR reading instead.
  const rtlMargin = await computedSides(trailingWrapper, 'margin');
  expect(rtlMargin.right).toBeGreaterThan(20);
  expect(rtlMargin.left).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// DatePicker trailing control — logical spacing (matrix: "required content
// is not clipped" / logical padding-margin). The clear button and the
// disclosure chevron are the trailing-most sibling of the trigger row; the
// small gap that separates each from the *outer* edge under LTR must track
// the same logical end under RTL (the now-mirrored visual left), not stay
// pinned to the physical right.
// ---------------------------------------------------------------------------

test('DatePicker clear-button trailing margin tracks the logical end under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const clear = page.getByTestId('date-picker-showcase-controlled-clear');
  await clear.scrollIntoViewIfNeeded();

  // `margin-inline-end` on the clear IconButton separates it from the
  // container's own trailing edge — in LTR that resolves to `margin-right`.
  const ltrMargin = await computedSides(clear, 'margin');
  expect(ltrMargin.right).toBeGreaterThan(1);
  expect(ltrMargin.left).toBeLessThanOrEqual(1);

  await setRtl(page);
  await clear.scrollIntoViewIfNeeded();
  // Under RTL, "inline end" resolves to the physical left — a genuinely
  // logical margin mirrors to `margin-left`. A physical (not logical)
  // margin utility would leave `margin-right` unchanged instead.
  const rtlMargin = await computedSides(clear, 'margin');
  expect(rtlMargin.left).toBeGreaterThan(1);
  expect(rtlMargin.right).toBeLessThanOrEqual(1);
});

test('DatePicker disclosure chevron trailing padding tracks the logical end under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const container = page.getByTestId('date-picker-showcase-field');
  const chevron = container.getByText('⌄', { exact: true });
  // The `pe-3` padding lives on the chevron's wrapping `View`
  // (`date-picker.web.tsx`), not the `Text` glyph itself — react-native-web
  // renders `Text` with `dir="auto"`, which lets the browser resolve that
  // one node's own direction from its (directionless glyph) content instead
  // of inheriting the ambient direction, defeating a logical padding
  // property applied directly to it. `View` carries no such attribute.
  const chevronWrapper = chevron.locator('xpath=..');
  await chevron.scrollIntoViewIfNeeded();

  // `padding-inline-end` insets the chevron glyph from the container's own
  // trailing edge — in LTR that resolves to `padding-right`.
  const ltrPadding = await computedSides(chevronWrapper, 'padding');
  expect(ltrPadding.right).toBeGreaterThan(1);
  expect(ltrPadding.left).toBeLessThanOrEqual(1);

  await setRtl(page);
  await chevron.scrollIntoViewIfNeeded();
  // Under RTL, "inline end" resolves to the physical left — a genuinely
  // logical padding mirrors to `padding-left`. A physical (not logical)
  // padding utility, or one applied to a `dir="auto"` text node whose
  // content has no strong bidi character, would leave `padding-right`
  // unchanged instead.
  const rtlPadding = await computedSides(chevronWrapper, 'padding');
  expect(rtlPadding.left).toBeGreaterThan(1);
  expect(rtlPadding.right).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Whole-gallery sweep — no viewport-level direction overflow (issue #142's
// explicit DoD: "no viewport-level direction overflow blocker").
// ---------------------------------------------------------------------------

test('Component Gallery has no horizontal viewport overflow at a narrow RTL viewport', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 700 });
  await openComponentGallery(page);
  await setRtl(page);
  await assertNoViewportHorizontalOverflow(page);
});
