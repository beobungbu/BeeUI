#!/usr/bin/env node

// Makes every scrollable code block in the built documentation portal reachable by keyboard.
//
// A `<pre>` or `<table>` that scrolls horizontally and contains nothing focusable cannot be
// scrolled by a keyboard-only reader — axe rule `scrollable-region-focusable`, impact "serious".
// The portal shipped 367 unreachable code blocks across 125 of its 151 pages.
//
// Tables were found second, and only because the audit also ran at 390px: the generated props
// and reference tables fit on a desktop viewport and overflow on a phone, so a desktop-only
// audit reported them clean. axe names the `<table>` itself as the scrolling element, so the
// tab stop belongs on it rather than on a wrapper this step would have to invent.
//
// This runs on the built output rather than in the Astro pipeline because Starlight renders
// code blocks through Expressive Code, which owns its own `<pre>` and does not receive plugins
// passed through Starlight's `expressiveCode` option (verified: the `postprocessRenderedBlock`
// hook never fires). Post-processing the emitted HTML is how `build-public-*.mjs` already
// composes this site, and unlike a client-side script it works with JavaScript disabled — which
// matters for a portal whose Showcase and Demo shells exist precisely for that case.
//
//   node scripts/public-docs-a11y.mjs           # rewrite dist in place
//   node scripts/public-docs-a11y.mjs --check   # fail if any <pre> is unreachable

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR } from './component-docs-lib.mjs';

export const DOCS_DIST_DIR = 'apps/docs/dist';

// `tabindex="0"` is what satisfies the rule. The role and label are what make the resulting tab
// stop mean something when a screen reader announces it, rather than an unnamed region.
const SCROLLABLE_TAGS = [
  { tag: 'pre', label: 'Code block' },
  { tag: 'table', label: 'Table' },
];

export function addKeyboardScrollToScrollableRegions(html) {
  return SCROLLABLE_TAGS.reduce((current, { tag, label }) => {
    const pattern = new RegExp(`<${tag}(?=[\\s>])(?![^>]*\\btabindex=)([^>]*)>`, 'gu');
    return current.replace(
      pattern,
      (_match, attributes) => `<${tag}${attributes} tabindex="0" role="region" aria-label="${label}">`,
    );
  }, html);
}

// Kept as the previous name so nothing that imported it breaks; the behavior is now both tags.
export const addKeyboardScrollToPreElements = addKeyboardScrollToScrollableRegions;

function htmlFiles(absDir) {
  if (!fs.existsSync(absDir)) return [];
  return fs.readdirSync(absDir, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absDir, entry.name);
    if (entry.isDirectory()) return htmlFiles(next);
    return entry.name.endsWith('.html') ? [next] : [];
  });
}

export function collectUnreachableCodeBlocks(rootDir = ROOT_DIR) {
  const violations = [];
  for (const file of htmlFiles(path.join(rootDir, DOCS_DIST_DIR))) {
    const html = fs.readFileSync(file, 'utf8');
    const unreachable = SCROLLABLE_TAGS.flatMap(({ tag }) =>
      [...html.matchAll(new RegExp(`<${tag}(?=[\\s>])(?![^>]*\\btabindex=)[^>]*>`, 'gu'))]);
    if (unreachable.length) {
      violations.push(
        `${path.relative(rootDir, file)} has ${unreachable.length} scrollable region(s) a keyboard user cannot scroll.`,
      );
    }
  }
  return violations;
}

export function makeDocsCodeBlocksFocusable(rootDir = ROOT_DIR) {
  let rewritten = 0;
  let blocks = 0;
  for (const file of htmlFiles(path.join(rootDir, DOCS_DIST_DIR))) {
    const html = fs.readFileSync(file, 'utf8');
    const next = addKeyboardScrollToScrollableRegions(html);
    if (next === html) continue;
    blocks += SCROLLABLE_TAGS.reduce(
      (total, { tag }) => total + [...html.matchAll(new RegExp(`<${tag}(?=[\\s>])(?![^>]*\\btabindex=)[^>]*>`, 'gu'))].length,
      0,
    );
    fs.writeFileSync(file, next);
    rewritten += 1;
  }
  return { blocks, rewritten };
}

function main() {
  const distDir = path.join(ROOT_DIR, DOCS_DIST_DIR);
  if (!fs.existsSync(distDir)) {
    console.error(`${DOCS_DIST_DIR} does not exist. Run the docs build first.`);
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes('--check')) {
    const violations = collectUnreachableCodeBlocks(ROOT_DIR);
    if (violations.length) {
      console.error('Documentation portal has scrollable regions no keyboard user can scroll:');
      for (const violation of violations.slice(0, 10)) console.error(`- ${violation}`);
      if (violations.length > 10) console.error(`- …and ${violations.length - 10} more page(s).`);
      process.exitCode = 1;
      return;
    }
    console.log('Docs keyboard-scroll check passed (every code block and table is reachable).');
    return;
  }

  const { blocks, rewritten } = makeDocsCodeBlocksFocusable(ROOT_DIR);
  console.log(`Made ${blocks} scrollable region(s) keyboard-reachable across ${rewritten} page(s).`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
