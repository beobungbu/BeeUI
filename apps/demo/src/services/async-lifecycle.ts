import * as React from 'react';

/**
 * Shared `idle -> loading -> success | empty | error` lifecycle (ADR-013 D4).
 * Every data-driven screen (#259-262) consumes this instead of re-implementing
 * its own async state machine — the one DRY seam every data screen shares. It
 * is deliberately not a global store: each call to `useAsync` owns its own
 * feature-local state, matching D4's "no store framework" decision.
 */

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type AsyncState<T> =
  | { status: 'idle'; data: undefined; error: undefined }
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'empty'; data: undefined; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

export type UseAsyncOptions<T> = {
  /** Treats a resolved value as the empty state when it returns `true`. */
  isEmpty?: (data: T) => boolean;
};

export type UseAsyncResult<T> = AsyncState<T> & {
  /** Re-runs `task` from `loading`, ignoring any previous still-pending call. */
  retry: () => void;
};

const IDLE_STATE: AsyncState<never> = { status: 'idle', data: undefined, error: undefined };
const LOADING_STATE: AsyncState<never> = { status: 'loading', data: undefined, error: undefined };

/**
 * Runs `task` on mount and whenever `deps` changes, exposing the resolved
 * lifecycle plus a `retry()` escape hatch for the error state. Stale
 * responses (a previous call resolving after a newer one started) are
 * ignored via a per-call generation counter, so a fast `retry()` or a `deps`
 * change never lets an in-flight older call overwrite newer state.
 */
export function useAsync<T>(
  task: () => Promise<T>,
  deps: React.DependencyList,
  options: UseAsyncOptions<T> = {},
): UseAsyncResult<T> {
  const { isEmpty } = options;
  const [state, setState] = React.useState<AsyncState<T>>(IDLE_STATE);
  const generationRef = React.useRef(0);
  const taskRef = React.useRef(task);
  taskRef.current = task;
  const isEmptyRef = React.useRef(isEmpty);
  isEmptyRef.current = isEmpty;

  const run = React.useCallback(() => {
    const generation = ++generationRef.current;
    setState(LOADING_STATE);

    taskRef
      .current()
      .then((data) => {
        if (generationRef.current !== generation) return;
        const empty = isEmptyRef.current?.(data) ?? false;
        setState(
          empty
            ? { status: 'empty', data: undefined, error: undefined }
            : { status: 'success', data, error: undefined },
        );
      })
      .catch((caught: unknown) => {
        if (generationRef.current !== generation) return;
        const error = caught instanceof Error ? caught : new Error(String(caught));
        setState({ status: 'error', data: undefined, error });
      });
  }, []);

  React.useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is caller-supplied by design (mirrors useEffect's own contract).
  }, deps);

  return { ...state, retry: run };
}
