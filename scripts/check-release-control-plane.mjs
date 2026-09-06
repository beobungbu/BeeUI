#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The root manifest is the lockstep source; every other manifest must equal it. Pinning a literal
// here as well meant `changeset version` — which bumps the workspace members and the root together
// through the `fixed` group — tripped this gate on its own output, and the literal had to be
// hand-edited beside the manifests it was supposed to check. `docs/dist-tag-policy.md` still pins
// the value a human chose, and `dist-policy:check` compares it to the root; that is where a bump
// is confirmed on purpose.
export const EXPECTED_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')).version;
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
];

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
  // The root is the lockstep source for the tree under `rootDir` — read here, not at module
  // load, so a test's temporary root is checked against itself and not against this repository.
  const expected = rootManifest.version;
  const seen = new Map();

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
    violations.push(`packages are at ${[...packageVersions][0]} while package.json is at ${expected}: run \`pnpm version:sync\` to move the root, Worker and Expo identities.`);
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
