import { IconButton, Toolbar, ToolbarItem } from '@beemvp/beeui-ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Mirrors dropdown-menu-item-description-slot.test.tsx's harness: `Toolbar`'s overflow
// menu is a `DropdownMenu`, whose `DropdownMenuContent` portals through the anchored-overlay
// runtime and needs a measurable host even while closed, and
// `react-native-safe-area-context` is not a real native module under Jest.
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

function renderToolbar(children: React.ReactNode) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>, {
    createNodeMock: (element) => {
      const testID = element.props?.testID as string | undefined;
      if (testID) return { focus: jest.fn(), measureInWindow: (cb: (...args: number[]) => void) => cb(0, 0, 24, 24) };
      return null;
    },
  });
}

// Fires the container's own layout event, then every measured item's layout event — mirrors
// how Toolbar's hidden measurement pass discovers real container/item widths at runtime,
// since jsdom/react-test-renderer never runs a real layout engine.
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

// Mirrors issue-36-dropdown-menu.test.tsx's `pressMenuKey`: `DropdownMenuContent` only
// wires its roving-tabindex Enter/Space activation through a Web `onKeyDown` handler, so
// exercising item activation needs `Platform.OS === 'web'` plus a direct `onKeyDown` call —
// `fireEvent.press` on an individual `DropdownMenuItem` is not this family's proven
// activation path (only its `DropdownMenu`/`DropdownMenuTrigger` own real presses are).
function pressEnterOnMenu(testID: string) {
  act(() => {
    const content = screen.getByTestId(testID, { includeHiddenElements: true });
    content.props.onKeyDown?.({ key: 'Enter', preventDefault: jest.fn() });
  });
}

function ExampleToolbar({ onPress }: { onPress: (label: string) => void }) {
  return (
    <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
      {/* `onPress` lives only on `ToolbarItem` — `Toolbar` clones it onto the child in the
          row (see `toolbar-item-visible-mode-contract.test.tsx`) and passes it to the
          overflow menu row when collapsed, so declaring it twice here would be redundant. */}
      <ToolbarItem label="Search" onPress={() => onPress('Search')}>
        <IconButton accessibilityLabel="Search">🔍</IconButton>
      </ToolbarItem>
      <ToolbarItem label="Filter" onPress={() => onPress('Filter')} priority={2}>
        <IconButton accessibilityLabel="Filter">⚙</IconButton>
      </ToolbarItem>
      <ToolbarItem label="Export" onPress={() => onPress('Export')} priority={1}>
        <IconButton accessibilityLabel="Export">⬇</IconButton>
      </ToolbarItem>
    </Toolbar>
  );
}

describe('Toolbar overflow collapse', () => {
  it('renders role="toolbar" and every item with no overflow menu when everything fits', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 300, [40, 40, 40]);

    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.getByLabelText('Export')).toBeTruthy();
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('collapses the lowest-priority item first into the overflow menu when the row is narrow', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    // Search=40, Filter=40, Export=60: without collapsing, 3 items need 140px of content plus
    // 2 gaps (4px each) = 148px. A 140px container doesn't fit that, but shedding only
    // "Export" leaves 80px of content + 2 gaps (one between Search/Filter, one before the
    // trigger) + the unmeasured trigger's fallback width (44px, `controlSize.icon`) = 132px,
    // which fits.
    layoutToolbar('toolbar', 140, [40, 40, 60]);

    // "Export" (priority 1, the lowest number here) collapses first; "Filter" (priority 2)
    // and "Search" (no priority, never collapses) stay in the row.
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Export')).toBeNull();
    expect(screen.getByLabelText('More actions')).toBeTruthy();
  });

  it('activating a collapsed item from the overflow menu calls its onPress', async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    try {
      const onPress = jest.fn();
      renderToolbar(<ExampleToolbar onPress={onPress} />);
      layoutToolbar('toolbar', 140, [40, 40, 60]);

      fireEvent.press(screen.getByTestId('toolbar-overflow-trigger'));
      await waitFor(() =>
        expect(screen.getByTestId('toolbar-overflow-item-2', { includeHiddenElements: true })).toBeTruthy(),
      );
      // A single collapsed item ("Export") becomes the roving-tabindex "current" item as
      // soon as the menu opens, so one Enter activates it — see `pressEnterOnMenu`'s docblock.
      pressEnterOnMenu('toolbar-overflow-content');

      expect(onPress).toHaveBeenCalledWith('Export');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    }
  });

  it('restores a previously collapsed item once the row widens again (resize restores)', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 100, [40, 40, 40]);
    expect(screen.queryByLabelText('Filter')).toBeNull();

    layoutToolbar('toolbar', 300, [40, 40, 40]);

    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('never collapses an item with no priority, even when the row cannot fit it', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    // Too narrow even for "Search" (no priority) alone plus the reserved trigger width —
    // "Filter" and "Export" (both prioritized) still collapse; "Search" stays in the row
    // regardless of how much it overflows.
    layoutToolbar('toolbar', 20, [40, 40, 40]);

    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.queryByLabelText('Filter')).toBeNull();
    expect(screen.queryByLabelText('Export')).toBeNull();
    expect(screen.getByLabelText('More actions')).toBeTruthy();
  });
});
