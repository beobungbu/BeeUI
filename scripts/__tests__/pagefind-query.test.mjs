import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { QUERY_STOPWORDS, normaliseQuery } from '../../apps/docs/pagefind-query.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEARCH_OVERRIDE = path.join(ROOT_DIR, 'apps/docs/src/components/Search.astro');
const ASTRO_CONFIG = path.join(ROOT_DIR, 'apps/docs/astro.config.mjs');
const INTENT_CHECK = path.join(ROOT_DIR, 'scripts/check-docs-search-intent.mjs');

// Pagefind requires every term to occur on a page, so a question phrased the way a reader
// types it ("how do I show a loading spinner on a button") returned nothing while the content
// terms alone ranked the right page first. The normaliser removes only scaffolding.
test('normaliseQuery drops question scaffolding and function words, keeps content terms', () => {
  assert.equal(normaliseQuery('how do I show a loading spinner on a button while it submits'), 'show loading spinner button submits');
  assert.equal(normaliseQuery('is BeeUI on npm'), 'beeui npm');
  assert.equal(normaliseQuery('how many toasts can be on screen at once'), 'toasts screen');
});

test('normaliseQuery expands contractions so negation survives as a content term', () => {
  assert.equal(normaliseQuery("my popover / select isn't showing up at all"), 'popover select not showing');
  assert.equal(normaliseQuery("there's no onValueChange"), 'no onvaluechange');
});

test('normaliseQuery leaves domain words alone', () => {
  for (const word of ['component', 'screen', 'provider', 'native', 'web', 'expo', 'not', 'no', 'vs']) {
    assert.equal(QUERY_STOPWORDS.has(word), false, `${word} must reach the index`);
  }
  assert.equal(normaliseQuery('controlled vs uncontrolled'), 'controlled vs uncontrolled');
  assert.equal(normaliseQuery('provider not found'), 'provider not found');
});

test('normaliseQuery returns the original query when nothing but scaffolding remains', () => {
  assert.equal(normaliseQuery('how do I'), 'how do I');
  assert.equal(normaliseQuery('  the  '), 'the');
  assert.equal(normaliseQuery(''), '');
});

test("normaliseQuery does not touch Pagefind's own query syntax", () => {
  assert.equal(normaliseQuery('"safe area" duplicated'), '"safe area" duplicated');
  assert.equal(normaliseQuery('provider -expo'), 'provider -expo');
});

test('normaliseQuery passes non-strings through unchanged', () => {
  assert.equal(normaliseQuery(undefined), undefined);
  assert.equal(normaliseQuery(null), null);
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

test('the search-intent check rewrites each query with the same normaliser before searching', () => {
  const source = fs.readFileSync(INTENT_CHECK, 'utf8');
  assert.match(source, /from '\.\.\/apps\/docs\/pagefind-query\.mjs'/u);
  assert.match(source, /instance\.search\(normaliseQuery\(query\)\)/u);
  assert.doesNotMatch(source, /instance\.search\(query\)/u);
});

// The override is Starlight's own Search.astro plus exactly two additions, with the one
// relative import that cannot resolve from outside Starlight's package rewritten to its public
// path. When Starlight upgrades, this fails until the copy is refreshed, so the portal never
// silently runs a stale search modal.
test('the Search override is upstream Starlight Search.astro plus only the processTerm wiring', () => {
  const require = createRequire(path.join(ROOT_DIR, 'apps/docs/package.json'));
  const upstream = fs.readFileSync(require.resolve('@astrojs/starlight/components/Search.astro'), 'utf8');
  const override = fs.readFileSync(SEARCH_OVERRIDE, 'utf8');

  const additions = [
    /^\timport \{ normaliseQuery \} from '\.\.\/\.\.\/pagefind-query\.mjs';\n/mu,
    /^\t+\/\/ Drops question scaffolding[^\n]*\n\t+\/\/ scripts\/check-docs-search-intent\.mjs[^\n]*\n\t+processTerm: normaliseQuery,\n/mu,
  ];
  let stripped = override.replace(
    "import { Icon } from '@astrojs/starlight/components';",
    "import Icon from '../user-components/Icon.astro';",
  );
  for (const addition of additions) {
    assert.match(stripped, addition, 'expected addition missing from the override');
    stripped = stripped.replace(addition, '');
  }
  assert.equal(stripped, upstream, 'Search.astro override differs from upstream Starlight beyond the processTerm wiring; re-copy upstream and re-apply the two additions');
});
