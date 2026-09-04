#!/usr/bin/env node

// Fails when a committed page under apps/docs/src/content/docs/{components,patterns} differs
// from what its generator produces today.
//
// The generators' own --check modes validate their input contract — that every family has an
// owner, prose, a resolvable fixture. None of them compares the committed markdown to fresh
// output, and `apps/docs`'s prebuild regenerates before every build, so the deployed site is
// always correct while the committed pages can drift silently. That matters here because the
// component pages now cite exact fixture line ranges: a fixture edit shifts every citation on
// every page that quotes it, and nothing else in CI would notice.
//
//   node scripts/check-portal-pages-fresh.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR } from './component-docs-lib.mjs';
import { enhanceGeneratedPublicComponentPages } from './public-component-previews.mjs';
import { generatePublicComponentPages, PUBLIC_COMPONENT_DIR } from './public-component-reference.mjs';
import { generatePublicPatternPages, PUBLIC_PATTERN_DIR } from './public-pattern-reference.mjs';

function pagesUnder(absDir) {
  if (!fs.existsSync(absDir)) return new Map();
  const files = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith('.md')) files.set(path.relative(absDir, next), fs.readFileSync(next, 'utf8'));
    }
  };
  walk(absDir);
  return files;
}

function compare(label, committed, fresh) {
  const violations = [];
  for (const [name, content] of fresh) {
    if (!committed.has(name)) violations.push(`${label}: ${name} is generated but not committed.`);
    else if (committed.get(name) !== content) violations.push(`${label}: ${name} is stale.`);
  }
  for (const name of committed.keys()) {
    if (!fresh.has(name)) violations.push(`${label}: ${name} is committed but no longer generated.`);
  }
  return violations;
}

export function collectStalePortalPages(rootDir = ROOT_DIR) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-portal-fresh-'));
  try {
    const componentsOut = path.join(scratch, 'components');
    generatePublicComponentPages({ rootDir, outDir: componentsOut });
    enhanceGeneratedPublicComponentPages({ rootDir, outDir: componentsOut });

    const patternsOut = path.join(scratch, 'patterns');
    generatePublicPatternPages({ rootDir, outDir: patternsOut });

    return [
      ...compare(PUBLIC_COMPONENT_DIR, pagesUnder(path.join(rootDir, PUBLIC_COMPONENT_DIR)), pagesUnder(componentsOut)),
      ...compare(PUBLIC_PATTERN_DIR, pagesUnder(path.join(rootDir, PUBLIC_PATTERN_DIR)), pagesUnder(patternsOut)),
    ];
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function main() {
  const violations = collectStalePortalPages(ROOT_DIR);
  if (violations.length) {
    console.error('Portal pages are stale. Run `pnpm docs:portal-pages:generate`.');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log('Portal page freshness check passed (component and pattern pages match their generators).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
