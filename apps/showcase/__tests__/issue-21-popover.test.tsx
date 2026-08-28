import {
  Button,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 300, height: 200 };

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

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const DEFAULT_ANCHOR = { x: 100, y: 60, width: 40, height: 20 };

type AnchorRect = typeof DEFAULT_ANCHOR;

function renderPopover(
  children: React.ReactNode,
  anchorRects: Record<string, AnchorRect> = { trigger: DEFAULT_ANCHOR },
) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = element.props?.testID as string | undefined;
        const rect = testID ? anchorRects[testID] : undefined;
        if (!rect) return null;
        return {
          measureInWindow: (
            callback: (x: number, y: number, width: number, height: number) => void,
          ) => callback(rect.x, rect.y, rect.width, rect.height),
        };
      },
    },
  );
}

describe('BeeUI issue #21 Popover', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('toggles deterministic uncontrolled open state from the trigger', () => {
    const screen = renderPopover(
      <Popover>
        <PopoverTrigger testID="trigger">Toggle</PopoverTrigger>
      </Popover>,
    );

    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
  });

  it('requests controlled state changes without mutating the controlled value', () => {
    const onOpenChange = jest.fn();
    const screen = renderPopover(
      <Popover onOpenChange={onOpenChange} open>
        <PopoverTrigger testID="trigger">Toggle</PopoverTrigger>
      </Popover>,
    );

    fireEvent.press(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
  });

  it('preserves Popover context for a close action inside portalled content', async () => {
    const onOpenChange = jest.fn();
    const screen = renderPopover(
      <Popover onOpenChange={onOpenChange} open>
        <PopoverTrigger testID="trigger">Toggle</PopoverTrigger>
        <PopoverContent testID="content">
          <PopoverClose testID="close">Close</PopoverClose>
        </PopoverContent>
      </Popover>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('close', { includeHiddenElements: true })).toBeTruthy(),
    );

    const closeButton = screen
      .UNSAFE_getAllByType(Button)
      .find((node) => node.props.testID === 'close');
    expect(closeButton).toBeDefined();

    act(() => {
      closeButton?.props.onPress?.({} as never);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
  });

  it('closes an open Popover when its anchor is unavailable', async () => {
    const onOpenChange = jest.fn();
    const screen = renderPopover(
      <Popover defaultOpen onOpenChange={onOpenChange}>
        <PopoverContent testID="content">
          <Text>Orphaned content</Text>
        </PopoverContent>
      </Popover>,
      {},
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('keeps unresolved content invisibly offscreen and out of the accessibility tree', () => {
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger testID="trigger">Open</PopoverTrigger>
        <PopoverContent
          avoidSafeArea={false}
          placement="bottom"
          sideOffset={8}
          testID="content"
        >
          <Text>Content</Text>
        </PopoverContent>
      </Popover>,
    );

    const content = screen.getByTestId('content', { includeHiddenElements: true });
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      left: -10000,
      opacity: 0,
      top: -10000,
    });
    expect(content.props.pointerEvents).toBe('none');
    expect(content.props.accessibilityElementsHidden).toBe(true);
    expect(content.props['aria-hidden']).toBe(true);
    expect(content.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('derives non-modal title and description accessibility fallbacks', async () => {
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger testID="trigger">Open</PopoverTrigger>
        <PopoverContent avoidSafeArea={false} testID="content">
          <PopoverTitle>Details</PopoverTitle>
          <PopoverDescription>More information</PopoverDescription>
        </PopoverContent>
      </Popover>,
    );

    await waitFor(() => {
      const content = screen.getByTestId('content', { includeHiddenElements: true });
      expect(content.props.accessibilityLabel).toBe('Details');
      expect(content.props.accessibilityHint).toBe('More information');
      expect(content.props.accessibilityViewIsModal).toBeUndefined();
      expect(content.props['aria-modal']).toBeUndefined();
    });
  });

  it('dismisses nested Popovers child-first for outside presses', async () => {
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger testID="parent-trigger">Parent</PopoverTrigger>
        <PopoverContent outsidePressTestID="parent-outside" testID="parent-content">
          <Popover defaultOpen>
            <PopoverTrigger testID="child-trigger">Child</PopoverTrigger>
            <PopoverContent outsidePressTestID="child-outside" testID="child-content">
              <Text>Child content</Text>
            </PopoverContent>
          </Popover>
        </PopoverContent>
      </Popover>,
      {
        'parent-trigger': { x: 40, y: 40, width: 50, height: 20 },
        'child-trigger': { x: 80, y: 80, width: 50, height: 20 },
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId('child-outside', { includeHiddenElements: true })).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId('parent-outside', { includeHiddenElements: true }));
    expect(screen.getByTestId('child-outside', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('parent-outside', { includeHiddenElements: true })).toBeTruthy();

    fireEvent.press(screen.getByTestId('child-outside', { includeHiddenElements: true }));
    await waitFor(() =>
      expect(screen.queryByTestId('child-outside', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('parent-outside', { includeHiddenElements: true })).toBeTruthy();

    fireEvent.press(screen.getByTestId('parent-outside', { includeHiddenElements: true }));
    await waitFor(() =>
      expect(screen.queryByTestId('parent-outside', { includeHiddenElements: true })).toBeNull(),
    );
  });

  it('lets accessibility escape close only the current topmost nested Popover', async () => {
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger testID="parent-trigger">Parent</PopoverTrigger>
        <PopoverContent testID="parent-content">
          <Popover defaultOpen>
            <PopoverTrigger testID="child-trigger">Child</PopoverTrigger>
            <PopoverContent testID="child-content">
              <Text>Child content</Text>
            </PopoverContent>
          </Popover>
        </PopoverContent>
      </Popover>,
      {
        'parent-trigger': { x: 40, y: 40, width: 50, height: 20 },
        'child-trigger': { x: 80, y: 80, width: 50, height: 20 },
      },
    );

    fireEvent(screen.getByTestId('parent-content', { includeHiddenElements: true }), 'accessibilityEscape');
    expect(screen.getByTestId('child-content', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('parent-content', { includeHiddenElements: true })).toBeTruthy();

    fireEvent(screen.getByTestId('child-content', { includeHiddenElements: true }), 'accessibilityEscape');
    await waitFor(() =>
      expect(screen.queryByTestId('child-content', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('parent-content', { includeHiddenElements: true })).toBeTruthy();

    fireEvent(screen.getByTestId('parent-content', { includeHiddenElements: true }), 'accessibilityEscape');
    await waitFor(() =>
      expect(screen.queryByTestId('parent-content', { includeHiddenElements: true })).toBeNull(),
    );
  });

  it('preserves caller trigger state while adding expanded and controls semantics', () => {
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger accessibilityState={{ selected: true }} testID="trigger">
          Open
        </PopoverTrigger>
      </Popover>,
    );

    const trigger = screen.getByTestId('trigger');
    expect(trigger.props.accessibilityState).toMatchObject({ expanded: true, selected: true });
    expect(trigger.props['aria-controls']).toEqual(expect.stringContaining('beeui-popover'));
  });
});
