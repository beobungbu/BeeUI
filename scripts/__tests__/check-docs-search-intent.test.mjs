import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DOCS_DIST_DIR,
  QUERY_MATRIX,
  RANKING,
  runQueryMatrix,
  toSitePath,
} from '../check-docs-search-intent.mjs';

// #474 WBS-H075 found 3 acceptance queries whose owning page did not surface in the top 3
// Pagefind results, because generated boilerplate pages outweighed the real hand-authored page
// on raw term volume. This is the regression guard: it must fail on a build where a query's
// owning page has stopped saying the thing a reader searched for, and pass once it does again.

test('QUERY_MATRIX entries are well-formed', () => {
  assert.ok(QUERY_MATRIX.length > 0);
  for (const entry of QUERY_MATRIX) {
    assert.equal(typeof entry.query, 'string');
    assert.ok(entry.query.length > 0);
    assert.match(entry.expect, /^\//u, `expect must be a site-relative path, got ${entry.expect}`);
  }
});

test('RANKING mirrors the shape apps/docs/astro.config.mjs configures', () => {
  for (const key of ['pageLength', 'termFrequency', 'termSaturation', 'termSimilarity', 'diacriticSimilarity']) {
    assert.equal(typeof RANKING[key], 'number', `RANKING.${key} must be a number`);
  }
  // The whole point of the fix: length normalization must stay off, or a short hand-authored
  // page silently loses to the 63 near-identical generated component pages again.
  assert.equal(RANKING.pageLength, 0);
});

test('toSitePath strips the fixture-server origin back to a site-relative path', () => {
  assert.equal(toSitePath('http://127.0.0.1:54321/components/button/'), '/components/button/');
  assert.equal(toSitePath('https://beeui.beemvp.com/docs/guides/troubleshooting/'), '/docs/guides/troubleshooting/');
});

test('runQueryMatrix throws a clear, actionable error when no Pagefind index exists', async () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-search-intent-'));
  try {
    await assert.rejects(() => runQueryMatrix(emptyDir), /Run the docs build first/u);
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

// This is the real regression proof, but it needs an actual built Pagefind index (a real WASM
// search engine over 152 real pages) — the `pagefind` package that builds one is only reachable
// from inside @astrojs/starlight's own dependency tree, not from scripts/, so a synthetic index
// cannot be constructed here. It runs opportunistically against the checked-out build and skips
// with a clear reason otherwise, matching this repo's existing pattern for environment-dependent
// tests (see scripts/__tests__/beeui.test.mjs).
test('the full query matrix passes against the built docs portal', async (t) => {
  if (!fs.existsSync(path.join(DOCS_DIST_DIR, 'pagefind', 'pagefind.js'))) {
    t.skip('apps/docs/dist is not built in this environment; run `pnpm docs:build` first');
    return;
  }

  const results = await runQueryMatrix();
  const failures = results.filter((result) => !result.pass);
  assert.deepEqual(
    failures.map((f) => f.query),
    [],
    `queries missing their page: ${failures.map((f) => `"${f.query}" -> got ${JSON.stringify(f.urls)}, expected ${f.expect}`).join('; ')}`,
  );
});
