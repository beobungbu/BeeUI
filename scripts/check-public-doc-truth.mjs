#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PUBLIC_ROOTS = ['README.md', 'apps/demo/README.md', 'apps/docs/src/content/docs'];
const NEGATED_COMMAND_CONTEXT = /\b(?:do not|don't|not available|unavailable|unpublished|not published|must not|never)\b/i;

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
  const file = path.join(rootDir, 'docs', 'dist-tag-policy.md');
  if (!fs.existsSync(file)) return { published: false, currentVersion: undefined, prereleaseDistTag: 'next' };
  const markdown = fs.readFileSync(file, 'utf8');
  const match = /```json dist-tag-policy\n([\s\S]*?)\n```/u.exec(markdown);
  if (!match) return { published: false, currentVersion: undefined, prereleaseDistTag: 'next' };
  try {
    return JSON.parse(match[1]);
  } catch {
    return { published: false, currentVersion: undefined, prereleaseDistTag: 'next' };
  }
}

function registrySpecChannel(spec) {
  const at = spec.lastIndexOf('@');
  if (at <= spec.indexOf('/')) return null;
  return spec.slice(at + 1).replace(/[),.;`]+$/g, '');
}

function collectRegistryCommandViolations(relative, lines, policy) {
  const violations = [];
  const published = policy.published === true;
  const currentVersion = policy.currentVersion;
  const prerelease = isPrerelease(currentVersion);
  const prereleaseTag = policy.prereleaseDistTag ?? 'next';

  lines.forEach((line, index) => {
    if (NEGATED_COMMAND_CONTEXT.test(line)) return;
    for (const { pattern } of REGISTRY_COMMANDS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const command = match[0];
        const spec = match[1];
        if (!published) {
          violations.push(`${relative}:${index + 1}: public output contains unavailable registry command ${JSON.stringify(command)}.`);
          continue;
        }
        if (!prerelease) continue;
        const channel = registrySpecChannel(spec);
        if (channel !== prereleaseTag && channel !== currentVersion) {
          violations.push(
            `${relative}:${index + 1}: public RC command ${JSON.stringify(command)} must pin @${prereleaseTag} or @${currentVersion}; unqualified installs resolve the stable channel.`,
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
  { file: 'README.md', label: 'distribution-status line', pattern: /BeeUI `([^`]+)` is publicly published/u, requiredWhenPublished: true, kind: 'current' },
  { file: 'README.md', label: 'distribution-status line', pattern: /repository\/package version is `([^`]+)`/u, requiredWhenPublished: false, kind: 'current', legacy: true },
  { file: 'docs/consumer-compatibility-report.md', label: 'candidate sentence', pattern: /candidate version `([^`]+)` today/u, kind: 'current' },
  { file: 'docs/decisions/015-package-version-0-86-2.md', label: 'decision line', pattern: /The lockstep package version is \*\*`([^`]+)`\*\*/u, kind: 'stable' },
];

export function collectPublicTruthViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const policy = extractPublicationPolicy(rootDir);
  const files = PUBLIC_ROOTS.flatMap((relative) => {
    const target = path.join(rootDir, relative);
    return fs.existsSync(target) ? walkTextFiles(target) : [];
  });

  for (const file of files) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    violations.push(...collectRegistryCommandViolations(relative, lines, policy));
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
      violations.push(`docs/dist-tag-policy.md: currentVersion ${policy.currentVersion} must equal workspace version ${workspaceVersion}.`);
    }
    const stableVersion = stableBase(workspaceVersion);
    const readme = path.join(rootDir, 'README.md');
    if (fs.existsSync(readme)) {
      const text = fs.readFileSync(readme, 'utf8');
      const currentPattern = policy.published === true ? VERSION_SENTENCES[0].pattern : VERSION_SENTENCES[1].pattern;
      const stated = text.match(currentPattern);
      if (!stated) {
        violations.push('README.md: no longer carries its distribution-status line, so the version it states cannot be checked.');
      } else if (stated[1] !== workspaceVersion) {
        violations.push(`README.md: distribution-status line states version ${stated[1]} but the workspace version is ${workspaceVersion}.`);
      }
    }

    for (const { file, label, pattern, kind } of VERSION_SENTENCES.slice(2)) {
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
