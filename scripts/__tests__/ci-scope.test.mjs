import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyCiScope } from '../ci-scope.mjs';
import { execFileSync } from 'node:child_process';

const ALL_SCOPES = [
  'docs',
  'web',
  'visual',
  'package',
  'tokens',
  'showcase',
  'consumer',
  'expoConsumer',
  'release',
  'benchmark',
];

function assertFull(result) {
  for (const key of ALL_SCOPES) assert.equal(result[key], true, key);
}

test('package READMEs are docs-only and never package/consumer work', () => {
  const result = classifyCiScope([
    'packages/core/README.md',
    'packages/ui/README.md',
    'packages/tokens/README.md',
  ]);
  assert.equal(result.docs, true);
  assert.equal(result.web, true);
  assert.equal(result.package, false);
  assert.equal(result.tokens, false);
  assert.equal(result.consumer, false);
  assert.equal(result.expoConsumer, false);
  assert.equal(result.visual, false);
});

test('BeeUI package source routes package, showcase, visual and consumers', () => {
  const result = classifyCiScope(['packages/ui/src/components/button.tsx']);
  assert.equal(result.package, true);
  assert.equal(result.showcase, true);
  assert.equal(result.visual, true);
  assert.equal(result.consumer, true);
  assert.equal(result.expoConsumer, true);
});

test('token source additionally routes the token lifecycle lane', () => {
  const result = classifyCiScope(['packages/tokens/src/theme.css']);
  assert.equal(result.tokens, true);
  assert.equal(result.package, true);
  assert.equal(result.visual, true);
});

test('public docs implementation routes docs/web without native consumer work', () => {
  const result = classifyCiScope(['apps/docs/src/pages/index.astro']);
  assert.equal(result.docs, true);
  assert.equal(result.web, true);
  assert.equal(result.consumer, false);
  assert.equal(result.expoConsumer, false);
});

test('visual-regression changes stay in visual scope only', () => {
  const result = classifyCiScope(['apps/visual-regression/tests/button.spec.ts']);
  assert.equal(result.visual, true);
  assert.equal(result.package, false);
  assert.equal(result.consumer, false);
});

test('lockfile changes revalidate consumers conservatively', () => {
  const result = classifyCiScope(['pnpm-lock.yaml']);
  assert.equal(result.consumer, true);
  assert.equal(result.expoConsumer, true);
});

test('release and benchmark checks are independently scoped', () => {
  assert.equal(classifyCiScope(['packages/ui/package.json']).release, true);
  assert.equal(classifyCiScope(['scripts/benchmark/cli.mjs']).benchmark, true);
  assert.equal(classifyCiScope(['docs/guide.md']).release, false);
  assert.equal(classifyCiScope(['docs/guide.md']).benchmark, false);
});

test('central CI control-plane changes force one full self-validation run', () => {
  for (const file of [
    '.github/workflows/ci.yml',
    'scripts/ci-scope.mjs',
    'scripts/classify-ci-changes.mjs',
  ]) {
    const result = classifyCiScope([file]);
    assertFull(result);
    assert.match(result.reason, /CI control-plane changed/);
  }
});

test('empty input and explicit full mode fail safe to every lane', () => {
  assertFull(classifyCiScope([]));
  assertFull(classifyCiScope(['docs/guide.md'], { forceFull: true }));
});

// Every tracked file either selects a verification lane or is listed here with
// the reason it needs none. Without this the routing table can only be reviewed
// by inspection, and a path that silently selects nothing looks identical to a
// path that is genuinely inert — which is how packages/cli, tsconfig.base.json
// and the whole packages/core source tree ended up unverified on pull requests.
const LANES = ['docs', 'web', 'visual', 'package', 'tokens', 'showcase', 'consumer', 'expoConsumer', 'release', 'benchmark'];

