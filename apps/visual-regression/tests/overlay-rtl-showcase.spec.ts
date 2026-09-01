import { expect, test, type Page } from '@playwright/test';

// BeeUI 1.0 #141 (R3.3) — real-browser RTL acceptance for the anchored-overlay
// set (Popover, DropdownMenu, Select, Tooltip). ADR-004 already established the
// single direction resolver and the core `resolveAnchoredOverlayPosition()`
// align-flip math already has deterministic pure-function coverage
// (`apps/showcase/__tests__/issue-17-anchored-overlay-geometry.test.ts`), and
// `issue-141-rtl-overlay-acceptance.test.tsx` closes the "does each component
// actually call the shared resolver" gap deterministically. What was still
// missing before this file: proof, against the real Chromium-rendered Showcase
// Component Gallery, that setting `document.documentElement.dir = 'rtl'` (the
// Web ambient authority ADR-004 reads) actually produces mirrored/collision-safe
// overlay geometry end to end — start/end alignment, physical (non-mirrored)
// placement, collision at viewport edges, long labels, a non-zero modal-local
// host origin, directional-icon ordering, nested Dialog dismiss scope, and
// keyboard/Escape operability. This file is Chromium/Web-only real-browser
// interaction evidence (docs/beeui-1.0-evidence-classes.md); it does not stand
// in for native iOS/Android runtime evidence.
//
// Named `*-showcase.spec.ts` deliberately: `playwright.config.ts`'s
// `canonicalProjects` ignores any spec whose name contains `showcase`, and the
// dedicated `showcase-integration` project (390x844, light theme) is the only
// project that runs it — exactly like `tooltip-showcase.spec.ts`,
// `sheet-showcase.spec.ts`, and `select-showcase.spec.ts` already do. Running
// this file under the 12 canonical visual-theme/viewport screenshot projects
// would be redundant (this file asserts real interaction/geometry, not pixels)
// and would multiply its runtime for no new evidence.

const showcaseBaseUrl = 'http://127.0.0.1:4174';
const EPSILON = 3;

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

// #403 — same fix as `overlay-context.spec.ts`'s `waitForDialogFocusTrapSettled`
// (duplicated here rather than shared, matching this file's existing
// self-contained `openComponentGallery`/`showcaseBaseUrl` convention). Dialog's
// own focus trap (`useDialogFocusTrap` in `packages/ui/src/components/
// dialog.tsx`) moves focus to the panel's first focusable descendant on a
// deferred `setTimeout(0)` after the Dialog opens. A test that clicks the
// Dialog trigger and then immediately `.focus()`es a different element inside
// the panel (the nested Tooltip trigger, below) races that deferred steal: if
// the timer fires after the explicit `.focus()` call lands, it silently moves
// focus back off the Tooltip trigger, closing the Tooltip before the
// assertion observes it open. Reproduced here at 10/20 failures with
// `--repeat-each=20` (higher than the LTR case because the extra `setRtl`
// `page.evaluate()` round trip shifts the race window). Waiting for the
// trap's own initial focus target to land inside the dialog panel first
// fully resolves it without an arbitrary sleep.
async function waitForDialogFocusTrapSettled(page: Page, dialogAccessibleName: string) {
  await expect(
    page.getByRole('dialog', { name: dialogAccessibleName }).locator(':focus'),
  ).toHaveCount(1);
}

// ---------------------------------------------------------------------------
// Start/end alignment mirrors direction (matrix: "start/end alignment").
// ---------------------------------------------------------------------------

test('DropdownMenu content (align="start") mirrors alignment to the anchor edge across LTR and RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'Workspace menu' });
  await trigger.scrollIntoViewIfNeeded();
  const menu = page.getByRole('menu');

  await trigger.click();
  await expect(menu).toBeVisible();
  const ltrTrigger = await trigger.boundingBox();
  const ltrMenu = await menu.boundingBox();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await setRtl(page);
  await trigger.click();
  await expect(menu).toBeVisible();
  const rtlTrigger = await trigger.boundingBox();
  const rtlMenu = await menu.boundingBox();

  expect(ltrTrigger).not.toBeNull();
  expect(ltrMenu).not.toBeNull();
  expect(rtlTrigger).not.toBeNull();
  expect(rtlMenu).not.toBeNull();

  // LTR: align="start" aligns the content's leading (left) edge to the anchor's
  // left edge.
  expect(Math.abs(ltrMenu!.x - ltrTrigger!.x)).toBeLessThanOrEqual(EPSILON);
  // RTL: "start" is now the anchor's right edge — the content's right edge
  // aligns with the anchor's right edge instead.
  const rtlContentRight = rtlMenu!.x + rtlMenu!.width;
  const rtlTriggerRight = rtlTrigger!.x + rtlTrigger!.width;
  expect(Math.abs(rtlContentRight - rtlTriggerRight)).toBeLessThanOrEqual(EPSILON);
  // The two placements are genuinely different positions, not a coincidence.
  expect(Math.abs(ltrMenu!.x - rtlMenu!.x)).toBeGreaterThan(EPSILON);
});

