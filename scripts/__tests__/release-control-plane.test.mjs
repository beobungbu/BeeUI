import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectNpmReleaseWorkflowViolations,
  collectReleaseControlPlaneViolations,
  EXPECTED_PACKAGE_NAMES,
  EXPECTED_VERSION,
  readPinnedPrereleasePattern,
  readPinnedVersion,
} from '../check-release-control-plane.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The fixture pin and the fixture workflow's shell guard have to be the same string, because that
// is exactly what the check requires of the repository.
const FIXTURE_PRERELEASE_PATTERN = '^0\\.86\\.2-rc\\.(0|[1-9][0-9]*)$';

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
  for (const doc of ['release.md', 'dist-tag-policy.md', 'consumer-compatibility-report.md', 'rc-candidate.md', 'rc-ci-matrix.md', 'registry-cli.md', 'package-compatibility-report.md', 'npm-release-bootstrap.md']) {
    fs.writeFileSync(path.join(root, 'docs', doc), 'current @beemvp package release guidance\n');
  }
  // The pin the checks compare against lives in the dist-tag-policy block.
  fs.writeFileSync(
    path.join(root, 'docs/dist-tag-policy.md'),
    `\`\`\`json dist-tag-policy\n${JSON.stringify({ published: false, currentVersion: EXPECTED_VERSION, prereleaseVersionPattern: FIXTURE_PRERELEASE_PATTERN })}\n\`\`\`\n`,
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


// The npm transport is the one workflow that can mutate a public registry. These are the
// properties that keep "the workflow exists" from meaning "a publish can happen".
test('the npm release workflow keeps registry mutation manual, main-only, environment-gated and OIDC-scoped', () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/npm-release.yml'), 'utf8');
  const bootstrapMatch = /\n  bootstrap-rc:\n([\s\S]*?)\n  stage-rc:\n/.exec(workflow);
  assert.ok(bootstrapMatch, 'bootstrap-rc job must exist');
  const bootstrap = bootstrapMatch[1];

  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /default: verify/);
  assert.match(workflow, /environment: release/);

  // A gate is only a gate where it runs. Matching each gate's text anywhere in the file asserted
  // presence, not enforcement: `BEEUI_RC_RELEASE` also occurs in the input description, so
  // deleting the confirmation gate stayed green, and rewriting the branch condition to something
  // never true left all three gates as dead code with every asserted string still verbatim in the
  // file. Read the branch itself, and pin its body exactly.
  const nonVerifyBranch = /\n( +)if \[ "\$OPERATION" != "verify" \]; then\n([\s\S]*?)\n\1fi\n/.exec(workflow);
  assert.ok(nonVerifyBranch, 'registry mutation gates must sit inside `if [ "$OPERATION" != "verify" ]`');
  const mutationGates = nonVerifyBranch[2]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  assert.equal(mutationGates.length, 3, `expected exactly three mutation gates, found:\n${mutationGates.join('\n')}`);
  assert.equal(mutationGates[0], 'test "$GITHUB_REF" = "refs/heads/main"');
  assert.equal(mutationGates[1], 'test "$CONFIRMATION" = "BEEUI_RC_RELEASE"');
  assert.match(mutationGates[2], /^printf '%s\\n' "\$version" \| grep -Eq '\^.+\$'$/);

  // Provenance needs OIDC, but the bootstrap's registry credential is the temporary token and it
  // reaches only the publish step — not install, build, pack or the registry probes.
  assert.match(bootstrap, /permissions:[\s\S]*?id-token: write/);
  assert.doesNotMatch(bootstrap, /^    env:\n      NODE_AUTH_TOKEN:/m);
  assert.match(
    bootstrap,
    /- name: Bootstrap the first RC under next\n        env:\n          NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/,
  );

  // A registry probe that cannot tell "absent" from "unreachable" would republish over a
  // network blip, so only E404/404 may count as absence.
  assert.match(bootstrap, /Refuse reused versions and registry probe errors[\s\S]*?E404\|404 Not Found/);
  assert.match(bootstrap, /registry probe for \$\{spec\} failed unexpectedly/);
  assert.match(workflow, /stage-rc:[\s\S]*?permissions:\n      contents: read\n      id-token: write/);
  assert.match(workflow, /Require existing package bootstrap and a fresh RC version[\s\S]*?E404\|404 Not Found/);

  // Prereleases only, and no dist-tag move: promotion to `latest` stays owner work under #254.
  assert.match(workflow, /npm publish .*--tag next --provenance/);
  assert.match(workflow, /npm stage publish .*--tag next --provenance/);
  assert.doesNotMatch(workflow, /npm dist-tag/);
});


function npmReleaseWorkflow({ defaultVersion = '0.86.2', guard = FIXTURE_PRERELEASE_PATTERN } = {}) {
  return [
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      operation:',
    '        default: verify',
    '      expected_version:',
    '        required: true',
    `        default: ${defaultVersion}`,
    '        type: string',
    'jobs:',
    '  preflight:',
    '    steps:',
    '      - run: |',
    `          printf '%s\\n' "$version" | grep -Eq '${guard}'`,
    '',
  ].join('\n');
}

test('the npm release workflow version literals track the pin', () => {
  assert.deepEqual(collectNpmReleaseWorkflowViolations(npmReleaseWorkflow(), '0.86.2', FIXTURE_PRERELEASE_PATTERN), []);
});

