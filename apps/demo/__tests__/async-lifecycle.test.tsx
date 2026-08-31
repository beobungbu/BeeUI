import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAsync } from '../src/services/async-lifecycle';

describe('useAsync', () => {
  it('transitions idle -> loading -> success', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(['a', 'b']), []));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toEqual(['a', 'b']);
  });

  it('reports "empty" when isEmpty(data) is true', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.resolve([] as string[]), [], { isEmpty: (data) => data.length === 0 }),
    );

    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('reports "error" with the thrown Error on rejection', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('network down')), []));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('network down');
  });

  it('retry() re-runs the task and can recover from an error', async () => {
    let attempt = 0;
    const task = () => (attempt++ === 0 ? Promise.reject(new Error('first attempt fails')) : Promise.resolve('ok'));

    const { result } = renderHook(() => useAsync(task, []));
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('ok');
  });

  it('ignores a stale in-flight call when deps change before it resolves', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const firstCall = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });

    const { result, rerender } = renderHook(({ id }: { id: number }) =>
      useAsync(() => (id === 1 ? firstCall : Promise.resolve('second')), [id]), {
      initialProps: { id: 1 },
    });

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('second');

    resolveFirst('stale');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.data).toBe('second');
  });
});
