import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertBudgetShape, chromeFlagsFor, collectVitalsViolations, run } from '../check-docs-web-vitals.mjs';
import budgetFile from '../../docs/web-vitals.budget.json' with { type: 'json' };

const SCRIPT_FILE = fileURLToPath(new URL('../check-docs-web-vitals.mjs', import.meta.url));

const BUDGET = {
  cumulativeLayoutShift: 0.1,
  largestContentfulPaintMs: 3000,
  minPerformanceScore: 0.9,
  totalBlockingTimeMs: 200,
};

function measurement(overrides = {}) {
  return {
    cumulativeLayoutShift: 0,
    largestContentfulPaintMs: 1000,
    name: 'home',
    path: '/',
    performanceScore: 1,
    totalBlockingTimeMs: 0,
    ...overrides,
  };
}

test('a page under every ceiling reports no violation', () => {
  assert.deepEqual(collectVitalsViolations([measurement()], BUDGET), []);
});

test('a metric exactly on its ceiling passes; one step over fails', () => {
  assert.deepEqual(collectVitalsViolations([measurement({ largestContentfulPaintMs: 3000 })], BUDGET), []);

  const over = collectVitalsViolations([measurement({ largestContentfulPaintMs: 3001 })], BUDGET);
  assert.equal(over.length, 1);
  assert.match(over[0], /LCP 3001 ms, over the 3000 ms budget/);
});

test('each metric is measured against its own ceiling', () => {
  const violations = collectVitalsViolations(
    [
      measurement({ name: 'slow', largestContentfulPaintMs: 5200 }),
      measurement({ name: 'busy', totalBlockingTimeMs: 640 }),
      measurement({ name: 'jumpy', cumulativeLayoutShift: 0.42 }),
    ],
    BUDGET,
  );

  assert.deepEqual(violations, [
    'slow (/): LCP 5200 ms, over the 3000 ms budget.',
    'busy (/): TBT 640 ms, over the 200 ms budget.',
    'jumpy (/): CLS 0.420, over the 0.100 budget.',
  ]);
});

test('the performance score is a floor, not a ceiling', () => {
  assert.deepEqual(collectVitalsViolations([measurement({ performanceScore: 0.9 })], BUDGET), []);

  const under = collectVitalsViolations([measurement({ performanceScore: 0.72 })], BUDGET);
  assert.deepEqual(under, ['home (/): performance score 0.72, under the 0.90 floor.']);
});

// A Lighthouse run that fails mid-way returns nulls. Reading those as "under budget" is how a
// check reports green while measuring nothing.
test('an unmeasured metric is a violation, never a pass', () => {
  for (const key of ['largestContentfulPaintMs', 'totalBlockingTimeMs', 'cumulativeLayoutShift']) {
    const violations = collectVitalsViolations([measurement({ [key]: null })], BUDGET);
    assert.equal(violations.length, 1, `${key}: expected exactly one violation`);
    assert.match(violations[0], /was not measured/);
  }

  const noScore = collectVitalsViolations([measurement({ performanceScore: undefined })], BUDGET);
  assert.deepEqual(noScore, ['home (/): performance score was not measured (got undefined).']);
});

test('a non-numeric metric is a violation, not a string comparison', () => {
  // '99999' > 3000 is false in JavaScript when either side is a string of digits compared
  // lexically; typing the guard on Number keeps a stringified metric from passing.
  const violations = collectVitalsViolations([measurement({ largestContentfulPaintMs: '99999' })], BUDGET);
  assert.deepEqual(violations, ['home (/): LCP was not measured (got "99999").']);
});

test('measuring nothing fails instead of reporting a clean run', () => {
  assert.deepEqual(collectVitalsViolations([], BUDGET), [
    'No pages were measured. Run the docs build first (pnpm docs:build).',
  ]);
  assert.equal(collectVitalsViolations(undefined, BUDGET).length, 1);
});

test('every page in the input is reported, not just the first breach', () => {
  const violations = collectVitalsViolations(
    [measurement({ name: 'a', totalBlockingTimeMs: 900 }), measurement({ name: 'b', totalBlockingTimeMs: 900 })],
    BUDGET,
  );
  assert.equal(violations.length, 2);
});

test('a budget file missing a ceiling is rejected rather than enforcing three of four', () => {
  for (const key of Object.keys(BUDGET)) {
    const budget = { ...BUDGET };
    delete budget[key];
    assert.throws(
      () => assertBudgetShape({ budget, pages: [{ name: 'home', path: '/' }] }, 'test.json'),
      new RegExp(`budget\\.${key} must be a finite number`),
    );
  }

  assert.throws(
    () => assertBudgetShape({ budget: { ...BUDGET, totalBlockingTimeMs: '200' } }, 'test.json'),
    /budget\.totalBlockingTimeMs must be a finite number, got "200"/,
  );
});

test('a budget file with no pages is rejected: measuring nothing must not pass', () => {
  assert.throws(() => assertBudgetShape({ budget: BUDGET, pages: [] }, 'test.json'), /lists no pages/);
  assert.throws(() => assertBudgetShape({ budget: BUDGET }, 'test.json'), /lists no pages/);
  assert.throws(
    () => assertBudgetShape({ budget: BUDGET, pages: [{ name: 'home', path: 'components/' }] }, 'test.json'),
    /site-absolute "path"/,
  );
});

