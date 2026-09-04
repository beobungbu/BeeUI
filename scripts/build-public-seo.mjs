#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPublicLanding } from './build-public-landing.mjs';
import { buildPublicDiscovery } from './build-public-discovery.mjs';
import { buildPublicComponentManifest } from './public-component-reference.mjs';
import { buildPublicPatternManifest } from './public-pattern-reference.mjs';
import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function docsSourceRoutes(rootDir) {
  const base = path.join(rootDir, 'apps/docs/src/content/docs');
  const routes = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(md|mdx)$/.test(entry.name) && !absolute.includes(`${path.sep}components${path.sep}reference${path.sep}`) && !absolute.includes(`${path.sep}patterns${path.sep}reference${path.sep}`)) {
        const relative = path.relative(base, absolute).replaceAll(path.sep, '/').replace(/\.(md|mdx)$/, '');
        const slug = relative === 'index' ? '' : relative.replace(/\/index$/, '');
        routes.push(`/docs/${slug ? `${slug}/` : ''}`);
      }
    }
  }
  walk(base);
  return routes;
}

function publicRoutes(rootDir, discovery) {
  const routes = new Set(['/', '/showcase/', '/demo/', '/changelog/']);
  for (const page of discovery.pages) routes.add(page.route);
  for (const route of docsSourceRoutes(rootDir)) routes.add(route);
  for (const component of buildPublicComponentManifest(rootDir)) routes.add(`/docs/components/reference/${component.name}/`);
  for (const pattern of buildPublicPatternManifest(rootDir)) routes.add(`/docs/patterns/reference/${pattern.pack}/${pattern.slug}/`);
  return [...routes].sort();
}

function addSocialMetadata(html, { title, description, canonical, image, robots }) {
  if (!html.includes('</head>')) throw new Error(`cannot inject metadata into ${canonical}: missing </head>`);
  const meta = `
<meta name="robots" content="${escapeHtml(robots)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="BeeUI" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />`;
  return html.replace('</head>', `${meta}\n</head>`);
}

function renderChangelog(markdown, contract) {
  const body = markdown.split('\n').map((line) => {
    if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith('- ')) return `<p>• ${escapeHtml(line.slice(2))}</p>`;
    if (line.startsWith('> ')) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
    if (!line.trim()) return '';
    return `<p>${escapeHtml(line)}</p>`;
  }).join('\n');
  const canonical = `${contract.origin}/changelog/`;
  const image = `${contract.origin}/assets/og-beeui.svg`;
  return addSocialMetadata(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="description" content="Consumer-facing BeeUI change history sourced from the repository CHANGELOG." /><title>BeeUI changelog</title><link rel="canonical" href="${canonical}" /><link rel="stylesheet" href="/assets/site.css" /></head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/">BeeUI</a><nav aria-label="Primary"><a href="/docs/">Docs</a><a href="/showcase/">Showcase</a><a href="/demo/">Demo</a></nav></header><main id="main" class="shell section"><p class="eyebrow">Source-driven history · current workspace v${escapeHtml(contract.buildTruth.version)}</p><p>Historical entries describe the state at that time. They do not override the current unpublished distribution status.</p>${body}</main></body></html>`, {
    title: 'BeeUI changelog',
    description: 'Consumer-facing BeeUI change history sourced from the repository CHANGELOG.',
    canonical,
    image,
    robots: contract.indexPolicy,
  });
}

