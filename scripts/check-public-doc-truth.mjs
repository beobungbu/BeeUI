#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GENERATED_COMPATIBILITY_PAGE, GENERATED_RELEASE_PAGE } from './public-guide-data.mjs';
import { assertNoLegacyPolicyFields, readPublicationState } from './public-site-contract-lib.mjs';
import { renderStatusSentence } from './release-status-lib.mjs';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PUBLIC_ROOTS = [
  'README.md',
  'apps/demo/README.md',
  'apps/docs/src/content/docs',
  'docs/component-reference.md',
  'docs/dist-tag-policy.md',
  'docs/consumer-compatibility-report.md',
];
const NEGATED_COMMAND_CONTEXT = /\b(?:do not|don't|not available|unavailable|unpublished|not published|must not|never)\b/i;
const FALSE_DIST_TAG_CAUSAL_CLAIMS = [
  /npm(?:'s)?(?:\s+automatic)?\s+first-publish default/iu,
];

const REGISTRY_COMMANDS = [
  { kind: 'package', pattern: /\bnpm\s+(?:install|i)\s+(@beemvp\/beeui-[a-z0-9-]+(?:@[^\s]+)?)/ig },
  { kind: 'package', pattern: /\bpnpm\s+add\s+(@beemvp\/beeui-[a-z0-9-]+(?:@[^\s]+)?)/ig },
  { kind: 'package', pattern: /\byarn\s+add\s+(@beemvp\/beeui-[a-z0-9-]+(?:@[^\s]+)?)/ig },
  { kind: 'package', pattern: /\bbun\s+add\s+(@beemvp\/beeui-[a-z0-9-]+(?:@[^\s]+)?)/ig },
  { kind: 'cli', pattern: /\bnpx\s+(@beemvp\/beeui-cli(?:@[^\s]+)?)/ig },
  { kind: 'cli', pattern: /\bpnpm\s+dlx\s+(@beemvp\/beeui-cli(?:@[^\s]+)?)/ig },
];

function walkTextFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(target, entry.name);
    if (entry.isDirectory()) return walkTextFiles(next);
    return /\.(?:md|mdx|astro|ts|tsx|json|txt)$/.test(entry.name) ? [next] : [];
  });
}

function stableBase(version) {
  return typeof version === 'string' ? version.replace(/-rc\.(0|[1-9][0-9]*)$/, '') : version;
}

function isPrerelease(version) {
  return typeof version === 'string' && /-rc\.(0|[1-9][0-9]*)$/.test(version);
}

export function extractPublicationPolicy(rootDir = ROOT_DIR) {
  const fallback = {
    published: false,
    registryHasLiveChannel: false,
    state: 'unpublished',
    currentVersion: undefined,
    prereleaseDistTag: 'next',
    observedDistTags: {},
    observedAt: null,
    installableVersion: null,
    installableDistTag: null,
  };
  const file = path.join(rootDir, 'docs', 'dist-tag-policy.md');
  if (!fs.existsSync(file)) return fallback;
  const markdown = fs.readFileSync(file, 'utf8');
  const match = /```json dist-tag-policy\n([\s\S]*?)\n```/u.exec(markdown);
  if (!match) return fallback;
  let policy;
  try {
    policy = JSON.parse(match[1]);
  } catch {
    return fallback;
  }
  // An unreadable/malformed policy fails closed into the unpublished fallback above, but an
  // authored legacy field is well-formed JSON describing a stale duplicate pin — that is an
  // actionable authoring mistake, not a read failure, so it throws instead of being swallowed.
  assertNoLegacyPolicyFields(policy);
  // Re-derives through the same shared function every other consumer uses (single derivation
  // path), rather than duplicating the currentVersion/prereleaseVersionPattern/registry-state
  // projection a second time in this module.
  return readPublicationState(rootDir);
}

