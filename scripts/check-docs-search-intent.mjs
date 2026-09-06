#!/usr/bin/env node

// Search-intent regression check for the documentation portal (#474 WBS-H075).
//
// WBS-H075's scoring pass found that 3 of 15 #466 acceptance queries did not surface their
// owning page in the top 3 Pagefind results (`add BeeUI to Expo`, `beeui add`,
// `provider not found`). The fix was: (a) phrase the real heading/first sentence of the owning
// hand-authored page the way a reader would ask for it. Turning off Pagefind's page-length
// normalization was also tried and has since been reverted: it rescued one query and broke three
// accessibility intents, because without normalization a long page that merely mentions a term
// beats a short page that is about it (see apps/docs/pagefind-ranking.mjs for the held-out
// measurement). The query it existed for is handled in content instead.
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
//   - The matrix is a LOWER BOUND, not a quality measure, and it does not generalize: it grew by
//     fixing failures one at a time, so passing every entry is close to tautological. Measured
//     against 26 held-out queries an independent scorer wrote, the portal scored 17 (65%) while
//     this matrix read 21/21; a second scorer's 24 held-out queries scored 12 (50%) at 24/24.
//     Treat a green run as "these known intents still work", never as "search is good".
//   - Queries take the same path the portal's search modal takes: apps/docs/pagefind-query.mjs
//     rewrites them, and its searchWithFallback re-asks a starved query in narrower windows.
//     Measured on two held-out sets neither the rewrite nor the fallback was tuned against
//     (26 queries from an independent scorer, 24 written from the route list before this change),
//     the fallback moved strict top-3 from 8/26 to 13/26 and 8/24 to 15/24, and took the queries
//     that returned literally nothing from 7/26 and 7/24 to zero on both. It cannot move this
//     It cannot break an entry in this matrix, by construction: relaxed pages are only appended
//     after whatever the AND already found, never reordered into it. Exactly one entry below
//     depends on it (and says so). The misses that remain on both held-out sets are content the
//     portal does not say, not phrasing.
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
import { normaliseQuery, searchWithFallback } from '../apps/docs/pagefind-query.mjs';

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
  // Core accessibility intents. These were failing under `pageLength: 0` and are the reason it
  // was reverted; they are listed here so the setting cannot be re-disabled unnoticed.
  { query: 'keyboard navigation', expect: '/accessibility/keyboard-focus/' },
  { query: 'focus order', expect: '/accessibility/keyboard-focus/' },
  { query: 'right to left', expect: '/accessibility/rtl/' },
  // Held-out queries an independent scorer found failing (it measured 17 of 26 on queries this
  // matrix did not contain). Each was a real content gap, not a ranking one: the design-token
  // reference never used the phrase 'design tokens', the state model wrote 'controlled or
  // uncontrolled' where readers type 'vs', and the release-status page answered 'is BeeUI on
  // npm' only inside a table row.
  { query: 'design tokens', expect: '/reference/tokens/' },
  { query: 'controlled vs uncontrolled', expect: '/learn/state-model/' },
  { query: 'is BeeUI on npm', expect: '/guides/current-release/' },
  { query: 'add BeeUI to Expo', expect: '/start/expo/' },
  { query: 'beeui add', expect: '/guides/cli-source-ownership/' },
  { query: 'provider not found', expect: '/guides/troubleshooting/' },
  { query: 'safe area duplicated', expect: '/guides/troubleshooting/' },
  { query: 'reduced motion', expect: '/accessibility/reduced-motion/' },
  // Natural-language phrasings. Pagefind requires every term to occur on the page, so these
  // returned nothing or the wrong page until apps/docs/pagefind-query.mjs started stripping
  // question scaffolding before the search; two also needed the owning page to say the word
  // a reader types ('toast notifications', 'Tailwind'). They guard the rewrite as much as the
  // content.
  { query: 'toast notification', expect: '/components/toast/' },
  { query: 'how to override styles with tailwind', expect: '/reference/styling/' },
  { query: 'what versions of react native are supported', expect: '/compatibility/current/' },
  // The one entry that guards a mechanism rather than a page. `put loading spinner inside
  // disabled button` matches no page — Pagefind ANDs all six terms — so this query returns
  // nothing unless searchWithFallback re-asks it in narrower windows. It is here to make the
  // relaxation ladder falsifiable end to end against the real index: delete the ladder and this
  // goes red. It is deliberately not drawn from any held-out set.
  { query: 'put a loading spinner inside a disabled button', expect: '/components/button/' },
];

