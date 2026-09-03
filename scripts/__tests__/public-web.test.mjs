import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildPublicDiscovery } from '../build-public-discovery.mjs';
import { buildPublicLanding, renderPublicLanding } from '../build-public-landing.mjs';
import { collectPublicWebViolations } from '../check-public-web.mjs';
import { buildPublicComponentManifest, generatePublicComponentPages } from '../public-component-reference.mjs';
import { buildPreviewDescriptor, enhanceGeneratedPublicComponentPages } from '../public-component-previews.mjs';
import { buildPublicPatternManifest, generatePublicPatternPages } from '../public-pattern-reference.mjs';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);

test('current repository satisfies the aggregate public Web contract', async () => {
  assert.deepEqual(await collectPublicWebViolations(rootDir), []);
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
    assert.match(page, new RegExp(`^# ${component.title}`, 'm'));
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
    assert.ok(page.includes(descriptor.source));
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
    assert.equal(result.starters.length, 5);
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
    assert.ok(componentPage.includes(component.showcaseHref));

    const pattern = patterns.find((candidate) => candidate.slug === 'sign-in-screen') ?? patterns[0];
    const patternPage = fs.readFileSync(path.join(outDir, 'examples/patterns', pattern.pack, pattern.slug, 'index.html'), 'utf8');
    assert.match(patternPage, /Principal BeeUI exports/);
    assert.match(patternPage, /data-copy-target=/);
    assert.ok(patternPage.includes(pattern.sourceHref));

    assert.equal(fs.existsSync(path.join(outDir, 'assets/examples.css')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'assets/examples.js')), true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
