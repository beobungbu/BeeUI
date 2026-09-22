import { Checkbox, Table, TableBody, TableCell, TableRow, Text } from '@beemvp/beeui-ui';
import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

// #618 (Astra review, item 2), native: `TableRow`'s `onPress` renders the row as a
// `Pressable` with `accessibilityRole="button"` wrapping arbitrary cell content. React
// Native's own gesture-responder negotiation gives an embedded `Pressable` (a row action, a
// selection `Checkbox`) the touch before the outer row ever claims it, so a press on that
// embedded control must not also fire the row's own `onPress` — this pins that contract at
// the unit level (real responder-capture evidence lives in the Maestro/device suite, not
// jest's react-test-renderer).
describe('TableRow onPress does not fire from an embedded control (native)', () => {
  it('does not call the row onPress when a nested Pressable is pressed', () => {
    const rowOnPress = jest.fn();
    const actionOnPress = jest.fn();
    const screen = render(
      <Table>
        <TableBody>
          <TableRow onPress={rowOnPress} testID="order-row">
            <TableCell>
              <Pressable
                accessibilityLabel="Delete row"
                accessibilityRole="button"
                onPress={actionOnPress}
                testID="delete-action"
              >
                <Text>Delete</Text>
              </Pressable>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    fireEvent.press(screen.getByTestId('delete-action'));

    expect(actionOnPress).toHaveBeenCalledTimes(1);
    expect(rowOnPress).not.toHaveBeenCalled();
  });

  it('does not call the row onPress when a nested Checkbox is toggled', () => {
    const rowOnPress = jest.fn();
    const onCheckedChange = jest.fn();
    const screen = render(
      <Table>
        <TableBody>
          <TableRow onPress={rowOnPress} testID="order-row">
            <TableCell>
              <Checkbox accessibilityLabel="Select Ada" checked={false} onCheckedChange={onCheckedChange} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    fireEvent.press(screen.getByRole('checkbox', { name: 'Select Ada' }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(rowOnPress).not.toHaveBeenCalled();
  });

  it('still calls the row onPress when the row itself is pressed', () => {
    const rowOnPress = jest.fn();
    const screen = render(
      <Table>
        <TableBody>
          <TableRow onPress={rowOnPress} testID="order-row">
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    fireEvent.press(screen.getByTestId('order-row'));

    expect(rowOnPress).toHaveBeenCalledTimes(1);
  });
});
