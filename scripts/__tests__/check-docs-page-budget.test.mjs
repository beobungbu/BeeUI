import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DOCS_DIST_DIR, PAGE_BUDGET, collectPageBudgetViolations, measureDocsPages } from '../check-docs-page-budget.mjs';

// H073 asked for template budgets. Page weight was measured and nothing enforced it, so a page
// could grow unnoticed — which already happened once, when 51 component pages carried the same
// 1083-line file and no check said a word.

function distFixture(pages) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-page-budget-'));
  for (const [relative, html] of Object.entries(pages)) {
    const file = path.join(rootDir, DOCS_DIST_DIR, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
  return rootDir;
}

function withFixture(pages, assertions) {
  const rootDir = distFixture(pages);
  try {
    assertions(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('a page within budget passes', () => {
  withFixture({ 'index.html': '<p>small</p>' }, (rootDir) => {
    assert.deepEqual(collectPageBudgetViolations(rootDir), []);
  });
});

// Incompressible bytes are what a reader actually downloads. Genuinely random data, not a
// periodic sequence: an earlier version used `i * 7919 % 90`, which gzip compressed happily and
// tripped only the raw budget — the test passed for the wrong reason.
test('a page over the gzipped budget is reported', () => {
  const random = randomBytes(PAGE_BUDGET.gzippedHtmlBytes + 4096).toString('base64');
  withFixture({ 'index.html': random }, (rootDir) => {
    const violations = collectPageBudgetViolations(rootDir);
    assert.ok(violations.some((v) => /gzipped, over the/u.test(v)), violations.join(' | '));
  });
});

// The 1083-line dumps compressed beautifully, so a gzip-only budget would have missed them.
test('a page that is huge but compressible is still reported', () => {
  withFixture({ 'index.html': 'x'.repeat(PAGE_BUDGET.rawHtmlBytes + 1) }, (rootDir) => {
    const violations = collectPageBudgetViolations(rootDir);
    assert.ok(violations.some((v) => /uncompressed, over the/u.test(v)), violations.join(' | '));
    assert.equal(violations.some((v) => /gzipped, over the/u.test(v)), false, 'compressible content must not trip the gzip budget');
  });
});

test('shared assets are budgeted separately, because every page pays them', () => {
  withFixture({ 'index.html': '<p>ok</p>' }, (rootDir) => {
    const assetDir = path.join(rootDir, DOCS_DIST_DIR, '_astro');
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(path.join(assetDir, 'big.js'), 'x'.repeat(PAGE_BUDGET.sharedAssetBytes + 1));
    assert.ok(collectPageBudgetViolations(rootDir).some((v) => /shared assets/u.test(v)));
  });
});

// An empty dist must be an error, not a pass: "nothing to measure" is how a budget disappears.
test('an empty dist fails rather than passing vacuously', () => {
  withFixture({}, (rootDir) => {
    const violations = collectPageBudgetViolations(rootDir);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /no built pages/u);
  });
});

test('measurement reports both sizes per page', () => {
  withFixture({ 'a/index.html': '<p>a</p>', 'b/index.html': '<p>bb</p>' }, (rootDir) => {
    const { pages } = measureDocsPages(rootDir);
    assert.equal(pages.length, 2);
    for (const page of pages) {
      assert.ok(page.raw > 0);
      assert.ok(page.gzipped > 0);
    }
  });
});
