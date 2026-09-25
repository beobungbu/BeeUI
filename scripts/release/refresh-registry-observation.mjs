#!/usr/bin/env node
// Records a fresh read-only npm observation and regenerates every surface that renders it.
//
// `pnpm registry:observe` only rewrites docs/registry-observation.json; the README status
// block, policy docs, llms files, component/pattern pages and docs-foundation release state
// all render from that snapshot through the same generators `release:prepare` runs. Running
// them together keeps the committed snapshot and every generated surface in one reviewable diff.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_GENERATORS } from './prepare-candidate.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function run(relPath) {
  execFileSync(process.execPath, [path.join(ROOT_DIR, relPath)], { stdio: 'inherit', cwd: ROOT_DIR });
}

run('scripts/registry-observe.mjs');
for (const generator of CANDIDATE_GENERATORS) run(generator);
console.log(`Refreshed the registry observation and ${CANDIDATE_GENERATORS.length} generated surfaces.`);
