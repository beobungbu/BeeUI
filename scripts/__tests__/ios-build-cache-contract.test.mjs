import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');

const workflowPath = path.join(repoRoot, '.github/workflows/ci.yml');
const bareScriptPath = path.join(repoRoot, 'scripts/verify-bare-consumer.sh');

async function sources() {
  const [workflow, bareScript] = await Promise.all([
    readFile(workflowPath, 'utf8'),
    readFile(bareScriptPath, 'utf8'),
  ]);
  return { workflow, bareScript };
}

test('Showcase iOS build keeps persistent keyed DerivedData and Xcode compilation caching enabled', async () => {
  const { workflow } = await sources();

  assert.doesNotMatch(workflow, /rm -rf "\$RUNNER_TEMP\/beeui-derived-data"/);
  assert.match(workflow, /Library\/Caches\/BeeUI/);
  assert.match(workflow, /Podfile\.lock/);
  assert.match(workflow, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
  assert.match(workflow, /-showBuildTimingSummary/);
});

test('bare RN iOS build keeps reusable compiler and Ruby outputs outside RUNNER_TEMP', async () => {
  const { bareScript } = await sources();

  assert.match(bareScript, /rm -rf "\$\{WORK_ROOT\}"/);
  assert.match(bareScript, /Library\/Caches\/BeeUI/);
  assert.match(bareScript, /bundle\/ruby-/);
  assert.match(bareScript, /DerivedData\/bare-rn-/);
  assert.match(bareScript, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
  assert.match(bareScript, /-showBuildTimingSummary/);
});

test('bare RN consumer reuse is fail-safe: fingerprint-gated, forced clean on schedule', async () => {
  const { bareScript } = await sources();

  assert.match(bareScript, /BEEUI_BARE_CLEAN/);
  assert.match(bareScript, /\.beeui-bare-fingerprint/);
  assert.match(bareScript, /rm -rf node_modules\/@beeui/);
});

test('PR path classification disables rename detection so moves out of packages preserve the deleted path', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /git diff --name-only --no-renames "\$BEEUI_BASE_SHA" "\$BEEUI_HEAD_SHA"/);
});

test('workflow exposes separate package-boundary, bare-native and Showcase-native gates', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /package-boundary-required:/);
  assert.match(workflow, /bare-native-required:/);
  assert.match(workflow, /showcase-native-required:/);
  assert.match(workflow, /ios-native-required:/);
});

test('pure package changes keep boundary prepare/bundle while Gradle is native-graph gated', async () => {
  const { workflow } = await sources();

  assert.match(
    workflow,
    /Prepare true bare React Native consumer[\s\S]*package-boundary-required == 'true'[\s\S]*bare-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Bundle bare consumer for Android and iOS[\s\S]*package-boundary-required == 'true'[\s\S]*bare-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Compile bare Android debug APK\n\s+if: needs\.classify\.outputs\.bare-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Setup Java\n\s+if: needs\.classify\.outputs\.bare-native-required == 'true'/,
  );
});

test('Expo prebuild and Showcase Xcode work run only for Showcase native graph changes', async () => {
  const { workflow } = await sources();

  assert.match(
    workflow,
    /Generate native projects with Expo Prebuild\n\s+if: needs\.classify\.outputs\.showcase-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Compile Showcase for iOS Simulator\n\s+if: needs\.classify\.outputs\.showcase-native-required == 'true'/,
  );
});

test('bare iOS compile runs only for bare native graph changes', async () => {
  const { workflow } = await sources();

  assert.match(
    workflow,
    /Prepare true bare React Native consumer for iOS\n\s+if: needs\.classify\.outputs\.bare-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Compile bare React Native consumer for iOS Simulator\n\s+if: needs\.classify\.outputs\.bare-native-required == 'true'/,
  );
});

test('classify is the sole gate for the parallel verify/bare-native/ios-native graph', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /^\s{2}classify:\n/m);
  assert.match(workflow, /^\s{2}verify:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /^\s{2}bare-native:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /^\s{2}ios-native:\n\s+needs: \[classify\]/m);
  assert.match(workflow, /needs\.classify\.outputs\.ios-native-required == 'true'/);
  // ios-native self-prebuilds instead of depending on verify/bare-native or
  // downloading verify's artifact, so the three heavy jobs run in parallel.
  assert.doesNotMatch(workflow, /needs: \[verify(?:, bare-native)?\]/);
  assert.doesNotMatch(workflow, /Download generated iOS project source/);
});

test('ios-native runs a plain pod install on PATH with no self-hosted snapshot rsync', async () => {
  const { workflow } = await sources();

  // Github-hosted runners are ephemeral, so the whole-tree post-install ios/
  // snapshot mechanism (fingerprint the fresh prebuild, rsync-restore, rsync
  // back to a persistent cache root) cannot survive across jobs. It has been
  // replaced by a real `pod install` on every run plus the CocoaPods
  // spec/download cache asserted below.
  assert.match(workflow, /run: pod install\b/);
  assert.doesNotMatch(workflow, /\/opt\/homebrew\/bin\/pod install/);
  assert.doesNotMatch(workflow, /BEEUI_PODS_FRESH/);
  assert.doesNotMatch(workflow, /pods-cache\/showcase/);
  assert.doesNotMatch(workflow, /rsync -a --delete/);
});

test('ios-native caches CocoaPods spec/download data and Xcode DerivedData via actions/cache', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /Cache CocoaPods/);
  assert.match(workflow, /~\/\.cocoapods/);
  assert.match(workflow, /~\/Library\/Caches\/CocoaPods/);
  assert.match(workflow, /key: pods-macos-\$\{\{ hashFiles\('pnpm-lock\.yaml'\) \}\}/);

  assert.match(workflow, /Cache Xcode DerivedData/);
  assert.match(workflow, /path: ~\/Library\/Developer\/Xcode\/DerivedData/);
  assert.match(workflow, /key: dd-macos-\$\{\{ hashFiles\('pnpm-lock\.yaml'\) \}\}/);
  assert.match(workflow, /derived_data="\$HOME\/Library\/Developer\/Xcode\/DerivedData\/showcase/);
});

test('nightly remains an isolated pristine full-native backstop', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /BEEUI_BARE_CLEAN: \$\{\{ github\.event_name == 'schedule'/);
  assert.match(
    workflow,
    /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/,
  );
});
