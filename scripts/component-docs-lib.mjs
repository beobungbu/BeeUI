#!/usr/bin/env node

// Shared derivation helpers for the per-component documentation contract (#221),
// the executable-example check (#222), and the production pattern library (#223).
//
// Every fact an agent could get wrong by hand is DERIVED here from canonical
// sources so the generated docs and their checks cannot silently drift from the
// real surface:
//   - the public component inventory, source paths, registry dependencies and
//     peer dependencies come from registry/registry.json;
//   - the exported runtime symbols per component come from packages/ui/src/index.ts;
//   - "used in" executable examples come from scanning the @beemvp/beeui-showcase app for
//     real imports of each component's exported symbols.
//
// The generators (generate-component-reference.mjs, generate-pattern-library.mjs)
// and the checks import from here; the unit tests import the pure helpers.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseBarrelExports } from './generate-llms-txt.mjs';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readText(relPath, rootDir = ROOT_DIR) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

export function readJson(relPath, rootDir = ROOT_DIR) {
  return JSON.parse(readText(relPath, rootDir));
}

// Registry-relative source directory of the @beemvp/beeui-showcase app that holds the
// executable, typechecked fixtures the docs cite as canonical examples.
export const SHOWCASE_DIR = 'apps/showcase';

// The four production pattern packs, each a directory under apps/showcase/patterns.
// The screen inventory itself is derived from the filesystem (not hardcoded here),
// so a new/removed screen changes the docs and fails the freshness check.
export const PATTERN_PACKS = [
  { id: 'auth', title: 'Authentication + Onboarding' },
  { id: 'dashboard-finance', title: 'Dashboard + Finance' },
  { id: 'commerce-social', title: 'Commerce + Social' },
  { id: 'account-settings', title: 'Account + Settings' },
];

// Component names (or the registry deps they pull in) that require the shared
// BeeUIProvider overlay/toast runtime to be mounted above them at runtime.
const OVERLAY_RUNTIME_MARKERS = new Set([
  'overlay-runtime',
  'core-overlay',
  'toast',
  'popover',
  'dialog',
  'dropdown-menu',
  'select',
  'sheet',
  'tooltip',
  'calendar',
]);

// safe-area exports BeeUIProvider itself; it is the provider root, not a consumer.
const PROVIDER_ROOT_COMPONENTS = new Set(['safe-area']);

export function isProviderRequired(name, registryDependencies) {
  if (PROVIDER_ROOT_COMPONENTS.has(name)) return false;
  if (OVERLAY_RUNTIME_MARKERS.has(name)) return true;
  return (registryDependencies ?? []).some((dep) => OVERLAY_RUNTIME_MARKERS.has(dep));
}

