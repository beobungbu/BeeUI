import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const showcaseDist = path.join(repoRoot, 'apps/showcase/dist-gallery-qa');

function contentType(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function createShowcaseServer() {
  return http.createServer((request, response) => {
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const root = path.resolve(showcaseDist);
    const candidate = path.resolve(showcaseDist, relative);

    if (candidate !== path.join(root, 'index.html') && !candidate.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    fs.readFile(candidate, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType(candidate),
      });
      response.end(data);
    });
  });
}

async function listen(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Showcase QA server address unavailable');
  return `http://127.0.0.1:${address.port}`;
}

export async function buildAndServeShowcase() {
  fs.rmSync(showcaseDist, { recursive: true, force: true });
  const build = spawnSync(
    'pnpm',
    ['--filter', '@beeui/showcase', 'exec', 'expo', 'export', '--platform', 'web', '--output-dir', 'dist-gallery-qa'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 3 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (build.stdout) process.stdout.write(build.stdout);
  if (build.stderr) process.stderr.write(build.stderr);
  if (build.status !== 0) throw new Error(`Showcase Web export failed with status ${build.status}`);

  const server = createShowcaseServer();
  const baseUrl = await listen(server);
  return { baseUrl, server };
}

export async function stopShowcaseServer(server: http.Server | undefined) {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(showcaseDist, { recursive: true, force: true });
}
