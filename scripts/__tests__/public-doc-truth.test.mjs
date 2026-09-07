import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectPublicTruthViolations } from '../check-public-doc-truth.mjs';

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-public-truth-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const validDemo = `
pnpm --filter @beemvp/beeui-demo start
pnpm --filter @beemvp/beeui-demo web
pnpm --filter @beemvp/beeui-demo build:web
`;

test('accepts repository-local evaluation commands and verified demo commands', () => {
  const root = fixture({
    'README.md': '> the repository/package version is `1.2.3`.\n' + 'pnpm install --frozen-lockfile\n',
    'package.json': '{"version":"1.2.3"}',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n',
  });
  assert.deepEqual(collectPublicTruthViolations(root), []);
});

test('accepts an RC identity while stable policy and ADR prose stay on the stable base', () => {
  const root = fixture({
    'README.md': '> the repository/package version is `0.86.2-rc.1`.\n',
    'package.json': '{"version":"0.86.2-rc.1"}',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n',
    'docs/release.md': 'The BeeUI 1.0 product milestone ships as package version `0.86.2` (ADR-015).\nFor the current BeeUI 1.0 product milestone the package version is plain SemVer `0.86.2`.\n',
    'docs/dist-tag-policy.md': '- The stable `0.86.2` is published, verified, and only then promoted.\n',
    'docs/consumer-compatibility-report.md': 'candidate version `0.86.2-rc.1` today\n',
    'docs/decisions/015-package-version-0-86-2.md': 'The lockstep package version is **`0.86.2`**.\n',
  });
  assert.deepEqual(collectPublicTruthViolations(root), []);
});

test('rejects unavailable public registry commands', () => {
  const root = fixture({
    'README.md': '> the repository/package version is `1.2.3`.\n' + 'pnpm add @beemvp/beeui-ui\n',
    'package.json': '{"version":"1.2.3"}',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'npx @beemvp/beeui-cli add button\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.length, 2);
  assert.match(violations.join('\n'), /pnpm add/);
  assert.match(violations.join('\n'), /npx/);
});

test('rejects stale demo build command and missing workspace commands', () => {
  const root = fixture({
    'README.md': '> the repository/package version is `1.2.3`.\n' + 'BeeUI\n',
    'package.json': '{"version":"1.2.3"}',
    'apps/demo/README.md': 'npm run build\n',
    'apps/docs/src/content/docs/index.md': 'BeeUI\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.some((line) => line.includes('npm run build')), true);
  assert.equal(violations.filter((line) => line.includes('missing verified workspace command')).length, 3);
});

test('a README that states the wrong package version is a violation, and a missing sentence too', () => {
  const root = fixture({
    'README.md': '> the repository/package version is `9.9.9`.\npnpm install --frozen-lockfile\n',
    'package.json': '{"version":"1.2.3"}',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n',
  });
  const wrong = collectPublicTruthViolations(root);
  assert.ok(wrong.some((v) => v.includes('README.md: distribution-status line states version 9.9.9 but the workspace version is 1.2.3')), wrong.join('\n'));

  const missing = collectPublicTruthViolations(fixture({ 'README.md': 'BeeUI\n', 'package.json': '{"version":"1.2.3"}', 'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n' }));
  assert.ok(missing.some((v) => v.includes('README.md: no longer carries its distribution-status line')), missing.join('\n'));

  const broken = collectPublicTruthViolations(fixture({ 'README.md': '> the repository/package version is `1.2.3`.\n', 'package.json': '{not json', 'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n' }));
  assert.ok(broken.some((v) => v.startsWith('package.json: not parseable')), broken.join('\n'));
});

test('a prose sentence elsewhere that states the wrong stable version is a violation', () => {
  const root = fixture({
    'README.md': '> the repository/package version is `1.2.3`.\n',
    'package.json': '{"version":"1.2.3"}',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n',
    'docs/release.md': 'The BeeUI 1.0 product milestone ships as package version `9.9.9` (ADR-015).\n',
    'docs/dist-tag-policy.md': '- The stable `1.2.3` is published, verified, and only then promoted.\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.ok(violations.some((v) => v.includes('docs/release.md: milestone sentence states version 9.9.9')), violations.join('\n'));
  assert.equal(violations.some((v) => v.includes('dist-tag-policy')), false, 'a correct stable sentence is not a violation');
});
