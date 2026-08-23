import { defineConfig } from '@playwright/test';
import {
  visualThemes,
  visualViewports,
  type VisualProjectMetadata,
  type VisualViewportName,
} from './src/visual-contract';

const viewportNames = Object.keys(visualViewports) as VisualViewportName[];

const projects = viewportNames.flatMap((viewportName) =>
  visualThemes.map((theme) => ({
    name: `${viewportName}-${theme}`,
    metadata: {
      visualTheme: theme,
      visualViewport: viewportName,
    } satisfies VisualProjectMetadata,
    use: {
      colorScheme: theme,
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
  webServer: {
    command: 'pnpm serve:web',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects,
});
