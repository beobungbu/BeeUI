import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildPublicSeo } from '../build-public-seo.mjs';
import { buildPublicSiteContract } from '../public-site-contract-lib.mjs';
import { collectDistSocialCardViolations } from '../social-card-lib.mjs';

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
    // The second sitemap is emitted by Starlight's bundled @astrojs/sitemap, not by this repo. The
    // line could be deleted with the suite green, so it is asserted here; that the docs build
    // actually emits the file is asserted by the composer, which is the step that has the build.
    if (!robots.includes(`Sitemap: ${contract.origin}/docs/sitemap-index.xml`)) violations.push('robots.txt no longer declares the Starlight docs sitemap (/docs/sitemap-index.xml).');

    if (sitemap.includes('/llms.txt') || sitemap.includes('/api/')) violations.push('non-index route class leaked into sitemap.');
    for (const required of ['/', '/docs/', '/docs/components/', '/docs/patterns/', '/examples/', '/changelog/', '/showcase/', '/demo/']) {
      if (!routes.includes(required)) violations.push(`sitemap route inventory missing ${required}`);
    }
    for (const page of discovery.pages) {
      if (!routes.includes(page.route)) violations.push(`sitemap route inventory missing generated example ${page.route}`);
      if (!sitemap.includes(`${contract.origin}${page.route}`)) violations.push(`sitemap XML missing generated example ${page.route}`);
    }
    // Every page here declares `twitter:card=summary_large_image`. This asserts the other half of
    // that promise on the built output: an absolute `og:image` on this origin, the advertised
    // dimensions, and a real 1200x630 PNG at that path inside the build. Open Graph consumers do
    // not render SVG, so the card being a PNG is part of the contract, not a preference.
    violations.push(...collectDistSocialCardViolations({ distDir: outDir, routePrefix: '/', expectedOrigin: contract.origin }));

    // The portal is built by a different job, so its output is only here sometimes. When it is,
    // it is held to the same contract; scripts/check-docs-social-card.mjs is the gate that always
    // runs, from the docs build itself.
    const docsDist = path.join(rootDir, 'apps/docs/dist');
    if (fs.existsSync(docsDist)) {
      violations.push(...collectDistSocialCardViolations({ distDir: docsDist, routePrefix: contract.docsBase, label: 'apps/docs/dist/' }));
    }

    const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
    // Component and pattern pages are generated but deliberately tracked: docs:surface:check
    // runs before any docs build, so untracked pages would leave their surfaces counted as
    // planned and the coverage number would keep overstating what is written. Freshness is
    // gated by each generator's --check instead of by gitignore, so there is no generated
    // docs directory left to ignore.
    void gitignore;
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  return violations;
}
