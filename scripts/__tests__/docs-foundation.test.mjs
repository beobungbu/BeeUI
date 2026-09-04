import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildCanonicalUrl,
  buildPageMetadata,
  buildShowcaseHref,
  indexPolicyForEnvironment,
} from '../../apps/docs/src/lib/foundation-contract.ts';
import {
  buildDocsFoundationManifest,
  buildRedirectRules,
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
    '/showcase/?surface=component&id=select&owner=select&example=controlled&state=open&theme=dark&density=compact',
  );
  assert.throws(() => buildShowcaseHref({ surface: 'component', id: '   ' }), /must be non-empty/u);
});

test('Foundation documentation names the current executable pattern authority and environment origin authority', () => {
  const foundationDoc = readFileSync(new URL('../../docs/public-docs-foundation.md', import.meta.url), 'utf8');
  assert.match(foundationDoc, /`apps\/showcase\/patterns`/u);
  assert.doesNotMatch(foundationDoc, /apps\/showcase\/src\/patterns/u);
  assert.match(foundationDoc, /`web\/public-site\.config\.json` owns the environment-to-origin mapping/u);
});

test('legacy redirect manifest is deterministic and has unique sources/destinations', () => {
  const config = readPublicSiteConfig(ROOT_DIR);
  const redirects = buildRedirectRules(config);
  assert.deepEqual(redirects, [...redirects].sort((a, b) => a.fromPrefix.localeCompare(b.fromPrefix)));
  assert.equal(new Set(redirects.map((rule) => rule.fromPrefix)).size, redirects.length);
  assert.equal(new Set(redirects.map((rule) => rule.toPrefix)).size, redirects.length);
  for (const rule of redirects) {
    assert.notEqual(rule.fromPrefix, rule.toPrefix);
    assert.ok(rule.toPrefix.startsWith('/docs/'));
  }
});

test('full Foundation validation has no violations', () => {
  assert.deepEqual(validateDocsFoundation(ROOT_DIR), []);
});
