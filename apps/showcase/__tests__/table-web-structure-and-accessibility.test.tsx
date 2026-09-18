import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../packages/ui/src/components/table.web';

// `table.web.tsx`-specific fixes: this file imports the concrete `.web`
// module directly (mirrors `tooltip.web` tests elsewhere in this suite),
// because Jest's default platform resolution here is native, not web.

describe('TableHead dark-theme text color (Web)', () => {
  it('gives a plain <th> a real foreground color token instead of the inherited document color', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    expect(screen.UNSAFE_getByType('th').props.className).toContain('text-foreground');
  });
});

describe('Table/TableRow/TableCell accessibilityLabel bridge (Web)', () => {
  it('maps Table accessibilityLabel to aria-label, not a lowercased unknown attribute', () => {
    const screen = render(<Table accessibilityLabel="Product catalog inventory table" />);

    const root = screen.UNSAFE_getByProps({ 'aria-label': 'Product catalog inventory table' });
    expect(root.props.accessibilitylabel).toBeUndefined();
  });

  it('maps TableRow accessibilityLabel to aria-label on the real <tr>', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow accessibilityLabel="Order #1001">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const row = screen.UNSAFE_getByType('tr');
    expect(row.props['aria-label']).toBe('Order #1001');
    expect(row.props.accessibilitylabel).toBeUndefined();
  });

  it('maps TableCell accessibilityLabel to aria-label on the real <td>', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell accessibilityLabel="Order is shipped">Shipped</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const cell = screen.UNSAFE_getByType('td');
    expect(cell.props['aria-label']).toBe('Order is shipped');
  });

  it('lets an explicit aria-label win over accessibilityLabel when both are supplied', () => {
    const screen = render(<Table accessibilityLabel="RN label" aria-label="DOM label" />);

    expect(screen.UNSAFE_getByType('div').props['aria-label']).toBe('DOM label');
  });
});

describe('Table layout="stacked" row grouping (Web)', () => {
  it('keeps each record inside a role="row" element with a role="table" ancestor', () => {
    const screen = render(
      <Table layout="stacked">
        <TableBody>
          <TableRow>
            <TableCell label="Name">Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.UNSAFE_getByProps({ role: 'table' })).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ role: 'row' })).toBeTruthy();
  });

  it('does not add role="table" for the default scroll layout (a real <table> already has it implicitly)', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.UNSAFE_queryAllByProps({ role: 'table' })).toHaveLength(0);
  });
});

describe('TableRow onPress (Web)', () => {
  it('activates on click and stays a real <tr> (row semantics preserved)', () => {
    const onPress = jest.fn();
    const screen = render(
      <Table>
        <TableBody>
          <TableRow onPress={onPress}>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const row = screen.UNSAFE_getByType('tr');
    expect(row.props.tabIndex).toBe(0);
    fireEvent(row, 'click');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('activates on Enter and Space keydown for keyboard-only users', () => {
    const onPress = jest.fn();
    const screen = render(
      <Table>
        <TableBody>
          <TableRow onPress={onPress}>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const row = screen.UNSAFE_getByType('tr');
    fireEvent(row, 'keyDown', { key: 'Enter', preventDefault: jest.fn() });
    fireEvent(row, 'keyDown', { key: ' ', preventDefault: jest.fn() });
    fireEvent(row, 'keyDown', { key: 'Tab', preventDefault: jest.fn() });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('does not add tabIndex/keyboard handling when onPress is omitted', () => {
    const screen = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.UNSAFE_getByType('tr').props.tabIndex).toBeUndefined();
  });
});
