// Single source of truth for the docs portal's Pagefind ranking weights.
//
// `apps/docs/astro.config.mjs` passes these to Starlight (which fills any field omitted
// here with its own schema default), and `scripts/check-docs-search-intent.mjs` scores its
// query matrix with the same object. Both import this file rather than restating the
// numbers, so the search-intent check cannot pass against a ranking production does not use.
// Starlight's own defaults are written out explicitly, so nothing here depends on its internals.
export const PAGEFIND_RANKING = {
  // Pagefind's own default. It was set to 0 to rescue one query ("safe area duplicated"), and
  // that trade was measured on a matrix assembled after the change — so it recorded what the
  // setting fixed and never what it broke.
  //
  // Disabling normalization stops dividing raw match count by page length, so a short page that
  // is about the topic loses to a long one that merely mentions it: `accessibility/keyboard-focus`
  // ranked sixth for "keyboard navigation" behind Calendar, despite carrying the term far more
  // densely. The three accessibility intents in QUERY_MATRIX all failed under 0.
  //
  // Held out from the matrix, to avoid measuring the change against queries chosen for it:
  // 45 heading-derived queries score 41/45 at pageLength 0 and 43/45 at 0.75, with no regression;
  // 62 component-name queries and 50 title queries tie. The one query that regressed is fixed in
  // content instead — the Troubleshooting heading now names the safe-area-duplicated symptom the
  // way a reader searches for it, and ranks first for it.
  pageLength: 0.75,
  termFrequency: 0.1, // Starlight default
  termSaturation: 2, // Starlight default
  termSimilarity: 9, // Starlight default
  diacriticSimilarity: 0.8, // Starlight default
};
