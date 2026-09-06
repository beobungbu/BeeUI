// The one social card the public site shares, and the rules a built page has to follow to use it.
//
// Every built page declared `twitter:card=summary_large_image` while no page carried an
// `og:image`, so every share rendered an empty large card. The card is a single 1200x630 PNG
// generated from `packages/tokens/tokens.json` by `scripts/generate-og-image.mjs` and committed
// at `apps/docs/public/og-beeui.png`; Astro copies it into `apps/docs/dist`, and
// `scripts/build-public-seo.mjs` copies the same bytes into `web/dist/assets` so the landing,
// examples and changelog pages point at a file on their own origin.
//
// PNG, not SVG: Facebook/Open Graph and X both document raster formats only (JPEG, PNG, GIF,
// WEBP) for card images, and neither fetches or rasterises `image/svg+xml`. The landing pages
// used to advertise an SVG card, which is the same "declared but unusable" defect in a
// different disguise.
//
// `collectSocialCardViolations` is the guard. It reads built HTML — not source — so it fails
// when the metadata stops being emitted, when the URL is relative, when the referenced file is
// missing from the build output, and when the file is not the size the metadata claims.

import fs from 'node:fs';
import path from 'node:path';

import { dtcgColorToHex, parseCanonicalJson, resolveTokenReferences } from './generate-tokens.mjs';
import { readPublicSiteConfig } from './public-site-contract-lib.mjs';

export const SOCIAL_CARD = {
  width: 1200,
  height: 630,
  fileName: 'og-beeui.png',
  // Committed source of truth. Astro publishes `apps/docs/public` verbatim, so this is also the
  // path the docs build output serves from `<docsBase>/og-beeui.png`.
  sourcePath: 'apps/docs/public/og-beeui.png',
  headline: 'BeeUI',
  // Kept in step with the docs portal description in apps/docs/astro.config.mjs; asserted by
  // scripts/check-docs-social-card.mjs so rewording the product description cannot leave the
  // card saying something else.
  tagline: 'Production-oriented React Native UI',
  platforms: 'Expo · bare React Native · Web',
  alt: 'BeeUI — production-oriented React Native UI for Expo, bare React Native, and Web.',
  // A flat two-tone card compresses to ~30 KB. The ceiling is headroom for a redesign, not a
  // target; it exists so an accidental photo drop cannot make every share a megabyte.
  maxBytes: 150 * 1024,
};

const TOKENS_PATH = 'packages/tokens/tokens.json';

export function readCardColors(rootDir) {
  const source = resolveTokenReferences(parseCanonicalJson(fs.readFileSync(path.join(rootDir, TOKENS_PATH), 'utf8'), TOKENS_PATH));
  const colors = source.themes?.dark?.colors;
  if (!colors) throw new Error(`${TOKENS_PATH} is missing themes.dark.colors; the social card has no palette to derive from.`);
  const hex = (name) => {
    const token = colors[name];
    if (!token?.$value) throw new Error(`${TOKENS_PATH} is missing themes.dark.colors.${name}.`);
    return dtcgColorToHex(token.$value);
  };
  return {
    background: hex('background'),
    foreground: hex('foreground'),
    primary: hex('primary'),
    primaryForeground: hex('primary-foreground'),
    mutedForeground: hex('muted-foreground'),
    subtleForeground: hex('subtle-foreground'),
    info: hex('info'),
    border: hex('border'),
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// Deliberately carries no version and no distribution status: the PNG is committed, so any text
// that changes per release would be stale the moment it was rendered, and no check could see it.
export function renderSocialCardSvg(rootDir) {
  const c = readCardColors(rootDir);
  // The card is committed once and shared by every environment, so it carries the production
  // host from the site contract rather than the origin of whichever build renders it.
  const host = new URL(readPublicSiteConfig(rootDir).environments.production.origin).host;
  const { width, height, headline, tagline, platforms } = SOCIAL_CARD;
  const sans = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(SOCIAL_CARD.alt)}">`,
    `<rect width="${width}" height="${height}" fill="${c.background}"/>`,
    `<circle cx="1050" cy="96" r="260" fill="${c.primary}" opacity="0.16"/>`,
    `<circle cx="1046" cy="546" r="330" fill="${c.info}" opacity="0.12"/>`,
    `<rect x="72" y="74" width="92" height="92" rx="24" fill="${c.primary}"/>`,
    `<text x="118" y="139" text-anchor="middle" font-family="${sans}" font-size="54" font-weight="800" fill="${c.primaryForeground}">B</text>`,
    `<text x="72" y="286" font-family="${sans}" font-size="96" font-weight="800" fill="${c.foreground}">${escapeXml(headline)}</text>`,
    `<text x="72" y="366" font-family="${sans}" font-size="40" font-weight="600" fill="${c.mutedForeground}">${escapeXml(tagline)}</text>`,
    `<text x="72" y="424" font-family="${sans}" font-size="29" fill="${c.subtleForeground}">${escapeXml(platforms)}</text>`,
    `<rect x="72" y="500" width="1056" height="2" fill="${c.border}"/>`,
    `<text x="72" y="556" font-family="${sans}" font-size="26" font-weight="600" fill="${c.primary}">${escapeXml(host)}</text>`,
    '</svg>',
  ].join('');
}

