// Single source of truth for how a reader's query is rewritten before Pagefind sees it.
//
// Pagefind requires every term in the query to appear on a page. A reader who types
// "how do I show a loading spinner on a button" therefore gets nothing, because no page
// contains "how", "do", "i", "show", "spinner", "on" and "button" together, while
// "loading spinner button" ranks the Button page first. This module drops the question
// scaffolding and function words so that only the content terms reach the index.
//
// Two callers import it and must keep using the same function:
//   - apps/docs/src/components/Search.astro passes it to PagefindUI as `processTerm`, so it
//     runs on the reader's real query in the browser;
//   - scripts/check-docs-search-intent.mjs applies it before `instance.search`, so the
//     search-intent check measures the rewritten query the portal actually issues.
// scripts/__tests__/pagefind-query.test.mjs asserts both wirings, so one cannot drift.
//
// It is deliberately not clever: no stemming, no synonyms, no per-term fallback. If every
// word of a query is scaffolding ("how do I"), the original query is returned unchanged rather
// than an empty string, and a query that uses Pagefind's own syntax (a quoted phrase or a
// leading `-` exclusion) is left untouched so exact-match intent still works.

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
const PAGEFIND_SYNTAX = /".*"|(^|\s)-\S/u;

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

  // Punctuation that only separates words is dropped; `/`, `@`, `-` and `.` stay because they
  // occur inside identifiers readers paste (`@beemvp/beeui-ui`, `surface-raised`).
  const tokens = text
    .replace(/[?!,;:()[\]{}|]+/gu, ' ')
    .split(/\s+/u)
    .filter((term) => /[\p{L}\p{N}]/u.test(term));
  const terms = tokens.filter(
    (term, index) => (term === 'to' ? keepsPositionalTo(tokens, index) : !QUERY_STOPWORDS.has(term)),
  );

  return terms.length === 0 ? original : terms.join(' ');
}
