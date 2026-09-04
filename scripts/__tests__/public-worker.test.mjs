import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRequest } from '../../web/worker/src/index.mjs';
import { buildComposedRootFiles } from '../build-public-worker.mjs';
import { ROOT_DIR } from '../public-site-contract-lib.mjs';

function createEnv() {
  return {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/build-identity.json') {
          return Response.json({ version: '20260902.0.0', commit: 'abc123', environment: 'test' });
        }
        return new Response(`asset:${url.pathname}`, { status: 200, headers: { 'content-type': 'text/plain' } });
      },
    },
  };
}

test('/api/health returns exact build identity and no-store JSON', async () => {
  const response = await handleRequest(new Request('https://example.test/api/health'), createEnv());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'beeui-web',
    version: '20260902.0.0',
    commit: 'abc123',
    environment: 'test',
  });
});

test('unknown /api route is an intentional JSON 404', async () => {
  const response = await handleRequest(new Request('https://example.test/api/missing'), createEnv());
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'not_found', path: '/api/missing' });
});

test('non-API requests fall back to the ASSETS binding when Worker is invoked directly', async () => {
  const response = await handleRequest(new Request('https://example.test/docs/'), createEnv());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset:/docs/');
});

test('health fails closed without exposing asset/runtime details when identity is unavailable', async () => {
  const env = { ASSETS: { async fetch() { return new Response('missing', { status: 404 }); } } };
  const response = await handleRequest(new Request('https://example.test/api/health'), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, service: 'beeui-web', error: 'build_identity_unavailable' });
});

// The composed root owns three files the copy step never produces. The redirect manifest
// was declared in config, published into route-manifest.json and validated for duplicates,
// loops and cycles, yet nothing wrote it to disk — so every legacy URL 404ed in production
// while every check stayed green. Assert the write set itself, so deleting a write is a
// test failure rather than an invisible regression.
test('the composed worker root owns build identity, headers and redirects', () => {
  const identity = { service: 'beeui-web', version: '20260902.0.0', commit: 'abc123', environment: 'production' };
  const files = buildComposedRootFiles({
    rootDir: ROOT_DIR,
    contract: { indexPolicy: 'index,follow' },
    identity,
  });

  assert.deepEqual(Object.keys(files).sort(), ['_headers', '_redirects', 'build-identity.json']);
  for (const [name, contents] of Object.entries(files)) {
    assert.ok(contents.trim().length > 0, `${name} must not be written empty`);
  }
  assert.deepEqual(JSON.parse(files['build-identity.json']), identity);
  assert.match(files._headers, /X-Content-Type-Options: nosniff/u);
  assert.match(files._redirects, /^\/docs\/getting-started\/\* \/docs\/start\/:splat 308$/mu);
});
