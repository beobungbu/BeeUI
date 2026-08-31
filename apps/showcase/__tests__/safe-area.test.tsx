import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { Uniwind } from 'uniwind';
import { BeeUIProvider, SafeArea, Text } from '@beemvp/beeui-ui';

const TEST_INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({
      children,
      onChange,
    }: {
      children?: React.ReactNode;
      onChange: (metrics: { frame: typeof frame; insets: typeof insets }) => void;
    }) => {
      React.useEffect(() => {
        onChange({ frame, insets });
      }, [onChange]);
      return children;
    },
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

describe('BeeUI safe-area foundation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards explicit edge ownership and mode through SafeArea', () => {
    const screen = render(
      <SafeArea edges={['top', 'left', 'right']} mode="margin" testID="safe-area">
        <Text>Safe content</Text>
      </SafeArea>,
    );

    const safeArea = screen.getByTestId('safe-area');
    expect(safeArea.props.edges).toEqual(['top', 'left', 'right']);
    expect(safeArea.props.mode).toBe('margin');
    expect(screen.getByText('Safe content')).toBeTruthy();
  });

  it('syncs measured insets into Uniwind by default', async () => {
    const updateInsets = jest.spyOn(Uniwind, 'updateInsets').mockImplementation(() => undefined);

    render(
      <BeeUIProvider>
        <Text>App</Text>
      </BeeUIProvider>,
    );

    await waitFor(() => expect(updateInsets).toHaveBeenCalledWith(TEST_INSETS));
  });

  it('lets applications disable the Uniwind bridge when they already own it', () => {
    const updateInsets = jest.spyOn(Uniwind, 'updateInsets').mockImplementation(() => undefined);

    render(
      <BeeUIProvider syncUniwindInsets={false}>
        <Text>App</Text>
      </BeeUIProvider>,
    );

    expect(updateInsets).not.toHaveBeenCalled();
  });
});
