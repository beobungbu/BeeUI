import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@beemvp/beeui-ui';
import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';
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
type Rect = { x: number; y: number; width: number; height: number };

const ITEM_RECTS: Record<string, Rect> = {};

function setOrder(prefix: 'menu' | 'select', order: string[]) {
  order.forEach((id, index) => {
    ITEM_RECTS[`${prefix}-${id}`] = { x: 40, y: 80 + index * 40, width: 160, height: 36 };
  });
}

function createHostNode(testID?: string) {
  const fallback = { x: 0, y: 0, width: 200, height: 160 };
  const rect = () => ITEM_RECTS[testID ?? ''] ?? fallback;
  return {
    clientHeight: 160,
    focus: jest.fn(),
    getBoundingClientRect: () => {
      const current = rect();
      return {
        bottom: current.y + current.height,
        height: current.height,
        left: current.x,
        right: current.x + current.width,
        top: current.y,
        width: current.width,
        x: current.x,
        y: current.y,
        toJSON: () => ({}),
      };
    },
    measureInWindow: (
      callback: (x: number, y: number, width: number, height: number) => void,
    ) => {
      const current = rect();
      callback(current.x, current.y, current.width, current.height);
    },
    scrollTop: 0,
  };
}

function renderWithOverlay(ui: React.ReactElement) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{ui}</OverlayRuntimeProvider>, {
    createNodeMock: (element) => createHostNode(element.props?.testID as string | undefined),
  });
}

function keyDown(
  screen: ReturnType<typeof renderWithOverlay>,
  testID: string,
  key: string,
) {
  act(() => {
    screen.getByTestId(testID, { includeHiddenElements: true }).props.onKeyDown?.({
      key,
      preventDefault: jest.fn(),
    });
  });
}

function dropdownTree(order: string[]) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger testID="menu-trigger">Open</DropdownMenuTrigger>
      <DropdownMenuContent testID="menu-content">
        {order.map((id) => (
          <DropdownMenuItem closeOnSelect={false} key={id} testID={`menu-${id}`}>
            {id.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function selectTree(order: string[]) {
  return (
    <Select defaultOpen defaultValue="a">
      <SelectTrigger testID="select-trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent testID="select-content">
        {order.map((id) => (
          <SelectItem key={id} testID={`select-${id}`} value={id}>
            {id.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

describe('committed collection order after keyed child reorders', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    Object.keys(ITEM_RECTS).forEach((key) => delete ITEM_RECTS[key]);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    ITEM_RECTS['menu-trigger'] = { x: 40, y: 24, width: 120, height: 40 };
    ITEM_RECTS['select-trigger'] = { x: 40, y: 24, width: 160, height: 40 };
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    jest.restoreAllMocks();
  });

  it('DropdownMenu Home/Arrow/End follows the newly committed host order (#654)', async () => {
    setOrder('menu', ['a', 'b', 'c']);
    const screen = renderWithOverlay(dropdownTree(['a', 'b', 'c']));

    await waitFor(() =>
      expect(screen.getByTestId('menu-a', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    // Same keyed items, different committed order: registration order stays A/B/C,
    // while their host geometry is now C/A/B. Keyboard navigation must follow the latter.
    setOrder('menu', ['c', 'a', 'b']);
    screen.rerender(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        {dropdownTree(['c', 'a', 'b'])}
      </OverlayRuntimeProvider>,
    );

    keyDown(screen, 'menu-content', 'Home');
    await waitFor(() =>
      expect(screen.getByTestId('menu-c', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    keyDown(screen, 'menu-content', 'ArrowDown');
    await waitFor(() =>
      expect(screen.getByTestId('menu-a', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    keyDown(screen, 'menu-content', 'End');
    await waitFor(() =>
      expect(screen.getByTestId('menu-b', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
  });

  it('Select survives StrictMode replay and navigates by newly committed host order (#656)', async () => {
    setOrder('select', ['a', 'b', 'c']);
    const screen = renderWithOverlay(<React.StrictMode>{selectTree(['a', 'b', 'c'])}</React.StrictMode>);

    await waitFor(() =>
      expect(screen.getByTestId('select-a', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    setOrder('select', ['c', 'a', 'b']);
    screen.rerender(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        <React.StrictMode>{selectTree(['c', 'a', 'b'])}</React.StrictMode>
      </OverlayRuntimeProvider>,
    );

    keyDown(screen, 'select-content', 'Home');
    await waitFor(() =>
      expect(screen.getByTestId('select-c', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    keyDown(screen, 'select-content', 'ArrowDown');
    await waitFor(() =>
      expect(screen.getByTestId('select-a', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );

    keyDown(screen, 'select-content', 'End');
    await waitFor(() =>
      expect(screen.getByTestId('select-b', { includeHiddenElements: true }).props.tabIndex).toBe(0),
    );
  });
});
