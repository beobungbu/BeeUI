#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PUBLIC_ROOTS = [
  'README.md',
  'apps/demo/README.md',
  'apps/docs/src/content/docs',
];

const FORBIDDEN_PUBLIC_DISTRIBUTION = [
  /\bnpm\s+(?:install|i)\s+@beemvp\/beeui-[a-z0-9-]+/i,
  /\bpnpm\s+add\s+@beemvp\/beeui-[a-z0-9-]+/i,
  /\byarn\s+add\s+@beemvp\/beeui-[a-z0-9-]+/i,
  /\bbun\s+add\s+@beemvp\/beeui-[a-z0-9-]+/i,
  /\bnpx\s+@beemvp\/beeui-cli\b/i,
  /\bpnpm\s+dlx\s+@beemvp\/beeui-cli\b/i,
];

const NEGATED_COMMAND_CONTEXT = /\b(?:do not|don't|not available|unavailable|unpublished|not published|must not|never)\b/i;

function walkTextFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => {
      const next = path.join(target, entry.name);
      if (entry.isDirectory()) return walkTextFiles(next);
      return /\.(?:md|mdx|astro|ts|tsx|json|txt)$/.test(entry.name) ? [next] : [];
    });
}

function availableCommandOnLine(line, pattern) {
  const match = pattern.exec(line);
  if (!match) return null;
  if (NEGATED_COMMAND_CONTEXT.test(line)) return null;
  return match[0];
}

const FALSE_REPOSITORY_CLAIMS = [
  /\brepository is private\b/iu,
  /\bsource (?:code )?is not public\b/iu,
  /\bprivate repository\b/iu,
];

export function collectRepositoryVisibilityViolations(rootDir = ROOT_DIR) {
  const violations = [];
  for (const relative of ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt', 'README.md']) {
    const absolute = path.join(rootDir, relative);
    if (!fs.existsSync(absolute)) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const pattern of FALSE_REPOSITORY_CLAIMS) {
      const match = pattern.exec(text);
      if (match) {
        violations.push(
          `${relative} states ${JSON.stringify(match[0])}. The repository is public; publication of the ` +
          'npm packages is the owner-gated claim, and the two must not be conflated.',
        );
      }
    }
  }
  return violations;
}

function stableBase(version) {
  return typeof version === 'string' ? version.replace(/-rc\.(0|[1-9][0-9]*)$/, '') : version;
}

// Version prose has two different truths during an RC:
// - current identity: the exact candidate in the manifests (for example 0.86.2-rc.1);
// - stable line: the ADR-selected version that candidate will become (0.86.2).
// Treating every sentence as current identity made a valid prerelease impossible without rewriting
// ADR-015 and stable-release policy into false statements. Each sentence declares which truth it owns.
const VERSION_SENTENCES = [
  { file: 'README.md', label: 'distribution-status line', pattern: /repository\/package version is `([^`]+)`/u, required: true, kind: 'current' },
  { file: 'docs/release.md', label: 'milestone sentence', pattern: /ships as package version `([^`]+)`/u, kind: 'stable' },
  { file: 'docs/release.md', label: 'versioning policy', pattern: /the package version is plain SemVer `([^`]+)`/u, kind: 'stable' },
  { file: 'docs/dist-tag-policy.md', label: 'stable-release sentence', pattern: /The stable `([^`]+)` is published, verified/u, kind: 'stable' },
  { file: 'docs/dist-tag-policy.md', label: 'owner-decision blockquote', pattern: /plain SemVer starting at `([^`]+)`/u, kind: 'stable' },
  { file: 'docs/consumer-compatibility-report.md', label: 'candidate sentence', pattern: /candidate version `([^`]+)` today/u, kind: 'current' },
  { file: 'docs/decisions/015-package-version-0-86-2.md', label: 'decision line', pattern: /The lockstep package version is \*\*`([^`]+)`\*\*/u, kind: 'stable' },
];

export function collectPublicTruthViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const files = PUBLIC_ROOTS.flatMap((relative) => walkTextFiles(path.join(rootDir, relative)));

  for (const file of files) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of FORBIDDEN_PUBLIC_DISTRIBUTION) {
        const command = availableCommandOnLine(line, pattern);
        if (command) {
          violations.push(`${relative}:${index + 1}: public output contains unavailable registry command ${JSON.stringify(command)}.`);
        }
      }
    });
  }

  const manifestPath = path.join(rootDir, 'package.json');
  let workspaceVersion;
  try {
    workspaceVersion = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version : undefined;
  } catch (error) {
    violations.push(`package.json: not parseable (${error.message}), so stated versions cannot be checked.`);
  }
  if (workspaceVersion === undefined && !violations.some((v) => v.startsWith('package.json: not parseable'))) {
    violations.push('package.json: missing or has no version, so stated versions cannot be checked.');
  }
  if (workspaceVersion) {
    const stableVersion = stableBase(workspaceVersion);
    for (const { file, label, pattern, required, kind } of VERSION_SENTENCES) {
      const absolute = path.join(rootDir, file);
      if (!fs.existsSync(absolute)) {
        if (required) violations.push(`${file}: missing, so its ${label} cannot be checked.`);
        continue;
      }
      const text = fs.readFileSync(absolute, 'utf8');
      const stated = text.match(pattern);
      if (!stated) {
        if (required) violations.push(`${file}: no longer carries its ${label}, so the version it states cannot be checked.`);
        continue;
      }
      const expected = kind === 'stable' ? stableVersion : workspaceVersion;
      if (stated[1] !== expected) {
        const authority = kind === 'stable' ? 'stable base' : 'workspace version';
        violations.push(`${file}: ${label} states version ${stated[1]} but the ${authority} is ${expected}.`);
      }
    }
  }

  const demoPath = path.join(rootDir, 'apps/demo/README.md');
  const demo = fs.readFileSync(demoPath, 'utf8');
  if (/\bnpm\s+run\s+build\b/.test(demo)) {
    violations.push('apps/demo/README.md: stale generic `npm run build` command; use the workspace build:web command.');
  }
  for (const required of [
    'pnpm --filter @beemvp/beeui-demo start',
    'pnpm --filter @beemvp/beeui-demo web',
    'pnpm --filter @beemvp/beeui-demo build:web',
  ]) {
    if (!demo.includes(required)) {
      violations.push(`apps/demo/README.md: missing verified workspace command ${JSON.stringify(required)}.`);
    }
  }

  violations.push(...collectRepositoryVisibilityViolations(rootDir));

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
  console.log('Public documentation truth check passed (publication commands and version authorities are consistent).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
