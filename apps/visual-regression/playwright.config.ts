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
    testIgnore: /(showcase|overlay-context|a11y|a11y-gate|a11y-readiness)\.spec\.ts/,
    use: {
      colorScheme: colorSchemeForVisualTheme(theme),
      deviceScaleFactor: 1,
      viewport: visualViewports[viewportName],
    },
  })),
);

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
  ],
  projects: [
    ...canonicalProjects,
    {
      name: 'showcase-integration',
      testMatch: /(showcase|overlay-context)\.spec\.ts/,
      use: {
        colorScheme: 'light' as const,
        deviceScaleFactor: 1,
        viewport: { width: 390, height: 844 },
      },
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
            testMatch: /a11y(-readiness)?\.spec\.ts/,
            use: {
              colorScheme: 'light' as const,
              deviceScaleFactor: 1,
              viewport: { width: 1280, height: 800 },
            },
          },
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
