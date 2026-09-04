import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import { installClaimViolations } from '../generate-public-surface-inventory.mjs';
import {
  acknowledgeSurfaceSources,
  gitBlobSha,
  validateAcknowledgedSurfaceSources,
  validatePublicSurfaceOwnership,
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
  // Re-acknowledgement must stay an explicit, separate action.
  assert.doesNotMatch(pkg.scripts['docs:surface:check'], /--acknowledge/u);
  assert.match(pkg.scripts['docs:surface:acknowledge'], /--acknowledge/u);
});

test('release-truth scoping needs the containing section to declare unavailability', () => {
  const available = ['# pkg', '', '## Install', '', '```bash', 'npm install @beemvp/beeui-tokens', '```'].join('\n');
  assert.equal(installClaimViolations('README.md', available).length, 1);

  const acknowledged = [
    '# pkg',
    '',
    '## Distribution state',
    '',
    '**Unpublished:** not published to the public npm registry.',
    '',
    '```bash',
    'npm install @beemvp/beeui-tokens',
    '```',
  ].join('\n');
  assert.deepEqual(installClaimViolations('README.md', acknowledged), []);

  // A later section inherits an earlier file-level unavailability statement...
  const inherited = `${acknowledged}\n\n## Usage\n\n\`\`\`bash\nnpx @beemvp/beeui-cli add button\n\`\`\`\n`;
  assert.deepEqual(installClaimViolations('README.md', inherited), []);

  // ...but unrelated prose near the command does not launder the claim.
  const proximityOnly = [
    '# pkg',
    '',
    '## Install',
    '',
    'We plan a lot of future work on this package and it is not yet slow.',
    'Install it with:',
    '',
    '```bash',
    'npm install @beemvp/beeui-ui',
    '```',
  ].join('\n');
  assert.equal(installClaimViolations('README.md', proximityOnly).length, 1);
});

test('acknowledge tooling rewrites only the recorded blob shas', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-surface-ack-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'surface.ts'), 'export const a = 1;\n');
    const policyPath = path.join(rootDir, 'docs/public-surface-owners.json');
    fs.writeFileSync(policyPath, `${JSON.stringify({ acknowledgedSourceBlobs: { 'surface.ts': 'stale'.padEnd(40, '0') } }, null, 2)}\n`);

    assert.equal(validateAcknowledgedSurfaceSources(rootDir).length, 1);
    assert.deepEqual(acknowledgeSurfaceSources(rootDir), ['surface.ts']);
    assert.deepEqual(validateAcknowledgedSurfaceSources(rootDir), []);
    assert.deepEqual(acknowledgeSurfaceSources(rootDir), []);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('the ownership gate is clean on the current tree', () => {
  assert.deepEqual(validatePublicSurfaceOwnership(ROOT_DIR), []);
});
