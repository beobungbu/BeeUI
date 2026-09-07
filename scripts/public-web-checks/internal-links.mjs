import fs from 'node:fs';
import path from 'node:path';

import { buildRedirectRules, collectDocsRoutes } from '../generate-docs-foundation.mjs';
import { buildPublicPatternManifest } from '../public-pattern-reference.mjs';
import { GENERATED_COMPATIBILITY_PAGE, GENERATED_RELEASE_PAGE } from '../public-guide-data.mjs';
import { readPublicSiteConfig } from '../public-site-contract-lib.mjs';

const DOCS_CONTENT_ROOT = 'apps/docs/src/content/docs';

// Absolute in-site links written by hand in docs content. Relative links, anchors,
// external URLs and mailto: are out of scope — Starlight resolves the first two itself and
// the last two are not ours to validate.
const LINK_RE = /\]\((\/[^)\s#?]*)(?:[?#][^)\s]*)?(?:\s+"[^"]*")?\)/gu;

// Pages the apps/docs pre-build hooks write. They are gitignored, so they are absent from
// the content tree whenever this check runs before those hooks — which is exactly what
// happens in CI. Deriving their routes from the same manifests the generators consume
// means the check neither false-fails on a missing file nor blindly accepts any link that
// merely starts with a generated prefix: a link to a component that does not exist still
// fails.
function generatedDocsRoutes(rootDir, docsBase) {
  const routes = new Set([
    `${docsBase}/patterns/reference/`,
    // Resolved from the generator that writes them rather than restated here.
    ...[GENERATED_COMPATIBILITY_PAGE, GENERATED_RELEASE_PAGE].map(
      (file) => `${docsBase}/${file.slice(`${DOCS_CONTENT_ROOT}/`.length).replace(/\.mdx?$/u, '')}/`,
    ),
  ]);

  for (const pattern of buildPublicPatternManifest(rootDir)) {
    routes.add(`${docsBase}/patterns/reference/${pattern.pack}/`);
    routes.add(`${docsBase}/patterns/reference/${pattern.pack}/${pattern.slug}/`);
  }
  return routes;
}

// Routes owned by something other than apps/docs. They are real, but their existence is
// proven by that owner's own build output, not by a content file under apps/docs.
function nonDocsRoutePrefixes(config) {
  return (config.routes ?? []).map((route) => route.prefix).filter((prefix) => prefix !== '/docs/');
}

function listContentFiles(rootDir) {
  const root = path.join(rootDir, DOCS_CONTENT_ROOT);
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.mdx?$/u.test(entry.name)) files.push(absolute);
    }
  }
  walk(root);
  return files;
}

export function collectViolations(rootDir) {
  const violations = [];
  const config = readPublicSiteConfig(rootDir);
  const docsBase = config.docsBase.replace(/\/$/u, '');

  const known = new Set(collectDocsRoutes(rootDir, config.docsBase).map((entry) => entry.route));
  for (const route of generatedDocsRoutes(rootDir, docsBase)) known.add(route);
  const redirects = buildRedirectRules(config);
  const externalPrefixes = nonDocsRoutePrefixes(config);

  for (const file of listContentFiles(rootDir)) {
    const relative = path.relative(rootDir, file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(LINK_RE)) {
      const href = match[1];
      if (!href.startsWith(config.docsBase)) {
        // Another route mount (/showcase/, /demo/, /examples/, /changelog/, /llms*) or the
        // landing page. Owned and built elsewhere; nothing here can prove it.
        if (href === '/' || externalPrefixes.some((prefix) => href.startsWith(prefix))) continue;
        violations.push(`${relative} links to ${href}, which is not under any canonical route mount.`);
        continue;
      }

      // Starlight serves directory-style routes, so compare on the trailing-slash form the
      // route manifest uses. A link written without it still reaches the same page.
      const normalized = href.endsWith('/') ? href : `${href}/`;
      if (known.has(normalized)) continue;

      // A link into a redirected prefix is fine only if the rewritten path is itself real.
      // Accepting the prefix alone let /docs/cli/does-not-exist/ through, because the 308
      // lands on a page that does not exist.
      const redirect = redirects.find((rule) => normalized.startsWith(rule.fromPrefix));
      if (redirect) {
        const rewritten = `${redirect.toPrefix}${normalized.slice(redirect.fromPrefix.length)}`;
        if (known.has(rewritten)) continue;
        violations.push(
          `${relative} links to ${href}, which redirects to ${rewritten} — and that is not a page.`,
        );
        continue;
      }

      violations.push(
        `${relative} links to ${href}, which is neither a published docs route, a generated ` +
        'route, nor a declared redirect. Check for a stale path, or a filename whose route ' +
        'differs from the link (Astro drops dots, so current.generated.md would serve ' +
        '/currentgenerated/, not /current.generated/).',
      );
    }
  }

  return violations;
}
