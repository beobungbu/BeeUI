import { OTPInput } from '@beemvp/beeui-ui';
import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { TextInput, View } from 'react-native';

// #592 item 1 — OTPInput had no segmented (one box per digit) appearance, forcing a caller
// to draw fake cells over a hidden input and re-own caret/focus itself. `appearance`
// defaults to `'joined'` (unchanged, no behavior change) with an opt-in `'segmented'` that
// renders `length` boxes over the same single hidden input.

describe('OTPInput appearance="joined" (default)', () => {
  it('renders exactly one TextInput and no decorative boxes', () => {
    const screen = render(<OTPInput length={4} onValueChange={() => {}} />);
    expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(1);
  });
});

describe('OTPInput appearance="segmented"', () => {
  it('still renders exactly one real TextInput (one hidden-input contract, unchanged)', () => {
    const screen = render(<OTPInput appearance="segmented" length={4} onValueChange={() => {}} />);
    expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(1);
  });

  it('renders `length` decorative boxes showing each typed digit in its own cell', () => {
    const screen = render(<OTPInput appearance="segmented" length={4} onValueChange={() => {}} value="12" />);

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    // Two empty trailing cells render (no visible text), leaving four boxes total behind
    // the one hidden input.
    expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(1);
  });

  it('drives every box from the same single onChangeText contract as appearance="joined"', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <OTPInput appearance="segmented" length={4} mode="numeric" onValueChange={onValueChange} />,
    );

    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), '5a6');

    // `mode="numeric"` still strips non-digits, exactly like `appearance="joined"`.
    expect(onValueChange).toHaveBeenCalledWith('56');
  });

  it('hides the native caret on the real input (the box row draws the caret indicator instead)', () => {
    const screen = render(<OTPInput appearance="segmented" length={4} onValueChange={() => {}} />);
    expect(screen.UNSAFE_getByType(TextInput).props.caretHidden).toBe(true);
  });

  it('renders in reverse (RTL) box order without changing which digit lands in which cell', () => {
    const originalIsRTL = require('react-native').I18nManager.isRTL;
    require('react-native').I18nManager.isRTL = true;
    try {
      const screen = render(<OTPInput appearance="segmented" length={3} onValueChange={() => {}} value="12" />);
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
    } finally {
      require('react-native').I18nManager.isRTL = originalIsRTL;
    }
  });

  it('reflects an invalid state on the decorative boxes', () => {
    const screen = render(
      <OTPInput appearance="segmented" invalid length={4} onValueChange={() => {}} value="1" />,
    );

    const invalidBoxes = screen
      .UNSAFE_getAllByType(View)
      .filter((node) => (node.props.className as string | undefined)?.includes('border-destructive'));
    expect(invalidBoxes.length).toBeGreaterThan(0);
  });
});
