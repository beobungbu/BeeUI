#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR } from './component-docs-lib.mjs';
import {
  OWNER_POLICY_FILE,
  buildPublicSurfaceInventory,
  summarizePublicSurfaceInventory,
  validateInventoryFreshness,
  validatePublicSurfaceInventory,
} from './generate-public-surface-inventory.mjs';

function readJson(relPath, rootDir = ROOT_DIR) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relPath), 'utf8'));
}

export function gitBlobSha(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return crypto
    .createHash('sha1')
    .update(Buffer.from(`blob ${buffer.length}\0`))
    .update(buffer)
    .digest('hex');
}

export function validateAcknowledgedSurfaceSources(rootDir = ROOT_DIR, policy = readJson(OWNER_POLICY_FILE, rootDir)) {
  const violations = [];
  const acknowledged = policy.acknowledgedSourceBlobs;

  if (!acknowledged || typeof acknowledged !== 'object' || Array.isArray(acknowledged)) {
    return [`${OWNER_POLICY_FILE} has no acknowledgedSourceBlobs map.`];
  }

  for (const [relPath, expectedSha] of Object.entries(acknowledged)) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) {
      violations.push(`${relPath} is an acknowledged public-surface source but no longer exists.`);
      continue;
    }
    const actualSha = gitBlobSha(fs.readFileSync(absPath));
    if (actualSha !== expectedSha) {
      violations.push(
        `${relPath} changed after documentation ownership was acknowledged ` +
        `(${expectedSha} -> ${actualSha}). Review the derived surface/owner diff, update docs as needed, then intentionally update acknowledgedSourceBlobs.`,
      );
    }
  }

  return violations;
}

export const CONTRIBUTOR_DOC_FILE = 'CONTRIBUTING.md';
export const CONTRIBUTOR_DOC_HEADING = '## Public documentation surfaces';

// The ownership gate tells a contributor that documentation is stale; it cannot tell them how
// to make it current. That workflow lives in CONTRIBUTING.md, and a workflow document nobody
// verifies is how a gate ends up with an undocumented escape hatch: `docs:surface:acknowledge`
// silences the hash error whether or not the surface was ever documented. So the gate asserts
// its own instructions still exist and still name real commands and real files.
export function validateContributorSurfaceDocs(rootDir = ROOT_DIR) {
  const violations = [];
  const docPath = path.join(rootDir, CONTRIBUTOR_DOC_FILE);
  if (!fs.existsSync(docPath)) return [`${CONTRIBUTOR_DOC_FILE} is missing; the public-surface workflow is undocumented.`];

  const doc = fs.readFileSync(docPath, 'utf8');
  const start = doc.indexOf(CONTRIBUTOR_DOC_HEADING);
  if (start === -1) {
    return [
      `${CONTRIBUTOR_DOC_FILE} has no "${CONTRIBUTOR_DOC_HEADING}" section. Adding a public ` +
      'surface fails this gate, so the remediation sequence must stay documented.',
    ];
  }
  const nextHeading = doc.indexOf('\n## ', start + CONTRIBUTOR_DOC_HEADING.length);
  const section = doc.slice(start, nextHeading === -1 ? doc.length : nextHeading);

  const scripts = readJson('package.json', rootDir).scripts ?? {};
  const named = new Set([...section.matchAll(/\bpnpm ((?:docs|registry|release):[a-z:-]+)/gu)].map(([, name]) => name));
  for (const name of named) {
    if (!scripts[name]) {
      violations.push(
        `${CONTRIBUTOR_DOC_FILE} tells contributors to run \`pnpm ${name}\`, which is not a package.json script.`,
      );
    }
  }

  // The section names the hand-editable control files by path; a rename must not leave the
  // instructions pointing at a file that no longer exists.
  for (const [, relPath] of section.matchAll(/`(docs\/[a-z.-]+\.json)`/gu)) {
    if (!fs.existsSync(path.join(rootDir, relPath))) {
      violations.push(`${CONTRIBUTOR_DOC_FILE} references ${relPath}, which does not exist.`);
    }
  }

  // Naming the acknowledge command without the warning is the failure mode this guards.
  if (!/not the fix for the error it silences/u.test(section)) {
    violations.push(
      `${CONTRIBUTOR_DOC_FILE}'s "${CONTRIBUTOR_DOC_HEADING}" section must keep warning that ` +
      '`docs:surface:acknowledge` is run last and is not the remedy for the staleness error.',
    );
  }

  return violations;
}

export function validatePublicSurfaceOwnership(rootDir = ROOT_DIR) {
  return [
    ...validatePublicSurfaceInventory(rootDir),
    ...validateInventoryFreshness(rootDir),
    ...validateAcknowledgedSurfaceSources(rootDir),
    ...validateContributorSurfaceDocs(rootDir),
  ];
}

// Re-acknowledgement is an explicit, reviewed action, but the reviewer should not have to
// hand-compute git blob hashes. Callers run this only after reading the derived surface diff.
export function acknowledgeSurfaceSources(rootDir = ROOT_DIR) {
  const policyPath = path.join(rootDir, OWNER_POLICY_FILE);
  const policy = readJson(OWNER_POLICY_FILE, rootDir);
  const updated = {};
  const changed = [];
  for (const relPath of Object.keys(policy.acknowledgedSourceBlobs ?? {})) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) throw new Error(`${relPath} is acknowledged but no longer exists; update the policy by hand.`);
    const sha = gitBlobSha(fs.readFileSync(absPath));
    if (sha !== policy.acknowledgedSourceBlobs[relPath]) changed.push(relPath);
    updated[relPath] = sha;
  }
  policy.acknowledgedSourceBlobs = updated;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  return changed;
}

function main() {
  if (process.argv.includes('--acknowledge')) {
    const changed = acknowledgeSurfaceSources(ROOT_DIR);
    console.log(
      changed.length
        ? `re-acknowledged ${changed.length} public-surface source(s): ${changed.join(', ')}`
        : 'all acknowledged public-surface sources were already current',
    );
    return;
  }

  const violations = validatePublicSurfaceOwnership(ROOT_DIR);
  if (violations.length) {
    console.error('Public-surface documentation ownership gate failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  const summary = summarizePublicSurfaceInventory(buildPublicSurfaceInventory(ROOT_DIR));
  console.log(
    `Public-surface ownership gate passed (${summary.rows} derived rows; ` +
    `${summary.published} owned by a published docs page, ${summary.planned} by a ratified-but-unwritten page; ` +
    'inventory fresh; canonical source blobs explicitly acknowledged; no release-truth violations).',
  );
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) main();
