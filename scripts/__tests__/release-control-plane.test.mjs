import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectReleaseControlPlaneViolations, EXPECTED_PACKAGE_NAMES, EXPECTED_VERSION } from '../check-release-control-plane.mjs';

function createFixture(version = EXPECTED_VERSION) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-control-plane-'));
  fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ version })}\n`);
  for (const [relative, name] of EXPECTED_PACKAGE_NAMES) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({ name, version })}\n`);
  }
  for (const doc of ['release.md', 'dist-tag-policy.md', 'consumer-compatibility-report.md', 'rc-candidate.md', 'rc-ci-matrix.md', 'registry-cli.md', 'package-compatibility-report.md', 'npm-release-bootstrap.md']) {
    fs.writeFileSync(path.join(root, 'docs', doc), 'current @beemvp package release guidance\n');
  }
  return root;
}

test('accepts stable lockstep version and current release scope', () => {
  const root = createFixture();
  assert.deepEqual(collectReleaseControlPlaneViolations(root), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('accepts an rc.N version on the same owner-approved release line', () => {
  const root = createFixture('20260902.0.0-rc.1');
  assert.deepEqual(collectReleaseControlPlaneViolations(root), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('rejects release-line drift and legacy release scope', () => {
  const root = createFixture();
  const rootPath = path.join(root, 'package.json');
  const rootManifest = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
  rootManifest.version = '0.1.0';
  fs.writeFileSync(rootPath, `${JSON.stringify(rootManifest)}\n`);
  fs.writeFileSync(path.join(root, 'docs/release.md'), `publish ${'@' + 'beeui/core'}\n`);
  const violations = collectReleaseControlPlaneViolations(root);
  assert.ok(violations.some((entry) => entry.includes('package.json: expected BeeUI release-line version')));
  assert.ok(violations.some((entry) => entry.includes('packages/core/package.json: expected lockstep version 0.1.0')));
  assert.ok(violations.some((entry) => entry.includes('docs/release.md: contains superseded legacy package scope')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('rejects package version drift from the root candidate', () => {
  const root = createFixture('20260902.0.0-rc.2');
  const corePath = path.join(root, 'packages/core/package.json');
  const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
  core.version = '20260902.0.0-rc.1';
  fs.writeFileSync(corePath, `${JSON.stringify(core)}\n`);
  const violations = collectReleaseControlPlaneViolations(root);
  assert.ok(violations.some((entry) => entry.includes('packages/core/package.json: expected lockstep version 20260902.0.0-rc.2')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('release verifier shares the RC-aware version authority', () => {
  const verifier = fs.readFileSync(path.resolve('scripts/verify-release.mjs'), 'utf8');
  assert.match(verifier, /ALLOWED_VERSION_PATTERN\.test\(rootVersion\)/);
  assert.doesNotMatch(verifier, /rootVersion === '20260902\.0\.0'/);
});

test('npm release workflow keeps registry mutation manual, environment-gated, and OIDC-scoped', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/npm-release.yml'), 'utf8');

  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /default: verify/);
  assert.match(workflow, /environment: release/);
  assert.match(workflow, /BEEUI_RC_RELEASE/);
  assert.match(workflow, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/);
  assert.match(
    workflow,
    /bootstrap-rc:[\s\S]*?permissions:[\s\S]*?id-token: write[\s\S]*?env:\n      NODE_AUTH_TOKEN:/,
  );
  assert.match(workflow, /stage-rc:[\s\S]*?permissions:\n      contents: read\n      id-token: write/);
  assert.match(workflow, /npm publish .*--tag next --provenance/);
  assert.match(workflow, /npm stage publish .*--tag next --provenance/);
  assert.doesNotMatch(workflow, /npm dist-tag/);
});