function socialSvg(version) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc"><title id="title">BeeUI</title><desc id="desc">Native-first product UI for React Native and Web.</desc><rect width="1200" height="630" fill="#0a0b0d"/><circle cx="1050" cy="100" r="260" fill="#f4b942" opacity="0.16"/><circle cx="1040" cy="540" r="340" fill="#7c6cff" opacity="0.12"/><rect x="72" y="74" width="92" height="92" rx="24" fill="#f4b942"/><text x="118" y="139" text-anchor="middle" font-family="system-ui,sans-serif" font-size="54" font-weight="800" fill="#0a0b0d">B</text><text x="72" y="278" font-family="system-ui,sans-serif" font-size="86" font-weight="800" fill="#ffffff">BeeUI</text><text x="72" y="358" font-family="system-ui,sans-serif" font-size="38" font-weight="600" fill="#d8d9df">Native-first product UI.</text><text x="72" y="414" font-family="system-ui,sans-serif" font-size="29" fill="#a8abb5">Expo · bare React Native · Web</text><text x="72" y="536" font-family="ui-monospace,monospace" font-size="22" fill="#f4b942">v${escapeHtml(version)} · public source · unpublished distribution</text></svg>`;
}

export function renderRobotsTxt(contract) {
  const rules = ['User-agent: *'];
  if (contract.indexPolicy === 'index,follow') rules.push('Allow: /');
  for (const pathname of contract.robotsDisallow ?? []) rules.push(`Disallow: ${pathname}`);
  rules.push(`Sitemap: ${contract.origin}/sitemap.xml`);
  return `${rules.join('\n')}\n`;
}

export function buildPublicSeo({ rootDir = ROOT_DIR, outDir = path.join(rootDir, 'web/dist'), environment } = {}) {
  const contract = buildPublicSiteContract(rootDir, { environment });
  const previousEnvironment = process.env.BEEUI_WEB_ENV;
  if (environment) process.env.BEEUI_WEB_ENV = environment;
  try {
    buildPublicLanding({ rootDir, outDir });
    const discovery = buildPublicDiscovery({ rootDir, outDir });
    const image = `${contract.origin}/assets/og-beeui.svg`;

    const landingPath = path.join(outDir, 'index.html');
    const landing = fs.readFileSync(landingPath, 'utf8');
    fs.writeFileSync(landingPath, addSocialMetadata(landing, {
      title: 'BeeUI — production-oriented React Native UI',
      description: 'BeeUI is a mobile-first React Native UI system for Expo, bare React Native, and Web.',
      canonical: `${contract.origin}/`,
      image,
      robots: contract.indexPolicy,
    }).replace('</head>', `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: 'BeeUI', codeRepository: 'https://github.com/beobungbu/BeeUI', programmingLanguage: ['TypeScript', 'JavaScript'], runtimePlatform: ['React Native', 'Web'], license: 'https://opensource.org/license/mit', version: contract.buildTruth.version })}</script>\n</head>`));

    for (const page of discovery.pages) {
      const pagePath = path.join(outDir, page.relativePath);
      const html = fs.readFileSync(pagePath, 'utf8');
      fs.writeFileSync(pagePath, addSocialMetadata(html, {
        title: page.title,
        description: page.description,
        canonical: `${contract.origin}${page.route}`,
        image,
        robots: contract.indexPolicy,
      }));
    }

    fs.mkdirSync(path.join(outDir, 'changelog'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'changelog/index.html'), renderChangelog(fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8'), contract));
    fs.writeFileSync(path.join(outDir, 'assets/og-beeui.svg'), socialSvg(contract.buildTruth.version));

    const routes = publicRoutes(rootDir, discovery);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${contract.origin}${route}</loc></url>`).join('\n')}\n</urlset>\n`;
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap);
    fs.writeFileSync(path.join(outDir, 'robots.txt'), renderRobotsTxt(contract));
    return { routes, discovery, outDir, contract };
  } finally {
    if (environment) {
      if (previousEnvironment === undefined) delete process.env.BEEUI_WEB_ENV;
      else process.env.BEEUI_WEB_ENV = previousEnvironment;
    }
  }
}

function main() {
  const { routes, outDir, contract } = buildPublicSeo();
  console.log(`Built SEO/changelog assets (${routes.length} routes) into ${path.relative(ROOT_DIR, outDir)} for ${contract.environment}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
