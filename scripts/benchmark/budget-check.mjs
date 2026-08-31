#!/usr/bin/env node
// BeeUI performance regression budget check (#185, R5.7).
//
// Reads the most recently written `footprint.mjs` result set
// (`.artifacts/benchmark/footprint-<sha>.json`) and compares every package
// and bundle-scenario gzip size against the recorded budgets
// (`footprint-budgets.mjs`) via the pure evaluator (`lib/budget-evaluator.mjs`).
//
// This is a separate, cheap step from `footprint.mjs` itself (which does the
// real npm-pack/esbuild measurement) so a CI job — or a local
// `pnpm bench:budget`, which chains both — gets one clear pass/fail signal
// without re-deriving the numbers.
//
// Exit codes:
//   0 — every budgeted row passed (warnings, if any, are printed but do not
//       fail the check — see `footprint-budgets.mjs`'s two-tier policy).
//   1 — at least one row failed its budget (severe regression).
//   2 — no footprint result set found (run `pnpm bench:footprint` first).
//
// Usage:
//   node scripts/benchmark/budget-check.mjs [--dir <dir>] [--file <path>]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateFootprintBudgets } from './lib/budget-evaluator.mjs';
import { PACKAGE_FOOTPRINT_BUDGETS, BUNDLE_SCENARIO_FOOTPRINT_BUDGETS } from './footprint-budgets.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const options = { dir: path.join(ROOT_DIR, '.artifacts', 'benchmark'), file: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`missing value for ${arg}`);
      i += 1;
      return value;
    };
    if (arg === '--dir') {
      const value = next();
      options.dir = path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
    } else if (arg === '--file') {
      options.file = next();
    }
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

// Find the most recently written `footprint-*.json` in `dir` — `footprint.mjs`
// names its output by git SHA, so there is no fixed filename to read.
function findLatestFootprintFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const candidates = fs
    .readdirSync(dir)
    .filter((file) => file.startsWith('footprint-') && file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(dir, file);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates.length > 0 ? candidates[0].fullPath : null;
}

function formatBytes(bytes) {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatPct(pct) {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(1)}%`;
}

function toSummary(evaluation) {
  const lines = [];
  lines.push('BeeUI performance regression budget check (#185)');
  lines.push('='.repeat(60));
  for (const row of evaluation.rows) {
    lines.push(
      `[${row.status.toUpperCase().padEnd(10)}] ${row.id.padEnd(34)} ` +
        `measured ${formatBytes(row.measuredGzipBytes).padStart(9)}  ` +
        `baseline ${formatBytes(row.baselineGzipBytes).padStart(9)}  ` +
        `delta ${formatPct(row.deltaPct).padStart(7)}`,
    );
  }
  lines.push('-'.repeat(60));
  const failing = evaluation.rows.filter((row) => row.status === 'fail');
  const warning = evaluation.rows.filter((row) => row.status === 'warn');
  if (failing.length > 0) {
    lines.push(`RESULT: ${failing.length} budget(s) FAILED: ${failing.map((r) => r.id).join(', ')}`);
  } else {
    lines.push('RESULT: all budgeted packages/scenarios within budget');
  }
  if (warning.length > 0) {
    lines.push(`(informational) ${warning.length} scenario(s) drifted past the warn threshold: ${warning.map((r) => r.id).join(', ')}`);
  }
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const footprintFile = options.file
    ? path.isAbsolute(options.file)
      ? options.file
      : path.join(ROOT_DIR, options.file)
    : findLatestFootprintFile(options.dir);

  if (!footprintFile || !fs.existsSync(footprintFile)) {
    process.stderr.write(
      `no footprint result set found — run "pnpm bench:footprint" first (or "pnpm bench:budget", which chains both)\n`,
    );
    return 2;
  }

  const footprintResultSet = JSON.parse(fs.readFileSync(footprintFile, 'utf8'));
  const evaluation = evaluateFootprintBudgets(footprintResultSet, {
    packages: PACKAGE_FOOTPRINT_BUDGETS,
    scenarios: BUNDLE_SCENARIO_FOOTPRINT_BUDGETS,
  });

  process.stdout.write(`${toSummary(evaluation)}\n`);
  process.stdout.write(`\nread ${path.relative(ROOT_DIR, footprintFile)}\n`);

  return evaluation.hasFailure ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`budget check failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}
