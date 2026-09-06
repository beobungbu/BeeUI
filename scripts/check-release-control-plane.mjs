#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPublicationState } from './public-site-contract-lib.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The version a release is checked against is the one a human pinned in `docs/dist-tag-policy.md`
// (`currentVersion` in its `json dist-tag-policy` block), not the manifests. Reading it from the
// root manifest made every comparison against the root a tautology — `pack-artifacts` and
// `verify-release` compare the root to this constant — and let `changeset version` move the
// packages with nothing left to disagree. The pin is what a bump has to update on purpose.
export function readPinnedVersion(rootDir = ROOT_DIR) {
  return readPublicationState(rootDir).currentVersion;
}
export const EXPECTED_VERSION = (() => {
  try {
    return readPinnedVersion(ROOT_DIR);
  } catch (error) {
    throw new Error(`docs/dist-tag-policy.md must carry a \`json dist-tag-policy\` block with currentVersion; the release checks compare every manifest to it (${error.message}).`);
  }
})();
export const EXPECTED_PACKAGE_NAMES = new Map([
  ['packages/core/package.json', '@beemvp/beeui-core'],
  ['packages/tokens/package.json', '@beemvp/beeui-tokens'],
  ['packages/ui/package.json', '@beemvp/beeui-ui'],
  ['packages/cli/package.json', '@beemvp/beeui-cli'],
]);

const OPERATIONAL_RELEASE_FILES = [
  'docs/release.md',
  'docs/dist-tag-policy.md',
  'docs/consumer-compatibility-report.md',
  'docs/rc-candidate.md',
  'docs/rc-ci-matrix.md',
  'docs/registry-cli.md',
  'docs/package-compatibility-report.md',
  'docs/npm-release-bootstrap.md',
];

const NPM_RELEASE_WORKFLOW = '.github/workflows/npm-release.yml';

function stableBase(version) {
  return version.replace(/-rc\.(0|[1-9][0-9]*)$/, '');
}

