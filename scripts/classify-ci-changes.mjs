import { appendFileSync, readFileSync } from 'node:fs';

const PACKAGE_PREFIXES = ['packages/core/', 'packages/ui/', 'packages/tokens/'];
const PACKAGE_NAMES = '(?:core|ui|tokens)';
const PACKAGE_MANIFEST_RE = new RegExp(`^packages/${PACKAGE_NAMES}/package\\.json$`);
const PACKAGE_SRC_RE = new RegExp(`^packages/${PACKAGE_NAMES}/src/`);
const PACKAGE_TSCONFIG_RE = new RegExp(`^packages/${PACKAGE_NAMES}/tsconfig\\.json$`);

// BeeUI currently ships no native implementation. Source files with these
// extensions are therefore package/runtime inputs only unless they match an
// official React Native Codegen spec naming convention. Metro/typecheck/release
// verification proves ordinary runtime source without spending native compiler
// time. New top-level native package surfaces still fail closed below.
const JS_RUNTIME_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
]);

const REACT_NATIVE_CODEGEN_SPEC_BASENAME_RE =
  /^(?:Native[A-Za-z0-9_].*|.*NativeComponent)\.(?:js|jsx|ts|tsx)$/;

const SAFE_EXACT_PATHS = new Set([
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'scripts/beeui.mjs',
  'scripts/registry-lib.mjs',
  'scripts/verify-registry.mjs',
  // This script owns only the isolated bare consumer. It remains bare-native
  // sensitive below but must not pull the independent Expo Showcase graph.
  'scripts/verify-bare-consumer.sh',
]);

const SAFE_PREFIXES = [
  'docs/',
  'registry/',
  'apps/visual-regression/',
  'apps/showcase/__tests__/',
  'scripts/__tests__/',
];

const PACKAGE_BOUNDARY_EXACT_PATHS = new Set(['scripts/verify-bare-consumer.sh']);

// Changes here can change the exact native dependency/tooling graph of the
// isolated bare React Native consumer.
const BARE_NATIVE_EXACT_PATHS = new Set([
  'scripts/verify-bare-consumer.sh',
  '.github/workflows/ci.yml',
  'scripts/classify-ci-changes.mjs',
]);

// These repository-level inputs can change Expo/React Native dependency
// resolution or generated native configuration for the Showcase app.
const SHOWCASE_NATIVE_EXACT_PATHS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  '.github/workflows/ci.yml',
  'scripts/classify-ci-changes.mjs',
  'apps/showcase/package.json',
  'apps/showcase/app.json',
  'apps/showcase/app.config.json',
  'apps/showcase/app.config.js',
  'apps/showcase/app.config.jsx',
  'apps/showcase/app.config.ts',
  'apps/showcase/app.config.mjs',
  'apps/showcase/app.config.cjs',
  'apps/showcase/react-native.config.js',
  'apps/showcase/react-native.config.mjs',
  'apps/showcase/react-native.config.cjs',
]);

const SHOWCASE_NATIVE_PREFIXES = [
  'apps/showcase/ios/',
  'apps/showcase/android/',
  'apps/showcase/plugins/',
];

// Only known executable/runtime surfaces are carved out as native-safe.
// Arbitrary JS/TS/JSON elsewhere under apps/showcase fails closed because an
// Expo app.config.* file may import local helpers/config plugins that mutate the
// generated iOS/Android projects during prebuild.
const SHOWCASE_RUNTIME_EXACT_PATHS = new Set([
  'apps/showcase/App.tsx',
  'apps/showcase/index.ts',
  'apps/showcase/global.css',
  'apps/showcase/expo-env.d.ts',
  'apps/showcase/metro.config.js',
  'apps/showcase/tsconfig.json',
]);

const SHOWCASE_RUNTIME_PREFIXES = [
  'apps/showcase/patterns/',
  'apps/showcase/pattern-gallery/',
  'apps/showcase/component-gallery/',
  'apps/showcase/__mocks__/',
];

