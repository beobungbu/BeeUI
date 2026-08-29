import { fireEvent, render } from '@testing-library/react-native';
import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import type * as ReactTypes from 'react';
import { ShowcaseRoot } from '../showcase-root';
import { DynamicTypeAcceptance } from '../runtime-smoke';
import { withFontScale } from './helpers/dynamic-type';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: ReactTypes.ReactNode }) => children,
    SafeAreaListener: ({
      children,
      onChange,
    }: {
      children?: ReactTypes.ReactNode;
      onChange: (metrics: { frame: typeof frame; insets: typeof insets }) => void;
    }) => {
      React.useEffect(() => onChange({ frame, insets }), [onChange]);
      return children;
    },
    SafeAreaView: React.forwardRef(
      (
        { children, ...props }: { children?: ReactTypes.ReactNode },
        ref: ReactTypes.ForwardedRef<ReactTypes.ComponentRef<typeof View>>,
      ) => <View ref={ref} {...props}>{children}</View>,
    ),
    useSafeAreaInsets: () => insets,
  };
});

// BeeUI 1.0 #143 — guards the Dynamic Type evidence surface itself. The
// native (scripts/runtime-smoke/android-dynamic-type.sh) and Web
// (apps/visual-regression/tests/dynamic-type-showcase.spec.ts) evidence paths
// both address this screen by these exact testIDs; silently renaming or
// removing any of them would turn those harnesses red (or worse, vacuous)
// without a deterministic signal. This suite is that signal.

const EVIDENCE_TEST_IDS = [
  'dynamic-type-ready',
  'dynamic-type-font-scale',
  'dynamic-type-select-trigger',
  'dynamic-type-pagination-item-1',
  'dynamic-type-save-button',
  'dynamic-type-email-input',
] as const;

describe('Dynamic Type runtime fixture (#143)', () => {
  it('is reachable one tap from Showcase home and returns home', () => {
    const view = render(
      <BeeUIProvider>
        <ShowcaseRoot />
      </BeeUIProvider>,
    );

    fireEvent.press(view.getByTestId('showcase-open-dynamic-type'));
    expect(view.getByTestId('dynamic-type-screen')).toBeTruthy();
    expect(view.getByTestId('dynamic-type-ready')).toBeTruthy();
    expect(view.queryByTestId('showcase-home')).toBeNull();

    fireEvent.press(view.getByTestId('dynamic-type-back'));
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.queryByTestId('dynamic-type-screen')).toBeNull();
  });

  it('renders every evidence testID the native and Web harnesses assert against', () => {
    const view = render(
      <BeeUIProvider>
        <DynamicTypeAcceptance onBack={() => undefined} />
      </BeeUIProvider>,
    );

    for (const testID of EVIDENCE_TEST_IDS) {
      expect(view.getByTestId(testID)).toBeTruthy();
    }
  });

  it('renders the observed OS font scale in the exact format the native harness asserts', () => {
    // scripts/runtime-smoke/android-dynamic-type.sh asserts the literal text
    // `font scale: <printf %.2f scale>` before measuring anything; this pins
    // the JS side of that contract to the same fixed-point format.
    for (const [scale, expected] of [
      [1, 'font scale: 1.00'],
      [1.3, 'font scale: 1.30'],
      [1.5, 'font scale: 1.50'],
      [2, 'font scale: 2.00'],
    ] as const) {
      withFontScale(scale, () => {
        const view = render(
          <BeeUIProvider>
            <DynamicTypeAcceptance onBack={() => undefined} />
          </BeeUIProvider>,
        );
        expect(view.getByTestId('dynamic-type-font-scale').props.children).toBe(expected);
        view.unmount();
      });
    }
  });
});