// The browser cannot import apps/docs/pagefind-query.mjs directly — PagefindUI builds its engine
// specifier as a string — so the built site loads it as a sibling of the entrypoint shim, copied
// into dist by the `pagefind-fallback-runtime` integration in apps/docs/astro.config.mjs. If that
// copy is missing or has drifted, the modal's own `import` 404s and search dies at runtime while
// every unit test still passes, so the build asserts it here instead.
export const SEARCH_RUNTIME_DIR = 'pagefind-fallback';
export async function collectSearchRuntimeProblems(distDir = DOCS_DIST_DIR) {
  const problems = [];
  const shim = path.join(distDir, SEARCH_RUNTIME_DIR, 'pagefind.js');
  const shipped = path.join(distDir, SEARCH_RUNTIME_DIR, 'pagefind-query.mjs');
  const source = path.join(ROOT_DIR, 'apps/docs/pagefind-query.mjs');

  const shimSource = await readFile(shim, 'utf8').catch(() => null);
  if (shimSource === null) {
    problems.push(`${shim} is missing: apps/docs/public/${SEARCH_RUNTIME_DIR}/pagefind.js did not reach the build.`);
  } else if (!shimSource.includes("from './pagefind-query.mjs'")) {
    problems.push(`${shim} no longer imports ./pagefind-query.mjs, so the shipped search runs no fallback.`);
  }

  const [shippedSource, sourceText] = await Promise.all([
    readFile(shipped, 'utf8').catch(() => null),
    readFile(source, 'utf8'),
  ]);
  if (shippedSource === null) {
    problems.push(`${shipped} is missing: the pagefind-fallback-runtime integration did not copy apps/docs/pagefind-query.mjs.`);
  } else if (shippedSource !== sourceText) {
    problems.push(`${shipped} differs from apps/docs/pagefind-query.mjs, so the browser runs a different rewrite than this check.`);
  }
  return problems;
}

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
      // The portal issues exactly this: Search.astro's `processTerm` rewrites the query, and the
      // Pagefind entrypoint it loads (apps/docs/public/pagefind-fallback/pagefind.js) wraps
      // `search` in the same searchWithFallback. Measuring anything else would score a search
      // no reader performs.
      const search = await searchWithFallback(instance, normaliseQuery(query));
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
  const runtimeProblems = await collectSearchRuntimeProblems();

  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`${status}  "${r.query}" -> expect ${r.expect}  got [${r.urls.join(', ')}]`);
  }
  console.log(`\n${results.length - failures.length}/${results.length} queries surfaced their page in the top ${TOP_N}.`);
  for (const problem of runtimeProblems) console.error(`SEARCH RUNTIME  ${problem}`);

  if (process.argv.includes('--check')) {
    if (failures.length) {
      console.error(
        `\n${failures.length} quer${failures.length === 1 ? 'y misses' : 'ies miss'} its owning page: ` +
          `${failures.map((f) => `"${f.query}"`).join(', ')}. Make the owning page say the thing a reader ` +
          'searched for, rather than adding unrelated keywords elsewhere.',
      );
      process.exitCode = 1;
    }
    if (runtimeProblems.length) {
      console.error(
        `\nThe built portal would not run the search this check just measured (${runtimeProblems.length} problem` +
          `${runtimeProblems.length === 1 ? '' : 's'} above).`,
      );
      process.exitCode = 1;
    }
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
