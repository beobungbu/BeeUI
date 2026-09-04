#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, buildPublicSiteContract, readPublicSiteConfig } from './public-site-contract-lib.mjs';

const REQUIRED_ROUTES = ['landing', 'docs', 'showcase', 'demo', 'examples', 'changelog', 'llms', 'api'];
const REQUIRED_NAV = ['/docs/', '/docs/components/', '/docs/patterns/', '/showcase/', '/demo/'];
const DEPLOYMENT_CONFIGS = {
  development: '.github/deployment/wrangler-development.jsonc',
  staging: '.github/deployment/wrangler-staging.jsonc',
  production: '.github/deployment/wrangler-production.jsonc',
};
const WORKER_WRANGLER = 'web/worker/wrangler.jsonc';

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readWranglerRouteHost(rootDir, relativePath) {
  const config = readJson(rootDir, relativePath);
  const customDomain = (config.routes ?? []).find((route) => route.custom_domain === true)?.pattern;
  if (!customDomain) throw new Error(`${relativePath} is missing its custom-domain route.`);
  return customDomain;
}

function readWorkerEnvironmentHost(rootDir, environment) {
  const config = readJson(rootDir, WORKER_WRANGLER);
  const customDomain = (config.env?.[environment]?.routes ?? []).find((route) => route.custom_domain === true)?.pattern;
  if (!customDomain) throw new Error(`${WORKER_WRANGLER} is missing ${environment} custom-domain route.`);
  return customDomain;
}

export function collectPublicSiteContractViolations(rootDir = ROOT_DIR) {
  const violations = [];
  let contract;
  let rawConfig;
  try {
    contract = buildPublicSiteContract(rootDir);
    rawConfig = readPublicSiteConfig(rootDir);
  } catch (error) {
    return [error.message];
  }

  if (contract.productionRuntime !== 'cloudflare-workers') violations.push('productionRuntime must remain cloudflare-workers.');
  if (contract.docsBase !== '/docs') violations.push('docsBase must remain /docs.');
  if (contract.buildTruth.publication.published !== false) {
    violations.push('public-site contract may not describe packages as published before the owner publication gate opens.');
  }
  if (contract.buildTruth.version !== contract.buildTruth.publication.currentVersion) {
    violations.push(`workspace version ${contract.buildTruth.version} does not match distribution currentVersion ${contract.buildTruth.publication.currentVersion}.`);
  }

  const environmentNames = Object.keys(rawConfig.environments ?? {});
  for (const required of Object.keys(DEPLOYMENT_CONFIGS)) {
    if (!environmentNames.includes(required)) violations.push(`missing required public-site environment ${required}.`);
  }
  const origins = new Set();
  for (const [environment, deploymentConfig] of Object.entries(DEPLOYMENT_CONFIGS)) {
    const profile = rawConfig.environments?.[environment];
    if (!profile) continue;
    let parsedOrigin;
    try {
      parsedOrigin = new URL(profile.origin);
    } catch {
      violations.push(`environment ${environment} origin must be an absolute URL.`);
      continue;
    }
    if (parsedOrigin.protocol !== 'https:') violations.push(`environment ${environment} origin must use https.`);
    if (parsedOrigin.pathname !== '/') violations.push(`environment ${environment} origin must not contain a path.`);
    if (origins.has(profile.origin)) violations.push(`environment origin ${profile.origin} is duplicated.`);
    origins.add(profile.origin);
    const expectedPolicy = environment === 'production' ? 'index,follow' : 'noindex,nofollow';
    if (profile.indexPolicy !== expectedPolicy) {
      violations.push(`environment ${environment} indexPolicy must be ${expectedPolicy}.`);
    }
    if (environment !== 'production' && !(profile.robotsDisallow ?? []).includes('/')) {
      violations.push(`environment ${environment} robots policy must disallow /.`);
    }
    try {
      const deploymentHost = readWranglerRouteHost(rootDir, deploymentConfig);
      if (parsedOrigin.hostname !== deploymentHost) {
        violations.push(`environment ${environment} origin host ${parsedOrigin.hostname} does not match ${deploymentConfig} host ${deploymentHost}.`);
      }
    } catch (error) {
      violations.push(error.message);
    }
    try {
      const workerHost = readWorkerEnvironmentHost(rootDir, environment);
      if (parsedOrigin.hostname !== workerHost) {
        violations.push(`environment ${environment} origin host ${parsedOrigin.hostname} does not match ${WORKER_WRANGLER} host ${workerHost}.`);
      }
    } catch (error) {
      violations.push(error.message);
    }
  }

  const ids = new Set(contract.routes.map((route) => route.id));
  for (const id of REQUIRED_ROUTES) if (!ids.has(id)) violations.push(`missing required route id ${id}.`);
  if (ids.size !== contract.routes.length) violations.push('route ids must be unique.');

  const exactPrefixes = new Set();
  for (const route of contract.routes) {
    if (!route.prefix?.startsWith('/')) violations.push(`route ${route.id} must use an absolute prefix.`);
    if (exactPrefixes.has(route.prefix)) violations.push(`route prefix ${route.prefix} is duplicated.`);
    exactPrefixes.add(route.prefix);
    if (route.visibility === 'public' && !route.owner) violations.push(`public route ${route.id} is missing an owner.`);
  }

  const api = contract.routes.find((route) => route.id === 'api');
  if (api?.prefix !== '/api/' || api?.visibility !== 'runtime' || api?.indexable !== false) {
    violations.push('api route must be non-indexable runtime authority at /api/.');
  }

  const navHrefs = new Set(contract.navigation.map((item) => item.href));
  for (const href of REQUIRED_NAV) if (!navHrefs.has(href)) violations.push(`navigation is missing ${href}.`);

  for (const [className, sources] of Object.entries(contract.contentSources ?? {})) {
    if (!Array.isArray(sources) || sources.length === 0) {
      violations.push(`content source class ${className} has no canonical sources.`);
      continue;
    }
    for (const source of sources) {
      const isDirectoryPrefix = source.endsWith('/components') || source.endsWith('/patterns') || source.endsWith('/src');
      if (!fs.existsSync(path.join(rootDir, source)) && !isDirectoryPrefix) {
        violations.push(`content source ${className} references missing ${source}.`);
      }
    }
  }

  for (const legacy of contract.legacyDocsRedirect?.prefixes ?? []) {
    if (!legacy.startsWith('/') || !legacy.endsWith('/')) violations.push(`legacy docs prefix ${legacy} must be slash-delimited.`);
    if (['/docs/', '/showcase/', '/demo/', '/examples/', '/changelog/', '/api/'].includes(legacy)) {
      violations.push(`legacy docs prefix ${legacy} collides with a canonical route.`);
    }
  }

  for (const [name, output] of Object.entries(contract.buildOutputs ?? {})) {
    if (!output || path.isAbsolute(output) || output.includes('..')) violations.push(`build output ${name} must be a repository-relative path.`);
  }

  return violations;
}

function main() {
  const violations = collectPublicSiteContractViolations();
  if (violations.length) {
    console.error('Public site architecture contract failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log('Public site architecture contract passed (environment origins, deployment routes, sources, publication state and outputs are consistent).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
