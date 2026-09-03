import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildPublicLanding, renderPublicLanding } from '../build-public-landing.mjs';
import { collectPublicWebViolations } from '../check-public-web.mjs';

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
