import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROOT_DIR,
  readCliDistributionState,
  readPublicSiteConfig,
  readPublicationState,
  readWorkspaceVersion,
} from './public-site-contract-lib.mjs';

export const ROUTE_MANIFEST_OUTPUT = 'apps/docs/public/route-manifest.json';
export const RELEASE_STATE_OUTPUT = 'apps/docs/public/release-state.json';
const DOCS_CONTENT_ROOT = 'apps/docs/src/content/docs';
const SUPPORTED_CONTENT_EXTENSIONS = new Set(['.md', '.mdx']);

function slash(value) {
  return value.split(path.sep).join('/');
}

function walkContentFiles(directory, rootDir, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkContentFiles(absolute, rootDir, result);
      continue;
    }
    if (!SUPPORTED_CONTENT_EXTENSIONS.has(path.extname(entry.name))) continue;
    result.push(slash(path.relative(rootDir, absolute)));
  }
  return result;
}

export function contentPathToRoute(contentPath, docsBase = '/docs') {
  const prefix = `${DOCS_CONTENT_ROOT}/`;
  if (!contentPath.startsWith(prefix)) {
    throw new Error(`Docs content path must live under ${DOCS_CONTENT_ROOT}: ${contentPath}`);
  }

  let relative = contentPath.slice(prefix.length).replace(/\.(md|mdx)$/u, '');
  if (relative === 'index') relative = '';
  if (relative.endsWith('/index')) relative = relative.slice(0, -'/index'.length);
  const normalizedBase = docsBase === '/' ? '' : docsBase.replace(/\/$/u, '');
  return relative ? `${normalizedBase}/${relative}/` : `${normalizedBase}/`;
}

export function collectDocsRoutes(rootDir = ROOT_DIR, docsBase = '/docs') {
  const contentRoot = path.join(rootDir, DOCS_CONTENT_ROOT);
  return walkContentFiles(contentRoot, rootDir)
    .map((contentPath) => ({
      route: contentPathToRoute(contentPath, docsBase),
      source: contentPath,
    }))
    .sort((a, b) => a.route.localeCompare(b.route) || a.source.localeCompare(b.source));
}

export function buildRedirectRules(config) {
  const legacy = config.legacyDocsRedirect;
  if (!legacy) return [];
  return [...legacy.prefixes]
    .sort()
    .map((fromPrefix) => ({
      fromPrefix,
      toPrefix: `${legacy.targetPrefix}${fromPrefix}`.replace(/\/{2,}/gu, '/'),
      status: legacy.status,
      preserveSuffix: true,
      preserveQuery: true,
    }));
}

export function buildReleaseState(rootDir = ROOT_DIR) {
  const config = readPublicSiteConfig(rootDir);
  const publication = readPublicationState(rootDir);
  const workspaceVersion = readWorkspaceVersion(rootDir);
  const cli = readCliDistributionState(rootDir);
  const releaseConfig = config.docsFoundation?.release;
  if (!releaseConfig) throw new Error('docsFoundation.release is missing from web/public-site.config.json.');

  const prerelease = publication.published && publication.currentVersion.includes('-');
  const status = publication.published ? (prerelease ? 'prerelease' : 'stable') : 'unpublished';
  const channel = publication.published
    ? (prerelease ? publication.prereleaseDistTag : publication.stableDistTag)
    : 'closed';

  return {
    schemaVersion: 1,
    generatedFrom: ['docs/dist-tag-policy.md', 'packages/cli/package.json', 'package.json', 'web/public-site.config.json'],
    published: publication.published,
    status,
    channel,
    currentVersion: publication.currentVersion,
    workspaceVersion,
    packageNames: publication.lockstepPackages,
    cliPackageName: cli?.packageName ?? null,
    cliAvailable: publication.published && Boolean(cli?.packageName),
    publicInstallCommandsAvailable: publication.published,
    installCta: publication.published ? (prerelease ? 'prerelease' : 'stable') : 'hidden',
    sourceEvaluationCta: 'enabled',
    ownerGate: releaseConfig.ownerGate,
    changelogHref: releaseConfig.changelogHref,
    migrationHref: releaseConfig.migrationHref,
    sourceEvaluationHref: releaseConfig.sourceEvaluationHref,
  };
}

