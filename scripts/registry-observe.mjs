#!/usr/bin/env node

// `pnpm registry:observe` — the only script in this repository that reaches the network. It
// queries npm (read-only: `npm view`, never `npm publish`/`npm dist-tag`) for the four lockstep
// packages and writes a timestamped observation to `docs/registry-observation.json`. Every other
// generator/check reads that committed file instead of the network, so docs generation and CI stay
// offline and deterministic.
//
// Rules this module enforces (registry state is observed data, committed rather than derived
// live at build time, so docs generation stays offline):
//   1. query every required package before replacing the committed file;
//   2. a failed/partial query never overwrites the last good snapshot (atomic write: write to a
//      temp file in the same directory, then rename — and only after every query succeeded);
//   3. a successful snapshot may legitimately describe partial-publication; that is observed
//      registry state, not a command failure;
//   4. the command runner is injectable so unit tests never touch the network.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { LOCKSTEP_PACKAGE_NAMES, REGISTRY_OBSERVATION_PATH, ROOT_DIR } from './public-site-contract-lib.mjs';

const execFileAsync = promisify(execFile);

/** Default command runner: shells out to the real `npm` CLI. Tests inject a fake instead. */
export async function runNpmCommand(args) {
  const { stdout } = await execFileAsync('npm', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

function parseNpmJson(raw, context) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`registry:observe could not parse npm output for ${context}: ${error.message}`);
  }
}

// npm's `versions`/`dist-tags.<tag>` shape is inconsistent at the edges: a package with exactly
// one published version returns a bare string for `versions` fields that would otherwise be an
// array with one entry, and `dist-tags` is always an object. Normalize both here so every caller
// downstream (including deriveReleaseState) can assume `versions` is always an array.
function normalizeVersions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

/**
 * Query one package's `versions`/`dist-tags`, then (only if a relevant version was resolved) its
 * `dist` metadata for that version. Two npm calls per package, both read-only.
 *
 * @param {string} packageName
 * @param {{ run: (args: string[]) => Promise<string> }} deps
 */
export async function observePackage(packageName, { run } = { run: runNpmCommand }) {
  const summaryRaw = await run(['view', packageName, 'versions', 'dist-tags', '--json']);
  const summary = parseNpmJson(summaryRaw, packageName);
  const versions = normalizeVersions(summary.versions);
  const distTags = summary['dist-tags'] && typeof summary['dist-tags'] === 'object' ? summary['dist-tags'] : {};

  // "Relevant" version for dist metadata: prefer the prerelease channel's target, then the stable
  // channel's, then whatever the most recently published version is (last of `versions`). This
  // keeps the observation useful even before any dist-tag policy is known to this module (it is
  // deliberately dumb about policy — deriveReleaseState owns that judgement).
  const relevantVersion = distTags.next ?? distTags.latest ?? versions[versions.length - 1] ?? null;

  let dist = null;
  if (relevantVersion) {
    try {
      const distRaw = await run(['view', `${packageName}@${relevantVersion}`, 'dist', '--json']);
      const parsed = parseNpmJson(distRaw, `${packageName}@${relevantVersion}`);
      dist = {
        version: relevantVersion,
        integrity: parsed.integrity ?? null,
        shasum: parsed.shasum ?? null,
        unpackedSize: parsed.unpackedSize ?? null,
      };
    } catch {
      // Missing dist metadata for the resolved version does not invalidate versions/dist-tags,
      // which are the fields deriveReleaseState actually needs. Leave dist null rather than
      // failing the whole package query over optional evidence.
      dist = null;
    }
  }

  return { versions, distTags, dist };
}

/**
 * Query every required package and assemble the observation object. Throws (without writing
 * anything) if any package query fails — satisfies rule 2 above at the caller.
 *
 * @param {object} options
 * @param {string[]} [options.packageNames]
 * @param {() => string} [options.now] - injectable clock, ISO-8601 UTC.
 * @param {string} [options.observedBy]
 * @param {(args: string[]) => Promise<string>} [options.run]
 */
export async function observeRegistry({
  packageNames = LOCKSTEP_PACKAGE_NAMES,
  now = () => new Date().toISOString(),
  observedBy = `local:${process.env.USER ?? process.env.USERNAME ?? 'unknown'}`,
  run = runNpmCommand,
} = {}) {
  const packages = {};
  for (const name of packageNames) {
    packages[name] = await observePackage(name, { run });
  }
  return {
    observedAt: now(),
    observedBy,
    command: { tool: 'npm', args: ['view', '<package>[@<version>]', 'versions', 'dist-tags', 'dist', '--json'] },
    packages,
  };
}

function observationPath(rootDir) {
  return path.join(rootDir, REGISTRY_OBSERVATION_PATH);
}

/** Atomic write: write to a sibling temp file, then rename over the target in one filesystem op. */
export function writeObservationAtomic(rootDir, observation) {
  const target = observationPath(rootDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(observation, null, 2)}\n`);
  fs.renameSync(temp, target);
}

export function readCommittedObservation(rootDir = ROOT_DIR) {
  const target = observationPath(rootDir);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

// The volatile fields (`observedAt`, `observedBy`, `command`) legitimately differ between any two
// observations of the same real registry state — drift comparisons must ignore them.
function observationsAgree(a, b) {
  return JSON.stringify(a?.packages ?? null) === JSON.stringify(b?.packages ?? null);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--stdout') ? 'stdout' : args.includes('--check') ? 'check' : 'write';

  let observation;
  try {
    observation = await observeRegistry();
  } catch (error) {
    console.error(`registry:observe failed to query the npm registry: ${error.message}`);
    console.error('The committed docs/registry-observation.json was left untouched.');
    process.exitCode = 1;
    return;
  }

  if (mode === 'stdout') {
    console.log(JSON.stringify(observation, null, 2));
    return;
  }

  if (mode === 'check') {
    const committed = readCommittedObservation(ROOT_DIR);
    if (!committed) {
      console.error('registry:observe:check found no committed docs/registry-observation.json to compare against.');
      process.exitCode = 1;
      return;
    }
    if (observationsAgree(committed, observation)) {
      console.log(`Registry observation is fresh: no drift from the committed snapshot (observed ${committed.observedAt}).`);
      return;
    }
    console.error('Registry observation has drifted from the committed snapshot:');
    console.error(`- committed: observed ${committed.observedAt} by ${committed.observedBy}`);
    console.error(`- live:      observed ${observation.observedAt} by ${observation.observedBy}`);
    console.error('Run `pnpm registry:observe` and commit the refreshed docs/registry-observation.json.');
    process.exitCode = 1;
    return;
  }

  writeObservationAtomic(ROOT_DIR, observation);
  console.log(`Wrote ${REGISTRY_OBSERVATION_PATH} (observed ${observation.observedAt} by ${observation.observedBy}).`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(`registry:observe failed: ${error.message}`);
    process.exitCode = 1;
  });
}