function registrySpecChannel(spec) {
  const at = spec.lastIndexOf('@');
  if (at <= spec.indexOf('/')) return null;
  return spec.slice(at + 1).replace(/[),.;`]+$/g, '');
}

function collectRegistryCommandViolations(relative, lines, policy) {
  const violations = [];
  // A registry command is live exactly when `policy.registryHasLiveChannel` is true — the
  // registry resolves *something* under a persistent tag right now. True for
  // `prerelease-published`/`stable`, and also for `candidate-ahead-of-registry` (the tag still
  // resolves the registry's older complete line; the workspace's new candidate just isn't it yet).
  // `partial-publication`/`registry-inconsistent` never set it, so both correctly forbid every
  // command, matching the fully-unpublished state.
  const installableVersion = policy.installableVersion ?? null;
  const registryHasLiveInstall = policy.registryHasLiveChannel === true;
  const prerelease = isPrerelease(installableVersion ?? policy.currentVersion);
  const prereleaseTag = policy.prereleaseDistTag ?? 'next';

  lines.forEach((line, index) => {
    if (NEGATED_COMMAND_CONTEXT.test(line)) return;
    for (const { pattern } of REGISTRY_COMMANDS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const command = match[0];
        const spec = match[1];
        if (!registryHasLiveInstall) {
          violations.push(`${relative}:${index + 1}: public output contains unavailable registry command ${JSON.stringify(command)}.`);
          continue;
        }
        if (!prerelease) continue;
        const channel = registrySpecChannel(spec);
        // An exact-version pin is valid only against the version the registry actually resolves
        // right now, never the workspace's newer (not-yet-published) candidate version — pinning
        // that would be exactly the false "it's installable" claim this check exists to reject.
        if (channel !== prereleaseTag && channel !== installableVersion) {
          violations.push(
            `${relative}:${index + 1}: public RC command ${JSON.stringify(command)} must pin @${prereleaseTag} or @${installableVersion}; unqualified installs resolve the stable channel.`,
          );
        }
      }
    }
  });

  return violations;
}

const FALSE_REPOSITORY_CLAIMS = [/\brepository is private\b/iu, /\bsource (?:code )?is not public\b/iu, /\bprivate repository\b/iu];

export function collectRepositoryVisibilityViolations(rootDir = ROOT_DIR) {
  const violations = [];
  for (const relative of ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt', 'README.md']) {
    const absolute = path.join(rootDir, relative);
    if (!fs.existsSync(absolute)) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const pattern of FALSE_REPOSITORY_CLAIMS) {
      const match = pattern.exec(text);
      if (match) {
        violations.push(`${relative} states ${JSON.stringify(match[0])}. The repository is public; npm publication state is a separate claim.`);
      }
    }
  }
  return violations;
}

const VERSION_SENTENCES = [
  { file: 'docs/decisions/015-package-version-0-86-2.md', label: 'decision line', pattern: /The lockstep package version is \*\*`([^`]+)`\*\*/u, kind: 'stable' },
];

const RELEASE_STATUS_MARKER_PATTERN = /release-status:generated:start[\s\S]*?release-status:generated:end/gu;

// Public-truth rule: a hand-written sentence asserting *current* npm registry state ("is publicly
// published", "is public on npm") is forbidden outside a `release-status:generated` block or a
// fully machine-generated surface. Every such claim now has exactly one legitimate source: the
// shared renderer (scripts/release-status-lib.mjs), fed by docs/registry-observation.json —
// never a second hand-typed copy that can independently drift or collapse partial/inconsistent
// registry states into a bare "published" claim.
const FORBIDDEN_CURRENT_STATE_CLAIMS = [
  /\bis publicly published\b/iu,
  /\bis public on npm\b/iu,
  /\bpublicly published on npm\b/iu,
];

// Entire files that are machine-generated (regenerated by a `pnpm docs:*:generate`/`llms:generate`
// script and freshness-checked by its own `docs:*:check`) are exempt at the file level: any
// current-state sentence in them is rendered from the shared derivation, not hand-typed.
const FULLY_GENERATED_PREFIXES = [
  'apps/docs/src/content/docs/components/',
  'apps/docs/src/content/docs/patterns/',
  'apps/docs/src/content/docs/reference/',
];
const FULLY_GENERATED_EXACT = new Set(['docs/component-reference.md', GENERATED_RELEASE_PAGE, GENERATED_COMPATIBILITY_PAGE]);

export function collectHandWrittenCurrentStateClaimViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const files = PUBLIC_ROOTS.flatMap((relative) => {
    const target = path.join(rootDir, relative);
    return fs.existsSync(target) ? walkTextFiles(target) : [];
  });

  for (const file of files) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    if (FULLY_GENERATED_EXACT.has(relative) || FULLY_GENERATED_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
    const text = fs.readFileSync(file, 'utf8');
    const scrubbed = text.replace(RELEASE_STATUS_MARKER_PATTERN, '');
    for (const pattern of FORBIDDEN_CURRENT_STATE_CLAIMS) {
      const match = pattern.exec(scrubbed);
      if (match) {
        violations.push(
          `${relative}: hand-written current-state registry claim ${JSON.stringify(match[0])} outside a release-status:generated ` +
            'block. Render it from the shared renderer instead (a release-status:generated marker block via ' +
            '`pnpm release-status:generate`, or the Starlight releaseStatus component/frontmatter flag).',
        );
      }
    }
  }
  return violations;
}

export function collectPublicTruthViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const policy = extractPublicationPolicy(rootDir);
  const files = PUBLIC_ROOTS.flatMap((relative) => {
    const target = path.join(rootDir, relative);
    return fs.existsSync(target) ? walkTextFiles(target) : [];
  });

  for (const file of files) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    violations.push(...collectRegistryCommandViolations(relative, lines, policy));
    for (const pattern of FALSE_DIST_TAG_CAUSAL_CLAIMS) {
      const match = pattern.exec(text);
      if (match) {
        violations.push(
          `${relative}: unsupported npm dist-tag causal claim ${JSON.stringify(match[0])}; record the observed registry state and the verified publish command instead.`,
        );
      }
    }
  }

  const manifestPath = path.join(rootDir, 'package.json');
  let workspaceVersion;
  try {
    workspaceVersion = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version : undefined;
  } catch (error) {
    violations.push(`package.json: not parseable (${error.message}), so stated versions cannot be checked.`);
  }
  if (!workspaceVersion && !violations.some((v) => v.startsWith('package.json: not parseable'))) {
    violations.push('package.json: missing or has no version, so stated versions cannot be checked.');
  }

  if (workspaceVersion) {
    if (policy.currentVersion && policy.currentVersion !== workspaceVersion) {
      violations.push(
        `packages/ui/package.json: version ${policy.currentVersion} (the derived current version) must equal the root package.json version ${workspaceVersion}; run \`pnpm version:sync\`.`,
      );
    }
    const stableVersion = stableBase(workspaceVersion);
    // README's distribution-status line is now a `release-status:generated` block rendered by
    // the shared renderer (scripts/release-status-lib.mjs); `pnpm release-status:check` proves it
    // is byte-fresh against docs/registry-observation.json + the workspace version. Here it is
    // enough to prove the block exists and states the exact current-state sentence — a
    // stronger, state-agnostic replacement for the old two-pattern (published/unpublished) regex,
    // which could not represent the states release-status-lib.mjs added.
    const readme = path.join(rootDir, 'README.md');
    if (fs.existsSync(readme) && policy.releaseState) {
      const text = fs.readFileSync(readme, 'utf8');
      const block = text.match(RELEASE_STATUS_MARKER_PATTERN);
      const expected = renderStatusSentence(policy.releaseState);
      if (!block) {
        violations.push('README.md: is missing its release-status:generated marker block.');
      } else if (!block[0].includes(expected)) {
        violations.push('README.md: release-status:generated block does not state the current release status; run `pnpm release-status:generate`.');
      }
    }

    for (const { file, label, pattern, kind } of VERSION_SENTENCES) {
      const absolute = path.join(rootDir, file);
      if (!fs.existsSync(absolute)) continue;
      const stated = fs.readFileSync(absolute, 'utf8').match(pattern);
      if (!stated) continue;
      const expected = kind === 'stable' ? stableVersion : workspaceVersion;
      if (stated[1] !== expected) {
        violations.push(`${file}: ${label} states version ${stated[1]} but the ${kind === 'stable' ? 'stable base' : 'workspace version'} is ${expected}.`);
      }
    }
  }

  const demoPath = path.join(rootDir, 'apps/demo/README.md');
  if (fs.existsSync(demoPath)) {
    const demo = fs.readFileSync(demoPath, 'utf8');
    if (/\bnpm\s+run\s+build\b/.test(demo)) {
      violations.push('apps/demo/README.md: stale generic `npm run build` command; use the workspace build:web command.');
    }
    for (const required of [
      'pnpm --filter @beemvp/beeui-demo start',
      'pnpm --filter @beemvp/beeui-demo web',
      'pnpm --filter @beemvp/beeui-demo build:web',
    ]) {
      if (!demo.includes(required)) violations.push(`apps/demo/README.md: missing verified workspace command ${JSON.stringify(required)}.`);
    }
  }

  violations.push(...collectRepositoryVisibilityViolations(rootDir));
  violations.push(...collectHandWrittenCurrentStateClaimViolations(rootDir));
  return violations;
}

function main() {
  const violations = collectPublicTruthViolations();
  if (violations.length) {
    console.error('Public documentation truth check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log('Public documentation truth check passed (registry commands, release channel and version authorities are consistent).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
