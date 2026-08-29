import test from 'node:test';
import assert from 'node:assert/strict';

import { runSamples } from '../benchmark/lib/sampler.mjs';

function fakeClock(values) {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('fake clock exhausted');
    return values[index++];
  };
}

test('warm-up samples are executed but not measured', () => {
  let calls = 0;
  const fn = () => {
    calls += 1;
  };
  // warmup 3, samples 2, iterations 4 -> (3 + 2) * 4 = 20 workload calls.
  // The clock is only read for measured samples: 2 samples * 2 reads = 4.
  const clock = fakeClock([0, 1, 100, 101]);
  const result = runSamples({ fn, warmup: 3, samples: 2, iterations: 4, clock });

  assert.equal(calls, 20);
  assert.equal(result.samples.length, 2);
  assert.equal(result.warmup, 3);
  assert.equal(result.iterations, 4);
});

test('per-op duration divides the sample window by iterations', () => {
  const clock = fakeClock([0, 5, 100, 110]); // sample0 window 5, sample1 window 10
  const { samples } = runSamples({
    fn: () => {},
    warmup: 0,
    samples: 2,
    iterations: 5,
    clock,
  });
  assert.deepEqual(samples, [1, 2]); // 5/5 and 10/5
});

test('validates counts and required inputs', () => {
  assert.throws(() => runSamples({ fn: 'nope' }), TypeError);
  assert.throws(() => runSamples({ fn: () => {}, clock: 'nope' }), TypeError);
  assert.throws(() => runSamples({ fn: () => {}, samples: 0 }), RangeError);
  assert.throws(() => runSamples({ fn: () => {}, iterations: 0 }), RangeError);
  assert.throws(() => runSamples({ fn: () => {}, warmup: -1 }), RangeError);
  assert.throws(() => runSamples({ fn: () => {}, samples: 1.5 }), RangeError);
});

test('warmup may be zero', () => {
  const clock = fakeClock([0, 2]);
  const { samples } = runSamples({ fn: () => {}, warmup: 0, samples: 1, iterations: 1, clock });
  assert.deepEqual(samples, [2]);
});
