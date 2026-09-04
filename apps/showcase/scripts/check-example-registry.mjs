#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROOT_DIR,
  getPatternScreens,
  getPublicComponents,
  buildShowcaseUsageIndex,
  usageForComponent,
} from '../../../scripts/component-docs-lib.mjs';

const REGISTRY_SOURCE = 'apps/showcase/example-registry.ts';

function read(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function componentFixtureEntries(source) {
  const block = /const COMPONENT_FIXTURES:[\s\S]*?= \[([\s\S]*?)\n\];/u.exec(source)?.[1];
  if (!block) throw new Error('example-registry.ts is missing COMPONENT_FIXTURES.');
  return [...block.matchAll(/\['([^']+)',\s*([^\]]+)\]/gu)].map((match) => ({
    ownerId: match[1],
    rawSource: match[2].trim(),
  }));
}

function resolvedFixturePath(entry) {
  if (entry.rawSource === 'MAIN_GALLERY') return 'apps/showcase/component-gallery/component-gallery.tsx';
  if (entry.rawSource === 'PUBLIC_DOC_FIXTURES') return 'apps/showcase/component-gallery/public-doc-fixtures.tsx';
  const literal = /^'([^']+)'$/u.exec(entry.rawSource);
  return literal?.[1] ?? null;
}

export function validateExampleRegistry() {
  const source = read(REGISTRY_SOURCE);
  const entries = componentFixtureEntries(source);
  const violations = [];
  const canonical = getPublicComponents(ROOT_DIR);
  const canonicalIds = canonical.map((component) => component.name).sort((a, b) => a.localeCompare(b));
  const registryIds = entries.map((entry) => entry.ownerId).sort((a, b) => a.localeCompare(b));

  if (new Set(registryIds).size !== registryIds.length) violations.push('COMPONENT_FIXTURES contains duplicate owner ids.');
  const missing = canonicalIds.filter((id) => !registryIds.includes(id));
  const extra = registryIds.filter((id) => !canonicalIds.includes(id));
  if (missing.length) violations.push(`public components missing Example Registry entries: ${missing.join(', ')}.`);
  if (extra.length) violations.push(`Example Registry contains non-public component ids: ${extra.join(', ')}.`);

  const usageIndex = buildShowcaseUsageIndex(ROOT_DIR);
  for (const entry of entries) {
    const fixture = resolvedFixturePath(entry);
    if (!fixture || !fs.existsSync(path.join(ROOT_DIR, fixture))) {
      violations.push(`${entry.ownerId}: Example Registry fixture does not exist: ${fixture ?? entry.rawSource}.`);
      continue;
    }
    const component = canonical.find((candidate) => candidate.name === entry.ownerId);
    if (component && !usageForComponent(component, usageIndex).includes(fixture)) {
      violations.push(`${entry.ownerId}: ${fixture} is not a real Showcase usage of any public symbol in that family.`);
    }
  }

  const patternSources = getPatternScreens(ROOT_DIR);
  if (patternSources.length === 0) violations.push('canonical pattern screen inventory is empty.');
  for (const pattern of patternSources) {
    if (!fs.existsSync(path.join(ROOT_DIR, pattern.file))) violations.push(`pattern source is missing: ${pattern.file}.`);
  }

  const foundation = read('apps/docs/src/lib/foundation-contract.ts');
  if (!foundation.includes("params.set('surface', target.surface)") || !foundation.includes("params.set('id', target.id)")) {
    violations.push('Foundation docs URL builder no longer serializes canonical surface/id target identity.');
  }

  return violations;
}

const violations = validateExampleRegistry();
if (violations.length) {
  console.error('Showcase Example Registry contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Showcase Example Registry contract passed (${getPublicComponents(ROOT_DIR).length} public components + ${getPatternScreens(ROOT_DIR).length} pattern sources).`);
}
