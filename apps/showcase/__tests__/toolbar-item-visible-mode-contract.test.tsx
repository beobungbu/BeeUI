import { IconButton, Toolbar, ToolbarItem } from '@beemvp/beeui-ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Astra review #2, item 3: `ToolbarItem.onPress`/`.disabled`/`.className` used to only be
// honoured once an item collapsed into the overflow menu — the toolbar row itself ignored
// them entirely, so `<ToolbarItem disabled onPress={fn}><IconButton /></ToolbarItem>` (no
// duplicate props on the child) silently rendered an enabled, inert button in the row. This
// file exercises the fixed contract only through the public `ToolbarItem`/child pair, never
// by re-declaring `disabled`/`onPress` on the child itself — the exact "false confidence"
// pattern the review flagged.
jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
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
const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
});

function renderToolbar(children: React.ReactNode) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>, {
    createNodeMock: (element) => {
      const testID = element.props?.testID as string | undefined;
      if (testID) return { focus: jest.fn(), measureInWindow: (cb: (...args: number[]) => void) => cb(0, 0, 24, 24) };
      return null;
    },
  });
}

// Mirrors toolbar-overflow-collapse.test.tsx's helper: fires the container's own layout
// event, then every measured item's layout event.
function layoutToolbar(testID: string, containerWidth: number, itemWidths: readonly number[]) {
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { height: 44, width: containerWidth, x: 0, y: 0 } },
  });
  itemWidths.forEach((width, index) => {
    fireEvent(screen.getByTestId(`${testID}-measure-${index}`, { includeHiddenElements: true }), 'layout', {
      nativeEvent: { layout: { height: 44, width, x: 0, y: 0 } },
    });
  });
}

// Mirrors toolbar-overflow-collapse.test.tsx's `pressEnterOnMenu`.
function pressEnterOnMenu(testID: string) {
  act(() => {
    const content = screen.getByTestId(testID, { includeHiddenElements: true });
    content.props.onKeyDown?.({ key: 'Enter', preventDefault: jest.fn() });
  });
}

describe('ToolbarItem visible-mode contract', () => {
  it('disables the visible child and suppresses its press', () => {
    const onPress = jest.fn();
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem disabled label="Archive" onPress={onPress}>
          <IconButton accessibilityLabel="Archive">🗄</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40]);

    const button = screen.getByLabelText('Archive');
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls onPress from the visible child when the item is enabled', () => {
    const onPress = jest.fn();
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Archive" onPress={onPress}>
          <IconButton accessibilityLabel="Archive">🗄</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40]);

    const button = screen.getByLabelText('Archive');
    expect(button.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("leaves an explicit onPress the child already declares untouched", () => {
    const itemOnPress = jest.fn();
    const childOnPress = jest.fn();
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Archive" onPress={itemOnPress}>
          <IconButton accessibilityLabel="Archive" onPress={childOnPress}>
            🗄
          </IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40]);

    fireEvent.press(screen.getByLabelText('Archive'));
    expect(childOnPress).toHaveBeenCalledTimes(1);
    expect(itemOnPress).not.toHaveBeenCalled();
  });

  it('warns once in dev when the item and its child declare different onPress functions', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Archive" onPress={() => {}}>
          <IconButton accessibilityLabel="Archive" onPress={() => {}}>
            🗄
          </IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40]);
    // A second layout pass (e.g. a resize) must not warn again for the same item.
    layoutToolbar('toolbar', 320, [40]);

    const mismatchWarnings = warnSpy.mock.calls.filter(([message]) => String(message).includes('onPress'));
    expect(mismatchWarnings).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it("applies className to the item's own wrapper, not to the child element", () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem className="item-wrapper-mark" label="Archive" onPress={() => {}}>
          <IconButton accessibilityLabel="Archive">🗄</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40]);

    const button = screen.getByLabelText('Archive');
    expect(button.props.className ?? '').not.toContain('item-wrapper-mark');
    expect(screen.UNSAFE_getByProps({ className: 'item-wrapper-mark' })).toBeTruthy();
  });

  it('disables the overflow menu entry once the same item collapses', async () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem disabled label="Archive" onPress={() => {}} priority={1}>
          <IconButton accessibilityLabel="Archive">🗄</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 10, [40]);
    expect(screen.queryByLabelText('Archive')).toBeNull();

    fireEvent.press(screen.getByTestId('toolbar-overflow-trigger'));
    await waitFor(() =>
      expect(screen.getByTestId('toolbar-overflow-item-0', { includeHiddenElements: true })).toBeTruthy(),
    );
    const entry = screen.getByTestId('toolbar-overflow-item-0', { includeHiddenElements: true });
    expect(entry.props.accessibilityState.disabled).toBe(true);
  });

  it('activates onPress from the overflow menu once the same item collapses', async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    try {
      const onPress = jest.fn();
      renderToolbar(
        <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
          <ToolbarItem label="Archive" onPress={onPress} priority={1}>
            <IconButton accessibilityLabel="Archive">🗄</IconButton>
          </ToolbarItem>
        </Toolbar>,
      );
      layoutToolbar('toolbar', 10, [40]);
      expect(screen.queryByLabelText('Archive')).toBeNull();

      fireEvent.press(screen.getByTestId('toolbar-overflow-trigger'));
      await waitFor(() =>
        expect(screen.getByTestId('toolbar-overflow-item-0', { includeHiddenElements: true })).toBeTruthy(),
      );
      pressEnterOnMenu('toolbar-overflow-content');

      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    }
  });
});
