import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectPublicSiteContractViolations } from '../check-public-site-contract.mjs';
import {
  buildPublicSiteContract,
  normalizePublicSiteEnvironment,
  routeForPath,
} from '../public-site-contract-lib.mjs';

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-site-contract-'));
  const write = (relative, content) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  const config = {
    schemaVersion: 1,
    productionRuntime: 'cloudflare-workers',
    docsBase: '/docs',
    environments: {
      development: {
        origin: 'https://beeui-dev.beemvp.com',
        indexPolicy: 'noindex,nofollow',
        robotsDisallow: ['/'],
      },
      staging: {
        origin: 'https://beeui-stg.beemvp.com',
        indexPolicy: 'noindex,nofollow',
        robotsDisallow: ['/'],
      },
      production: {
        origin: 'https://beeui.beemvp.com',
        indexPolicy: 'index,follow',
        robotsDisallow: ['/api/'],
      },
    },
    routes: [
      { id: 'landing', prefix: '/', owner: 'web/site', output: 'web/dist', visibility: 'public', indexable: true },
      { id: 'docs', prefix: '/docs/', owner: 'apps/docs', output: 'apps/docs/dist', visibility: 'public', indexable: true },
      { id: 'showcase', prefix: '/showcase/', owner: 'apps/showcase', output: 'apps/showcase/dist-web', visibility: 'public', indexable: true },
      { id: 'demo', prefix: '/demo/', owner: 'apps/demo', output: 'apps/demo/dist-web', visibility: 'public', indexable: true },
      { id: 'examples', prefix: '/examples/', owner: 'web/site', output: 'web/dist/examples', visibility: 'public', indexable: true },
      { id: 'changelog', prefix: '/changelog/', owner: 'web/site', output: 'web/dist/changelog', visibility: 'public', indexable: true },
      { id: 'llms', prefix: '/llms', owner: 'scripts/generate-llms-txt.mjs', output: 'web/dist', visibility: 'public', indexable: false },
      { id: 'api', prefix: '/api/', owner: 'web/worker', output: null, visibility: 'runtime', indexable: false },
    ],
    legacyDocsRedirect: { status: 308, prefixes: ['/components/'], targetPrefix: '/docs' },
    navigation: [
      { label: 'Docs', href: '/docs/' },
      { label: 'Components', href: '/docs/components/' },
      { label: 'Patterns', href: '/docs/patterns/' },
      { label: 'Showcase', href: '/showcase/' },
      { label: 'Demo', href: '/demo/' },
    ],
    contentSources: { publication: ['docs/dist-tag-policy.md'], version: ['package.json'] },
    buildOutputs: {
      landing: 'web/dist', docs: 'apps/docs/dist', showcase: 'apps/showcase/dist-web', demo: 'apps/demo/dist-web', composedAssets: 'web/worker/dist',
    },
    ...overrides,
  };
  write('web/public-site.config.json', JSON.stringify(config));
  write('package.json', JSON.stringify({ version: '20260902.0.0' }));
  write('docs/dist-tag-policy.md', '```json dist-tag-policy\n{"published":false,"currentVersion":"20260902.0.0","stableDistTag":"latest","prereleaseDistTag":"next"}\n```\n');
  write('scripts/generate-llms-txt.mjs', '');

  const hosts = {
    development: 'beeui-dev.beemvp.com',
    staging: 'beeui-stg.beemvp.com',
    production: 'beeui.beemvp.com',
  };
  for (const [environment, host] of Object.entries(hosts)) {
    write(
      `.github/deployment/wrangler-${environment}.jsonc`,
      JSON.stringify({ routes: [{ pattern: host, custom_domain: true }] }),
    );
  }
  write(
    'web/worker/wrangler.jsonc',
    JSON.stringify({
      env: Object.fromEntries(
        Object.entries(hosts).map(([environment, host]) => [
          environment,
          { routes: [{ pattern: host, custom_domain: true }] },
        ]),
      ),
    }),
  );
  return { root, config };
}

test('accepts the canonical route/source/output contract', () => {
  const { root } = fixture();
  assert.deepEqual(collectPublicSiteContractViolations(root), []);
});

test('resolves environment-specific origin and preview aliases from one config authority', () => {
  const { root } = fixture();
  assert.equal(buildPublicSiteContract(root, { environment: 'development' }).origin, 'https://beeui-dev.beemvp.com');
  assert.equal(buildPublicSiteContract(root, { environment: 'staging' }).origin, 'https://beeui-stg.beemvp.com');
  assert.equal(buildPublicSiteContract(root, { environment: 'production' }).origin, 'https://beeui.beemvp.com');
  assert.equal(buildPublicSiteContract(root, { environment: 'development-preview' }).origin, 'https://beeui-dev.beemvp.com');
  assert.equal(buildPublicSiteContract(root, { environment: 'staging-preview' }).origin, 'https://beeui-stg.beemvp.com');
  assert.equal(normalizePublicSiteEnvironment('production-candidate'), 'staging');
});

test('selects the longest matching public route', () => {
  const { config } = fixture();
  assert.equal(routeForPath('/docs/components/button/', config).id, 'docs');
  assert.equal(routeForPath('/showcase/', config).id, 'showcase');
  assert.equal(routeForPath('/', config).id, 'landing');
});

test('rejects environment/domain drift from deployment control plane', () => {
  const { root } = fixture();
  const configPath = path.join(root, 'web/public-site.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.environments.staging.origin = 'https://wrong-staging.beemvp.com';
  fs.writeFileSync(configPath, JSON.stringify(config));
  const violations = collectPublicSiteContractViolations(root).join('\n');
  assert.match(violations, /does not match .*wrangler-staging/u);
  assert.match(violations, /does not match web\/worker\/wrangler\.jsonc/u);
});

test('rejects Pages, duplicate prefixes and a published state before owner gate', () => {
  const { root } = fixture({ productionRuntime: 'cloudflare-pages' });
  const configPath = path.join(root, 'web/public-site.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.routes[2].prefix = '/docs/';
  fs.writeFileSync(configPath, JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'docs/dist-tag-policy.md'), '```json dist-tag-policy\n{"published":true,"currentVersion":"20260902.0.0","stableDistTag":"latest","prereleaseDistTag":"next"}\n```\n');
  const violations = collectPublicSiteContractViolations(root).join('\n');
  assert.match(violations, /cloudflare-workers/u);
  assert.match(violations, /published/u);
  assert.match(violations, /duplicated/u);
});
