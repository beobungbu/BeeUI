/**
 * Mock-service seam (ADR-013 D4). Feature lanes (#259-262) build their own
 * concrete domain functions (`listRecords`, `getRecord`, `saveRecord`,
 * `listSchedule`, ...) on top of `mockFetch`, so every data screen can
 * deterministically produce the same loading/empty/error/success outcomes
 * without each lane re-inventing latency/outcome injection. The interface is
 * replaceable — a real backend could implement the same async-function
 * signatures — but BeeUI itself gains no backend ownership.
 */

export type MockOutcome = 'success' | 'empty' | 'error';

export type MockFetchConfig<T> = {
  /** Value returned when `outcome` is `'empty'`. */
  emptyValue: T;
  /** Message the rejected promise carries when `outcome` is `'error'`. */
  errorMessage?: string;
  /** Simulated network latency in milliseconds. Defaults to `DEFAULT_MOCK_LATENCY_MS`. */
  latencyMs?: number;
  /** Which deterministic outcome to produce. Defaults to `'success'`. */
  outcome?: MockOutcome;
  /** Value returned when `outcome` is `'success'`. */
  successValue: T;
};

export const DEFAULT_MOCK_LATENCY_MS = 350;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Resolve one mock async call deterministically. Awaits `latencyMs`, then
 * either throws (`'error'`) or resolves with `emptyValue`/`successValue`
 * depending on `outcome` — the single seam every feature-domain fetcher in
 * `src/features/<domain>/**` composes with its own fixtures.
 */
export async function mockFetch<T>({
  emptyValue,
  errorMessage,
  latencyMs = DEFAULT_MOCK_LATENCY_MS,
  outcome = 'success',
  successValue,
}: MockFetchConfig<T>): Promise<T> {
  await delay(latencyMs);

  if (outcome === 'error') {
    throw new Error(errorMessage ?? 'Mock service request failed.');
  }

  return outcome === 'empty' ? emptyValue : successValue;
}
