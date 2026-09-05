// Single source of truth for the docs portal's Pagefind ranking weights.
//
// `apps/docs/astro.config.mjs` passes these to Starlight (which fills any field omitted
// here with its own schema default), and `scripts/check-docs-search-intent.mjs` scores its
// query matrix with the same object. Both import this file rather than restating the
// numbers, so the search-intent check cannot pass against a ranking production does not use.
// Starlight's own defaults are written out explicitly, so nothing here depends on its internals.
export const PAGEFIND_RANKING = {
  // The 63 generated component pages share one near-identical template, so raw page length
  // differs almost entirely by boilerplate rather than topical relevance, and Starlight's
  // default length normalization (0.75) lets that boilerplate outrank a hand-authored page
  // that answers the query directly. Measured, not assumed: restoring 0.75 and re-running
  // scripts/check-docs-search-intent.mjs drops "safe area duplicated" off the
  // Troubleshooting page and returns Stepper first. It is the only query in the matrix that
  // depends on this weight — the other 14 pass either way.
  pageLength: 0,
  termFrequency: 0.1, // Starlight default
  termSaturation: 2, // Starlight default
  termSimilarity: 9, // Starlight default
  diacriticSimilarity: 0.8, // Starlight default
};
