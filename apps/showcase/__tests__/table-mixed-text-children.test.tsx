import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `<TableCell>Row {n}</TableCell>` passes `['Row ', n]`, not a string. Plain text cells
// must still render inside BeeUI's foreground `Text` on native (a bare string inside a
// `View` has no theme colour and is not a valid native text node) and keep the column
// context in their accessible name.

function MixedTable({ rowNumber }: { rowNumber: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference {'#'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow selected>
          <TableCell testID="mixed-cell">Row {rowNumber}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe('Table plain text made of several JSX text parts (native)', () => {
  it('renders the cell text through a foreground Text', () => {
    const screen = render(<MixedTable rowNumber={2} />);
    const text = screen.getByText('Row 2');

    expect(String(text.props.className).split(' ')).toContain('text-foreground');
  });

  it('keeps the inferred column label in the cell accessible name', () => {
    const screen = render(<MixedTable rowNumber={2} />);

    expect(screen.getByTestId('mixed-cell').props.accessibilityLabel).toBe('Reference #: Row 2');
  });
});
