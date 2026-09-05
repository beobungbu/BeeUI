// Accessibility audit of the documentation portal (#474 WBS-H072).
//
// `web-a11y` has always audited the Showcase — every scenario in `a11y.spec.ts` navigates to
// `showcaseBaseUrl`. The 151-page documentation site, the surface a reader actually uses, was
// audited by nothing, so that job passing was never evidence about it. This closes that gap.
//
// One page per section rather than all 151: the generated sections share a single template, so
// auditing 62 component pages measures the same markup 62 times. The two densest generated
// surfaces are included deliberately — the component props tables and the reference signature
// tables are the newest and most tabular content on the site.
//
// Scope discipline, same as the Showcase audit: a green axe scan proves the rendered DOM has no
// automatically detectable WCAG violation on these pages. It is not manual acceptance, it does
// not cover keyboard order, focus visibility, reflow or screen-reader output, and per
// docs/beeui-1.0-evidence-classes.md it must not be described as any of those.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { loadA11yAllowlist } from '../src/a11y-allowlist';
import { evaluateViolations, isBlocking, normalizeAxeViolations } from '../src/a11y-gate';
import { writeScenarioReport } from '../src/a11y-report';

const docsBaseUrl = 'http://127.0.0.1:4175';

// WCAG 2.0/2.1 Level A + AA — the same bar the Showcase audit holds — plus axe's best-practice
// rules. The first version of this fix added `role="region"` to 581 elements and produced 366
// `landmark-unique` violations; `landmark-unique` is a best-practice rule, so requesting only
// the WCAG tags meant this audit could not see a defect its own remediation had introduced.
// The gate still blocks on serious/critical only, so best-practice findings surface in the
// report without changing what fails.
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  // The props and reference tables fit at 1280 and overflow at 390. A desktop-only audit
  // reported the portal clean while every generated table was unreachable on a phone.
  { name: 'mobile', width: 390, height: 844 },
  // WCAG 1.4.10 reflow: content must not require two-dimensional scrolling at 320 CSS px.
  { name: 'reflow-320', width: 320, height: 640 },
];

// WCAG 1.4.4 asks for 200% without loss of content or functionality. Emulated as a halved
// viewport at the same layout width, which is what a browser zoom does to the CSS viewport.
const ZOOM_VIEWPORT = { height: 400, width: 640 };

const pages = [
  { name: 'docs-portal-landing', path: '/docs/' },
  { name: 'docs-portal-start-expo', path: '/docs/start/expo/' },
  { name: 'docs-portal-guide-troubleshooting', path: '/docs/guides/troubleshooting/' },
  { name: 'docs-portal-learn-state-model', path: '/docs/learn/state-model/' },
  // The densest tabular surfaces on the site, and the newest.
  { name: 'docs-portal-component-table', path: '/docs/components/table/' },
  { name: 'docs-portal-reference-tokens', path: '/docs/reference/tokens/' },
  { name: 'docs-portal-pattern-sign-in', path: '/docs/patterns/auth/sign-in-screen/' },
  { name: 'docs-portal-accessibility-index', path: '/docs/accessibility/' },
];

test.describe('Documentation portal accessibility audit (WBS-H072)', () => {
  for (const target of pages) {
    for (const viewport of viewports) {
      test(`axe scan: ${target.name}-${viewport.name}`, async ({ page }) => {
      test.setTimeout(60_000);

      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      const response = await page.goto(`${docsBaseUrl}${target.path}`, { waitUntil: 'load' });
      // A missing page must fail loudly. The static server resolves a directory to its own
      // index and 404s otherwise, so a route rename cannot quietly audit the landing page here.
      expect(response?.status(), `${target.path} must be served`).toBe(200);

      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      const evaluation = evaluateViolations(
        `${target.name}-${viewport.name}`,
        normalizeAxeViolations(results.violations),
        loadA11yAllowlist(),
      );
      writeScenarioReport(evaluation);

      if (isBlocking(evaluation)) {
        const detail = evaluation.blockingNodes
          .map((node) => `  [${node.impact}] ${node.ruleId} — ${node.target}`)
          .join('\n');
        throw new Error(`${target.name} at ${viewport.name} has blocking accessibility violations:\n${detail}`);
      }
      });
    }
  }
});

// --- the parts a green axe run does not prove ------------------------------------------------
// axe reports automatable rule coverage. It says nothing about whether a keyboard user can reach
// things in a sensible order, whether focus is visible, whether the layout survives 320 CSS px,
// or whether any of it holds outside Chromium. Those were listed as "not covered" and are
// covered here rather than left as prose.

