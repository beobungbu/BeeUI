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
      await page.getByText('Project settings', { exact: true }).waitFor({ state: 'visible' });
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
];
