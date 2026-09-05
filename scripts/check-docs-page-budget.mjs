#!/usr/bin/env node

// Page-weight budget for the documentation portal (#474 WBS-H073).
//
// H073 asked for template budgets. Page weight was measured and nothing enforced it, so a page
// could grow without anyone noticing — which is exactly what happened before: 51 component pages
// carried the same 1083-line file and no check said a word.
//
// The ceilings are the measured maximum plus headroom, recorded here so they are arguable rather
// than asserted. They exist to catch growth, not to be tight:
//
//   gzipped HTML   measured max 22 KB (guides/troubleshooting)  ->  ceiling 32 KB
//   raw HTML       measured max 163 KB (components/table)       ->  ceiling 220 KB
//   shared assets  measured total 175 KB                        ->  ceiling 260 KB
//
// Transferred bytes are the ones a reader pays for, so the gzipped figure is the primary limit;
// Cloudflare compresses on the way out. The raw ceiling is a secondary signal that catches
// content duplication that compresses well — the 1083-line dumps compressed beautifully.
//
//   node scripts/check-docs-page-budget.mjs           # report
//   node scripts/check-docs-page-budget.mjs --check   # fail if any ceiling is exceeded
//
// ENFORCEMENT: this runs from `apps/docs`'s build script, because it needs apps/docs/dist.
// On CI that build happens inside `web-a11y`'s Playwright webServer, so this check fails the
// job when it fails — but only when the visual lane is selected. `scripts/ci-scope.mjs` selects
// that lane for the whole `apps/docs/` tree and for this script, so a change that could break
// this check also starts the job that runs it.

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR } from './component-docs-lib.mjs';

export const DOCS_DIST_DIR = 'apps/docs/dist';

export const PAGE_BUDGET = {
  gzippedHtmlBytes: 32 * 1024,
  rawHtmlBytes: 220 * 1024,
  sharedAssetBytes: 260 * 1024,
};

function pageFiles(absDir) {
  if (!fs.existsSync(absDir)) return [];
  return fs.readdirSync(absDir, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absDir, entry.name);
    if (entry.isDirectory()) return pageFiles(next);
    return entry.name.endsWith('.html') ? [next] : [];
  });
}

export function measureDocsPages(rootDir = ROOT_DIR) {
  const distDir = path.join(rootDir, DOCS_DIST_DIR);
  const pages = pageFiles(distDir).map((file) => {
    const raw = fs.readFileSync(file);
    return {
      gzipped: gzipSync(raw, { level: 6 }).length,
      path: path.relative(distDir, file),
      raw: raw.length,
    };
  });

  const assetDir = path.join(distDir, '_astro');
  const sharedAssets = fs.existsSync(assetDir)
    ? fs.readdirSync(assetDir).reduce((total, name) => total + fs.statSync(path.join(assetDir, name)).size, 0)
    : 0;

  return { pages, sharedAssets };
}

export function collectPageBudgetViolations(rootDir = ROOT_DIR) {
  const { pages, sharedAssets } = measureDocsPages(rootDir);
  if (!pages.length) return [`${DOCS_DIST_DIR} has no built pages. Run the docs build first.`];

  const violations = [];
  for (const page of pages) {
    if (page.gzipped > PAGE_BUDGET.gzippedHtmlBytes) {
      violations.push(
        `${page.path} is ${(page.gzipped / 1024).toFixed(1)} KB gzipped, over the ` +
        `${PAGE_BUDGET.gzippedHtmlBytes / 1024} KB per-page budget.`,
      );
    }
    if (page.raw > PAGE_BUDGET.rawHtmlBytes) {
      violations.push(
        `${page.path} is ${(page.raw / 1024).toFixed(0)} KB uncompressed, over the ` +
        `${PAGE_BUDGET.rawHtmlBytes / 1024} KB budget. Large-but-compressible usually means duplication.`,
      );
    }
  }
  if (sharedAssets > PAGE_BUDGET.sharedAssetBytes) {
    violations.push(
      `shared assets under _astro/ total ${(sharedAssets / 1024).toFixed(0)} KB, over the ` +
      `${PAGE_BUDGET.sharedAssetBytes / 1024} KB budget. Every page pays this.`,
    );
  }
  return violations;
}

function main() {
  const violations = collectPageBudgetViolations(ROOT_DIR);
  const { pages, sharedAssets } = measureDocsPages(ROOT_DIR);

  if (process.argv.includes('--check')) {
    if (violations.length) {
      console.error('Documentation portal page budget exceeded:');
      for (const violation of violations) console.error(`- ${violation}`);
      process.exitCode = 1;
      return;
    }
    const worst = pages.reduce((a, b) => (b.gzipped > a.gzipped ? b : a));
    console.log(
      `Page budget check passed (${pages.length} pages; largest ${(worst.gzipped / 1024).toFixed(1)} KB gzipped, ` +
      `budget ${PAGE_BUDGET.gzippedHtmlBytes / 1024} KB; shared assets ${(sharedAssets / 1024).toFixed(0)} KB).`,
    );
    return;
  }

  const sorted = [...pages].sort((a, b) => b.gzipped - a.gzipped);
  const totalGz = pages.reduce((sum, page) => sum + page.gzipped, 0);
  console.log(`${pages.length} pages, ${(totalGz / 1024 / 1024).toFixed(2)} MB gzipped total, shared assets ${(sharedAssets / 1024).toFixed(0)} KB`);
  for (const page of sorted.slice(0, 8)) {
    console.log(`  ${(page.gzipped / 1024).toFixed(1).padStart(6)} KB gz  ${(page.raw / 1024).toFixed(0).padStart(5)} KB raw  ${page.path}`);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
