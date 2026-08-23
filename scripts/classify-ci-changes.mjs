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
  'apps/showcase/patterns/',
  'apps/showcase/__tests__/patterns/',
];

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

function envFlag(name) {
  return /^(1|true|yes)$/i.test(process.env[name] ?? '');
}

function writeGithubOutput(result) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `ios-native=${result.iosNative ? 'true' : 'false'}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `reason=${result.reason.replace(/[\r\n]/g, ' ')}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = readFileSync(0, 'utf8');
  const files = input.split(/\r?\n/).filter(Boolean);
  const result = classifyNativeIosChanges(files, {
    forceNative: envFlag('BEEUI_FORCE_NATIVE'),
  });

  console.log(JSON.stringify(result, null, 2));
  writeGithubOutput(result);
}
