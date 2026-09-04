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

test('npm release workflow keeps registry mutation manual, main-only, environment-gated, and OIDC-scoped', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/npm-release.yml'), 'utf8');
  const bootstrapMatch = /\n  bootstrap-rc:\n([\s\S]*?)\n  stage-rc:\n/.exec(workflow);
  assert.ok(bootstrapMatch, 'bootstrap-rc job must exist');
  const bootstrap = bootstrapMatch[1];

  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /default: verify/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /environment: release/);
  assert.match(workflow, /BEEUI_RC_RELEASE/);
  assert.match(bootstrap, /permissions:[\s\S]*?id-token: write/);
  assert.doesNotMatch(bootstrap, /^    env:\n      NODE_AUTH_TOKEN:/m);
  assert.match(
    bootstrap,
    /- name: Bootstrap the first RC under next\n        env:\n          NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/,
  );
  assert.match(bootstrap, /Refuse reused versions and registry probe errors[\s\S]*?E404\|404 Not Found/);
  assert.match(bootstrap, /registry probe for \$\{spec\} failed unexpectedly/);
  assert.match(workflow, /stage-rc:[\s\S]*?permissions:\n      contents: read\n      id-token: write/);
  assert.match(workflow, /Require existing package bootstrap and a fresh RC version[\s\S]*?E404\|404 Not Found/);
  assert.match(workflow, /npm publish .*--tag next --provenance/);
  assert.match(workflow, /npm stage publish .*--tag next --provenance/);
  assert.doesNotMatch(workflow, /npm dist-tag/);
});
