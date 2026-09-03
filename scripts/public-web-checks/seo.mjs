import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildPublicSeo } from '../build-public-seo.mjs';
import { buildPublicSiteContract } from '../public-site-contract-lib.mjs';

export async function collectViolations(rootDir) {
  const violations = [];
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-seo-'));
  try {
    const contract = buildPublicSiteContract(rootDir);
    const { routes, discovery } = buildPublicSeo({ rootDir, outDir });
    const landing = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    const examples = fs.readFileSync(path.join(outDir, 'examples/index.html'), 'utf8');
    const changelog = fs.readFileSync(path.join(outDir, 'changelog/index.html'), 'utf8');
    const sitemap = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
    const robots = fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
    const og = fs.readFileSync(path.join(outDir, 'assets/og-beeui.svg'), 'utf8');

    const representativeComponent = discovery.components.find((candidate) => candidate.name === 'dialog') ?? discovery.components[0];
    const representativePattern = discovery.patterns.find((candidate) => candidate.slug === 'sign-in-screen') ?? discovery.patterns[0];
    const componentExample = fs.readFileSync(path.join(outDir, 'examples/components', representativeComponent.name, 'index.html'), 'utf8');
    const patternExample = fs.readFileSync(path.join(outDir, 'examples/patterns', representativePattern.pack, representativePattern.slug, 'index.html'), 'utf8');

    for (const [name, html] of [
      ['landing', landing],
      ['examples', examples],
      ['component example', componentExample],
      ['pattern example', patternExample],
      ['changelog', changelog],
    ]) {
      for (const token of ['rel="canonical"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'name="twitter:card"']) {
        if (!html.includes(token)) violations.push(`${name} metadata missing ${token}`);
      }
      if (/workers\.dev/i.test(html)) violations.push(`${name} contains workers.dev canonical/metadata leakage.`);
    }

    if (!landing.includes('application/ld+json') || !landing.includes('SoftwareSourceCode')) {
      violations.push('landing is missing restrained SoftwareSourceCode JSON-LD.');
    }
    if (!changelog.includes('Source-driven history') || !changelog.includes('<h2>Unreleased</h2>')) {
      violations.push('public changelog no longer reflects canonical CHANGELOG.md content.');
    }
    if (!robots.includes(`Sitemap: ${contract.origin}/sitemap.xml`)) violations.push('robots.txt sitemap origin drifted from public-site contract.');
    if (sitemap.includes('/llms.txt') || sitemap.includes('/api/')) violations.push('non-index route class leaked into sitemap.');
    for (const required of ['/', '/docs/', '/docs/components/', '/docs/patterns/', '/examples/', '/changelog/', '/showcase/', '/demo/']) {
      if (!routes.includes(required)) violations.push(`sitemap route inventory missing ${required}`);
    }
    for (const page of discovery.pages) {
      if (!routes.includes(page.route)) violations.push(`sitemap route inventory missing generated example ${page.route}`);
      if (!sitemap.includes(`${contract.origin}${page.route}`)) violations.push(`sitemap XML missing generated example ${page.route}`);
    }
    if (!og.includes('width="1200"') || !og.includes('height="630"')) violations.push('shared OG asset must remain 1200x630.');

    const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
    for (const generatedDir of [
      'apps/docs/src/content/docs/components/reference/',
      'apps/docs/src/content/docs/patterns/reference/',
    ]) {
      if (!gitignore.includes(generatedDir)) violations.push(`generated docs output is not ignored: ${generatedDir}`);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  return violations;
}
