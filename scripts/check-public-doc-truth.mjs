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

// The repository's own visibility is a checkable fact, and all four llms artifacts asserted the
// opposite of it — telling every AI agent that consumes them that the source is private when
// `gh api repos/beobungbu/BeeUI` reports `"private": false`. `llms:check` regenerates and diffs,
// so it reproduced the sentence rather than catching it. Publication state is owner-gated and
// genuinely unpublished; repository visibility is not the same claim and must not ride along.
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
  console.log('Public documentation truth check passed (publication commands and demo workspace commands are consistent).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
