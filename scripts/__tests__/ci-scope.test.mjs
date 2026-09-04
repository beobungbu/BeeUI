import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyCiScope } from '../ci-scope.mjs';

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
