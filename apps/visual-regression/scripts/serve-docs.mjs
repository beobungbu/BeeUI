// Serves the built documentation portal for the accessibility audit.
//
// The existing a11y suite navigates to the Showcase (`serve-showcase.mjs`, port 4174) and the
// visual-regression web app (`serve.mjs`, port 4173). The 151-page documentation site — the
// surface a reader actually uses — had no automated accessibility coverage at all, so
// `web-a11y` passing was never evidence about it.
//
// Unlike the Showcase this is a multi-page static site, so a directory request resolves to that
// directory's own index.html rather than falling back to the site root: serving the landing page
// for /docs/components/table/ would audit the same page 151 times and report nothing.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../docs/dist/', import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.DOCS_A11Y_PORT ?? 4175);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function resolvePath(url) {
  const raw = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  // Astro builds the portal without its public base; the Cloudflare Worker mounts it at /docs.
  // Stripping the prefix here lets specs address pages by their production URL instead of a
  // build-layout one, so a route change is visible in the audit rather than hidden by it.
  const pathname = raw === '/docs' || raw === '/docs/' ? '/' : raw.replace(/^\/docs(?=\/)/u, '');
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalized = normalize(requested);
  const candidate = resolve(join(root, normalized));

  if (!candidate.startsWith(root)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  // A directory request serves that directory's index, never the site root — an audit that
  // silently fell back to the landing page would pass while proving nothing.
  const directoryIndex = join(candidate, 'index.html');
  return existsSync(directoryIndex) ? directoryIndex : null;
}

const server = createServer((request, response) => {
  const file = resolvePath(request.url ?? '/');

  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`BeeUI docs portal listening on http://${host}:${port}`);
});
