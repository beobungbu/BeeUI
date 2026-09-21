import { IconButton, Toolbar, ToolbarItem } from '@beemvp/beeui-ui';
import { act, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// `Toolbar` (the #611 item 1 overflow primitive) now supports Web arrow-key
// roving-tabindex navigation (WAI-ARIA Toolbar Pattern): one item is Tab-reachable at a
// time, ArrowLeft/ArrowRight move the roving "current" slot with wrap-around (RTL-aware),
// Home/End jump to the first/last enabled slot, and the overflow trigger is always the
// sequence's last stop once anything has collapsed — a collapsed item itself is only
// reachable by opening that menu, never directly. Mirrors
// `tabs-scrollable-arrow-key-roving-focus.test.tsx`'s division of labor: real DOM
// `.focus()`/document.activeElement evidence belongs to Playwright, this file asserts the
// `tabIndex` state machine driving it.
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

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

function setWebDocumentDir(dir: 'ltr' | 'rtl' | null) {
  if (dir === null) {
    delete (globalThis as { document?: unknown }).document;
    return;
  }
  (globalThis as { document?: unknown }).document = { documentElement: { dir } };
}

afterEach(() => {
  setPlatform(originalPlatformOS);
  setWebDocumentDir(null);
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

function ExampleToolbar({ onPress }: { onPress: (label: string) => void }) {
  return (
    <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
      <ToolbarItem label="Search" onPress={() => onPress('Search')}>
        <IconButton accessibilityLabel="Search">🔍</IconButton>
      </ToolbarItem>
      <ToolbarItem disabled label="Filter" onPress={() => onPress('Filter')}>
        <IconButton accessibilityLabel="Filter">⚙</IconButton>
      </ToolbarItem>
      <ToolbarItem label="Export" onPress={() => onPress('Export')} priority={1}>
        <IconButton accessibilityLabel="Export">⬇</IconButton>
      </ToolbarItem>
    </Toolbar>
  );
}

describe('Toolbar arrow-key roving focus (Web)', () => {
  beforeEach(() => setPlatform('web'));

  it('gives the first enabled item tabIndex 0 and every other item tabIndex -1 when everything fits', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 300, [40, 40, 40]);

    expect(screen.getByLabelText('Search').props.tabIndex).toBe(0);
    expect(screen.getByLabelText('Filter').props.tabIndex).toBe(-1);
    expect(screen.getByLabelText('Export').props.tabIndex).toBe(-1);
  });

  it('treats a child-only disabled control as disabled in the roving sequence', () => {
    renderToolbar(
      <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar">
        <ToolbarItem label="Disabled child"><IconButton accessibilityLabel="Disabled child" disabled>×</IconButton></ToolbarItem>
        <ToolbarItem label="Real" onPress={() => {}}><IconButton accessibilityLabel="Real">✓</IconButton></ToolbarItem>
      </Toolbar>,
    );
    layoutToolbar('toolbar', 300, [40, 40]);
    expect(screen.getByLabelText('Disabled child').props.tabIndex).toBe(-1);
    expect(screen.getByLabelText('Real').props.tabIndex).toBe(0);
  });

  it('ArrowRight moves the roving-current slot forward, skipping a disabled item', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 300, [40, 40, 40]);

    pressKey('toolbar', 'ArrowRight');

    // Skips the disabled "Filter" entirely and lands on "Export".
    expect(screen.getByLabelText('Search').props.tabIndex).toBe(-1);
    expect(screen.getByLabelText('Filter').props.tabIndex).toBe(-1);
    expect(screen.getByLabelText('Export').props.tabIndex).toBe(0);
  });

  it('ArrowLeft wraps from the first enabled item to the last enabled item', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 300, [40, 40, 40]);

    pressKey('toolbar', 'ArrowLeft');

    expect(screen.getByLabelText('Export').props.tabIndex).toBe(0);
  });

  it('the overflow trigger is the roving sequence\'s last stop once an item collapses, reached via End', () => {
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    // Total content is 120px; a 100px container sheds "Export" (the only prioritized item).
    layoutToolbar('toolbar', 100, [40, 40, 40]);
    expect(screen.queryByLabelText('Export')).toBeNull();

    pressKey('toolbar', 'End');

    expect(screen.getByTestId('toolbar-overflow-trigger').props.tabIndex).toBe(0);
    expect(screen.getByLabelText('Search').props.tabIndex).toBe(-1);

    // ArrowRight from the overflow trigger wraps back to the first enabled item.
    pressKey('toolbar', 'ArrowRight');
    expect(screen.getByLabelText('Search').props.tabIndex).toBe(0);
    expect(screen.getByTestId('toolbar-overflow-trigger').props.tabIndex).toBe(-1);
  });

  it('flips ArrowLeft/ArrowRight in RTL (ADR-004 direction precedence)', () => {
    setWebDocumentDir('rtl');
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 300, [40, 40, 40]);

    // In RTL, ArrowLeft is "forward" (next), skipping the disabled "Filter".
    pressKey('toolbar', 'ArrowLeft');
    expect(screen.getByLabelText('Export').props.tabIndex).toBe(0);

    pressKey('toolbar', 'ArrowRight');
    expect(screen.getByLabelText('Search').props.tabIndex).toBe(0);
  });
});

describe('Toolbar (non-Web) — roving-tabindex is a Web-only affordance', () => {
  it('leaves tabIndex undefined and does not wire onKeyDown on native', () => {
    setPlatform('ios');
    renderToolbar(<ExampleToolbar onPress={() => {}} />);
    layoutToolbar('toolbar', 300, [40, 40, 40]);

    expect(screen.getByLabelText('Search').props.tabIndex).toBeUndefined();
    expect(screen.getByTestId('toolbar').props.onKeyDown).toBeUndefined();
  });
});
