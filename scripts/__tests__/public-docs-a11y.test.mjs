import assert from 'node:assert/strict';
import test from 'node:test';

import { addKeyboardScrollToScrollableRegions } from '../public-docs-a11y.mjs';

// A `<pre>` that scrolls horizontally with nothing focusable inside cannot be scrolled by a
// keyboard-only reader. The portal shipped 367 of them across 125 of its 151 pages.

test('a code block gains a keyboard stop with a name', () => {
  const out = addKeyboardScrollToScrollableRegions('<pre data-language="tsx"><code>x</code></pre>');
  assert.match(out, /<pre data-language="tsx" tabindex="0" role="region" aria-label="Code block">/u);
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
test('a table is made reachable and labelled as a table', () => {
  const out = addKeyboardScrollToScrollableRegions('<table><thead></thead></table>');
  assert.match(out, /<table tabindex="0" role="region" aria-label="Table">/u);
});

test('code blocks and tables on one page are both covered', () => {
  const out = addKeyboardScrollToScrollableRegions('<pre a></pre><table></table><pre b></pre>');
  assert.equal((out.match(/tabindex="0"/gu) ?? []).length, 3);
  assert.equal((out.match(/aria-label="Table"/gu) ?? []).length, 1);
  assert.equal((out.match(/aria-label="Code block"/gu) ?? []).length, 2);
});