test('Popover content (align="start") mirrors alignment to the anchor edge across LTR and RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // A wide viewport keeps this Popover's content (max-w-sm, ~384px) from
  // colliding with the showcase-integration project's narrower default
  // (390px), which would otherwise force a collision shift and conflate this
  // alignment assertion with the separately covered collision behavior below.
  await page.setViewportSize({ width: 1280, height: 800 });
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'Open parent' });
  await trigger.scrollIntoViewIfNeeded();
  const dialog = page.getByRole('dialog', { name: 'Parent Popover' });

  await trigger.click();
  await expect(dialog).toBeVisible();
  const ltrTrigger = await trigger.boundingBox();
  const ltrDialog = await dialog.boundingBox();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await setRtl(page);
  await trigger.click();
  await expect(dialog).toBeVisible();
  const rtlTrigger = await trigger.boundingBox();
  const rtlDialog = await dialog.boundingBox();

  expect(ltrTrigger).not.toBeNull();
  expect(ltrDialog).not.toBeNull();
  expect(rtlTrigger).not.toBeNull();
  expect(rtlDialog).not.toBeNull();

  expect(Math.abs(ltrDialog!.x - ltrTrigger!.x)).toBeLessThanOrEqual(EPSILON);
  const rtlContentRight = rtlDialog!.x + rtlDialog!.width;
  const rtlTriggerRight = rtlTrigger!.x + rtlTrigger!.width;
  expect(Math.abs(rtlContentRight - rtlTriggerRight)).toBeLessThanOrEqual(EPSILON);
  expect(Math.abs(ltrDialog!.x - rtlDialog!.x)).toBeGreaterThan(EPSILON);
});

// ---------------------------------------------------------------------------
// Physical placement is never mirrored by direction (ADR-004: "physical
// placement, logical alignment" — matrix: "placement/flip/shift/collision").
// ---------------------------------------------------------------------------

test('Popover left/right placement stays on its physical side under both LTR and RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // A wide viewport keeps these placements from colliding and flipping at the
  // showcase-integration project's narrower default — collision/flip behavior
  // itself is covered separately below; this test isolates whether RTL wrongly
  // mirrors a physical `left`/`right` placement, per ADR-004. 2000px is wide
  // enough that even after the surrounding HStack's own (correct, unrelated)
  // CSS flex-row reordering under `dir="rtl"` repositions each trigger, none
  // of the triggers land close enough to either viewport edge to trigger a
  // genuine collision flip — this keeps the assertion isolated to placement
  // mirroring, not layout-reordering collision.
  await page.setViewportSize({ width: 2000, height: 900 });
  await openComponentGallery(page);

  async function assertPhysicalSide(side: 'left' | 'right') {
    const trigger = page.getByRole('button', { name: side, exact: true });
    await trigger.scrollIntoViewIfNeeded();
    const label = `${side[0].toUpperCase()}${side.slice(1)} placement`;
    const dialog = page.getByRole('dialog', { name: label });

    await trigger.click();
    await expect(dialog).toBeVisible();
    const triggerBox = await trigger.boundingBox();
    const dialogBox = await dialog.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();

    if (side === 'left') {
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(triggerBox!.x + EPSILON);
    } else {
      expect(dialogBox!.x).toBeGreaterThanOrEqual(triggerBox!.x + triggerBox!.width - EPSILON);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }

  await assertPhysicalSide('left');
  await assertPhysicalSide('right');

  await setRtl(page);

  await assertPhysicalSide('left');
  await assertPhysicalSide('right');
});

// ---------------------------------------------------------------------------
// Collision handling stays inside the viewport under RTL (matrix: "viewport
// edges" and "placement/flip/shift/collision").
// ---------------------------------------------------------------------------

test('Popover collision handling keeps content inside the viewport at a narrow RTL viewport', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 400, height: 800 });
  await openComponentGallery(page);
  await setRtl(page);

  const trigger = page.getByRole('button', { name: 'Near right edge' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Collision-aware placement' });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(400);
  expect(box!.y).toBeGreaterThanOrEqual(0);
});

// ---------------------------------------------------------------------------
// Long labels stay collision-safe under RTL (matrix: "long labels").
// ---------------------------------------------------------------------------

test('Select with a long option label stays collision-safe at a narrow RTL viewport', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await openComponentGallery(page);
  await setRtl(page);

  const trigger = page.getByTestId('select-showcase-narrow-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const content = page.getByTestId('select-showcase-narrow-content');
  await expect(
    content.getByText('A long option label that must truncate safely in a narrow layout'),
  ).toBeVisible();

  const contentBox = await content.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(contentBox!.x).toBeGreaterThanOrEqual(0);
  expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(320);
  expect(contentBox!.y).toBeGreaterThanOrEqual(0);
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(640);
});

// ---------------------------------------------------------------------------
// A non-zero (Dialog modal-local) host origin still positions content relative
// to the real anchor under RTL, not the top-level window origin (matrix:
// "non-zero host origins").
// ---------------------------------------------------------------------------

