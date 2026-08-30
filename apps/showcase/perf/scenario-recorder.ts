import fs from 'node:fs';
import path from 'node:path';

/**
 * Raw sample dump written by the Jest-hosted component benchmark lane
 * (perf-render-commit / perf-overlay-latency / perf-theme-runtime test
 * files). `scripts/benchmark/collect-component-results.mjs` — plain Node,
 * part of the #179 harness — turns these into the harness's real
 * schema-conformant result set via its own `summarizeSamples`/
 * `createResultSet`/reporters. This file only carries data across the
 * Jest(CJS)/harness(ESM) boundary; no statistics or schema logic lives here.
 */
export type RawScenarioRecord = {
  id: string;
  title: string;
  platform: 'web' | 'native';
  unit: string;
  description?: string;
  warmup: number;
  samples: number;
  iterations: number;
  candidate: { label: string; durations: number[] };
  baseline?: { label: string; durations: number[] };
  budget?: { maxOverheadRatio: number };
};

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const RAW_DIR = path.join(ROOT_DIR, '.artifacts', 'benchmark', 'raw');

export function writeRawScenarioRecords(laneFileName: string, records: RawScenarioRecord[]): void {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, laneFileName), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}
