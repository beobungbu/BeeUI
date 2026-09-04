import assert from 'node:assert/strict';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import { buildPublicComponentManifest } from '../public-component-reference.mjs';
import { buildPublicPatternManifest } from '../public-pattern-reference.mjs';
import {
  DEMO_FALLBACK_MARKER,
  SHOWCASE_FALLBACK_MARKER,
  injectFallback,
  renderDemoFallback,
  renderShowcaseFallback,
} from '../public-portal-shell.mjs';

const IDENTITY = { version: '20260902.0.0', commit: 'abc1234', environment: 'production' };

// The fallback exists so a reader who never runs the app still learns what is in the Showcase.
// Deriving it from the same manifests the docs use is what stops it describing a component that
// was removed, or missing one that was added.
test('the showcase fallback lists every component and pattern that exists', () => {
  const html = renderShowcaseFallback({ rootDir: ROOT_DIR, identity: IDENTITY });
  for (const component of buildPublicComponentManifest(ROOT_DIR)) {
    assert.ok(html.includes(`/docs/components/${component.name}/`), `missing component ${component.name}`);
  }
  for (const pattern of buildPublicPatternManifest(ROOT_DIR)) {
    assert.ok(html.includes(pattern.route), `missing pattern ${pattern.pack}/${pattern.slug}`);
  }
});

test('both fallbacks carry the exact build identity', () => {
  for (const html of [renderShowcaseFallback({ rootDir: ROOT_DIR, identity: IDENTITY }), renderDemoFallback({ identity: IDENTITY })]) {
    assert.ok(html.includes(IDENTITY.version));
    assert.ok(html.includes(IDENTITY.commit));
    assert.ok(html.includes(IDENTITY.environment));
  }
});

// Both are Expo exports regenerated on every build, so the fallback is injected rather than
// written into a template. Injecting twice must not duplicate it.
test('injection is idempotent and lands inside the body', () => {
  const html = '<!doctype html><html><head><title>x</title></head><body class="app"><div id="root"></div></body></html>';
  const once = injectFallback(html, renderDemoFallback({ identity: IDENTITY }), DEMO_FALLBACK_MARKER);
  assert.ok(once.includes(DEMO_FALLBACK_MARKER));
  assert.ok(once.indexOf(DEMO_FALLBACK_MARKER) > once.indexOf('<body'));
  assert.ok(once.indexOf(DEMO_FALLBACK_MARKER) < once.indexOf('</body>'));
  assert.equal(injectFallback(once, renderDemoFallback({ identity: IDENTITY }), DEMO_FALLBACK_MARKER), once);
});

test('an export with no body is a loud failure, not a silently unmodified page', () => {
  assert.throws(() => injectFallback('<html></html>', 'x', SHOWCASE_FALLBACK_MARKER), /no <body>/u);
});

// The fallback must not claim the app is unavailable, only that it needs JavaScript — and it
// must route the reader somewhere useful rather than dead-ending.
test('each fallback explains the requirement and offers a way onward', () => {
  const showcase = renderShowcaseFallback({ rootDir: ROOT_DIR, identity: IDENTITY });
  const demo = renderDemoFallback({ identity: IDENTITY });
  for (const html of [showcase, demo]) {
    assert.match(html, /needs JavaScript to run/u);
    assert.ok(html.includes('href="/docs/"'));
  }
  assert.ok(showcase.includes('href="/demo/"'));
  assert.ok(demo.includes('href="/showcase/"'));
});
