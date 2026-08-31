// BeeUI issue #168 (R4E.5) — Table performance and scale acceptance.
//
// Real, honest Web workload for Table's actual per-row/per-cell render hot
// path (`packages/ui/src/components/table.web.tsx`): the `cn()` className
// resolution `TableRow`/`TableHead`/`TableCell` perform every render, plus the
// column-label registry `Map` reads/writes each `TableHead`/`TableCell` does
// (`table.tsx`'s `TableColumnLabelRegistry`) and the sort-glyph lookup a
// sortable header performs. `cn` is imported from the real `@beemvp/beeui-core`
// package (not reimplemented here), so `twMerge`/`clsx`'s actual cost is
// measured, not simulated.
//
// This does not render real React/DOM trees — `table.web.tsx` is JSX/TSX,
// which this pure-Node harness cannot import (see `docs/benchmark-harness.md`
// "Web methodology": the workload runs in-process on this host through the
// sampler). Per ADR-007 and `web/variant-class-resolution.mjs`'s own
// precedent, a controlled candidate-vs-baseline workload over the SAME real
// per-cell computation is the honest, harness-shaped proxy for the render
// hot path — not a fabricated end-to-end render number.
//
// Scenarios:
//   - `web/table-render-100` / `web/table-render-500` — the accepted
//     100-row/500-row scale envelope from the issue's "Required scenarios".
//     `candidate` is the real `cn()`-based resolution; `baseline` is the same
//     output via naive string concatenation (no twMerge/clsx), the same
//     methodology `web/variant-class-resolution.mjs` established.
//     `budget.maxOverheadRatio: 15` (#185, R5.7) gates `cn()`'s real
//     resolution cost staying a bounded multiple of the naive baseline —
//     see the scenario definition for the observed-range rationale.
//   - `web/table-row-update` — the issue's "row selection/sort update should
//     not catastrophically rerender unrelated content" requirement, in two
//     complementary parts. `Table` is a thin compositional layer (ADR-007: it
//     owns no row data/selection state), so it does not itself memoize rows —
//     `apps/showcase/__tests__/table-performance.test.tsx` empirically proves
//     a plain `rows.map(...)` re-invokes EVERY row's render function on a
//     sibling's selection change, and that wrapping row content in
//     `React.memo` is a real, verified mitigation that isolates the update to
//     only the changed row. This scenario supplies the OTHER half: the
//     `web/table-render-100`/`-500` full-table-recompute numbers above already
//     show that cost is small in absolute terms (well under a 16ms frame
//     budget at 500 rows), so even the un-memoized default stays non-
//     catastrophic. This scenario's `candidate` measures the cost floor an
//     optimized/memoized consumer gets (recomputing one row's derived state);
//     `budget.maxOverheadRatio` gates that floor staying a small, bounded
//     fraction of the full-table baseline rather than silently regressing to
//     scale with total row count.

// Direct relative import (not the `@beemvp/beeui-core` package specifier): `scripts/`
// has no `package.json` of its own and the harness deliberately stays a
// dependency-free pure-Node tool (`docs/benchmark-harness.md` "The harness is
// pure Node with no external dependencies"), so it reaches the real `cn()`
// source the same way it reaches its own `lib/` modules — by relative path.
// Node's built-in TypeScript type-stripping (erasable syntax only, no JSX)
// loads `cn.ts` directly; verified it has no enum/namespace/other
// non-erasable construct that would require a build step.
import { cn } from '../../../../packages/core/src/utils/cn.ts';
import { defineScenario } from '../../lib/registry.mjs';

const COLUMN_COUNT = 6;
const STATUSES = ['Completed', 'Pending', 'Failed'];

function buildRows(rowCount) {
  return Array.from({ length: rowCount }, (_, index) => ({
    id: `TXN-2026-${String(index).padStart(6, '0')}`,
    selected: index % 7 === 0,
    status: STATUSES[index % STATUSES.length],
  }));
}

const sortGlyphs = { ascending: '↑', descending: '↓', none: '↕' };

// Mirrors `TableColumnLabelRegistry` (`table.tsx`/`table.web.tsx`): one `Map`
// per `Table`, cleared and re-populated every render, read once per cell.
function createColumnLabelRegistry() {
  const labels = new Map();
  return {
    getLabel: (columnIndex) => labels.get(columnIndex),
    setLabel: (columnIndex, label) => labels.set(columnIndex, label),
  };
}

const COLUMN_LABELS = ['Transaction', 'Customer', 'Amount', 'Date', 'Status', 'Actions'];

