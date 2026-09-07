#!/usr/bin/env node

// Static, crawlable fallback content for the two runtime portals (#464, #465).
//
// /showcase/ and /demo/ are Expo web exports: a JS application shell and nothing else. They
// sit in the sitemap, so a crawler that does not execute JS — or anyone sharing a link into a
// context that renders no JS — reaches a page with no content at all. #465 asks for
// "non-JS/static fallback content sufficient for discovery and sharing"; #464 asks the same of
// the demo portal.
//
// This does NOT add routing to either app. #465 is explicit that the router-less Showcase
// architecture stays, and that stable public URLs come from #472's target contract rather than
// from application routes. The fallback is a <noscript> block injected at composition time,
// derived from the same manifests the docs pages use, so it cannot describe a component or
// pattern that does not exist.

import { buildPublicComponentManifest } from './public-component-reference.mjs';
import { buildPublicPatternManifest } from './public-pattern-reference.mjs';
import { ROOT_DIR } from './component-docs-lib.mjs';

export const SHOWCASE_FALLBACK_MARKER = 'data-beeui-static-fallback="showcase"';
export const DEMO_FALLBACK_MARKER = 'data-beeui-static-fallback="demo"';

// The demo's screens, matching apps/demo/app/(tabs). Kept here rather than derived because
// Expo Router file conventions are not a manifest, and demo.mjs already pins the route list
// it cares about; a mismatch surfaces there.
const DEMO_SCREENS = [
  ['Dashboard', 'Overview metrics composed from Stat, Card and layout primitives.'],
  ['Records', 'A filterable list with detail routes generated from the canonical ticket fixture.'],
  ['Schedule', 'Calendar and date/time surfaces in a real scheduling flow.'],
  ['Settings', 'Forms, switches and destructive-action confirmation.'],
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

export function renderShowcaseFallback({ rootDir = ROOT_DIR, identity } = {}) {
  const components = buildPublicComponentManifest(rootDir);
  const patterns = buildPublicPatternManifest(rootDir);

  const componentItems = components.map((component) =>
    `<a href="/docs/components/${escapeHtml(component.name)}/">${escapeHtml(component.title)}</a> — ${escapeHtml(component.purpose)}`);
  const patternItems = patterns.map((pattern) =>
    `<a href="${escapeHtml(pattern.route)}">${escapeHtml(pattern.title)}</a> — ${escapeHtml(pattern.purpose)}`);

  return [
    `<noscript ${SHOWCASE_FALLBACK_MARKER}>`,
    '<h1>BeeUI Showcase</h1>',
    '<p>The Showcase is the executable inspection surface for BeeUI: every public component, ' +
      'production pattern, theme and stress fixture, running for real rather than as a screenshot. ' +
      'It needs JavaScript to run. The catalog below is the same inventory it renders.</p>',
    `<p>Build ${escapeHtml(identity?.version ?? 'unknown')} · commit ${escapeHtml(identity?.commit ?? 'unknown')} · environment ${escapeHtml(identity?.environment ?? 'unknown')}.</p>`,
    `<h2>Components (${components.length})</h2>`,
    list(componentItems),
    `<h2>Production patterns (${patterns.length})</h2>`,
    list(patternItems),
    '<h2>Elsewhere</h2>',
    list([
      '<a href="/docs/components/">Component reference</a>',
      '<a href="/docs/patterns/">Pattern reference</a>',
      '<a href="/demo/">Production demo application</a>',
      '<a href="/docs/">Documentation</a>',
    ]),
    '</noscript>',
  ].join('\n');
}

export function renderDemoFallback({ identity } = {}) {
  return [
    `<noscript ${DEMO_FALLBACK_MARKER}>`,
    '<h1>BeeUI production demo</h1>',
    '<p>A routed product application built from BeeUI — not a component gallery. It exists to show ' +
      'that the components compose into a coherent multi-screen product, with routing, data and ' +
      'state owned by the application rather than by BeeUI. It needs JavaScript to run.</p>',
    `<p>Build ${escapeHtml(identity?.version ?? 'unknown')} · commit ${escapeHtml(identity?.commit ?? 'unknown')} · environment ${escapeHtml(identity?.environment ?? 'unknown')}.</p>`,
    '<h2>Screens</h2>',
    list(DEMO_SCREENS.map(([name, summary]) => `<strong>${escapeHtml(name)}</strong> — ${escapeHtml(summary)}`)),
    '<h2>Elsewhere</h2>',
    list([
      '<a href="/docs/reference-app/">What this demo proves</a>',
      '<a href="/docs/patterns/">The patterns it composes</a>',
      '<a href="/showcase/">Showcase — inspect components directly</a>',
      '<a href="/docs/">Documentation</a>',
    ]),
    '</noscript>',
  ].join('\n');
}

// Injection is deliberate rather than a template edit: both index.html files are Expo export
// output and are regenerated on every build, so anything written into them by hand is lost.
export function injectFallback(html, fallback, marker) {
  if (html.includes(marker)) return html;
  const bodyIndex = html.indexOf('<body');
  if (bodyIndex === -1) throw new Error('portal export has no <body> to attach the static fallback to');
  const insertAt = html.indexOf('>', bodyIndex) + 1;
  return `${html.slice(0, insertAt)}\n${fallback}\n${html.slice(insertAt)}`;
}
