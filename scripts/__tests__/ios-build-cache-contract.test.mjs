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

async function sources() {
  const [workflow, bareScript, expoScript] = await Promise.all([
    readFile(workflowPath, 'utf8'),
    readFile(bareScriptPath, 'utf8'),
    readFile(expoScriptPath, 'utf8'),
  ]);
  return { workflow, bareScript, expoScript };
}

test('Showcase iOS build keeps deterministic job-local DerivedData and Xcode compilation caching enabled', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /derived_data="\$HOME\/Library\/Developer\/Xcode\/DerivedData\/showcase/);
  assert.match(workflow, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
  assert.match(workflow, /-showBuildTimingSummary/);
  assert.doesNotMatch(workflow, /- name: Cache Xcode DerivedData/);
});

test('bare RN iOS build keeps deterministic compiler and Ruby paths outside RUNNER_TEMP', async () => {
  const { bareScript } = await sources();
  assert.match(bareScript, /Library\/Caches\/BeeUI/);
  assert.match(bareScript, /bundle\/ruby-/);
  assert.match(bareScript, /DerivedData\/bare-rn-/);
  assert.match(bareScript, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
});

test('PR path classification disables rename detection', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /git diff --name-only --no-renames "\$BEEUI_BASE_SHA" "\$BEEUI_HEAD_SHA"/);
});

test('verification fans out before classification and fans into stable verify status', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  verify-check:\n/m);
  assert.match(workflow, /task: \[static, tests, release\]/);
  assert.match(workflow, /^  showcase-bundle:\n/m);
  assert.match(workflow, /platform: \[web, android, ios\]/);
  assert.doesNotMatch(workflow, /^  verify-check:\n\s+needs:/m);
  assert.doesNotMatch(workflow, /^  showcase-bundle:\n\s+needs:/m);
  assert.match(workflow, /^  verify:\n\s+needs: \[classify, verify-check, showcase-bundle\]\n\s+if: always\(\)/m);
});

test('bare bundle and Android native compile are independent jobs after classify', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  bare-bundle:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /^  bare-android:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /bare-bundle:[\s\S]*Bundle bare consumer for Android and iOS/);
  assert.match(workflow, /bare-android:[\s\S]*Compile bare Android debug APK/);
  assert.doesNotMatch(workflow, /^  bare-android:\n\s+needs: \[bare-bundle\]/m);
});

test('Showcase and bare iOS compiles are independent macOS jobs', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /^  ios-showcase:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /^  ios-bare:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /ios-showcase:[\s\S]*Compile Showcase for iOS Simulator/);
  assert.match(workflow, /ios-bare:[\s\S]*Compile bare React Native consumer for iOS Simulator/);
  assert.doesNotMatch(workflow, /^  ios-bare:\n\s+needs: \[ios-showcase\]/m);
  assert.doesNotMatch(workflow, /^  ios-showcase:\n\s+needs: \[ios-bare\]/m);
});

test('native fan-out uses classifier-specific gates', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /bare-bundle:[\s\S]*package-boundary-required == 'true'[\s\S]*bare-native-required == 'true'/);
  assert.match(workflow, /bare-android:[\s\S]*if: needs\.classify\.outputs\.bare-native-required == 'true'/);
  assert.match(workflow, /ios-showcase:[\s\S]*if: needs\.classify\.outputs\.showcase-native-required == 'true'/);
  assert.match(workflow, /ios-bare:[\s\S]*if: needs\.classify\.outputs\.bare-native-required == 'true'/);
});

test('iOS jobs run pod install directly and do not persist DerivedData in Actions cache', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /run: pod install\b/);
  assert.match(workflow, /Cache CocoaPods/);
  assert.match(workflow, /~\/\.cocoapods/);
  assert.doesNotMatch(workflow, /- name: Cache Xcode DerivedData/);
  assert.doesNotMatch(workflow, /key: dd-macos-/);
});

test('weekly backstop still forces the full native graph', async () => {
  const { workflow } = await sources();
  assert.match(workflow, /schedule:\n\s+- cron: '47 2 \* \* 1'/);
  assert.match(workflow, /BEEUI_FORCE_NATIVE:[\s\S]*github\.event_name == 'schedule'/);
});

test('Expo independent-consumer iOS harness still performs a real simulator compile', async () => {
  const { expoScript } = await sources();
  assert.doesNotMatch(expoScript, /\n\s*bundle install\b/);
  assert.doesNotMatch(expoScript, /\n\s*bundle exec\b/);
  assert.match(expoScript, /\n\s*pod install\b/);
  assert.match(expoScript, /\.xcode\.env\.local/);
  assert.match(expoScript, /xcodebuild[\s\S]*-sdk iphonesimulator[\s\S]*\n\s*build\b/);
  assert.match(expoScript, /xcodebuild -workspace "\$\{workspace\}" -list -json/);
});
