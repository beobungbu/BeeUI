import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
import { Text } from '@beemvp/beeui-ui';

// `Text`'s `numeric` type (`NumericVariant`) is not re-exported from the
// package's public surface — this reproduces the exact untyped-caller /
// `@ts-expect-error` escape hatch the issue reports via a component prop
// type assertion instead.
type TextNumericProp = React.ComponentProps<typeof Text>['numeric'];

// #590 item 5 — `Text.numeric` crashed on an invalid literal
// (`numericVariantFontVariants[numeric] is not iterable`) instead of falling
// back, for any untyped/JavaScript caller or an `as`-escaped value TypeScript
// itself would reject.
describe('Text.numeric falls back on an invalid literal instead of crashing (#590 item 5)', () => {
  const originalOS = Platform.OS;
  const originalWarn = console.warn;

  afterEach(() => {
    Platform.OS = originalOS;
    console.warn = originalWarn;
  });

  it('does not throw on native for an invalid numeric literal, and renders the given text', () => {
    Platform.OS = 'ios';
    console.warn = jest.fn();

    expect(() =>
      render(<Text numeric={'bogus' as unknown as TextNumericProp}>1,234.56</Text>),
    ).not.toThrow();

    const screen = render(<Text numeric={'bogus' as unknown as TextNumericProp}>1,234.56</Text>);
    expect(screen.getByText('1,234.56')).toBeTruthy();
  });

  it('warns in dev instead of silently swallowing the invalid value', () => {
    Platform.OS = 'ios';
    console.warn = jest.fn();

    render(<Text numeric={'bogus' as unknown as TextNumericProp}>1,234.56</Text>);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unknown numeric="bogus"'));
  });

  it('still applies the real "tabular" numeric variant unaffected', () => {
    Platform.OS = 'ios';
    const screen = render(
      <Text numeric="tabular" testID="tabular-text">
        1,234.56
      </Text>,
    );
    expect(screen.getByTestId('tabular-text').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontVariant: ['tabular-nums'] })]),
    );
  });

  it('does not throw on web either', () => {
    Platform.OS = 'web';
    expect(() =>
      render(<Text numeric={'bogus' as unknown as TextNumericProp}>1,234.56</Text>),
    ).not.toThrow();
  });
});
