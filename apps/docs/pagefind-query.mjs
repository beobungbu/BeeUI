// Single source of truth for how a reader's query reaches Pagefind: the rewrite that runs
// before the search, and the relaxation that runs after it.
//
// Pagefind requires every term in the query to appear on a page. A reader who types
// "how do I show a loading spinner on a button" therefore gets nothing, because no page
// contains "how", "do", "i", "show", "spinner", "on" and "button" together, while
// "loading spinner button" ranks the Button page first. `normaliseQuery` drops the question
// scaffolding and function words so that only the content terms reach the index.
//
// Dropping scaffolding is not enough on its own, because what is left is still an AND. On 26
// independently written held-out queries the rewrite alone changed the hit/miss outcome on none
// of them and 7 still returned nothing at all: "user avatar initials fallback" matches no page
// even though "avatar initials" ranks Avatar first, and "sign up screen example" returns Sheet
// because the single word "example" is the only page all four terms share. `searchWithFallback`
// answers that class: when the AND finds almost nothing, it asks narrower questions.
//
// No stemming is done here, and none should be added: Pagefind stems index-side. The word
// "paginate" appears on zero built pages, yet searching it returns the same 41 results as
// "pagination", Pagination first. Stemming a query term before Pagefind stems it again would
// only risk producing a form its own stemmer maps somewhere else.
//
// Two callers import this module and must keep using the same functions:
//   - apps/docs/src/components/Search.astro passes `normaliseQuery` to PagefindUI as
//     `processTerm`, and points PagefindUI's `bundlePath` at apps/docs/public/pagefind-fallback/,
//     a Pagefind entrypoint shim that re-exports the real one with `search` wrapped in
//     `searchWithFallback` — PagefindUI has no post-search hook, so wrapping the module it
//     imports is the only place the browser can run the relaxation;
//   - scripts/check-docs-search-intent.mjs calls `searchWithFallback(instance, normaliseQuery(q))`,
//     so the search-intent check measures the search the portal actually issues.
// scripts/__tests__/pagefind-query.test.mjs asserts every one of those wirings, so the browser
// and the check cannot drift into measuring different searches.
//
// The rewrite is deliberately not clever: no synonyms, no spell correction. If every word of a
// query is scaffolding ("how do I"), the original query is returned unchanged rather than an
// empty string, and a query that uses Pagefind's own syntax (a quoted phrase or a leading `-`
// exclusion) is left untouched — by both functions — so exact-match intent still works.

