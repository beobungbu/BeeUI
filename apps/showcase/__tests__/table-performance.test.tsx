import { Table, TableBody, TableCell, TableRow } from '@beeui/ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// BeeUI issue #168 (R4E.5) — Table performance and scale acceptance:
// "row selection/sort update should not catastrophically rerender unrelated
// content". This is real, deterministic-contract evidence against the
// actual shipped `Table`/`TableRow`/`TableCell` (native file) — not a
// simulated workload (that lives in `scripts/benchmark/scenarios/web/
// table-render.mjs`, which measures the real per-row `cn()`/registry cost at
// the 100/500-row scale envelope and shows a full-table recompute pass stays
// well under a 16ms frame budget at both scales).
//
// This test measures the OTHER half of "not catastrophic": whether toggling
// one row's `selected` state forces every row's render function to re-run.
// `Table` is a thin compositional layer (ADR-007 — it owns no row data or
// selection state), so it does not itself memoize rows; a plain
// `rows.map(...)` naturally produces new row elements every render, and by
// default React re-invokes every child's render function whose element
// identity changed, even when the row's own prop values did not. This test
// documents that reality precisely rather than assuming an unverified
// memoization guarantee, and separately proves the recommended mitigation
// (wrapping row content in `React.memo`) genuinely isolates the update, so
// consumers with very large lists have a documented, verified escape hatch.

function makeTrackedCell(renderCounts: Map<string, number>, rowId: string) {
  function TrackedCell({ children }: { children: React.ReactNode }) {
    renderCounts.set(rowId, (renderCounts.get(rowId) ?? 0) + 1);
    return <TableCell>{children}</TableCell>;
  }
  return TrackedCell;
}

// `selected` is deliberately part of THIS component's own props (not just
// `TableRow`'s) — this is the realistic shape for a row whose cell content
// needs to reflect selection (e.g. a checkmark icon), so `React.memo`'s
// shallow prop comparison genuinely differs for the toggled row and genuinely
// matches for every other row.
const MemoTrackedCell = React.memo(function MemoTrackedCellImpl({
  onRender,
  rowId,
  selected,
  text,
}: {
  onRender: (rowId: string) => void;
  rowId: string;
  selected: boolean;
  text: string;
}) {
  onRender(rowId);
  return <TableCell>{selected ? `${text} (selected)` : text}</TableCell>;
});

const ROW_IDS = Array.from({ length: 20 }, (_, index) => `row-${index}`);

describe('Table row-update rerender scope (#168)', () => {
  it('documents that an unmemoized row list re-runs every row render function on a sibling selection change', () => {
    const renderCounts = new Map<string, number>();
    const cellsById = new Map(ROW_IDS.map((id) => [id, makeTrackedCell(renderCounts, id)]));

    function UnmemoizedTable({ selectedId }: { selectedId: string | null }) {
      return (
        <Table>
          <TableBody>
            {ROW_IDS.map((id) => {
              const Cell = cellsById.get(id)!;
              return (
                <TableRow key={id} selected={id === selectedId}>
                  <Cell>{id}</Cell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      );
    }

    const screen = render(<UnmemoizedTable selectedId={null} />);
    renderCounts.clear();

    screen.rerender(<UnmemoizedTable selectedId={ROW_IDS[5]} />);

    // Every row's render function ran again — expected, undocumented-as-free
    // behavior for a plain `.map()` over compositional `TableRow`/`TableCell`
    // (no memoization is Table's own responsibility per ADR-007). This is the
    // baseline the memoized test below is contrasted against.
    for (const id of ROW_IDS) {
      expect(renderCounts.get(id)).toBe(1);
    }
  });

  it('React.memo on row content isolates a selection update to only the changed row', () => {
    const renderCounts = new Map<string, number>();
    const onRender = (rowId: string) => renderCounts.set(rowId, (renderCounts.get(rowId) ?? 0) + 1);

    function MemoizedTable({ selectedId }: { selectedId: string | null }) {
      return (
        <Table>
          <TableBody>
            {ROW_IDS.map((id) => (
              <TableRow key={id} selected={id === selectedId}>
                <MemoTrackedCell
                  onRender={onRender}
                  rowId={id}
                  selected={id === selectedId}
                  text={id}
                />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    const screen = render(<MemoizedTable selectedId={null} />);
    renderCounts.clear();

    screen.rerender(<MemoizedTable selectedId={ROW_IDS[5]} />);

    // Every unrelated row's `MemoTrackedCell` props (`onRender`/`rowId`/
    // `selected`/`text`) are referentially/value-unchanged across this
    // rerender, so `React.memo` bails out before calling it again — it does
    // not re-run at all. The toggled row's `selected` prop DID change, so its
    // cell legitimately re-renders once. This proves a real, verified
    // mitigation exists for consumers with very large lists: memoizing row
    // content isolates a selection update to only the changed row. (`TableRow`
    // itself is not memoized here — the point under test is *unrelated
    // content*, i.e. the cell a caller controls, staying untouched.)
    for (const id of ROW_IDS) {
      if (id === ROW_IDS[5]) {
        expect(renderCounts.get(id)).toBe(1);
      } else {
        expect(renderCounts.get(id)).toBeUndefined();
      }
    }
  });
});
