#!/usr/bin/env node

// Verifies a repository release tag `v<version>` after the owner pushes it. The tag is created by
// hand: ruleset `release-tag-protection` lets only admins create `refs/tags/v*` and requires a
// signature, so no workflow token can make one, and publication never waits on a tag push (see
// docs/release.md). This check catches the mistakes a hand-made tag can carry:
//   - a lightweight tag (a signed tag is always annotated);
//   - a name that is not `v` + the lockstep version recorded at the tagged commit;
//   - the four lockstep manifests disagreeing at that commit;
//   - a target that is not on `main` (for example the earlier candidate-source commit on
//     `development`, which the release plan keeps distinct from the promoted `main` commit).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCKSTEP_MANIFESTS } from './prepare-candidate.mjs';

const TAG_RE = /^v(\d+\.\d+\.\d+(?:-rc\.(?:0|[1-9]\d*))?)$/;

export function checkReleaseTag({ tag, objectType, versions, onMain }) {
  const match = TAG_RE.exec(tag ?? '');
  if (!match) return [`${tag}: a release tag must be v<major>.<minor>.<patch> or v<major>.<minor>.<patch>-rc.<n>`];

  const errors = [];
  const tagVersion = match[1];
  if (objectType !== 'tag') {
    errors.push(`${tag}: is a lightweight tag; create a signed annotated tag with \`git tag -s ${tag} <main-commit>\``);
  }
  const mismatched = Object.entries(versions).filter(([, version]) => version !== tagVersion);
  if (mismatched.length > 0) {
    const detail = mismatched.map(([relPath, version]) => `${relPath}=${version ?? 'missing'}`).join(', ');
    errors.push(`${tag}: the tagged commit does not carry ${tagVersion} in every lockstep manifest (${detail})`);
  }
  if (!onMain) errors.push(`${tag}: the tagged commit is not on main; tag the promoted main commit`);
  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function manifestVersionAt(commit, relPath) {
  try {
    return JSON.parse(git(['show', `${commit}:${relPath}`])).version;
  } catch {
    return undefined;
  }
}

export function readTagFacts(tag, mainRef = 'origin/main') {
  const objectType = git(['cat-file', '-t', `refs/tags/${tag}`]);
  const commit = git(['rev-parse', `refs/tags/${tag}^{commit}`]);
  const versions = Object.fromEntries(LOCKSTEP_MANIFESTS.map((relPath) => [relPath, manifestVersionAt(commit, relPath)]));
  let onMain = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, mainRef], { stdio: 'ignore' });
  } catch {
    onMain = false;
  }
  return { tag, objectType, versions, onMain, commit };
}

function main() {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  if (!tag) {
    console.error('Usage: node scripts/release/verify-release-tag.mjs <tag>');
    process.exitCode = 1;
    return;
  }
  const facts = readTagFacts(tag);
  const errors = checkReleaseTag(facts);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`${tag} ok: annotated, lockstep ${tag.slice(1)}, commit ${facts.commit} is on main.`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) main();