// This is the drift #512 describes: the pin and the manifests move to a new release line while the
// transport keeps offering the superseded label, and nothing else in CI compares the two.
test('a dispatch default left behind by a version bump is rejected', () => {
  const v = collectNpmReleaseWorkflowViolations(npmReleaseWorkflow({ defaultVersion: '20260902.0.0' }), '0.86.2', FIXTURE_PRERELEASE_PATTERN);
  assert.ok(v.some((m) => /"expected_version" default 20260902\.0\.0 must equal the pinned version 0\.86\.2/.test(m)), v.join('\n'));
});

test('a prerelease guard left behind by a version bump is rejected', () => {
  const v = collectNpmReleaseWorkflowViolations(
    npmReleaseWorkflow({ guard: '^20260902\\.0\\.0-rc\\.(0|[1-9][0-9]*)$' }),
    '0.86.2',
    FIXTURE_PRERELEASE_PATTERN,
  );
  assert.ok(v.some((m) => /rejects 0\.86\.2-rc\.1/.test(m)), v.join('\n'));
});

test('a prerelease guard that admits the stable version or another line is rejected', () => {
  const stableToo = collectNpmReleaseWorkflowViolations(npmReleaseWorkflow({ guard: '^0\\.86\\.2(-rc\\.[0-9]+)?$' }), '0.86.2', FIXTURE_PRERELEASE_PATTERN);
  assert.ok(stableToo.some((m) => /accepts 0\.86\.2,/.test(m)), stableToo.join('\n'));

  const unanchored = collectNpmReleaseWorkflowViolations(npmReleaseWorkflow({ guard: '0\\.86\\.2-rc\\.(0|[1-9][0-9]*)' }), '0.86.2', FIXTURE_PRERELEASE_PATTERN);
  assert.ok(unanchored.some((m) => /accepts 90\.86\.2-rc\.1/.test(m)), unanchored.join('\n'));
  assert.ok(unanchored.some((m) => /accepts 0\.86\.2-rc\.1-not-a-candidate/.test(m)), unanchored.join('\n'));
});

// Sampled versions cannot characterise a regex. Both guards below pass every behavioural probe:
// the first admits another patch on the 0.86 line, the second admits `-rc.007`, which the pin's
// own pattern rejects. Only string equality with the pin catches them.
test('a prerelease guard that is an anchored superset of the pinned pattern is rejected', () => {
  for (const guard of ['^0\\.86\\.[0-9]+-rc\\.(0|[1-9][0-9]*)$', '^0\\.86\\.2-rc\\.[0-9]+$']) {
    const v = collectNpmReleaseWorkflowViolations(npmReleaseWorkflow({ guard }), '0.86.2', FIXTURE_PRERELEASE_PATTERN);
    assert.ok(v.some((m) => /must be the pinned prereleaseVersionPattern/.test(m)), `${guard}\n${v.join('\n')}`);
  }
});

// Without the pattern in the pin's projection the comparison above would run against `undefined`
// and report agreement with anything.
test('a pin that carries no prerelease pattern cannot vacuously accept the guard', () => {
  const v = collectNpmReleaseWorkflowViolations(npmReleaseWorkflow(), '0.86.2', undefined);
  assert.ok(v.some((m) => /no "prereleaseVersionPattern"/.test(m)), v.join('\n'));
});

test('the pin at a candidate keeps the guard on the same stable line', () => {
  assert.deepEqual(
    collectNpmReleaseWorkflowViolations(npmReleaseWorkflow({ defaultVersion: '0.86.2-rc.1' }), '0.86.2-rc.1', FIXTURE_PRERELEASE_PATTERN),
    [],
  );
});

test('a workflow with no version literals to compare is rejected', () => {
  const v = collectNpmReleaseWorkflowViolations('on:\n  workflow_dispatch:\njobs:\n  preflight:\n', '0.86.2', FIXTURE_PRERELEASE_PATTERN);
  assert.ok(v.some((m) => /no "expected_version" dispatch input/.test(m)), v.join('\n'));
  assert.ok(v.some((m) => /no prerelease version guard/.test(m)), v.join('\n'));
});

// The real workflow is reachable from the repository check, not only from these fixtures.
test('the repository npm release workflow agrees with the repository pin', () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/npm-release.yml'), 'utf8');
  assert.deepEqual(
    collectNpmReleaseWorkflowViolations(workflow, readPinnedVersion(REPO_ROOT), readPinnedPrereleasePattern(REPO_ROOT)),
    [],
  );
  // The repository pin must actually carry the pattern; `undefined` would make the line above pass
  // against anything.
  assert.equal(typeof readPinnedPrereleasePattern(REPO_ROOT), 'string');
});


// Wiring, not just the collector: the repository check has to reach the workflow, and the npm
// handoff doc has to be inside the legacy-scope scan.
test('the repository check reaches the npm release workflow', () => {
  const root = createFixture();
  fs.writeFileSync(path.join(root, '.github/workflows/npm-release.yml'), npmReleaseWorkflow({ defaultVersion: '20260902.0.0' }));

  const violations = collectReleaseControlPlaneViolations(root);

  assert.ok(violations.some((v) => v.includes('"expected_version" default 20260902.0.0')), violations.join('\n'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('the npm bootstrap handoff is scanned for the superseded package scope', () => {
  const root = createFixture();
  fs.writeFileSync(path.join(root, 'docs/npm-release-bootstrap.md'), `publish ${'@' + 'beeui/cli'}\n`);

  const violations = collectReleaseControlPlaneViolations(root);

  assert.ok(
    violations.some((v) => v.includes('docs/npm-release-bootstrap.md: contains superseded legacy package scope')),
    violations.join('\n'),
  );
  fs.rmSync(root, { recursive: true, force: true });
});
