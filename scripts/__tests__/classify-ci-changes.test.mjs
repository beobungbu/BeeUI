import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBareConsumerChanges,
  classifyBareNativeChanges,
  classifyNativeIosChanges,
  classifyPackageBoundaryChanges,
  classifyShowcaseNativeChanges,
  isBareConsumerSensitivePath,
  isBareNativeSensitivePath,
  isNativeIosSafePath,
  isPackageBoundarySensitivePath,
  isShowcaseNativeSensitivePath,
} from '../classify-ci-changes.mjs';

test('pure BeeUI JS/TS/CSS changes run package boundary but skip native compilers', () => {
  for (const file of [
    'packages/ui/src/components/button.tsx',
    'packages/core/src/index.ts',
    'packages/tokens/src/theme.css',
  ]) {
    assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true, file);
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, false, file);
  }
});

test('package docs are docs-only and do not cross package/native boundaries', () => {
  for (const file of [
    'packages/core/README.md',
    'packages/ui/README.md',
    'packages/tokens/README.md',
    'packages/ui/CHANGELOG.md',
    'packages/ui/docs/usage.md',
  ]) {
    assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, false, file);
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, false, file);
  }
});

test('package tsconfig changes keep boundary proof without native compile', () => {
  const file = 'packages/ui/tsconfig.json';
  assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true);
  assert.equal(classifyBareNativeChanges([file]).bareNative, false);
  assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false);
});

test('package manifests change both bare and Showcase native dependency graphs', () => {
  for (const file of [
    'packages/core/package.json',
    'packages/ui/package.json',
    'packages/tokens/package.json',
  ]) {
    assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true, file);
    assert.equal(classifyBareNativeChanges([file]).bareNative, true, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('root package scripts/metadata alone do not force native compilers', () => {
  const file = 'package.json';
  assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, false);
  assert.equal(classifyBareNativeChanges([file]).bareNative, false);
  assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false);
  assert.equal(classifyNativeIosChanges([file]).iosNative, false);
});

test('lockfile and workspace resolution metadata retain conservative Showcase native proof', () => {
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc']) {
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('bare consumer script changes boundary and bare native only', () => {
  const file = 'scripts/verify-bare-consumer.sh';
  assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true);
  assert.equal(classifyBareNativeChanges([file]).bareNative, true);
  assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false);
  assert.equal(classifyNativeIosChanges([file]).iosNative, true);
});

test('Showcase executable JS changes are proven without native compile', () => {
  for (const file of [
    'apps/showcase/App.tsx',
    'apps/showcase/index.ts',
    'apps/showcase/global.css',
    'apps/showcase/metro.config.js',
    'apps/showcase/patterns/auth/screens/sign-in-screen.tsx',
    'apps/showcase/pattern-gallery/pattern-gallery.tsx',
    'apps/showcase/component-gallery/component-gallery.tsx',
  ]) {
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, false, file);
  }
});

