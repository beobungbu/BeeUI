import fs from 'node:fs';
import path from 'node:path';

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

  if (app.expo.version !== root.version) violations.push(`Showcase public build identity ${app.expo.version} must equal workspace version ${root.version}.`);
  if (!pkg.scripts?.['build:web:public']?.includes('BEEUI_PUBLIC_BASE_URL=/showcase')) violations.push('Showcase lacks a dedicated /showcase public export script.');
  if (!pkg.scripts?.['build:web:public']?.includes('EXPO_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD)')) violations.push('Showcase public export does not stamp exact Git SHA.');
  if (!dynamicConfig.includes('baseUrl')) violations.push('Expo dynamic config does not forward public baseUrl.');
  if (!appSource.includes('<PublicShowcaseRouter />')) violations.push('Showcase app does not mount the public query router.');
  if (!core.includes("replace(/-screen$/, '')")) violations.push('Pattern source-slug to runtime-id normalization is missing.');
  if (!router.includes("findPatternScreen(domain, screenId)")) violations.push('Pattern deep links are not resolved against the real Pattern Catalog.');
  if (!router.includes('<ComponentGallery')) violations.push('Component deep links no longer reuse the real Component Gallery.');

  for (const component of buildPublicComponentManifest(rootDir)) {
    if (!component.showcaseHref.startsWith('/showcase/?component=')) violations.push(`${component.name}: generated component preview escaped Showcase query contract.`);
  }
  for (const pattern of buildPublicPatternManifest(rootDir)) {
    if (!pattern.showcaseHref.startsWith('/showcase/?pattern=')) violations.push(`${pattern.pack}/${pattern.slug}: generated pattern preview escaped Showcase query contract.`);
  }
  return violations;
}
