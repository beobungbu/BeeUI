#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPreviewDescriptor } from './public-component-previews.mjs';
import { buildPublicComponentManifest } from './public-component-reference.mjs';
import { buildPublicPatternManifest } from './public-pattern-reference.mjs';
import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';

const LLM_FILES = ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt'];

export const STARTERS = [
  {
    slug: 'expo-package-consumer',
    name: 'Expo package consumer',
    path: 'examples/expo-package-consumer',
    model: 'Packed package boundary',
    purpose: 'Expo SDK 57 / Metro consumer using the same package boundary intended for public distribution.',
    onboarding: '/docs/getting-started/expo/',
    commands: ['pnpm build', 'cd examples/expo-package-consumer', 'bash setup.sh', 'bash bundle.sh'],
  },
  {
    slug: 'bare-rn-consumer',
    name: 'Bare React Native consumer',
    path: 'examples/bare-rn-consumer',
    model: 'Packed package boundary',
    purpose: 'Bare React Native / Metro consumer proving BeeUI works without Expo application ownership.',
    onboarding: '/docs/getting-started/bare-react-native/',
    commands: ['pnpm build', 'cd examples/bare-rn-consumer', 'bash setup.sh', 'bash bundle.sh'],
  },
  {
    slug: 'web-consumer',
    name: 'Web consumer',
    path: 'examples/web-consumer',
    model: 'Packed package boundary',
    purpose: 'Vite + react-native-web consumer with a real production build and browser interaction coverage.',
    onboarding: '/docs/getting-started/web/',
    commands: ['pnpm build', 'cd examples/web-consumer', 'bash setup.sh', 'npm run build'],
  },
  {
    slug: 'source-ownership-starter',
    name: 'Source ownership starter',
    path: 'examples/source-ownership-starter',
    model: 'Registry source ownership',
    purpose: 'Consumer-owned BeeUI source copied through the repository-local Registry workflow.',
    onboarding: '/docs/registry/',
    commands: ['pnpm build', 'cd examples/source-ownership-starter', 'bash setup.sh', 'npm run build'],
  },
  {
    slug: 'agent-reference-app',
    name: 'Agent reference app',
    path: 'examples/agent-reference-app',
    model: 'AI-context reference',
    purpose: 'Small application built from the public llms.txt family and agent-development contract.',
    onboarding: '/docs/ai/',
    commands: ['pnpm build', 'cd examples/agent-reference-app', 'bash setup.sh', 'npm run build'],
  },
];

