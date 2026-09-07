import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { FALLBACK_MIN_RESULTS, QUERY_STOPWORDS, normaliseQuery, searchWithFallback } from '../../apps/docs/pagefind-query.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEARCH_OVERRIDE = path.join(ROOT_DIR, 'apps/docs/src/components/Search.astro');
const ASTRO_CONFIG = path.join(ROOT_DIR, 'apps/docs/astro.config.mjs');
const INTENT_CHECK = path.join(ROOT_DIR, 'scripts/check-docs-search-intent.mjs');
const PAGEFIND_SHIM = path.join(ROOT_DIR, 'apps/docs/public/pagefind-fallback/pagefind.js');
const DOCS_DIST_DIR = path.join(ROOT_DIR, 'apps/docs/dist');

// Pagefind requires every term to occur on a page, so a question phrased the way a reader
// types it ("how do I show a loading spinner on a button") returned nothing while the content
// terms alone ranked the right page first. The normaliser removes only scaffolding.
test('normaliseQuery drops question scaffolding and function words, keeps content terms', () => {
  assert.equal(normaliseQuery('how do I show a loading spinner on a button while it submits'), 'show loading spinner button submits');
  assert.equal(normaliseQuery('is BeeUI on npm'), 'beeui npm');
  assert.equal(normaliseQuery('how many toasts can be on screen at once'), 'toasts screen');
});

test('normaliseQuery expands contractions so negation survives as a content term', () => {
  assert.equal(normaliseQuery("my popover / select isn't showing up at all"), 'popover select not showing up');
  assert.equal(normaliseQuery("there's no onValueChange"), 'no onvaluechange');
});

test('normaliseQuery leaves domain words and phrasal-verb particles alone', () => {
  for (const word of ['component', 'screen', 'provider', 'native', 'web', 'expo', 'not', 'no', 'vs', 'up', 'use', 'get', 'make']) {
    assert.equal(QUERY_STOPWORDS.has(word), false, `${word} must reach the index`);
  }
  assert.equal(normaliseQuery('controlled vs uncontrolled'), 'controlled vs uncontrolled');
  assert.equal(normaliseQuery('provider not found'), 'provider not found');
  assert.equal(normaliseQuery('sign up screen example'), 'sign up screen example');
  assert.equal(normaliseQuery('set up the provider'), 'set up provider');
});

test("normaliseQuery keeps 'to' only between two content terms, never alone", () => {
  assert.equal(normaliseQuery('right to left'), 'right to left');
  assert.equal(normaliseQuery('add BeeUI to Expo'), 'add beeui to expo');
  assert.equal(normaliseQuery('how to use it'), 'use');
  assert.equal(normaliseQuery('how to use beeui'), 'use beeui');
  assert.equal(normaliseQuery('to'), 'to');
});

test('normaliseQuery keeps identifiers a reader pastes intact', () => {
  assert.equal(normaliseQuery('@beemvp/beeui-ui'), '@beemvp/beeui-ui');
  assert.equal(normaliseQuery('surface-raised'), 'surface-raised');
  assert.equal(normaliseQuery('popover / select'), 'popover select');
});

test('normaliseQuery returns the original query when nothing but scaffolding remains', () => {
  assert.equal(normaliseQuery('how do I'), 'how do I');
  assert.equal(normaliseQuery('  the  '), 'the');
  assert.equal(normaliseQuery(''), '');
});

test("normaliseQuery does not touch Pagefind's own query syntax", () => {
  assert.equal(normaliseQuery('"safe area" duplicated'), '"safe area" duplicated');
  assert.equal(normaliseQuery('provider -expo'), 'provider -expo');
  assert.equal(normaliseQuery('what is the offset -4 for'), 'offset -4');
  assert.equal(normaliseQuery('how do I "use" it'), 'how do I "use" it');
});

test('a single stray quote is not exact-phrase syntax', () => {
  assert.equal(normaliseQuery('how do I add a " to a label'), 'add label');
});

test('normaliseQuery passes non-strings through unchanged', () => {
  assert.equal(normaliseQuery(undefined), undefined);
  assert.equal(normaliseQuery(null), null);
});

// --- searchWithFallback -------------------------------------------------------------------
//
// A stub with Pagefind's `search(term, options)` shape, driven by an explicit term -> page-ids
// map. Real Pagefind needs a built WASM index over the real site (see
// check-docs-search-intent.test.mjs for the end-to-end pass); these assert the relaxation rule
// itself, where every input is chosen rather than measured.
function stubSearcher(index) {
  const calls = [];
  return {
    calls,
    async search(term) {
      calls.push(term);
      const ids = index[term] ?? [];
      // Descending score, so score order and listing order agree and a reordering is visible.
      return { results: ids.map((id, i) => ({ id, score: 100 - i })), unfilteredResultCount: ids.length };
    },
  };
}

