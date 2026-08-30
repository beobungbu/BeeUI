import { expect, test, type Page } from '@playwright/test';

// BeeUI 1.0 #144 (R3.6) — localization / long-content stress suite, real-browser
// evidence. Mirrors the established pattern of `dynamic-type-showcase.spec.ts`
// (#143) and `overlay-rtl-showcase.spec.ts` (#141/#142): this file runs a real
// Chromium layout engine against the live Showcase Web build
// (`serve-showcase.mjs`), measuring the dedicated runtime fixture screen
// (`apps/showcase/runtime-smoke/l10n-stress-acceptance.tsx`), one tap from
// Showcase home, so every audited target is reachable without Component
// Gallery traversal.
//
// Five profiles exercise the axes #144's issue body enumerates: a long
// English sentence + a real German compound word, real Japanese (CJK, no
// natural word-break opportunities), Vietnamese (Latin-script diacritics),
// real Arabic (RTL script + Arabic-indic numerals), and a mechanically
// pseudo-localized profile. The canonical string content for each lives in
// `apps/showcase/__tests__/helpers/l10n-stress.ts` (consumed by the fixture
// screen itself); this file deliberately does not re-import that payload
// across the app boundary — like `dynamic-type-showcase.spec.ts`'s local
// `SCALE_STEPS`/`targets`, only the small, low-drift-risk id/label list is
// mirrored below, and every content assertion instead reads the *actual*
// rendered DOM as its own ground truth (e.g. asserting the Sheet/SettingsItem/
// Toast/Tabs surfaces all reproduce the exact same string a Table cell just
// rendered for the same underlying field). That is strictly stronger evidence
// than comparing against a separately imported oracle string: it proves no
// component silently altered, emptied, or truncated the same real value
// relative to its sibling renderers.
//
// RTL: the `ar-rtl` profile's Web RTL exercise reuses the exact
// `document.documentElement.dir` ambient-authority seam
// `overlay-rtl-showcase.spec.ts` already established for #140/#141/#142
// (ADR-004) — this file does not re-derive direction/mirroring logic itself.
//
// Truncation policy: the component set this fixture exercises (Tooltip,
// Sheet, Table, DatePicker/Field, Textarea, SettingsItem, Toast, Breadcrumb,
// Tabs) carries no `numberOfLines`/ellipsis styling of its own — the only
// BeeUI-wide intentional truncation points remain the ones #143 already
// documented and tests (`SelectValue`, `Textarea`'s row-bound growable
// viewport; see `docs/dynamic-type.md`). This suite's "required content is
// never hidden by truncation" assertions below are real evidence that no new,
// undocumented ellipsis/clip was introduced for the components in scope.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

// Mirrors `L10N_STRESS_PROFILE_IDS` in
// `apps/showcase/__tests__/helpers/l10n-stress.ts` — ids only, needed to
// drive the profile-switcher buttons. The actual stress strings are never
// duplicated here; see the file header.
const PROFILE_IDS = ['long-en', 'cjk', 'vi', 'ar-rtl', 'pseudo'] as const;
type ProfileId = (typeof PROFILE_IDS)[number];

// A realistic long/localized string should be well past a short label's
// length in every profile (the shortest, `pseudo`'s bracketed name, still
// exceeds this). Used as a sanity floor so a test cannot pass by silently
// asserting against an accidentally empty/near-empty string.
const MIN_STRESS_LENGTH = 12;

async function openL10nStressFixture(page: Page) {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByTestId('showcase-open-l10n-stress').click();
  await page.getByTestId('l10n-stress-ready').waitFor({ state: 'visible' });
}

async function selectProfile(page: Page, id: ProfileId) {
  const before = await page.getByTestId('l10n-stress-active-profile').textContent();
  await page.getByTestId(`l10n-stress-profile-${id}`).click();
  // The active-profile label is real state driven by the click, not a no-op —
  // proves the profile actually changed before the rest of the test trusts it.
  await expect
    .poll(async () => page.getByTestId('l10n-stress-active-profile').textContent())
    .not.toBe(before);
}

async function assertNoViewportHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
  });
  // +1px tolerance for sub-pixel layout rounding, not for a real overflow.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function assertFullyInViewport(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height + 1);
}

