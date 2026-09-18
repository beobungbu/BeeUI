import { cn } from '@beemvp/beeui-core';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { AppHeader, Box, SafeArea } from '@beemvp/beeui-ui';

// #563/#564 — `className={cond ? 'x' : undefined}` (the idiomatic conditional
// className) reached a real Uniwind-wrapped host as a raw `undefined` and
// crashed real styleq with `typeof undefined is not "string" or "null"`.
// styleq only tolerates `string | null`, never `undefined`. The shared merge
// point every BeeUI component is meant to route through is `cn()` in
// `@beemvp/beeui-core` (`twMerge(clsx(inputs))`), which already normalizes any
// mix of `undefined`/`null`/`false` inputs down to a plain string — these
// tests lock that invariant in, and then prove the two reported composition
// shapes (a bare conditional className, and AppHeader inside a partial-edge
// SafeArea) never hand a raw `undefined` to a host component.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

describe('cn() — the shared className merge point (#563)', () => {
  it('normalizes undefined/null/false to a plain string, never undefined', () => {
    expect(cn(undefined)).toBe('');
    expect(cn(null)).toBe('');
    expect(cn(false)).toBe('');
    expect(typeof cn(undefined)).toBe('string');
  });

  it('drops undefined/null/false entries out of a mixed class list', () => {
    expect(cn('bg-accent', undefined)).toBe('bg-accent');
    expect(cn(undefined, 'bg-accent')).toBe('bg-accent');
    expect(cn('bg-accent', false, null, undefined)).toBe('bg-accent');
  });

  it('reproduces the exact reported idiom without ever returning undefined', () => {
    const active = false;
    const result = cn(active ? 'bg-accent' : undefined);
    expect(typeof result).toBe('string');
    expect(result).toBe('');
  });
});

describe('AppHeader inside a partial-edge SafeArea never forwards undefined className (#564)', () => {
  it('mounts the documented provider-safe-area shell (edges omitting "bottom") without a raw undefined className anywhere', () => {
    const screen = render(
      <SafeArea edges={['top', 'left', 'right']} testID="top-safe-area">
        <AppHeader testID="app-header" title="BeeUI" />
      </SafeArea>,
    );

    expect(typeof screen.getByTestId('top-safe-area').props.className).toBe('string');
    expect(typeof screen.getByTestId('app-header').props.className).toBe('string');
  });

  it('mounts a bare AppHeader without SafeArea the same way (control case)', () => {
    const screen = render(<AppHeader testID="app-header" title="BeeUI" />);
    expect(typeof screen.getByTestId('app-header').props.className).toBe('string');
  });
});

describe('Box routes className through cn() instead of forwarding it raw', () => {
  it('normalizes an explicit undefined className to a plain string, not undefined', () => {
    const active = false;
    const screen = render(<Box className={active ? 'bg-accent' : undefined} testID="box" />);
    expect(typeof screen.getByTestId('box').props.className).toBe('string');
    expect(screen.getByTestId('box').props.className).toBe('');
  });

  it('mounts without any className at all without forwarding undefined', () => {
    const screen = render(<Box testID="box" />);
    expect(typeof screen.getByTestId('box').props.className).toBe('string');
  });

  it('still merges conflicting classes last-wins, same as every other cn()-routed component', () => {
    const screen = render(<Box className="bg-accent" testID="box" />);
    expect(screen.getByTestId('box').props.className).toBe('bg-accent');
  });
});