const FEATURED_RECIPES = [
  { kind: 'pattern', id: 'sign-in-screen', label: 'Login form', summary: 'Email/password sign-in with social and recovery affordances.' },
  { kind: 'pattern', id: 'dashboard-overview-screen', label: 'Dashboard', summary: 'Production dashboard composition with balances, activity, and actions.' },
  { kind: 'pattern', id: 'transactions-screen', label: 'Search + filter', summary: 'Searchable, filterable data flow with loading/error/retry states.' },
  { kind: 'pattern', id: 'checkout-screen', label: 'Checkout', summary: 'Order review, address editing, and place-order composition.' },
  { kind: 'pattern', id: 'settings-screen', label: 'Settings page', summary: 'Top-level settings navigation and preference entry points.' },
  { kind: 'pattern', id: 'edit-profile-screen', label: 'Profile form', summary: 'Editable profile form with avatar and save action.' },
  { kind: 'component', id: 'table', label: 'Data table', summary: 'Source-equal Table/DataTable runtime example.' },
  { kind: 'component', id: 'dialog', label: 'Dialog', summary: 'Dialog composition with the real overlay runtime.' },
  { kind: 'component', id: 'sheet', label: 'Bottom sheet', summary: 'Sheet/BottomSheet interaction through the canonical Showcase.' },
  { kind: 'component', id: 'toast', label: 'Toast', summary: 'Toast feedback using the shared BeeUI provider runtime.' },
  { kind: 'component', id: 'calendar', label: 'Calendar', summary: 'Calendar/date selection with platform-honest preview boundaries.' },
  { kind: 'component', id: 'tabs', label: 'Tabs', summary: 'Accessible tabbed disclosure and navigation composition.' },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function githubTreeHref(pathname) {
  return `https://github.com/beobungbu/BeeUI/tree/main/${pathname}`;
}

function githubBlobHref(pathname) {
  return `https://github.com/beobungbu/BeeUI/blob/main/${pathname}`;
}

function documentShell({ contract, title, description, route, body, scripts = true }) {
  const canonical = `${contract.origin}${route}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="${escapeHtml(description)}" />
<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${escapeHtml(canonical)}" />
<link rel="stylesheet" href="/assets/site.css" />
<link rel="stylesheet" href="/assets/examples.css" />
${scripts ? '<script src="/assets/examples.js" defer></script>' : ''}
</head>
<body class="examples-page">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">B</span><span>BeeUI</span></a>
  <nav class="desktop-nav" aria-label="Primary">
    <a href="/docs/">Docs</a><a href="/docs/components/reference/">Components</a><a href="/docs/patterns/reference/">Patterns</a><a href="/showcase/">Showcase</a><a href="/demo/">Demo</a>
  </nav>
  <details class="mobile-nav"><summary>Menu</summary><nav aria-label="Mobile primary"><a href="/docs/">Docs</a><a href="/docs/components/reference/">Components</a><a href="/docs/patterns/reference/">Patterns</a><a href="/showcase/">Showcase</a><a href="/demo/">Demo</a></nav></details>
</header>
${body}
</body>
</html>`;
}

function platformBadges() {
  return '<div class="platform-badges" aria-label="Target platforms"><span>Web · live</span><span>iOS · native path</span><span>Android · native path</span></div>';
}

function recipeCard({ kind, title, purpose, route, tags = [], featuredLabel = '' }) {
  const searchText = [title, purpose, kind, ...tags].join(' ').toLowerCase();
  return `<article class="example-card" data-search-item data-search-text="${escapeHtml(searchText)}">
    <p class="example-kind">${escapeHtml(featuredLabel || kind)}</p>
    <h3><a href="${escapeHtml(route)}">${escapeHtml(title)}</a></h3>
    <p>${escapeHtml(purpose)}</p>
    <div class="example-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
    <a class="example-open" href="${escapeHtml(route)}">Preview + code <span aria-hidden="true">→</span></a>
  </article>`;
}

function starterCard(starter) {
  return recipeCard({
    kind: 'Starter app',
    title: starter.name,
    purpose: starter.purpose,
    route: `/examples/starters/${starter.slug}/`,
    tags: [starter.model],
  });
}

function resolveFeatured(components, patterns) {
  return FEATURED_RECIPES.map((entry) => {
    if (entry.kind === 'component') {
      const component = components.find((candidate) => candidate.name === entry.id);
      if (!component) throw new Error(`featured example component no longer exists: ${entry.id}`);
      return {
        ...entry,
        title: entry.label,
        purpose: entry.summary,
        route: `/examples/components/${component.name}/`,
        tags: [component.category, 'Web preview', 'Source-equal code'],
      };
    }
    const pattern = patterns.find((candidate) => candidate.slug === entry.id);
    if (!pattern) throw new Error(`featured example pattern no longer exists: ${entry.id}`);
    return {
      ...entry,
      title: entry.label,
      purpose: entry.summary,
      route: `/examples/patterns/${pattern.pack}/${pattern.slug}/`,
      tags: [pattern.pack, 'Production pattern', 'Copyable source'],
    };
  });
}

function renderHub({ contract, components, patterns, featured }) {
  const featuredCards = featured.map((item) => recipeCard({
    kind: item.kind === 'component' ? 'Component recipe' : 'Pattern recipe',
    title: item.title,
    purpose: item.purpose,
    route: item.route,
    tags: item.tags,
    featuredLabel: 'Featured',
  })).join('\n');

  const componentCards = components.map((component) => recipeCard({
    kind: 'Component recipe',
    title: component.title,
    purpose: component.purpose,
    route: `/examples/components/${component.name}/`,
    tags: [component.category, 'Web preview', 'iOS', 'Android'],
  })).join('\n');

  const patternCards = patterns.map((pattern) => recipeCard({
    kind: 'Pattern recipe',
    title: pattern.title,
    purpose: pattern.purpose,
    route: `/examples/patterns/${pattern.pack}/${pattern.slug}/`,
    tags: [pattern.pack, `${pattern.beeuiComponents.length} BeeUI exports`],
  })).join('\n');

  const starterCards = STARTERS.map(starterCard).join('\n');
  const body = `<main id="main">
<section class="shell examples-hero">
  <p class="eyebrow">Examples · recipes · starters · v${escapeHtml(contract.buildTruth.version)}</p>
  <h1>Build from working BeeUI source.</h1>
  <p class="examples-lede">Browse source-equal component examples, complete production screen recipes, and isolated consumer starters. Every preview links back to the real Showcase or committed source; there is no second examples-only runtime.</p>
  <div class="examples-actions"><a class="button primary" href="#featured">Browse recipes</a><a class="button secondary" href="/showcase/">Open Showcase</a><a class="text-link" href="/docs/getting-started/">Getting started</a></div>
  <div class="examples-stats" aria-label="Examples inventory">
    <div><strong>${components.length}</strong><span>component recipes</span></div>
    <div><strong>${patterns.length}</strong><span>production patterns</span></div>
    <div><strong>${STARTERS.length}</strong><span>consumer starters</span></div>
    <div><strong>1</strong><span>canonical Showcase runtime</span></div>
  </div>
</section>
<section class="shell examples-truth" aria-label="Distribution status">
  <strong>Repository-local evaluation today.</strong>
  <span>BeeUI packages/CLI are still unpublished. Package starters install locally packed tarballs; source ownership uses the repository-local Registry workflow.</span>
</section>
<section class="shell examples-section" id="featured">
  <div class="row-heading"><div><p class="eyebrow">Featured recipes</p><h2>Common product UI, ready to inspect.</h2><p>Start with login, dashboard, data, checkout, settings, forms, overlays, feedback, and date/navigation primitives.</p></div></div>
  <div class="examples-grid featured-grid">${featuredCards}</div>
</section>
<section class="shell examples-section" id="all-examples">
  <div class="row-heading"><div><p class="eyebrow">Explore all</p><h2>Search the complete source-driven inventory.</h2><p>The component and pattern collections below come directly from BeeUI's public manifests. Adding/removing public source changes this page automatically.</p></div></div>
  <label class="example-search"><span>Filter examples</span><input type="search" placeholder="Try dialog, table, checkout, settings…" data-example-search autocomplete="off" /></label>
  <p class="example-search-status" data-example-search-status aria-live="polite"></p>
  <div class="example-group">
    <div class="example-group-heading"><h3>Component recipes</h3><a href="/docs/components/reference/">Full component docs →</a></div>
    <div class="examples-grid" data-example-collection>${componentCards}</div>
  </div>
  <div class="example-group">
    <div class="example-group-heading"><h3>Production patterns</h3><a href="/docs/patterns/reference/">Pattern documentation →</a></div>
    <div class="examples-grid" data-example-collection>${patternCards}</div>
  </div>
</section>
<section class="shell examples-section" id="starters">
  <div class="row-heading"><div><p class="eyebrow">Starter apps</p><h2>Prove the consumption boundary.</h2><p>These are isolated buildable consumers, not screenshots or workspace shortcuts.</p></div></div>
  <div class="examples-grid starter-grid">${starterCards}</div>
</section>
<section class="shell examples-footer-cta">
  <div><p class="eyebrow">Need the full application?</p><h2>Use Showcase to inspect. Use Demo to understand composition in context.</h2></div>
  <div class="examples-actions"><a class="button primary" href="/showcase/">Open Showcase</a><a class="button secondary" href="/demo/">Open Demo</a></div>
</section>
</main>`;

  return documentShell({
    contract,
    title: 'BeeUI examples — live recipes, patterns and starters',
    description: `Browse ${components.length} source-equal component recipes, ${patterns.length} production patterns, and isolated BeeUI consumer starters.`,
    route: '/examples/',
    body,
  });
}

function relatedPatternCards(component, patterns) {
  const symbols = new Set(component.values);
  return patterns
    .filter((pattern) => pattern.beeuiComponents.some((symbol) => symbols.has(symbol)))
    .slice(0, 6)
    .map((pattern) => `<li><a href="/examples/patterns/${pattern.pack}/${pattern.slug}/">${escapeHtml(pattern.title)}</a> <span>— ${escapeHtml(pattern.purpose)}</span></li>`)
    .join('');
}

function renderTabs({ slug, preview, code, platform }) {
  const ids = {
    preview: `${slug}-preview`,
    code: `${slug}-code`,
    platform: `${slug}-platform`,
  };
  return `<div class="recipe-tabs" data-tabset>
    <div class="recipe-tab-list" role="tablist" aria-label="Example views">
      <button type="button" role="tab" aria-selected="true" aria-controls="${ids.preview}" data-tab="preview">Preview</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="${ids.code}" data-tab="code" tabindex="-1">Code</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="${ids.platform}" data-tab="platform" tabindex="-1">Platforms</button>
    </div>
    <section id="${ids.preview}" role="tabpanel" data-panel="preview">${preview}</section>
    <section id="${ids.code}" role="tabpanel" data-panel="code" hidden>${code}</section>
    <section id="${ids.platform}" role="tabpanel" data-panel="platform" hidden>${platform}</section>
  </div>`;
}

function codePanel({ source, sourceHref, id }) {
  return `<div class="code-toolbar"><p>Exact committed source used by the preview/runtime path.</p><div><a class="text-link" href="${escapeHtml(sourceHref)}">View source</a><button type="button" class="copy-button" data-copy-target="${escapeHtml(id)}">Copy code</button></div></div><pre class="recipe-code"><code id="${escapeHtml(id)}">${escapeHtml(source)}</code></pre>`;
}

function renderComponentRecipe({ contract, component, patterns, rootDir }) {
  const route = `/examples/components/${component.name}/`;
  const descriptor = buildPreviewDescriptor(component, rootDir);
  const sourceHref = githubBlobHref(descriptor.fixture);
  const preview = `<div class="live-preview-card"><div class="live-preview-head"><div><p class="eyebrow">Live Web preview</p><h2>${escapeHtml(component.title)}</h2></div>${platformBadges()}</div><iframe title="${escapeHtml(component.title)} interactive BeeUI preview" src="${escapeHtml(descriptor.showcaseHref)}" loading="lazy"></iframe><p class="preview-note">The iframe loads the real Showcase route; the source tab below is the exact typechecked fixture used for this component family.</p><div class="examples-actions"><a class="button secondary" href="${escapeHtml(descriptor.showcaseHref)}">Open in Showcase</a><a class="text-link" href="${escapeHtml(component.route)}">Component docs</a></div></div>`;
  const code = codePanel({ source: descriptor.source, sourceHref, id: `component-source-${component.name}` });
  const platform = `<div class="platform-panel"><article><p class="eyebrow">Web</p><h3>Interactive preview</h3><p>Runs through the actual Showcase web bundle, not a rewritten HTML approximation.</p></article><article><p class="eyebrow">iOS / Android</p><h3>Same component source</h3><p>The component belongs to the same package and Showcase inventory. Platform/runtime limitations stay explicit in the component documentation.</p></article></div>`;
  const tabs = renderTabs({ slug: `component-${component.name}`, preview, code, platform });
  const related = relatedPatternCards(component, patterns);
  const body = `<main id="main" class="shell recipe-main">
<nav class="recipe-breadcrumb" aria-label="Breadcrumb"><a href="/examples/">Examples</a><span aria-hidden="true">/</span><span>Components</span><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(component.title)}</span></nav>
<header class="recipe-header">
  <p class="eyebrow">${escapeHtml(component.category)} component recipe</p>
  <h1>${escapeHtml(component.title)}</h1>
  <p>${escapeHtml(component.purpose)}</p>
  <div class="examples-actions"><a class="button primary" href="${escapeHtml(descriptor.showcaseHref)}">Open live Showcase</a><a class="button secondary" href="${escapeHtml(component.route)}">Read component docs</a><a class="text-link" href="${escapeHtml(sourceHref)}">Source</a></div>
</header>
${tabs}
<section class="recipe-info-grid">
  <article><p class="eyebrow">Composition</p><h2>Public symbols</h2><p>${component.values.map((value) => `<code>${escapeHtml(value)}</code>`).join(' ')}</p><p>Types: ${component.types.map((value) => `<code>${escapeHtml(value)}</code>`).join(' ') || 'No separately exported public types.'}</p></article>
  <article><p class="eyebrow">Ownership boundary</p><h2>Component source, not app state.</h2><p>BeeUI owns reusable UI behavior and semantics. Networking, routing, persistence, business validation, and domain side effects stay in your application.</p></article>
</section>
${related ? `<section class="recipe-related"><p class="eyebrow">Used in production patterns</p><h2>See this primitive in context.</h2><ul>${related}</ul></section>` : ''}
</main>`;
  return {
    html: documentShell({ contract, title: `${component.title} recipe — BeeUI`, description: component.purpose, route, body }),
    route,
    title: `${component.title} recipe — BeeUI`,
    description: component.purpose,
    relativePath: `examples/components/${component.name}/index.html`,
  };
}

function compositionLinks(pattern, components) {
  return pattern.beeuiComponents.map((symbol) => {
    const owner = components.find((component) => component.values.includes(symbol));
    if (!owner) return `<code>${escapeHtml(symbol)}</code>`;
    return `<a href="/examples/components/${owner.name}/"><code>${escapeHtml(symbol)}</code></a>`;
  }).join(' ');
}

function renderPatternRecipe({ contract, pattern, components, rootDir }) {
  const route = `/examples/patterns/${pattern.pack}/${pattern.slug}/`;
  const absoluteSource = path.join(rootDir, pattern.source);
  const source = fs.readFileSync(absoluteSource, 'utf8');
  const sourceHref = githubBlobHref(pattern.source);
  const preview = `<div class="live-preview-card"><div class="live-preview-head"><div><p class="eyebrow">Live production pattern</p><h2>${escapeHtml(pattern.title)}</h2></div>${platformBadges()}</div><iframe title="${escapeHtml(pattern.title)} production pattern preview" src="${escapeHtml(pattern.showcaseHref)}" loading="lazy"></iframe><p class="preview-note">The preview is the actual Pattern Gallery route and source below is the canonical screen composition.</p><div class="examples-actions"><a class="button secondary" href="${escapeHtml(pattern.showcaseHref)}">Open in Showcase</a><a class="text-link" href="${escapeHtml(pattern.route)}">Pattern docs</a></div></div>`;
  const code = codePanel({ source, sourceHref, id: `pattern-source-${pattern.pack}-${pattern.slug}` });
  const platform = `<div class="platform-panel"><article><p class="eyebrow">Responsive</p><h3>${escapeHtml(pattern.responsive)}</h3><p>Responsive behavior belongs to the canonical pattern contract and source rather than a docs-only clone.</p></article><article><p class="eyebrow">Application layer</p><h3>Caller owned</h3><p>${escapeHtml(pattern.excluded)}</p></article></div>`;
  const tabs = renderTabs({ slug: `pattern-${pattern.pack}-${pattern.slug}`, preview, code, platform });
  const callbacks = pattern.callbacks.length ? pattern.callbacks.map((name) => `<code>${escapeHtml(name)}</code>`).join(' ') : 'No named callbacks declared.';
  const body = `<main id="main" class="shell recipe-main">
<nav class="recipe-breadcrumb" aria-label="Breadcrumb"><a href="/examples/">Examples</a><span aria-hidden="true">/</span><span>Patterns</span><span aria-hidden="true">/</span><span>${escapeHtml(pattern.pack)}</span><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(pattern.title)}</span></nav>
<header class="recipe-header">
  <p class="eyebrow">${escapeHtml(pattern.pack)} production pattern</p>
  <h1>${escapeHtml(pattern.title)}</h1>
  <p>${escapeHtml(pattern.purpose)}</p>
  <div class="examples-actions"><a class="button primary" href="${escapeHtml(pattern.showcaseHref)}">Open in Showcase</a><a class="button secondary" href="${escapeHtml(pattern.route)}">Pattern docs</a><a class="text-link" href="${escapeHtml(pattern.sourceHref)}">Source</a></div>
</header>
${tabs}
<section class="recipe-info-grid">
  <article><p class="eyebrow">Composition</p><h2>Principal BeeUI exports</h2><div class="composition-links">${compositionLinks(pattern, components)}</div><p>Each linked symbol opens its component preview-and-code recipe.</p></article>
  <article><p class="eyebrow">Application boundary</p><h2>Intentionally excluded</h2><p>${escapeHtml(pattern.excluded)}</p><p>Caller contract: ${pattern.propsType ? `<code>${escapeHtml(pattern.propsType)}</code>` : 'caller-owned props'} · ${callbacks}</p></article>
</section>
<section class="recipe-related"><p class="eyebrow">Adapt safely</p><h2>Copy the composition, keep app ownership explicit.</h2><p>This screen source is a production composition recipe. Fetching, persistence, routing, authentication/business rules, and backend side effects stay in the consuming application.</p><div class="examples-actions"><a class="button secondary" href="/docs/responsive/">Responsive contract</a><a class="button secondary" href="/docs/accessibility/">Accessibility contract</a><a class="button secondary" href="/docs/cli/">Source ownership</a></div></section>
</main>`;

  return {
    html: documentShell({ contract, title: `${pattern.title} recipe — BeeUI`, description: pattern.purpose, route, body }),
    route,
    title: `${pattern.title} recipe — BeeUI`,
    description: pattern.purpose,
    relativePath: `examples/patterns/${pattern.pack}/${pattern.slug}/index.html`,
  };
}

function renderStarterPage({ contract, starter }) {
  const route = `/examples/starters/${starter.slug}/`;
  const sourceHref = githubTreeHref(starter.path);
  const commandSource = starter.commands.join('\n');
  const body = `<main id="main" class="shell recipe-main">
<nav class="recipe-breadcrumb" aria-label="Breadcrumb"><a href="/examples/">Examples</a><span aria-hidden="true">/</span><span>Starters</span><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(starter.name)}</span></nav>
<header class="recipe-header">
  <p class="eyebrow">Starter app · ${escapeHtml(starter.model)}</p>
  <h1>${escapeHtml(starter.name)}</h1>
  <p>${escapeHtml(starter.purpose)}</p>
  <div class="examples-actions"><a class="button primary" href="${escapeHtml(sourceHref)}">View source</a><a class="button secondary" href="${escapeHtml(starter.onboarding)}">Onboarding guide</a></div>
</header>
<section class="starter-command-panel">
  <div class="code-toolbar"><div><p class="eyebrow">Repository-local run path</p><p>Build BeeUI packages first, then run the isolated consumer.</p></div><button type="button" class="copy-button" data-copy-target="starter-${escapeHtml(starter.slug)}">Copy commands</button></div>
  <pre class="recipe-code"><code id="starter-${escapeHtml(starter.slug)}">${escapeHtml(commandSource)}</code></pre>
</section>
<section class="recipe-info-grid">
  <article><p class="eyebrow">What it proves</p><h2>No monorepo shortcut.</h2><p>The starter installs/builds through the intended package or source-ownership boundary instead of silently resolving private workspace internals.</p></article>
  <article><p class="eyebrow">Distribution truth</p><h2>Still unpublished.</h2><p>Public npm/CLI distribution is not implied. Repository examples use packed package artifacts or committed source ownership until the owner-gated publication step occurs.</p></article>
</section>
</main>`;
  return {
    html: documentShell({ contract, title: `${starter.name} — BeeUI examples`, description: starter.purpose, route, body }),
    route,
    title: `${starter.name} — BeeUI examples`,
    description: starter.purpose,
    relativePath: `examples/starters/${starter.slug}/index.html`,
  };
}

function writePage(outDir, page) {
  const target = path.join(outDir, page.relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, page.html);
}

export function buildPublicDiscovery({ rootDir = ROOT_DIR, outDir = path.join(rootDir, 'web/dist'), environment } = {}) {
  const contract = buildPublicSiteContract(rootDir, { environment });
  const components = buildPublicComponentManifest(rootDir);
  const patterns = buildPublicPatternManifest(rootDir);
  const featured = resolveFeatured(components, patterns);
  const pages = [];

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'web/site/site.css'), path.join(outDir, 'assets/site.css'));
  fs.copyFileSync(path.join(rootDir, 'web/site/examples.css'), path.join(outDir, 'assets/examples.css'));
  fs.copyFileSync(path.join(rootDir, 'web/site/examples.js'), path.join(outDir, 'assets/examples.js'));

  const hub = {
    html: renderHub({ contract, components, patterns, featured }),
    route: '/examples/',
    title: 'BeeUI examples — live recipes, patterns and starters',
    description: `Browse ${components.length} source-equal component recipes, ${patterns.length} production patterns, and isolated BeeUI consumer starters.`,
    relativePath: 'examples/index.html',
  };
  writePage(outDir, hub);
  pages.push(hub);

  for (const component of components) {
    const page = renderComponentRecipe({ contract, component, patterns, rootDir });
    writePage(outDir, page);
    pages.push(page);
  }
  for (const pattern of patterns) {
    const page = renderPatternRecipe({ contract, pattern, components, rootDir });
    writePage(outDir, page);
    pages.push(page);
  }
  for (const starter of STARTERS) {
    const page = renderStarterPage({ contract, starter });
    writePage(outDir, page);
    pages.push(page);
  }

  for (const file of LLM_FILES) {
    fs.copyFileSync(path.join(rootDir, file), path.join(outDir, file));
  }

  return {
    examples: STARTERS,
    starters: STARTERS,
    components,
    patterns,
    featured,
    pages: pages.map(({ html: _html, ...page }) => page),
    llmFiles: LLM_FILES,
    outDir,
  };
}

function main() {
  const result = buildPublicDiscovery();
  console.log(`Built ${result.components.length} component recipes, ${result.patterns.length} pattern recipes, ${result.starters.length} starters and LLM assets into ${path.relative(ROOT_DIR, result.outDir)}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
