import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNativeIosChanges,
  isNativeIosSafePath,
  classifyBareConsumerChanges,
  isBareConsumerSensitivePath,
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

test('classifies auth pattern implementation as native-sensitive executable Showcase input', () => {
  const result = classifyNativeIosChanges(['apps/showcase/patterns/auth/screens/sign-in-screen.tsx']);
  assert.equal(result.iosNative, true);
});

test('classifies dashboard-finance pattern implementation as native-sensitive', () => {
  const result = classifyNativeIosChanges(['apps/showcase/patterns/dashboard-finance/screens/dashboard-overview-screen.tsx']);
  assert.equal(result.iosNative, true);
});

test('classifies commerce-social pattern implementation as native-sensitive', () => {
  const result = classifyNativeIosChanges(['apps/showcase/patterns/commerce-social/screens/product-detail-screen.tsx']);
  assert.equal(result.iosNative, true);
});

test('classifies account-settings pattern implementation as native-sensitive', () => {
  const result = classifyNativeIosChanges(['apps/showcase/patterns/account-settings/screens/settings-screen.tsx']);
  assert.equal(result.iosNative, true);
});

test('keeps isolated pattern tests native-safe', () => {
  const result = classifyNativeIosChanges(['apps/showcase/__tests__/patterns/auth-patterns.test.tsx']);
  assert.equal(result.iosNative, false);
});

test('classifies executable Pattern Gallery implementation as native-sensitive', () => {
  const result = classifyNativeIosChanges(['apps/showcase/pattern-gallery/pattern-gallery.tsx']);
  assert.equal(result.iosNative, true);
});

test('mixed documentation and pattern implementation changes require native verification', () => {
  const result = classifyNativeIosChanges([
    'docs/roadmap.md',
    'apps/showcase/patterns/auth/screens/sign-in-screen.tsx',
  ]);
  assert.equal(result.iosNative, true);
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

test('normalizes ordinary git path spellings under the new topology', () => {
  assert.equal(isNativeIosSafePath('./docs/release.md'), true);
  assert.equal(isNativeIosSafePath('apps\\showcase\\__tests__\\patterns\\auth-patterns.test.tsx'), true);
  assert.equal(isNativeIosSafePath('apps\\showcase\\patterns\\auth\\screens\\sign-in-screen.tsx'), false);
});

test('classifies package path changes as bare-consumer-sensitive', () => {
  const result = classifyBareConsumerChanges(['packages/ui/src/components/button.tsx']);
  assert.equal(result.bareConsumer, true);
  assert.deepEqual(result.bareConsumerSensitiveFiles, ['packages/ui/src/components/button.tsx']);
});

test('rename-out path lists remain bare-consumer-sensitive when the deleted package path is preserved', () => {
  const result = classifyBareConsumerChanges([
    'packages/ui/src/components/legacy-button.tsx',
    'docs/legacy-button.tsx',
  ]);
  assert.equal(result.bareConsumer, true);
  assert.deepEqual(result.bareConsumerSensitiveFiles, ['packages/ui/src/components/legacy-button.tsx']);
});

test('classifies core and tokens package changes as bare-consumer-sensitive', () => {
  assert.equal(classifyBareConsumerChanges(['packages/core/src/index.ts']).bareConsumer, true);
  assert.equal(classifyBareConsumerChanges(['packages/tokens/theme.css']).bareConsumer, true);
});

test('classifies the bare-consumer script itself as bare-consumer-sensitive', () => {
  const result = classifyBareConsumerChanges(['scripts/verify-bare-consumer.sh']);
  assert.equal(result.bareConsumer, true);
});

test('showcase-only changes require native verification but skip the bare-consumer leg', () => {
  const bareResult = classifyBareConsumerChanges(['apps/showcase/App.tsx']);
  assert.equal(bareResult.bareConsumer, false);
  assert.equal(classifyNativeIosChanges(['apps/showcase/App.tsx']).iosNative, true);
});

test('docs-only changes skip both native and bare-consumer verification', () => {
  assert.equal(classifyNativeIosChanges(['docs/release.md']).iosNative, false);
  assert.equal(classifyBareConsumerChanges(['docs/release.md']).bareConsumer, false);
});

test('forceNative requires both native and bare-consumer verification', () => {
  const nativeResult = classifyNativeIosChanges(['docs/release.md'], { forceNative: true });
  const bareResult = classifyBareConsumerChanges(['docs/release.md'], { forceNative: true });
  assert.equal(nativeResult.iosNative, true);
  assert.equal(bareResult.bareConsumer, true);
});

test('empty input fails safe for both native and bare-consumer verification', () => {
  assert.equal(classifyNativeIosChanges([]).iosNative, true);
  assert.equal(classifyBareConsumerChanges([]).bareConsumer, true);
});

test('normalizes path spellings for bare-consumer sensitivity checks', () => {
  assert.equal(isBareConsumerSensitivePath('./packages/ui/src/index.ts'), true);
  assert.equal(isBareConsumerSensitivePath('packages\\core\\src\\index.ts'), true);
  assert.equal(isBareConsumerSensitivePath('apps/showcase/App.tsx'), false);
});
