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
//   node scripts/public-docs-a11y.mjs --check   # fail if any region is unreachable
//
// What `--check` proves, and what it does not. It uses the same pattern as the rewrite, so on
// output the rewrite produced it cannot disagree with it — that is a tautology, not evidence.
// Its real job is to catch a build that skipped the rewrite: `astro build` run directly, or a
// future change that drops the step from the pipeline. Whether the result is actually
// accessible is decided by an independent engine — the axe audit in
// `apps/visual-regression/tests/a11y-docs-portal.spec.ts`, which runs in `web-a11y`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR } from './component-docs-lib.mjs';

export const DOCS_DIST_DIR = 'apps/docs/dist';

// `tabindex="0"` is what satisfies the rule. The role and label are what make the resulting tab
// stop mean something when a screen reader announces it, rather than an unnamed region.
// `tabindex="0"` is the whole fix. An ARIA role is not required by the rule and is actively
// harmful on a table: a role overrides the native one, so `role="region"` on `<table>` erases
// `table`/`row`/`cell`/`columnheader` from the accessibility tree. Measured on
// /docs/components/table/ with CDP `Accessibility.getFullAXTree`:
//
//   with role="region":  table 0   rowgroup 0   row 0   cell 0   columnheader 0
//   with tabindex only:  table 8   rowgroup 8   row 31  cell 92  columnheader 32
//
// That is strictly worse than shipping nothing, for exactly the readers this step is for — and
// axe's WCAG rules do not report it, so the audit that motivated this could not see it.
//
// `<pre>` takes `role="group"` with a label so the new tab stop is announced as something. It is
// not a landmark: 581 `region` landmarks across 138 pages produced 366 `landmark-unique`
// violations, which axe reports as best-practice rather than WCAG — invisible to this audit too.
const SCROLLABLE_TAGS = [
  { attributes: ' tabindex="0" role="group" aria-label="Code block"', tag: 'pre' },
  { attributes: ' tabindex="0"', tag: 'table' },
];

export function addKeyboardScrollToScrollableRegions(html) {
  return SCROLLABLE_TAGS.reduce((current, { attributes, tag }) => {
    const pattern = new RegExp(`<${tag}(?=[\\s>])(?![^>]*\\btabindex=)([^>]*)>`, 'gu');
    return current.replace(pattern, (_match, existing) => `<${tag}${existing}${attributes}>`);
  }, html);
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

// The whole CLI decision as data, so a test can drive it. Every path through `main` was
// untested: `const isCli = false` turned both the rewrite and its guard into no-ops while
// `docs:build` still exited 0 and the portal shipped 581 unreachable regions.
export function runDocsA11y({ check = false, rootDir = ROOT_DIR } = {}) {
  if (!fs.existsSync(path.join(rootDir, DOCS_DIST_DIR))) {
    return { exitCode: 1, messages: [`${DOCS_DIST_DIR} does not exist. Run the docs build first.`] };
  }

  if (check) {
    const violations = collectUnreachableCodeBlocks(rootDir);
    if (!violations.length) {
      return { exitCode: 0, messages: ['Docs keyboard-scroll check passed (every code block and table is reachable).'] };
    }
    const shown = violations.slice(0, 10);
    const extra = violations.length > 10 ? [`- …and ${violations.length - 10} more page(s).`] : [];
    return {
      exitCode: 1,
      messages: [
        'Documentation portal has scrollable regions no keyboard user can scroll:',
        ...shown.map((violation) => `- ${violation}`),
        ...extra,
      ],
    };
  }

  const { blocks, rewritten } = makeDocsCodeBlocksFocusable(rootDir);
  return {
    exitCode: 0,
    messages: [`Made ${blocks} scrollable region(s) keyboard-reachable across ${rewritten} page(s).`],
    rewrote: blocks,
  };
}

function main() {
  const result = runDocsA11y({ check: process.argv.includes('--check') });
  for (const message of result.messages) (result.exitCode === 0 ? console.log : console.error)(message);
  process.exitCode = result.exitCode;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
