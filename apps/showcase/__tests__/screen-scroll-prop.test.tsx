import { render } from '@testing-library/react-native';
import * as React from 'react';
import { ScrollView, Text } from 'react-native';
import { Screen } from '@beemvp/beeui-ui';

// #597 item 4 — "No family member is a scrolling page container. Screen +
// SafeArea do not scroll, so every long form or list hand-rolls a
// ScrollView." Screen now accepts a `scroll` prop that wraps its children in
// a keyboard-avoiding ScrollView, without changing the default (unscrolled)
// behavior existing consumers already rely on.
describe('Screen scroll prop (#597 item 4)', () => {
  it('renders children directly with no ScrollView by default', () => {
    const screen = render(
      <Screen testID="screen">
        <Text>Body</Text>
      </Screen>,
    );

    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('wraps children in a ScrollView when scroll is true', () => {
    const screen = render(
      <Screen scroll testID="screen">
        <Text>Long form body</Text>
      </Screen>,
    );

    const scrollViews = screen.UNSAFE_queryAllByType(ScrollView);
    expect(scrollViews).toHaveLength(1);
    expect(scrollViews[0]?.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByText('Long form body')).toBeTruthy();
  });

  it('forwards a ScrollViewProps object and lets it override the default keyboardShouldPersistTaps', () => {
    const screen = render(
      <Screen scroll={{ keyboardShouldPersistTaps: 'always', testID: 'screen-scroll' }} testID="screen">
        <Text>Body</Text>
      </Screen>,
    );

    const scrollView = screen.getByTestId('screen-scroll');
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('always');
  });

  it('still applies className/padding to the outer container when scroll is enabled', () => {
    const screen = render(
      <Screen className="bg-surface" padding="md" scroll testID="screen">
        <Text>Body</Text>
      </Screen>,
    );

    expect(screen.getByTestId('screen').props.className).toContain('bg-surface');
    expect(screen.getByTestId('screen').props.className).toContain('px-5');
  });
});