const CONTRACTIONS = [
  [/\bcan't\b/gu, 'can not'],
  [/\bwon't\b/gu, 'will not'],
  [/n't\b/gu, ' not'],
  [/\b(it|that|there|what|here|where|who)'s\b/gu, '$1 is'],
  [/\bi'm\b/gu, 'i am'],
  [/\b(you|we|they)'re\b/gu, '$1 are'],
  [/\b(i|you|we|they)'ve\b/gu, '$1 have'],
  [/\b(i|you|we|they|it)'ll\b/gu, '$1 will'],
  [/\b(i|you|we|they|it)'d\b/gu, '$1 would'],
];

// Words that carry no search intent on this portal. Kept as a flat sorted list so a reviewer can
// scan it; do not add domain words (component, screen, provider, native, web, expo) — those are
// exactly what distinguishes one page from another, and phrasal-verb particles (up, get, use,
// make) are not listed either: "sign up screen" and "set up the provider" lose their meaning
// without them. 'to' is handled positionally below rather than listed here.
export const QUERY_STOPWORDS = new Set([
  'a', 'about', 'actually', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'but', 'by',
  'can', 'could',
  'did', 'do', 'does',
  'for', 'from',
  'had', 'has', 'have', 'here', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'just',
  'later', 'like',
  'many', 'me', 'much', 'my',
  'need',
  'of', 'on', 'once', 'or', 'our', 'own',
  'please',
  'should', 'so', 'some', 'still',
  'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'us',
  'want', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with', 'would',
  'yet', 'you', 'your',
]);

// A quoted phrase (two or more quotes) or a leading `-` exclusion is Pagefind syntax the reader
// chose on purpose; a single stray quote is not.
const PAGEFIND_SYNTAX = /".*"|(^|\s)-\p{L}/u;

// 'to' inside a phrase is content ("right to left", "add BeeUI to Expo"): dropping it turned
// "right to left" into "right left", which ranks the safe-area page (edges: left/right) above
// the RTL page. 'to' next to a dropped word is scaffolding ("how to use it") and would
// otherwise survive on its own as the whole query.
function keepsPositionalTo(terms, index) {
  const previous = terms[index - 1];
  const next = terms[index + 1];
  return previous !== undefined && next !== undefined && !QUERY_STOPWORDS.has(previous) && !QUERY_STOPWORDS.has(next);
}

export function normaliseQuery(query) {
  if (typeof query !== 'string') return query;
  const original = query.trim();
  if (original === '' || PAGEFIND_SYNTAX.test(original)) return original;

  let text = original.toLowerCase();
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);

  // Only sentence punctuation is treated as a separator. `/` and `\` are deliberately not in
  // the class, so a pasted `@beemvp/beeui-ui` reaches the index intact; a token that carries no
  // letter or digit (a lone `/`) is dropped.
  const tokens = text
    .replace(/[?!,;:()[\]{}|]+/gu, ' ')
    .split(/\s+/u)
    .filter((term) => /[\p{L}\p{N}]/u.test(term));
  const terms = tokens.filter(
    (term, index) => (term === 'to' ? keepsPositionalTo(tokens, index) : !QUERY_STOPWORDS.has(term)),
  );

  return terms.length === 0 ? original : terms.join(' ');
}

// A search that returns two pages and a search that returns none are the same failure to a
// reader, so the threshold is the size of the result window the portal shows first, not 1.
export const FALLBACK_MIN_RESULTS = 3;

// A reader can paste an arbitrarily long sentence. Relaxation is quadratic in the term count
// (every window width, every offset), so the ladder is built from at most this many terms;
// beyond it the query is already specific enough that the AND is the problem, not the recall.
const MAX_RELAXED_TERMS = 8;

// Contiguous windows of `width` terms, in reading order: ['a b', 'b c'] for ['a','b','c'] at 2.
// Contiguous rather than every subset because adjacent words are the ones a reader means
// together ("voiceover talkback", "font size"), and because subsets are exponential.
function termWindows(terms, width) {
  const windows = [];
  for (let start = 0; start + width <= terms.length; start += 1) {
    windows.push(terms.slice(start, start + width).join(' '));
  }
  return windows;
}

// THE RULE: when the whole-query AND returns fewer than FALLBACK_MIN_RESULTS pages, re-run the
// search over progressively narrower contiguous windows of the same terms, widest first, and
// append the pages they find — those matching more windows before those matching fewer — without
// reordering or removing anything the AND already returned.
//
// Appending only is what makes this safe to ship: a query that already surfaces its page keeps
// that page at exactly the rank it had (and a query with >= 3 results does not search again at
// all), so the fallback cannot regress a working query, only lengthen a starved one.
//
// Append-only was also measured against the alternative (2026-09-06, built index, both held-out
// sets): ordering the union by Pagefind's own score instead scored strict top-3 14/26 vs 13/26 on
// the first set but 13/24 vs 15/24 on the second, and dropped /components/password-input/ out of
// the top 3 for "password field with a show hide toggle" — a page the AND alone already ranked
// first. Score order buys a starved query a better rank by risking a page a working query already
// found, so it was not taken. The price of keeping append-only is a low-scoring AND hit sitting
// above a better relaxed one: "sign up screen example" shows /components/sheet/ (score 0.31)
// above /patterns/auth/sign-up-screen/ (score 14.66).
//
// What the ladder does not promise is that a relaxed answer is a right answer. It ends the empty
// result — on both held-out sets no query returns nothing any more — but "how fast do the docs
// pages load" now returns 107 pages headed by /compatibility/native/, and the strict score of
// those seven queries did not move. Returning something is not answering something.
//
// Only `results` is extended; the rest of the AND's envelope is passed through as Pagefind built
// it, so `unfilteredResultCount` still counts what the AND matched before filters. The union has
// no true value for that field — its pages come from different queries — and PagefindUI reads
// only `results.length`. A search that asks for an explicit `sort` is not relaxed at all: sorting
// by a page value is a total order the reader chose, and appending would silently break it.
//
// `searcher` is anything with Pagefind's `search(term, options)` shape: the module namespace of
// pagefind.js in the browser, or a `createInstance()` handle in the search-intent check.
export async function searchWithFallback(searcher, query, searchOptions, { minResults = FALLBACK_MIN_RESULTS } = {}) {
  const primary = await searcher.search(query, searchOptions);
  if (typeof query !== 'string' || PAGEFIND_SYNTAX.test(query)) return primary;
  if (searchOptions?.sort) return primary;
  if (!Array.isArray(primary?.results) || primary.results.length >= minResults) return primary;

  // A one-term query has no narrower question to ask, and the ladder below starts one term
  // shorter than the query, so it never runs for one — no separate guard is needed for that.
  const terms = query.trim().split(/\s+/u).filter(Boolean).slice(0, MAX_RELAXED_TERMS);
  const seen = new Set(primary.results.map((result) => result.id));
  const relaxed = [];
  for (let width = terms.length - 1; width >= 1; width -= 1) {
    if (primary.results.length + relaxed.length >= minResults) break;

    // Score within a rung: how many of that rung's windows a page matched, then Pagefind's own
    // score. A page that answers two of the reader's word pairs is a better guess than one that
    // answers a single pair very densely.
    const rung = new Map();
    for (const window of termWindows(terms, width)) {
      // Each rung costs another index query, and any one of them can fail in a reader's browser:
      // a chunk that 404s, an offline moment, an envelope a future engine shapes differently.
      // PagefindUI has no try/catch around its own search call, so an error escaping here would
      // leave the modal loading forever and throw away the results the AND did find. A window
      // that fails is skipped instead, which leaves the reader with what the AND found, never
      // less than before the relaxation existed.
      try {
        const { results } = await searcher.search(window, searchOptions);
        for (const result of results) {
          if (seen.has(result.id)) continue;
          const entry = rung.get(result.id);
          if (entry) {
            entry.windows += 1;
            entry.score = Math.max(entry.score, result.score ?? 0);
          } else {
            rung.set(result.id, { result, windows: 1, score: result.score ?? 0 });
          }
        }
      } catch {
        continue;
      }
    }

    for (const entry of [...rung.values()].sort((a, b) => b.windows - a.windows || b.score - a.score)) {
      seen.add(entry.result.id);
      relaxed.push(entry.result);
    }
  }

  return relaxed.length === 0 ? primary : { ...primary, results: [...primary.results, ...relaxed] };
}
