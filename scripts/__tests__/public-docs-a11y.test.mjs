import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  addKeyboardScrollToScrollableRegions,
  collectUnreachableCodeBlocks,
  DOCS_DIST_DIR,
  makeDocsCodeBlocksFocusable,
  runDocsA11y,
} from '../public-docs-a11y.mjs';

// A `<pre>` that scrolls horizontally with nothing focusable inside cannot be scrolled by a
// keyboard-only reader. The portal shipped 367 of them across 125 of its 151 pages.

test('a code block gains a keyboard stop with a name', () => {
  const out = addKeyboardScrollToScrollableRegions('<pre data-language="tsx"><code>x</code></pre>');
  // `group`, not `region`: a region is a landmark, and 581 identically named landmarks produced
  // 366 `landmark-unique` violations across 88 pages.
  assert.match(out, /<pre data-language="tsx" tabindex="0" role="group" aria-label="Code block">/u);
});

test('existing attributes are preserved', () => {
  const out = addKeyboardScrollToScrollableRegions('<pre class="a" data-x="1"></pre>');
  assert.match(out, /class="a" data-x="1" tabindex="0"/u);
});

// Running the step twice must not stack duplicate attributes onto the same element.
test('a code block that is already reachable is left alone', () => {
  const once = addKeyboardScrollToScrollableRegions('<pre data-language="tsx"></pre>');
  assert.equal(addKeyboardScrollToScrollableRegions(once), once);
  assert.equal((once.match(/tabindex/gu) ?? []).length, 1);
});

test('every code block on a page is covered, not just the first', () => {
  const out = addKeyboardScrollToScrollableRegions('<pre a></pre><p>x</p><pre b></pre><pre c></pre>');
  assert.equal((out.match(/tabindex="0"/gu) ?? []).length, 3);
});

// The rule is about the scrolling element; nothing else gets a tab stop it did not ask for.
test('other elements are untouched', () => {
  const html = '<precise></precise><code></code><div class="pre"></div><tablet></tablet>';
  assert.equal(addKeyboardScrollToScrollableRegions(html), html);
});

// Found only because the audit also runs at 390px: the generated props and reference tables fit
// on a desktop viewport and overflow on a phone, so a desktop-only audit called them clean.
// An ARIA role overrides the native one, so any role here erases table/row/cell/columnheader
// from the accessibility tree. Measured with CDP on /docs/components/table/: 8/8/31/92/32 with
// tabindex alone, 0/0/0/0/0 with role="region".
test('a table is made reachable without losing its table semantics', () => {
  const out = addKeyboardScrollToScrollableRegions('<table><thead></thead></table>');
  assert.match(out, /<table tabindex="0">/u);
  assert.equal(/role=/u.test(out), false, 'a table must never be given an ARIA role');
  assert.equal(/aria-label=/u.test(out), false, 'a table names itself through its caption/headers');
});

test('code blocks and tables on one page are both covered', () => {
  const out = addKeyboardScrollToScrollableRegions('<pre a></pre><table></table><pre b></pre>');
  assert.equal((out.match(/tabindex="0"/gu) ?? []).length, 3);
  assert.equal((out.match(/aria-label="Code block"/gu) ?? []).length, 2);
  assert.equal((out.match(/aria-label="Table"/gu) ?? []).length, 0);
});

// --- the parts that touch the filesystem -------------------------------------------------
// Only the pure regex helper had coverage, so `collectUnreachableCodeBlocks` could `return []`
// and `makeDocsCodeBlocksFocusable` could do nothing, both with a green suite — a guard that
// always passes, which is the defect this whole program keeps finding.

