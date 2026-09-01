// One small app-owned async-lifecycle hook (ADR-013 D4's illustrative `useAsync`):
// idle → loading → success | error, plus a `reload()`. BeeUI ships no data
// layer, so this is the application's, not a BeeUI export.

import * as React from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

export function useAsync<T>(loader: () => Promise<T>): AsyncState<T> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setState({ status: 'loading', data: undefined, error: undefined });
    loader()
      .then((data) => {
        if (active) setState({ status: 'success', data, error: undefined });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: 'error',
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      active = false;
    };
    // Re-runs when the caller supplies a new (memoized) loader or calls reload().
  }, [loader, nonce]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
