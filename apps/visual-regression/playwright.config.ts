import { defineConfig } from '@playwright/test';
import {
  colorSchemeForVisualTheme,
  visualThemes,
  visualViewports,
  type VisualProjectMetadata,
  type VisualViewportName,
} from './src/visual-contract';

const viewportNames = Object.keys(visualViewports) as VisualViewportName[];

// #145 — the accessibility-audit projects only run when explicitly opted
// into (set by the `test:a11y` script / the dedicated `web-a11y` CI job),
// mirroring the existing `BEEUI_FULL_PATTERN_GALLERY_QA` opt-in pattern
// below. This keeps them out of the *default* `playwright test` invocation
// that the pre-existing `visual-web` job's `pnpm test` script runs — without
// this gate, a bare `playwright test` (no `--project` filter) runs every
// defined project, so the pre-existing `visual-web` gate would start failing
// on accessibility findings it was never designed to enforce.
const runA11yProjects = process.env.BEEUI_A11Y_AUDIT === '1';

const canonicalProjects = viewportNames.flatMap((viewportName) =>
  visualThemes.map((theme) => ({
    name: `${viewportName}-${theme}`,
    metadata: {
      visualTheme: theme,
      visualViewport: viewportName,
    } satisfies VisualProjectMetadata,
    // `a11y[-\w]*` rather than an explicit list: adding a11y-docs-portal.spec.ts under the old
    // exact alternation let it run in every canonical visual project, where the mobile viewport
    // turned an accessibility finding into a visual-regression failure.
    testIgnore: /(showcase|overlay-context|a11y[-\w]*)\.spec\.ts/,
    use: {
      colorScheme: colorSchemeForVisualTheme(theme),
      deviceScaleFactor: 1,
      viewport: visualViewports[viewportName],
    },
  })),
);

const showcaseUse = {
  colorScheme: 'light' as const,
  deviceScaleFactor: 1,
  viewport: { width: 390, height: 844 },
};

// Historical blob evidence from visual-web run 33832785919 showed that the
// old numeric 3-way sharding had almost identical test counts (176/174/175)
// but radically different runtime because showcase.spec.ts dominated shard 3.
// Split the one ~103s full acceptance matrix from the three smaller smoke
// cases so CI can compose duration-balanced semantic lanes without adding a
// fourth runner slot. The exact-file regex intentionally does not match
// date-picker-showcase.spec.ts and the other *-showcase.spec.ts files.
const rootShowcaseSpec = /[\\/]showcase\.spec\.ts$/;
const fullAcceptanceMatrix = /runs the full 37-screen acceptance matrix without PNG baselines/;

export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  outputDir: 'test-results',
  fullyParallel: false,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm serve:web',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @beemvp/beeui-showcase exec expo export --platform web --output-dir dist-gallery-qa && node ./scripts/serve-showcase.mjs',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    // The documentation portal, for the WBS-H072 audit. Every a11y scenario before this one
    // navigated to the Showcase, so `web-a11y` passing said nothing about the 151-page site a
    // reader actually uses.
    {
      command: 'pnpm --filter @beemvp/beeui-docs build && node ./scripts/serve-docs.mjs',
      url: 'http://127.0.0.1:4175/docs/',
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
  projects: [
    ...canonicalProjects,
    {
      name: 'showcase-integration',
      testMatch: /(showcase|overlay-context)\.spec\.ts/,
      testIgnore: rootShowcaseSpec,
      use: showcaseUse,
    },
    {
      name: 'showcase-acceptance-matrix',
      testMatch: rootShowcaseSpec,
      grep: fullAcceptanceMatrix,
      use: showcaseUse,
    },
    {
      name: 'showcase-acceptance-smoke',
      testMatch: rootShowcaseSpec,
      grepInvert: fullAcceptanceMatrix,
      use: showcaseUse,
    },
    // #145 — dedicated axe + Playwright Web accessibility audit gate. Kept as
    // its own project (not folded into canonicalProjects) so the audit runs
    // once against representative surfaces instead of once per visual
    // theme/viewport combination; each scenario inside the spec opens its own
    // browser context at the viewport it needs, mirroring showcase-qa-component.
    // Gated behind `runA11yProjects` — see the comment on that constant above.
    ...(runA11yProjects
      ? [
          {
            name: 'a11y-audit',
            // Includes the overlay readiness regression (a11y-readiness.spec.ts),
            // which pins the settled-modal-owner contract the dialog-overlay
            // scenario synchronizes on before axe runs.
            testMatch: /a11y(-readiness|-docs-portal)?\.spec\.ts/,
            use: {
              colorScheme: 'light' as const,
              deviceScaleFactor: 1,
              viewport: { width: 1280, height: 800 },
            },
          },
          // The portal audit again on the other two engines. Chromium-only was on H072's
          // "not covered" list: a rendering or focus difference in WebKit or Gecko would have
          // been invisible. Scoped to the docs spec — the Showcase suite stays Chromium.
          ...(['firefox', 'webkit'] as const).map((browserName) => ({
            name: `a11y-docs-${browserName}`,
            testMatch: /a11y-docs-portal\.spec\.ts/,
            use: {
              browserName,
              colorScheme: 'light' as const,
              deviceScaleFactor: 1,
              viewport: { width: 1280, height: 800 },
            },
          })),
          // Pure-logic regression coverage for the allowlist/blocking gate
          // itself — no browser page is used, so it runs under any project's
          // browser context.
          {
            name: 'a11y-gate-regression',
            testMatch: /a11y-gate\.spec\.ts/,
          },
        ]
      : []),
  ],
});
