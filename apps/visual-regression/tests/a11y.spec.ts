// #145 — Automated Web accessibility audit gate (axe-core + Playwright).
//
// Runs a deterministic axe-core scan against every scenario registered in
// `src/a11y-scenarios.ts` (Component Gallery, Pattern Gallery, a form
// scenario, an overlay scenario today; more scenarios are added there by
// later component/demo issues without touching this file). Each scenario's
// serious/critical violations are evaluated against the narrow allowlist in
// `src/a11y-allowlist.json` via `src/a11y-gate.ts`; anything left over fails
// the test and is written to `a11y-report/*.json` + `a11y-report/report.html`
// for CI to upload as an actionable artifact.
//
// This complements, and does not replace, BeeUI's semantic/contract-level
// accessibility tests (roles/names/states asserted directly in component
// tests) — a green axe scan proves the rendered DOM has no automatically
// detectable WCAG-rule violation in these scenarios, not full manual
// accessibility acceptance (see docs/native-verification.md for the
// browser-vs-native evidence boundary; the same "does not prove" discipline
// applies to axe: it proves automatable rule coverage, not everything WCAG
// requires).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loadA11yAllowlist } from '../src/a11y-allowlist';
import { evaluateViolations, isBlocking, normalizeAxeViolations } from '../src/a11y-gate';
import {
  readScenarioReportsFromDisk,
  writeHtmlReport,
  writeScenarioReport,
  writeSummaryReport,
} from '../src/a11y-report';
import { a11yScenarios } from '../src/a11y-scenarios';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

// The axe rule tag set BeeUI audits against: WCAG 2.0/2.1 Level A + AA, the
// bar BeeUI targets for its component/pattern contracts.
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('Web accessibility audit gate (#145)', () => {
  for (const scenario of a11yScenarios) {
    test(`axe scan: ${scenario.name}`, async ({ page }) => {
      test.setTimeout(60_000);
      await scenario.navigate(page, showcaseBaseUrl);

      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      const allowlist = loadA11yAllowlist();
      const evaluation = evaluateViolations(
        scenario.name,
        normalizeAxeViolations(results.violations),
        allowlist,
      );
      writeScenarioReport(evaluation);

      if (isBlocking(evaluation)) {
        const detail = evaluation.blockingNodes
          .map((node) => `  [${node.impact}] ${node.ruleId} — ${node.target}\n    ${node.help} (${node.helpUrl})`)
          .join('\n');
        expect(
          evaluation.blockingNodes,
          `${scenario.name}: ${evaluation.blockingNodes.length} unallowlisted serious/critical ` +
            `accessibility violation(s):\n${detail}\n\n` +
            `To exempt a confirmed platform/tool false positive, add a narrow entry to ` +
            `apps/visual-regression/src/a11y-allowlist.json with a real rationale — see ` +
            `docs/web-accessibility-audit.md.`,
        ).toEqual([]);
      }
    });
  }

  // Reads every scenario's already-written-to-disk JSON report rather than
  // an in-memory accumulator (see `readScenarioReportsFromDisk`'s doc
  // comment): Playwright restarts the worker process after a failing test,
  // so an in-process array silently drops earlier scenarios whenever one of
  // them fails — the exact case this gate's summary must not go blind to.
  // This hook re-runs once per worker that executed part of this file, so it
  // re-aggregates every time; the run that executes last always sees every
  // scenario file already on disk and leaves the final, complete artifact.
  test.afterAll(() => {
    const evaluations = readScenarioReportsFromDisk();
    if (evaluations.length === 0) return;
    const summaryPath = writeSummaryReport(evaluations);
    const htmlPath = writeHtmlReport(evaluations);
    console.log(`BEEUI_A11Y_AUDIT_SUMMARY ${summaryPath}`);
    console.log(`BEEUI_A11Y_AUDIT_REPORT ${htmlPath}`);
  });
});
