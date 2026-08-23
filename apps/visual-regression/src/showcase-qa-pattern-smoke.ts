import type { Browser } from '@playwright/test';
import {
  attachRuntimeErrors,
  inspectPatternTopAndBottom,
  openScenario,
  verifyTheme,
} from './showcase-qa-browser';

export const representativeViewports = [
  { name: '390x844', width: 390, height: 844, themes: ['light', 'dark'] as const },
  { name: '1280x800', width: 1280, height: 800, themes: ['light', 'dark'] as const },
  { name: '360x800', width: 360, height: 800, themes: ['light'] as const },
] as const;

export const representativeScenarios = [
  { domain: 'Authentication & Onboarding', screen: 'Sign In', state: 'Server error' },
  { domain: 'Authentication & Onboarding', screen: 'Profile Setup' },
  { domain: 'Dashboard & Finance', screen: 'Dashboard Overview' },
  { domain: 'Dashboard & Finance', screen: 'Transactions', state: 'Error' },
  { domain: 'Commerce & Social', screen: 'Product Detail' },
  { domain: 'Commerce & Social', screen: 'Cart' },
  { domain: 'Commerce & Social', screen: 'Checkout', state: 'Problem' },
  { domain: 'Account & Settings', screen: 'Notification Settings', state: 'Master off' },
  { domain: 'Account & Settings', screen: 'Change Password', state: 'Invalid' },
] as const;

export async function runPatternSmokeMatrix(browser: Browser, baseUrl: string) {
  const groups: Array<{
    key: string;
    rendered: number;
    problems: Array<{ screen: string; problems: string[] }>;
    runtimeErrors: string[];
  }> = [];

  for (const viewport of representativeViewports) {
    for (const theme of viewport.themes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'UTC',
      });
      const page = await context.newPage();
      const runtimeErrors = attachRuntimeErrors(page);
      const problems: Array<{ screen: string; problems: string[] }> = [];

      for (const scenario of representativeScenarios) {
        await openScenario(page, baseUrl, scenario);
        await verifyTheme(page, theme);
        const found = await inspectPatternTopAndBottom(page, viewport.width);
        if (found.length) problems.push({ screen: scenario.screen, problems: found });
      }

      groups.push({
        key: `${viewport.name}-${theme}`,
        rendered: representativeScenarios.length,
        problems,
        runtimeErrors: Array.from(new Set(runtimeErrors)),
      });
      await context.close();
    }
  }

  return groups;
}
