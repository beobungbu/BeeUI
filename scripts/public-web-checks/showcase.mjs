import fs from 'node:fs';
import path from 'node:path';

import { showcaseHref } from '../../apps/showcase/showcase-target.ts';
import { buildPublicComponentManifest } from '../public-component-reference.mjs';
import { buildPublicPatternManifest } from '../public-pattern-reference.mjs';

export function collectViolations(rootDir) {
  const violations = [];
  const app = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps/showcase/app.json'), 'utf8'));
  const root = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps/showcase/package.json'), 'utf8'));
  const dynamicConfig = fs.readFileSync(path.join(rootDir, 'apps/showcase/app.config.js'), 'utf8');
  const router = fs.readFileSync(path.join(rootDir, 'apps/showcase/public-showcase-router.tsx'), 'utf8');
  const core = fs.readFileSync(path.join(rootDir, 'apps/showcase/public-route-core.ts'), 'utf8');
  const appSource = fs.readFileSync(path.join(rootDir, 'apps/showcase/App.tsx'), 'utf8');
  const showcaseRoot = fs.readFileSync(path.join(rootDir, 'apps/showcase/showcase-root.tsx'), 'utf8');

  if (app.expo.version !== root.version) violations.push(`Showcase public build identity ${app.expo.version} must equal workspace version ${root.version}.`);
  if (!pkg.scripts?.['build:web:public']?.includes('BEEUI_PUBLIC_BASE_URL=/showcase')) violations.push('Showcase lacks a dedicated /showcase public export script.');
  if (!pkg.scripts?.['build:web:public']?.includes('EXPO_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD)')) violations.push('Showcase public export does not stamp exact Git SHA.');
  if (!dynamicConfig.includes('baseUrl')) violations.push('Expo dynamic config does not forward public baseUrl.');
  if (!appSource.includes('<PublicShowcaseRouter />')) violations.push('Showcase app does not mount the public chrome/query wrapper.');
  if (!core.includes("replace(/-screen$/, '')")) violations.push('Legacy pattern source-slug normalization is missing during migration.');
  if (!router.includes('<ShowcaseRoot />')) violations.push('Public Showcase wrapper no longer delegates exact targets to ShowcaseRoot.');
  if (router.includes('ComponentDeepLink') || router.includes('PatternDeepLink')) violations.push('Public Showcase wrapper reintroduced a second exact-target routing authority.');
  if (!showcaseRoot.includes('resolveShowcaseTarget')) violations.push('ShowcaseRoot no longer resolves canonical exact targets.');
  if (!showcaseRoot.includes('subscribeToShowcaseHistory')) violations.push('ShowcaseRoot no longer follows browser Back/Forward target history.');

  for (const component of buildPublicComponentManifest(rootDir)) {
    const expected = showcaseHref({ surface: 'component', id: component.name, example: 'basic' });
    if (component.showcaseHref !== expected) violations.push(`${component.name}: generated component preview escaped canonical Showcase target contract.`);
  }
  for (const pattern of buildPublicPatternManifest(rootDir)) {
    const runtimeId = pattern.slug.replace(/-screen$/, '');
    const expected = `${showcaseHref({ surface: 'pattern', id: runtimeId })}&embed=1`;
    if (pattern.showcaseHref !== expected) violations.push(`${pattern.pack}/${pattern.slug}: generated pattern preview escaped canonical Showcase target contract.`);
  }
  return violations;
}
