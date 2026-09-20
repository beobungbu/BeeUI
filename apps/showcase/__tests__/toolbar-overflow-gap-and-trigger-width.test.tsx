import { IconButton, Toolbar, ToolbarItem } from '@beemvp/beeui-ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Astra review #2, item 4: the overflow-fit budget used to reserve a flat 36px for the
// trigger and ignore the `gap-1` (4px) row gap entirely, so a row that fit by summed item
// width alone could still visually overflow once real gaps and the real (44px `icon`-sized)
// trigger were painted. This file drives the fit math at its exact threshold — the width
// that fits with every gap counted, one pixel narrower, and a real measured trigger width
// that differs from the unmeasured 44px fallback.
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

function layoutOverflowTrigger(testID: string, width: number) {
  act(() => {
    screen.getByTestId(`${testID}-overflow-trigger`).props.onLayout?.({
      nativeEvent: { layout: { height: 44, width, x: 0, y: 0 } },
    });
  });
}

// Two items, 50px each. Without collapsing: 100px of content + one 4px gap between them =
// 104px — the "fits exactly" / "one pixel over" threshold every test below is built around.
function TwoItemToolbar() {
  return (
    <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
      <ToolbarItem label="Search" onPress={() => {}}>
        <IconButton accessibilityLabel="Search">🔍</IconButton>
      </ToolbarItem>
      <ToolbarItem label="Export" onPress={() => {}} priority={1}>
        <IconButton accessibilityLabel="Export">⬇</IconButton>
      </ToolbarItem>
    </Toolbar>
  );
}

describe('Toolbar overflow fit math: row gap + measured trigger width', () => {
  it('fits both items with no overflow menu when the container matches content + gaps exactly', () => {
    renderToolbar(<TwoItemToolbar />);
    layoutToolbar('toolbar', 104, [50, 50]);

    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Export')).toBeTruthy();
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('collapses once the container is a single pixel narrower than content + gaps', () => {
    renderToolbar(<TwoItemToolbar />);
    layoutToolbar('toolbar', 103, [50, 50]);

    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.queryByLabelText('Export')).toBeNull();
    expect(screen.getByLabelText('More actions')).toBeTruthy();
  });

  it('recomputes collapse once the trigger reports a real measured width different from the 44px fallback', () => {
    function ThreeItemToolbar() {
      return (
        <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
          <ToolbarItem label="Search" onPress={() => {}}>
            <IconButton accessibilityLabel="Search">🔍</IconButton>
          </ToolbarItem>
          <ToolbarItem label="Filter" onPress={() => {}} priority={2}>
            <IconButton accessibilityLabel="Filter">⚙</IconButton>
          </ToolbarItem>
          <ToolbarItem label="Export" onPress={() => {}} priority={1}>
            <IconButton accessibilityLabel="Export">⬇</IconButton>
          </ToolbarItem>
        </Toolbar>
      );
    }

    renderToolbar(<ThreeItemToolbar />);
    // Search=50, Filter=40, Export=40: baseline (no trigger) = 130 + 8 = 138px. A 130px
    // container: collapsing only "Export" leaves 90px content + 2 gaps (8px) + the
    // unmeasured 44px fallback trigger = 142px — still over 130px, so "Filter" also
    // collapses, leaving 50px + 1 gap (4px) + 44px = 98px, which fits.
    layoutToolbar('toolbar', 130, [50, 40, 40]);
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.queryByLabelText('Filter')).toBeNull();
    expect(screen.queryByLabelText('Export')).toBeNull();

    // Now the real trigger mounts and reports a much narrower measured width (20px) than the
    // 44px fallback the collapse above was computed with: collapsing only "Export" now needs
    // 90px + 8px + 20px = 118px, which fits under 130px — "Filter" should be restored to the
    // row without any further container resize.
    layoutOverflowTrigger('toolbar', 20);

    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Export')).toBeNull();
  });
});