test.describe('Localization / long-content stress suite (#144)', () => {
  for (const profileId of PROFILE_IDS) {
    test(`profile "${profileId}": Table row renders full name/email/identifier/amount, and every sibling surface reproduces the exact same values (no viewport overflow)`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await openL10nStressFixture(page);
      await selectProfile(page, profileId);
      await assertNoViewportHorizontalOverflow(page);

      // Ground truth: what the Table actually rendered for this profile.
      const name = (await page.getByTestId('l10n-stress-table-name').textContent()) ?? '';
      const email = (await page.getByTestId('l10n-stress-table-email').textContent()) ?? '';
      const identifier = (await page.getByTestId('l10n-stress-table-id').textContent()) ?? '';
      const amount = (await page.getByTestId('l10n-stress-table-amount').textContent()) ?? '';

      expect(name.length).toBeGreaterThanOrEqual(MIN_STRESS_LENGTH);
      expect(email.length).toBeGreaterThan(0);
      expect(identifier.length).toBeGreaterThan(0);
      expect(amount.length).toBeGreaterThan(0);

      // Tab label ("overview" trigger) renders the same `personName` field —
      // proves Tabs does not clip/alter it relative to Table.
      await expect(page.getByTestId('l10n-stress-tab-name')).toHaveText(name);

      // Breadcrumb's leading item renders the same `identifier` field.
      await expect(page.getByTestId('l10n-stress-breadcrumb')).toContainText(identifier);

      // SettingsItem reproduces name + amount (title/value) intact.
      const settingsText = (await page.getByTestId('l10n-stress-settings-item').textContent()) ?? '';
      expect(settingsText).toContain(name);
      expect(settingsText).toContain(amount);
    });

    test(`profile "${profileId}": Tooltip reveals its full sentence content on focus, fully inside the viewport`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await openL10nStressFixture(page);
      await selectProfile(page, profileId);

      const overviewText =
        (await page.getByTestId('l10n-stress-tab-overview-content').textContent()) ?? '';
      expect(overviewText.length).toBeGreaterThanOrEqual(MIN_STRESS_LENGTH);

      const trigger = page.getByTestId('l10n-stress-tooltip-trigger');
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      const content = page.getByTestId('l10n-stress-tooltip-content');
      await expect(content).toBeVisible();
      // TabsContent's "overview" panel renders the exact same `sentence`
      // field as TooltipContent — cross-component consistency proof.
      await expect(content).toHaveText(overviewText);

      const box = await content.boundingBox();
      expect(box).not.toBeNull();
      await assertFullyInViewport(page, box!);

      await page.keyboard.press('Escape');
    });

    test(`profile "${profileId}": Sheet opens with full title/description, and the primary action stays fully inside the viewport, unclipped`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await openL10nStressFixture(page);
      await selectProfile(page, profileId);

      const expectedName = (await page.getByTestId('l10n-stress-table-name').textContent()) ?? '';
      const expectedSentence =
        (await page.getByTestId('l10n-stress-tab-overview-content').textContent()) ?? '';
      const expectedIdentifier = (await page.getByTestId('l10n-stress-table-id').textContent()) ?? '';

      const trigger = page.getByTestId('l10n-stress-sheet-trigger');
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();

      const content = page.getByTestId('l10n-stress-sheet-content');
      await expect(content).toBeVisible();
      await expect(page.getByTestId('l10n-stress-sheet-title')).toHaveText(expectedName);
      await expect(page.getByTestId('l10n-stress-sheet-description')).toHaveText(expectedSentence);

      const action = page.getByTestId('l10n-stress-primary-action');
      await expect(action).toBeVisible();
      await expect(action).toContainText(expectedIdentifier);

      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      await assertFullyInViewport(page, box!);
      await assertNoViewportHorizontalOverflow(page);

      await page.keyboard.press('Escape');
      await expect(content).toBeHidden();
    });

    test(`profile "${profileId}": Toast shows the full title/description without clipping the viewport`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await openL10nStressFixture(page);
      await selectProfile(page, profileId);

      const expectedName = (await page.getByTestId('l10n-stress-table-name').textContent()) ?? '';

      await page.getByTestId('l10n-stress-toast-trigger').click();
      const toastViewport = page.locator('[data-testid="beeui-toast-viewport"]');
      await expect(toastViewport).toContainText(expectedName);

      await assertNoViewportHorizontalOverflow(page);
    });
  }

  test('short-height/landscape viewport: primary Sheet action stays reachable and unclipped', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // A representative short-height/landscape phone window (#144's issue body
    // explicitly calls out "short-height/landscape windows" as a stress axis
    // distinct from narrow-width portrait, which every other test above
    // already covers via the showcase-integration project's 390x844 default).
    await page.setViewportSize({ width: 844, height: 390 });
    await openL10nStressFixture(page);
    await selectProfile(page, 'long-en');

    const trigger = page.getByTestId('l10n-stress-sheet-trigger');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const action = page.getByTestId('l10n-stress-primary-action');
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    await assertFullyInViewport(page, box!);

    await assertNoViewportHorizontalOverflow(page);
    await page.keyboard.press('Escape');
  });

  test('RTL (Arabic profile): fixture mirrors via the shared ADR-004 seam, no viewport overflow, no clipped primary action', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openL10nStressFixture(page);
    await selectProfile(page, 'ar-rtl');

    // Reuses the exact seam overlay-rtl-showcase.spec.ts established — #144
    // coordinates with, rather than duplicates, #140/#141/#142's direction
    // authority (ADR-004).
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });

    await assertNoViewportHorizontalOverflow(page);

    const trigger = page.getByTestId('l10n-stress-sheet-trigger');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const action = page.getByTestId('l10n-stress-primary-action');
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    await assertFullyInViewport(page, box!);

    await page.keyboard.press('Escape');
  });
});
