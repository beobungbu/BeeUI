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

test('bare consumer script changes boundary and bare native only', () => {
  const file = 'scripts/verify-bare-consumer.sh';
  assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true);
  assert.equal(classifyBareNativeChanges([file]).bareNative, true);
  assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false);
  assert.equal(classifyNativeIosChanges([file]).iosNative, true);
});

test('Showcase executable JS changes are proven by Expo export and skip native compile', () => {
  for (const file of [
    'apps/showcase/App.tsx',
    'apps/showcase/index.ts',
    'apps/showcase/patterns/auth/screens/sign-in-screen.tsx',
    'apps/showcase/pattern-gallery/pattern-gallery.tsx',
  ]) {
    assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, false, file);
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, false, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, false, file);
  }
});

test('Showcase manifest/config changes require Showcase native compile only', () => {
  for (const file of [
    'apps/showcase/package.json',
    'apps/showcase/app.json',
    'apps/showcase/app.config.ts',
    'apps/showcase/react-native.config.js',
    'apps/showcase/plugins/with-beeui.js',
  ]) {
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('workspace dependency-resolution metadata requires Showcase native compile', () => {
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc']) {
    assert.equal(classifyBareNativeChanges([file]).bareNative, false, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('committed/generated native Showcase trees fail closed', () => {
  for (const file of [
    'apps/showcase/ios/BeeUIShowcase/AppDelegate.swift',
    'apps/showcase/android/app/build.gradle',
  ]) {
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
  }
});

test('a future BeeUI native implementation fails closed for both consumers', () => {
  for (const file of [
    'packages/ui/ios/BeeUI.podspec',
    'packages/ui/ios/BeeUIView.mm',
    'packages/core/android/src/main/java/com/beeui/CoreModule.kt',
    'packages/ui/src/native-view.cpp',
  ]) {
    assert.equal(classifyPackageBoundaryChanges([file]).packageBoundary, true, file);
    assert.equal(classifyBareNativeChanges([file]).bareNative, true, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
});

test('CI policy implementation changes self-validate with full native proof', () => {
  for (const file of ['.github/workflows/ci.yml', 'scripts/classify-ci-changes.mjs']) {
    assert.equal(classifyBareNativeChanges([file]).bareNative, true, file);
    assert.equal(classifyShowcaseNativeChanges([file]).showcaseNative, true, file);
    assert.equal(classifyNativeIosChanges([file]).iosNative, true, file);
  }
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

test('mixed JS package and native-sensitive changes require only the affected native tier', () => {
  const files = ['packages/ui/src/index.ts', 'apps/showcase/app.json'];
  assert.equal(classifyPackageBoundaryChanges(files).packageBoundary, true);
  assert.equal(classifyBareNativeChanges(files).bareNative, false);
  assert.equal(classifyShowcaseNativeChanges(files).showcaseNative, true);
  assert.equal(classifyNativeIosChanges(files).iosNative, true);
});

test('rename-out lists preserve the old package path for boundary classification', () => {
  const files = [
    'packages/ui/src/components/legacy-button.tsx',
    'docs/legacy-button.tsx',
  ];
  const result = classifyPackageBoundaryChanges(files);
  assert.equal(result.packageBoundary, true);
  assert.deepEqual(result.packageBoundarySensitiveFiles, [
    'packages/ui/src/components/legacy-button.tsx',
  ]);
  assert.equal(classifyNativeIosChanges(files).iosNative, false);
});

test('forceNative requires boundary, bare native and Showcase native verification', () => {
  const options = { forceNative: true };
  assert.equal(classifyPackageBoundaryChanges(['docs/release.md'], options).packageBoundary, true);
  assert.equal(classifyBareNativeChanges(['docs/release.md'], options).bareNative, true);
  assert.equal(classifyShowcaseNativeChanges(['docs/release.md'], options).showcaseNative, true);
  assert.equal(classifyNativeIosChanges(['docs/release.md'], options).iosNative, true);
});

test('empty input fails safe for all tiers', () => {
  assert.equal(classifyPackageBoundaryChanges([]).packageBoundary, true);
  assert.equal(classifyBareNativeChanges([]).bareNative, true);
  assert.equal(classifyShowcaseNativeChanges([]).showcaseNative, true);
  assert.equal(classifyNativeIosChanges([]).iosNative, true);
});

test('backward bare-consumer API now maps to package-boundary proof', () => {
  const result = classifyBareConsumerChanges(['packages/ui/src/components/button.tsx']);
  assert.equal(result.bareConsumer, true);
  assert.deepEqual(result.bareConsumerSensitiveFiles, ['packages/ui/src/components/button.tsx']);
});

test('path helpers normalize slash spellings and expose the tier split', () => {
  assert.equal(isPackageBoundarySensitivePath('./packages/ui/src/index.ts'), true);
  assert.equal(isBareConsumerSensitivePath('packages\\core\\src\\index.ts'), true);
  assert.equal(isBareNativeSensitivePath('packages\\ui\\package.json'), true);
  assert.equal(isShowcaseNativeSensitivePath('apps\\showcase\\App.tsx'), false);
  assert.equal(isNativeIosSafePath('packages\\ui\\src\\button.tsx'), true);
  assert.equal(isNativeIosSafePath('apps\\showcase\\app.json'), false);
});
