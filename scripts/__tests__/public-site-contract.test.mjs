import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectPublicSiteContractViolations } from '../check-public-site-contract.mjs';
import { routeForPath } from '../public-site-contract-lib.mjs';

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-site-contract-'));
  const write = (relative, content) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  const config = {
    schemaVersion: 1,
    origin: 'https://beeui.beemvp.com',
    productionRuntime: 'cloudflare-workers',
    docsBase: '/docs',
    routes: [
      { id: 'landing', prefix: '/', owner: 'web/site', output: 'web/dist', visibility: 'public', indexable: true },
      { id: 'docs', prefix: '/docs/', owner: 'apps/docs', output: 'apps/docs/dist', visibility: 'public', indexable: true },
      { id: 'showcase', prefix: '/showcase/', owner: 'apps/showcase', output: 'apps/showcase/dist-web', visibility: 'public', indexable: true },
      { id: 'demo', prefix: '/demo/', owner: 'apps/demo', output: 'apps/demo/dist-web', visibility: 'public', indexable: true },
      { id: 'examples', prefix: '/examples/', owner: 'web/site', output: 'web/dist/examples', visibility: 'public', indexable: true },
      { id: 'changelog', prefix: '/changelog/', owner: 'web/site', output: 'web/dist/changelog', visibility: 'public', indexable: true },
      { id: 'llms', prefix: '/llms', owner: 'scripts/generate-llms-txt.mjs', output: 'web/dist', visibility: 'public', indexable: false },
      { id: 'api', prefix: '/api/', owner: 'web/worker', output: null, visibility: 'runtime', indexable: false }
    ],
    legacyDocsRedirect: { status: 308, prefixes: ['/components/'], targetPrefix: '/docs' },
    navigation: [
      { label: 'Docs', href: '/docs/' },
      { label: 'Components', href: '/docs/components/' },
      { label: 'Patterns', href: '/docs/patterns/' },
      { label: 'Showcase', href: '/showcase/' },
      { label: 'Demo', href: '/demo/' }
    ],
    contentSources: { publication: ['docs/dist-tag-policy.md'], version: ['package.json'] },
    buildOutputs: {
      landing: 'web/dist', docs: 'apps/docs/dist', showcase: 'apps/showcase/dist-web', demo: 'apps/demo/dist-web', composedAssets: 'web/worker/dist'
    },
    ...overrides
  };
  write('web/public-site.config.json', JSON.stringify(config));
  write('package.json', JSON.stringify({ version: '20260902.0.0' }));
  write('docs/dist-tag-policy.md', '```json dist-tag-policy\n{"published":false,"currentVersion":"20260902.0.0","stableDistTag":"latest","prereleaseDistTag":"next"}\n```\n');
  write('scripts/generate-llms-txt.mjs', '');
  return { root, config };
}

test('accepts the canonical route/source/output contract', () => {
  const { root } = fixture();
  assert.deepEqual(collectPublicSiteContractViolations(root), []);
});

test('selects the longest matching public route', () => {
  const { config } = fixture();
  assert.equal(routeForPath('/docs/components/button/', config).id, 'docs');
  assert.equal(routeForPath('/showcase/', config).id, 'showcase');
  assert.equal(routeForPath('/', config).id, 'landing');
});

test('rejects Pages, duplicate prefixes and a published state before owner gate', () => {
  const { root } = fixture({ productionRuntime: 'cloudflare-pages' });
  const configPath = path.join(root, 'web/public-site.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.routes[2].prefix = '/docs/';
  fs.writeFileSync(configPath, JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'docs/dist-tag-policy.md'), '```json dist-tag-policy\n{"published":true,"currentVersion":"20260902.0.0","stableDistTag":"latest","prereleaseDistTag":"next"}\n```\n');
  const violations = collectPublicSiteContractViolations(root).join('\n');
  assert.match(violations, /cloudflare-workers/);
  assert.match(violations, /published/);
  assert.match(violations, /duplicated/);
});