function distFixture(pages) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-docs-a11y-'));
  for (const [relative, html] of Object.entries(pages)) {
    const file = path.join(rootDir, DOCS_DIST_DIR, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
  return rootDir;
}

function withFixture(pages, assertions) {
  const rootDir = distFixture(pages);
  try {
    assertions(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('unreachable regions are reported per page, at any directory depth', () => {
  withFixture({
    'index.html': '<pre a></pre>',
    'components/table/index.html': '<table></table><pre b></pre>',
    'guides/index.html': '<p>nothing scrollable</p>',
  }, (rootDir) => {
    const violations = collectUnreachableCodeBlocks(rootDir);
    assert.equal(violations.length, 2, violations.join(' | '));
    assert.ok(violations.some((v) => /index\.html has 1 scrollable region/u.test(v)));
    assert.ok(violations.some((v) => /components\/table\/index\.html has 2 scrollable region/u.test(v)));
  });
});

test('a page whose regions are already reachable reports nothing', () => {
  withFixture({ 'index.html': '<pre tabindex="0"></pre><table tabindex="0"></table>' }, (rootDir) => {
    assert.deepEqual(collectUnreachableCodeBlocks(rootDir), []);
  });
});

test('rewriting makes a real dist tree pass its own check', () => {
  withFixture({
    'index.html': '<pre a></pre>',
    'components/table/index.html': '<table></table>',
  }, (rootDir) => {
    assert.equal(collectUnreachableCodeBlocks(rootDir).length, 2);
    const { blocks, rewritten } = makeDocsCodeBlocksFocusable(rootDir);
    assert.equal(blocks, 2);
    assert.equal(rewritten, 2);
    assert.deepEqual(collectUnreachableCodeBlocks(rootDir), []);
    // The table must keep its native semantics: a role would erase table/row/cell from the
    // accessibility tree, which is worse than shipping nothing.
    const table = fs.readFileSync(path.join(rootDir, DOCS_DIST_DIR, 'components/table/index.html'), 'utf8');
    assert.match(table, /<table tabindex="0">/u);
    assert.equal(/role=/u.test(table), false, 'a table must not be given an ARIA role');
  });
});

test('rewriting twice changes nothing the second time', () => {
  withFixture({ 'index.html': '<pre a></pre><table></table>' }, (rootDir) => {
    makeDocsCodeBlocksFocusable(rootDir);
    const after = fs.readFileSync(path.join(rootDir, DOCS_DIST_DIR, 'index.html'), 'utf8');
    assert.deepEqual(makeDocsCodeBlocksFocusable(rootDir), { blocks: 0, rewritten: 0 });
    assert.equal(fs.readFileSync(path.join(rootDir, DOCS_DIST_DIR, 'index.html'), 'utf8'), after);
  });
});

// A dist with no HTML, or none at all, must not read as "everything is reachable".
test('an empty or missing dist is not silently clean', () => {
  withFixture({}, (rootDir) => {
    assert.deepEqual(collectUnreachableCodeBlocks(rootDir), []);
    assert.deepEqual(makeDocsCodeBlocksFocusable(rootDir), { blocks: 0, rewritten: 0 });
  });
});

// --- the CLI decision -----------------------------------------------------------------------
// `main()` had no test, so `const isCli = false` disabled both the rewrite and its guard while
// `docs:build` exited 0 and the portal shipped 581 unreachable regions.

test('the rewrite path reports what it changed and succeeds', () => {
  withFixture({ 'index.html': '<pre a></pre><table></table>' }, (rootDir) => {
    const result = runDocsA11y({ rootDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.rewrote, 2);
    assert.deepEqual(collectUnreachableCodeBlocks(rootDir), []);
  });
});

test('the check path fails, and names the pages, when a build skipped the rewrite', () => {
  withFixture({ 'index.html': '<pre a></pre>', 'guides/index.html': '<table></table>' }, (rootDir) => {
    const result = runDocsA11y({ check: true, rootDir });
    assert.equal(result.exitCode, 1);
    assert.match(result.messages[0], /no keyboard user can scroll/u);
    assert.equal(result.messages.length, 3);
  });
});

test('the check path succeeds once the rewrite has run', () => {
  withFixture({ 'index.html': '<pre a></pre>' }, (rootDir) => {
    runDocsA11y({ rootDir });
    assert.equal(runDocsA11y({ check: true, rootDir }).exitCode, 0);
  });
});

// A missing dist must be an error, not a pass: "nothing to check" is how a guard disappears.
test('a missing dist fails rather than passing vacuously', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-docs-a11y-nodist-'));
  try {
    const result = runDocsA11y({ check: true, rootDir });
    assert.equal(result.exitCode, 1);
    assert.match(result.messages[0], /does not exist/u);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
