import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildPublicLanding, renderPublicLanding } from '../build-public-landing.mjs';
import { collectPublicWebViolations } from '../check-public-web.mjs';
import { buildPublicComponentManifest, generatePublicComponentPages } from '../public-component-reference.mjs';

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
