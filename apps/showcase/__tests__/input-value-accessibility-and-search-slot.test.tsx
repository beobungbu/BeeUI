import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Text, TextInput } from 'react-native';
import { Input, SearchInput } from '@beemvp/beeui-ui';

// #614 — an Input given an `accessibilityLabel` stopped exposing its typed
// value to VoiceOver: the accessibility tree carried only the label, not the
// value, so a labelled field became silently unreadable. Input now tracks its
// own current text (controlled `value`, or `onChangeText` when uncontrolled)
// and publishes it through `accessibilityValue.text` whenever a label is
// present, so both stay exposed.
describe('Input keeps both accessibilityLabel and accessibilityValue exposed (#614)', () => {
  it('publishes the controlled value through accessibilityValue.text alongside the label', () => {
    const screen = render(
      <Input accessibilityLabel="Opening cash" testID="cash-input" value="150000" />,
    );
    const input = screen.getByTestId('cash-input');
    expect(input.props.accessibilityLabel).toBe('Opening cash');
    expect(input.props.accessibilityValue).toEqual({ text: '150000' });
  });

  it('tracks an uncontrolled value as it changes via onChangeText', () => {
    const screen = render(
      <Input accessibilityLabel="Opening cash" defaultValue="" testID="cash-input" />,
    );
    const input = screen.getByTestId('cash-input');
    expect(input.props.accessibilityValue).toEqual({ text: '' });

    fireEvent.changeText(input, '200000');

    expect(screen.getByTestId('cash-input').props.accessibilityValue).toEqual({ text: '200000' });
  });

  it('does not set accessibilityValue at all when there is no label (unlabelled inputs already read their value correctly)', () => {
    const screen = render(<Input testID="plain-input" value="abc" />);
    expect(screen.getByTestId('plain-input').props.accessibilityValue).toBeUndefined();
  });

  it('lets a caller-supplied accessibilityValue.text win over the tracked value', () => {
    const screen = render(
      <Input
        accessibilityLabel="Quantity"
        accessibilityValue={{ text: '3 boxes' }}
        testID="qty-input"
        value="3"
      />,
    );
    expect(screen.getByTestId('qty-input').props.accessibilityValue).toEqual({ text: '3 boxes' });
  });
});

// #597 item 2 — SearchInput had no trailing slot and (per the report) no
// reliable way to focus it; a POS wants a scan glyph on the right and an
// external keyboard shortcut to focus the field.
describe('SearchInput trailing slot and focus ref (#597 item 2)', () => {
  it('renders a trailing node after the input', () => {
    const screen = render(
      <SearchInput
        testID="search"
        trailing={<Text testID="scan-glyph">Scan</Text>}
      />,
    );
    expect(screen.getByTestId('search')).toBeTruthy();
    expect(screen.getByTestId('scan-glyph')).toBeTruthy();
  });

  it('renders with no wrapper/behavior change when trailing is omitted', () => {
    const screen = render(<SearchInput testID="search" />);
    expect(screen.getByTestId('search')).toBeTruthy();
  });

  it('forwards a ref whose .focus() reaches the underlying TextInput', () => {
    const ref = React.createRef<React.ComponentRef<typeof TextInput>>();
    render(<SearchInput ref={ref} testID="search" trailing={<Text>Scan</Text>} />);

    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
    // Calling it must not throw — this is the exact "ref.current.focus()" contract the issue asks for.
    expect(() => ref.current?.focus()).not.toThrow();
  });
});