const NO_LANE_REQUIRED = [
  // verify-fast has no job-level `if:`, so it runs these on every pull request.
  { prefix: 'scripts/check-compatibility-matrix', why: 'verify-fast runs compat:check/compat:test unconditionally' },
  { prefix: 'scripts/check-distribution-policy', why: 'verify-fast runs dist-policy:check/dist-policy:test unconditionally' },
  { prefix: 'scripts/check-release-control-plane', why: 'verify-fast runs release-control-plane:* unconditionally' },
  { prefix: 'scripts/check-release-ruleset', why: 'verify-fast runs release-ruleset:* unconditionally' },
  { prefix: 'scripts/check-repo-hygiene', why: 'verify-fast runs hygiene:check unconditionally' },
  { prefix: 'scripts/__tests__/check-compatibility-matrix', why: 'run by verify-fast' },
  { prefix: 'scripts/__tests__/check-distribution-policy', why: 'run by verify-fast' },
  { prefix: 'scripts/__tests__/release-control-plane', why: 'run by verify-fast' },
  { prefix: 'scripts/__tests__/release-ruleset-contract', why: 'run by verify-fast' },
  { prefix: 'scripts/__tests__/ci-scope', why: 'run by verify-fast' },
  { prefix: 'scripts/__tests__/classify-ci-changes', why: 'run by verify-fast' },
  { prefix: 'scripts/__tests__/ios-build-cache-contract', why: 'run by verify-fast' },

  // Exercised only by the scheduled runtime-native workflow, which no pull
  // request lane can trigger.
  { prefix: 'scripts/runtime-smoke/', why: 'scheduled runtime-native workflow only' },
  { prefix: 'scripts/ci-native-error-reader', why: 'log summariser for the scheduled native workflows' },
  { prefix: 'scripts/__tests__/ci-native-error-reader', why: 'covers the scheduled-workflow log summariser' },
  { prefix: 'scripts/__tests__/fixtures/ci-logs/', why: 'fixtures for the native log summariser' },

  // Repository meta: no build, test or published artifact reads these.
  { prefix: '.claude/', why: 'agent working notes' },
  { prefix: 'plans/', why: 'planning and review records' },
  { prefix: '.github/ISSUE_TEMPLATE/', why: 'issue forms' },
  { prefix: '.github/PULL_REQUEST_TEMPLATE.md', why: 'PR template' },
  { prefix: '.github/CODEOWNERS', why: 'review routing' },
  { prefix: '.github/dependabot.yml', why: 'dependency bot schedule' },
  { prefix: '.editorconfig', why: 'editor hint' },
  { prefix: '.gitattributes', why: 'git metadata' },
  { prefix: '.gitignore', why: 'git metadata' },
  { prefix: 'LICENSE', why: 'licence text' },
  { prefix: 'packages/core/LICENSE', why: 'licence text' },
  { prefix: 'packages/tokens/LICENSE', why: 'licence text' },
  { prefix: 'packages/ui/LICENSE', why: 'licence text' },
  { prefix: 'CODE_OF_CONDUCT.md', why: 'community policy' },
  { prefix: 'CONTRIBUTING.md', why: 'community policy' },
  { prefix: 'SECURITY.md', why: 'community policy' },
];

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
    .split('\0')
    .filter(Boolean);
}

test('every tracked file selects a lane or is an explicit, reasoned exception', () => {
  const unmapped = [];
  for (const file of trackedFiles()) {
    const scope = classifyCiScope([file]);
    if (LANES.some((lane) => scope[lane])) continue;
    if (NO_LANE_REQUIRED.some((entry) => file.startsWith(entry.prefix))) continue;
    unmapped.push(file);
  }
  assert.deepEqual(
    unmapped,
    [],
    `these paths select no verification lane and are not listed in NO_LANE_REQUIRED:\n${unmapped.join('\n')}`,
  );
});

test('no exception outlives the file it was written for', () => {
  const files = trackedFiles();
  const stale = NO_LANE_REQUIRED.filter((entry) => !files.some((file) => file.startsWith(entry.prefix)));
  assert.deepEqual(stale.map((entry) => entry.prefix), [], 'remove exceptions whose paths no longer exist');
});

test('a dependency-graph bump runs build, tests and screenshots, not only the native lanes', () => {
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc']) {
    const scope = classifyCiScope([file]);
    assert.equal(scope.package, true, `${file} must select the build/typecheck lane`);
    assert.equal(scope.visual, true, `${file} must select the visual lane`);
    assert.equal(scope.showcase, true, `${file} must select the showcase lane`);
  }
});
