import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mean,
  median,
  min,
  max,
  percentile,
  standardDeviation,
  coefficientOfVariation,
  summarizeSamples,
} from '../benchmark/lib/statistics.mjs';

test('mean/min/max on known input', () => {
  const values = [2, 4, 6, 8];
  assert.equal(mean(values), 5);
  assert.equal(min(values), 2);
  assert.equal(max(values), 8);
});

test('median uses linear interpolation for even and odd counts', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  // Unsorted input is sorted internally.
  assert.equal(median([5, 1, 3, 2, 4]), 3);
});

test('percentile matches the linear (type-7) method', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(values, 0), 1);
  assert.equal(percentile(values, 100), 10);
  // rank = 0.9 * 9 = 8.1 -> 9 + 0.1 * (10 - 9) = 9.1
  assert.equal(Math.round(percentile(values, 90) * 1000) / 1000, 9.1);
  assert.equal(percentile([42], 95), 42);
});

test('percentile rejects out-of-range p', () => {
  assert.throws(() => percentile([1, 2], -1), RangeError);
  assert.throws(() => percentile([1, 2], 101), RangeError);
});

test('sample standard deviation is Bessel-corrected and zero for one sample', () => {
  // [2,4,4,4,5,5,7,9]: mean 5, sum of squared error 32, sample variance 32/7.
  assert.equal(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  assert.equal(standardDeviation([5]), 0);
});

test('coefficient of variation is stdev/mean and null when mean is zero', () => {
  assert.equal(coefficientOfVariation([10, 10, 10]), 0);
  const cv = coefficientOfVariation([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(cv, Math.sqrt(32 / 7) / 5);
  assert.equal(coefficientOfVariation([-1, 0, 1]), null);
});

test('summarizeSamples returns the full stat block', () => {
  const summary = summarizeSamples([1, 2, 3, 4, 5]);
  assert.equal(summary.count, 5);
  assert.equal(summary.mean, 3);
  assert.equal(summary.median, 3);
  assert.equal(summary.min, 1);
  assert.equal(summary.max, 5);
  assert.ok(summary.stdev > 0);
  assert.ok(summary.cv > 0);
  assert.equal(summary.p95, percentile([1, 2, 3, 4, 5], 95));
  assert.equal(summary.p99, percentile([1, 2, 3, 4, 5], 99));
});

test('empty and non-finite inputs are rejected', () => {
  assert.throws(() => mean([]), TypeError);
  assert.throws(() => summarizeSamples([]), TypeError);
  assert.throws(() => mean([1, Number.NaN]), TypeError);
  assert.throws(() => mean([1, Infinity]), TypeError);
});
