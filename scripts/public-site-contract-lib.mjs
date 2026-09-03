import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = 'web/public-site.config.json';

export function readPublicSiteConfig(rootDir = ROOT_DIR) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, CONFIG_PATH), 'utf8'));
}

export function readWorkspaceVersion(rootDir = ROOT_DIR) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
}

export function readPublicationState(rootDir = ROOT_DIR) {
  const markdown = fs.readFileSync(path.join(rootDir, 'docs/dist-tag-policy.md'), 'utf8');
  const match = /```json dist-tag-policy\n([\s\S]*?)\n```/.exec(markdown);
  if (!match) throw new Error('docs/dist-tag-policy.md is missing its `json dist-tag-policy` block.');
  const policy = JSON.parse(match[1]);
  return {
    published: policy.published,
    currentVersion: policy.currentVersion,
    stableDistTag: policy.stableDistTag,
    prereleaseDistTag: policy.prereleaseDistTag,
    lockstepPackages: policy.lockstepPackages ?? [],
    releaseEnvironment: policy.releaseEnvironment ?? null,
  };
}

export function readCliDistributionState(rootDir = ROOT_DIR) {
  const manifestPath = path.join(rootDir, 'packages/cli/package.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return {
    packageName: manifest.name,
    version: manifest.version,
    binaryNames: Object.keys(manifest.bin ?? {}),
  };
}

export function buildPublicSiteContract(rootDir = ROOT_DIR) {
  const config = readPublicSiteConfig(rootDir);
  const publication = readPublicationState(rootDir);
  const version = readWorkspaceVersion(rootDir);
  return {
    ...config,
    buildTruth: {
      version,
      publication,
      cli: readCliDistributionState(rootDir),
    },
  };
}

export function routeForPath(pathname, config) {
  if (pathname === '/') return config.routes.find((route) => route.id === 'landing') ?? null;
  const candidates = config.routes
    .filter((route) => route.prefix !== '/' && pathname.startsWith(route.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0] ?? null;
}
