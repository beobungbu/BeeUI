import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
const DEFAULT_ANCHOR = { x: 80, y: 40, width: 80, height: 40 };

type Rect = typeof DEFAULT_ANCHOR;

function renderMenu(
  children: React.ReactNode,
  anchorRects: Record<string, Rect> = { trigger: DEFAULT_ANCHOR },
) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = element.props?.testID as string | undefined;
        const rect = testID ? anchorRects[testID] : undefined;
        if (rect) {
          return {
            focus: jest.fn(),
            measureInWindow: (
              callback: (x: number, y: number, width: number, height: number) => void,
            ) => callback(rect.x, rect.y, rect.width, rect.height),
          };
        }
        if (testID) return { focus: jest.fn() };
        return null;
      },
    },
  );
}

async function waitForMenuItem(screen: ReturnType<typeof renderMenu>, testID: string) {
  await waitFor(() =>
    expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeTruthy(),
  );
  return screen.getByTestId(testID, { includeHiddenElements: true });
}

function pressMenuKey(screen: ReturnType<typeof renderMenu>, key: string, testID = 'content') {
  act(() => {
    const content = screen.getByTestId(testID, { includeHiddenElements: true });
    content.props.onKeyDown?.({ key, preventDefault: jest.fn() });
  });
}

describe('BeeUI issue #36 DropdownMenu', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    jest.restoreAllMocks();
  });

  it('toggles deterministic uncontrolled state from the trigger', () => {
    const screen = renderMenu(
      <DropdownMenu>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
      </DropdownMenu>,
    );

    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
  });

  it('requests controlled state changes without mutating the controlled value', () => {
    const onOpenChange = jest.fn();
    const screen = renderMenu(
      <DropdownMenu open onOpenChange={onOpenChange}>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
      </DropdownMenu>,
    );

    fireEvent.press(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
  });

  it('runs selection before the default close request for a normal item', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    let screen!: ReturnType<typeof renderMenu>;
    const onSelect = jest.fn(() => {
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
    });

    screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem onSelect={onSelect} testID="item">
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await waitForMenuItem(screen, 'item');
    expect(item.props.accessibilityRole).toBe('menuitem');
    await waitFor(() => expect(item.props.tabIndex).toBe(0));

    pressMenuKey(screen, 'Enter');

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByTestId('content', { includeHiddenElements: true })).toBeNull(),
    );
  });

  it('keeps disabled items inert and leaves the menu open', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onSelect = jest.fn();
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem disabled onSelect={onSelect} testID="disabled-item">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await waitForMenuItem(screen, 'disabled-item');
    expect(item.props.accessibilityState.disabled).toBe(true);
    expect(item.props.tabIndex).toBe(-1);

    pressMenuKey(screen, 'Enter');

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('toggles checkbox state request without closing by default', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onCheckedChange = jest.fn();
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuCheckboxItem
            checked={false}
            onCheckedChange={onCheckedChange}
            testID="checkbox-item"
          >
            Show toolbar
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await waitForMenuItem(screen, 'checkbox-item');
    expect(item.props.accessibilityState.checked).toBe(false);
    await waitFor(() => expect(item.props.tabIndex).toBe(0));

    pressMenuKey(screen, ' ');

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('coordinates radio selection and keeps the menu open by default', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onValueChange = jest.fn();
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuRadioGroup value="compact" onValueChange={onValueChange}>
            <DropdownMenuRadioItem testID="compact" value="compact">
              Compact
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem testID="comfortable" value="comfortable">
              Comfortable
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const compact = await waitForMenuItem(screen, 'compact');
    const comfortable = await waitForMenuItem(screen, 'comfortable');
    expect(compact.props.accessibilityState.checked).toBe(true);
    expect(comfortable.props.accessibilityState.checked).toBe(false);
    await waitFor(() => expect(compact.props.tabIndex).toBe(0));

    pressMenuKey(screen, 'ArrowDown');
    await waitFor(() =>
      expect(screen.getByTestId('comfortable', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
    pressMenuKey(screen, 'Enter');

    expect(onValueChange).toHaveBeenCalledWith('comfortable');
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('fails duplicate radio values safe as disabled', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="same" onValueChange={jest.fn()}>
            <DropdownMenuRadioItem testID="radio-a" value="same">
              A
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem testID="radio-b" value="same">
              B
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('radio-a', { includeHiddenElements: true }).props.accessibilityState
          .disabled,
      ).toBe(true);
      expect(
        screen.getByTestId('radio-b', { includeHiddenElements: true }).props.accessibilityState
          .disabled,
      ).toBe(true);
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate radio value'));
  });

  it('keeps unresolved content invisibly offscreen and non-interactive', async () => {
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent avoidSafeArea={false} testID="content">
          <DropdownMenuItem testID="item">Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitForMenuItem(screen, 'item');
    const content = screen.getByTestId('content', { includeHiddenElements: true });
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      left: -10000,
      opacity: 0,
      top: -10000,
    });
    expect(content.props.pointerEvents).toBe('none');
    expect(content.props.accessibilityElementsHidden).toBe(true);
    expect(content.props['aria-hidden']).toBe(true);
  });

  it('moves keyboard current item deterministically and skips disabled items on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem testID="first">First</DropdownMenuItem>
          <DropdownMenuItem disabled testID="disabled">Disabled</DropdownMenuItem>
          <DropdownMenuItem testID="third">Third</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('first', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
    expect(screen.getByTestId('disabled', { includeHiddenElements: true }).props.tabIndex).toBe(-1);

    pressMenuKey(screen, 'ArrowDown');

    await waitFor(() =>
      expect(screen.getByTestId('third', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
  });

  it('supports Home, End, Enter, and Space keyboard activation', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const selected: string[] = [];
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem closeOnSelect={false} onSelect={() => selected.push('first')} testID="first">
            First
          </DropdownMenuItem>
          <DropdownMenuItem disabled testID="disabled">Disabled</DropdownMenuItem>
          <DropdownMenuItem closeOnSelect={false} onSelect={() => selected.push('third')} testID="third">
            Third
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('first', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    pressMenuKey(screen, 'End');
    await waitFor(() =>
      expect(screen.getByTestId('third', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
    pressMenuKey(screen, 'Enter');
    expect(selected).toEqual(['third']);

    pressMenuKey(screen, 'Home');
    await waitFor(() =>
      expect(screen.getByTestId('first', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
    pressMenuKey(screen, ' ');
    expect(selected).toEqual(['third', 'first']);
  });

  it('closes an open menu when its anchor is unavailable', async () => {
    const onOpenChange = jest.fn();
    const screen = renderMenu(
      <DropdownMenu defaultOpen onOpenChange={onOpenChange}>
        <DropdownMenuContent testID="content">
          <Text>Orphaned menu</Text>
        </DropdownMenuContent>
      </DropdownMenu>,
      {},
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('lets accessibility escape dismiss nested menus child-first', async () => {
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="parent-trigger">Parent</DropdownMenuTrigger>
        <DropdownMenuContent testID="parent-content">
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="child-trigger">Child</DropdownMenuTrigger>
            <DropdownMenuContent testID="child-content">
              <Text>Child content</Text>
            </DropdownMenuContent>
          </DropdownMenu>
        </DropdownMenuContent>
      </DropdownMenu>,
      {
        'parent-trigger': { x: 40, y: 40, width: 60, height: 30 },
        'child-trigger': { x: 100, y: 90, width: 60, height: 30 },
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId('child-content', { includeHiddenElements: true })).toBeTruthy(),
    );

    fireEvent(
      screen.getByTestId('parent-content', { includeHiddenElements: true }),
      'accessibilityEscape',
    );
    expect(screen.getByTestId('child-content', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('parent-content', { includeHiddenElements: true })).toBeTruthy();

    fireEvent(
      screen.getByTestId('child-content', { includeHiddenElements: true }),
      'accessibilityEscape',
    );
    await waitFor(() =>
      expect(screen.queryByTestId('child-content', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('parent-content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('dismisses nested menus child-first for outside presses', async () => {
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="parent-trigger">Parent</DropdownMenuTrigger>
        <DropdownMenuContent outsidePressTestID="parent-outside" testID="parent-content">
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="child-trigger">Child</DropdownMenuTrigger>
            <DropdownMenuContent outsidePressTestID="child-outside" testID="child-content">
              <Text>Child content</Text>
            </DropdownMenuContent>
          </DropdownMenu>
        </DropdownMenuContent>
      </DropdownMenu>,
      {
        'parent-trigger': { x: 40, y: 40, width: 60, height: 30 },
        'child-trigger': { x: 100, y: 90, width: 60, height: 30 },
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId('child-outside', { includeHiddenElements: true })).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId('parent-outside', { includeHiddenElements: true }));
    expect(screen.getByTestId('child-outside', { includeHiddenElements: true })).toBeTruthy();

    fireEvent.press(screen.getByTestId('child-outside', { includeHiddenElements: true }));
    await waitFor(() =>
      expect(screen.queryByTestId('child-content', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('parent-content', { includeHiddenElements: true })).toBeTruthy();
  });
});
