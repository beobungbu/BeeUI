#!/usr/bin/env node

// Regenerates the `release-status:generated` marker blocks in the small set of hand-authored docs
// that still state the current registry publication sentence in prose (README.md, the dist-tag
// policy's "Current public state" section, and the consumer-compatibility report's opening
// status line). Every block is rendered from the same shared derivation
// (`scripts/release-status-lib.mjs` fed by `docs/registry-observation.json` and
// `packages/ui/package.json`), so the three surfaces can never independently drift the way the
// hand-typed duplicates they replace used to.
//
// `pnpm release-status:generate` writes; `pnpm release-status:check` (this script with `--check`)
// fails if the committed content is stale, the same freshness-check shape as
// scripts/check-portal-pages-fresh.mjs and the other `docs:*:check` scripts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCurrentVersion, readPublicationState, ROOT_DIR } from './public-site-contract-lib.mjs';
import { renderStatusSentence } from './release-status-lib.mjs';

const MARKER_START = '<!-- release-status:generated:start — written by `pnpm release-status:generate`; do not hand-edit between these markers. -->';
const MARKER_END = '<!-- release-status:generated:end -->';

export const RELEASE_STATUS_TARGETS = ['README.md', 'docs/dist-tag-policy.md', 'docs/consumer-compatibility-report.md'];

function markerBlock(text) {
  return `${MARKER_START}\n${text}\n${MARKER_END}`;
}

function replaceMarkerBlock(content, relativePath, text) {
  const pattern = new RegExp(
    `${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  );
  if (!pattern.test(content)) {
    throw new Error(`${relativePath} is missing its release-status:generated marker block.`);
  }
  return content.replace(pattern, markerBlock(text));
}

export function renderReleaseStatusBlock(rootDir = ROOT_DIR) {
  const publication = readPublicationState(rootDir);
  return renderStatusSentence(publication.releaseState);
}

export function buildReleaseStatusOutputs(rootDir = ROOT_DIR) {
  const text = renderReleaseStatusBlock(rootDir);
  return RELEASE_STATUS_TARGETS.map((relativePath) => {
    const absolute = path.join(rootDir, relativePath);
    const current = fs.readFileSync(absolute, 'utf8');
    return { relativePath, absolute, next: replaceMarkerBlock(current, relativePath, text), current };
  });
}

function writeOutputs(rootDir = ROOT_DIR) {
  const outputs = buildReleaseStatusOutputs(rootDir);
  for (const output of outputs) {
    if (output.next !== output.current) fs.writeFileSync(output.absolute, output.next);
  }
  return outputs;
}

function checkOutputs(rootDir = ROOT_DIR) {
  const outputs = buildReleaseStatusOutputs(rootDir);
  return outputs.filter((output) => output.next !== output.current);
}

function main() {
  const check = process.argv.includes('--check');
  try {
    if (check) {
      const stale = checkOutputs(ROOT_DIR);
      if (stale.length) {
        console.error('Release-status generated blocks are stale:');
        for (const output of stale) console.error(`- ${output.relativePath}`);
        console.error('Run `pnpm release-status:generate` and commit the result.');
        process.exitCode = 1;
        return;
      }
      console.log('Release-status generated blocks are fresh.');
      return;
    }
    const outputs = writeOutputs(ROOT_DIR);
    console.log(`Regenerated release-status blocks in: ${outputs.map((o) => o.relativePath).join(', ')} (workspace version ${readCurrentVersion(ROOT_DIR)}).`);
  } catch (error) {
    console.error(`release-status:generate failed: ${error.message}`);
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
