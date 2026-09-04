import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROOT_DIR,
  buildPublicSiteContract,
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

// Two redirect classes share one manifest. `legacyDocsRedirect` covers the pre-/docs
// origin layout (/theming/ -> /docs/theming/). `docsFoundation.movedRoutes` covers IA
// moves *inside* /docs/ that happen as the ratified sections take ownership of content
// (/docs/getting-started/ -> /docs/start/, owned by #457). Both must survive as real
// 308s, so both are emitted into the composed worker's _redirects.
export function buildRedirectRules(config) {
  const moved = [...(config.docsFoundation?.movedRoutes ?? [])]
    .sort((a, b) => a.fromPrefix.localeCompare(b.fromPrefix));
  // A legacy prefix whose /docs/ landing spot has since moved would otherwise cost the
  // visitor two hops (/theming/ -> /docs/theming/ -> /docs/guides/theming/). Resolve the
  // legacy destination through the move map so every rule is a single 308.
  const movedByPrefix = new Map(moved.map((rule) => [rule.fromPrefix, rule.toPrefix]));
  const rules = [];
  const legacy = config.legacyDocsRedirect;
  if (legacy) {
    for (const fromPrefix of [...legacy.prefixes].sort()) {
      const docsPrefix = `${legacy.targetPrefix}${fromPrefix}`.replace(/\/{2,}/gu, '/');
      const movedTo = movedByPrefix.get(docsPrefix);
      rules.push({
        fromPrefix,
        toPrefix: movedTo ?? docsPrefix,
        status: legacy.status,
        preserveSuffix: true,
        preserveQuery: true,
        // Set only when flattening skipped a hop. It records which /docs/ prefix this
        // legacy rule is an alias of, so validation can tell an intentional alias
        // convergence apart from two unrelated prefixes claiming one destination.
        ...(movedTo ? { aliasOf: docsPrefix } : {}),
      });
    }
  }
  for (const rule of moved) {
    rules.push({
      fromPrefix: rule.fromPrefix,
      toPrefix: rule.toPrefix,
      status: rule.status,
      preserveSuffix: true,
      preserveQuery: true,
    });
  }
  return rules.sort((a, b) => a.fromPrefix.localeCompare(b.fromPrefix));
}

// Cloudflare static-asset `_redirects` syntax. `:splat` carries the path suffix, so a
// moved section redirects every descendant page, not just its index.
export function renderRedirectsFile(rules) {
  const lines = rules.map((rule) => `${rule.fromPrefix}* ${rule.toPrefix}:splat ${rule.status}`);
  return `${lines.join('\n')}\n`;
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

export function buildDocsFoundationManifest(rootDir = ROOT_DIR, { environment } = {}) {
  const config = readPublicSiteConfig(rootDir);
  const siteContract = buildPublicSiteContract(rootDir, { environment });
  if (!config.docsFoundation) {
    throw new Error('web/public-site.config.json is missing docsFoundation.');
  }

  return {
    schemaVersion: config.docsFoundation.schemaVersion,
    environment: siteContract.environment,
    canonicalOrigin: siteContract.origin,
    indexPolicy: siteContract.indexPolicy,
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
  // A rule carrying `aliasOf` was flattened past a moved prefix, so it is deliberately
  // the same journey as the move's own rule and may share its destination. Any other
  // pair sharing a destination still means two unrelated prefixes claim one page.
  const aliasedDestinations = new Set(
    manifest.redirects.filter((redirect) => redirect.aliasOf).map((redirect) => redirect.toPrefix),
  );
  for (const redirect of manifest.redirects) {
    if (redirectSources.has(redirect.fromPrefix)) violations.push(`duplicate redirect source ${redirect.fromPrefix}.`);
    if (redirectDestinations.has(redirect.toPrefix) && !aliasedDestinations.has(redirect.toPrefix)) {
      violations.push(`ambiguous duplicate redirect destination ${redirect.toPrefix}.`);
    }
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

  // A moved route only stops being a 404 if the source is actually vacated and the
  // destination actually exists. Without both, the redirect manifest reads green while
  // the live site serves a redirect into nothing (or shadows a page that still renders).
  for (const moved of config.docsFoundation.movedRoutes ?? []) {
    if (!moved.fromPrefix?.startsWith('/docs/') || !moved.fromPrefix.endsWith('/')) {
      violations.push(`moved docs route ${moved.fromPrefix} must be a slash-delimited /docs/ prefix.`);
      continue;
    }
    if (!moved.toPrefix?.startsWith('/docs/') || !moved.toPrefix.endsWith('/')) {
      violations.push(`moved docs route ${moved.fromPrefix} must target a slash-delimited /docs/ prefix.`);
      continue;
    }
    const stillPublished = [...docsRoutes].filter((route) => route.startsWith(moved.fromPrefix));
    if (stillPublished.length) {
      violations.push(
        `moved docs route ${moved.fromPrefix} still has published pages (${stillPublished.join(', ')}); ` +
        'a redirected prefix may not also render content.',
      );
    }
    if (!docsRoutes.has(moved.toPrefix)) {
      violations.push(`moved docs route ${moved.fromPrefix} redirects to ${moved.toPrefix}, which has no page.`);
    }
  }

  const environments = config.environments ?? {};
  if (environments.production?.indexPolicy !== 'index,follow') {
    violations.push('production index policy must be index,follow.');
  }
  for (const environment of ['development', 'staging']) {
    const profile = environments[environment];
    if (profile?.indexPolicy !== 'noindex,nofollow') violations.push(`${environment} index policy must be noindex,nofollow.`);
    if (!profile?.robotsDisallow?.includes('/')) violations.push(`${environment} robots policy must disallow crawling.`);
  }
  if (!manifest.seo?.sitemap?.includeIndexableRoutes) violations.push('sitemap architecture must include indexable routes.');

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
    console.log('Docs foundation contract passed (routes, redirects, environment SEO, source pipelines and release truth are consistent).');
    return;
  }

  for (const output of writeDocsFoundationOutputs(ROOT_DIR)) console.log(`generated ${output}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) run();
