import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildPublicDiscovery } from '../build-public-discovery.mjs';
import { buildPublicLanding, renderPublicLanding } from '../build-public-landing.mjs';
import { renderRobotsTxt } from '../build-public-seo.mjs';
import { renderWorkerHeaders } from '../build-public-worker.mjs';
import { collectPublicWebViolations } from '../check-public-web.mjs';
import { buildPublicSiteContract } from '../public-site-contract-lib.mjs';
import { buildPublicComponentManifest, generatePublicComponentPages } from '../public-component-reference.mjs';
import { buildPreviewDescriptor, enhanceGeneratedPublicComponentPages } from '../public-component-previews.mjs';
import { buildPublicPatternManifest, generatePublicPatternPages } from '../public-pattern-reference.mjs';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const htmlHref = (value) => value.replaceAll('&', '&amp;');

test('current repository satisfies the aggregate public Web contract', async () => {
  assert.deepEqual(await collectPublicWebViolations(rootDir), []);
});

test('environment SEO and Worker headers fail closed outside production', () => {
  const development = buildPublicSiteContract(rootDir, { environment: 'development' });
  const staging = buildPublicSiteContract(rootDir, { environment: 'staging' });
  const production = buildPublicSiteContract(rootDir, { environment: 'production' });

  assert.match(renderRobotsTxt(development), /Disallow: \/\n/u);
  assert.doesNotMatch(renderRobotsTxt(development), /Allow: \/\n/u);
  assert.match(renderRobotsTxt(staging), /beeui-stg\.beemvp\.com\/sitemap\.xml/u);
  assert.match(renderWorkerHeaders(development), /X-Robots-Tag: noindex, nofollow/u);
  assert.match(renderWorkerHeaders(staging), /X-Robots-Tag: noindex, nofollow/u);

  assert.match(renderRobotsTxt(production), /Allow: \/\n/u);
  assert.match(renderRobotsTxt(production), /Disallow: \/api\//u);
  assert.match(renderRobotsTxt(production), /beeui\.beemvp\.com\/sitemap\.xml/u);
  const productionHeaders = renderWorkerHeaders(production).split('https://:version.:subdomain.workers.dev/*')[0];
  assert.doesNotMatch(productionHeaders, /X-Robots-Tag: noindex/u);
});

test('generated Examples canonical follows the explicit environment', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-examples-origin-'));
  try {
    buildPublicDiscovery({ rootDir, outDir, environment: 'production' });
    const productionHub = fs.readFileSync(path.join(outDir, 'examples/index.html'), 'utf8');
    assert.match(productionHub, /rel="canonical" href="https:\/\/beeui\.beemvp\.com\/examples\/"/u);
    assert.doesNotMatch(productionHub, /beeui-dev\.beemvp\.com/u);

    buildPublicDiscovery({ rootDir, outDir, environment: 'staging' });
    const stagingHub = fs.readFileSync(path.join(outDir, 'examples/index.html'), 'utf8');
    assert.match(stagingHub, /rel="canonical" href="https:\/\/beeui-stg\.beemvp\.com\/examples\/"/u);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('landing build writes deterministic HTML and CSS without unresolved placeholders', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-landing-'));
  buildPublicLanding({ rootDir, outDir });
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(outDir, 'assets/site.css'), 'utf8');
  assert.equal(/\{\{[A-Z0-9_]+\}\}/.test(html), false);
  assert.match(html, /BeeUI/);
  assert.match(css, /prefers-reduced-motion/);
});

test('landing derives publication/version truth from canonical repository state', () => {
  const { html, contract, publicationLabel } = renderPublicLanding(rootDir);
  assert.equal(contract.buildTruth.publication.published, false);
  assert.equal(publicationLabel, 'Unpublished');
  assert.match(html, new RegExp(contract.buildTruth.version.replaceAll('.', '\\.')));
});

test('public component generator emits one reference page per stable public family', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-components-'));
  const manifest = generatePublicComponentPages({ rootDir, outDir });
  assert.equal(manifest.length, buildPublicComponentManifest(rootDir).length);
  assert.equal(fs.existsSync(path.join(outDir, 'index.md')), true);
  for (const component of manifest) {
    const page = fs.readFileSync(path.join(outDir, `${component.name}.md`), 'utf8');
    // Starlight renders the frontmatter title as the page's h1. A body `# Title` on top of
    // that shipped two h1 elements on every generated page; this asserted that shape as
    // correct. The title must appear in frontmatter and nowhere as a body heading.
    assert.match(page, new RegExp(`^title: "${component.title}"$`, 'm'));
    assert.equal(/^# /mu.test(page), false, `${component.name} must not repeat its title as a body h1`);
    assert.match(page, /## Accessibility/);
    assert.match(page, /## Executable examples/);
    assert.match(page, /## Limitations/);
  }
});

test('rich component pages lazy-load real Showcase and display exact typechecked fixture source', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-component-previews-'));
  const manifest = generatePublicComponentPages({ rootDir, outDir });
  enhanceGeneratedPublicComponentPages({ rootDir, outDir });
  for (const component of manifest) {
    const page = fs.readFileSync(path.join(outDir, `${component.name}.md`), 'utf8');
    const descriptor = buildPreviewDescriptor(component, rootDir);
    assert.match(page, /## Live Web preview/);
    assert.match(page, /loading="lazy"/);
    // A small fixture is shown whole; a large one is excerpted to the regions using this family.
    // Either way the page must carry byte-identical source, and an excerpt must name the exact
    // lines it came from — that citation is the whole basis for calling it executable source.
    if (descriptor.excerpt.whole) {
      assert.ok(page.includes(descriptor.source), `${component.name} lost its whole-fixture source`);
    } else {
      const fixtureLines = descriptor.source.split('\n');
      assert.ok(descriptor.excerpt.excerpts.length > 0, `${component.name} was excerpted to nothing`);
      assert.ok(!page.includes(descriptor.source), `${component.name} still inlines the whole fixture`);
      for (const part of descriptor.excerpt.excerpts) {
        assert.equal(fixtureLines.slice(part.start - 1, part.end).join('\n'), part.text);
        assert.ok(page.includes(part.text), `${component.name} excerpt ${part.start}-${part.end} is not on the page`);
        assert.ok(page.includes(`#L${part.start}-L${part.end}`), `${component.name} excerpt is not linked to its lines`);
      }
    }
    assert.ok(page.includes(descriptor.showcaseHref));
    assert.match(page, /### Composition anatomy/);
  }
});

test('public pattern generator emits one detail page per canonical Pattern Gallery screen', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-patterns-'));
  const manifest = generatePublicPatternPages({ rootDir, outDir });
  assert.equal(manifest.length, buildPublicPatternManifest(rootDir).length);
  assert.equal(fs.existsSync(path.join(outDir, 'index.md')), true);
  for (const pattern of manifest) {
    const page = fs.readFileSync(path.join(outDir, pattern.pack, `${pattern.slug}.md`), 'utf8');
    assert.match(page, /## Preview/);
    assert.match(page, /## State and callback contract/);
    assert.match(page, /## Responsive contract/);
    assert.match(page, /## Accessibility/);
    assert.match(page, /## Application ownership boundary/);
    assert.ok(page.includes(pattern.showcaseHref));
    assert.ok(page.includes(pattern.sourceHref));
  }
});

test('examples hub materializes every canonical component and pattern as preview-and-code recipes', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-examples-hub-'));
  try {
    const result = buildPublicDiscovery({ rootDir, outDir });
    const components = buildPublicComponentManifest(rootDir);
    const patterns = buildPublicPatternManifest(rootDir);
    assert.equal(result.components.length, components.length);
    assert.equal(result.patterns.length, patterns.length);
    // #461 names the inventory the hub must represent, so assert that contract rather than a
    // count — a count silently accepts the wrong entry appearing and the right one vanishing.
    assert.deepEqual(
      result.starters.map((entry) => entry.slug).sort(),
      ['agent-reference-app', 'bare-rn-consumer', 'expo-package-consumer', 'production-demo', 'source-ownership-starter', 'web-consumer'],
    );
    // The starter-versus-demo distinction is the one Gate E42 is explicit about.
    assert.equal(result.starters.filter((entry) => entry.type === 'starter').length, 4);
    assert.equal(result.starters.find((entry) => entry.slug === 'production-demo').type, 'reference-app');
    assert.ok(result.featured.length >= 10);

    const hub = fs.readFileSync(path.join(outDir, 'examples/index.html'), 'utf8');
    assert.match(hub, /data-example-search/);
    assert.match(hub, new RegExp(`${components.length}[^<]*<\/strong><span>component recipes`));
    assert.match(hub, new RegExp(`${patterns.length}[^<]*<\/strong><span>production patterns`));

    const component = components.find((candidate) => candidate.name === 'dialog') ?? components[0];
    const componentPage = fs.readFileSync(path.join(outDir, 'examples/components', component.name, 'index.html'), 'utf8');
    assert.match(componentPage, /role="tablist"/);
    assert.match(componentPage, /data-copy-target=/);
    assert.match(componentPage, /Live Web preview/);
    assert.ok(componentPage.includes(htmlHref(component.showcaseHref)));

    const pattern = patterns.find((candidate) => candidate.slug === 'sign-in-screen') ?? patterns[0];
    const patternPage = fs.readFileSync(path.join(outDir, 'examples/patterns', pattern.pack, pattern.slug, 'index.html'), 'utf8');
    assert.match(patternPage, /Principal BeeUI exports/);
    assert.match(patternPage, /data-copy-target=/);
    assert.ok(patternPage.includes(htmlHref(pattern.showcaseHref)));
    assert.ok(patternPage.includes(pattern.sourceHref));

    assert.equal(fs.existsSync(path.join(outDir, 'assets/examples.css')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'assets/examples.js')), true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
