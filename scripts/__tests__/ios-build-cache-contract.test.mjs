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
    /Compile bare Android debug APK\n\s+if: needs\.verify\.outputs\.bare-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Setup Java\n\s+if: needs\.verify\.outputs\.bare-native-required == 'true'/,
  );
});

test('Expo prebuild and Showcase Xcode work run only for Showcase native graph changes', async () => {
  const { workflow } = await sources();

  assert.match(
    workflow,
    /Generate native projects with Expo Prebuild\n\s+if: steps\.native-changes\.outputs\.showcase-native == 'true'/,
  );
  assert.match(
    workflow,
    /Download generated iOS project source\n\s+if: needs\.verify\.outputs\.showcase-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Compile Showcase for iOS Simulator\n\s+if: needs\.verify\.outputs\.showcase-native-required == 'true'/,
  );
});

test('bare iOS compile runs only for bare native graph changes', async () => {
  const { workflow } = await sources();

  assert.match(
    workflow,
    /Prepare true bare React Native consumer for iOS\n\s+if: needs\.verify\.outputs\.bare-native-required == 'true'/,
  );
  assert.match(
    workflow,
    /Compile bare React Native consumer for iOS Simulator\n\s+if: needs\.verify\.outputs\.bare-native-required == 'true'/,
  );
});

test('ios-native tolerates a skipped boundary job but never bypasses verify or a failed bare job', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /always\(\)/);
  assert.match(workflow, /needs\.verify\.result == 'success'/);
  assert.match(
    workflow,
    /needs\.bare-native\.result == 'success' \|\| needs\.bare-native\.result == 'skipped'/,
  );
  assert.match(workflow, /needs\.verify\.outputs\.ios-native-required == 'true'/);
});

test('Showcase pod-install caching keys whole-tree snapshots from the fresh prebuild before restore', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /prebuild_hash=/);
  assert.ok(workflow.includes("find . \\( -type f -o -type l \\) ! -name '.xcode.env.local' -print"));
  assert.match(workflow, /pods_key=.*prebuild_hash.*lock_hash.*app_hash/s);
  assert.match(workflow, /pods-cache\/showcase\/xcode-\$\{safe_xcode_version\}\/key-\$\{pods_key\}/);
  assert.match(workflow, /elif \[ -d "\$cache\/ios" \]/);
  assert.match(workflow, /rsync -a --delete "\$cache\/ios\/" \.\//);
  assert.match(workflow, /rsync -a --delete --exclude '\.xcode\.env\.local' \.\/ "\$tmp_cache\/ios\/"/);
  assert.doesNotMatch(workflow, /ios\/ snapshot restore failed[\s\S]{0,80}rm -rf/);
});

test('nightly pod validation bypasses snapshot restore and performs pod install on the fresh prebuild', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /BEEUI_PODS_FRESH: \$\{\{ github\.event_name == 'schedule'/);
  assert.match(workflow, /if \[ -n "\$\{BEEUI_PODS_FRESH:-\}" \]; then/);
  assert.match(workflow, /Fresh pod install requested; bypassing ios\/ snapshot restore/);
  assert.match(workflow, /if \[ "\$restore_ok" -eq 1 \] && cmp -s Pods\/Manifest\.lock Podfile\.lock/);
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
