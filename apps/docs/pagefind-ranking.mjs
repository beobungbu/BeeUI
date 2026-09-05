// Single source of truth for the docs portal's Pagefind ranking weights.
//
// `apps/docs/astro.config.mjs` passes these to Starlight (which fills any field omitted
// here with its own schema default), and `scripts/check-docs-search-intent.mjs` scores its
// query matrix with the same object. Both import this file rather than restating the
// numbers, so the search-intent check cannot pass against a ranking production does not use.
// Starlight's own defaults are written out explicitly, so nothing here depends on its internals.
export const PAGEFIND_RANKING = {
  // Pagefind's own default. It was set to 0 to rescue a single query ("safe area duplicated"),
  // and that trade was measured on a matrix chosen after the change — so it recorded what the
  // setting fixed and never what it broke. Re-measured across 21 intents: pageLength 0 scores
  // 18/21 and 0.75 scores 20/21. Disabling length normalization buries short, authoritative
  // pages under long ones: `accessibility/keyboard-focus` carries "keyboard" at 67 per 1000
  // words against Calendar's 7.7, and still lost, because raw match count stops being divided
  // by page length. The one query that regressed is handled in content instead — the
  // Troubleshooting heading now names the symptom the way a reader searches for it.
  pageLength: 0.75,
  termFrequency: 0.1, // Starlight default
  termSaturation: 2, // Starlight default
  termSimilarity: 9, // Starlight default
  diacriticSimilarity: 0.8, // Starlight default
};