const idsOf = (result) => result.results.map((entry) => entry.id);

test('searchWithFallback leaves a query alone when the AND already fills the result window', async () => {
  const searcher = stubSearcher({ 'loading spinner button': ['a', 'b', 'c'] });
  const result = await searchWithFallback(searcher, 'loading spinner button');

  assert.equal(FALLBACK_MIN_RESULTS, 3);
  assert.deepEqual(idsOf(result), ['a', 'b', 'c']);
  assert.deepEqual(searcher.calls, ['loading spinner button'], 'a healthy query must cost exactly one search');
});

test('searchWithFallback appends relaxed pages after the AND, never reordering it', async () => {
  const searcher = stubSearcher({
    'avatar initials fallback': ['and-hit'],
    'avatar initials': ['and-hit', 'both'],
    'initials fallback': ['both', 'one'],
  });
  const result = await searchWithFallback(searcher, 'avatar initials fallback');

  // 'and-hit' matched every term, so it stays first even though 'both' matched more windows.
  // 'both' matched two of the two-term windows, 'one' matched a single window.
  assert.deepEqual(idsOf(result), ['and-hit', 'both', 'one']);
});

test('searchWithFallback relaxes by the smallest amount first, then widens', async () => {
  const searcher = stubSearcher({
    'a b c d': [],
    'a b c': ['near'],
    'b c d': [],
    'a b': ['far'],
    'b c': ['far', 'edge'],
    'c d': ['other'],
  });
  const result = await searchWithFallback(searcher, 'a b c d');

  // Three-term windows are asked before two-term ones, so 'near' outranks anything a pair found;
  // inside the pair rung 'far' matched two windows and 'edge'/'other' one each.
  assert.deepEqual(idsOf(result).slice(0, 2), ['near', 'far']);
  assert.deepEqual(searcher.calls.slice(0, 3), ['a b c d', 'a b c', 'b c d']);
});

test('searchWithFallback keeps widening until the result window is full', async () => {
  const searcher = stubSearcher({ 'a b c d': [], 'a b c': ['one'], 'b c d': [], 'a b': ['two'], 'b c': [], 'c d': ['three'] });
  const result = await searchWithFallback(searcher, 'a b c d');

  assert.deepEqual(idsOf(result), ['one', 'two', 'three']);
  assert.ok(searcher.calls.includes('a b'), 'one relaxed hit is not enough to stop relaxing');
});

test('searchWithFallback stops relaxing as soon as the window is full', async () => {
  const searcher = stubSearcher({ 'a b c d': [], 'a b c': ['one', 'two', 'three'], 'b c d': [] });
  await searchWithFallback(searcher, 'a b c d');

  assert.deepEqual(searcher.calls, ['a b c d', 'a b c', 'b c d'], 'no pair search once triples answered the query');
});

test('searchWithFallback ranks a relaxed page by how much of the query it answered', async () => {
  const searcher = stubSearcher({
    'a b c': [],
    // 'dense' is Pagefind's top hit for one window; 'broad' answers two of them at equal score.
    'a b': ['dense', 'broad'],
    'b c': ['broad'],
  });
  const result = await searchWithFallback(searcher, 'a b c');

  assert.deepEqual(idsOf(result), ['broad', 'dense']);
});

test('searchWithFallback bounds the ladder so a pasted sentence cannot fan out without limit', async () => {
  const terms = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'];
  const searcher = stubSearcher({});
  await searchWithFallback(searcher, terms.join(' '));

  assert.equal(searcher.calls[0], terms.join(' '), 'the reader\'s whole query is still asked in full');
  for (const call of searcher.calls.slice(1)) {
    assert.ok(!call.includes('t9') && !call.includes('t10'), `relaxation ran past the term bound: ${call}`);
  }
});

test('searchWithFallback never lists the same page twice', async () => {
  const searcher = stubSearcher({ 'a b c': ['dupe'], 'a b': ['dupe', 'fresh'], 'b c': ['dupe'] });
  const result = await searchWithFallback(searcher, 'a b c');

  assert.deepEqual(idsOf(result), ['dupe', 'fresh']);
});

