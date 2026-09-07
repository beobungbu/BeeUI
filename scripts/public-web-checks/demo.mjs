import fs from 'node:fs';
import path from 'node:path';

export function collectViolations(rootDir) {
  const violations = [];
  const root = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const app = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps/demo/app.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps/demo/package.json'), 'utf8'));
  const config = fs.readFileSync(path.join(rootDir, 'apps/demo/app.config.js'), 'utf8');
  const detailRoute = fs.readFileSync(path.join(rootDir, 'apps/demo/app/(tabs)/records/[id]/index.tsx'), 'utf8');
  const webBar = fs.readFileSync(path.join(rootDir, 'apps/demo/src/shell/public-site-bar.web.tsx'), 'utf8');

  if (app.expo.version !== root.version) violations.push(`Demo public identity ${app.expo.version} must equal workspace version ${root.version}.`);
  const publicBuild = pkg.scripts?.['build:web:public'] ?? '';
  if (!publicBuild.includes('BEEUI_PUBLIC_BASE_URL=/demo')) violations.push('Demo public export lacks /demo baseUrl.');
  if (!publicBuild.includes('BEEUI_PUBLIC_STATIC=1')) violations.push('Demo public export is not static-route output.');
  if (!publicBuild.includes('EXPO_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD)')) violations.push('Demo public export lacks exact Git SHA stamping.');
  if (!config.includes("output: 'static'") || !config.includes('baseUrl')) violations.push('Demo dynamic config lacks static/baseUrl launch contract.');
  if (!detailRoute.includes('generateStaticParams') || !detailRoute.includes('getAllTickets()')) violations.push('Dynamic record routes are not generated from the canonical ticket fixture.');
  for (const pathName of ['/docs/reference-app/', '/showcase/', '/']) {
    if (!webBar.includes(`'${pathName}'`)) violations.push(`Demo public return bar is missing ${pathName}.`);
  }
  return violations;
}
