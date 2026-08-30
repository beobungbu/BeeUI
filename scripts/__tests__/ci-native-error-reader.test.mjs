import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_PATH = path.join(__dirname, '..', 'ci-native-error-reader.mjs');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'ci-logs');

function runOnFixture(fixtureName) {
  const result = spawnSync(
    process.execPath,
    [TOOL_PATH, '--file', path.join(FIXTURE_DIR, fixtureName)],
    { encoding: 'utf8' },
  );
  return result;
}

test('ios-native: pinpoints the shell unbound-variable error, not the tail', () => {
  const result = runOnFixture('ios-native-shell-unbound-variable.txt');
  assert.equal(result.status, 1, 'a real failure must exit non-zero');
  assert.match(
    result.stdout,
    /verify-bare-consumer\.sh: line 108: extra_flags\[@\]: unbound variable/,
    'must surface the true root-cause shell error line',
  );
  assert.match(
    result.stdout,
    /^Classification: iOS: shell error/m,
    'must classify as an iOS shell error',
  );
  assert.match(result.stdout, /##\[error\]Process completed with exit code 1\./);
});

test('android-runtime: pinpoints the Unknown AVD name error, not the tail', () => {
  const result = runOnFixture('android-runtime-unknown-avd.txt');
  assert.equal(result.status, 1, 'a real failure must exit non-zero');
  assert.match(
    result.stdout,
    /Unknown AVD name \[beeui-runtime-api36\]/,
    'must surface the true root-cause AVD error line',
  );
  assert.match(
    result.stdout,
    /^Classification: Android: Android emulator failed to boot/m,
    'must classify as an Android emulator/AVD failure',
  );
});

test('ios-runtime: pinpoints the Maestro assertion failure, not the tail', () => {
  const result = runOnFixture('ios-runtime-maestro-assertion-failed.txt');
  assert.equal(result.status, 1, 'a real failure must exit non-zero');
  assert.match(
    result.stdout,
    /Assertion 'id: runtime-stress-popover-content is visible' failed/,
    'must surface the true root-cause Maestro assertion line',
  );
  assert.match(
    result.stdout,
    /^Classification: iOS: Maestro runtime assertion failed/m,
    'must classify as an iOS Maestro runtime failure',
  );
});

test('bare-android: pinpoints the Kotlin Unresolved reference error, not the tail', () => {
  const result = runOnFixture('bare-android-kotlin-unresolved-reference.txt');
  assert.equal(result.status, 1, 'a real failure must exit non-zero');
  assert.match(
    result.stdout,
    /Unresolved reference 'uiImplementation'/,
    'must surface the true root-cause Kotlin compile error line',
  );
  assert.match(
    result.stdout,
    /^Classification: Android: Kotlin compile error/m,
    'must classify as an Android Kotlin compile error',
  );
});

test('a clean log with no ##[error] marker reports no failure and exits zero', () => {
  const result = spawnSync(process.execPath, [TOOL_PATH], {
    encoding: 'utf8',
    input: 'ios-native\tBuild\t2026-01-01T00:00:00.0000000Z ** BUILD SUCCEEDED **\n',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No failure marker/);
});

test('--file on a missing path fails loudly instead of silently succeeding', () => {
  const result = spawnSync(process.execPath, [TOOL_PATH, '--file', path.join(FIXTURE_DIR, 'does-not-exist.txt')], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
});