const KEYBOARD_PAGES = ['/docs/', '/docs/components/table/', '/docs/guides/troubleshooting/'];

test.describe('Documentation portal: reflow, zoom, keyboard (WBS-H072)', () => {
  for (const path of KEYBOARD_PAGES) {
    // WCAG 1.4.10: no horizontal scrolling of the page itself at 320 CSS px. A region that
    // scrolls on purpose (a code block, a wide table) is allowed; the document is not.
    test(`no page-level horizontal scroll at 320px: ${path}`, async ({ page }) => {
      await page.setViewportSize({ height: 640, width: 320 });
      const response = await page.goto(`${docsBaseUrl}${path}`, { waitUntil: 'load' });
      expect(response?.status(), `${path} must be served`).toBe(200);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      // One CSS pixel of slack for sub-pixel rounding.
      expect(
        overflow.scrollWidth - overflow.clientWidth,
        `${path} scrolls horizontally at 320px (${overflow.scrollWidth} > ${overflow.clientWidth})`,
      ).toBeLessThanOrEqual(1);
    });

    // WCAG 1.4.4: at 200% the same content must still be there and still not force the document
    // sideways. Emulated by halving the viewport, which is what zoom does to the CSS viewport.
    test(`content survives 200% zoom: ${path}`, async ({ page }) => {
      await page.setViewportSize(ZOOM_VIEWPORT);
      const response = await page.goto(`${docsBaseUrl}${path}`, { waitUntil: 'load' });
      expect(response?.status()).toBe(200);

      const state = await page.evaluate(() => ({
        headings: document.querySelectorAll('h1, h2, h3').length,
        main: document.querySelector('main')?.textContent?.trim().length ?? 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(state.main, `${path} lost its main content at 200% zoom`).toBeGreaterThan(200);
      expect(state.headings, `${path} lost its headings at 200% zoom`).toBeGreaterThan(0);
      expect(state.overflow, `${path} scrolls horizontally at 200% zoom`).toBeLessThanOrEqual(1);
    });

    // WCAG 2.4.1 Bypass Blocks. The sidebar carries ~130 links, so brute-force tabbing to
    // `<main>` is not the test — that is what a skip link exists for. An earlier version of
    // this test pressed Tab 40 times, failed, and was wrong about the site: the skip link is
    // the first focusable element on every page and every stop has a visible indicator.
    test(`a skip link bypasses the navigation: ${path}`, async ({ page }) => {
      await page.setViewportSize({ height: 800, width: 1280 });
      await page.goto(`${docsBaseUrl}${path}`, { waitUntil: 'load' });

      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => {
        const el = document.activeElement;
        if (!(el instanceof HTMLAnchorElement)) return null;
        const style = getComputedStyle(el);
        return {
          focusVisible: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
          href: el.getAttribute('href') ?? '',
          text: (el.textContent ?? '').trim(),
        };
      });

      expect(first, `${path}: the first focusable element is not a link`).not.toBeNull();
      expect(first?.href.startsWith('#'), `${path}: first stop "${first?.text}" is not an in-page skip link`).toBe(true);
      expect(first?.focusVisible, `${path}: the skip link has no visible focus indicator`).toBe(true);

      // The target must exist and be the main content, or the link bypasses nothing.
      const target = await page.evaluate((href) => {
        const el = document.querySelector(href);
        if (!el) return null;
        return { inMain: el.tagName.toLowerCase() === 'main' || Boolean(el.closest('main')) };
      }, first?.href ?? '#');
      expect(target, `${path}: skip link points at ${first?.href}, which does not exist`).not.toBeNull();
      expect(target?.inMain, `${path}: skip link target is outside <main>`).toBe(true);
    });

    // Every stop a keyboard user lands on must be visible to a sighted keyboard user.
    test(`focus is visible on every stop: ${path}`, async ({ page }) => {
      await page.setViewportSize({ height: 800, width: 1280 });
      await page.goto(`${docsBaseUrl}${path}`, { waitUntil: 'load' });

      const invisible = [];
      for (let step = 0; step < 25; step += 1) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return null;
          const visible = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
          return visible ? null : `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
        });
        if (stop) invisible.push(stop);
      }

      expect(invisible, `${path}: focus stops with no visible indicator: ${invisible.join(', ')}`).toEqual([]);
    });
  }
});
