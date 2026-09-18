import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, Switch as RNSwitch } from 'react-native';
import { Field, Label, Switch } from '@beemvp/beeui-ui';

describe('BeeUI Switch accessibilityLabelledBy reaches the interactive input', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('forwards a literal aria-labelledby on Web alongside accessibilityLabelledBy', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = render(
      <>
        <Label nativeID="delivery-default-address-label">Default delivery address</Label>
        <Switch
          accessibilityLabelledBy="delivery-default-address-label"
          disabled
          onValueChange={() => {}}
          testID="delivery-switch"
          value
        />
      </>,
    );

    const control = screen.UNSAFE_getByType(RNSwitch);
    expect(control.props.accessibilityLabelledBy).toBe('delivery-default-address-label');
    expect(control.props['aria-labelledby']).toBe('delivery-default-address-label');
  });

  it('falls back to the enclosing Field label when the Switch has no own accessible name', () => {
    const screen = render(
      <Field label="Notifications">
        <Switch onValueChange={() => {}} value={false} />
      </Field>,
    );

    const control = screen.UNSAFE_getByType(RNSwitch);
    expect(control.props.accessibilityLabel).toBe('Notifications');
  });

  it('lets an explicit accessibilityLabel win over the Field fallback', () => {
    const screen = render(
      <Field label="Notifications">
        <Switch accessibilityLabel="Push notifications" onValueChange={() => {}} value={false} />
      </Field>,
    );

    const control = screen.UNSAFE_getByType(RNSwitch);
    expect(control.props.accessibilityLabel).toBe('Push notifications');
  });
});

// A disabled Switch previously collapsed the on/off track colors to
// the same flat gray, making the current state unreadable.
describe('BeeUI disabled Switch keeps on/off contrast', () => {
  it('gives a disabled Switch distinct on vs. off track colors instead of one flat swatch', () => {
    const screen = render(<Switch disabled onValueChange={() => {}} value />);
    const control = screen.UNSAFE_getByType(RNSwitch);

    expect(control.props.trackColorOnClassName).not.toBe(control.props.trackColorOffClassName);
  });

  it('keeps a single flat disabled swatch behavior only for the off track color', () => {
    const screen = render(<Switch disabled onValueChange={() => {}} value={false} />);
    const control = screen.UNSAFE_getByType(RNSwitch);

    expect(control.props.trackColorOffClassName).toBe('accent-disabled');
  });
});
