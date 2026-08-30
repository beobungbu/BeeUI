#!/usr/bin/env node

// Guards docs/compatibility-matrix.md against silent drift from the actual
// pinned/tested versions in package manifests, .nvmrc and CI workflows. The
// matrix doc is the BeeUI 1.0 R2 compatibility authority (#129); this script
// is what keeps that authority honest instead of merely aspirational.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX_DOC_PATH = path.join(ROOT_DIR, 'docs', 'compatibility-matrix.md');
const ROOT_PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const NVMRC_PATH = path.join(ROOT_DIR, '.nvmrc');
const UI_PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'packages', 'ui', 'package.json');
const SHOWCASE_PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'apps', 'showcase', 'package.json');
const CI_WORKFLOW_PATHS = [
  path.join(ROOT_DIR, '.github', 'workflows', 'ci.yml'),
  path.join(ROOT_DIR, '.github', 'workflows', 'runtime-native.yml'),
  path.join(ROOT_DIR, '.github', 'workflows', 'visual-web.yml'),
  path.join(ROOT_DIR, '.github', 'workflows', 'web-a11y.yml'),
  path.join(ROOT_DIR, '.github', 'workflows', 'web-consumer.yml'),
  path.join(ROOT_DIR, '.github', 'workflows', 'compat-rn-0-87.yml'),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function extractSnapshotFromDoc(markdown) {
  const match = /```json compatibility-matrix\n([\s\S]*?)\n```/.exec(markdown);
  if (!match) {
    throw new Error(
      'docs/compatibility-matrix.md is missing its ```json compatibility-matrix fenced snapshot block.',
    );
  }
  return JSON.parse(match[1]);
}

function extractWorkflowVersion(contents, envName) {
  const match = new RegExp(`^\\s*${envName}:\\s*['"]?([^'"\\s]+)['"]?\\s*$`, 'm').exec(contents);
  return match ? match[1] : null;
}

export function computeActualSnapshot({
  rootPackageJson,
  nvmrc,
  uiPackageJson,
  showcasePackageJson,
  workflowContentsByFile,
}) {
  const nodeVersionsSeen = new Set([rootPackageJson.engines?.node, nvmrc.trim()]);
  const pnpmVersionsSeen = new Set([rootPackageJson.packageManager?.replace(/^pnpm@/, '')]);

  for (const [file, contents] of Object.entries(workflowContentsByFile)) {
    const node = extractWorkflowVersion(contents, 'NODE_VERSION');
    const pnpm = extractWorkflowVersion(contents, 'PNPM_VERSION');
    if (!node) throw new Error(`${file}: could not find a NODE_VERSION env value.`);
    if (!pnpm) throw new Error(`${file}: could not find a PNPM_VERSION env value.`);
    nodeVersionsSeen.add(node);
    pnpmVersionsSeen.add(pnpm);
  }

  if (nodeVersionsSeen.size !== 1) {
    throw new Error(
      `Inconsistent repo Node version pins across package.json/.nvmrc/CI workflows: ${[...nodeVersionsSeen].join(', ')}`,
    );
  }
  if (pnpmVersionsSeen.size !== 1) {
    throw new Error(
      `Inconsistent pnpm version pins across package.json/CI workflows: ${[...pnpmVersionsSeen].join(', ')}`,
    );
  }

  return {
    node: {
      repo: [...nodeVersionsSeen][0],
      pnpm: [...pnpmVersionsSeen][0],
    },
    react: uiPackageJson.devDependencies?.react,
    reactDom: uiPackageJson.devDependencies?.['react-dom'],
    reactNative: uiPackageJson.devDependencies?.['react-native'],
    reactNativeWeb: showcasePackageJson.dependencies?.['react-native-web'],
    expoSdkRange: showcasePackageJson.dependencies?.expo,
    tailwindcss: showcasePackageJson.dependencies?.tailwindcss,
    uniwind: showcasePackageJson.dependencies?.uniwind,
    safeAreaContext: {
      ui: uiPackageJson.devDependencies?.['react-native-safe-area-context'],
      showcase: showcasePackageJson.dependencies?.['react-native-safe-area-context'],
    },
    teleport: {
      ui: uiPackageJson.devDependencies?.['react-native-teleport'],
      showcase: showcasePackageJson.dependencies?.['react-native-teleport'],
    },
  };
}

function diffSnapshots(expected, actual, prefix = '') {
  const diffs = [];
  for (const key of Object.keys(expected)) {
    const expectedValue = expected[key];
    const actualValue = actual?.[key];
    const label = prefix ? `${prefix}.${key}` : key;
    if (expectedValue && typeof expectedValue === 'object') {
      diffs.push(...diffSnapshots(expectedValue, actualValue, label));
    } else if (expectedValue !== actualValue) {
      diffs.push(`${label}: doc says "${expectedValue}", repo actually pins "${actualValue}"`);
    }
  }
  return diffs;
}

export function collectCompatibilityMatrixViolations({
  markdown,
  rootPackageJson,
  nvmrc,
  uiPackageJson,
  showcasePackageJson,
  workflowContentsByFile,
}) {
  const declared = extractSnapshotFromDoc(markdown);
  const actual = computeActualSnapshot({
    rootPackageJson,
    nvmrc,
    uiPackageJson,
    showcasePackageJson,
    workflowContentsByFile,
  });
  return diffSnapshots(declared, actual);
}

function runCli() {
  const workflowContentsByFile = Object.fromEntries(
    CI_WORKFLOW_PATHS.map((filePath) => [path.relative(ROOT_DIR, filePath), fs.readFileSync(filePath, 'utf8')]),
  );

  const violations = collectCompatibilityMatrixViolations({
    markdown: fs.readFileSync(MATRIX_DOC_PATH, 'utf8'),
    rootPackageJson: readJson(ROOT_PACKAGE_JSON_PATH),
    nvmrc: fs.readFileSync(NVMRC_PATH, 'utf8'),
    uiPackageJson: readJson(UI_PACKAGE_JSON_PATH),
    showcasePackageJson: readJson(SHOWCASE_PACKAGE_JSON_PATH),
    workflowContentsByFile,
  });

  if (violations.length > 0) {
    console.error("docs/compatibility-matrix.md has drifted from the repository's actual pinned versions:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log('Compatibility matrix check passed (docs/compatibility-matrix.md matches pinned versions).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    runCli();
  } catch (error) {
    console.error(`Compatibility matrix check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
