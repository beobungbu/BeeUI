import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `TableCell`/`TableHead` had no `align` prop: the only way to right-align a
// numeric column was the undocumented `className="items-end text-end"`
// combination (`items-end` for native's flex cross-axis, `text-end`/`text-right`
// for Web — neither alone works on both platforms). A `Badge` placed directly
// inside a `TableCell` also stretched to the full column width, because the
// cell's own column-direction flex layout defaults `alignItems` to `stretch`.
// This file locks in the native (`table.tsx`) half of both fixes.

describe('TableCell/TableHead align prop (native)', () => {
  it('defaults to start alignment', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell testID="cell">Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('cell').props.className).toContain('justify-start');
  });

  it('right-aligns TableCell content with align="end"', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell align="end" testID="cell">
              $42.00
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('cell').props.className).toContain('justify-end');
  });

  it('centers TableHead content with align="center"', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead align="center" testID="head">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    expect(screen.getByTestId('head').props.className).toContain('items-center');
  });

  it('does not stretch a Badge placed directly inside a TableCell', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell testID="cell">
              <Badge testID="badge">Paid</Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    // The cell lays out as a row (not the previous column direction, whose
    // default `alignItems: 'stretch'` is what stretched the Badge), so the
    // Badge sizes to its own content instead of the column width.
    expect(screen.getByTestId('cell').props.className).toContain('flex-row');
    expect(screen.getByTestId('cell').props.className).toContain('items-center');
    expect(screen.getByTestId('badge')).toBeTruthy();
  });

  it('keeps the stacked layout value column end-aligned by default, overridable', () => {
    const defaultAlign = render(
      <Table layout="stacked">
        <TableBody>
          <TableRow>
            <TableCell label="Amount" testID="cell">
              $42.00
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    // Nested: label span, then the value wrapper carrying the alignment class.
    const valueWrapper = defaultAlign.getByTestId('cell').props.children[1];
    expect(valueWrapper.props.className).toContain('items-end');

    const overridden = render(
      <Table layout="stacked">
        <TableBody>
          <TableRow>
            <TableCell align="start" label="Amount" testID="cell">
              $42.00
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const overriddenWrapper = overridden.getByTestId('cell').props.children[1];
    expect(overriddenWrapper.props.className).toContain('items-start');
  });
});