// The public component inventory, joined against the @beemvp/beeui-ui barrel. Throws if
// the registry and barrel have drifted (same invariant generate-llms-txt enforces),
// so a public component that lost its export cannot silently produce empty docs.
export function getPublicComponents(rootDir = ROOT_DIR) {
  const registry = readJson('registry/registry.json', rootDir);
  const barrel = parseBarrelExports(readText('packages/ui/src/index.ts', rootDir));

  return registry.items
    .filter((item) => item.public && item.type === 'component')
    .map((item) => {
      const specifier = `./components/${item.name}`;
      const exports = barrel.get(specifier);
      if (!exports) {
        throw new Error(
          `registry item "${item.name}" is public but @beemvp/beeui-ui barrel has no ` +
            `\`export … from '${specifier}'\` — registry.json and index.ts have drifted.`,
        );
      }
      const primaryFile = item.files.find((file) => !file.source.endsWith('.d.ts')) ?? item.files[0];
      const registryDependencies = item.registryDependencies ?? [];
      return {
        name: item.name,
        values: [...exports.values].sort((a, b) => a.localeCompare(b)),
        types: [...exports.types].sort((a, b) => a.localeCompare(b)),
        source: primaryFile.source,
        allSources: item.files.map((file) => file.source),
        peerDependencies: Object.keys(item.peerDependencies ?? {}).sort((a, b) => a.localeCompare(b)),
        registryDependencies: [...registryDependencies].sort((a, b) => a.localeCompare(b)),
        providerRequired: isProviderRequired(item.name, registryDependencies),
        cliAdd: `pnpm beeui -- add ${item.name}`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// --- @beemvp/beeui-ui import scanning (shared by example check + usage index) -------

// Extracts the set of symbols imported from '@beemvp/beeui-ui' in a source file.
// Handles `import { A, B, type C } from '@beemvp/beeui-ui';` across multiple lines.
export function extractBeeuiImports(source) {
  const symbols = new Set();
  const re = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s*from\s*['"]@beemvp\/beeui-ui['"]/g;
  let match;
  while ((match = re.exec(source))) {
    for (const raw of match[1].split(',')) {
      const symbol = raw.trim().replace(/^type\s+/, '');
      if (symbol) symbols.add(symbol);
    }
  }
  return symbols;
}

// Recursively lists .ts/.tsx files under a directory (skips node_modules/.expo/etc).
export function listSourceFiles(absDir) {
  if (!fs.existsSync(absDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(abs));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

// Showcase sources that only route to an example rather than being one. They import
// public symbols for their own chrome, so they would otherwise be cited (and, being
// alphabetically first under component-gallery/, preferred) as a component's canonical
// executable example. Documentation must cite the fixture, never the router.
export const SHOWCASE_TARGET_ROUTERS = new Set([
  'apps/showcase/component-gallery/addressable-component-gallery.tsx',
]);

// Builds a reverse index from an exported symbol to the repo-relative showcase
// files that import it. Used to cite REAL, typechecked example fixtures per
// component instead of hand-written snippets that can rot.
export function buildShowcaseUsageIndex(rootDir = ROOT_DIR) {
  const showcaseAbs = path.join(rootDir, SHOWCASE_DIR);
  const bySymbol = new Map();
  for (const abs of listSourceFiles(showcaseAbs)) {
    const rel = path.relative(rootDir, abs).split(path.sep).join('/');
    if (SHOWCASE_TARGET_ROUTERS.has(rel)) continue;
    const symbols = extractBeeuiImports(fs.readFileSync(abs, 'utf8'));
    for (const symbol of symbols) {
      if (!bySymbol.has(symbol)) bySymbol.set(symbol, new Set());
      bySymbol.get(symbol).add(rel);
    }
  }
  return bySymbol;
}

// The showcase files that use ANY of a component's exported runtime symbols,
// sorted for deterministic output.
export function usageForComponent(component, usageIndex) {
  const files = new Set();
  for (const symbol of component.values) {
    const hits = usageIndex.get(symbol);
    if (hits) for (const file of hits) files.add(file);
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

// --- Pattern gallery derivation ---------------------------------------------

// Discovers the production pattern screens on disk: one entry per
// apps/showcase/patterns/<pack>/screens/<screen>.tsx file.
export function getPatternScreens(rootDir = ROOT_DIR) {
  const screens = [];
  for (const pack of PATTERN_PACKS) {
    const screensAbs = path.join(rootDir, 'apps/showcase/patterns', pack.id, 'screens');
    if (!fs.existsSync(screensAbs)) continue;
    for (const file of fs.readdirSync(screensAbs).sort((a, b) => a.localeCompare(b))) {
      if (!file.endsWith('.tsx')) continue;
      const rel = `apps/showcase/patterns/${pack.id}/screens/${file}`;
      const source = fs.readFileSync(path.join(screensAbs, file), 'utf8');
      screens.push({
        pack: pack.id,
        packTitle: pack.title,
        file: rel,
        slug: file.replace(/\.tsx$/, ''),
        componentName: extractExportedComponentName(source, file),
        propsType: extractExportedPropsType(source),
        beeuiComponents: [...extractBeeuiImports(source)].sort((a, b) => a.localeCompare(b)),
        callbacks: extractPropCallbacks(source),
      });
    }
  }
  return screens;
}

// The exported screen component name (`export function XScreen(...)`).
export function extractExportedComponentName(source, fallbackFile = '') {
  const match = source.match(/export\s+function\s+([A-Za-z0-9_]+)\s*\(/);
  if (match) return match[1];
  const named = source.match(/export\s+const\s+([A-Za-z0-9_]+)\s*[:=]/);
  return named ? named[1] : fallbackFile.replace(/\.tsx$/, '');
}

// The exported props type name (`export type XScreenProps = {`).
export function extractExportedPropsType(source) {
  const match = source.match(/export\s+type\s+([A-Za-z0-9_]+Props)\s*=/);
  return match ? match[1] : null;
}

// Callback prop names declared on the screen's props type (the app-owned
// ownership boundary: everything the screen delegates back to the caller).
export function extractPropCallbacks(source) {
  const typeMatch = source.match(/export\s+type\s+[A-Za-z0-9_]+Props\s*=\s*\{([\s\S]*?)\n\};/);
  const body = typeMatch ? typeMatch[1] : source;
  const callbacks = new Set();
  const re = /\b(on[A-Z][A-Za-z0-9_]*)\s*[?]?\s*:/g;
  let match;
  while ((match = re.exec(body))) callbacks.add(match[1]);
  return [...callbacks].sort((a, b) => a.localeCompare(b));
}
