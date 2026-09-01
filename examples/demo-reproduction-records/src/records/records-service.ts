// Thin, replaceable service seam (ADR-013 D4). Returns in-memory fixtures
// behind an async signature a real backend could implement unchanged. It can
// deterministically produce the loading / empty / error outcomes every data
// screen must prove are functional (ADR-013 D5/D7) — driven here by an explicit
// scenario flag rather than randomness, so the demo stays reproducible.

import { DIRECTORY_RECORDS, type DirectoryRecord } from './records-data';

export type DataScenario = 'ok' | 'empty' | 'error';

const LATENCY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listRecords(scenario: DataScenario = 'ok'): Promise<DirectoryRecord[]> {
  await delay(LATENCY_MS);
  if (scenario === 'error') {
    throw new Error('Failed to load records.');
  }
  if (scenario === 'empty') {
    return [];
  }
  return DIRECTORY_RECORDS;
}