test('Showcase manifest/config changes require Showcase native compile only', () => {
  for (const file of [
    'apps/showcase/package.json',
    'apps/showcase/app.json',
    'apps/showcase/app.config.json',
    'apps/showcase/app.config.ts',
    'apps/showcase/react-native.config.js',
    'apps/showcase/plugins/with-beeui.js',
  ]) {
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('arbitrary Showcase config helpers outside explicit runtime surfaces fail closed', () => {
  for (const file of [
    'apps/showcase/with-native.ts',
    'apps/showcase/config/with-entitlements.js',
    'apps/showcase/config/native-options.json',
  ]) {
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
  }
});

test('future native implementation fails closed for both consumers', () => {
  for (const file of [
    'packages/ui/ios/BeeUI.podspec',
    'packages/ui/ios/BeeUIView.mm',
    'packages/core/android/src/main/java/com/beeui/CoreModule.kt',
    'packages/ui/src/native-view.cpp',
    'packages/ui/src/NativeBeeUIManager.ts',
    'packages/ui/src/BeeUIViewNativeComponent.tsx',
  ]) {
    assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true, file);
    assert.equal(classifyBareNativeChanges([file]).bareNative, true, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('ordinary package runtime TS remains native-safe even with native wording', () => {
  const file = 'packages/ui/src/components/native-utils.ts';
  assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true);
  assert.equal(classifyNativeIosChanges([file]).iosNative, false);
});

test('CI/native policy implementation changes self-validate with full native proof', () => {
  for (const file of [
    '.github/workflows/ci.yml',
    '.github/workflows/expo-consumer.yml',
    'scripts/classify-ci-changes.mjs',
  ]) {
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
  }
  assert.equal(classifyBareNativeChanges(['.github/workflows/ci.yml']).bareNative, true);
});

test('documentation, registry and isolated tests stay native-safe', () => {
  for (const file of [
    'README.md',
    'docs/release.md',
    'registry/registry.json',
    'apps/visual-regression/App.tsx',
    'apps/showcase/__tests__/patterns/auth-patterns.test.tsx',
    'scripts/__tests__/beeui.test.mjs',
  ]) {
    assert.equal(classifyNativeIosChanges([file]).iosNative, false, file);
  }
});

test('unknown repository inputs retain fail-closed native behavior', () => {
  const result = classifyShowcaseNativeChanges(['scripts/change-native-tooling.sh']);
  assert.equal(result.showcaseNative, true);
  assert.deepEqual(result.showcaseNativeSensitiveFiles, ['scripts/change-native-tooling.sh']);
});

test('mixed JS package and native-sensitive changes require only affected native tier', () => {
  const files = ['packages/ui/src/index.ts', 'apps/showcase/app.json'];
  assert.equal(classifyPackageBoundaryChanges(files).packageBoundary, true);
  assert.equal(classifyBareNativeChanges(files).bareNative, false);
  assert.equal(classifyShowcaseNativeChanges(files).showcaseNative, true);
  assert.equal(classifyNativeIosChanges(files).iosNative, true);
});

test('forceNative and empty input fail safe for all native tiers', () => {
  const options = { forceNative: true };
  assert.equal(classifyPackageBoundaryChanges(['docs/release.md'], options).packageBoundary, true);
  assert.equal(classifyBareNativeChanges(['docs/release.md'], options).bareNative, true);
  assert.equal(classifyShowcaseNativeChanges(['docs/release.md'], options).showcaseNative, true);
  assert.equal(classifyNativeIosChanges(['docs/release.md'], options).iosNative, true);

  assert.equal(classifyPackageBoundaryChanges([]).packageBoundary, true);
  assert.equal(classifyBareNativeChanges([]).bareNative, true);
  assert.equal(classifyShowcaseNativeChanges([]).showcaseNative, true);
  assert.equal(classifyNativeIosChanges([]).iosNative, true);
});

test('backward bare-consumer API maps to package-boundary proof', () => {
  const result = classifyBareConsumerChanges(['packages/ui/src/components/button.tsx']);
  assert.equal(result.bareConsumer, true);
  assert.deepEqual(result.bareConsumerSensitiveFiles, ['packages/ui/src/components/button.tsx']);
});

test('path helpers normalize slash spellings and expose tier split', () => {
  assert.equal(isPackageBoundarySensitivePath('./packages/ui/src/index.ts'), true);
  assert.equal(isPackageBoundarySensitivePath('packages/ui/README.md'), false);
  assert.equal(isBareConsumerSensitivePath('packages\\core\\src\\index.ts'), true);
  assert.equal(isBareNativeSensitivePath('packages\\ui\\package.json'), true);
  assert.equal(isBareNativeSensitivePath('packages\\ui\\src\\NativeBeeUIManager.ts'), true);
  assert.equal(isShowcaseNativeSensitivePath('apps\\showcase\\App.tsx'), false);
  assert.equal(isShowcaseNativeSensitivePath('apps\\showcase\\with-native.ts'), true);
  assert.equal(isNativeIosSafePath('packages\\ui\\src\\button.tsx'), true);
  assert.equal(isNativeIosSafePath('packages\\ui\\README.md'), true);
  assert.equal(isNativeIosSafePath('packages\\ui\\src\\BeeUIViewNativeComponent.tsx'), false);
  assert.equal(isNativeIosSafePath('apps\\showcase\\app.json'), false);
});
