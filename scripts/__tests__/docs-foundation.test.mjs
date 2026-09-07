import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildCanonicalUrl,
  buildPageMetadata,
  buildShowcaseHref,
  indexPolicyForEnvironment,
} from '../../apps/docs/src/lib/foundation-contract.ts';
import { showcaseHref } from '../../apps/showcase/showcase-target.ts';
import {
  buildDocsFoundationManifest,
  buildRedirectRules,
  collectRedirectViolations,
  renderRedirectsFile,
  buildReleaseState,
  contentPathToRoute,
  validateDocsFoundation,
} from '../generate-docs-foundation.mjs';
import {
  ROOT_DIR,
  buildPublicSiteContract,
  readPublicSiteConfig,
} from '../public-site-contract-lib.mjs';

test('maps Starlight content paths to deterministic public routes', () => {
  assert.equal(contentPathToRoute('apps/docs/src/content/docs/index.md'), '/docs/');
  assert.equal(contentPathToRoute('apps/docs/src/content/docs/start/index.md'), '/docs/start/');
  assert.equal(contentPathToRoute('apps/docs/src/content/docs/components/button.mdx'), '/docs/components/button/');
});

test('Foundation manifest exposes the target IA and environment-derived origin deterministically', () => {
  const first = buildDocsFoundationManifest(ROOT_DIR, { environment: 'development' });
  const second = buildDocsFoundationManifest(ROOT_DIR, { environment: 'development' });
  assert.deepEqual(first, second);
  assert.equal(first.environment, 'development');
  assert.equal(first.canonicalOrigin, 'https://beeui-dev.beemvp.com');
  assert.equal(first.indexPolicy, 'noindex,nofollow');
  assert.equal(
    buildDocsFoundationManifest(ROOT_DIR, { environment: 'staging' }).canonicalOrigin,
    'https://beeui-stg.beemvp.com',
  );
  assert.equal(
    buildDocsFoundationManifest(ROOT_DIR, { environment: 'production' }).canonicalOrigin,
    'https://beeui.beemvp.com',
  );

  const routes = new Set(first.currentDocsRoutes.map((entry) => entry.route));
  for (const route of [
    '/docs/',
    '/docs/start/',
    '/docs/learn/',
    '/docs/components/',
    '/docs/patterns/',
    '/docs/guides/',
    '/docs/reference/',
  ]) {
    assert.ok(routes.has(route), `missing ${route}`);
  }
});

test('release state is derived from canonical policy and remains publication-safe', () => {
  const state = buildReleaseState(ROOT_DIR);
  assert.equal(state.published, false);
  assert.equal(state.status, 'unpublished');
  assert.equal(state.channel, 'closed');
  assert.equal(state.workspaceVersion, state.currentVersion);
  assert.deepEqual(state.packageNames, [
    '@beemvp/beeui-core',
    '@beemvp/beeui-tokens',
    '@beemvp/beeui-ui',
  ]);
  assert.equal(state.cliPackageName, '@beemvp/beeui-cli');
  assert.equal(state.cliAvailable, false);
  assert.equal(state.publicInstallCommandsAvailable, false);
  assert.equal(state.installCta, 'hidden');
  assert.equal(state.sourceEvaluationCta, 'enabled');
  assert.equal(state.ownerGate, '#254');
});

test('page metadata uses caller-supplied environment origin and fails closed outside production', () => {
  assert.equal(indexPolicyForEnvironment('production'), 'index,follow');
  for (const environment of ['development', 'staging', 'preview', undefined]) {
    assert.equal(indexPolicyForEnvironment(environment), 'noindex,nofollow');
  }

  const productionSite = buildPublicSiteContract(ROOT_DIR, { environment: 'production' });
  const production = buildPageMetadata({
    title: 'Start',
    description: 'Start with BeeUI.',
    pathname: '/docs/start/',
    imagePath: '/og/start.png',
    origin: productionSite.origin,
    environment: 'production',
  });
  assert.equal(production.canonical, 'https://beeui.beemvp.com/docs/start/');
  assert.equal(production.robots, 'index,follow');
  assert.equal(production.openGraph.url, production.canonical);
  assert.equal(production.openGraph.image, 'https://beeui.beemvp.com/og/start.png');

  const stagingSite = buildPublicSiteContract(ROOT_DIR, { environment: 'staging' });
  const failClosed = buildPageMetadata({
    title: 'Staging',
    description: 'Staging metadata.',
    pathname: '/docs/start/',
    origin: stagingSite.origin,
    environment: 'staging',
  });
  assert.equal(failClosed.canonical, 'https://beeui-stg.beemvp.com/docs/start/');
  assert.equal(failClosed.robots, 'noindex,nofollow');

  assert.throws(() => buildCanonicalUrl('/docs/start/', ''), /origin must be non-empty/u);
});

test('Showcase href builder is deterministic and rejects missing target identity', () => {
  assert.equal(
    buildShowcaseHref({
      surface: 'component',
      id: 'select',
      ownerId: 'select',
      example: 'controlled',
      state: 'open',
      theme: 'dark',
      density: 'compact',
    }),
    // ownerId is documentation metadata and is deliberately absent from runtime target identity.
    '/showcase/?surface=component&id=select&example=controlled&state=open&theme=dark&density=compact',
  );
  assert.equal(
    buildShowcaseHref({ surface: 'component', id: 'select', example: 'controlled' }),
    showcaseHref({ surface: 'component', id: 'select', example: 'controlled' }),
    'docs href builder must delegate to the canonical Showcase target serializer',
  );
  assert.throws(() => buildShowcaseHref({ surface: 'component', id: '   ' }), /must be non-empty/u);
});

