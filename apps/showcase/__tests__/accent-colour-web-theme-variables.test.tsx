import { Spinner, Switch } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Switch as RNSwitch } from 'react-native';

// On Web, Uniwind's `*ColorClassName` accent bridge reads stylesheet rules during the first
// render. When the stylesheet arrives after that render (a cold load from Metro) the colour
// is empty, Uniwind logs "className 'accent-primary' ... no color was found", and the
// control keeps react-native-web's default colour. Web therefore passes theme-variable
// colours and no accent class at all; native keeps the class bridge, which resolves from
// the compiled style store.

const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => setOS(originalOS));

describe('Spinner accent colour', () => {
  it('uses the theme variable and no accent class on Web', () => {
    setOS('web');
    const screen = render(<Spinner />);
    const indicator = screen.UNSAFE_getByType(ActivityIndicator);

    expect(indicator.props.color).toBe('var(--color-primary)');
    expect(indicator.props.colorClassName).toBeUndefined();
  });

  it('maps every tone to its own theme variable on Web', () => {
    setOS('web');
    const screen = render(<Spinner tone="destructive" />);

    expect(screen.UNSAFE_getByType(ActivityIndicator).props.color).toBe('var(--color-destructive)');
  });

  it('keeps the accent class bridge on native', () => {
    const screen = render(<Spinner />);
    const indicator = screen.UNSAFE_getByType(ActivityIndicator);

    expect(indicator.props.colorClassName).toBe('accent-primary');
    expect(indicator.props.color).toBeUndefined();
  });
});

describe('Switch accent colours', () => {
  it('uses theme variables and no accent classes on Web', () => {
    setOS('web');
    const screen = render(<Switch onValueChange={() => {}} value />);
    const control = screen.UNSAFE_getByType(RNSwitch);

    expect(control.props.trackColor).toEqual({ false: 'var(--color-muted)', true: 'var(--color-primary)' });
    expect(control.props.thumbColor).toBe('var(--color-surface)');
    for (const prop of [
      'trackColorOnClassName',
      'trackColorOffClassName',
      'thumbColorClassName',
      'ios_backgroundColorClassName',
    ]) {
      expect(control.props[prop]).toBeUndefined();
    }
  });

  it('keeps distinct on and off tracks when disabled on Web', () => {
    setOS('web');
    const screen = render(<Switch disabled onValueChange={() => {}} value />);
    const { trackColor, thumbColor } = screen.UNSAFE_getByType(RNSwitch).props;

    expect(trackColor.false).toBe('var(--color-disabled)');
    // react-native-web only passes colour strings that start with `var(` through, so the
    // dimmed primary rides as the fallback of an unset custom property.
    expect(trackColor.true).toMatch(/^var\(--[\w-]+, color-mix\(in oklab, var\(--color-primary\) 40%, transparent\)\)$/);
    expect(thumbColor).toBe('var(--color-disabled-foreground)');
  });
});
