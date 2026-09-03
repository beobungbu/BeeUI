const API_PREFIX = '/api/';

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  return new Response(JSON.stringify(body), { ...init, headers });
}

async function loadBuildIdentity(request, env) {
  const identityUrl = new URL('/build-identity.json', request.url);
  const response = await env.ASSETS.fetch(new Request(identityUrl, { method: 'GET' }));
  if (!response.ok) throw new Error(`build identity asset returned ${response.status}`);
  const identity = await response.json();
  if (!identity || typeof identity.version !== 'string' || typeof identity.commit !== 'string') {
    throw new Error('build identity asset is invalid');
  }
  return identity;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    try {
      const identity = await loadBuildIdentity(request, env);
      return json({
        ok: true,
        service: 'beeui-web',
        version: identity.version,
        commit: identity.commit,
        environment: identity.environment,
      });
    } catch {
      return json({ ok: false, service: 'beeui-web', error: 'build_identity_unavailable' }, { status: 503 });
    }
  }

  if (url.pathname.startsWith(API_PREFIX)) {
    return json({ ok: false, error: 'not_found', path: url.pathname }, { status: 404 });
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleRequest,
};
