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

const scrollEndpointScenarios = new Set<string>([
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

    const metrics = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>('*'));
      const scrollables = elements
        .filter((element) => element.scrollHeight > element.clientHeight + 1)
        .map((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          tagName: element.tagName,
        }))
        .sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight));
      const outsideViewport = elements
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1))
        .slice(0, 12)
        .map(({ element, rect }) => ({
          label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80) ?? '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          tagName: element.tagName,
          width: Math.round(rect.width),
        }));

      return {
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        documentScrollHeight: document.documentElement.scrollHeight,
        documentScrollWidth: document.documentElement.scrollWidth,
        outsideViewport,
        scrollables,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

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

    if (scrollEndpointScenarios.has(scenario)) {
      const didScroll = await page.evaluate(() => {
        const scrollable = Array.from(document.querySelectorAll<HTMLElement>('*'))
          .filter((element) => element.scrollHeight > element.clientHeight + 1)
          .sort(
            (a, b) =>
              b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight),
          )[0];

        if (!scrollable) return false;
        scrollable.scrollTop = scrollable.scrollHeight;
        return true;
      });

      if (didScroll) {
        await page.waitForTimeout(50);
        const bottomPath = testInfo.outputPath(`${stem}--bottom.png`);
        await page.screenshot({
          animations: 'disabled',
          caret: 'hide',
          fullPage: false,
          path: bottomPath,
        });
        await testInfo.attach(`${stem}--bottom`, {
          contentType: 'image/png',
          path: bottomPath,
        });
      }
    }
  }

  throw new Error('Intentional QA-only failure so visual diagnostics are uploaded for inspection.');
});
