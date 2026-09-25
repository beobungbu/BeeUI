import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = 'web/public-site.config.json';

const ENVIRONMENT_ALIASES = new Map([
  ['development', 'development'],
  ['development-preview', 'development'],
  ['staging', 'staging'],
  ['staging-preview', 'staging'],
  ['production', 'production'],
  ['production-candidate', 'staging'],
  ['main', 'production'],
  ['preview', 'development'],
  ['pr-preview', 'development'],
  ['ci', 'development'],
  ['local', 'development'],
]);

export function readPublicSiteConfig(rootDir = ROOT_DIR) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, CONFIG_PATH), 'utf8'));
}

export function normalizePublicSiteEnvironment(value = process.env.BEEUI_WEB_ENV || 'development') {
  const environment = ENVIRONMENT_ALIASES.get(value);
  if (!environment) throw new Error(`Unsupported BeeUI Web environment: ${value}.`);
  return environment;
}

export function resolvePublicSiteEnvironment(config, value = process.env.BEEUI_WEB_ENV || 'development') {
  const environment = normalizePublicSiteEnvironment(value);
  const profile = config.environments?.[environment];
  if (!profile) throw new Error(`web/public-site.config.json is missing environment profile ${environment}.`);
  if (!profile.origin) throw new Error(`public-site environment ${environment} is missing origin.`);
  if (!['index,follow', 'noindex,nofollow'].includes(profile.indexPolicy)) {
    throw new Error(`public-site environment ${environment} has invalid indexPolicy ${profile.indexPolicy}.`);
  }
  return { environment, ...profile };
}

export function readWorkspaceVersion(rootDir = ROOT_DIR) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
}

// `packages/ui/package.json` is the single authored lockstep version (see docs/dist-tag-policy.md's
// "Package set and lockstep versioning" section). Every other manifest, generated surface and
// policy projection derives from this file; nothing else may author a competing copy.
export const CURRENT_VERSION_MANIFEST = 'packages/ui/package.json';

export function readCurrentVersion(rootDir = ROOT_DIR) {
  const manifestPath = path.join(rootDir, CURRENT_VERSION_MANIFEST);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.version) throw new Error(`${CURRENT_VERSION_MANIFEST} has no "version" field; it is the single authored lockstep version.`);
  return manifest.version;
}

// Fields the `json dist-tag-policy` block used to author by hand. Each now has exactly one
// derived source: `currentVersion`/`prereleaseExample` come from `packages/ui/package.json`,
// and `prereleaseVersionPattern` is derived from `candidateStableVersion`. Authoring any of them
// again would recreate the duplicate-pin drift this module exists to remove, so parsing fails
// loudly instead of silently accepting a stale hand-typed copy.
export const LEGACY_POLICY_FIELDS = ['currentVersion', 'prereleaseExample', 'prereleaseVersionPattern'];

export function assertNoLegacyPolicyFields(policy) {
  const present = LEGACY_POLICY_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(policy, field));
  if (present.length > 0) {
    throw new Error(
      `docs/dist-tag-policy.md's \`json dist-tag-policy\` block must not author ${present.join(', ')}; ` +
        `the current version is derived from ${CURRENT_VERSION_MANIFEST} and the prerelease pattern is derived ` +
        'from candidateStableVersion. Remove the field(s) from the policy block.',
    );
  }
}

// The one place the prerelease shape (`<stable>-rc.N`) is generated from the stable-line policy,
// so the npm-release workflow guard, the distribution-policy check and every generator agree on
// one derivation instead of three independently hand-typed regex copies.
export function derivePrereleasePattern(candidateStableVersion) {
  if (typeof candidateStableVersion !== 'string' || candidateStableVersion.length === 0) {
    throw new Error('derivePrereleasePattern requires a non-empty candidateStableVersion.');
  }
  const escaped = candidateStableVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^${escaped}-rc\\.(0|[1-9][0-9]*)$`;
}

export function readPublicationState(rootDir = ROOT_DIR) {
  const markdown = fs.readFileSync(path.join(rootDir, 'docs/dist-tag-policy.md'), 'utf8');
  const match = /```json dist-tag-policy\n([\s\S]*?)\n```/.exec(markdown);
  if (!match) throw new Error('docs/dist-tag-policy.md is missing its `json dist-tag-policy` block.');
  const policy = JSON.parse(match[1]);
  assertNoLegacyPolicyFields(policy);
  return {
    published: policy.published,
    currentVersion: readCurrentVersion(rootDir),
    // The release control plane compares the npm workflow's shell guard to this pattern, so the
    // projection has to carry it: dropping it made that comparison pass against `undefined`.
    prereleaseVersionPattern: derivePrereleasePattern(policy.candidateStableVersion),
    candidateStableVersion: policy.candidateStableVersion,
    stableDistTag: policy.stableDistTag,
    prereleaseDistTag: policy.prereleaseDistTag,
    lockstepPackages: policy.lockstepPackages ?? [],
    releaseEnvironment: policy.releaseEnvironment ?? null,
    observedDistTags: policy.observedDistTags ?? {},
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

export function buildPublicSiteContract(rootDir = ROOT_DIR, { environment } = {}) {
  const config = readPublicSiteConfig(rootDir);
  const resolvedEnvironment = resolvePublicSiteEnvironment(config, environment);
  const publication = readPublicationState(rootDir);
  const version = readWorkspaceVersion(rootDir);
  return {
    ...config,
    environment: resolvedEnvironment.environment,
    origin: resolvedEnvironment.origin,
    indexPolicy: resolvedEnvironment.indexPolicy,
    robotsDisallow: resolvedEnvironment.robotsDisallow ?? [],
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
