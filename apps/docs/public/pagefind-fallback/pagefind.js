// A Pagefind entrypoint that behaves exactly like `/pagefind/pagefind.js` except that `search`
// runs the relaxation described in apps/docs/pagefind-query.mjs.
//
// WHY THIS FILE EXISTS AT ALL. PagefindUI exposes `processTerm` (before the search) and
// `processResult` (per result), but nothing that runs *after* a search with the result set in
// hand — and the fallback has to see how many pages the AND found before it can decide to relax
// it. PagefindUI loads its engine with `import(`${bundlePath}pagefind.js`)` and the resulting
// module namespace is sealed, so it cannot be patched afterwards. Pointing `bundlePath` at this
// directory is therefore the one seam the browser offers: PagefindUI imports this module, this
// module imports the real one, and every other export is passed straight through.
//
// WHY IT LIVES IN public/. It must be a plain module the browser can import by URL at runtime,
// not a bundled chunk, because the specifier PagefindUI builds is a string. `pagefind-query.mjs`
// beside it in the build output is a verbatim copy of apps/docs/pagefind-query.mjs, placed there
// by the `pagefind-fallback-runtime` integration in apps/docs/astro.config.mjs — so the browser
// and scripts/check-docs-search-intent.mjs run the same relaxation from the same source file,
// and there is no second copy to drift. scripts/check-docs-search-intent.mjs --check fails the
// docs build if either file is missing from dist, so a lost copy cannot reach production.

import * as pagefind from '../pagefind/pagefind.js';
import { searchWithFallback } from './pagefind-query.mjs';

export const search = (term, searchOptions) => searchWithFallback(pagefind, term, searchOptions);

export const { createInstance, debouncedSearch, destroy, filters, init, mergeIndex, options, preload } = pagefind;
