#!/usr/bin/env node
// Component-render benchmark collector (BeeUI #180/#181/#182).
//
// Real BeeUI component render/commit, overlay open-latency and theme-runtime
// measurements need an actual React/React Native component tree — something
// this dependency-free ESM harness cannot mount itself (no bundler, no DOM/RN
// runtime). `apps/showcase`'s existing Jest + `@testing-library/react-native`
// setup already mounts real BeeUI components with the same mocks its
// component tests use, so it plays here exactly the role a native
// `deviceRunner` plays for `scripts/benchmark/lib/runner.mjs`'s native lane:
// it supplies real samples this host cannot otherwise produce, and this
// script never fabricates a number it did not receive.
//
// Usage:
//   pnpm --filter @beemvp/beeui-showcase bench   # writes .artifacts/benchmark/raw/*.json
//   node scripts/benchmark/collect-component-results.mjs
//
// This script performs no measurement itself: it reads the raw per-scenario
// duration arrays Jest wrote to `.artifacts/benchmark/raw/*.json` and turns
// them into the SAME schema-conformant result set `cli.mjs` produces, using
// the harness's own `summarizeSamples`/`createResultSet`/reporters — no
// duplicated math, no duplicated schema.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeSamples } from './lib/statistics.mjs';
import { createResultSet, assertValidResultSet } from './lib/schema.mjs';
import { collectEnvironmentMetadata } from './lib/metadata.mjs';
import { toJson, toSummary, hasBudgetFailure } from './lib/reporters.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW_DIR = path.join(ROOT_DIR, '.artifacts', 'benchmark', 'raw');
const OUT_DIR = path.join(ROOT_DIR, '.artifacts', 'benchmark');

function measurementFrom(raw) {
  if (!raw) return null;
  if (!Array.isArray(raw.durations) || raw.durations.length === 0) {
    throw new Error(`measurement "${raw.label}" has no recorded durations`);
  }
  return { label: raw.label, stats: summarizeSamples(raw.durations) };
}

function toResult(record) {
  const candidate = measurementFrom(record.candidate);
  const baseline = measurementFrom(record.baseline ?? null);

  let overheadRatio = null;
  if (candidate && baseline && baseline.stats.median !== 0) {
    overheadRatio = candidate.stats.median / baseline.stats.median;
  }

  let budgetStatus = 'n/a';
  if (record.budget) {
    budgetStatus = overheadRatio !== null && overheadRatio <= record.budget.maxOverheadRatio ? 'pass' : 'fail';
  }

  return {
    id: record.id,
    title: record.title,
    platform: record.platform,
    unit: record.unit,
    status: 'measured',
    warmup: record.warmup,
    samples: record.samples,
    iterations: record.iterations,
    candidate,
    baseline,
    overheadRatio,
    budget: record.budget ?? null,
    budgetStatus,
    note: record.description ?? null,
  };
}

export function main() {
  if (!fs.existsSync(RAW_DIR)) {
    process.stderr.write(
      `no raw component samples at ${path.relative(ROOT_DIR, RAW_DIR)} — run ` +
        '"pnpm --filter @beemvp/beeui-showcase bench" first\n',
    );
    return 1;
  }

  const files = fs
    .readdirSync(RAW_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    process.stderr.write(`no raw component sample files found in ${path.relative(ROOT_DIR, RAW_DIR)}\n`);
    return 1;
  }

  const results = [];
  for (const file of files) {
    const records = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf8'));
    for (const record of records) results.push(toResult(record));
  }
  results.sort((a, b) => a.id.localeCompare(b.id));

  const metadata = collectEnvironmentMetadata({ platform: 'web' });
  const resultSet = assertValidResultSet(createResultSet({ metadata, results }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shaTag = metadata.git.shortSha ?? 'nogit';
  const outFile = path.join(OUT_DIR, `web-component-${shaTag}.json`);
  fs.writeFileSync(outFile, `${toJson(resultSet)}\n`, 'utf8');

  process.stdout.write(`${toSummary(resultSet)}\n`);
  process.stdout.write(`\nwrote ${path.relative(ROOT_DIR, outFile)}\n`);

  return hasBudgetFailure(resultSet) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = main();
}