test('searchWithFallback does not relax a single term, which has nothing narrower to ask', async () => {
  const searcher = stubSearcher({ SelectValue: ['only'] });
  const result = await searchWithFallback(searcher, 'SelectValue');

  assert.deepEqual(idsOf(result), ['only']);
  assert.deepEqual(searcher.calls, ['SelectValue']);
});

test("searchWithFallback does not relax a reader's own Pagefind syntax", async () => {
  const quoted = stubSearcher({ '"safe area" duplicated': [] });
  assert.deepEqual(idsOf(await searchWithFallback(quoted, '"safe area" duplicated')), []);
  assert.deepEqual(quoted.calls, ['"safe area" duplicated'], 'an exact phrase that matches nothing must stay empty');

  const excluded = stubSearcher({ 'provider -expo': [] });
  assert.deepEqual(excluded.calls.length, 0);
  await searchWithFallback(excluded, 'provider -expo');
  assert.deepEqual(excluded.calls, ['provider -expo'], 'an exclusion the reader typed must not be widened around');
});

test('searchWithFallback preserves the rest of the Pagefind result envelope', async () => {
  const searcher = stubSearcher({ 'a b': [], a: ['x'], b: ['y'] });
  const result = await searchWithFallback(searcher, 'a b');

  // Deliberate: `unfilteredResultCount` keeps counting what the AND matched before filters. The
  // union's pages come from different queries, so no honest number exists for it, and PagefindUI
  // reads only `results.length`.
  assert.equal(result.unfilteredResultCount, 0, 'the AND-side envelope is passed through untouched');
  assert.deepEqual(idsOf(result), ['x', 'y']);
});

// A `sort` is a total order over a page value that the caller asked for. Appending relaxed pages
// after the AND's would break it, so a sorted search is answered by the AND alone.
test('searchWithFallback does not relax a search that asked for an explicit sort', async () => {
  const searcher = stubSearcher({ 'a b': [], a: ['x'], b: ['y'] });
  const sorted = await searchWithFallback(searcher, 'a b', { sort: { date: 'desc' } });

  assert.deepEqual(idsOf(sorted), []);
  assert.deepEqual(searcher.calls, ['a b'], 'a sorted search must cost exactly one search');
  assert.deepEqual(idsOf(await searchWithFallback(searcher, 'a b', { filters: {} })), ['x', 'y']);
});

// The ladder issues up to 35 extra index queries, each of which fetches a chunk over the network
// in the browser. PagefindUI has no try/catch around its search call, so an error escaping the
// ladder both discards the results the AND found and leaves the modal loading forever.
test('searchWithFallback survives a window search that rejects, keeping what the AND found', async () => {
  const calls = [];
  const searcher = {
    async search(term) {
      calls.push(term);
      if (term === 'a b c') return { results: [{ id: 'and-hit', score: 9 }], unfilteredResultCount: 1 };
      if (term === 'a b') throw new Error('failed to fetch index chunk');
      return { results: [{ id: 'relaxed', score: 1 }], unfilteredResultCount: 1 };
    },
  };

  const result = await searchWithFallback(searcher, 'a b c');

  assert.deepEqual(idsOf(result), ['and-hit', 'relaxed'], 'the AND hit survives and the windows that did answer still count');
  assert.ok(calls.includes('b c'), 'one failed window must not abandon the rest of the ladder');
});

test('searchWithFallback survives a window search that resolves a malformed envelope', async () => {
  const shapes = [{}, null, { results: null }, { results: [null] }, { results: 'nope' }, { results: 42 }];
  for (const shape of shapes) {
    const searcher = {
      async search(term) {
        if (term === 'a b c') return { results: [{ id: 'and-hit', score: 9 }], unfilteredResultCount: 1 };
        if (term === 'a b') return shape;
        return { results: [{ id: 'relaxed', score: 1 }], unfilteredResultCount: 1 };
      },
    };

    const result = await searchWithFallback(searcher, 'a b c');
    assert.deepEqual(idsOf(result), ['and-hit', 'relaxed'], `a ${JSON.stringify(shape)} envelope must not lose the AND's results`);
  }
});

test('searchWithFallback returns exactly the AND result when every window fails', async () => {
  const primary = { results: [{ id: 'and-hit', score: 9 }], unfilteredResultCount: 1 };
  const searcher = {
    async search(term) {
      if (term === 'a b c') return primary;
      throw new Error('index unreachable');
    },
  };

  const result = await searchWithFallback(searcher, 'a b c');
  assert.equal(result, primary, 'a ladder that finds nothing must hand back the untouched AND envelope');
});

