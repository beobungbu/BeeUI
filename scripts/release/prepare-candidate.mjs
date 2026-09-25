#!/usr/bin/env node

// `pnpm release:prepare <version>` — the single supported way to move the workspace to a new
// candidate/stable lockstep version while the 0.86.2 line uses the explicit preparation tool
// (Changesets prerelease adoption is deferred to a later phase; see the release-flow plan). It
// performs every mechanical step a bump requires and stops with an actionable error instead of
// silently editing prose:
//   1. validate <version> against the stable release line (`candidateStableVersion`);
//   2. write it to the four lockstep package manifests (packages/ui/package.json is the single
//      authored current version read elsewhere; the other three move with it here because
//      Changesets is not yet operating the release flow — see the release-flow plan's D4);
//   3. propagate it to the non-workspace follower manifests (`pnpm version:sync`);
//   4. regenerate every canonical generated surface that embeds the version;
//   5. report any hand-maintained file that still names the previous version — this tool never
//      edits prose on its own.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPECTED_PACKAGE_NAMES } from '../check-release-control-plane.mjs';
import { ROOT_DIR, derivePrereleasePattern, readPublicationState } from '../public-site-contract-lib.mjs';
import { SOURCE_MANIFEST, syncRootVersion } from '../sync-root-version.mjs';

// The four packages Changesets would move together as a `fixed` group once Phase 03 lands.
// `packages/ui/package.json` (`SOURCE_MANIFEST`) is also the single authored current version read
// by every check; the other three are peers moved here so the lockstep set never desyncs.
export const LOCKSTEP_MANIFESTS = [...EXPECTED_PACKAGE_NAMES.keys()];

// Mirrors apps/docs's predev/prebuild/pretypecheck generator order (the same generators rc.2/rc.3
// were prepared with) plus the two root-level generated surfaces (docs/component-reference.md and
// the llms.txt family) that apps/docs does not own.
export const CANDIDATE_GENERATORS = [
  'scripts/public-component-reference.mjs',
  'scripts/public-component-previews.mjs',
  'scripts/public-pattern-reference.mjs',
  'scripts/public-reference.mjs',
  'scripts/public-guide-data.mjs',
  'scripts/generate-docs-foundation.mjs',
  'scripts/generate-component-reference.mjs',
  'scripts/generate-llms-txt.mjs',
];

export function assertValidCandidateVersion(version, candidateStableVersion) {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('release:prepare requires a non-empty version argument.');
  }
  if (version === candidateStableVersion) return; // the stable release itself
  const pattern = derivePrereleasePattern(candidateStableVersion);
  if (!new RegExp(pattern).test(version)) {
    throw new Error(
      `${version} is not valid for the ${candidateStableVersion} release line: it must equal ` +
        `${candidateStableVersion} exactly (stable) or match ${pattern} (a release candidate on that line).`,
    );
  }
}

export function setManifestVersion(rootDir, relPath, version) {
  const manifestPath = path.join(rootDir, relPath);
  const text = fs.readFileSync(manifestPath, 'utf8');
  if (!/"version"\s*:\s*"/u.test(text)) throw new Error(`${relPath} has no "version" field.`);
  const next = text.replace(/("version"\s*:\s*")[^"]*(")/u, `$1${version}$2`);
  fs.writeFileSync(manifestPath, next);
}

export function setLockstepManifestVersions(rootDir, version, manifests = LOCKSTEP_MANIFESTS) {
  for (const relPath of manifests) setManifestVersion(rootDir, relPath, version);
}

// Best-effort, informational literal audit: every tracked file (respecting .gitignore, since
// `git grep` only searches tracked content) that still names the previous version after every
// generator above has run. `pnpm release:prepare` never edits these — a hand-maintained sentence
// needs a human's judgement about whether it is current-state prose (must be swept) or dated
// history/evidence (must not be).
export function collectPreviousVersionLiterals(rootDir, previousVersion) {
  if (!previousVersion) return [];
  try {
    const output = execFileSync('git', ['grep', '-n', '--fixed-strings', '-I', previousVersion], {
      cwd: rootDir,
      encoding: 'utf8',
    });
    return output.split('\n').filter(Boolean);
  } catch (error) {
    if (error.status === 1) return []; // git grep: no matches
    throw error;
  }
}

function readManifestVersion(rootDir, relPath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relPath), 'utf8')).version;
}

function runGenerator(relPath, rootDir) {
  execFileSync(process.execPath, [path.join(rootDir, relPath)], { stdio: 'inherit', cwd: rootDir });
}

export function prepareCandidate(version, { rootDir = ROOT_DIR, generators = CANDIDATE_GENERATORS } = {}) {
  const publication = readPublicationState(rootDir);
  assertValidCandidateVersion(version, publication.candidateStableVersion);

  const previousVersion = readManifestVersion(rootDir, SOURCE_MANIFEST);
  setLockstepManifestVersions(rootDir, version);
  const { changed: syncedFollowers } = syncRootVersion(rootDir);

  for (const generator of generators) runGenerator(generator, rootDir);

  const remainingLiterals = previousVersion === version ? [] : collectPreviousVersionLiterals(rootDir, previousVersion);

  return { previousVersion, version, syncedFollowers, remainingLiterals };
}

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: pnpm release:prepare <version>');
    process.exitCode = 1;
    return;
  }
  try {
    const result = prepareCandidate(version);
    console.log(`Prepared candidate ${result.version} (was ${result.previousVersion}).`);
    console.log(`Set lockstep manifests: ${LOCKSTEP_MANIFESTS.join(', ')}.`);
    console.log(`Synced follower manifests: ${result.syncedFollowers.length ? result.syncedFollowers.join(', ') : 'none (already in sync)'}.`);
    console.log(`Regenerated canonical surfaces: ${CANDIDATE_GENERATORS.length} generators ran.`);
    if (result.remainingLiterals.length) {
      console.log(
        `\n${result.remainingLiterals.length} tracked line(s) still contain the previous version ${result.previousVersion}. ` +
          'This tool does not edit prose; review each and update hand-maintained current-state sentences only ' +
          '(dated history/evidence entries should keep the old literal):',
      );
      for (const hit of result.remainingLiterals) console.log(`- ${hit}`);
    } else {
      console.log('\nNo remaining previous-version literal was found in tracked files.');
    }
  } catch (error) {
    console.error(`release:prepare failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) main();
