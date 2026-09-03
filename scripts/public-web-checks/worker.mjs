import fs from 'node:fs';
import path from 'node:path';

const TARGETS = Object.freeze({
  development: {
    worker: 'beeui-dev',
    domain: 'beeui-dev.beemvp.com',
    workersDev: true,
    previewUrls: true,
  },
  staging: {
    worker: 'beeui-stg',
    domain: 'beeui-stg.beemvp.com',
    workersDev: true,
    previewUrls: true,
  },
  production: {
    worker: 'beeui',
    domain: 'beeui.beemvp.com',
    workersDev: false,
    previewUrls: false,
  },
});

export async function collectViolations(rootDir) {
  const violations = [];
  const configPath = path.join(rootDir, 'web/worker/wrangler.jsonc');
  const workerPath = path.join(rootDir, 'web/worker/src/index.mjs');
  const buildPath = path.join(rootDir, 'scripts/build-public-worker.mjs');
  const packagePath = path.join(rootDir, 'web/worker/package.json');
  const ciPath = path.join(rootDir, '.github/workflows/beeui-web.yml');
  const environmentCiPath = path.join(rootDir, '.github/workflows/beeui-environment-ci.yml');
  const deliveryPath = path.join(rootDir, '.github/workflows/beeui-web-delivery.yml');
  const codeownersPath = path.join(rootDir, '.github/CODEOWNERS');

  const trustedConfigPaths = Object.fromEntries(
    Object.keys(TARGETS).map((target) => [
      target,
      path.join(rootDir, `.github/deployment/wrangler-${target}.jsonc`),
    ]),
  );

  for (const file of [
    configPath,
    workerPath,
    buildPath,
    packagePath,
    ciPath,
    environmentCiPath,
    deliveryPath,
    codeownersPath,
    ...Object.values(trustedConfigPaths),
  ]) {
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

  for (const [target, expected] of Object.entries(TARGETS)) {
    const environment = config.env?.[target];
    if (!environment) {
      violations.push(`Wrangler source config is missing ${target}.`);
      continue;
    }
    if (environment.name !== expected.worker) violations.push(`${target} must target Worker ${expected.worker}.`);
    if (environment.workers_dev !== expected.workersDev) violations.push(`${target} workers_dev contract drifted.`);
    if (environment.preview_urls !== expected.previewUrls) violations.push(`${target} preview_urls contract drifted.`);
    const route = environment.routes?.find((candidate) => candidate.pattern === expected.domain);
    if (!route?.custom_domain) violations.push(`${target} is missing Custom Domain ${expected.domain}.`);
  }

  for (const [target, trustedPath] of Object.entries(trustedConfigPaths)) {
    const trusted = JSON.parse(fs.readFileSync(trustedPath, 'utf8'));
    const expected = TARGETS[target];
    if (trusted.name !== expected.worker) violations.push(`trusted ${target} config must target ${expected.worker}.`);
    if (trusted.main !== './worker.mjs') violations.push(`trusted ${target} config must consume only prebuilt worker.mjs.`);
    if (trusted.assets?.directory !== './dist' || trusted.assets?.binding !== 'ASSETS') {
      violations.push(`trusted ${target} config must consume only prebuilt dist assets.`);
    }
    if (JSON.stringify(trusted.assets?.run_worker_first) !== JSON.stringify(['/api/*'])) {
      violations.push(`trusted ${target} config must keep Worker-first routing limited to /api/*.`);
    }
    if ('build' in trusted) violations.push(`trusted ${target} config must not contain executable build hooks.`);
    if (trusted.workers_dev !== expected.workersDev || trusted.preview_urls !== expected.previewUrls) {
      violations.push(`trusted ${target} preview/workers.dev policy drifted.`);
    }
    const route = trusted.routes?.find((candidate) => candidate.pattern === expected.domain);
    if (!route?.custom_domain) violations.push(`trusted ${target} config is missing ${expected.domain}.`);
  }

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
  if (!build.includes("run('pnpm', ['build'], rootDir)")) {
    violations.push('composed Worker build must materialize package exports before Expo Router static SSR.');
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const script of [
    'build',
    'typecheck',
    'validate',
    'dev',
    'preview:development',
    'preview:staging',
    'deploy:development',
    'deploy:staging',
    'deploy:production',
  ]) {
    if (!pkg.scripts?.[script]) violations.push(`Worker package is missing script ${script}.`);
  }
  if (!Object.values(pkg.scripts || {}).some((command) => command.includes('wrangler@4.128.0'))) {
    violations.push('Wrangler CLI must be version-pinned for reproducible launch validation.');
  }

  const ci = fs.readFileSync(ciPath, 'utf8');
  if (!ci.includes('development') || !ci.includes('staging') || !ci.includes('main')) {
    violations.push('beeui-web CI must build exact pushes for development, staging and main.');
  }
  if (!ci.includes('main) ARTIFACT_ENV=production')) {
    violations.push('main push artifacts must be stamped as production, not as the branch name.');
  }
  if (/secrets\.CLOUDFLARE|vars\.CLOUDFLARE/.test(ci)) {
    violations.push('untrusted beeui-web CI must not read Cloudflare environment secrets or variables.');
  }
  if (!ci.includes('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a')) {
    violations.push('untrusted beeui-web CI must upload the immutable delivery artifact with the pinned action.');
  }

  const environmentCi = fs.readFileSync(environmentCiPath, 'utf8');
  for (const token of ['development', 'staging', 'pnpm typecheck', 'pnpm test']) {
    if (!environmentCi.includes(token)) violations.push(`post-merge environment CI missing ${token}.`);
  }
  if (/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/.test(environmentCi)) {
    violations.push('post-merge environment CI must never reference Cloudflare credentials.');
  }

  const delivery = fs.readFileSync(deliveryPath, 'utf8');
  for (const token of [
    'workflow_run:',
    'ref: main',
    'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c',
    'wrangler versions upload',
    'wrangler deploy',
    '--no-bundle',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'environment:',
    'environment-ci',
    'visual-web-report',
  ]) {
    if (!delivery.includes(token)) violations.push(`trusted delivery workflow missing ${token}.`);
  }
  if (/pnpm\s+install|npm\s+(ci|install)(?!\s+--global\s+wrangler@4\.128\.0)/.test(delivery)) {
    violations.push('trusted delivery workflow must not install or execute repository package dependencies.');
  }
  if (/pnpm\s+(run\s+)?|npm\s+run\s+/.test(delivery)) {
    violations.push('trusted delivery workflow must not execute repository package scripts.');
  }

  const codeowners = fs.readFileSync(codeownersPath, 'utf8');
  if (!codeowners.includes('/.github/deployment/')) {
    violations.push('CODEOWNERS must cover the trusted deployment configuration directory.');
  }

  return violations;
}
