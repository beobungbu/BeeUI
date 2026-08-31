// Pure regression-budget evaluator (#185, R5.7).
//
// Takes already-collected footprint numbers (a `footprint.mjs` result set)
// and a budget config (`../footprint-budgets.mjs`) and derives a per-row
// verdict. No I/O, no process exit — the same dependency-injection discipline
// `lib/footprint-analysis.mjs` uses, so this is testable without running npm
// pack or esbuild.
//
// Status meanings:
//   'pass'       — within `warnPct` of baseline (growth or shrink).
//   'warn'       — grew beyond `warnPct` but not beyond `failPct`
//                  (informational drift, per #185's rule to separate this
//                  from a severe regression — does not fail the check).
//   'fail'       — grew beyond `failPct` (severe regression — fails the
//                  check).
//   'unbudgeted' — measured but has no entry in the budget config; reported
//                  for visibility, never fails (a new scenario should not
//                  silently start failing before anyone decides its budget).

function evaluateOne(id, measuredGzipBytes, budget) {
  if (!budget) {
    return { id, measuredGzipBytes, baselineGzipBytes: null, deltaPct: null, status: 'unbudgeted' };
  }
  const { baselineGzipBytes, warnPct, failPct } = budget;
  const deltaPct = baselineGzipBytes === 0 ? 0 : (measuredGzipBytes - baselineGzipBytes) / baselineGzipBytes;
  let status = 'pass';
  if (deltaPct > failPct) status = 'fail';
  else if (deltaPct > warnPct) status = 'warn';
  return { id, measuredGzipBytes, baselineGzipBytes, deltaPct, status };
}

/**
 * @param {{packages: Record<string, {name: string, packedGzipBytes: number}>,
 *   scenarios: Array<{id: string, gzipBytes: number}>}} footprintResultSet
 * @param {{packages: Record<string, {baselineGzipBytes: number, warnPct: number, failPct: number}>,
 *   scenarios: Record<string, {baselineGzipBytes: number, warnPct: number, failPct: number}>}} budgets
 */
export function evaluateFootprintBudgets(footprintResultSet, budgets) {
  if (!footprintResultSet || typeof footprintResultSet !== 'object') {
    throw new TypeError('evaluateFootprintBudgets requires a footprint result set object');
  }
  if (!budgets || typeof budgets !== 'object') {
    throw new TypeError('evaluateFootprintBudgets requires a budgets object');
  }

  const packageRows = Object.values(footprintResultSet.packages ?? {}).map((pkg) =>
    evaluateOne(pkg.name, pkg.packedGzipBytes, budgets.packages?.[pkg.name] ?? null),
  );
  const scenarioRows = (footprintResultSet.scenarios ?? []).map((scenario) =>
    evaluateOne(scenario.id, scenario.gzipBytes, budgets.scenarios?.[scenario.id] ?? null),
  );

  const rows = [...packageRows, ...scenarioRows];
  return {
    rows,
    hasFailure: rows.some((row) => row.status === 'fail'),
    hasWarning: rows.some((row) => row.status === 'warn'),
  };
}