// The npm transport carries the release version twice — the `expected_version` dispatch default
// and the shell guard that decides whether a version may mutate the registry — and nothing else
// compares either to the pin. The scan below reads `.github/workflows` only for the legacy
// package scope, so a bump could move `docs/dist-tag-policy.md` and every manifest while the
// workflow kept offering a superseded default and guarding a superseded release line, with all
// release checks green.
//
// The guard is checked by behaviour rather than by string equality: what matters is that it
// admits a candidate on the pinned line and refuses the stable version and any other line.
export function collectNpmReleaseWorkflowViolations(workflow, pinnedVersion) {
  const violations = [];
  const base = stableBase(pinnedVersion);

  const lines = workflow.split('\n');
  const inputIndex = lines.findIndex((line) => /^ {6}expected_version:\s*$/.test(line));
  if (inputIndex === -1) {
    violations.push(`${NPM_RELEASE_WORKFLOW}: no "expected_version" dispatch input to check against the pin.`);
  } else {
    const body = [];
    for (let i = inputIndex + 1; i < lines.length && /^ {7,}\S/.test(lines[i]); i += 1) body.push(lines[i]);
    const declared = /^ {8}default:\s*(\S+)\s*$/m.exec(body.join('\n'))?.[1];
    if (declared === undefined) {
      violations.push(`${NPM_RELEASE_WORKFLOW}: "expected_version" has no default to check against the pin.`);
    } else if (declared !== pinnedVersion) {
      violations.push(
        `${NPM_RELEASE_WORKFLOW}: "expected_version" default ${declared} must equal the pinned version ${pinnedVersion} from docs/dist-tag-policy.md.`,
      );
    }
  }

  const guardSource = /\$version"\s*\|\s*grep -Eq '([^']+)'/.exec(workflow)?.[1];
  if (guardSource === undefined) {
    violations.push(`${NPM_RELEASE_WORKFLOW}: no prerelease version guard to check against the pin.`);
    return violations;
  }

  let guard;
  try {
    guard = new RegExp(guardSource);
  } catch (error) {
    violations.push(`${NPM_RELEASE_WORKFLOW}: prerelease version guard is not a valid regex: ${error.message}.`);
    return violations;
  }

  const mustMatch = [`${base}-rc.1`];
  // The stable version is not a candidate; the other two are versions off the pinned line that an
  // unanchored guard would wave through.
  const mustNotMatch = [base, `9${base}-rc.1`, `${base}-rc.1-not-a-candidate`];
  for (const candidate of mustMatch) {
    if (!guard.test(candidate)) {
      violations.push(
        `${NPM_RELEASE_WORKFLOW}: prerelease version guard /${guardSource}/ rejects ${candidate}, a candidate on the pinned ${base} line.`,
      );
    }
  }
  for (const candidate of mustNotMatch) {
    if (guard.test(candidate)) {
      violations.push(`${NPM_RELEASE_WORKFLOW}: prerelease version guard /${guardSource}/ accepts ${candidate}, which is not a candidate on the pinned ${base} line.`);
    }
  }

  return violations;
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

export function collectReleaseControlPlaneViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const rootManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  // Read from the tree under `rootDir`, not at module load, so a temporary root is checked
  // against its own pin rather than this repository's.
  const expected = readPinnedVersion(rootDir);
  const seen = new Map();
  if (rootManifest.version !== expected) violations.push(`package.json: expected version ${expected}, found ${rootManifest.version}`);

  for (const [relative, expectedName] of EXPECTED_PACKAGE_NAMES) {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));
    if (manifest.name !== expectedName) violations.push(`${relative}: expected name ${expectedName}, found ${manifest.name}`);
    seen.set(relative, manifest.version);
    if (manifest.version !== expected) violations.push(`${relative}: expected version ${expected}, found ${manifest.version}`);
  }

  // `changeset version` bumps the workspace members and cannot reach the private root, so
  // "every package agrees and the root lags" is the shape a bump leaves behind. Name the command.
  const packageVersions = new Set(seen.values());
  if (packageVersions.size === 1 && !packageVersions.has(expected)) {
    violations.push(
      `packages are at ${[...packageVersions][0]} while docs/dist-tag-policy.md pins ${expected}: if that bump is intended, ` +
        'set `currentVersion` (and the prerelease pattern) there, then run `pnpm version:sync` for the root, Worker and Expo identities.',
    );
  }

  const npmReleaseWorkflow = path.join(rootDir, NPM_RELEASE_WORKFLOW);
  if (fs.existsSync(npmReleaseWorkflow)) {
    violations.push(...collectNpmReleaseWorkflowViolations(fs.readFileSync(npmReleaseWorkflow, 'utf8'), expected));
  }

  const workflowFiles = walkFiles(path.join(rootDir, '.github/workflows')).filter(
    (file) => !path.basename(file).startsWith('release-integrity-407-bootstrap'),
  );
  const releaseFiles = [
    ...workflowFiles,
    ...walkFiles(path.join(rootDir, 'scripts')).filter(
      (file) => !file.endsWith('check-release-control-plane.mjs') && !file.includes(`${path.sep}__tests__${path.sep}`) && !path.basename(file).startsWith('.tmp-apply-release-integrity-407'),
    ),
    ...OPERATIONAL_RELEASE_FILES.map((relative) => path.join(rootDir, relative)).filter(fs.existsSync),
    ...EXPECTED_PACKAGE_NAMES.keys().map((relative) => path.join(rootDir, relative)),
  ];
  const legacyScope = '@' + 'beeui/';
  for (const file of new Set(releaseFiles)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(legacyScope)) violations.push(`${path.relative(rootDir, file)}: contains superseded legacy package scope`);
  }
  return violations;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const violations = collectReleaseControlPlaneViolations();
  if (violations.length > 0) {
    console.error('Release control-plane check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(`Release control-plane check passed (lockstep ${EXPECTED_VERSION}, current package scope only).`);
  }
}
