// #145 — actionable CI artifacts for the Web accessibility audit gate.
// Writes one JSON file per scenario (raw node/target/rule detail) plus a
// combined JSON summary and a single self-contained HTML report, all under
// `apps/visual-regression/a11y-report/` so CI can upload them regardless of
// pass/fail outcome.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { GateEvaluation, ViolationNodeRecord } from './a11y-gate';

// Playwright's TS test transform compiles this module to CommonJS, so
// `__dirname` (not `import.meta.url`) is the portable way to locate the
// report directory at runtime.
export const a11yReportDir = join(__dirname, '..', 'a11y-report');

function ensureDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

/** The subset of `GateEvaluation` that `writeSummaryReport`/`writeHtmlReport` actually need. */
export type ReportableEvaluation = {
  scenario: string;
  blockingNodes: ViolationNodeRecord[];
  allowlistedNodes: ViolationNodeRecord[];
  nonBlockingNodes: ViolationNodeRecord[];
};

export function writeScenarioReport(evaluation: GateEvaluation) {
  const path = join(a11yReportDir, `${evaluation.scenario}.json`);
  ensureDir(path);
  writeFileSync(
    path,
    JSON.stringify(
      {
        scenario: evaluation.scenario,
        blocking: evaluation.blockingNodes.length > 0,
        counts: {
          blocking: evaluation.blockingNodes.length,
          allowlisted: evaluation.allowlistedNodes.length,
          nonBlocking: evaluation.nonBlockingNodes.length,
          total: evaluation.allViolationNodes.length,
        },
        blockingNodes: evaluation.blockingNodes,
        allowlistedNodes: evaluation.allowlistedNodes,
        nonBlockingNodes: evaluation.nonBlockingNodes,
      },
      null,
      2,
    ),
    'utf-8',
  );
  return path;
}

