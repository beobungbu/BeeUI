import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Field, SegmentedControl, SegmentedControlItem } from '@beemvp/beeui-ui';

// The `radiogroup` had no accessible name at all, so a screen reader
// announced bare "radio group" with no context.
describe('BeeUI SegmentedControl radiogroup accessible name', () => {
  it('exposes an explicit accessibilityLabel on the radiogroup', () => {
    const screen = render(
      <SegmentedControl accessibilityLabel="Theme" onValueChange={() => {}} testID="theme-control" value="system">
        <SegmentedControlItem value="light">Light</SegmentedControlItem>
        <SegmentedControlItem value="system">System</SegmentedControlItem>
      </SegmentedControl>,
    );

    const control = screen.getByTestId('theme-control');
    expect(control.props.accessibilityRole).toBe('radiogroup');
    expect(control.props.accessibilityLabel).toBe('Theme');
  });

  it('falls back to the enclosing Field label when no own accessibilityLabel is given', () => {
    const screen = render(
      <Field label="Theme">
        <SegmentedControl onValueChange={() => {}} testID="theme-control" value="system">
          <SegmentedControlItem value="light">Light</SegmentedControlItem>
          <SegmentedControlItem value="system">System</SegmentedControlItem>
        </SegmentedControl>
      </Field>,
    );

    const control = screen.getByTestId('theme-control');
    expect(control.props.accessibilityLabel).toBe('Theme');
  });
});

// A segment label truncated mid-glyph at large accessibility text sizes
// instead of wrapping, because a React Native flex item's default flexShrink is 0.
describe('BeeUI SegmentedControlItem label wraps instead of clipping', () => {
  it('gives the label the full item width so it can wrap instead of clip', () => {
    const screen = render(
      <SegmentedControl onValueChange={() => {}} value="system">
        <SegmentedControlItem testID="system-item" value="system">
          Theo hệ thống
        </SegmentedControlItem>
      </SegmentedControl>,
    );

    const label = screen.getByText('Theo hệ thống');
    expect(label.props.className).toContain('w-full');
  });
});