// PNG header: 8-byte signature, then an IHDR chunk whose first eight payload bytes are the
// width and height as big-endian uint32s.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readPngSize(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function collectCardFileViolations(absolutePath, label) {
  const violations = [];
  if (!fs.existsSync(absolutePath)) return [`${label} is missing (${SOCIAL_CARD.width}x${SOCIAL_CARD.height} PNG expected). Run: pnpm docs:og-image`];
  const buffer = fs.readFileSync(absolutePath);
  const size = readPngSize(buffer);
  if (!size) violations.push(`${label} is not a PNG; Open Graph consumers do not render SVG cards.`);
  else if (size.width !== SOCIAL_CARD.width || size.height !== SOCIAL_CARD.height) {
    violations.push(`${label} is ${size.width}x${size.height}, not ${SOCIAL_CARD.width}x${SOCIAL_CARD.height}.`);
  }
  if (buffer.length > SOCIAL_CARD.maxBytes) {
    violations.push(`${label} is ${(buffer.length / 1024).toFixed(1)} KB, over the ${(SOCIAL_CARD.maxBytes / 1024).toFixed(0)} KB social-card ceiling.`);
  }
  return violations;
}

const META_RE = /<meta\b[^>]*>/gi;

function metaAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([a-z0-9:_-]+)\s*=\s*"([^"]*)"/gi)) attributes[match[1].toLowerCase()] = match[2];
  return attributes;
}

// Returns the `content` of the first `<meta>` whose `property` or `name` is exactly `key`.
// Exact matching matters: a substring search for `og:image` also hits `og:image:width`.
export function metaContent(html, key) {
  for (const tag of html.match(META_RE) ?? []) {
    const attributes = metaAttributes(tag);
    if ((attributes.property ?? attributes.name) === key) return attributes.content ?? '';
  }
  return undefined;
}

function firstCanonicalOrigin(html) {
  const match = /<link\b[^>]*rel="canonical"[^>]*>/i.exec(html);
  const href = match ? metaAttributes(match[0]).href : undefined;
  try {
    return href ? new URL(href).origin : undefined;
  } catch {
    return undefined;
  }
}

function decodeEntities(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/**
 * Asserts the social-card contract on one built page.
 *
 * @param {object} input
 * @param {string} input.label            How the page is named in a violation message.
 * @param {string} input.html             The built HTML.
 * @param {string} input.expectedOrigin   Origin the image URL must be served from.
 * @param {(pathname: string) => string | null} input.resolveAsset
 *   Maps an absolute URL pathname to a file inside the build output, or null when the pathname
 *   is outside the output this page belongs to.
 */
export function collectPageSocialCardViolations({ label, html, expectedOrigin, resolveAsset }) {
  const violations = [];
  const twitterCard = metaContent(html, 'twitter:card');
  const image = metaContent(html, 'og:image');

  if (twitterCard === 'summary_large_image' && !image) {
    violations.push(`${label} declares twitter:card=summary_large_image with no og:image; the share renders an empty large card.`);
    return violations;
  }
  if (!image) return violations;

  const origin = expectedOrigin ?? firstCanonicalOrigin(html);
  let url;
  try {
    url = new URL(decodeEntities(image));
  } catch {
    violations.push(`${label} og:image "${image}" is not an absolute URL; crawlers do not resolve relative card images.`);
    return violations;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    violations.push(`${label} og:image "${image}" is not an http(s) URL.`);
    return violations;
  }
  if (origin && url.origin !== origin) {
    violations.push(`${label} og:image origin ${url.origin} does not match the page origin ${origin}.`);
  }

  const width = metaContent(html, 'og:image:width');
  const height = metaContent(html, 'og:image:height');
  const alt = metaContent(html, 'og:image:alt');
  if (width !== String(SOCIAL_CARD.width) || height !== String(SOCIAL_CARD.height)) {
    violations.push(`${label} declares og:image ${width ?? 'no width'}x${height ?? 'no height'}, not ${SOCIAL_CARD.width}x${SOCIAL_CARD.height}.`);
  }
  // The alt text is repeated in the Astro head component, which cannot import this module
  // without pulling the token pipeline into the portal's Vite build. Asserting equality here
  // turns that duplication into something a check fails on rather than something that drifts.
  if (!alt?.trim()) violations.push(`${label} og:image has no og:image:alt.`);
  else if (decodeEntities(alt) !== SOCIAL_CARD.alt) {
    violations.push(`${label} og:image:alt "${decodeEntities(alt)}" drifted from the card contract in scripts/social-card-lib.mjs.`);
  }

  const file = resolveAsset(url.pathname);
  if (!file) {
    violations.push(`${label} og:image ${url.pathname} is outside this build output, so nothing here proves it is published.`);
    return violations;
  }
  violations.push(...collectCardFileViolations(file, `${label} og:image ${url.pathname}`));
  return violations;
}

export function htmlFilesIn(absoluteDir) {
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) return htmlFilesIn(next);
    return entry.name.endsWith('.html') ? [next] : [];
  });
}

/**
 * Asserts the contract across every built page in one output directory.
 *
 * @param {object} input
 * @param {string} input.distDir        Absolute path to the build output.
 * @param {string} [input.routePrefix]  URL prefix this output is served under ("/" for the site
 *                                      root, "/docs/" for the portal).
 * @param {string} [input.expectedOrigin]
 * @param {string} [input.label]        Prefix for violation messages.
 */
export function collectDistSocialCardViolations({ distDir, routePrefix = '/', expectedOrigin, label = '' }) {
  const prefix = routePrefix.endsWith('/') ? routePrefix : `${routePrefix}/`;
  const resolveAsset = (pathname) => {
    if (!pathname.startsWith(prefix)) return null;
    return path.join(distDir, pathname.slice(prefix.length));
  };
  const violations = [];
  for (const file of htmlFilesIn(distDir)) {
    violations.push(
      ...collectPageSocialCardViolations({
        label: `${label}${path.relative(distDir, file)}`,
        html: fs.readFileSync(file, 'utf8'),
        expectedOrigin,
        resolveAsset,
      }),
    );
  }
  return violations;
}
