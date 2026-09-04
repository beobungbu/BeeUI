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

test('redirect manifest is deterministic and has unique sources', () => {
  const config = readPublicSiteConfig(ROOT_DIR);
  const redirects = buildRedirectRules(config);
  assert.deepEqual(redirects, [...redirects].sort((a, b) => a.fromPrefix.localeCompare(b.fromPrefix)));
  assert.equal(new Set(redirects.map((rule) => rule.fromPrefix)).size, redirects.length);
  for (const rule of redirects) {
    assert.notEqual(rule.fromPrefix, rule.toPrefix);
    assert.ok(rule.toPrefix.startsWith('/docs/'));
  }
});

// Every rule must land the visitor on a real page in one hop. If a destination were
// itself a redirect source, the browser would take two 308s and search engines would see
// a chain, which is exactly what flattening legacy prefixes through movedRoutes prevents.
test('no redirect destination is itself a redirect source', () => {
  const redirects = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  const sources = new Set(redirects.map((rule) => rule.fromPrefix));
  for (const rule of redirects) {
    assert.equal(sources.has(rule.toPrefix), false, `${rule.fromPrefix} redirects into another redirect (${rule.toPrefix})`);
  }
});

// Destinations may legitimately converge: a moved section is reachable both from its old
// /docs/ prefix and from the pre-/docs origin alias of that prefix. Only a convergence
// explained by that alias relationship is allowed.
test('only alias rules may share a redirect destination', () => {
  const redirects = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  const byDestination = new Map();
  for (const rule of redirects) {
    byDestination.set(rule.toPrefix, [...(byDestination.get(rule.toPrefix) ?? []), rule]);
  }
  for (const [destination, rules] of byDestination) {
    if (rules.length === 1) continue;
    assert.ok(
      rules.some((rule) => rule.aliasOf) && rules.some((rule) => !rule.aliasOf),
      `${destination} is claimed by ${rules.length} unrelated redirect sources`,
    );
    for (const alias of rules.filter((rule) => rule.aliasOf)) {
      assert.ok(
        rules.some((rule) => rule.fromPrefix === alias.aliasOf),
        `${alias.fromPrefix} claims to alias ${alias.aliasOf}, which is not a redirect source`,
      );
    }
  }
});

test('a moved docs section redirects its descendants, not only its index', () => {
  const rules = buildRedirectRules(readPublicSiteConfig(ROOT_DIR));
  const moved = rules.find((rule) => rule.fromPrefix === '/docs/getting-started/');
  assert.ok(moved, 'the #457 getting-started -> start move must be in the manifest');
  assert.equal(moved.preserveSuffix, true);
  assert.equal(moved.status, 308);
  assert.match(renderRedirectsFile([moved]), /^\/docs\/getting-started\/\* \/docs\/start\/:splat 308$/mu);
});

test('full Foundation validation has no violations', () => {
  assert.deepEqual(validateDocsFoundation(ROOT_DIR), []);
});