function normalizePath(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function basenameOf(file) {
  return file.slice(file.lastIndexOf('/') + 1);
}

function extensionOf(file) {
  const base = basenameOf(file);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

function isJsRuntimeFile(file) {
  return JS_RUNTIME_EXTENSIONS.has(extensionOf(file));
}

function isReactNativeCodegenSpecPath(file) {
  return REACT_NATIVE_CODEGEN_SPEC_BASENAME_RE.test(basenameOf(file));
}

function isPackagePath(file) {
  return PACKAGE_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isPackageNativeImplementationPath(file) {
  if (!isPackagePath(file)) return false;
  if (PACKAGE_MANIFEST_RE.test(file)) return true;
  if (PACKAGE_TSCONFIG_RE.test(file)) return false;
  if (PACKAGE_SRC_RE.test(file)) {
    if (isReactNativeCodegenSpecPath(file)) return true;
    return !isJsRuntimeFile(file);
  }

  // Fail closed for any new top-level package surface (podspec, ios/, android/,
  // cpp/, react-native.config.*, codegen metadata, etc.). Today the packages
  // contain only package.json, src/, and tsconfig.json.
  return true;
}

export function isPackageBoundarySensitivePath(value) {
  const file = normalizePath(value);
  if (!file) return false;
  if (PACKAGE_BOUNDARY_EXACT_PATHS.has(file)) return true;
  return isPackagePath(file);
}

export function isBareNativeSensitivePath(value) {
  const file = normalizePath(value);
  if (!file) return false;
  if (BARE_NATIVE_EXACT_PATHS.has(file)) return true;
  if (PACKAGE_MANIFEST_RE.test(file)) return true;
  return isPackageNativeImplementationPath(file);
}

export function isShowcaseNativeSensitivePath(value) {
  const file = normalizePath(value);
  if (!file) return false;
  if (SHOWCASE_NATIVE_EXACT_PATHS.has(file)) return true;
  if (SHOWCASE_NATIVE_PREFIXES.some((prefix) => file.startsWith(prefix))) return true;

  // A BeeUI package gaining native implementation affects both the bare
  // consumer and the Showcase consumer. Ordinary JS/TS/CSS package runtime
  // source does not, but RN Codegen specs under src/ are native-sensitive.
  if (PACKAGE_MANIFEST_RE.test(file)) return true;
  if (isPackageNativeImplementationPath(file)) return true;
  if (isPackagePath(file)) return false;

  // Showcase executable source is already proven by Expo export on web,
  // Android and iOS in verify. Keep this allowlist explicit so arbitrary local
  // config helpers cannot silently bypass Expo prebuild/native compilation.
  if (SHOWCASE_RUNTIME_EXACT_PATHS.has(file) && isJsRuntimeFile(file)) return false;
  if (
    SHOWCASE_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
    isJsRuntimeFile(file)
  ) {
    return false;
  }

  if (SAFE_EXACT_PATHS.has(file)) return false;
  if (SAFE_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;

  // Unknown repository inputs fail closed. This preserves the old conservative
  // posture while carving out only the JS/runtime paths whose native invariance
  // is explicit and regression-tested.
  return true;
}

export function isNativeIosSafePath(value) {
  return !isBareNativeSensitivePath(value) && !isShowcaseNativeSensitivePath(value);
}

// Backward-compatible name: the bare-consumer boundary leg means pack/install
// plus Metro bundles. Native compile has its own narrower signal now.
export function isBareConsumerSensitivePath(value) {
  return isPackageBoundarySensitivePath(value);
}

function uniqueFiles(values) {
  return [...new Set(values.map(normalizePath).filter(Boolean))].sort();
}

function failSafeResult(files, forceNative) {
  if (forceNative) {
    return {
      forced: true,
      failSafe: false,
      reason: 'forced native verification',
      files,
    };
  }
  if (files.length === 0) {
    return {
      forced: false,
      failSafe: true,
      reason: 'no changed paths supplied; running native fail-safe',
      files,
    };
  }
  return null;
}

export function classifyPackageBoundaryChanges(values, { forceNative = false } = {}) {
  const files = uniqueFiles(values);
  const special = failSafeResult(files, forceNative);
  if (special) {
    return {
      packageBoundary: true,
      reason: special.reason,
      files,
      packageBoundarySensitiveFiles: special.forced ? files : [],
    };
  }

  const packageBoundarySensitiveFiles = files.filter((file) => isPackageBoundarySensitivePath(file));
  return {
    packageBoundary: packageBoundarySensitiveFiles.length > 0,
    reason:
      packageBoundarySensitiveFiles.length > 0
        ? `package-boundary-sensitive paths changed: ${packageBoundarySensitiveFiles.join(', ')}`
        : 'no changed paths affect the BeeUI package boundary',
    files,
    packageBoundarySensitiveFiles,
  };
}

export function classifyBareNativeChanges(values, { forceNative = false } = {}) {
  const files = uniqueFiles(values);
  const special = failSafeResult(files, forceNative);
  if (special) {
    return {
      bareNative: true,
      reason: special.reason,
      files,
      bareNativeSensitiveFiles: special.forced ? files : [],
    };
  }

  const bareNativeSensitiveFiles = files.filter((file) => isBareNativeSensitivePath(file));
  return {
    bareNative: bareNativeSensitiveFiles.length > 0,
    reason:
      bareNativeSensitiveFiles.length > 0
        ? `bare-native-graph paths changed: ${bareNativeSensitiveFiles.join(', ')}`
        : 'bare React Native dependency graph is unchanged',
    files,
    bareNativeSensitiveFiles,
  };
}

export function classifyShowcaseNativeChanges(values, { forceNative = false } = {}) {
  const files = uniqueFiles(values);
  const special = failSafeResult(files, forceNative);
  if (special) {
    return {
      showcaseNative: true,
      reason: special.reason,
      files,
      showcaseNativeSensitiveFiles: special.forced ? files : [],
    };
  }

  const showcaseNativeSensitiveFiles = files.filter((file) => isShowcaseNativeSensitivePath(file));
  return {
    showcaseNative: showcaseNativeSensitiveFiles.length > 0,
    reason:
      showcaseNativeSensitiveFiles.length > 0
        ? `showcase-native-graph paths changed: ${showcaseNativeSensitiveFiles.join(', ')}`
        : 'Showcase native dependency/generated graph is unchanged',
    files,
    showcaseNativeSensitiveFiles,
  };
}

export function classifyNativeIosChanges(values, { forceNative = false } = {}) {
  const bare = classifyBareNativeChanges(values, { forceNative });
  const showcase = classifyShowcaseNativeChanges(values, { forceNative });
  const iosNative = bare.bareNative || showcase.showcaseNative;
  const nativeSensitiveFiles = [...new Set([
    ...bare.bareNativeSensitiveFiles,
    ...showcase.showcaseNativeSensitiveFiles,
  ])].sort();

  return {
    iosNative,
    reason: iosNative
      ? [bare.bareNative ? bare.reason : '', showcase.showcaseNative ? showcase.reason : '']
          .filter(Boolean)
          .join('; ')
      : 'native graphs are unchanged; JS/runtime verification is sufficient',
    files: bare.files,
    nativeSensitiveFiles,
  };
}

export function classifyBareConsumerChanges(values, { forceNative = false } = {}) {
  const boundary = classifyPackageBoundaryChanges(values, { forceNative });
  return {
    bareConsumer: boundary.packageBoundary,
    reason: boundary.reason,
    files: boundary.files,
    bareConsumerSensitiveFiles: boundary.packageBoundarySensitiveFiles,
  };
}

function envFlag(name) {
  return /^(1|true|yes)$/i.test(process.env[name] ?? '');
}

function writeGithubOutput(nativeResult, boundaryResult, bareResult, showcaseResult) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `ios-native=${nativeResult.iosNative ? 'true' : 'false'}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `reason=${nativeResult.reason.replace(/[\r\n]/g, ' ')}\n`);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `package-boundary=${boundaryResult.packageBoundary ? 'true' : 'false'}\n`,
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `package-boundary-reason=${boundaryResult.reason.replace(/[\r\n]/g, ' ')}\n`,
  );
  appendFileSync(process.env.GITHUB_OUTPUT, `bare-native=${bareResult.bareNative ? 'true' : 'false'}\n`);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `bare-native-reason=${bareResult.reason.replace(/[\r\n]/g, ' ')}\n`,
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `showcase-native=${showcaseResult.showcaseNative ? 'true' : 'false'}\n`,
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `showcase-native-reason=${showcaseResult.reason.replace(/[\r\n]/g, ' ')}\n`,
  );
  // Compatibility for any external consumer still reading the R2 output.
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `bare-consumer=${boundaryResult.packageBoundary ? 'true' : 'false'}\n`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = readFileSync(0, 'utf8');
  const files = input.split(/\r?\n/).filter(Boolean);
  const forceNative = envFlag('BEEUI_FORCE_NATIVE');
  const boundaryResult = classifyPackageBoundaryChanges(files, { forceNative });
  const bareResult = classifyBareNativeChanges(files, { forceNative });
  const showcaseResult = classifyShowcaseNativeChanges(files, { forceNative });
  const nativeResult = classifyNativeIosChanges(files, { forceNative });

  console.log(
    JSON.stringify(
      {
        iosNative: nativeResult.iosNative,
        reason: nativeResult.reason,
        files: nativeResult.files,
        nativeSensitiveFiles: nativeResult.nativeSensitiveFiles,
        packageBoundary: boundaryResult.packageBoundary,
        packageBoundaryReason: boundaryResult.reason,
        packageBoundarySensitiveFiles: boundaryResult.packageBoundarySensitiveFiles,
        bareNative: bareResult.bareNative,
        bareNativeReason: bareResult.reason,
        bareNativeSensitiveFiles: bareResult.bareNativeSensitiveFiles,
        showcaseNative: showcaseResult.showcaseNative,
        showcaseNativeReason: showcaseResult.reason,
        showcaseNativeSensitiveFiles: showcaseResult.showcaseNativeSensitiveFiles,
      },
      null,
      2,
    ),
  );
  writeGithubOutput(nativeResult, boundaryResult, bareResult, showcaseResult);
}
