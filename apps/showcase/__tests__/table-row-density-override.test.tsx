import { Table, TableBody, TableCell, TableRow } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Table as WebTable,
  TableBody as WebTableBody,
  TableCell as WebTableCell,
  TableRow as WebTableRow,
} from '../../../packages/ui/src/components/table.web';

// #603 item 1 — Table row density was global-only (44/56/64 via the application density
// axis). `Table`'s new `density` prop overrides the row height for one table only, reusing
// the exact `compact`/`comfortable`/`spacious` values plus a fourth `dense48` (48px) step —
// without mutating the global density axis or touching any other table.

describe('Table row density override (native)', () => {
  it('leaves rows unaffected when density is omitted (existing tables unchanged)', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow testID="row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const style = screen.getByTestId('row').props.style;
    // No `minHeight` override anywhere in the style array/object — the row still relies
    // solely on the `min-h-density-row-height` global-density class.
    expect(JSON.stringify(style)).not.toContain('minHeight');
  });

  it.each([
    ['compact', 44],
    ['comfortable', 56],
    ['spacious', 64],
    ['dense48', 48],
  ] as const)('applies a %s row-height override of %dpx', (density, expectedHeight) => {
    const screen = render(
      <Table density={density}>
        <TableBody>
          <TableRow testID="row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const style = screen.getByTestId('row').props.style as unknown[];
    expect(style).toContainEqual({ minHeight: expectedHeight });
  });

  it('lets a caller-supplied row style win over the density override on overlapping keys', () => {
    const screen = render(
      <Table density="dense48">
        <TableBody>
          <TableRow style={{ minHeight: 200 }} testID="row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const style = screen.getByTestId('row').props.style as Array<Record<string, unknown> | undefined>;
    // `[{ minHeight: 48 }, { minHeight: 200 }]` — RN merges a style array left-to-right, so
    // the caller's own explicit `minHeight: 200` (later in the array) wins.
    expect(style[style.length - 1]).toEqual({ minHeight: 200 });
  });

  it('ignores density in layout="stacked" (a card row, not a fixed-height row)', () => {
    const screen = render(
      <Table density="dense48" layout="stacked">
        <TableBody>
          <TableRow testID="row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(JSON.stringify(screen.getByTestId('row').props.style ?? null)).not.toContain('minHeight');
  });
});

describe('Table row density override (Web)', () => {
  it('leaves rows unaffected when density is omitted', () => {
    const screen = render(
      <WebTable>
        <WebTableBody>
          <WebTableRow>
            <WebTableCell>Ada</WebTableCell>
          </WebTableRow>
        </WebTableBody>
      </WebTable>,
    );

    expect(screen.UNSAFE_getByType('tr').props.style?.height).toBeUndefined();
  });

  it.each([
    ['compact', 44],
    ['comfortable', 56],
    ['spacious', 64],
    ['dense48', 48],
  ] as const)('sets an explicit %s row height of %dpx on the <tr>', (density, expectedHeight) => {
    const screen = render(
      <WebTable density={density}>
        <WebTableBody>
          <WebTableRow>
            <WebTableCell>Ada</WebTableCell>
          </WebTableRow>
        </WebTableBody>
      </WebTable>,
    );

    expect(screen.UNSAFE_getByType('tr').props.style?.height).toBe(expectedHeight);
  });

  it('lets a caller-supplied row style win over the density override on overlapping keys', () => {
    const screen = render(
      <WebTable density="dense48">
        <WebTableBody>
          <WebTableRow style={{ height: 200 }}>
            <WebTableCell>Ada</WebTableCell>
          </WebTableRow>
        </WebTableBody>
      </WebTable>,
    );

    expect(screen.UNSAFE_getByType('tr').props.style?.height).toBe(200);
  });
});
