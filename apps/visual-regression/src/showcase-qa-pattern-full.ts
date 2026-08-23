import { createHash } from 'node:crypto';
import type { Browser } from '@playwright/test';
import {
  attachRuntimeErrors,
  discoverCatalog,
  inspectPatternTopAndBottom,
  openPatterns,
  verifyTheme,
} from './showcase-qa-browser';

export const fullViewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
] as const;

export async function runPatternFullMatrix(browser: Browser, baseUrl: string) {
  const themes = ['light', 'dark'] as const;
  const groups: Array<{
    key: string;
    rendered: number;
    uniqueScreenshots: number;
    problems: Array<{ screen: string; problems: string[] }>;
    runtimeErrors: string[];
  }> = [];
  let browserVersion = '';

  for (const viewport of fullViewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'UTC',
      });
      const page = await context.newPage();
      browserVersion ||= browser.version();
      const runtimeErrors = attachRuntimeErrors(page);
      const problems: Array<{ screen: string; problems: string[] }> = [];
      const screenshotHashes: string[] = [];

      await openPatterns(page, baseUrl);
      await verifyTheme(page, theme);
      const catalog = await discoverCatalog(page);
      const counts = catalog.map((domain) => domain.screenLabels.length);
      if (JSON.stringify(counts) !== JSON.stringify([9, 8, 12, 8])) {
        problems.push({ screen: 'catalog', problems: [`unexpected domain counts ${JSON.stringify(counts)}`] });
      }

      let rendered = 0;
      for (const domain of catalog) {
        await page.getByRole('button', { name: domain.domainLabel, exact: true }).click();
        await page.getByText('Choose a screen', { exact: true }).waitFor({ state: 'visible' });
        for (const screenLabel of domain.screenLabels) {
          const screen = screenLabel.replace(/^Open /, '').replace(/ pattern$/, '');
          await page.getByRole('button', { name: screenLabel, exact: true }).click();
          await page.locator('[data-testid^="pattern-preview-"]').first().waitFor({ state: 'visible', timeout: 15_000 });

          const found = await inspectPatternTopAndBottom(page, viewport.width);
          if (found.length) problems.push({ screen, problems: found });

          const screenshot = await page.screenshot({ type: 'jpeg', quality: 35, fullPage: false });
          if (screenshot.length < 3000) problems.push({ screen, problems: [`screenshot too small: ${screenshot.length}`] });
          screenshotHashes.push(createHash('sha256').update(screenshot).digest('hex').slice(0, 16));
          rendered += 1;

          await page.getByRole('button', { name: 'Back to domain screen list' }).click();
          await page.getByText('Choose a screen', { exact: true }).waitFor({ state: 'visible' });
        }
        await page.getByRole('button', { name: 'Back to pattern domains' }).click();
        await page.getByText('Production patterns', { exact: true }).waitFor({ state: 'visible' });
      }

      const uniqueScreenshots = new Set(screenshotHashes).size;
      if (uniqueScreenshots < 30) {
        problems.push({ screen: 'matrix', problems: [`only ${uniqueScreenshots} unique screenshots`] });
      }
      groups.push({
        key: `${viewport.name}-${theme}`,
        rendered,
        uniqueScreenshots,
        problems,
        runtimeErrors: Array.from(new Set(runtimeErrors)),
      });
      await context.close();
    }
  }

  return {
    browser: browserVersion,
    viewportGroups: fullViewports.map((viewport) => viewport.name),
    themes,
    groups,
    totalRenders: groups.reduce((sum, group) => sum + group.rendered, 0),
    failedGroups: groups.filter((group) => group.problems.length || group.runtimeErrors.length),
  };
}