export function writeSummaryReport(evaluations: readonly ReportableEvaluation[]) {
  const path = join(a11yReportDir, 'summary.json');
  ensureDir(path);
  const summary = {
    generatedAt: new Date().toISOString(),
    scenarios: evaluations.map((evaluation) => ({
      scenario: evaluation.scenario,
      blocking: evaluation.blockingNodes.length > 0,
      blockingCount: evaluation.blockingNodes.length,
      allowlistedCount: evaluation.allowlistedNodes.length,
      nonBlockingCount: evaluation.nonBlockingNodes.length,
    })),
    overallBlocking: evaluations.some((evaluation) => evaluation.blockingNodes.length > 0),
  };
  writeFileSync(path, JSON.stringify(summary, null, 2), 'utf-8');
  return path;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNodeRows(nodes: readonly ViolationNodeRecord[], statusLabel: string, rowClass: string) {
  return nodes
    .map(
      (node) => `<tr class="${rowClass}">
        <td>${escapeHtml(statusLabel)}</td>
        <td>${escapeHtml(node.scenario)}</td>
        <td>${escapeHtml(node.ruleId)}</td>
        <td>${escapeHtml(node.impact ?? 'unknown')}</td>
        <td><code>${escapeHtml(node.target)}</code></td>
        <td>${escapeHtml(node.help)} — <a href="${escapeHtml(node.helpUrl)}">${escapeHtml(node.helpUrl)}</a></td>
        <td>${node.allowlistReason ? escapeHtml(node.allowlistReason) : ''}</td>
      </tr>`,
    )
    .join('\n');
}

/**
 * Writes `a11y-report/report.html` — a single self-contained, dependency-free
 * HTML artifact summarizing every scenario's blocking / allowlisted /
 * non-blocking violation nodes for human review in CI.
 */
export function writeHtmlReport(evaluations: readonly ReportableEvaluation[]) {
  const path = join(a11yReportDir, 'report.html');
  ensureDir(path);
  const overallBlocking = evaluations.some((evaluation) => evaluation.blockingNodes.length > 0);
  const rows = evaluations
    .flatMap((evaluation) => [
      renderNodeRows(evaluation.blockingNodes, 'BLOCKING', 'row-blocking'),
      renderNodeRows(evaluation.allowlistedNodes, 'allowlisted', 'row-allowlisted'),
      renderNodeRows(evaluation.nonBlockingNodes, 'non-blocking', 'row-nonblocking'),
    ])
    .filter(Boolean)
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>BeeUI Web accessibility audit (#145)</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  .status { font-weight: 600; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block; }
  .status-fail { background: #fde8e8; color: #9b1c1c; }
  .status-pass { background: #def7ec; color: #03543f; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; font-size: 0.85rem; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
  th { background: #f7f7f7; }
  tr.row-blocking { background: #fff5f5; }
  tr.row-allowlisted { background: #fffbea; }
  code { font-size: 0.8rem; }
  .scenario-summary { margin-top: 1.5rem; }
</style>
</head>
<body>
<h1>BeeUI Web accessibility audit (axe-core + Playwright) — #145</h1>
<p class="status ${overallBlocking ? 'status-fail' : 'status-pass'}">
  ${overallBlocking ? 'FAILING — new serious/critical violation(s) not covered by the allowlist' : 'PASSING — no unallowlisted serious/critical violations'}
</p>
<div class="scenario-summary">
  <table>
    <thead><tr><th>Scenario</th><th>Blocking</th><th>Allowlisted</th><th>Non-blocking (minor/moderate)</th></tr></thead>
    <tbody>
      ${evaluations
        .map(
          (evaluation) => `<tr>
            <td>${escapeHtml(evaluation.scenario)}</td>
            <td>${evaluation.blockingNodes.length}</td>
            <td>${evaluation.allowlistedNodes.length}</td>
            <td>${evaluation.nonBlockingNodes.length}</td>
          </tr>`,
        )
        .join('\n')}
    </tbody>
  </table>
</div>
<h2>Violation detail</h2>
<table>
  <thead><tr><th>Status</th><th>Scenario</th><th>Rule</th><th>Impact</th><th>Target</th><th>Help</th><th>Allowlist reason</th></tr></thead>
  <tbody>
    ${rows || '<tr><td colspan="7">No violations detected.</td></tr>'}
  </tbody>
</table>
</body>
</html>`;

  writeFileSync(path, html, 'utf-8');
  return path;
}

/**
 * Reads back every per-scenario JSON report already written by
 * `writeScenarioReport` and reconstructs `ReportableEvaluation`s from disk.
 *
 * Aggregation deliberately does NOT rely on in-memory state accumulated
 * across `test()` calls in the same module: Playwright restarts the worker
 * process (a fresh module instance, dropping any in-memory array) after a
 * failing test, so a purely in-process accumulator silently loses scenarios
 * whenever an earlier scenario in the same file fails — exactly the
 * failure/blocking runs this gate exists to report. Reading the
 * already-written-to-disk per-scenario files back in `test.afterAll` is
 * immune to that restart because each scenario's own JSON is flushed to disk by the
 * worker that ran it, regardless of which later worker aggregates them.
 */
export function readScenarioReportsFromDisk(): ReportableEvaluation[] {
  let entries: string[];
  try {
    entries = readdirSync(a11yReportDir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith('.json') && entry !== 'summary.json')
    .map((entry) => {
      const raw = JSON.parse(readFileSync(join(a11yReportDir, entry), 'utf-8')) as {
        scenario: string;
        blockingNodes: ViolationNodeRecord[];
        allowlistedNodes: ViolationNodeRecord[];
        nonBlockingNodes: ViolationNodeRecord[];
      };
      return {
        scenario: raw.scenario,
        blockingNodes: raw.blockingNodes,
        allowlistedNodes: raw.allowlistedNodes,
        nonBlockingNodes: raw.nonBlockingNodes,
      };
    })
    .sort((a, b) => a.scenario.localeCompare(b.scenario));
}
