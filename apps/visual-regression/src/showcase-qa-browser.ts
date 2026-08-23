import { expect, type Page } from '@playwright/test';

export function attachRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

export async function verifyTheme(page: Page, theme: 'light' | 'dark') {
  const themeButton = page.getByRole('button', { name: /^Theme / }).first();
  await themeButton.waitFor({ state: 'visible', timeout: 15_000 });
  const label = (await themeButton.getAttribute('aria-label')) || '';
  const mediaDark = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  expect(mediaDark).toBe(theme === 'dark');
  expect(label.startsWith('Theme system.') || label.startsWith(`Theme ${theme}.`)).toBe(true);
}

export async function openPatterns(page: Page, baseUrl: string) {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.getByTestId('showcase-home').waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByRole('button', { name: 'Open Patterns' }).click();
  await page.getByText('Production patterns', { exact: true }).waitFor({ state: 'visible' });
}

export async function scrollScrollableWithin(page: Page, selector: string, bottom: boolean) {
  await page.evaluate(({ selector, bottom }) => {
    const root = document.querySelector(selector);
    if (!root) return;
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      if (!(element instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(element);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && element.scrollHeight > element.clientHeight + 2) {
        element.scrollTop = bottom ? element.scrollHeight : 0;
      }
    }
  }, { selector, bottom });
  await page.waitForTimeout(30);
}

type LayoutInspection = {
  fatal?: string;
  pageOverflow: number;
  offscreen: Array<{ tag: string; text: string; left: number; right: number; width: number }>;
  textLength: number;
  canvasWidth: number | null;
};

async function inspectPatternLayout(page: Page, width: number): Promise<LayoutInspection> {
  return page.evaluate((viewportWidth) => {
    const root = document.querySelector('[data-testid^="pattern-preview-"]');
    if (!(root instanceof HTMLElement)) {
      return { fatal: 'missing preview root', pageOverflow: 0, offscreen: [], textLength: 0, canvasWidth: null };
    }

    function isVisible(element: HTMLElement) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    function hasHorizontalScroller(element: HTMLElement) {
      let current = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && current.scrollWidth > current.clientWidth + 1) return true;
        current = current.parentElement;
      }
      return false;
    }

    const offscreen = [];
    for (const element of Array.from(root.querySelectorAll('*'))) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      if ((rect.left < -1 || rect.right > viewportWidth + 1) && !hasHorizontalScroller(element)) {
        offscreen.push({
          tag: element.tagName.toLowerCase(),
          text: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
        if (offscreen.length >= 6) break;
      }
    }

    const canvas = document.querySelector('[data-testid="pattern-desktop-canvas"]');
    const canvasRect = canvas instanceof HTMLElement ? canvas.getBoundingClientRect() : null;
    return {
      pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth,
      offscreen,
      textLength: (root.textContent || '').trim().length,
      canvasWidth: canvasRect ? Math.round(canvasRect.width * 10) / 10 : null,
    };
  }, width);
}

function layoutProblems(layout: LayoutInspection, width: number) {
  const problems: string[] = [];
  if (layout.fatal) problems.push(layout.fatal);
  if (layout.pageOverflow > 1) problems.push(`page horizontal overflow ${layout.pageOverflow}px`);
  if (layout.offscreen.length) problems.push(`offscreen=${JSON.stringify(layout.offscreen)}`);
  if (!layout.textLength) problems.push('preview has no text');
  if (width >= 960) {
    if (layout.canvasWidth === null) problems.push('desktop preview canvas missing');
    if (layout.canvasWidth !== null && layout.canvasWidth > 761) {
      problems.push(`desktop preview canvas wider than 760px: ${layout.canvasWidth}`);
    }
  } else if (layout.canvasWidth !== null) {
    problems.push('desktop preview canvas rendered below 960px');
  }
  return problems;
}

export async function inspectPatternTopAndBottom(page: Page, width: number) {
  const problems: string[] = [];
  await scrollScrollableWithin(page, '[data-testid^="pattern-preview-"]', false);
  problems.push(...layoutProblems(await inspectPatternLayout(page, width), width).map((problem) => `top: ${problem}`));
  await scrollScrollableWithin(page, '[data-testid^="pattern-preview-"]', true);
  problems.push(...layoutProblems(await inspectPatternLayout(page, width), width).map((problem) => `bottom: ${problem}`));
  await scrollScrollableWithin(page, '[data-testid^="pattern-preview-"]', false);
  return problems;
}

export async function openScenario(
  page: Page,
  baseUrl: string,
  scenario: { domain: string; screen: string; state?: string },
) {
  await openPatterns(page, baseUrl);
  await page.getByRole('button', { name: `Open ${scenario.domain}` }).click();
  await page.getByRole('button', { name: `Open ${scenario.screen} pattern` }).click();
  await page.locator('[data-testid^="pattern-preview-"]').first().waitFor({ state: 'visible', timeout: 15_000 });
  if (scenario.state) {
    await page.getByRole('button', { name: `Show ${scenario.state} state` }).click();
    await page.locator('[data-testid^="pattern-preview-"]').first().waitFor({ state: 'visible' });
  }
}

export async function discoverCatalog(page: Page) {
  const domainLabels = await page.locator('[role="button"][aria-label^="Open "]').evaluateAll((nodes) =>
    Array.from(new Set(nodes
      .map((node) => node.getAttribute('aria-label'))
      .filter((label): label is string => typeof label === 'string' && !label.endsWith(' pattern')))),
  );
  const catalog: Array<{ domainLabel: string; screenLabels: string[] }> = [];

  for (const domainLabel of domainLabels) {
    await page.getByRole('button', { name: domainLabel, exact: true }).click();
    await page.getByText('Choose a screen', { exact: true }).waitFor({ state: 'visible' });
    const screenLabels = await page.locator('[role="button"][aria-label^="Open "][aria-label$=" pattern"]').evaluateAll((nodes) =>
      Array.from(new Set(nodes
        .map((node) => node.getAttribute('aria-label'))
        .filter((label): label is string => typeof label === 'string'))),
    );
    catalog.push({ domainLabel, screenLabels });
    await page.getByRole('button', { name: 'Back to pattern domains' }).click();
    await page.getByText('Production patterns', { exact: true }).waitFor({ state: 'visible' });
  }

  return catalog;
}

export async function componentPageOverflow(page: Page, width: number) {
  return page.evaluate(
    (viewportWidth) => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth,
    width,
  );
}
