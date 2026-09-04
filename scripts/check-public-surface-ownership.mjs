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

// The remediation a contributor needs is not derivable from the failure text, and the command
// that clears the failure — `docs:surface:acknowledge` — clears it whether or not anything was
// documented. So the written sequence is load-bearing, and this asserts the sequence is still
// there: each required step must be NAMED, not merely resolvable if mentioned. Checking only
// that whatever the section happens to name still exists would pass on a section reduced to
// one sentence, which is the failure this guard exists to prevent.
export const REQUIRED_WORKFLOW_COMMANDS = [
  'docs:surface:generate',
  'llms:generate',
  'docs:reference:generate',
  'docs:surface:acknowledge',
  'docs:surface:check',
];

// Marks the paragraph that must survive any rewrite of this section.
export const ACKNOWLEDGE_WARNING_ANCHOR = '<!-- surface-workflow: acknowledge-is-not-the-fix -->';

export const REQUIRED_WORKFLOW_FILES = [
  'docs/public-surface.inventory.json',
  'docs/public-surface-owners.json',
  'docs/reference.content.json',
];

// A fenced block may contain a line starting with `## `; slicing on the next such line would
// silently truncate the section and hide whatever follows from every assertion below.
export function extractDocSection(doc, heading) {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line === heading);
  if (start === -1) return null;
  const body = [];
  let fenced = false;
  for (const line of lines.slice(start + 1)) {
    if (/^\s*```/u.test(line)) fenced = !fenced;
    if (!fenced && /^## /u.test(line)) break;
    body.push(line);
  }
  // An unterminated fence swallows every following section, so the strings this gate looks for
  // could be satisfied by unrelated parts of the file.
  if (fenced) return { body: body.join('\n'), unterminatedFence: true };
  return { body: body.join('\n'), unterminatedFence: false };
}

export function validateContributorSurfaceDocs(rootDir = ROOT_DIR) {
  const violations = [];
  const docPath = path.join(rootDir, CONTRIBUTOR_DOC_FILE);
  if (!fs.existsSync(docPath)) return [`${CONTRIBUTOR_DOC_FILE} is missing; the public-surface workflow is undocumented.`];

  const extracted = extractDocSection(fs.readFileSync(docPath, 'utf8'), CONTRIBUTOR_DOC_HEADING);
  if (extracted === null) {
    return [
      `${CONTRIBUTOR_DOC_FILE} has no "${CONTRIBUTOR_DOC_HEADING}" section. Adding a public ` +
      'surface fails this gate, so the remediation sequence must stay documented.',
    ];
  }
  if (extracted.unterminatedFence) {
    return [
      `${CONTRIBUTOR_DOC_FILE}'s "${CONTRIBUTOR_DOC_HEADING}" section has an unterminated code ` +
      'fence, so its boundary — and everything this gate checks inside it — is undefined.',
    ];
  }
  const section = extracted.body;

  const scripts = readJson('package.json', rootDir).scripts ?? {};
  for (const name of REQUIRED_WORKFLOW_COMMANDS) {
    if (!scripts[name]) {
      violations.push(`\`${name}\` is a required step of the documented workflow but is not a package.json script.`);
      continue;
    }
    if (!section.includes(`pnpm ${name}`)) {
      violations.push(
        `${CONTRIBUTOR_DOC_FILE}'s "${CONTRIBUTOR_DOC_HEADING}" section no longer names ` +
        `\`pnpm ${name}\`, which a contributor must run to make a changed public surface pass this gate.`,
      );
    }
  }

  for (const relPath of REQUIRED_WORKFLOW_FILES) {
    if (!fs.existsSync(path.join(rootDir, relPath))) {
      violations.push(`${relPath} is named by the documented workflow but does not exist.`);
      continue;
    }
    if (!section.includes(relPath)) {
      violations.push(
        `${CONTRIBUTOR_DOC_FILE}'s "${CONTRIBUTOR_DOC_HEADING}" section no longer names ${relPath}, ` +
        'which a contributor edits or reads while following the workflow.',
      );
    }
  }

  // Whitespace between `pnpm` and the script name may be a newline after a rewrap, so a
  // documented command must be found across line breaks too.
  const flattened = section.replace(/\s+/gu, ' ');
  for (const [, name] of flattened.matchAll(/\bpnpm ([a-z][a-z0-9]*(?::[a-z0-9-]+)+)/gu)) {
    if (!scripts[name]) {
      violations.push(
        `${CONTRIBUTOR_DOC_FILE} tells contributors to run \`pnpm ${name}\`, which is not a package.json script.`,
      );
    }
  }

  for (const [, relPath] of flattened.matchAll(/`(docs\/[A-Za-z0-9._-]+\.json)`/gu)) {
    if (!fs.existsSync(path.join(rootDir, relPath))) {
      violations.push(`${CONTRIBUTOR_DOC_FILE} references ${relPath}, which does not exist.`);
    }
  }

  // Anchored on a marker rather than an exact sentence: freezing prose blocks any rewording,
  // and the point is that the warning is present, not that it is phrased one way.
  if (!section.includes(ACKNOWLEDGE_WARNING_ANCHOR)) {
    violations.push(
      `${CONTRIBUTOR_DOC_FILE}'s "${CONTRIBUTOR_DOC_HEADING}" section must keep the ` +
      `${ACKNOWLEDGE_WARNING_ANCHOR} marker on the paragraph warning that ` +
      '`docs:surface:acknowledge` runs last and is not the remedy for the staleness error.',
    );
  }

  return [...new Set(violations)];
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
