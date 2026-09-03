import fs from 'node:fs';
import path from 'node:path';

export async function collectViolations(rootDir) {
  const violations = [];
  const configPath = path.join(rootDir, 'web/worker/wrangler.jsonc');
  const workerPath = path.join(rootDir, 'web/worker/src/index.mjs');
  const buildPath = path.join(rootDir, 'scripts/build-public-worker.mjs');
  const packagePath = path.join(rootDir, 'web/worker/package.json');

  for (const file of [configPath, workerPath, buildPath, packagePath]) {
    if (!fs.existsSync(file)) violations.push(`missing Worker launch file ${path.relative(rootDir, file)}`);
  }
  if (violations.length) return violations;

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.main !== './src/index.mjs') violations.push('Wrangler main must remain ./src/index.mjs.');
  if (config.assets?.directory !== './dist' || config.assets?.binding !== 'ASSETS') {
    violations.push('Wrangler static assets must use ./dist with the ASSETS binding.');
  }
  if (JSON.stringify(config.assets?.run_worker_first) !== JSON.stringify(['/api/*'])) {
    violations.push('Worker-first routing must stay limited to /api/*; static assets are asset-first.');
  }
  if ('not_found_handling' in (config.assets || {})) {
    violations.push('site-wide SPA fallback is forbidden because missing JS/CSS must remain real 404s.');
  }
  const production = config.env?.production;
  if (production?.name !== 'beeui-web' || production?.workers_dev !== false) {
    violations.push('production environment must target the beeui-web Worker with workers.dev disabled.');
  }
  const productionRoute = production?.routes?.find((route) => route.pattern === 'beeui.beemvp.com');
  if (!productionRoute?.custom_domain) violations.push('production owner-action config is missing the beeui.beemvp.com Custom Domain.');

  const worker = fs.readFileSync(workerPath, 'utf8');
  for (const token of ['/api/health', "error: 'not_found'", 'build-identity.json', "cache-control', 'no-store"]) {
    if (!worker.includes(token)) violations.push(`Worker runtime contract missing ${token}.`);
  }
  if (/secret|token|password/i.test(worker.replaceAll('x-content-type-options', ''))) {
    violations.push('Worker runtime source contains a suspicious secret/token/password term.');
  }

  const build = fs.readFileSync(buildPath, 'utf8');
  for (const token of ['apps/docs/dist', 'apps/showcase/dist-public-web', 'apps/demo/dist-public-web', 'web/worker/dist', 'asset collision', 'build-identity.json', '_headers']) {
    if (!build.includes(token)) violations.push(`composed Worker build contract missing ${token}.`);
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const script of ['build', 'typecheck', 'validate', 'dev', 'deploy:preview', 'deploy:production']) {
    if (!pkg.scripts?.[script]) violations.push(`Worker package is missing script ${script}.`);
  }
  if (!Object.values(pkg.scripts || {}).some((command) => command.includes('wrangler@4.128.0'))) {
    violations.push('Wrangler CLI must be version-pinned for reproducible launch validation.');
  }
  return violations;
}