// The browser UI and the search-intent check must issue the same rewritten query, otherwise the
// check measures a search the portal never runs. Both wirings are asserted on the source text.
test('the Search override passes normaliseQuery to PagefindUI as processTerm', () => {
  const source = fs.readFileSync(SEARCH_OVERRIDE, 'utf8');
  assert.match(source, /import \{ normaliseQuery \} from '\.\.\/\.\.\/pagefind-query\.mjs';/u);
  assert.match(source, /processTerm: normaliseQuery,/u);
});

test('astro.config registers the Search override, so the copy is what ships', () => {
  const source = fs.readFileSync(ASTRO_CONFIG, 'utf8');
  assert.match(source, /Search: '\.\/src\/components\/Search\.astro',/u);
});

test('the search-intent check issues the portal search: same normaliser, same fallback', () => {
  const source = fs.readFileSync(INTENT_CHECK, 'utf8');
  assert.match(source, /from '\.\.\/apps\/docs\/pagefind-query\.mjs'/u);
  assert.match(source, /searchWithFallback\(instance, normaliseQuery\(query\)\)/u);
  assert.doesNotMatch(source, /instance\.search\(/u, 'a bare instance.search would measure a search no reader runs');
});

// PagefindUI has no post-search hook and the module it imports is sealed, so the only way the
// browser can relax a starved query is to be handed a different Pagefind entrypoint. These three
// assertions are the whole chain: the modal points at the shim, the shim wraps the real engine
// with the shared helper, and the build ships the helper next to the shim.
test('the Search override loads the fallback Pagefind entrypoint rather than the bare one', () => {
  const source = fs.readFileSync(SEARCH_OVERRIDE, 'utf8');
  assert.match(source, /bundlePath: import\.meta\.env\.BASE_URL\.replace\(\/\\\/\$\/, ''\) \+ '\/pagefind-fallback\/',/u);
});

test('the fallback entrypoint re-exports Pagefind with search wrapped in searchWithFallback', () => {
  const source = fs.readFileSync(PAGEFIND_SHIM, 'utf8');
  assert.match(source, /import \* as pagefind from '\.\.\/pagefind\/pagefind\.js';/u);
  assert.match(source, /import \{ searchWithFallback \} from '\.\/pagefind-query\.mjs';/u);
  assert.match(source, /export const search = \(term, searchOptions\) => searchWithFallback\(pagefind, term, searchOptions\);/u);
});

// Anything the shim forgets to forward is an export PagefindUI silently loses, and a name that
// merely appears in the source text proves nothing — this imports both modules and compares what
// they actually export. The real engine only exists after a build, so it skips without one.
test('the fallback entrypoint exports exactly what the real Pagefind engine does', async (t) => {
  const builtShim = path.join(DOCS_DIST_DIR, 'pagefind-fallback', 'pagefind.js');
  const builtEngine = path.join(DOCS_DIST_DIR, 'pagefind', 'pagefind.js');
  if (!fs.existsSync(builtShim) || !fs.existsSync(builtEngine)) {
    t.skip('apps/docs/dist is not built in this environment; run `pnpm docs:build` first');
    return;
  }

  const [shim, engine] = await Promise.all([
    import(pathToFileURL(builtShim).href),
    import(pathToFileURL(builtEngine).href),
  ]);

  assert.deepEqual(Object.keys(shim).sort(), Object.keys(engine).sort(), 'the shim must export the same names as the engine it replaces');
  for (const name of Object.keys(engine)) {
    if (name === 'search') continue;
    assert.equal(shim[name], engine[name], `${name} must be the engine's own export, not a copy`);
  }
  assert.notEqual(shim.search, engine.search, 'search is the one export the shim replaces');
});

// The shim wraps the module-level `search` only, so the relaxation reaches the reader only while
// PagefindUI keeps calling that export. It does today (@pagefind/default-ui 1.5.2 calls
// `pagefind.search(` once and never `debouncedSearch` or `createInstance` on the namespace). A
// version that switched would silently drop the ladder in the browser while every check here and
// scripts/check-docs-search-intent.mjs stayed green, so the installed dependency is asserted.
test('PagefindUI still searches through the module-level export the shim wraps', () => {
  const require = createRequire(path.join(ROOT_DIR, 'apps/docs/package.json'));
  const manifestPath = require.resolve('@pagefind/default-ui/package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const entry of [manifest.module, manifest.main]) {
    const source = fs.readFileSync(path.join(path.dirname(manifestPath), entry), 'utf8');
    assert.match(source, /pagefind\.search\(/u, `${entry} no longer calls the wrapped module-level search; the browser would run no fallback`);
    assert.doesNotMatch(source, /pagefind\.debouncedSearch\(/u, `${entry} now searches through debouncedSearch, which the shim does not wrap`);
    assert.doesNotMatch(source, /pagefind\.createInstance\(/u, `${entry} now searches through a createInstance handle, which the shim does not wrap`);
  }
});

test('astro.config ships pagefind-query.mjs beside the fallback entrypoint', () => {
  const source = fs.readFileSync(ASTRO_CONFIG, 'utf8');
  assert.match(source, /name: 'pagefind-fallback-runtime'/u);
  assert.match(source, /'astro:build:done'/u);
  assert.match(source, /new URL\('\.\/pagefind-query\.mjs', import\.meta\.url\)/u);
});

// The override is Starlight's own Search.astro plus two additions and one edited line, with the
// one relative import that cannot resolve from outside Starlight's package rewritten to its
// public path. When Starlight upgrades, this fails until the copy is refreshed, so the portal
// never silently runs a stale search modal — and an unlisted local change fails it too, so the
// vendored copy cannot quietly accumulate.
test('the Search override is upstream Starlight Search.astro plus only the search wiring', () => {
  const require = createRequire(path.join(ROOT_DIR, 'apps/docs/package.json'));
  const upstream = fs.readFileSync(require.resolve('@astrojs/starlight/components/Search.astro'), 'utf8');
  const override = fs.readFileSync(SEARCH_OVERRIDE, 'utf8');

  const additions = [
    /^\timport \{ normaliseQuery \} from '\.\.\/\.\.\/pagefind-query\.mjs';\n/mu,
    /^\t+\/\/ Drops question scaffolding[^\n]*\n\t+\/\/ scripts\/check-docs-search-intent\.mjs[^\n]*\n\t+processTerm: normaliseQuery,\n/mu,
    /^\t+\/\/ Upstream loads `\/pagefind\/pagefind\.js`[^\n]*\n(?:\t+\/\/[^\n]*\n){3}/mu,
  ];
  // The only upstream line this copy edits: the Pagefind entrypoint PagefindUI imports.
  const editedLines = [
    [
      "bundlePath: import.meta.env.BASE_URL.replace(/\\/$/, '') + '/pagefind-fallback/',",
      "bundlePath: import.meta.env.BASE_URL.replace(/\\/$/, '') + '/pagefind/',",
    ],
  ];

  let stripped = override.replace(
    "import { Icon } from '@astrojs/starlight/components';",
    "import Icon from '../user-components/Icon.astro';",
  );
  for (const addition of additions) {
    assert.match(stripped, addition, 'expected addition missing from the override');
    stripped = stripped.replace(addition, '');
  }
  for (const [ours, theirs] of editedLines) {
    assert.ok(stripped.includes(ours), `expected edited line missing from the override: ${ours}`);
    stripped = stripped.replace(ours, theirs);
  }
  assert.equal(stripped, upstream, 'Search.astro override differs from upstream Starlight beyond the listed search wiring; re-copy upstream and re-apply the additions and the bundlePath edit');
});

// Before the ladder existed, exactly one search could hang the modal; a ten-term query now issues
// up to 36 in sequence, so a window that never settles must be abandoned rather than awaited.
test('searchWithFallback abandons a window search that never settles', { timeout: 5000 }, async () => {
  let settled = false;
  const searcher = {
    async search(term) {
      if (term === 'a b c') return { results: [{ id: 'and-hit', score: 9 }], unfilteredResultCount: 1 };
      if (term === 'a b') return new Promise(() => {});
      return { results: [{ id: 'relaxed', score: 1 }], unfilteredResultCount: 1 };
    },
  };

  const result = await searchWithFallback(searcher, 'a b c', undefined, { timeoutMs: 20 });
  settled = true;

  assert.equal(settled, true, 'the search must settle even though one window never does');
  assert.deepEqual(idsOf(result), ['and-hit', 'relaxed'], 'a hung window costs its own results, never the AND\'s');
});

test('a non-positive timeout runs the window search without a deadline', async () => {
  const searcher = {
    async search(term) {
      if (term === 'a b c') return { results: [{ id: 'and-hit', score: 9 }], unfilteredResultCount: 1 };
      return { results: [{ id: 'relaxed', score: 1 }], unfilteredResultCount: 1 };
    },
  };

  const result = await searchWithFallback(searcher, 'a b c', undefined, { timeoutMs: 0 });
  assert.deepEqual(idsOf(result), ['and-hit', 'relaxed']);
});