test('Foundation documentation names the current executable pattern authority and environment origin authority', () => {
  const foundationDoc = readFileSync(new URL('../../docs/public-docs-foundation.md', import.meta.url), 'utf8');
  assert.match(foundationDoc, /`apps\/showcase\/patterns`/u);
  assert.doesNotMatch(foundationDoc, /apps\/showcase\/src\/patterns/u);
  assert.match(foundationDoc, /`web\/public-site\.config\.json` owns the environment-to-origin mapping/u);
});

// Astro drops dots from a slug. The manifest used to record the literal filename, so
// current.generated.md was published as /compatibility/current.generated/ while the site
// served /compatibility/currentgenerated/ — two live 404s that every in-repo link pointed at.
test('a dotted filename maps to the route Astro actually serves', () => {
  assert.equal(
    contentPathToRoute('apps/docs/src/content/docs/compatibility/current.generated.md'),
    '/docs/compatibility/currentgenerated/',
  );
  assert.equal(
    contentPathToRoute('apps/docs/src/content/docs/guides/current-release.md'),
    '/docs/guides/current-release/',
  );
});

test('redirect manifest is deterministic and has unique sources', () => {
  const redirects = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  assert.equal(new Set(redirects.map((rule) => rule.fromPrefix)).size, redirects.length);
  for (const rule of redirects) {
    assert.notEqual(rule.fromPrefix, rule.toPrefix);
    assert.ok(rule.toPrefix.startsWith('/docs/'));
  }
});

// Cloudflare applies the top-most matching rule, so ordering is behavior, not cosmetics.
test('redirect rules are ordered most specific first', () => {
  const redirects = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  const lengths = redirects.map((rule) => rule.fromPrefix.length);
  assert.deepEqual(lengths, [...lengths].sort((a, b) => b - a));
});

const rule = (fromPrefix, toPrefix, aliasOf) => ({
  fromPrefix,
  toPrefix,
  status: 308,
  preserveSuffix: true,
  preserveQuery: true,
  ...(aliasOf ? { aliasOf } : {}),
});

const KNOWN = new Set(['/docs/components/', '/docs/start/', '/docs/guides/table/']);

// These drive collectRedirectViolations itself. Asserting properties of the production
// config instead would only ever exercise the one input already known to pass.
//
// Convergence is normal: a section index is reached both from its pre-/docs origin alias and
// from a child prefix the IA has vacated. The rule that forbade it rejected correct config and,
// in exchange, never checked the thing that actually strands a visitor.
test('several sources may converge on one real destination', () => {
  assert.deepEqual(
    collectRedirectViolations(
      [rule('/components/', '/docs/components/'), rule('/docs/components/reference/', '/docs/components/')],
      { knownRoutes: KNOWN },
    ),
    [],
  );
});

test('a redirect that points at no published page is rejected', () => {
  const violations = collectRedirectViolations([rule('/docs/old/', '/docs/does-not-exist/')], { knownRoutes: KNOWN });
  assert.ok(violations.some((v) => v.includes('not a published page')), violations.join('\n'));
});

test('an alias naming something that is not a redirect source is rejected', () => {
  const violations = collectRedirectViolations(
    [rule('/x/', '/docs/start/', '/docs/never-a-source/')],
    { knownRoutes: KNOWN },
  );
  assert.ok(violations.some((v) => v.includes('not a redirect source')), violations.join('\n'));
});

test('a redirect source that shadows a more specific source is rejected', () => {
  const violations = collectRedirectViolations([
    rule('/docs/', '/docs/start/'),
    rule('/docs/getting-started/', '/docs/start/'),
  ]);
  assert.ok(violations.some((violation) => violation.includes('shadows the more specific')), violations.join('\n'));
});

// Redirects are followed whether or not an asset matches, so a rule mounted on a canonical
// route would 308 away everything ever published there.
test('a redirect source that collides with a canonical route is rejected', () => {
  const violations = collectRedirectViolations([rule('/showcase/', '/docs/start/')], {
    routePrefixes: ['/', '/docs/', '/showcase/'],
  });
  assert.ok(violations.some((violation) => violation.includes('collides with the canonical route')), violations.join('\n'));
});

test('no redirect destination is itself a redirect source', () => {
  const redirects = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  assert.deepEqual(collectRedirectViolations(redirects).filter((v) => v.includes('points at another redirect')), []);
});

// The bare spelling worked before the move because auto-trailing-slash 307s /folder to
// /folder/ while the asset exists. Once it moves, only an explicit rule saves it.
test('a moved section redirects both the bare and the descendant form', () => {
  const rules = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  const moved = rules.find((entry) => entry.fromPrefix === '/docs/getting-started/');
  assert.ok(moved, 'the #457 getting-started -> start move must be in the manifest');
  assert.equal(moved.preserveSuffix, true);
  assert.equal(moved.status, 308);

  const rendered = renderRedirectsFile(rules);
  assert.match(rendered, /^\/docs\/getting-started \/docs\/start\/ 308$/mu);
  assert.match(rendered, /^\/docs\/getting-started\/\* \/docs\/start\/:splat 308$/mu);

  const lines = rendered.trim().split('\n');
  const firstDynamic = lines.findIndex((line) => line.includes('*'));
  const lastStatic = lines.reduce((last, line, index) => (line.includes('*') ? last : index), -1);
  assert.ok(firstDynamic > lastStatic, 'every static rule must precede every dynamic rule');
});

test('full Foundation validation has no violations', () => {
  assert.deepEqual(validateDocsFoundation(ROOT_DIR), []);
});
