import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadCanonicalTokens } from './generate-tokens.mjs';
import {
  assertRemovalAllowed,
  collectGovernedTokens,
  validateTokenLifecycle,
} from './token-lifecycle.mjs';

const CANONICAL_PATH = 'packages/tokens/tokens.json';
const BEE_EXTENSION = 'com.beeui';

function lifecycleVersion(source) {
  return source?.$extensions?.[BEE_EXTENSION]?.lifecyclePolicy?.packageVersion;
}

function removalError(message) {
  return new Error(`Invalid token lifecycle removal: ${message}`);
}

export function validateTokenRemovalDiff(previousSource, currentSource, options = {}) {
  validateTokenLifecycle(previousSource);
  validateTokenLifecycle(currentSource);

  const previous = new Map(collectGovernedTokens(previousSource).map((entry) => [entry.path, entry]));
  const current = new Map(collectGovernedTokens(currentSource).map((entry) => [entry.path, entry]));
  const currentVersion = options.currentVersion ?? lifecycleVersion(currentSource);
  const removed = [...previous.values()].filter((entry) => !current.has(entry.path));

  for (const entry of removed) {
    if (entry.lifecycle.status === 'experimental') continue;

    if (entry.lifecycle.status !== 'deprecated') {
      throw removalError(
        `${entry.path} was removed while ${entry.lifecycle.status}; public tokens must be deprecated before removal`,
      );
    }

    const replacement = entry.lifecycle.deprecated.replacement;
    if (replacement && !current.has(replacement)) {
      throw removalError(
        `${entry.path} replacement "${replacement}" must remain a live governed token when the deprecated alias is removed`,
      );
    }

    // Removal eligibility is evaluated from the PREVIOUS source, where the token and its
    // lifecycle metadata still exist. The current canonical source cannot prove its own
    // deletion after the node has disappeared.
    assertRemovalAllowed(previousSource, entry.path, { currentVersion });
  }

  return removed.map((entry) => entry.path);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function resolveBaselineSha() {
  if (process.env.BEEUI_TOKEN_BASE_SHA) return process.env.BEEUI_TOKEN_BASE_SHA;

  // GitHub Actions exposes GITHUB_BASE_REF for pull_request jobs. CI checks out with
  // fetch-depth: 0, so the remote base ref is available and merge-base gives the exact
  // common ancestor even when the checked-out PR ref is GitHub's synthetic merge commit.
  if (process.env.GITHUB_BASE_REF) {
    return git(['merge-base', 'HEAD', `origin/${process.env.GITHUB_BASE_REF}`]);
  }

  return undefined;
}

function loadSourceAtRevision(revision) {
  const raw = execFileSync('git', ['show', `${revision}:${CANONICAL_PATH}`], { encoding: 'utf8' });
  return JSON.parse(raw);
}

export function checkTokenRemovalsAgainstGitBaseline(baseSha = resolveBaselineSha()) {
  if (!baseSha) {
    console.log('Token lifecycle removal check skipped (no PR/base revision available).');
    return [];
  }

  const previousSource = loadSourceAtRevision(baseSha);
  const currentSource = loadCanonicalTokens();
  const removed = validateTokenRemovalDiff(previousSource, currentSource);
  console.log(
    `Token lifecycle removal check passed against ${baseSha} (${removed.length} governed token removal${removed.length === 1 ? '' : 's'}).`,
  );
  return removed;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) checkTokenRemovalsAgainstGitBaseline();