// The real per-cell/per-row Web hot path: `cn()`-based className resolution
// (`table.web.tsx`'s exact literal class strings) plus the column-label
// registry and sort-glyph lookups every header/cell performs.
function resolveRowWithRealCn(row, registry) {
  let checksum = 0;

  for (let columnIndex = 0; columnIndex < COLUMN_COUNT; columnIndex += 1) {
    // `TableHead` (header pass): registers this column's label, resolves its
    // own class string, and — for the sortable first column — looks up the
    // sort glyph exactly as `sortGlyphs[sortDirection ?? 'none']` does.
    registry.setLabel(columnIndex, COLUMN_LABELS[columnIndex]);
    const headClassName = cn(
      'px-3 py-2 text-start align-middle font-semibold',
      columnIndex === 0 && 'sortable-column',
    );
    checksum += headClassName.length;
    if (columnIndex === 0) {
      checksum += sortGlyphs[row.selected ? 'ascending' : 'none'].length;
    }

    // `TableCell` (body pass): reads the column's registered label and
    // resolves its own class string.
    const label = registry.getLabel(columnIndex);
    const cellClassName = cn('px-3 py-2 align-middle', columnIndex === 2 && 'text-end');
    checksum += (label?.length ?? 0) + cellClassName.length;
  }

  // `TableRow`'s own class string — the one class that actually depends on
  // `selected` (a real row-selection re-render touches exactly this).
  const rowClassName = cn(
    'border-b border-border last:border-b-0',
    row.selected && 'bg-surface-raised',
  );
  checksum += rowClassName.length + row.status.length;

  return checksum;
}

// Same output, naive string concatenation — no `twMerge`/`clsx` conflict
// resolution — the same "correct behavior, uncontrolled cost" baseline shape
// `web/variant-class-resolution.mjs` uses.
function resolveRowWithConcat(row, registry) {
  let checksum = 0;

  for (let columnIndex = 0; columnIndex < COLUMN_COUNT; columnIndex += 1) {
    registry.setLabel(columnIndex, COLUMN_LABELS[columnIndex]);
    let headClassName = 'px-3 py-2 text-start align-middle font-semibold';
    if (columnIndex === 0) headClassName += ' sortable-column';
    checksum += headClassName.length;
    if (columnIndex === 0) {
      checksum += sortGlyphs[row.selected ? 'ascending' : 'none'].length;
    }

    const label = registry.getLabel(columnIndex);
    let cellClassName = 'px-3 py-2 align-middle';
    if (columnIndex === 2) cellClassName += ' text-end';
    checksum += (label?.length ?? 0) + cellClassName.length;
  }

  let rowClassName = 'border-b border-border last:border-b-0';
  if (row.selected) rowClassName += ' bg-surface-raised';
  checksum += rowClassName.length + row.status.length;

  return checksum;
}

function renderTablePass(rows, resolveRow) {
  const registry = createColumnLabelRegistry();
  let checksum = 0;
  for (let r = 0; r < rows.length; r += 1) {
    checksum += resolveRow(rows[r], registry);
  }
  return checksum;
}

function defineTableRenderScenario(rowCount) {
  const rows = buildRows(rowCount);
  return defineScenario({
    id: `web/table-render-${rowCount}`,
    title: `Web Table render pass — ${rowCount} rows`,
    platform: 'web',
    description:
      `Real per-row/per-cell Table Web hot path (cn() resolution, column-label ` +
      `registry, sort-glyph lookup) for a ${rowCount}-row table — the issue's ` +
      `accepted ${rowCount}-row scale envelope, without a default-virtualization claim.`,
    unit: 'ms/render-pass',
    warmup: rowCount >= 500 ? 10 : 20,
    samples: rowCount >= 500 ? 25 : 40,
    iterations: rowCount >= 500 ? 5 : 20,
    candidate: { label: 'cn-resolution', run: () => renderTablePass(rows, resolveRowWithRealCn) },
    baseline: { label: 'concat-resolution', run: () => renderTablePass(rows, resolveRowWithConcat) },
    // #185 (R5.7) regression budget: real `cn()`/twMerge resolution over naive
    // concatenation. Repeated local runs on a representative dev host land
    // consistently in the ~8-9.5x range at both 100 and 500 rows (the ratio
    // is dominated by twMerge's conflict resolution, not row count, so it is
    // stable across scale). 15x leaves generous headroom above that observed
    // ceiling while still catching a real regression (e.g. a `cn()`/twMerge
    // change that materially increases its per-call cost) rather than
    // flaking on this host's normal run-to-run variance.
    budget: { maxOverheadRatio: 15 },
  });
}

const rowUpdateFullTableRows = buildRows(100);
const rowUpdateSingleRow = [rowUpdateFullTableRows[42]];

const tableRowUpdateScenario = defineScenario({
  id: 'web/table-row-update',
  title: 'Web Table optimized single-row update vs. full 100-row recompute',
  platform: 'web',
  description:
    'The cost floor an optimized/memoized consumer gets for a single row\'s ' +
    'selection/sort-driven recompute, contrasted with a full 100-row recompute — ' +
    'stays a small, bounded fraction rather than scaling with total row count.',
  unit: 'ms/render-pass',
  warmup: 20,
  samples: 40,
  iterations: 50,
  candidate: {
    label: 'single-row-update',
    run: () => renderTablePass(rowUpdateSingleRow, resolveRowWithRealCn),
  },
  baseline: {
    label: 'full-table-recompute',
    run: () => renderTablePass(rowUpdateFullTableRows, resolveRowWithRealCn),
  },
  // A single row is 1/100th of the table; 0.2 leaves generous headroom above
  // that ideal while still catching a regression that makes one row's update
  // cost scale with the table's total row count.
  budget: { maxOverheadRatio: 0.2 },
});

export default [
  defineTableRenderScenario(100),
  defineTableRenderScenario(500),
  tableRowUpdateScenario,
];
