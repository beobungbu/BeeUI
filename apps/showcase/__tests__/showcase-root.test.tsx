import * as fs from 'node:fs';
import * as path from 'node:path';
import { fireEvent, render } from '@testing-library/react-native';
import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import type * as ReactTypes from 'react';
import { ShowcaseRoot } from '../showcase-root';

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

function renderShowcase() {
  return render(
    <BeeUIProvider>
      <ShowcaseRoot />
    </BeeUIProvider>,
  );
}

describe('Showcase root', () => {
  it('renders the section chooser with Components, Theme & tokens, Patterns, and Runtime Acceptance', () => {
    const view = renderShowcase();
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Open Components' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Open Theme and tokens' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Open Patterns' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Open Runtime Acceptance' })).toBeTruthy();
  });

  it('opens Components without mounting Patterns and returns home', () => {
    const view = renderShowcase();
    fireEvent.press(view.getByRole('button', { name: 'Open Components' }));
    expect(view.getByTestId('component-gallery')).toBeTruthy();
    expect(view.queryByTestId('pattern-gallery')).toBeNull();
    expect(view.queryByTestId('theme-token-inspector')).toBeNull();
    expect(view.getByText('Hands-on playground')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Back to Showcase home' }));
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.queryByTestId('component-gallery')).toBeNull();
  });

  it('opens Theme & tokens as a design-system inspection surface and returns home', () => {
    const view = renderShowcase();
    fireEvent.press(view.getByRole('button', { name: 'Open Theme and tokens' }));
    expect(view.getByTestId('theme-token-inspector')).toBeTruthy();
    expect(view.queryByTestId('component-gallery')).toBeNull();
    expect(view.queryByTestId('pattern-gallery')).toBeNull();
    expect(view.getByText('Runtime branding')).toBeTruthy();
    expect(view.getByText('Motion & reduced motion')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Back to Showcase home' }));
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.queryByTestId('theme-token-inspector')).toBeNull();
  });

  it('opens Patterns without mounting Components and returns home', () => {
    const view = renderShowcase();
    fireEvent.press(view.getByRole('button', { name: 'Open Patterns' }));
    expect(view.getByTestId('pattern-gallery')).toBeTruthy();
    expect(view.queryByTestId('component-gallery')).toBeNull();
    expect(view.queryByTestId('theme-token-inspector')).toBeNull();
    expect(view.getByText('Production patterns')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Back to Showcase home' }));
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.queryByTestId('pattern-gallery')).toBeNull();
  });


  it('opens the native runtime acceptance fixture with stable evidence markers', () => {
    const view = renderShowcase();
    fireEvent.press(view.getByRole('button', { name: 'Open Runtime Acceptance' }));

    expect(view.getByTestId('runtime-smoke')).toBeTruthy();
    expect(view.getByTestId('runtime-ready')).toBeTruthy();
    expect(view.getByText('safe-area top: 47 bottom: 34')).toBeTruthy();
    expect(view.getByText('pageSheet state: closed')).toBeTruthy();
    expect(view.getByText('formSheet state: closed')).toBeTruthy();

    fireEvent.press(view.getByTestId('runtime-back'));
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.queryByTestId('runtime-smoke')).toBeNull();
  });

  it('keeps root navigation router-free', () => {
    const files = [
      path.resolve(__dirname, '../App.tsx'),
      path.resolve(__dirname, '../showcase-root.tsx'),
    ];
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/expo-router|@react-navigation|react-router/);
  });
});