test('the committed budget file satisfies the shape the runner requires', () => {
  const parsed = assertBudgetShape(budgetFile);
  assert.ok(parsed.pages.length >= 5, 'the measured set should cover home, component, pattern, guide and reference');
  assert.deepEqual(
    parsed.pages.map((page) => page.path).filter((value, index, all) => all.indexOf(value) !== index),
    [],
    'the same page must not be measured twice',
  );
  // Ceilings loose enough to pass anything are not a regression guard. Lighthouse scores 0-1 and
  // a perfect page still spends time painting, so these bound the bounds.
  assert.ok(parsed.budget.largestContentfulPaintMs < 10_000);
  assert.ok(parsed.budget.totalBlockingTimeMs < 1_000);
  assert.ok(parsed.budget.cumulativeLayoutShift < 0.25, 'CLS above 0.25 is Lighthouse "poor"');
  assert.ok(parsed.budget.minPerformanceScore > 0.5 && parsed.budget.minPerformanceScore <= 1);
});

// --- the command itself -------------------------------------------------------------------
// collectVitalsViolations deciding "this is a breach" is worth nothing if the command prints the
// breach and still exits 0. `run` takes the measurement as an argument so the exit decision can be
// driven here without a browser; the spawn test below covers the entrypoint that calls it.

function stubbedRun({ argv = [], measurements, budget = BUDGET }) {
  const logs = [];
  const errors = [];
  const reports = [];
  const measuredPages = [];

  return run({
    argv,
    log: (line) => logs.push(line),
    logError: (line) => errors.push(line),
    measure: async ({ pages }) => {
      measuredPages.push(...pages);
      return { lighthouseVersion: '13.4.1', pages: measurements };
    },
    readBudget: async () => ({ budget, pages: measurements.map(({ name, path }) => ({ name, path })) }),
    writeReport: async (report) => {
      reports.push(report);
      return '.artifacts/docs-web-vitals.json';
    },
  }).then((code) => ({ code, errors: errors.join('\n'), logs: logs.join('\n'), measuredPages, reports }));
}

test('--check exits non-zero on a breach and names it', async () => {
  const { code, errors } = await stubbedRun({
    argv: ['--check'],
    measurements: [measurement({ largestContentfulPaintMs: 4200, name: 'slow' })],
  });

  assert.equal(code, 1, 'a measured breach must fail the command');
  assert.match(errors, /Core Web Vitals budget exceeded/);
  assert.match(errors, /slow \(\/\): LCP 4200 ms, over the 3000 ms budget\./);
});

test('--check exits zero when every page is under budget', async () => {
  const { code, errors, logs } = await stubbedRun({ argv: ['--check'], measurements: [measurement()] });

  assert.equal(code, 0);
  assert.equal(errors, '');
  assert.match(logs, /Web vitals check passed \(1 pages; ceilings LCP 3000 ms/);
});

test('a Lighthouse run that measured nothing fails --check instead of passing', async () => {
  const { code, errors } = await stubbedRun({
    argv: ['--check'],
    measurements: [measurement({ largestContentfulPaintMs: null, performanceScore: null })],
  });

  assert.equal(code, 1);
  assert.match(errors, /LCP was not measured/);
});

test('without --check a breach is reported but does not fail the command', async () => {
  const { code, errors, logs } = await stubbedRun({
    argv: [],
    measurements: [measurement({ largestContentfulPaintMs: 4200 })],
  });

  assert.equal(code, 0, 'the bare measurement command reports, it does not gate');
  assert.equal(errors, '');
  assert.match(logs, /home\s+4200 ms/, 'the measurement is still printed');
});

test('the run writes a report carrying the measurements and the verdict', async () => {
  const { measuredPages, reports } = await stubbedRun({
    argv: ['--check'],
    measurements: [measurement({ largestContentfulPaintMs: 4200, name: 'slow', path: '/slow/' })],
  });

  assert.deepEqual(measuredPages, [{ name: 'slow', path: '/slow/' }], 'the budget decides what is measured');
  assert.equal(reports.length, 1, 'evidence is written whether or not the check passes');
  assert.equal(reports[0].lighthouseVersion, '13.4.1');
  assert.deepEqual(reports[0].budget, BUDGET);
  assert.equal(reports[0].pages.length, 1);
  assert.equal(reports[0].violations.length, 1);
});

// The exit code only matters if the file wired to `docs:vitals:check` actually runs `run` and
// hands its result to the process. Nothing else in this suite executes the entrypoint.
test('the CLI entrypoint fails loudly when the measurement cannot run', async () => {
  const emptyDir = await mkdtemp(path.join(tmpdir(), 'beeui-vitals-cli-'));
  try {
    // Lighthouse is launched through `pnpm`; an empty PATH makes that unreachable, so the run
    // fails early instead of measuring for minutes.
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [SCRIPT_FILE, '--check'], {
        env: { ...process.env, PATH: emptyDir },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stderr, stdout }));
    });

    assert.equal(result.code, 1, `expected a failing exit code, got ${result.code}\n${result.stdout}${result.stderr}`);
    assert.match(
      result.stderr,
      /Could not start Lighthouse|Lighthouse exited|No built portal/,
      'the failure has to say what went wrong',
    );
  } finally {
    await rm(emptyDir, { force: true, recursive: true });
  }
});

test('--no-sandbox is used only where the sandbox cannot work', () => {
  assert.deepEqual(chromeFlagsFor({ ci: undefined, uid: 501 }), [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
  ]);
  assert.ok(chromeFlagsFor({ uid: 0 }).includes('--no-sandbox'), 'root cannot use the Chrome sandbox');
  assert.ok(chromeFlagsFor({ ci: 'true', uid: 501 }).includes('--no-sandbox'), 'CI runners cannot either');
  for (const environment of [{}, { uid: 0 }, { ci: '1' }]) {
    assert.ok(chromeFlagsFor(environment).includes('--headless=new'), 'every run is headless');
  }
});
