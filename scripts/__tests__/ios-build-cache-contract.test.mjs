import assert from 'node:assert/strict';
import test from 'node:test';

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');
const workflowPath = path.join(repoRoot, '.github/workflows/ci.yml');
const bareScriptPath = path.join(repoRoot, 'scripts/verify-bare-consumer.sh');
const expoScriptPath = path.join(repoRoot, 'scripts/verify-expo-consumer.sh');
const showcasePackagePath = path.join(repoRoot, 'apps/showcase/package.json');
const showcaseBuildPrereqPath = path.join(repoRoot, 'apps/showcase/scripts/ensure-workspace-build.mjs');

async function sources() {
  const [workflow, bareScript, expoScript, showcasePackageRaw, showcaseBuildPrereq] = await Promise.all([
    readFile(workflowPath, 'utf8'),
    readFile(bareScriptPath, 'utf8'),
    readFile(expoScriptPath, 'utf8'),
    readFile(showcasePackagePath, 'utf8'),
    readFile(showcaseBuildPrereqPath, 'utf8'),
  ]);
  return {
    workflow,
    bareScript,
    expoScript,
    showcasePackage: JSON.parse(showcasePackageRaw),
    showcaseBuildPrereq,
  };
}

test('Showcase iOS uses job-local DerivedData with compilation caching but no Actions DerivedData cache', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /derived_data="\$HOME\/Library\/Developer\/Xcode\/DerivedData\/showcase/);
  assert.match(workflow, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
  assert.match(workflow, /-showBuildTimingSummary/);
  assert.doesNotMatch(workflow, /- name: Cache Xcode DerivedData/);
});

test('bare RN iOS keeps deterministic job-local compiler/Ruby paths', async () => {
  const { bareScript } = await sources();
  assert.match(bareScript, /Library\/Caches\/BeeUI/);
  assert.match(bareScript, /bundle\/ruby-/);
  assert.match(bareScript, /DerivedData\/bare-rn-/);
  assert.match(bareScript, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
});

test('classifier is minimal and native work fans out immediately after it', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  classify:\n/m);
  assert.match(workflow, /git diff --name-only --no-renames "\$BEEUI_BASE_SHA" "\$BEEUI_HEAD_SHA"/);
  const classifyBlock = workflow.slice(workflow.indexOf('  classify:'), workflow.indexOf('  verify-lane:'));
  assert.doesNotMatch(classifyBlock, /Test native CI policy/);
  assert.doesNotMatch(classifyBlock, /node --test/);
});

test('verification decomposes historical typecheck/test chains into eight parallel lanes', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  verify-lane:\n/m);
  for (const task of ['quality', 'tokens', 'contracts', 'docs', 'types', 'showcase-registry', 'bench', 'release']) {
    assert.match(workflow, new RegExp(`\\s+- ${task.replace('-', '\\-')}(?:\\n|$)`));
  }
  assert.doesNotMatch(workflow, /^  verify-lane:\n\s+needs:/m);
  assert.match(workflow, /contracts\)[\s\S]*classify-ci-changes\.test\.mjs[\s\S]*ios-build-cache-contract\.test\.mjs/);
});

test('Showcase tests provision package build artifacts only when a clean checkout needs them', async () => {
  const { showcasePackage, showcaseBuildPrereq } = await sources();
  assert.equal(showcasePackage.scripts.pretest, 'node ./scripts/ensure-workspace-build.mjs');
  assert.match(showcaseBuildPrereq, /packages\/core\/dist\/module\/index\.js/);
  assert.match(showcaseBuildPrereq, /packages\/tokens\/dist\/module\/motion-runtime\.js/);
  assert.match(showcaseBuildPrereq, /packages\/ui\/dist\/module\/index\.js/);
  assert.match(showcaseBuildPrereq, /packages\/ui\/dist\/typescript\/module\/index\.d\.ts/);
  assert.match(showcaseBuildPrereq, /'--filter', '@beemvp\/beeui-ui\.\.\.', 'run', 'build'/);
  assert.match(showcaseBuildPrereq, /artifactState\.every\(Boolean\)/);
});

test('Showcase exports run as three independent matrix jobs', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  showcase-bundle:\n/m);
  assert.match(workflow, /platform: \[web, android, ios\]/);
  assert.doesNotMatch(workflow, /^  showcase-bundle:\n\s+needs:/m);
});

test('stable verify check is only a fan-in aggregator', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  verify:\n\s+needs: \[classify, verify-lane, showcase-bundle\]\n\s+if: always\(\)/m);
  assert.match(workflow, /needs\.verify-lane\.result/);
  assert.match(workflow, /needs\.showcase-bundle\.result/);
});

test('bare bundle and Android compile are independent classifier children', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  bare-bundle:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /^  bare-android:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /bare-bundle:[\s\S]*Bundle bare consumer for Android and iOS/);
  assert.match(workflow, /bare-android:[\s\S]*Compile bare Android debug APK/);
});

test('Showcase and bare iOS compiles are independent macOS classifier children', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  ios-showcase:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /^  ios-bare:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /ios-showcase:[\s\S]*Compile Showcase for iOS Simulator/);
  assert.match(workflow, /ios-bare:[\s\S]*Compile bare React Native consumer for iOS Simulator/);
  assert.doesNotMatch(workflow, /^  ios-bare:\n\s+needs: \[ios-showcase\]/m);
});

test('native fan-out preserves specific classifier gates', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /bare-bundle:[\s\S]*package-boundary-required == 'true'[\s\S]*bare-native-required == 'true'/);
  assert.match(workflow, /bare-android:[\s\S]*if: needs\.classify\.outputs\.bare-native-required == 'true'/);
  assert.match(workflow, /ios-showcase:[\s\S]*if: needs\.classify\.outputs\.showcase-native-required == 'true'/);
  assert.match(workflow, /ios-bare:[\s\S]*if: needs\.classify\.outputs\.bare-native-required == 'true'/);
});

test('iOS jobs cache CocoaPods but not Xcode DerivedData', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /run: pod install\b/);
  assert.match(workflow, /Cache CocoaPods/);
  assert.match(workflow, /~\/\.cocoapods/);
  assert.doesNotMatch(workflow, /key: dd-macos-/);
});

test('weekly backstop forces the full native graph', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /schedule:\n\s+- cron: '47 2 \* \* 1'/);
  assert.match(workflow, /BEEUI_FORCE_NATIVE:[\s\S]*github\.event_name == 'schedule'/);
});

test('Expo independent-consumer iOS harness still performs a real simulator compile', async () => {
  const { expoScript } = await sources();
  assert.doesNotMatch(expoScript, /\n\s*bundle install\b/);
  assert.match(expoScript, /\n\s*pod install\b/);
  assert.match(expoScript, /xcodebuild[\s\S]*-sdk iphonesimulator[\s\S]*\n\s*build\b/);
  assert.match(expoScript, /xcodebuild -workspace "\$\{workspace\}" -list -json/);
});
