import assert from 'node:assert/strict';
import test from 'node:test';

import { assertBudgetShape, collectVitalsViolations } from '../check-docs-web-vitals.mjs';
import budgetFile from '../../docs/web-vitals.budget.json' with { type: 'json' };

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