export function buildDocsFoundationManifest(rootDir = ROOT_DIR) {
  const config = readPublicSiteConfig(rootDir);
  if (!config.docsFoundation) {
    throw new Error('web/public-site.config.json is missing docsFoundation.');
  }

  return {
    schemaVersion: config.docsFoundation.schemaVersion,
    canonicalOrigin: config.origin,
    productionRuntime: config.productionRuntime,
    currentRouteMounts: config.routes.map(({ id, prefix, owner, visibility, indexable }) => ({
      id,
      prefix,
      owner,
      visibility,
      indexable,
    })),
    currentDocsRoutes: collectDocsRoutes(rootDir, config.docsBase),
    targetDocsSections: config.docsFoundation.sections,
    redirects: buildRedirectRules(config),
    sourceToPage: config.docsFoundation.sourceToPage,
    showcaseAddressability: config.docsFoundation.showcaseAddressability,
    seo: config.docsFoundation.seo,
  };
}

function splitSymbolReference(reference) {
  const [sourcePath, symbol] = reference.split('#', 2);
  return { sourcePath, symbol: symbol || null };
}

function exportedSymbolExists(source, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:async\\s+)?(?:function|const|let|class|interface|type|enum)\\s+${escaped}\\b|\\bexport\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`,
    'su',
  );
  return pattern.test(source);
}

function validateSymbolReference(rootDir, reference, label) {
  if (!reference) return `${label} reference is unset.`;
  const { sourcePath, symbol } = splitSymbolReference(reference);
  const absolutePath = path.join(rootDir, sourcePath);
  if (!fs.existsSync(absolutePath)) return `${label} references missing ${reference}.`;
  if (!symbol) return null;
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (!exportedSymbolExists(source, symbol)) return `${label} references missing exported symbol ${reference}.`;
  return null;
}

export function validateDocsFoundation(rootDir = ROOT_DIR) {
  const violations = [];
  let config;
  let manifest;
  let releaseState;
  try {
    config = readPublicSiteConfig(rootDir);
    manifest = buildDocsFoundationManifest(rootDir);
    releaseState = buildReleaseState(rootDir);
  } catch (error) {
    return [error.message];
  }

  const docsRoutes = new Set(manifest.currentDocsRoutes.map((entry) => entry.route));
  const sectionIds = new Set();
  const sectionRoutes = new Set();
  for (const section of manifest.targetDocsSections) {
    if (sectionIds.has(section.id)) violations.push(`duplicate docs foundation section id ${section.id}.`);
    if (sectionRoutes.has(section.route)) violations.push(`duplicate docs foundation section route ${section.route}.`);
    sectionIds.add(section.id);
    sectionRoutes.add(section.route);
    if (!docsRoutes.has(section.route)) violations.push(`target docs route ${section.route} has no static content owner.`);
  }

  const metadata = config.docsFoundation.metadataContracts;
  for (const [reference, label] of [
    [metadata?.implementation, 'metadata implementation'],
    [metadata?.releaseState, 'release-state module'],
  ]) {
    const violation = validateSymbolReference(rootDir, reference, label);
    if (violation) violations.push(violation);
  }
  if (metadata?.implementation) {
    for (const symbol of metadata.types ?? []) {
      const violation = validateSymbolReference(rootDir, `${metadata.implementation}#${symbol}`, 'metadata contract');
      if (violation) violations.push(violation);
    }
  }

  for (const pipeline of manifest.sourceToPage) {
    if (!pipeline.id || !pipeline.routePrefix?.startsWith('/')) violations.push('source-to-page pipeline requires an id and absolute routePrefix.');
    for (const source of pipeline.sources ?? []) {
      if (!fs.existsSync(path.join(rootDir, source))) violations.push(`source-to-page ${pipeline.id} references missing source ${source}.`);
    }
    if (pipeline.generator && !fs.existsSync(path.join(rootDir, pipeline.generator))) {
      violations.push(`source-to-page ${pipeline.id} references missing generator ${pipeline.generator}.`);
    }
  }

  const redirectSources = new Set();
  const redirectDestinations = new Set();
  const redirectMap = new Map();
  for (const redirect of manifest.redirects) {
    if (redirectSources.has(redirect.fromPrefix)) violations.push(`duplicate redirect source ${redirect.fromPrefix}.`);
    if (redirectDestinations.has(redirect.toPrefix)) violations.push(`ambiguous duplicate redirect destination ${redirect.toPrefix}.`);
    if (redirect.fromPrefix === redirect.toPrefix) violations.push(`redirect loop at ${redirect.fromPrefix}.`);
    redirectSources.add(redirect.fromPrefix);
    redirectDestinations.add(redirect.toPrefix);
    redirectMap.set(redirect.fromPrefix, redirect.toPrefix);
  }
  for (const source of redirectMap.keys()) {
    const visited = new Set([source]);
    let cursor = redirectMap.get(source);
    while (cursor && redirectMap.has(cursor)) {
      if (visited.has(cursor)) {
        violations.push(`redirect cycle detected from ${source}.`);
        break;
      }
      visited.add(cursor);
      cursor = redirectMap.get(cursor);
    }
  }

  const seo = manifest.seo;
  if (seo?.canonicalOrigin !== config.origin) violations.push('SEO canonicalOrigin must match the canonical public origin.');
  if (seo?.productionIndexPolicy !== 'index,follow') violations.push('production index policy must be index,follow.');
  if (seo?.nonProductionIndexPolicy !== 'noindex,nofollow') violations.push('non-production index policy must be noindex,nofollow.');
  if (!seo?.sitemap?.enabledWhenSiteConfigured) violations.push('sitemap architecture must be enabled when Astro site is configured.');
  if (!seo?.robots?.nonProduction?.disallow?.includes('/')) violations.push('non-production robots policy must disallow crawling.');

  const showcaseBuilder = config.docsFoundation.showcaseAddressability?.urlBuilder;
  const showcaseViolation = validateSymbolReference(rootDir, showcaseBuilder, 'Showcase URL-builder contract');
  if (showcaseViolation) violations.push(showcaseViolation);

  if (releaseState.workspaceVersion !== releaseState.currentVersion) {
    violations.push(`release state version ${releaseState.currentVersion} does not match workspace ${releaseState.workspaceVersion}.`);
  }
  if (!releaseState.published) {
    if (releaseState.publicInstallCommandsAvailable) violations.push('unpublished release state may not expose public install commands.');
    if (releaseState.cliAvailable) violations.push('unpublished release state may not expose the CLI as publicly available.');
    if (releaseState.installCta !== 'hidden') violations.push('unpublished release state must hide install CTA.');
    if (releaseState.ownerGate !== '#254') violations.push('unpublished release state must retain owner gate #254.');
  }
  if (releaseState.sourceEvaluationCta !== 'enabled') violations.push('source evaluation CTA must remain available while publication is closed.');

  return violations;
}

export function writeDocsFoundationOutputs(rootDir = ROOT_DIR) {
  const routeOutput = path.join(rootDir, ROUTE_MANIFEST_OUTPUT);
  const releaseOutput = path.join(rootDir, RELEASE_STATE_OUTPUT);
  fs.mkdirSync(path.dirname(routeOutput), { recursive: true });
  fs.writeFileSync(routeOutput, `${JSON.stringify(buildDocsFoundationManifest(rootDir), null, 2)}\n`);
  fs.writeFileSync(releaseOutput, `${JSON.stringify(buildReleaseState(rootDir), null, 2)}\n`);
  return [ROUTE_MANIFEST_OUTPUT, RELEASE_STATE_OUTPUT];
}

function run() {
  const check = process.argv.includes('--check');
  const violations = validateDocsFoundation(ROOT_DIR);
  if (violations.length) {
    console.error('Docs foundation contract failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  if (check) {
    console.log('Docs foundation contract passed (routes, redirects, SEO, source pipelines and release truth are consistent).');
    return;
  }

  for (const output of writeDocsFoundationOutputs(ROOT_DIR)) console.log(`generated ${output}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) run();
