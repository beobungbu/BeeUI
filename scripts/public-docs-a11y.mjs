#!/usr/bin/env node

// Makes every scrollable code block in the built documentation portal reachable by keyboard.
//
// A `<pre>` that scrolls horizontally and contains nothing focusable cannot be scrolled by a
// keyboard-only reader — axe rule `scrollable-region-focusable`, impact "serious". The portal
// shipped 367 of them across 125 of its 151 pages, and the WBS-H072 audit failed on three of
// the eight pages it samples.
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
const FOCUSABLE_PRE = ' tabindex="0" role="region" aria-label="Code block"';

export function addKeyboardScrollToPreElements(html) {
  return html.replace(/<pre(?=[\s>])(?![^>]*\btabindex=)([^>]*)>/gu, (_match, attributes) => `<pre${attributes}${FOCUSABLE_PRE}>`);
}

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
    const unreachable = [...html.matchAll(/<pre(?=[\s>])(?![^>]*\btabindex=)[^>]*>/gu)];
    if (unreachable.length) {
      violations.push(
        `${path.relative(rootDir, file)} has ${unreachable.length} code block(s) a keyboard user cannot scroll.`,
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
    const next = addKeyboardScrollToPreElements(html);
    if (next === html) continue;
    blocks += [...html.matchAll(/<pre(?=[\s>])(?![^>]*\btabindex=)[^>]*>/gu)].length;
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
      console.error('Documentation portal has code blocks no keyboard user can scroll:');
      for (const violation of violations.slice(0, 10)) console.error(`- ${violation}`);
      if (violations.length > 10) console.error(`- …and ${violations.length - 10} more page(s).`);
      process.exitCode = 1;
      return;
    }
    console.log('Docs keyboard-scroll check passed (every code block is reachable).');
    return;
  }

  const { blocks, rewritten } = makeDocsCodeBlocksFocusable(ROOT_DIR);
  console.log(`Made ${blocks} code block(s) keyboard-reachable across ${rewritten} page(s).`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
