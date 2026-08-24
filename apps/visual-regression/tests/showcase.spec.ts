import { expect, test } from '@playwright/test';
import { runComponentGalleryMatrix } from '../src/showcase-qa-component';
import { runPatternFullMatrix } from '../src/showcase-qa-pattern-full';
import {
  representativeScenarios,
  runPatternSmokeMatrix,
} from '../src/showcase-qa-pattern-smoke';

const runFullMatrix = process.env.CI === 'true' || process.env.BEEUI_FULL_PATTERN_GALLERY_QA === '1';
const showcaseBaseUrl = 'http://127.0.0.1:4174';

test('preserves the Component Gallery across mobile/desktop and light/dark', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);
  const groups = await runComponentGalleryMatrix(browser, showcaseBaseUrl);
  console.log(`BEEUI_COMPONENT_GALLERY_MATRIX ${JSON.stringify(groups)}`);
  expect(groups).toHaveLength(4);
  expect(groups.filter((group) => group.problems.length || group.runtimeErrors.length)).toEqual([]);
});

test('switches Brand A/B across light/dark without resetting an open Dialog', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);
  const viewports = [
    { name: '390x844', width: 390, height: 844 },
    { name: '1280x800', width: 1280, height: 800 },
  ];
  const results: Array<{ key: string; problems: string[]; runtimeErrors: string[] }> = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: 'light',
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
    });
    const page = await context.newPage();
    const runtimeErrors: string[] = [];
    const problems: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open Theme and tokens' }).click();
    await page.getByTestId('theme-token-inspector').waitFor({ state: 'visible' });

    const expectTheme = async (runtimeTheme: string, primary: string) => {
      await expect(page.getByText(runtimeTheme, { exact: true })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
          ),
        )
        .toBe(primary);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${runtimeTheme}: horizontal overflow ${overflow}px`);
    };

    await page.getByRole('button', { name: 'Use Brand A Bee' }).click();
    await page.getByRole('button', { name: 'Use light theme' }).click();
    await expectTheme('light', '#f59e0b');

    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expectTheme('dark', '#fbbf24');

    await page.getByRole('button', { name: 'Use Brand B Violet' }).click();
    await expectTheme('violet-dark', '#a78bfa');

    await page.getByRole('button', { name: 'Use light theme' }).click();
    await expectTheme('violet-light', '#7c3aed');

    await page.getByRole('button', { name: 'Open theme-switch dialog' }).click();
    const dialogTitle = page.getByText('Theme switch while overlay is open', { exact: true });
    await expect(dialogTitle).toBeVisible();
    await expect(page.getByTestId('overlay-runtime-theme')).toHaveText('violet-light');

    await page.getByRole('button', { name: 'Switch open dialog to Brand A Bee' }).click();
    await expect(dialogTitle).toBeVisible();
    await expect(page.getByTestId('overlay-runtime-theme')).toHaveText('light');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        ),
      )
      .toBe('#f59e0b');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dialogTitle).toBeHidden();

    results.push({
      key: viewport.name,
      problems,
      runtimeErrors: Array.from(new Set(runtimeErrors)),
    });
    await context.close();
  }

  console.log(`BEEUI_THEME_V2_MATRIX ${JSON.stringify(results)}`);
  expect(results.filter((result) => result.problems.length || result.runtimeErrors.length)).toEqual([]);
});

test('runs the durable representative Pattern Gallery integration matrix', async ({ browser }) => {
  test.setTimeout(4 * 60 * 1000);
  const groups = await runPatternSmokeMatrix(browser, showcaseBaseUrl);
  const totalRenders = groups.reduce((sum, group) => sum + group.rendered, 0);
  console.log(`BEEUI_GALLERY_SMOKE_MATRIX ${JSON.stringify({
    groups: groups.length,
    screensPerGroup: representativeScenarios.length,
    totalRenders,
    groupsDetail: groups,
  })}`);
  expect(groups).toHaveLength(5);
  expect(totalRenders).toBe(45);
  expect(groups.filter((group) => group.problems.length || group.runtimeErrors.length)).toEqual([]);
});

(runFullMatrix ? test : test.skip)('runs the full 37-screen acceptance matrix without PNG baselines', async ({ browser }) => {
  test.setTimeout(12 * 60 * 1000);
  const result = await runPatternFullMatrix(browser, showcaseBaseUrl);
  console.log(`BEEUI_GALLERY_FULL_MATRIX ${JSON.stringify({
    browser: result.browser,
    viewportGroups: result.viewportGroups,
    themes: result.themes,
    groups: result.groups.length,
    screensPerGroup: 37,
    totalRenders: result.totalRenders,
    failedGroups: result.failedGroups,
  })}`);
  expect(result.groups).toHaveLength(10);
  expect(result.totalRenders).toBe(370);
  expect(result.failedGroups).toEqual([]);
});
