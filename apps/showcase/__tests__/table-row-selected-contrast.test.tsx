import { Table, TableBody, TableCell, TableRow } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import {
  TableRow as WebTableRow,
  Table as WebTable,
  TableBody as WebTableBody,
  TableCell as WebTableCell,
} from '../../../packages/ui/src/components/table.web';

// `TableRow selected` already set `aria-selected`/`accessibilityState.selected`
// plus a `bg-surface-raised` class, but every light theme in this repo's token
// set defines `--color-surface-raised` equal to `--color-surface` — so the
// "selected" row computed to the exact same background as an unselected row
// (a real bug, not just a missing class). `bg-primary/10` is guaranteed
// distinct from the surface in every theme because it derives from
// `--color-primary`.

describe('TableRow selected background (native)', () => {
  it('paints a primary-derived background, not the surface-raised token', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow selected testID="row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const className = screen.getByTestId('row').props.className as string;
    expect(className).toContain('bg-primary/10');
    expect(className).not.toContain('bg-surface-raised');
  });

  it('paints the same token in layout="stacked"', () => {
    const screen = render(
      <Table layout="stacked">
        <TableBody>
          <TableRow selected testID="row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('row').props.className).toContain('bg-primary/10');
  });
});

describe('TableRow selected background (Web)', () => {
  it('paints a primary-derived background on the real <tr>, not surface-raised', () => {
    const screen = render(
      <WebTable>
        <WebTableBody>
          <WebTableRow selected>
            <WebTableCell>Ada</WebTableCell>
          </WebTableRow>
        </WebTableBody>
      </WebTable>,
    );

    // `data-testid` (not RN's `testID`) is this file's own Web attribute
    // convention (see `table.web.tsx`'s file header) — `UNSAFE_getByType`
    // targets the real host tag instead.
    const className = screen.UNSAFE_getByType('tr').props.className as string;
    expect(className).toContain('bg-primary/10');
    expect(className).not.toContain('bg-surface-raised');
  });

  it('paints the same token in layout="stacked", where the row also carries role="row"', () => {
    const screen = render(
      <WebTable layout="stacked">
        <WebTableBody>
          <WebTableRow selected>
            <WebTableCell>Ada</WebTableCell>
          </WebTableRow>
        </WebTableBody>
      </WebTable>,
    );

    const row = screen.UNSAFE_getByProps({ role: 'row' });
    expect(row.props.className).toContain('bg-primary/10');
  });
});
