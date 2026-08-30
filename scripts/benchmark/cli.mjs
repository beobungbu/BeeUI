#!/usr/bin/env node
// BeeUI benchmark harness — command-line front end.
//
// Web and native are separate lanes by design (the methodologies differ), so one
// invocation runs one platform lane and writes one coherent result set.
//
// Usage:
//   node scripts/benchmark/cli.mjs [--platform web|native] [--scenario <id>]
//                                  [--out <dir>] [--samples N] [--warmup N]
//                                  [--list] [--no-fail] [--quiet]
//
// Exit code is non-zero when a budgeted scenario is over budget (regression
// gate), unless --no-fail is passed. Machine-readable JSON is written to
// <out>/<platform>-<sha>.json (out defaults to the gitignored .artifacts dir);
// the human summary is printed to stdout.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectEnvironmentMetadata } from './lib/metadata.mjs';
import { createResultSet, assertValidResultSet } from './lib/schema.mjs';
import { runScenarios } from './lib/runner.mjs';
import { toJson, toSummary, hasBudgetFailure } from './lib/reporters.mjs';
import { buildDefaultRegistry } from './scenarios/index.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const options = {
    platform: 'web',
    scenario: null,
    out: path.join('.artifacts', 'benchmark'),
    samples: null,
    warmup: null,
    list: false,
    fail: true,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`missing value for ${arg}`);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--platform':
        options.platform = next();
        break;
      case '--scenario':
        options.scenario = next();
        break;
      case '--out':
        options.out = next();
        break;
      case '--samples':
        options.samples = Number.parseInt(next(), 10);
        break;
      case '--warmup':
        options.warmup = Number.parseInt(next(), 10);
        break;
      case '--list':
        options.list = true;
        break;
      case '--no-fail':
        options.fail = false;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (options.platform !== 'web' && options.platform !== 'native') {
    throw new Error(`--platform must be 'web' or 'native', received: ${options.platform}`);
  }
  return options;
}

const HELP = `BeeUI benchmark harness
  --platform web|native   platform lane to run (default web)
  --scenario <id>         run a single scenario by id
  --out <dir>             output directory for JSON (default .artifacts/benchmark)
  --samples N             override measured samples per scenario
  --warmup N              override warm-up samples per scenario
  --list                  list registered scenarios and exit
  --no-fail               do not exit non-zero on a budget failure
  --quiet                 do not print the human summary
  -h, --help              show this help`;

// Apply CLI overrides by re-defining the scenario with patched sampling counts.
function applyOverrides(scenario, { samples, warmup }) {
  if (samples === null && warmup === null) return scenario;
  return {
    ...scenario,
    samples: samples ?? scenario.samples,
    warmup: warmup ?? scenario.warmup,
    candidate: scenario.candidate,
    baseline: scenario.baseline,
  };
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }

  const registry = buildDefaultRegistry();

  if (options.list) {
    for (const scenario of registry.list()) {
      process.stdout.write(`${scenario.platform.padEnd(6)} ${scenario.id} — ${scenario.title}\n`);
    }
    return 0;
  }

  let scenarios = registry.byPlatform(options.platform);
  if (options.scenario) {
    scenarios = scenarios.filter((scenario) => scenario.id === options.scenario);
    if (scenarios.length === 0) {
      throw new Error(`no ${options.platform} scenario with id "${options.scenario}"`);
    }
  }

  const patched = scenarios.map((scenario) => applyOverrides(scenario, options));
  const metadata = collectEnvironmentMetadata({ platform: options.platform });
  const results = runScenarios(patched);
  const resultSet = assertValidResultSet(createResultSet({ metadata, results }));

  const outDir = path.isAbsolute(options.out) ? options.out : path.join(ROOT_DIR, options.out);
  fs.mkdirSync(outDir, { recursive: true });
  const shaTag = metadata.git.shortSha ?? 'nogit';
  const outFile = path.join(outDir, `${options.platform}-${shaTag}.json`);
  fs.writeFileSync(outFile, `${toJson(resultSet)}\n`, 'utf8');

  if (!options.quiet) {
    process.stdout.write(`${toSummary(resultSet)}\n`);
    process.stdout.write(`\nwrote ${path.relative(ROOT_DIR, outFile)}\n`);
  }

  if (options.fail && hasBudgetFailure(resultSet)) {
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`benchmark failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}
