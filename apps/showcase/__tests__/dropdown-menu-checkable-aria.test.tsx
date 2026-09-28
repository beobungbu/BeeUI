import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@beemvp/beeui-ui';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>{children}</View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

describe('BeeUI DropdownMenu checkable accessibility semantics', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('exposes menuitemcheckbox/menuitemradio and aria-checked on Web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={{ x: 0, y: 0, width: 320, height: 240 }}>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
          <DropdownMenuContent testID="content">
            <DropdownMenuCheckboxItem checked testID="checkbox">
              Toolbar
            </DropdownMenuCheckboxItem>
            <DropdownMenuRadioGroup value="compact">
              <DropdownMenuRadioItem testID="radio" value="compact">
                Compact
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </OverlayRuntimeProvider>,
      {
        createNodeMock: (element) => {
          if (element.props?.testID === 'trigger') {
            return {
              focus: jest.fn(),
              measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
                callback(40, 40, 80, 36),
            };
          }
          if (element.props?.testID) return { focus: jest.fn() };
          return null;
        },
      },
    );

    await waitFor(() => expect(screen.getByTestId('checkbox', { includeHiddenElements: true })).toBeTruthy());
    const checkbox = screen.getByTestId('checkbox', { includeHiddenElements: true });
    const radio = screen.getByTestId('radio', { includeHiddenElements: true });

    expect(checkbox.props.role).toBe('menuitemcheckbox');
    expect(checkbox.props['aria-checked']).toBe(true);
    expect(radio.props.role).toBe('menuitemradio');
    expect(radio.props['aria-checked']).toBe(true);
  });
});
