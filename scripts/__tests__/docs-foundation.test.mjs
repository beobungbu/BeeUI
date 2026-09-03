import assert from 'node:assert/strict';
import test from 'node:test';

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
