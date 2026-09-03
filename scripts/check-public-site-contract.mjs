#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';

const REQUIRED_ROUTES = ['landing', 'docs', 'showcase', 'demo', 'examples', 'changelog', 'llms', 'api'];
const REQUIRED_NAV = ['/docs/', '/docs/components/', '/docs/patterns/', '/showcase/', '/demo/'];

export function collectPublicSiteContractViolations(rootDir = ROOT_DIR) {
  const violations = [];
  let contract;
  try {
    contract = buildPublicSiteContract(rootDir);
  } catch (error) {
    return [error.message];
  }

  if (contract.origin !== 'https://beeui.beemvp.com') violations.push('origin must be https://beeui.beemvp.com.');
  if (contract.productionRuntime !== 'cloudflare-workers') violations.push('productionRuntime must remain cloudflare-workers.');
  if (contract.docsBase !== '/docs') violations.push('docsBase must remain /docs.');
  if (contract.buildTruth.publication.published !== false) {
    violations.push('public-site contract may not describe packages as published before the owner publication gate opens.');
  }
  if (contract.buildTruth.version !== contract.buildTruth.publication.currentVersion) {
    violations.push(`workspace version ${contract.buildTruth.version} does not match distribution currentVersion ${contract.buildTruth.publication.currentVersion}.`);
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
  console.log('Public site architecture contract passed (routes, sources, publication state and outputs are consistent).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
