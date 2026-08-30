import {
  Checkbox,
  EmptyState,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@beeui/ui';
import { fireEvent, render, within } from '@testing-library/react-native';
import * as React from 'react';
import { I18nManager, Pressable } from 'react-native';

// ---------------------------------------------------------------------------
// RTL toggle — mirrors `logical-direction.test.tsx`'s native-ambient pattern:
// `useDirection()` reads `I18nManager.isRTL` on native, so flipping this
// property deterministically exercises the RTL branch without mocking the
// resolver module itself.
// ---------------------------------------------------------------------------
const originalIsRTL = I18nManager.isRTL;

function setNativeRTL(isRTL: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: isRTL });
}

afterEach(() => {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: originalIsRTL });
});

describe('BeeUI Table core anatomy (native)', () => {
  it('composes header/body/footer/caption from plain JSX without owning row data', () => {
    const screen = render(
      <Table testID="orders-table">
        <TableCaption>All orders placed this month.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>#1001</TableCell>
            <TableCell>$42.00</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>1 order</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    expect(screen.getByTestId('orders-table')).toBeTruthy();
    expect(screen.getByText('All orders placed this month.')).toBeTruthy();
    expect(screen.getByText('Order')).toBeTruthy();
    expect(screen.getByText('#1001')).toBeTruthy();
    expect(screen.getByText('$42.00')).toBeTruthy();
    expect(screen.getByText('1 order')).toBeTruthy();
  });

  it('folds column context into a plain-text cell native accessible name', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
            <TableCell>36</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByLabelText('Name: Ada')).toBeTruthy();
    expect(screen.getByLabelText('Age: 36')).toBeTruthy();
  });

  it('does not override an explicit accessibilityLabel on TableCell', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell accessibilityLabel="Order is shipped">Shipped</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByLabelText('Order is shipped')).toBeTruthy();
  });

  it('renders a controlled sort trigger and calls back without owning sort state', () => {
    const onSortChange = jest.fn();
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead onSortChange={onSortChange} sortDirection="ascending">
              Name
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const trigger = screen.getByRole('button', { name: 'Name, sorted ascending' });
    fireEvent.press(trigger);
    expect(onSortChange).toHaveBeenCalledTimes(1);

    // Table itself never flips the indicator — it stays whatever the caller
    // passed, proving there is no internal sort store.
    expect(screen.getByRole('button', { name: 'Name, sorted ascending' })).toBeTruthy();
  });

  it('keeps the native touch-target floor guard on the sort trigger and on every row (#167)', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow testID="header-row">
            <TableHead onSortChange={() => {}} sortDirection="none">
              Name
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow testID="body-row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const trigger = screen.getByRole('button', { name: 'Name, not sorted' });
    expect(trigger.props.className).toContain('ios:min-h-touch-target');
    expect(trigger.props.className).toContain('android:min-h-touch-target');

    for (const testId of ['header-row', 'body-row']) {
      const row = screen.getByTestId(testId);
      expect(row.props.className).toContain('min-h-density-row-height');
      expect(row.props.className).toContain('ios:min-h-touch-target');
      expect(row.props.className).toContain('android:min-h-touch-target');
    }
  });

  it('keeps an embedded row action reachable next to a long-value cell (#167)', () => {
    const longValue =
      'A very long representative cell value that should wrap onto multiple lines rather than shrink or push a neighboring action off-screen';
    const onPress = jest.fn();
    const screen = render(
      <Table>
        <TableBody>
          <TableRow testID="long-value-row">
            <TableCell>{longValue}</TableCell>
            <TableCell>
              <Pressable accessibilityLabel="Delete row" accessibilityRole="button" onPress={onPress}>
                <Text>Delete</Text>
              </Pressable>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    // The full value renders (wraps), it is never truncated with
    // `numberOfLines`, and the sibling action stays a reachable, pressable
    // control — a long value never swallows or hides a neighboring action.
    expect(screen.getByText(longValue).props.numberOfLines).toBeUndefined();
    const action = screen.getByRole('button', { name: 'Delete row' });
    fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a plain header cell when no sort props are provided', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.queryByRole('button', { name: /Name/ })).toBeNull();
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('composes row selection from the caller-owned Checkbox and a visual `selected` flag', () => {
    const onCheckedChange = jest.fn();
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pick</TableHead>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow selected testID="row-1">
            <TableCell>
              <Checkbox
                accessibilityLabel="Select Ada"
                checked
                onCheckedChange={onCheckedChange}
              />
            </TableCell>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('row-1').props.accessibilityState.selected).toBe(true);
    const checkbox = screen.getByRole('checkbox', { name: 'Select Ada' });
    fireEvent.press(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('composes an empty state as a single full-width spanning cell', () => {
    const screen = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={2}>
              <EmptyState title="No results" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText('No results')).toBeTruthy();
  });

  it('reverses row content order under RTL', () => {
    setNativeRTL(true);
    const screen = render(
      <Table>
        <TableBody>
          <TableRow testID="rtl-row">
            <TableCell>First</TableCell>
            <TableCell>Second</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('rtl-row').props.className).toContain('flex-row-reverse');
  });

  it('does not reverse row content order under LTR', () => {
    setNativeRTL(false);
    const screen = render(
      <Table>
        <TableBody>
          <TableRow testID="ltr-row">
            <TableCell>First</TableCell>
            <TableCell>Second</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('ltr-row').props.className).not.toContain('flex-row-reverse');
  });

  describe('layout="stacked"', () => {
    it('infers each cell label from the corresponding TableHead text', () => {
      const screen = render(
        <Table layout="stacked">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell testID="name-cell">Ada</TableCell>
              <TableCell testID="amount-cell">$42.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      // Scoped to each cell: `TableHeader` still mounts (hidden) in stacked
      // layout so registration keeps running, so an unscoped `getByText`
      // would ambiguously match its (hidden) header text too.
      const nameCell = within(screen.getByTestId('name-cell'));
      const amountCell = within(screen.getByTestId('amount-cell'));
      expect(nameCell.getByText('Name')).toBeTruthy();
      expect(nameCell.getByText('Ada')).toBeTruthy();
      expect(amountCell.getByText('Amount')).toBeTruthy();
      expect(amountCell.getByText('$42.00')).toBeTruthy();
    });

    it('lets an explicit TableCell `label` override the inferred header label', () => {
      const screen = render(
        <Table layout="stacked">
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell label="Total due" testID="amount-cell">
                $42.00
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const amountCell = within(screen.getByTestId('amount-cell'));
      expect(amountCell.getByText('Total due')).toBeTruthy();
      expect(amountCell.queryByText('Amount')).toBeNull();
      expect(amountCell.getByText('$42.00')).toBeTruthy();
    });
  });
});
