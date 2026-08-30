// Machine-readable result schema + validator.
//
// The schema is the stable contract that trend/regression tooling reads. It is
// versioned so a consumer can detect a shape change, and validated by a
// dependency-free checker so a malformed result fails loudly instead of quietly
// corrupting a history series. Kept deliberately small and hand-written so the
// exact contract lives in one readable place.

export const SCHEMA_VERSION = '1.0.0';

export const TOOL_NAME = 'beeui-benchmark-harness';

// Assemble the top-level machine-readable document from captured metadata and
// per-scenario results. Key order is fixed so serialized output is stable.
export function createResultSet({ metadata, results, tool = TOOL_NAME }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    tool,
    metadata,
    results,
  };
}

const STAT_KEYS = ['count', 'mean', 'median', 'min', 'max', 'stdev', 'cv', 'p95', 'p99'];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateStats(stats, label, errors) {
  if (stats === null || typeof stats !== 'object') {
    errors.push(`${label}: stats must be an object`);
    return;
  }
  for (const key of STAT_KEYS) {
    if (!(key in stats)) {
      errors.push(`${label}: stats missing "${key}"`);
      continue;
    }
    // cv is allowed to be null (undefined when the mean is 0); everything else
    // must be a finite number.
    if (key === 'cv') {
      if (stats.cv !== null && !isFiniteNumber(stats.cv)) {
        errors.push(`${label}: stats.cv must be a finite number or null`);
      }
      continue;
    }
    if (!isFiniteNumber(stats[key])) {
      errors.push(`${label}: stats.${key} must be a finite number`);
    }
  }
}

function validateMeasurement(measurement, label, errors) {
  if (measurement === null) return;
  if (typeof measurement !== 'object') {
    errors.push(`${label}: measurement must be an object or null`);
    return;
  }
  if (typeof measurement.label !== 'string' || measurement.label.length === 0) {
    errors.push(`${label}: measurement.label must be a non-empty string`);
  }
  validateStats(measurement.stats, `${label}.stats`, errors);
}

function validateResult(result, index, errors) {
  const label = `results[${index}]`;
  if (result === null || typeof result !== 'object') {
    errors.push(`${label}: must be an object`);
    return;
  }
  if (typeof result.id !== 'string' || result.id.length === 0) {
    errors.push(`${label}.id must be a non-empty string`);
  }
  if (typeof result.title !== 'string' || result.title.length === 0) {
    errors.push(`${label}.title must be a non-empty string`);
  }
  if (result.platform !== 'web' && result.platform !== 'native') {
    errors.push(`${label}.platform must be 'web' or 'native'`);
  }
  if (result.status !== 'measured' && result.status !== 'deferred') {
    errors.push(`${label}.status must be 'measured' or 'deferred'`);
  }
  if (typeof result.unit !== 'string' || result.unit.length === 0) {
    errors.push(`${label}.unit must be a non-empty string`);
  }

  if (result.status === 'measured') {
    validateMeasurement(result.candidate, `${label}.candidate`, errors);
    if (result.candidate === null) {
      errors.push(`${label}.candidate is required for a measured result`);
    }
    validateMeasurement(result.baseline, `${label}.baseline`, errors);
    if (result.overheadRatio !== null && !isFiniteNumber(result.overheadRatio)) {
      errors.push(`${label}.overheadRatio must be a finite number or null`);
    }
  } else {
    // Deferred results carry no measurements and must say why.
    if (result.candidate !== null || result.baseline !== null) {
      errors.push(`${label}: deferred results must not carry measurements`);
    }
    if (typeof result.note !== 'string' || result.note.length === 0) {
      errors.push(`${label}: deferred results must include a note explaining the deferral`);
    }
  }

  if (!['pass', 'fail', 'n/a'].includes(result.budgetStatus)) {
    errors.push(`${label}.budgetStatus must be 'pass', 'fail' or 'n/a'`);
  }
}

export function validateResultSet(resultSet) {
  const errors = [];
  if (resultSet === null || typeof resultSet !== 'object') {
    return { valid: false, errors: ['result set must be an object'] };
  }
  if (resultSet.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${SCHEMA_VERSION}", received: ${String(resultSet.schemaVersion)}`);
  }
  if (typeof resultSet.tool !== 'string' || resultSet.tool.length === 0) {
    errors.push('tool must be a non-empty string');
  }
  if (resultSet.metadata === null || typeof resultSet.metadata !== 'object') {
    errors.push('metadata must be an object');
  } else if (resultSet.metadata.platform !== 'web' && resultSet.metadata.platform !== 'native') {
    errors.push("metadata.platform must be 'web' or 'native'");
  }
  if (!Array.isArray(resultSet.results)) {
    errors.push('results must be an array');
  } else {
    resultSet.results.forEach((result, index) => validateResult(result, index, errors));
  }
  return { valid: errors.length === 0, errors };
}

// Throwing wrapper for callers that treat an invalid result set as a hard error.
export function assertValidResultSet(resultSet) {
  const { valid, errors } = validateResultSet(resultSet);
  if (!valid) {
    throw new Error(`invalid benchmark result set:\n- ${errors.join('\n- ')}`);
  }
  return resultSet;
}
