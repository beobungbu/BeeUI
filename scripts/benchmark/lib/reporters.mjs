// Reporters: the two required output shapes for a result set.
//
//   toJson    — machine-readable, full precision, stable key order, for
//               trend/regression storage and diffing.
//   toSummary — human-readable text for a terminal or CI log.
//
// Both are pure functions of the result set. Numeric formatting for humans lives
// only in the summary reporter; the JSON keeps full precision.

function round(value, decimals) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function toJson(resultSet, { pretty = true } = {}) {
  return JSON.stringify(resultSet, null, pretty ? 2 : 0);
}

function formatNumber(value, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return String(round(value, decimals));
}

function formatMeasurement(measurement) {
  if (measurement === null) return '—';
  const { stats } = measurement;
  const cv = stats.cv === null ? '—' : `${round(stats.cv * 100, 2)}%`;
  return `${formatNumber(stats.median)} (p95 ${formatNumber(stats.p95)}, cv ${cv})`;
}

export function toSummary(resultSet) {
  const { metadata, results } = resultSet;
  const lines = [];

  lines.push('BeeUI benchmark harness — run summary');
  lines.push('='.repeat(60));
  lines.push(`schema:     ${resultSet.schemaVersion}`);
  lines.push(`platform:   ${metadata.platform}`);
  lines.push(`timestamp:  ${metadata.timestamp}`);
  lines.push(`runtime:    node ${metadata.runtime.node} (v8 ${metadata.runtime.v8})`);
  lines.push(`os/cpu:     ${metadata.os.platform} ${metadata.os.arch} · ${metadata.cpu.model ?? 'unknown cpu'} × ${metadata.cpu.cores ?? '?'}`);
  lines.push(`react-native: ${metadata.reactNative ?? 'n/a'}`);
  lines.push(`git:        ${metadata.git.shortSha ?? 'unknown'}${metadata.git.dirty ? ' (dirty)' : ''}${metadata.git.branch ? ` · ${metadata.git.branch}` : ''}`);
  lines.push(`ci:         ${metadata.ci ? 'yes' : 'no'}`);
  lines.push('');

  if (results.length === 0) {
    lines.push('(no scenarios matched)');
    return lines.join('\n');
  }

  for (const result of results) {
    lines.push(`▸ ${result.id} — ${result.title}  [${result.platform}]`);
    if (result.status === 'deferred') {
      lines.push(`    status:   DEFERRED`);
      lines.push(`    reason:   ${result.note}`);
      lines.push('');
      continue;
    }
    lines.push(`    unit:     ${result.unit}   (warmup ${result.warmup}, samples ${result.samples}, iterations ${result.iterations})`);
    lines.push(`    candidate ${result.candidate.label}: ${formatMeasurement(result.candidate)}`);
    if (result.baseline) {
      lines.push(`    baseline  ${result.baseline.label}: ${formatMeasurement(result.baseline)}`);
    }
    if (result.overheadRatio !== null) {
      lines.push(`    overhead: ${formatNumber(result.overheadRatio, 3)}× vs baseline`);
    }
    if (result.budget) {
      lines.push(`    budget:   ${result.budgetStatus.toUpperCase()} (max ${result.budget.maxOverheadRatio}×)`);
    }
    lines.push('');
  }

  const failing = results.filter((result) => result.budgetStatus === 'fail');
  lines.push('-'.repeat(60));
  lines.push(
    failing.length > 0
      ? `RESULT: ${failing.length} scenario(s) over budget: ${failing.map((r) => r.id).join(', ')}`
      : 'RESULT: all budgeted scenarios within budget',
  );

  return lines.join('\n');
}

export function hasBudgetFailure(resultSet) {
  return resultSet.results.some((result) => result.budgetStatus === 'fail');
}
