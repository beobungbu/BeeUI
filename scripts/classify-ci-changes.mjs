import { appendFileSync, readFileSync } from 'node:fs';

const SAFE_EXACT_PATHS = new Set([
  'README.md',
  'CHANGELOG.md',
  'scripts/beeui.mjs',
  'scripts/registry-lib.mjs',
  'scripts/verify-registry.mjs',
  'scripts/__tests__/beeui.test.mjs',
]);

const SAFE_PREFIXES = [
  'docs/',
  'registry/',
  'apps/visual-regression/',
  'apps/showcase/__tests__/patterns/',
];

// The bare-consumer leg only re-verifies the packaged surface it consumes
// through the tarball boundary, so it is gated by a narrower set of paths
// than the full ios-native job.
const BARE_CONSUMER_PREFIXES = ['packages/core/', 'packages/ui/', 'packages/tokens/'];
const BARE_CONSUMER_EXACT_PATHS = new Set(['scripts/verify-bare-consumer.sh']);

function normalizePath(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

export function isNativeIosSafePath(value) {
  const file = normalizePath(value);
  if (!file) return false;
  if (SAFE_EXACT_PATHS.has(file)) return true;
  return SAFE_PREFIXES.some((prefix) => file.startsWith(prefix));
}

export function isBareConsumerSensitivePath(value) {
  const file = normalizePath(value);
  if (!file) return false;
  if (BARE_CONSUMER_EXACT_PATHS.has(file)) return true;
  return BARE_CONSUMER_PREFIXES.some((prefix) => file.startsWith(prefix));
}

export function classifyNativeIosChanges(values, { forceNative = false } = {}) {
  const files = [...new Set(values.map(normalizePath).filter(Boolean))].sort();

  if (forceNative) {
    return {
      iosNative: true,
      reason: 'forced native verification',
      files,
      nativeSensitiveFiles: files,
    };
  }

  // Fail safe. A pull request should always have a changed path, so an empty
  // list means the classifier did not receive enough evidence to skip native.
  if (files.length === 0) {
    return {
      iosNative: true,
      reason: 'no changed paths supplied; running native fail-safe',
      files,
      nativeSensitiveFiles: [],
    };
  }

  const nativeSensitiveFiles = files.filter((file) => !isNativeIosSafePath(file));
  if (nativeSensitiveFiles.length > 0) {
    return {
      iosNative: true,
      reason: `native-sensitive paths changed: ${nativeSensitiveFiles.join(', ')}`,
      files,
      nativeSensitiveFiles,
    };
  }

  return {
    iosNative: false,
    reason: 'all changed paths are classified as native-iOS-safe',
    files,
    nativeSensitiveFiles: [],
  };
}

export function classifyBareConsumerChanges(values, { forceNative = false } = {}) {
  const files = [...new Set(values.map(normalizePath).filter(Boolean))].sort();

  if (forceNative) {
    return {
      bareConsumer: true,
      reason: 'forced native verification',
      files,
      bareConsumerSensitiveFiles: files,
    };
  }

  // Fail safe. A pull request should always have a changed path, so an empty
  // list means the classifier did not receive enough evidence to skip the
  // bare-consumer leg.
  if (files.length === 0) {
    return {
      bareConsumer: true,
      reason: 'no changed paths supplied; running bare-consumer verification fail-safe',
      files,
      bareConsumerSensitiveFiles: [],
    };
  }

  const bareConsumerSensitiveFiles = files.filter((file) => isBareConsumerSensitivePath(file));
  if (bareConsumerSensitiveFiles.length > 0) {
    return {
      bareConsumer: true,
      reason: `bare-consumer-sensitive paths changed: ${bareConsumerSensitiveFiles.join(', ')}`,
      files,
      bareConsumerSensitiveFiles,
    };
  }

  return {
    bareConsumer: false,
    reason: 'no changed paths affect the bare-consumer package boundary',
    files,
    bareConsumerSensitiveFiles: [],
  };
}

function envFlag(name) {
  return /^(1|true|yes)$/i.test(process.env[name] ?? '');
}

function writeGithubOutput(result, bareConsumerResult) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `ios-native=${result.iosNative ? 'true' : 'false'}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `reason=${result.reason.replace(/[\r\n]/g, ' ')}\n`);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `bare-consumer=${bareConsumerResult.bareConsumer ? 'true' : 'false'}\n`,
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `bare-consumer-reason=${bareConsumerResult.reason.replace(/[\r\n]/g, ' ')}\n`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = readFileSync(0, 'utf8');
  const files = input.split(/\r?\n/).filter(Boolean);
  const forceNative = envFlag('BEEUI_FORCE_NATIVE');
  const result = classifyNativeIosChanges(files, { forceNative });
  const bareConsumerResult = classifyBareConsumerChanges(files, { forceNative });

  console.log(
    JSON.stringify(
      {
        iosNative: result.iosNative,
        reason: result.reason,
        files: result.files,
        nativeSensitiveFiles: result.nativeSensitiveFiles,
        bareConsumer: bareConsumerResult.bareConsumer,
        bareConsumerReason: bareConsumerResult.reason,
        bareConsumerSensitiveFiles: bareConsumerResult.bareConsumerSensitiveFiles,
      },
      null,
      2,
    ),
  );
  writeGithubOutput(result, bareConsumerResult);
}
