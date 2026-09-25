#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPublicationState } from './public-site-contract-lib.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// `packages/ui/package.json` is the single authored lockstep version (single source of workspace
// version truth). `readPublicationState` derives it from that manifest, so every other lockstep
// manifest, the root manifest, and the npm-release workflow's dispatch value are checked against
// this one authored source instead of a second hand-typed pin.
export function readPinnedVersion(rootDir = ROOT_DIR) {
  return readPublicationState(rootDir).currentVersion;
}
// The pattern a candidate version must match, derived from the policy's stable-line
// `candidateStableVersion`. The npm workflow's shell guard is required to be this exact string,
// so the two cannot drift apart.
export function readPinnedPrereleasePattern(rootDir = ROOT_DIR) {
  return readPublicationState(rootDir).prereleaseVersionPattern;
}
export const EXPECTED_VERSION = (() => {
  try {
    return readPinnedVersion(ROOT_DIR);
  } catch (error) {
    throw new Error(`packages/ui/package.json must carry a "version"; the release checks compare every manifest to it (${error.message}).`);
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

// The npm transport carries the release version in two places — the `expected_version` dispatch
// input and the shell guard that decides whether a version may mutate the registry — and nothing
// else compares either to the pin. The scan below reads `.github/workflows` only for the legacy
// package scope, so a bump could move `packages/ui/package.json` while the workflow kept guarding
// a superseded release line, with all release checks green.
//
// `expected_version` deliberately carries no default: a hard-coded default is exactly the second
// hand-typed pin this module exists to remove (a version bump would leave it stale until someone
// remembered to edit the workflow by hand). The preflight job instead asserts the dispatched value
// equals the checked-out `packages/ui/package.json`, so every run must type the exact candidate.
//
// The guard is required to be the pin's own `prereleaseVersionPattern`, verbatim. Sampling a few
// versions cannot characterise a regex: an anchored superset such as `^0\.86\.2-rc\.[0-9]+$`
// passes every probe below while admitting `0.86.2-rc.007`, which the pin's own pattern rejects.
// The probes are kept because they say *how* a guard is wrong, not because they pin it.
export function collectNpmReleaseWorkflowViolations(workflow, pinnedVersion, pinnedPrereleasePattern) {
  const violations = [];
  const base = stableBase(pinnedVersion);

  const lines = workflow.split('\n');
  const inputIndex = lines.findIndex((line) => /^ {6}expected_version:\s*$/.test(line));
  if (inputIndex === -1) {
    violations.push(`${NPM_RELEASE_WORKFLOW}: no "expected_version" dispatch input to check against the pin.`);
  } else {
    const body = [];
    for (let i = inputIndex + 1; i < lines.length && /^ {7,}\S/.test(lines[i]); i += 1) body.push(lines[i]);
    const bodyText = body.join('\n');
    if (/^ {8}default:/m.test(bodyText)) {
      violations.push(
        `${NPM_RELEASE_WORKFLOW}: "expected_version" must not declare a default; a hard-coded default recreates the duplicate ` +
          `version pin this module removes. Every dispatch must type the exact candidate version explicitly.`,
      );
    }
    if (!/^ {8}required:\s*true\s*$/m.test(bodyText)) {
      violations.push(`${NPM_RELEASE_WORKFLOW}: "expected_version" must be "required: true" now that it has no default.`);
    }
  }

  const guardSource = /\$version"\s*\|\s*grep -Eq '([^']+)'/.exec(workflow)?.[1];
  if (guardSource === undefined) {
    violations.push(`${NPM_RELEASE_WORKFLOW}: no prerelease version guard to check against the pin.`);
    return violations;
  }

  if (pinnedPrereleasePattern === undefined) {
    violations.push(
      'docs/dist-tag-policy.md: no "prereleaseVersionPattern" in the `json dist-tag-policy` block to hold the workflow guard to.',
    );
  } else if (guardSource !== pinnedPrereleasePattern) {
    violations.push(
      `${NPM_RELEASE_WORKFLOW}: prerelease version guard /${guardSource}/ must be the pinned prereleaseVersionPattern /${pinnedPrereleasePattern}/ from docs/dist-tag-policy.md.`,
    );
  }

  let guard;
  try {
    // `grep -E` and JS `RegExp` are different languages; this is an approximation used only to
    // describe how a guard is wrong. The equality check above is what pins it.
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
  // `changeset version` bumps the workspace members together (they are a `fixed` group,
  // `packages/ui/package.json` included), so a mid-bump repository never has the pin disagree
  // with every lockstep package at once — the pin *is* one of them. What it cannot reach is the
  // private root and the Worker/Expo followers, so that is the shape a bump leaves behind and the
  // only lagging-manifest case worth a dedicated remediation hint.
  if (rootManifest.version !== expected) {
    violations.push(`package.json: expected version ${expected}, found ${rootManifest.version}; run \`pnpm version:sync\` after bumping packages/ui/package.json.`);
  }

  for (const [relative, expectedName] of EXPECTED_PACKAGE_NAMES) {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));
    if (manifest.name !== expectedName) violations.push(`${relative}: expected name ${expectedName}, found ${manifest.name}`);
    if (manifest.version !== expected) violations.push(`${relative}: expected version ${expected}, found ${manifest.version}`);
  }

  const npmReleaseWorkflow = path.join(rootDir, NPM_RELEASE_WORKFLOW);
  if (fs.existsSync(npmReleaseWorkflow)) {
    violations.push(
      ...collectNpmReleaseWorkflowViolations(
        fs.readFileSync(npmReleaseWorkflow, 'utf8'),
        expected,
        readPinnedPrereleasePattern(rootDir),
      ),
    );
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
