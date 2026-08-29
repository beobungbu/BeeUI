// Pure descriptive statistics for benchmark samples.
//
// Every function here is deterministic and side-effect free: it takes an array
// of finite numbers and returns numbers. Rounding/formatting is intentionally
// NOT done here — it is a reporter concern — so trend/regression consumers keep
// full precision. These helpers are the load-bearing math behind every measured
// result, so they are unit tested against known inputs.

function assertNonEmptyNumbers(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('statistics require a non-empty array of samples');
  }
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`statistics require finite numbers, received: ${String(value)}`);
    }
  }
}

export function mean(values) {
  assertNonEmptyNumbers(values);
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

export function min(values) {
  assertNonEmptyNumbers(values);
  return values.reduce((lowest, value) => (value < lowest ? value : lowest), values[0]);
}

export function max(values) {
  assertNonEmptyNumbers(values);
  return values.reduce((highest, value) => (value > highest ? value : highest), values[0]);
}

// Percentile using linear interpolation between closest ranks on the sorted
// samples (the common "linear"/type-7 method). p is a percentage in [0, 100].
export function percentile(values, p) {
  assertNonEmptyNumbers(values);
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100) {
    throw new RangeError(`percentile p must be within [0, 100], received: ${String(p)}`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];

  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const fraction = rank - low;
  return sorted[low] * (1 - fraction) + sorted[high] * fraction;
}

export function median(values) {
  return percentile(values, 50);
}

// Sample standard deviation (Bessel-corrected, n - 1). A single sample has no
// spread, so it returns 0 rather than dividing by zero.
export function standardDeviation(values) {
  assertNonEmptyNumbers(values);
  if (values.length === 1) return 0;
  const average = mean(values);
  let sumSquaredError = 0;
  for (const value of values) {
    const error = value - average;
    sumSquaredError += error * error;
  }
  return Math.sqrt(sumSquaredError / (values.length - 1));
}

// Coefficient of variation: standard deviation relative to the mean. This is the
// primary determinism/noise indicator a regression consumer should watch — a low
// CV means the harness measured a stable signal on this host. Returns null when
// the mean is 0 because the ratio is undefined.
export function coefficientOfVariation(values) {
  const average = mean(values);
  if (average === 0) return null;
  return standardDeviation(values) / average;
}

// One call that produces the full statistical summary stored in a result record.
export function summarizeSamples(values) {
  assertNonEmptyNumbers(values);
  return {
    count: values.length,
    mean: mean(values),
    median: median(values),
    min: min(values),
    max: max(values),
    stdev: standardDeviation(values),
    cv: coefficientOfVariation(values),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}