test('Dialog-nested Select aligns to its trigger inside the modal-local host under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await setRtl(page);

  const dialogTrigger = page.getByTestId('select-showcase-dialog-trigger');
  await dialogTrigger.scrollIntoViewIfNeeded();
  await dialogTrigger.click();

  const trigger = page.getByTestId('select-showcase-dialog-select-trigger');
  await trigger.click();
  const content = page.getByTestId('select-showcase-dialog-select-content');
  await expect(content).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const contentBox = await content.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();

  // align="start" default under RTL aligns the content's right edge to the
  // trigger's right edge. If the modal-local host's own (non-zero) origin were
  // dropped from the position math, this would drift far outside this bound.
  const contentRight = contentBox!.x + contentBox!.width;
  const triggerRight = triggerBox!.x + triggerBox!.width;
  expect(Math.abs(contentRight - triggerRight)).toBeLessThanOrEqual(EPSILON);
  expect(contentBox!.x).toBeGreaterThanOrEqual(0);
});

// ---------------------------------------------------------------------------
// Nested Dialog dismiss scope is direction-agnostic (matrix: "nested Dialog
// scope" and "keyboard/Escape/back behavior").
// ---------------------------------------------------------------------------

test('Escape dismisses a dialog-nested Select before a root Select behind the Dialog under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await setRtl(page);

  const open = page.getByTestId('select-showcase-scope-open');
  await open.scrollIntoViewIfNeeded();
  await open.click();

  const rootTrigger = page.getByTestId('select-showcase-scope-root-trigger');
  const childTrigger = page.getByTestId('select-showcase-scope-child-trigger');
  await expect(rootTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(childTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('select-showcase-scope-child-content')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(childTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('select-showcase-scope-child-content')).toBeHidden();
  await expect(rootTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('select-showcase-scope-dialog-title')).toBeVisible();
});

test('Web Escape under RTL is scope-aware: closes a dialog-nested Tooltip, Dialog stays open', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await setRtl(page);

  await page.getByTestId('overlay-context-dialog-trigger').click();
  await waitForDialogFocusTrapSettled(page, 'Dialog with a nested overlay');
  await page.getByTestId('overlay-context-dialog-tooltip-trigger').focus();
  await expect(page.getByTestId('overlay-context-dialog-tooltip-value')).toHaveText(
    'context: preserved',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-context-dialog-tooltip-value')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-tooltip-trigger')).toBeVisible();
});

test('Web Escape under RTL is scope-aware: closes a dialog-nested DropdownMenu, Dialog stays open', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await setRtl(page);

  await page.getByTestId('overlay-context-dialog-trigger').click();
  await page.getByTestId('overlay-context-dialog-menu-trigger').click();
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveText(
    'context: preserved',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-context-dialog-menu-value')).toHaveCount(0);
  await expect(page.getByTestId('overlay-context-dialog-menu-trigger')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Directional-icon ordering mirrors direction (matrix: "directional icons").
// The checkbox glyph is a leading indicator laid out with a plain CSS
// `flex-row` (`dropdown-menu.tsx`'s `DropdownMenuCheckboxItem` className) —
// this proves the overlay's portalled content actually inherits the
// document's `dir` (browser flex-row reversal), not just that the resolver
// returns 'rtl' in isolation.
// ---------------------------------------------------------------------------

test('DropdownMenu checkbox indicator renders on the opposite side of its label under RTL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);

  const trigger = page.getByRole('button', { name: 'Workspace menu' });
  await trigger.scrollIntoViewIfNeeded();
  const menu = page.getByRole('menu');
  const label = menu.getByText('Show toolbar');
  const glyph = menu.getByText('✓', { exact: true });

  await trigger.click();
  await expect(menu).toBeVisible();
  const ltrLabel = await label.boundingBox();
  const ltrGlyph = await glyph.boundingBox();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await setRtl(page);
  await trigger.click();
  await expect(menu).toBeVisible();
  const rtlLabel = await label.boundingBox();
  const rtlGlyph = await glyph.boundingBox();

  expect(ltrLabel).not.toBeNull();
  expect(ltrGlyph).not.toBeNull();
  expect(rtlLabel).not.toBeNull();
  expect(rtlGlyph).not.toBeNull();

  // LTR: the checkmark is the first flex-row child, visually left of the label.
  expect(ltrGlyph!.x).toBeLessThan(ltrLabel!.x);
  // RTL: the same DOM order now renders visually on the right of the label.
  expect(rtlGlyph!.x).toBeGreaterThan(rtlLabel!.x);
});

// ---------------------------------------------------------------------------
// Keyboard navigation and Escape remain fully operable under RTL (matrix:
// "keyboard/Escape/back behavior").
// ---------------------------------------------------------------------------

test('DropdownMenu keyboard navigation and Escape remain operable under RTL', async ({ page }) => {
  test.setTimeout(90_000);
  await openComponentGallery(page);
  await setRtl(page);

  const trigger = page.getByRole('button', { name: 'Workspace menu' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();

  // Opening moves roving-tabindex focus onto the first enabled item
  // immediately (#146's real-Web-keyboard-reachability contract) — no initial
  // ArrowDown is needed.
  await expect(page.getByRole('menuitem', { name: 'Edit project' })).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Show toolbar' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});
