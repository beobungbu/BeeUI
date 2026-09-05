#!/usr/bin/env node

// Search-intent regression check for the documentation portal (#474 WBS-H075).
//
// WBS-H075's scoring pass found that 3 of 15 #466 acceptance queries did not surface their
// owning page in the top 3 Pagefind results (`add BeeUI to Expo`, `beeui add`,
// `provider not found`). The fix was: (a) phrase the real heading/first sentence of the owning
// hand-authored page the way a reader would ask for it, and (b) turn off Pagefind's page-length
// ranking normalization (`pageLength: 0` in apps/docs/pagefind-ranking.mjs), because the 63
// generated component pages share one near-identical template whose boilerplate outranks a
// short page that answers the query directly. This script guards both halves. Which half
// carries which query is measured, not assumed: with normalization restored to 0.75 the three
// originally-reported queries still pass and `safe area duplicated` is the one that fails.
//
// WHAT THIS CHECK PROVES
//   - The page a maintainer says should own a query is present in Pagefind's real built index
//     for that query, and ranks in the configured top N (default 3, matching #466's "acceptance
//     queries must ... surface [the right page]" bar).
//   - It runs against the actual built `apps/docs/dist/pagefind` index using Pagefind's own
//     search engine (via `pagefind.js`'s `createInstance` API, no browser required), with the
//     same ranking weights configured in apps/docs/astro.config.mjs's `starlight({ pagefind })`
//     option — both import that object from apps/docs/pagefind-ranking.mjs, so this check
//     cannot score against weights the built site does not actually use.
//
// WHAT THIS CHECK DOES NOT PROVE
//   - It is not a full ranking/relevance test: it only asserts membership in the top N, not the
//     exact order within that window, and it does not evaluate result quality for queries outside
//     QUERY_MATRIX below.
//   - It does not test the search UI itself (keyboard behavior, result grouping display, mobile
//     drawer) — see apps/visual-regression for UI-level coverage.
//   - It does not test typo tolerance, non-English queries, or queries a reader might phrase
//     differently from QUERY_MATRIX; it only proves the *listed* intents are covered.
//   - A pass here does not mean the page content is good — only that Pagefind indexes it for the
//     terms a reader is expected to search.
//
//   node scripts/check-docs-search-intent.mjs           # report top matches per query
//   node scripts/check-docs-search-intent.mjs --check   # fail if any query misses its page
//
// ENFORCEMENT: this runs from `apps/docs`'s build script, because it needs apps/docs/dist.
// On CI that build happens inside `web-a11y`'s Playwright webServer, so this check fails the
// job when it fails — but only when the visual lane is selected. `scripts/ci-scope.mjs` selects
// that lane for the whole `apps/docs/` tree and for this script, so a change that could break
// this check also starts the job that runs it.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS_DIST_DIR = path.join(ROOT_DIR, 'apps/docs/dist');

// The exact object apps/docs/astro.config.mjs hands Starlight. Re-exported rather than
// restated: a copy here could drift from production ranking and let this check pass against
// weights the site does not use.
export { PAGEFIND_RANKING as RANKING } from '../apps/docs/pagefind-ranking.mjs';
import { PAGEFIND_RANKING as RANKING } from '../apps/docs/pagefind-ranking.mjs';

export const TOP_N = 3;

