import { expect, test } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

const defaultScenarios = [
  'welcome-default',
  'sign-in-default',
  'sign-up-default',
  'forgot-default',
  'verify-empty',
  'reset-default',
  'password-updated-success',
  'interests-none',
  'profile-empty',
] as const;

const mobileStateScenarios = [
  'sign-in-invalid',
  'sign-in-loading',
  'sign-in-server-error',
  'sign-in-long-error',
  'sign-up-validation',
  'sign-up-loading',
  'sign-up-long-copy',
  'forgot-error',
  'forgot-submitting',
  'verify-incomplete',
  'verify-complete',
  'verify-error',
  'verify-verifying',
  'reset-validation',
  'reset-loading',
  'interests-one',
  'interests-many',
  'interests-long-labels',
  'profile-populated',
  'profile-long-name',
  'profile-long-bio',
  'profile-validation',
  'profile-saving',
] as const;

const narrowCriticalScenarios = [
  'sign-in-long-error',
  'sign-up-validation',
  'sign-up-long-copy',
  'verify-error',
  'interests-many',
  'interests-long-labels',
  'profile-long-name',
  'profile-long-bio',
  'profile-validation',
] as const;

const fullPageScenarios = new Set<string>([
  'sign-in-long-error',
  'sign-up-default',
  'sign-up-validation',
  'sign-up-long-copy',
  'interests-long-labels',
  'profile-empty',
  'profile-populated',
  'profile-long-name',
  'profile-long-bio',
  'profile-validation',
  'profile-saving',
]);

test('auth visual acceptance capture', async ({ page }, testInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  const scenarios = [...defaultScenarios];

  if (metadata.visualViewport === 'mobile390') {
    scenarios.push(...mobileStateScenarios);
  }

  if (metadata.visualViewport === 'narrow360') {
    scenarios.push(...narrowCriticalScenarios);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const scenario of scenarios) {
    await page.goto(`/?authScenario=${scenario}&theme=${metadata.visualTheme}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');

    const metrics = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }));

    const stem = `${scenario}--${metadata.visualTheme}--${metadata.visualViewport}`;
    const viewportPath = testInfo.outputPath(`${stem}--viewport.png`);

    await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      path: viewportPath,
    });
    await testInfo.attach(`${stem}--viewport`, {
      contentType: 'image/png',
      path: viewportPath,
    });
    await testInfo.attach(`${stem}--metrics`, {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });

    if (fullPageScenarios.has(scenario) && metrics.scrollHeight > metrics.viewportHeight) {
      const fullPath = testInfo.outputPath(`${stem}--full.png`);
      await page.screenshot({
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        path: fullPath,
      });
      await testInfo.attach(`${stem}--full`, {
        contentType: 'image/png',
        path: fullPath,
      });
    }
  }

  throw new Error('Intentional QA-only failure so visual diagnostics are uploaded for inspection.');
});
