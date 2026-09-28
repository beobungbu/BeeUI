import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
import { SegmentedControl, SegmentedControlItem } from '@beemvp/beeui-ui';

describe('BeeUI SegmentedControl Web label measurement', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('renders only the visible label text instead of a persistent hidden measurement clone', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = render(
      <SegmentedControl onValueChange={() => {}} value="light">
        <SegmentedControlItem testID="light" value="light">
          Sáng
        </SegmentedControlItem>
        <SegmentedControlItem testID="dark" value="dark">
          Tối
        </SegmentedControlItem>
      </SegmentedControl>,
    );

    expect(screen.getAllByText('Sáng', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByText('Tối', { includeHiddenElements: true })).toHaveLength(1);
  });
});
