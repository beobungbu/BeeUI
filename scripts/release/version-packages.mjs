#!/usr/bin/env node

// `pnpm release:version` — the routine bump. Changesets owns the arithmetic: in prerelease mode
// (`.changeset/pre.json`, created by `changeset pre enter rc`, never hand-written) a patch
// changeset moves 0.86.2-rc.N to 0.86.2-rc.N+1, and after `changeset pre exit` the next run lands
// on 0.86.2. This wrapper runs `changeset version`, then refuses any result that is not one
// lockstep version on the current stable release line (a `minor` changeset would otherwise start
// 0.87.0-rc.0 in the middle of the 0.86.2 line), and finishes with the same follower sync,
// generator run and leftover-literal report as `pnpm release:prepare`.
//
// It never publishes, tags or pushes. Nothing runs it in CI: this repository does not let GitHub
// Actions open pull requests, and a pull request opened with GITHUB_TOKEN would not start the
// required checks, so the maintainer runs it and opens the bump PR by hand.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, readPublicationState } from '../public-site-contract-lib.mjs';
import { SOURCE_MANIFEST } from '../sync-root-version.mjs';
import {
  CANDIDATE_GENERATORS,
  LOCKSTEP_MANIFESTS,
  assertValidCandidateVersion,
  finishVersionBump,
  printBumpReport,
  readManifestVersion,
} from './prepare-candidate.mjs';

function runChangesetVersion(rootDir) {
  execFileSync('pnpm', ['exec', 'changeset', 'version'], { stdio: 'inherit', cwd: rootDir });
}

export function assertLockstep(rootDir, manifests = LOCKSTEP_MANIFESTS) {
  const versions = new Map(manifests.map((relPath) => [relPath, readManifestVersion(rootDir, relPath)]));
  const distinct = new Set(versions.values());
  if (distinct.size !== 1) {
    const detail = [...versions].map(([relPath, version]) => `${relPath}=${version}`).join(', ');
    throw new Error(`changeset version left the lockstep packages on different versions (${detail}); check the fixed group in .changeset/config.json.`);
  }
  return [...distinct][0];
}

export function versionPackages({
  rootDir = ROOT_DIR,
  generators = CANDIDATE_GENERATORS,
  changesetVersion = runChangesetVersion,
} = {}) {
  const { candidateStableVersion } = readPublicationState(rootDir);
  const previousVersion = readManifestVersion(rootDir, SOURCE_MANIFEST);

  changesetVersion(rootDir);

  const version = assertLockstep(rootDir);
  if (version === previousVersion) {
    throw new Error(`no pending changeset moved the version (still ${previousVersion}); add one with \`pnpm changeset\` first.`);
  }
  assertValidCandidateVersion(version, candidateStableVersion);

  return finishVersionBump(previousVersion, version, { rootDir, generators });
}

function main() {
  try {
    printBumpReport(versionPackages(), 'Versioned packages to');
  } catch (error) {
    console.error(`release:version failed: ${error.message}`);
    console.error('Review `git status`: revert the manifests, CHANGELOGs and .changeset files it touched before retrying.');
    process.exitCode = 1;
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) main();
