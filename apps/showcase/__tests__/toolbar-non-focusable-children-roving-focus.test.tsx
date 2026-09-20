import { IconButton, Toolbar, ToolbarItem } from '@beemvp/beeui-ui';
import { act, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// #618 (Astra review, item 1): the roving-tabindex `sequence` used to list every visible
// `ToolbarItem` regardless of whether its child actually rendered a focusable control.
// `withRovingFocus` silently returns `null`/text children unchanged (never cloning a
// `ref`/`tabIndex` onto them) and cannot attach a `ref` to a `Fragment` at all, so any of
// those in the mix left the roving sequence pointing at a dead slot — no control anywhere
// ever got `tabIndex=0`. The fix derives the sequence only from items whose cloned child
// actually registered a focus function; this file proves null/conditional/Fragment/non-
// BeeUI children are skipped, a disabled real control still occupies its (skippable) slot,
// and the overflow trigger remains the sequence's last stop.
jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <RNView ref={ref} {...props}>
          {children}
        </RNView>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };
const originalPlatformOS = Platform.OS;
const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

beforeEach(() => {
  setPlatform('web');
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  setPlatform(originalPlatformOS);
  (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
});

function renderToolbar(children: React.ReactNode) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>);
}

function layoutToolbar(testID: string, containerWidth: number, itemWidths: readonly number[]) {
  act(() => {
    screen.getByTestId(testID).props.onLayout?.({
      nativeEvent: { layout: { height: 44, width: containerWidth, x: 0, y: 0 } },
    });
    itemWidths.forEach((width, index) => {
      screen
        .getByTestId(`${testID}-measure-${index}`, { includeHiddenElements: true })
        .props.onLayout?.({ nativeEvent: { layout: { height: 44, width, x: 0, y: 0 } } });
    });
  });
}

function pressKey(testID: string, key: string) {
  act(() => {
    screen.getByTestId(testID).props.onKeyDown?.({ key, preventDefault: jest.fn() });
  });
}

describe('Toolbar roving focus skips non-focusable children (Web)', () => {
  it('gives tabIndex 0 to the sole real control when a sibling item renders null', () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Null item" onPress={() => {}}>
          {null}
        </ToolbarItem>
        <ToolbarItem label="Real" onPress={() => {}}>
          <IconButton accessibilityLabel="Real">*</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [0, 40]);

    expect(screen.getByLabelText('Real').props.tabIndex).toBe(0);
  });

  it('gives tabIndex 0 to the sole real control when a sibling item is conditionally false', () => {
    const showFirst = false;
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Conditional" onPress={() => {}}>
          {showFirst && <IconButton accessibilityLabel="Conditional">*</IconButton>}
        </ToolbarItem>
        <ToolbarItem label="Real" onPress={() => {}}>
          <IconButton accessibilityLabel="Real">*</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [0, 40]);

    expect(screen.getByLabelText('Real').props.tabIndex).toBe(0);
    expect(screen.queryByLabelText('Conditional')).toBeNull();
  });

  it('skips a Fragment child, warns once in dev, and still lands tabIndex 0 on the real control', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Fragment item" onPress={() => {}}>
          <>
            <Text>Not focusable</Text>
          </>
        </ToolbarItem>
        <ToolbarItem label="Real" onPress={() => {}}>
          <IconButton accessibilityLabel="Real">*</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40, 40]);

    expect(screen.getByLabelText('Real').props.tabIndex).toBe(0);

    const fragmentWarnings = warnSpy.mock.calls.filter(([message]) =>
      String(message).includes('Fragment item'),
    );
    expect(fragmentWarnings).toHaveLength(1);

    // A second render pass (e.g. a re-layout) must not warn again for the same item.
    layoutToolbar('toolbar', 320, [40, 40]);
    const fragmentWarningsAfter = warnSpy.mock.calls.filter(([message]) =>
      String(message).includes('Fragment item'),
    );
    expect(fragmentWarningsAfter).toHaveLength(1);

    warnSpy.mockRestore();
  });

  it('includes a plain (non-BeeUI) element child that still mounts and forwards a ref', () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Plain" onPress={() => {}}>
          <Pressable accessibilityLabel="Plain" accessibilityRole="button">
            <Text>Plain</Text>
          </Pressable>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40]);

    expect(screen.getByLabelText('Plain').props.tabIndex).toBe(0);
  });

  it('still gives a disabled real control its (skippable) roving slot', () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem disabled label="Disabled" onPress={() => {}}>
          <IconButton accessibilityLabel="Disabled" disabled>
            *
          </IconButton>
        </ToolbarItem>
        <ToolbarItem label="Real" onPress={() => {}}>
          <IconButton accessibilityLabel="Real">*</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40, 40]);

    // The first enabled slot wins tabIndex 0 — the disabled item is present in the
    // sequence (arrow-key navigation must be able to skip over it) but never gets it.
    expect(screen.getByLabelText('Disabled').props.tabIndex).toBe(-1);
    expect(screen.getByLabelText('Real').props.tabIndex).toBe(0);
  });

  it('keeps the overflow trigger as the roving sequence\'s last stop when non-focusable children are mixed in', () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Null item" onPress={() => {}}>
          {null}
        </ToolbarItem>
        <ToolbarItem label="Search" onPress={() => {}}>
          <IconButton accessibilityLabel="Search">*</IconButton>
        </ToolbarItem>
        <ToolbarItem label="Export" onPress={() => {}} priority={1}>
          <IconButton accessibilityLabel="Export">*</IconButton>
        </ToolbarItem>
      </Toolbar>,
    );
    // Total content (Search + Export) is 80px; a 60px container sheds "Export".
    layoutToolbar('toolbar', 60, [0, 40, 40]);
    expect(screen.queryByLabelText('Export')).toBeNull();

    pressKey('toolbar', 'End');

    expect(screen.getByTestId('toolbar-overflow-trigger').props.tabIndex).toBe(0);
    expect(screen.getByLabelText('Search').props.tabIndex).toBe(-1);
  });
});
