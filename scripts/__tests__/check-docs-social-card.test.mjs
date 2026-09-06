import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectDocsSocialCardViolations } from '../check-docs-social-card.mjs';
import { collectSocialCardAssetViolations } from '../generate-og-image.mjs';
import {
  SOCIAL_CARD,
  collectCardFileViolations,
  collectDistSocialCardViolations,
  metaContent,
  readPngSize,
  renderSocialCardSvg,
} from '../social-card-lib.mjs';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const ORIGIN = 'https://beeui.example.com';

function page({ image = `${ORIGIN}/og-beeui.png`, card = 'summary_large_image', width = '1200', height = '630', alt = SOCIAL_CARD.alt } = {}) {
  return [
    '<!doctype html><html><head>',
    `<link rel="canonical" href="${ORIGIN}/page/" />`,
    card ? `<meta name="twitter:card" content="${card}" />` : '',
    image ? `<meta property="og:image" content="${image}" />` : '',
    width ? `<meta property="og:image:width" content="${width}" />` : '',
    height ? `<meta property="og:image:height" content="${height}" />` : '',
    alt ? `<meta property="og:image:alt" content="${alt.replaceAll('"', '&quot;')}" />` : '',
    '</head><body></body></html>',
  ].join('');
}

function distWith(pages, { withCard = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-social-card-'));
  for (const [name, html] of Object.entries(pages)) {
    fs.mkdirSync(path.join(dir, path.dirname(name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), html);
  }
  if (withCard) fs.copyFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath), path.join(dir, SOCIAL_CARD.fileName));
  return dir;
}

function violationsFor(pages, options) {
  const distDir = distWith(pages, options);
  try {
    return collectDistSocialCardViolations({ distDir, routePrefix: '/', expectedOrigin: ORIGIN });
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
}

test('the committed card is a 1200x630 PNG within the size ceiling', () => {
  assert.deepEqual(collectCardFileViolations(path.join(rootDir, SOCIAL_CARD.sourcePath), SOCIAL_CARD.sourcePath), []);
  const buffer = fs.readFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath));
  assert.deepEqual(readPngSize(buffer), { width: 1200, height: 630 });
});

test('the card artwork is derived from the dark theme tokens and the site contract', () => {
  const svg = renderSocialCardSvg(rootDir);
  assert.match(svg, /width="1200" height="630"/u);
  assert.match(svg, /fill="#0b0f14"/u, 'background must come from themes.dark.colors.background');
  assert.match(svg, /fill="#fbbf24"/u, 'brand mark must come from themes.dark.colors.primary');
  assert.match(svg, /beeui\.beemvp\.com/u, 'host must come from web/public-site.config.json');
  assert.ok(svg.includes(SOCIAL_CARD.tagline));
});

test('a compliant page passes', () => {
  assert.deepEqual(violationsFor({ 'index.html': page() }), []);
});

test('summary_large_image without og:image fails', () => {
  const violations = violationsFor({ 'index.html': page({ image: null }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /empty large card/u);
});

test('a relative og:image fails', () => {
  const violations = violationsFor({ 'index.html': page({ image: '/og-beeui.png' }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /not an absolute URL/u);
});

test('an og:image on another origin fails', () => {
  const violations = violationsFor({ 'index.html': page({ image: 'https://cdn.example.net/og-beeui.png' }) });
  assert.ok(violations.some((violation) => /does not match the page origin/u.test(violation)));
});

test('an og:image missing from the build output fails', () => {
  const violations = violationsFor({ 'index.html': page() }, { withCard: false });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /is missing/u);
});

test('an og:image that is not the advertised size fails', () => {
  const violations = violationsFor({ 'index.html': page({ width: '800', height: '418' }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /not 1200x630/u);
});

test('a card file that is not a PNG fails', () => {
  const distDir = distWith({ 'index.html': page() }, { withCard: false });
  try {
    fs.writeFileSync(path.join(distDir, SOCIAL_CARD.fileName), '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"></svg>');
    const violations = collectDistSocialCardViolations({ distDir, routePrefix: '/', expectedOrigin: ORIGIN });
    assert.ok(violations.some((violation) => /do not render SVG cards/u.test(violation)));
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('drifted alt text fails', () => {
  const violations = violationsFor({ 'index.html': page({ alt: 'Something else entirely' }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /drifted from the card contract/u);
});

test('a page without summary_large_image and without og:image is not required to carry one', () => {
  assert.deepEqual(violationsFor({ 'index.html': page({ card: 'summary', image: null, width: null, height: null, alt: null }) }), []);
});

test('metaContent matches the whole key, not a prefix', () => {
  const html = '<meta property="og:image:width" content="1200" /><meta property="og:image" content="x" />';
  assert.equal(metaContent(html, 'og:image'), 'x');
  assert.equal(metaContent(html, 'og:image:width'), '1200');
  assert.equal(metaContent(html, 'og:image:height'), undefined);
});

test('the docs gate reports an unbuilt portal instead of passing silently', () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-social-card-root-'));
  try {
    const violations = collectDocsSocialCardViolations(emptyRoot);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /has no built pages/u);
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

test('the generator CLI agrees the committed card is publishable', () => {
  assert.deepEqual(collectSocialCardAssetViolations(rootDir), []);
});
