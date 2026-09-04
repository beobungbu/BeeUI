import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import {
  gitBlobSha,
  validateAcknowledgedSurfaceSources,
} from '../check-public-surface-ownership.mjs';

test('acknowledged public-surface source passes only at the reviewed blob', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-surface-owner-'));
  try {
    const relPath = 'surface.ts';
    const initial = 'export const publicThing = 1;\n';
    fs.writeFileSync(path.join(rootDir, relPath), initial);
    const policy = { acknowledgedSourceBlobs: { [relPath]: gitBlobSha(initial) } };

    assert.deepEqual(validateAcknowledgedSurfaceSources(rootDir, policy), []);

    fs.writeFileSync(path.join(rootDir, relPath), 'export const publicThing = 1;\nexport const newPublicThing = 2;\n');
    const violations = validateAcknowledgedSurfaceSources(rootDir, policy);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /changed after documentation ownership was acknowledged/u);
    assert.match(violations[0], /intentionally update acknowledgedSourceBlobs/u);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('surface check is read-only and cannot heal its own drift before validation', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['docs:surface:check'], 'node ./scripts/check-public-surface-ownership.mjs');
  assert.doesNotMatch(pkg.scripts['docs:surface:check'], /docs:surface:generate|generate-public-surface-inventory\.mjs/u);
});
