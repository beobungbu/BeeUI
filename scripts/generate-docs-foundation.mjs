import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROOT_DIR,
  readPublicSiteConfig,
  readPublicationState,
  readWorkspaceVersion,
} from './public-site-contract-lib.mjs';

export const OUTPUT_PATH = 'docs/public-docs-foundation.generated.json';
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
  const publication = readPublicationState(rootDir);
  const workspaceVersion = readWorkspaceVersion(rootDir);
  return {
    schemaVersion: 1,
    generatedFrom: ['docs/dist-tag-policy.md', 'package.json'],
    published: publication.published,
    status: publication.published ? 'stable' : 'unpublished',
    currentVersion: publication.currentVersion,
    workspaceVersion,
    ownerGate: '#254',
    publicInstallCommandsAvailable: publication.published,
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
    releaseState: buildReleaseState(rootDir),
  };
}

export function renderDocsFoundationManifest(rootDir = ROOT_DIR) {
  return `${JSON.stringify(buildDocsFoundationManifest(rootDir), null, 2)}\n`;
}

export function checkDocsFoundationManifest(rootDir = ROOT_DIR) {
  const output = path.join(rootDir, OUTPUT_PATH);
  const expected = renderDocsFoundationManifest(rootDir);
  if (!fs.existsSync(output)) {
    throw new Error(`${OUTPUT_PATH} is missing. Run pnpm docs:foundation:generate.`);
  }
  const actual = fs.readFileSync(output, 'utf8');
  if (actual !== expected) {
    throw new Error(`${OUTPUT_PATH} is stale. Run pnpm docs:foundation:generate and commit the result.`);
  }
}

function run() {
  const rootDir = ROOT_DIR;
  const check = process.argv.includes('--check');
  if (check) {
    checkDocsFoundationManifest(rootDir);
    console.log(`docs foundation manifest is current: ${OUTPUT_PATH}`);
    return;
  }

  const output = path.join(rootDir, OUTPUT_PATH);
  fs.writeFileSync(output, renderDocsFoundationManifest(rootDir));
  console.log(`generated ${OUTPUT_PATH}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  run();
}
