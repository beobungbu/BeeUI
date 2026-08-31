import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@beemvp/beeui-ui';
import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Text, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
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

const HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };
const TRIGGER_RECT = { x: 80, y: 40, width: 80, height: 40 };

function renderOverlay(children: React.ReactNode) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = element.props?.testID as string | undefined;
        if (testID === 'trigger') {
          return {
            focus: jest.fn(),
            measureInWindow: (
              callback: (x: number, y: number, width: number, height: number) => void,
            ) => callback(TRIGGER_RECT.x, TRIGGER_RECT.y, TRIGGER_RECT.width, TRIGGER_RECT.height),
          };
        }
        return { focus: jest.fn() };
      },
    },
  );
}

describe('BeeUI overlay trigger aria-controls idref', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Popover trigger exposes no aria-controls while content is unmounted and a valid idref once mounted', () => {
    const screen = renderOverlay(
      <Popover>
        <PopoverTrigger testID="trigger">Toggle</PopoverTrigger>
        <PopoverContent testID="content">
          <Text>Details</Text>
        </PopoverContent>
      </Popover>,
    );

    expect(screen.queryByTestId('content', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('trigger').props['aria-controls']).toBeUndefined();

    fireEvent.press(screen.getByTestId('trigger'));

    const openContent = screen.getByTestId('content', { includeHiddenElements: true });
    const openTrigger = screen.getByTestId('trigger');
    expect(openContent.props.nativeID).toBeTruthy();
    expect(openTrigger.props['aria-controls']).toBe(openContent.props.nativeID);

    fireEvent.press(screen.getByTestId('trigger'));

    expect(screen.queryByTestId('content', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('trigger').props['aria-controls']).toBeUndefined();
  });

  it('DropdownMenu trigger exposes no aria-controls while content is unmounted and a valid idref once mounted', () => {
    const screen = renderOverlay(
      <DropdownMenu>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <Text>Item</Text>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.queryByTestId('content', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('trigger').props['aria-controls']).toBeUndefined();

    fireEvent.press(screen.getByTestId('trigger'));

    const openContent = screen.getByTestId('content', { includeHiddenElements: true });
    const openTrigger = screen.getByTestId('trigger');
    expect(openContent.props.nativeID).toBeTruthy();
    expect(openTrigger.props['aria-controls']).toBe(openContent.props.nativeID);

    fireEvent.press(screen.getByTestId('trigger'));

    expect(screen.queryByTestId('content', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('trigger').props['aria-controls']).toBeUndefined();
  });

  it('preserves aria-expanded semantics independently of aria-controls presence', () => {
    const screen = renderOverlay(
      <Popover>
        <PopoverTrigger testID="trigger">Toggle</PopoverTrigger>
      </Popover>,
    );

    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('trigger').props['aria-controls']).toBeUndefined();

    fireEvent.press(screen.getByTestId('trigger'));

    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
  });
});
