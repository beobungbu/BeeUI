import { appendFileSync, readFileSync } from 'node:fs';

import { isPackageBoundarySensitivePath } from './classify-ci-changes.mjs';

// `git diff --name-only` quotes any path with non-ASCII or special characters
// and escapes the bytes in octal (core.quotePath defaults to true). Decoding it
// here keeps a component named `bézier.tsx` from classifying as no lane at all,
// even if a caller forgets `-c core.quotePath=false -z`.
function decodeQuotedPath(value) {
  if (!value.startsWith('"') || !value.endsWith('"') || value.length < 2) return value;
  const body = value.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== '\\') {
      bytes.push(body.charCodeAt(i));
      continue;
    }
    const octal = /^[0-7]{3}/.exec(body.slice(i + 1, i + 4));
    if (octal) {
      bytes.push(parseInt(octal[0], 8));
      i += 3;
      continue;
    }
    const escapes = { n: 10, t: 9, r: 13, '"': 34, '\\': 92 };
    const mapped = escapes[body[i + 1]];
    if (mapped === undefined) return value;
    bytes.push(mapped);
    i += 1;
  }
  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
}

function normalizePath(value) {
  const raw = String(value ?? '').trim();
  // Backslashes are legal inside a POSIX filename, so only rewrite them once
  // the git quoting has been removed.
  return decodeQuotedPath(raw).replaceAll('\\', '/').replace(/^\.\//, '');
}

function uniqueFiles(values) {
  return [...new Set(values.map(normalizePath).filter(Boolean))].sort();
}

const PACKAGE_DOC_RE = /^packages\/(?:core|ui|tokens)\/(?:README\.md$|CHANGELOG\.md$|docs\/)/;
const PACKAGE_MANIFEST_RE = /^packages\/(?:core|ui|tokens)\/package\.json$/;

// The central orchestrator and its two classifiers are self-hosting CI policy.
// Any change to them gets one intentionally expensive full validation run so a
// broken optimization cannot teach CI to skip the evidence that would catch it.
const CI_CONTROL_PLANE_EXACT = new Set(['scripts/ci-scope.mjs', 'scripts/classify-ci-changes.mjs']);
const CI_CONTROL_PLANE_PREFIXES = ['.github/workflows/'];

function isControlPlanePath(file) {
  return CI_CONTROL_PLANE_EXACT.has(file) || CI_CONTROL_PLANE_PREFIXES.some((prefix) => file.startsWith(prefix));
}

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

const TOKEN_PREFIXES = ['packages/tokens/src/', 'scripts/tokens/'];
// Token behaviour suites are named after the token surface they cover
// (density-tokens, responsive-layout-tokens, theme-overrides-tokens), not after
// a script, so match the suffix rather than a script name.
const TOKEN_TEST_RE = /^scripts\/__tests__\/[a-z0-9-]*tokens?[a-z0-9-]*\.test\.mjs$/;
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

// packages/cli publishes the `beeui` binary but has no native surface, so it
// needs the build/typecheck lane without pulling in the native compilers.
const BUILD_ONLY_PREFIXES = ['packages/cli/'];

// Anything that decides how the whole workspace compiles. Root package.json is
// listed here for the JS lanes only; classify-ci-changes.mjs deliberately keeps
// it out of the native graph so a scripts-only edit does not boot a simulator.
const BUILD_CONFIG_EXACT = new Set([
  'package.json',
  'tsconfig.base.json',
  'eslint.config.mjs',
  '.nvmrc',
  '.node-version',
]);

// A dependency-graph change can alter anything the workspace compiles or
// renders. react-native, reanimated and expo bumps are the highest-risk change
// class in this repo, and they used to select the consumer lanes and a
// 120-minute macOS job while skipping build, typecheck, tests and every
// screenshot — the cost and the coverage were inverted.
const DEPENDENCY_GRAPH_EXACT = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc']);

function isDependencyGraphPath(file) {
  return DEPENDENCY_GRAPH_EXACT.has(file);
}

// Generated public artifacts and the code that produces or asserts them.
const DOC_ARTIFACT_RE = /^llms(?:-[a-z]+)?\.txt$/;
const DOC_EXTRA_EXACT = new Set(['AGENTS.md']);
const DOC_LIB_RE = /^scripts\/(?:component-docs-lib|component-props-lib|public-component-reference|public-pattern-reference|public-reference|public-guide-data|public-portal-shell|generate-production-pattern-usage|check-portal-pages-fresh|public-docs-a11y|report-prop-coverage|check-docs-page-budget)\.mjs$/;

const WEB_PREFIXES_EXTRA = ['scripts/public-web-checks/', 'examples/', '.github/deployment/'];
const WEB_LIB_RE = /^scripts\/(?:public-site-contract-lib|public-component-previews)\.mjs$/;
const WEB_TEST_RE = /^scripts\/__tests__\/public-[a-z0-9-]+\.test\.mjs$/;

const TOKEN_EXTRA_PREFIXES = ['scripts/vendor/dtcg/'];
const TOKEN_EXTRA_EXACT = new Set([
  'scripts/token-lifecycle.mjs',
  'scripts/validate-dtcg-schemas.mjs',
  'scripts/generate-token-migration-report.mjs',
]);

const SHOWCASE_EXTRA_EXACT = new Set([
  'scripts/beeui.mjs',
  'scripts/registry-lib.mjs',
  'scripts/verify-registry.mjs',
]);
// The CLI suites exercise `beeui add` against the registry.
const SHOWCASE_TEST_RE = /^scripts\/__tests__\/beeui[a-z0-9-]*\.test\.mjs$/;

// The export-map suite is named after what it verifies rather than after the
// generator script, so the companion rule cannot derive it.
const PACKAGE_EXTRA_EXACT = new Set([
  'scripts/generate-ui-exports.mjs',
  'scripts/__tests__/verify-ui-export-map.test.mjs',
]);

// A `scripts/__tests__/x.test.mjs` file exists to verify a script named after
// it, so it routes exactly like that script. Deriving this beats maintaining a
// second list that silently drifts out of step with the first. Repo convention
// prefixes the implementation with check-/generate-/verify-, so try each.
const COMPANION_SCRIPT_PREFIXES = ['', 'check-', 'generate-', 'verify-'];

function companionScriptPaths(file) {
  const match = /^scripts\/__tests__\/(.+)\.test\.mjs$/.exec(file);
  if (!match) return [];
  return COMPANION_SCRIPT_PREFIXES.map((prefix) => `scripts/${prefix}${match[1]}.mjs`);
}

// Routes a path through `predicate`, also trying the scripts a test may cover.
function matchesWithCompanion(file, predicate) {
  if (predicate(file)) return true;
  return companionScriptPaths(file).some(predicate);
}

function isDocsPath(file) {
  return (
    DOC_EXACT.has(file) ||
    PACKAGE_DOC_RE.test(file) ||
    DOC_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    DOC_SCRIPT_RE.test(file) ||
    DOC_EXTRA_EXACT.has(file) ||
    DOC_ARTIFACT_RE.test(file) ||
    DOC_LIB_RE.test(file)
  );
}

function isWebPath(file) {
  return (
    WEB_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    WEB_PREFIXES_EXTRA.some((prefix) => file.startsWith(prefix)) ||
    WEB_SCRIPT_RE.test(file) ||
    WEB_LIB_RE.test(file) ||
    WEB_TEST_RE.test(file)
  );
}

// The docs portal's accessibility audit lives in the visual lane, so the lane must also be
// selected by the things that audit validates: the post-processing step that makes code blocks
// and tables keyboard-reachable, and the portal content itself. Without this, `web-a11y` does
// not run on a pull request that changes either — the audit is absent from exactly the change
// that could break it, which is the failure shape this whole program keeps closing.
// `web-a11y` is the only job that builds the docs portal (its Playwright webServer runs
// `pnpm --filter @beemvp/beeui-docs build`), and that build is where the keyboard-reachability,
// page-weight and search-intent checks actually run. So the lane must be selected by anything
// that can change what those checks see, which is the whole docs app — its content, its config,
// its build chain, and the public assets that land in `dist` and count against the budget — plus
// the check scripts themselves. Listing only the content directory left the search check and its
// ranking module able to change without the job that runs them ever starting.
const VISUAL_A11Y_EXACT = new Set([
  'scripts/check-docs-page-budget.mjs',
  'scripts/check-docs-search-intent.mjs',
  'scripts/public-docs-a11y.mjs',
]);
const VISUAL_A11Y_PREFIXES = ['apps/docs/'];

function isVisualPath(file) {
  return (
    VISUAL_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    VISUAL_A11Y_EXACT.has(file) ||
    VISUAL_A11Y_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

function isTokenPath(file) {
  return (
    TOKEN_EXACT.has(file) ||
    TOKEN_EXTRA_EXACT.has(file) ||
    TOKEN_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    TOKEN_EXTRA_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    TOKEN_TEST_RE.test(file)
  );
}

// The build/typecheck lane: the published package graph plus anything that
// changes how it compiles.
function isBuildPath(file) {
  return BUILD_CONFIG_EXACT.has(file) || BUILD_ONLY_PREFIXES.some((prefix) => file.startsWith(prefix)) || PACKAGE_EXTRA_EXACT.has(file);
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

  const controlPlaneFiles = files.filter(isControlPlanePath);
  if (controlPlaneFiles.length > 0) {
    return fullResult(files, `CI control-plane changed: ${controlPlaneFiles.join(', ')}`);
  }

  const sourceChanged = files.some((file) => matchesWithCompanion(file, isPackageBoundarySensitivePath));

  // Lanes are named after where a file lives, but the gates inside them are
  // named after what they read, and three of them read published package
  // source: the docs artifacts are generated from it, the semantic-token
  // consumption gate scans packages/ui/src, and every screenshot renders it.
  // Without this inheritance a component edit skips the very gates that exist
  // to police it, and the drift only surfaces on someone else's later PR.
  const dependencyGraphChanged = files.some(isDependencyGraphPath);

  const visualChanged =
    sourceChanged || dependencyGraphChanged || files.some((file) => matchesWithCompanion(file, isVisualPath));
  const docsChanged = sourceChanged || files.some((file) => matchesWithCompanion(file, isDocsPath));
  const tokensChanged = sourceChanged || files.some((file) => matchesWithCompanion(file, isTokenPath));

  const webChanged = docsChanged || files.some((file) => matchesWithCompanion(file, isWebPath));
  const showcaseChanged =
    sourceChanged ||
    dependencyGraphChanged ||
    files.some(
      (file) =>
        file.startsWith('apps/showcase/') ||
        file.startsWith('registry/') ||
        SHOWCASE_EXTRA_EXACT.has(file) ||
        SHOWCASE_TEST_RE.test(file),
    );

  return {
    files,
    docs: docsChanged,
    web: webChanged,
    visual: visualChanged,
    package: sourceChanged || dependencyGraphChanged || files.some((file) => matchesWithCompanion(file, isBuildPath)),
    tokens: tokensChanged,
    showcase: showcaseChanged,
    consumer: files.some((file) => matchesWithCompanion(file, isConsumerPath)),
    expoConsumer: files.some((file) => matchesWithCompanion(file, isExpoPath)),
    release: files.some((file) => matchesWithCompanion(file, isReleasePath)),
    benchmark: files.some((file) => matchesWithCompanion(file, isBenchmarkPath)),
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
  // Callers pass `git diff -z`, which separates paths with NUL so a filename
  // containing a newline cannot split into two bogus paths.
  const files = readFileSync(0, 'utf8').split(/\r?\n|\0/).filter(Boolean);
  const result = classifyCiScope(files, { forceFull: envFlag('BEEUI_FORCE_FULL_CI') });
  console.log(JSON.stringify(result, null, 2));
  writeOutput(result);
}
