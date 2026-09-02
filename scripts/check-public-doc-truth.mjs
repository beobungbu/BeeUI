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
  /\bnpm\s+(?:install|i)\s+@beemvp\/beeui-/g,
  /\bpnpm\s+add\s+@beemvp\/beeui-/g,
  /\byarn\s+add\s+@beemvp\/beeui-/g,
  /\bbun\s+add\s+@beemvp\/beeui-/g,
  /\bnpx\s+@beemvp\/beeui-cli\b/g,
  /\bpnpm\s+dlx\s+@beemvp\/beeui-cli\b/g,
];

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

export function collectPublicTruthViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const files = PUBLIC_ROOTS.flatMap((relative) => walkTextFiles(path.join(rootDir, relative)));

  for (const file of files) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    const text = fs.readFileSync(file, 'utf8');

    for (const pattern of FORBIDDEN_PUBLIC_DISTRIBUTION) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        violations.push(`${relative}: public output contains unavailable registry command ${JSON.stringify(match[0])}.`);
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
