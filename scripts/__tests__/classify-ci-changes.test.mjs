import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNativeIosChanges,
  isNativeIosSafePath,
} from '../classify-ci-changes.mjs';

test('classifies documentation-only changes as native-safe', () => {
  const result = classifyNativeIosChanges([
    'README.md',
    'docs/release.md',
    'CHANGELOG.md',
  ]);
  assert.equal(result.iosNative, false);
  assert.deepEqual(result.nativeSensitiveFiles, []);
});

test('classifies isolated pattern changes as native-safe', () => {
  const result = classifyNativeIosChanges([
    'apps/showcase/patterns/auth/screens/sign-in-screen.tsx',
    'apps/showcase/__tests__/patterns/auth-patterns.test.tsx',
  ]);
  assert.equal(result.iosNative, false);
});

test('classifies visual-regression-only changes as native-safe', () => {
  const result = classifyNativeIosChanges([
    'apps/visual-regression/App.tsx',
    'apps/visual-regression/tests/__screenshots__/foundation--light--mobile.png',
  ]);
  assert.equal(result.iosNative, false);
});

test('classifies registry-only implementation changes as native-safe', () => {
  const result = classifyNativeIosChanges([
    'registry/registry.json',
    'scripts/beeui.mjs',
    'scripts/registry-lib.mjs',
    'scripts/verify-registry.mjs',
    'scripts/__tests__/beeui.test.mjs',
  ]);
  assert.equal(result.iosNative, false);
});

test('classifies package implementation changes as native-sensitive', () => {
  const result = classifyNativeIosChanges(['packages/ui/src/components/button.tsx']);
  assert.equal(result.iosNative, true);
  assert.deepEqual(result.nativeSensitiveFiles, ['packages/ui/src/components/button.tsx']);
});

test('classifies executable Showcase changes as native-sensitive', () => {
  const result = classifyNativeIosChanges(['apps/showcase/App.tsx']);
  assert.equal(result.iosNative, true);
});

test('classifies root dependency metadata as native-sensitive', () => {
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('classifies workflow and unknown scripts as native-sensitive', () => {
  assert.equal(classifyNativeIosChanges(['.github/workflows/ci.yml']).iosNative, true);
  assert.equal(classifyNativeIosChanges(['scripts/verify-bare-consumer.sh']).iosNative, true);
});

test('mixed safe and sensitive changes require native verification', () => {
  const result = classifyNativeIosChanges([
    'docs/release.md',
    'packages/ui/src/index.ts',
  ]);
  assert.equal(result.iosNative, true);
  assert.deepEqual(result.nativeSensitiveFiles, ['packages/ui/src/index.ts']);
});

test('empty input fails safe by requiring native verification', () => {
  const result = classifyNativeIosChanges([]);
  assert.equal(result.iosNative, true);
  assert.match(result.reason, /fail-safe/);
});

test('forceNative always requires native verification', () => {
  const result = classifyNativeIosChanges(['docs/release.md'], { forceNative: true });
  assert.equal(result.iosNative, true);
  assert.match(result.reason, /forced/);
});

test('normalizes ordinary git path spellings', () => {
  assert.equal(isNativeIosSafePath('./docs/release.md'), true);
  assert.equal(isNativeIosSafePath('apps\\showcase\\patterns\\auth\\index.ts'), true);
});
