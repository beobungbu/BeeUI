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

test('bare RN iOS build keeps a fresh consumer while moving reusable compiler and Ruby outputs outside RUNNER_TEMP', async () => {
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

test('PR path classification disables rename detection so moves out of packages cannot false-skip bare verification', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /git diff --name-only --no-renames "\$BEEUI_BASE_SHA" "\$BEEUI_HEAD_SHA"/);
});

test('Showcase pod-install caching keys whole-tree snapshots from the fresh prebuild before restore', async () => {
  const { workflow } = await sources();

  // The post-install snapshot may safely replace the working tree only when it
  // was produced from the exact same fresh Expo prebuild. Hashing the complete
  // downloaded ios/ tree before any restore prevents stale generated native
  // sources, config-plugin output, or codegen inputs from compiling green.
  assert.match(workflow, /prebuild_hash=/);
  assert.match(workflow, /find \. \\( -type f -o -type l \\)/);
  assert.match(workflow, /pods_key=.*prebuild_hash.*lock_hash.*app_hash/s);
  assert.match(workflow, /pods-cache\/showcase\/xcode-\$\{safe_xcode_version\}\/key-\$\{pods_key\}/);

  // The cache still holds the whole post-install tree so CocoaPods integration
  // and RN codegen outputs are restored together on a valid hot hit.
  assert.match(workflow, /elif \[ -d "\$cache\/ios" \]/);
  assert.match(workflow, /rsync -a --delete "\$cache\/ios\/" \.\//);
  assert.match(workflow, /rsync -a --delete --exclude '\.xcode\.env\.local' \.\/ "\$tmp_cache\/ios\/"/);

  // A restore failure must never delete the fresh prebuild tree; it falls
  // through to pod install, which self-corrects partial state.
  assert.doesNotMatch(workflow, /ios\/ snapshot restore failed[\s\S]{0,80}rm -rf/);
});

test('nightly pod validation bypasses snapshot restore and performs pod install on the fresh prebuild', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /BEEUI_PODS_FRESH: \$\{\{ github\.event_name == 'schedule'/);
  assert.match(workflow, /if \[ -n "\$\{BEEUI_PODS_FRESH:-\}" \]; then/);
  assert.match(workflow, /Fresh pod install requested; bypassing ios\/ snapshot restore/);
  assert.match(workflow, /if \[ "\$restore_ok" -eq 1 \] && cmp -s Pods\/Manifest\.lock Podfile\.lock/);
});

test('ci workflow gates the bare-consumer iOS leg and runs an isolated nightly pristine backstop', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /bare-consumer-required/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /BEEUI_BARE_CLEAN: \$\{\{ github\.event_name == 'schedule'/);
  assert.match(
    workflow,
    /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/,
  );
});
