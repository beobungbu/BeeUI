import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectReleaseControlPlaneViolations, EXPECTED_PACKAGE_NAMES, EXPECTED_VERSION, readPinnedVersion } from '../check-release-control-plane.mjs';

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-control-plane-'));
  fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ version: EXPECTED_VERSION })}\n`);
  for (const [relative, name] of EXPECTED_PACKAGE_NAMES) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({ name, version: EXPECTED_VERSION })}\n`);
  }
  for (const doc of ['release.md', 'dist-tag-policy.md', 'consumer-compatibility-report.md', 'rc-candidate.md', 'rc-ci-matrix.md', 'registry-cli.md', 'package-compatibility-report.md']) {
    fs.writeFileSync(path.join(root, 'docs', doc), 'current @beemvp package release guidance\n');
  }
  // The pin the checks compare against lives in the dist-tag-policy block.
  fs.writeFileSync(
    path.join(root, 'docs/dist-tag-policy.md'),
    `\`\`\`json dist-tag-policy\n${JSON.stringify({ published: false, currentVersion: EXPECTED_VERSION })}\n\`\`\`\n`,
  );
  return root;
}

test('accepts lockstep version and current release scope', () => {
  const root = createFixture();
  assert.deepEqual(collectReleaseControlPlaneViolations(root), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('rejects version drift and legacy release scope', () => {
  const root = createFixture();
  const corePath = path.join(root, 'packages/core/package.json');
  const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
  core.version = '0.1.0';
  fs.writeFileSync(corePath, `${JSON.stringify(core)}\n`);
  fs.writeFileSync(path.join(root, 'docs/release.md'), `publish ${'@' + 'beeui/core'}\n`);
  const violations = collectReleaseControlPlaneViolations(root);
  assert.ok(violations.some((entry) => entry.includes('packages/core/package.json: expected version')));
  assert.ok(violations.some((entry) => entry.includes('docs/release.md: contains superseded legacy package scope')));
  fs.rmSync(root, { recursive: true, force: true });
});


test('names the bump procedure when every package agrees and only the pin lags', () => {
  const root = createFixture();
  for (const relative of ['packages/core/package.json', 'packages/tokens/package.json', 'packages/ui/package.json', 'packages/cli/package.json']) {
    const file = path.join(root, relative);
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, `${JSON.stringify({ ...manifest, version: '9.9.9' })}\n`);
  }

  const violations = collectReleaseControlPlaneViolations(root);

  // This is the shape `changeset version` leaves behind: the four members moved, the human pin
  // and the private root did not. Deleting the hint had left both suites green.
  assert.ok(violations.some((v) => v.includes('run `pnpm version:sync`')), violations.join('\n'));
  assert.ok(violations.some((v) => v.includes('docs/dist-tag-policy.md pins')), violations.join('\n'));
  assert.equal(readPinnedVersion(root), EXPECTED_VERSION);
});

test('the pin is read from dist-tag-policy, not from the root manifest', () => {
  // With both at the same value the fixture could not tell which one `readPinnedVersion` reads,
  // and reverting it to the root manifest left every suite green.
  const root = createFixture();
  fs.writeFileSync(path.join(root, 'docs/dist-tag-policy.md'), '```json dist-tag-policy\n{"published":false,"currentVersion":"7.7.7"}\n```\n');

  assert.equal(readPinnedVersion(root), '7.7.7');
  const violations = collectReleaseControlPlaneViolations(root);
  assert.ok(violations.some((v) => v.startsWith('package.json: expected version 7.7.7')), violations.join('\n'));
});
