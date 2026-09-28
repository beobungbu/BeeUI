import { render } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { SafeArea, Text } from '@beemvp/beeui-ui';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      (
        { children, style, ...rest }: Record<string, unknown>,
        ref: React.Ref<typeof View>,
      ) => (
        <View ref={ref} {...rest} style={[style, { paddingTop: insets.top }]}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

describe('BeeUI SafeArea padded child layout', () => {
  it('mirrors flex-row/gap/alignment utilities onto the wrapper that becomes the children parent', () => {
    const screen = render(
      <SafeArea
        className="flex-row items-center justify-between gap-4 px-4"
        edges={['top']}
        testID="safe-area"
      >
        <Text testID="first">First</Text>
        <Text testID="second">Second</Text>
      </SafeArea>,
    );

    const tree = screen.toJSON() as {
      children: Array<{ props: Record<string, unknown>; children?: unknown[] }>;
      props: Record<string, unknown>;
    };
    const wrapper = tree.children[0];
    const wrapperClassName = String(wrapper.props.className ?? '');

    expect(String(tree.props.className)).toContain('flex-row');
    expect(wrapperClassName).toContain('flex-row');
    expect(wrapperClassName).toContain('items-center');
    expect(wrapperClassName).toContain('justify-between');
    expect(wrapperClassName).toContain('gap-4');
    expect(wrapperClassName).toContain('px-4');
    expect(wrapper.children).toHaveLength(2);
  });

  it('mirrors style-based child layout while keeping padding on the inner wrapper', () => {
    const screen = render(
      <SafeArea
        edges={['top']}
        style={{ alignItems: 'center', flexDirection: 'row', gap: 12, paddingTop: 24 }}
        testID="safe-area"
      >
        <Text>First</Text>
        <Text>Second</Text>
      </SafeArea>,
    );

    const tree = screen.toJSON() as {
      children: Array<{ props: Record<string, unknown> }>;
      props: Record<string, unknown>;
    };
    const wrapperStyle = StyleSheet.flatten(tree.children[0].props.style as never);
    const outerStyle = StyleSheet.flatten(tree.props.style as never);

    expect(outerStyle).toMatchObject({ alignItems: 'center', flexDirection: 'row', gap: 12, paddingTop: 47 });
    expect(wrapperStyle).toMatchObject({ alignItems: 'center', flexDirection: 'row', gap: 12, paddingTop: 24 });
  });
});