// query -> the page a reader typing that query should land on. Extend this list as new
// acceptance queries are identified (#466 lists: component name, API/prop symbol, task, pattern,
// troubleshooting symptom, concept).
export const QUERY_MATRIX = [
  { query: 'Button', expect: '/components/button/' },
  { query: 'SelectValue', expect: '/components/select/' },
  { query: 'useToast', expect: '/components/toast/' },
  { query: 'TableCaption', expect: '/components/table/' },
  { query: 'BeeUIProvider', expect: '/start/provider-safe-area/' },
  { query: 'checkout', expect: '/patterns/commerce-social/checkout-screen/' },
  { query: 'sign in', expect: '/patterns/auth/sign-in-screen/' },
  { query: 'source ownership', expect: '/guides/cli-source-ownership/' },
  { query: 'responsive', expect: '/learn/responsive-model/' },
  // Was `color.bg.default`, a token that does not exist — `tokens.json` has no `bg`, so that
  // query proved nothing about token search. These are real token names.
  { query: 'color surface-muted', expect: '/reference/tokens/' },
  { query: 'surface-raised', expect: '/reference/tokens/' },
  { query: 'dynamic type', expect: '/accessibility/large-text/' },
  { query: 'home indicator', expect: '/guides/troubleshooting/' },
  { query: 'add BeeUI to Expo', expect: '/start/expo/' },
  { query: 'beeui add', expect: '/guides/cli-source-ownership/' },
  { query: 'provider not found', expect: '/guides/troubleshooting/' },
  { query: 'safe area duplicated', expect: '/guides/troubleshooting/' },
  { query: 'reduced motion', expect: '/accessibility/reduced-motion/' },
];

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

function serveDist(distDir) {
  return new Promise((resolveReady, rejectReady) => {
    const server = createServer(async (req, res) => {
      try {
        const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        let filePath = path.join(distDir, requestPath);
        const stats = await stat(filePath).catch(() => null);
        if (stats?.isDirectory()) filePath = path.join(filePath, 'index.html');
        const body = await readFile(filePath);
        res.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.on('error', rejectReady);
    server.listen(0, '127.0.0.1', () => resolveReady(server));
  });
}

// Pagefind returns absolute URLs derived from the basePath we supplied for fetching; strip that
// fake local origin back down to a site-relative path (e.g. `/components/button/`) so results
// are comparable to `expect` regardless of which port the fixture server happened to bind.
export function toSitePath(absoluteUrl) {
  return new URL(absoluteUrl).pathname;
}

// Runs QUERY_MATRIX against a built Pagefind index (a directory containing a `pagefind/`
// subfolder, typically DOCS_DIST_DIR) and returns one result row per query: the top N page URLs
// (site-relative, e.g. `/components/button/`) and whether `expect` is among them.
export async function runQueryMatrix(distDir = DOCS_DIST_DIR, { matrix = QUERY_MATRIX, topN = TOP_N, ranking = RANKING } = {}) {
  const pagefindEntry = path.join(distDir, 'pagefind', 'pagefind.js');
  const entryStats = await stat(pagefindEntry).catch(() => null);
  if (!entryStats) {
    throw new Error(`No Pagefind index at ${pagefindEntry}. Run the docs build first (pnpm docs:build).`);
  }

  const server = await serveDist(distDir);
  const { port } = server.address();
  try {
    const pagefindModule = await import(pagefindEntry);
    const instance = pagefindModule.createInstance({ basePath: `http://127.0.0.1:${port}/pagefind/` });
    await instance.init();
    await instance.options({ ranking });

    const results = [];
    for (const { query, expect } of matrix) {
      const search = await instance.search(query);
      const top = await Promise.all(search.results.slice(0, topN).map((result) => result.data()));
      const urls = top.map((entry) => toSitePath(entry.url));
      results.push({ query, expect, urls, pass: urls.includes(expect) });
    }
    return results;
  } finally {
    server.close();
  }
}

async function main() {
  const results = await runQueryMatrix();
  const failures = results.filter((r) => !r.pass);

  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`${status}  "${r.query}" -> expect ${r.expect}  got [${r.urls.join(', ')}]`);
  }
  console.log(`\n${results.length - failures.length}/${results.length} queries surfaced their page in the top ${TOP_N}.`);

  if (process.argv.includes('--check') && failures.length) {
    console.error(
      `\n${failures.length} quer${failures.length === 1 ? 'y misses' : 'ies miss'} its owning page: ` +
        `${failures.map((f) => `"${f.query}"`).join(', ')}. Make the owning page say the thing a reader ` +
        'searched for, rather than adding unrelated keywords elsewhere.',
    );
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
