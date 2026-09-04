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

// WCAG 2.0/2.1 Level A + AA — the same bar the Showcase audit holds.
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const pages = [
  { name: 'docs-portal:landing', path: '/docs/' },
  { name: 'docs-portal:start-expo', path: '/docs/start/expo/' },
  { name: 'docs-portal:guide-troubleshooting', path: '/docs/guides/troubleshooting/' },
  { name: 'docs-portal:learn-state-model', path: '/docs/learn/state-model/' },
  // The densest tabular surfaces on the site, and the newest.
  { name: 'docs-portal:component-table', path: '/docs/components/table/' },
  { name: 'docs-portal:reference-tokens', path: '/docs/reference/tokens/' },
  { name: 'docs-portal:pattern-sign-in', path: '/docs/patterns/auth/sign-in-screen/' },
  { name: 'docs-portal:accessibility-index', path: '/docs/accessibility/' },
];

test.describe('Documentation portal accessibility audit (WBS-H072)', () => {
  for (const target of pages) {
    test(`axe scan: ${target.name}`, async ({ page }) => {
      test.setTimeout(60_000);

      const response = await page.goto(`${docsBaseUrl}${target.path}`, { waitUntil: 'load' });
      // A missing page must fail loudly. The static server resolves a directory to its own
      // index and 404s otherwise, so a route rename cannot quietly audit the landing page here.
      expect(response?.status(), `${target.path} must be served`).toBe(200);

      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      const evaluation = evaluateViolations(
        target.name,
        normalizeAxeViolations(results.violations),
        loadA11yAllowlist(),
      );
      writeScenarioReport(evaluation);

      if (isBlocking(evaluation)) {
        const detail = evaluation.blockingNodes
          .map((node) => `  [${node.impact}] ${node.ruleId} — ${node.target}`)
          .join('\n');
        throw new Error(`${target.name} has blocking accessibility violations:\n${detail}`);
      }
    });
  }
});
