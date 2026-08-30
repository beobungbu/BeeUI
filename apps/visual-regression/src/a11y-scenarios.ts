// #145 — the extension point for the Web accessibility audit gate.
//
// A "scenario" is a named, reachable state of the showcase app that the axe +
// Playwright harness (tests/a11y.spec.ts) scans. To cover a new component or
// pattern later (Tooltip, Sheet, Table, Calendar, a new demo screen, ...),
// append a new entry to `a11yScenarios` below — no other file needs to
// change. `navigate` receives a fresh Playwright `Page` and the showcase
// base URL, and must leave the page on the exact state to be scanned
// (any overlay/dialog/menu opened, any tab/section selected, etc.).
//
// Keep `name` filesystem-safe (kebab-case, no spaces/slashes) — it becomes
// both the JSON report filename (`a11y-report/<name>.json`) and the
// allowlist `scenario` scoping key in `a11y-allowlist.json`.

import type { Page } from '@playwright/test';
import { openScenario } from './showcase-qa-browser';

export type A11yScenario = {
  name: string;
  description: string;
  navigate: (page: Page, baseUrl: string) => Promise<void>;
};

async function openComponentGallery(page: Page, baseUrl: string) {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
}

/**
 * Waits until every modal owner in the DOM has settled into its final ARIA
 * state before axe runs.
 *
 * react-native-web's Modal (0.21.x, `ModalContent`) mounts its owner node
 * with `aria-modal="true"` while `role` is still `null` — the allowed dialog
 * role is only applied once the entrance completes (`active` flips via the
 * `onShow` path). Scanning during that window reports a transient, genuine-
 * looking `aria-allowed-attr` critical violation that no settled DOM ever
 * exhibits (#280's Round 3 real-DOM lifecycle evidence). Waiting for inner
 * dialog *content* text alone does not close that window: content can be
 * visible before the owner's role lands, which is exactly the readiness race
 * that made local vs CI blocking-node counts diverge (34 vs 33).
 *
 * The readiness contract for any overlay scenario is therefore:
 *   1. at least `expectedDialogs` settled `[role="dialog"][aria-modal="true"]`
 *      owners exist; and
 *   2. no `[aria-modal="true"]` node without an allowed dialog/alertdialog
 *      role remains connected.
 * Both are state conditions polled via `waitForFunction` — synchronization on
 * the DOM actually reaching its settled shape, never a fixed sleep, and never
 * an allowlist entry (the transient state is not a false positive to exempt;
 * it is a not-yet-scannable state to wait out).
 */
export async function awaitSettledModalOwners(page: Page, expectedDialogs = 1) {
  await page.waitForFunction((minimum) => {
    const settled = document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
    const unsettled = Array.from(document.querySelectorAll('[aria-modal="true"]')).filter((node) => {
      const role = node.getAttribute('role');
      return role !== 'dialog' && role !== 'alertdialog';
    });
    return settled.length >= minimum && unsettled.length === 0;
  }, expectedDialogs);
}

export const a11yScenarios: A11yScenario[] = [
  {
    name: 'component-gallery',
    description:
      'Component Gallery — representative primitives, forms, status/feedback, and overlay triggers on one page.',
    navigate: openComponentGallery,
  },
  {
    name: 'component-gallery-dialog-overlay',
    description: 'Component Gallery — an open Dialog, representing modal overlay content.',
    navigate: async (page, baseUrl) => {
      await openComponentGallery(page, baseUrl);
      await page.getByRole('button', { name: 'Open Dialog' }).click();
      // Order matters: the settled modal owner is the readiness contract
      // (see awaitSettledModalOwners); the content-text wait afterwards only
      // confirms this is the *expected* dialog, it is not the sync point.
      await awaitSettledModalOwners(page);
      await page.getByText('Project settings', { exact: true }).waitFor({ state: 'visible' });
    },
  },
  {
    name: 'component-gallery-sheet-overlay',
    description:
      'Component Gallery — an open Sheet (#159), BeeUI\'s own Web overlay/focus primitives without a native Modal.',
    navigate: async (page, baseUrl) => {
      await openComponentGallery(page, baseUrl);
      await page.getByTestId('sheet-demo-trigger').click();
      // The Sheet Web implementation sets role="dialog"/aria-modal directly
      // and synchronously (no react-native-web `Modal` owner-lifecycle
      // settling race applies here — see `awaitSettledModalOwners`'s doc
      // comment for why that race exists for RNW `Modal`-based content).
      await page.getByTestId('sheet-demo-content').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'pattern-gallery-dashboard',
    description:
      'Pattern Gallery — Dashboard Overview, a representative composed application screen (non-form).',
    navigate: async (page, baseUrl) => {
      await openScenario(page, baseUrl, {
        domain: 'Dashboard & Finance',
        screen: 'Dashboard Overview',
      });
    },
  },
  {
    name: 'pattern-gallery-sign-in-form',
    description: 'Pattern Gallery — Sign In, a representative form-heavy screen.',
    navigate: async (page, baseUrl) => {
      await openScenario(page, baseUrl, {
        domain: 'Authentication & Onboarding',
        screen: 'Sign In',
      });
    },
  },
  {
    name: 'tooltip-open',
    description:
      'Tooltip fixture (#152) — a focused trigger with its Tooltip revealed, proving role="tooltip"/aria-describedby produce no automatically detectable violation.',
    // `navigate` ignores `baseUrl` (the showcase app, `openComponentGallery`'s
    // target): Tooltip is not yet on the `@beeui/ui` public barrel (ADR-005 —
    // exporting it would break the showcase's iOS/Android Metro bundling
    // before #153 lands `tooltip.native.tsx`), so its real-browser evidence
    // lives in this repo's Web-only `apps/visual-regression` app instead (see
    // `App.tsx`'s `TooltipFixture`). Both dev servers are already started by
    // this project's `webServer` config.
    navigate: async (page) => {
      await page.goto('http://127.0.0.1:4173/?fixture=tooltip', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('tooltip-fixture').waitFor({ state: 'visible' });
      // Focus opens immediately (no delay, ADR-005) — the deterministic way to
      // get `TooltipContent` mounted for the scan without timing dependence.
      await page.getByTestId('tooltip-default-trigger').focus();
      await page.getByRole('tooltip').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'component-gallery-table',
    description:
      'Component Gallery — Table section: a real HTML table with a sortable/selectable header and its `layout="stacked"` presentation.',
    navigate: async (page, baseUrl) => {
      await openComponentGallery(page, baseUrl);
      await page.getByTestId('table-showcase-stacked').scrollIntoViewIfNeeded();
    },
  },
];
