import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
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
import { ROOT_DIR, readPublicSiteConfig } from '../public-site-contract-lib.mjs';

test('maps Starlight content paths to deterministic public routes', () => {
  assert.equal(contentPathToRoute('apps/docs/src/content/docs/index.md'), '/docs/');
  assert.equal(contentPathToRoute('apps/docs/src/content/docs/start/index.md'), '/docs/start/');
  assert.equal(contentPathToRoute('apps/docs/src/content/docs/components/button.mdx'), '/docs/components/button/');
});

test('Foundation manifest exposes the target IA and is deterministic', () => {
  const first = buildDocsFoundationManifest(ROOT_DIR);
  const second = buildDocsFoundationManifest(ROOT_DIR);
  assert.deepEqual(first, second);

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

test('page metadata indexes only explicit production and fails closed otherwise', () => {
  assert.equal(indexPolicyForEnvironment('production'), 'index,follow');
  for (const environment of ['development', 'staging', 'preview', undefined]) {
    assert.equal(indexPolicyForEnvironment(environment), 'noindex,nofollow');
  }

  const production = buildPageMetadata({
    title: 'Start',
    description: 'Start with BeeUI.',
    pathname: '/docs/start/',
    imagePath: '/og/start.png',
    environment: 'production',
  });
  assert.equal(production.canonical, 'https://beeui.beemvp.com/docs/start/');
  assert.equal(production.robots, 'index,follow');
  assert.equal(production.openGraph.url, production.canonical);
  assert.equal(production.openGraph.image, 'https://beeui.beemvp.com/og/start.png');

  const failClosed = buildPageMetadata({
    title: 'Preview',
    description: 'Preview metadata.',
    pathname: '/docs/start/',
    environment: undefined,
  });
  assert.equal(failClosed.robots, 'noindex,nofollow');
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

test('Foundation documentation names the current executable pattern authority', () => {
  const foundationDoc = readFileSync(new URL('../../docs/public-docs-foundation.md', import.meta.url), 'utf8');
  assert.match(foundationDoc, /`apps\/showcase\/patterns`/u);
  assert.doesNotMatch(foundationDoc, /apps\/showcase\/src\/patterns/u);
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
