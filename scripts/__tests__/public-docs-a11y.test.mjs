import assert from 'node:assert/strict';
import test from 'node:test';

import { addKeyboardScrollToPreElements } from '../public-docs-a11y.mjs';

// A `<pre>` that scrolls horizontally with nothing focusable inside cannot be scrolled by a
// keyboard-only reader. The portal shipped 367 of them across 125 of its 151 pages.

test('a code block gains a keyboard stop with a name', () => {
  const out = addKeyboardScrollToPreElements('<pre data-language="tsx"><code>x</code></pre>');
  assert.match(out, /<pre data-language="tsx" tabindex="0" role="region" aria-label="Code block">/u);
});

test('existing attributes are preserved', () => {
  const out = addKeyboardScrollToPreElements('<pre class="a" data-x="1"></pre>');
  assert.match(out, /class="a" data-x="1" tabindex="0"/u);
});

// Running the step twice must not stack duplicate attributes onto the same element.
test('a code block that is already reachable is left alone', () => {
  const once = addKeyboardScrollToPreElements('<pre data-language="tsx"></pre>');
  assert.equal(addKeyboardScrollToPreElements(once), once);
  assert.equal((once.match(/tabindex/gu) ?? []).length, 1);
});

test('every code block on a page is covered, not just the first', () => {
  const out = addKeyboardScrollToPreElements('<pre a></pre><p>x</p><pre b></pre><pre c></pre>');
  assert.equal((out.match(/tabindex="0"/gu) ?? []).length, 3);
});

// The rule is about `pre`; nothing else should be given a tab stop it did not ask for.
test('other elements are untouched', () => {
  const html = '<precise></precise><code></code><div class="pre"></div>';
  assert.equal(addKeyboardScrollToPreElements(html), html);
});
