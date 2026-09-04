import { appendFileSync, readFileSync } from 'node:fs';

import { isPackageBoundarySensitivePath } from './classify-ci-changes.mjs';

function normalizePath(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function uniqueFiles(values) {
  return [...new Set(values.map(normalizePath).filter(Boolean))].sort();
}

const PACKAGE_DOC_RE = /^packages\/(?:core|ui|tokens)\/(?:README\.md|CHANGELOG\.md|docs\/)/;
const PACKAGE_MANIFEST_RE = /^packages\/(?:core|ui|tokens)\/package\.json$/;

// The central orchestrator and its two classifiers are self-hosting CI policy.
// Any change to them gets one intentionally expensive full validation run so a
// broken optimization cannot teach CI to skip the evidence that would catch it.
const CI_CONTROL_PLANE_EXACT = new Set([
  '.github/workflows/ci.yml',
  'scripts/ci-scope.mjs',
  'scripts/classify-ci-changes.mjs',
]);

const DOC_EXACT = new Set(['README.md', 'CHANGELOG.md']);
const DOC_PREFIXES = ['docs/', 'apps/docs/'];
const DOC_SCRIPT_RE = /^scripts\/(?:check-public-doc|check-doc|generate-docs|generate-component-reference|generate-pattern-library|generate-llms|check-ai-agent-contract|check-public-surface|generate-public-surface)/;

const WEB_PREFIXES = ['web/', 'apps/docs/', 'apps/demo/'];
const WEB_SCRIPT_RE = /^scripts\/(?:build-public|check-public-web|check-public-site|generate-docs-foundation)/;

const VISUAL_PREFIXES = [
  'packages/ui/src/',
  'packages/tokens/src/',
  'apps/showcase/',
  'apps/visual-regression/',
  'apps/demo/',
  'registry/',
];

const TOKEN_PREFIXES = ['packages/tokens/src/', 'scripts/tokens/', 'scripts/__tests__/token'];
const TOKEN_EXACT = new Set([
  'packages/tokens/package.json',
  'packages/tokens/tokens.json',
  'scripts/generate-tokens.mjs',
  'scripts/check-token-removals.mjs',
  'scripts/check-semantic-token-consumption.mjs',
]);

const CONSUMER_EXACT = new Set([
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  'scripts/verify-web-consumer.sh',
  'scripts/verify-expo-consumer.sh',
  'scripts/verify-bare-consumer.sh',
]);

const EXPO_EXACT = new Set([
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  'scripts/verify-expo-consumer.sh',
  'apps/showcase/package.json',
  'apps/showcase/app.json',
  'apps/showcase/app.config.json',
  'apps/showcase/app.config.js',
  'apps/showcase/app.config.jsx',
  'apps/showcase/app.config.ts',
  'apps/showcase/app.config.mjs',
  'apps/showcase/app.config.cjs',
]);

const RELEASE_EXACT = new Set([
  'CHANGELOG.md',
  'scripts/verify-release.mjs',
  'scripts/pack-artifacts.mjs',
  '.github/workflows/ci.yml',
]);
const RELEASE_PREFIXES = ['.changeset/', 'scripts/release/'];

const BENCH_PREFIXES = ['scripts/benchmark/'];
const BENCH_EXACT = new Set(['scripts/__tests__/benchmark-statistics.test.mjs']);

function isDocsPath(file) {
  return (
    DOC_EXACT.has(file) ||
    PACKAGE_DOC_RE.test(file) ||
    DOC_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    DOC_SCRIPT_RE.test(file)
  );
}

function isWebPath(file) {
  return WEB_PREFIXES.some((prefix) => file.startsWith(prefix)) || WEB_SCRIPT_RE.test(file);
}

function isVisualPath(file) {
  return VISUAL_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isTokenPath(file) {
  return TOKEN_EXACT.has(file) || TOKEN_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isConsumerPath(file) {
  return isPackageBoundarySensitivePath(file) || CONSUMER_EXACT.has(file);
}

function isExpoPath(file) {
  return (
    isPackageBoundarySensitivePath(file) ||
    EXPO_EXACT.has(file) ||
    file.startsWith('apps/showcase/plugins/') ||
    file.startsWith('apps/showcase/ios/') ||
    file.startsWith('apps/showcase/android/')
  );
}

function isReleasePath(file) {
  return (
    PACKAGE_MANIFEST_RE.test(file) ||
    RELEASE_EXACT.has(file) ||
    RELEASE_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

function isBenchmarkPath(file) {
  return (
    BENCH_EXACT.has(file) ||
    BENCH_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    file.startsWith('scripts/__tests__/benchmark-') ||
    file.startsWith('scripts/__tests__/footprint-') ||
    file.startsWith('scripts/__tests__/budget-')
  );
}

function fullResult(files, reason) {
  return {
    files,
    docs: true,
    web: true,
    visual: true,
    package: true,
    tokens: true,
    showcase: true,
    consumer: true,
    expoConsumer: true,
    release: true,
    benchmark: true,
    reason,
  };
}

export function classifyCiScope(values, { forceFull = false } = {}) {
  const files = uniqueFiles(values);

  if (forceFull) return fullResult(files, 'full CI explicitly requested');
  if (files.length === 0) return fullResult(files, 'no changed paths supplied; failing safe to full CI');

  const controlPlaneFiles = files.filter((file) => CI_CONTROL_PLANE_EXACT.has(file));
  if (controlPlaneFiles.length > 0) {
    return fullResult(files, `CI control-plane changed: ${controlPlaneFiles.join(', ')}`);
  }

  const packageChanged = files.some(isPackageBoundarySensitivePath);
  const visualChanged = files.some(isVisualPath);
  const docsChanged = files.some(isDocsPath);
  const webChanged = docsChanged || files.some(isWebPath);
  const showcaseChanged =
    packageChanged || files.some((file) => file.startsWith('apps/showcase/') || file.startsWith('registry/'));

  return {
    files,
    docs: docsChanged,
    web: webChanged,
    visual: visualChanged,
    package: packageChanged,
    tokens: files.some(isTokenPath),
    showcase: showcaseChanged,
    consumer: files.some(isConsumerPath),
    expoConsumer: files.some(isExpoPath),
    release: files.some(isReleasePath),
    benchmark: files.some(isBenchmarkPath),
    reason: 'changed-path scope classification',
  };
}

function envFlag(name) {
  return /^(1|true|yes)$/i.test(process.env[name] ?? '');
}

function writeOutput(result) {
  if (!process.env.GITHUB_OUTPUT) return;
  for (const key of ['docs', 'web', 'visual', 'package', 'tokens', 'showcase', 'consumer', 'expoConsumer', 'release', 'benchmark']) {
    const outputName = key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`);
    appendFileSync(process.env.GITHUB_OUTPUT, `${outputName}=${result[key] ? 'true' : 'false'}\n`);
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `scope-reason=${result.reason.replace(/[\r\n]/g, ' ')}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const files = readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean);
  const result = classifyCiScope(files, { forceFull: envFlag('BEEUI_FORCE_FULL_CI') });
  console.log(JSON.stringify(result, null, 2));
  writeOutput(result);
}
