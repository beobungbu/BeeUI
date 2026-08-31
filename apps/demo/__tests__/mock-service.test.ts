import { mockFetch } from '../src/services/mock-service';

describe('mockFetch', () => {
  it('resolves with the success value by default', async () => {
    const result = await mockFetch({ emptyValue: [], successValue: [1, 2, 3], latencyMs: 0 });
    expect(result).toEqual([1, 2, 3]);
  });

  it('resolves with the empty value when outcome is "empty"', async () => {
    const result = await mockFetch({
      emptyValue: [],
      successValue: [1, 2, 3],
      outcome: 'empty',
      latencyMs: 0,
    });
    expect(result).toEqual([]);
  });

  it('rejects with the configured message when outcome is "error"', async () => {
    await expect(
      mockFetch({
        emptyValue: [],
        successValue: [1],
        outcome: 'error',
        errorMessage: 'boom',
        latencyMs: 0,
      }),
    ).rejects.toThrow('boom');
  });

  it('rejects with a default message when no errorMessage is provided', async () => {
    await expect(
      mockFetch({ emptyValue: [], successValue: [1], outcome: 'error', latencyMs: 0 }),
    ).rejects.toThrow(/mock service/i);
  });
});
