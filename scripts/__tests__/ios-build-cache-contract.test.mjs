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

test('Showcase pod-install caching restores the ENTIRE ios/ tree as one snapshot, not a hand-picked list of outputs', async () => {
  const { workflow } = await sources();

  // R3b keys off Podfile + pnpm-lock.yaml + app.json (not just the Podfile),
  // so a native dependency bump or app-config change busts the cache.
  assert.match(workflow, /pods-cache\/showcase\/xcode-\$\{safe_xcode_version\}\/key-\$\{pods_key\}/);
  assert.match(workflow, /cat Podfile "\$GITHUB_WORKSPACE\/pnpm-lock\.yaml" "\$GITHUB_WORKSPACE\/apps\/showcase\/app\.json" \| shasum -a 256/);

  // The cache holds a single whole-tree snapshot ($cache/ios), taken after a
  // real pod install (Pods/, Podfile.lock, *.xcworkspace, *.xcodeproj, AND
  // React Native codegen output under build/generated/ all fall out of this
  // for free) — not an enumerated per-item list, which previously missed
  // build/generated and broke the compile step on a skip.
  assert.match(workflow, /if \[ -d "\$cache\/ios" \]/);
  assert.match(workflow, /rsync -a --delete "\$cache\/ios\/" \.\//);
  assert.match(workflow, /rsync -a --delete --exclude '\.xcode\.env\.local' \.\/ "\$tmp_cache\/ios\/"/);

  // A restore failure must never delete the working tree (it still holds
  // the prebuild artifact's Podfile/native sources a fallback pod install
  // needs) — only fall through to a full pod install.
  assert.doesNotMatch(workflow, /ios\/ snapshot restore failed[\s\S]{0,80}rm -rf/);
});

test('Showcase pod install is skipped only when the restored manifest matches the restored lockfile, and is forced fresh on the nightly schedule', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /cmp -s Pods\/Manifest\.lock Podfile\.lock/);
  assert.match(workflow, /BEEUI_PODS_FRESH/);
  assert.match(workflow, /BEEUI_PODS_FRESH: \$\{\{ github\.event_name == 'schedule'/);
});

test('ci workflow gates the bare-consumer iOS leg and runs a nightly pristine backstop', async () => {
  const { workflow } = await sources();

  assert.match(workflow, /bare-consumer-required/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /BEEUI_BARE_CLEAN: \$\{\{ github\.event_name == 'schedule'/);
});
