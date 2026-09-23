import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@beemvp/beeui-ui';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Mirrors issue-36-dropdown-menu.test.tsx's harness: `DropdownMenuContent` portals
// through the anchored-overlay runtime and needs a measurable anchor even while
// closed/measuring, and `react-native-safe-area-context` isn't a real native module
// under Jest.
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
const TRIGGER_RECT = { x: 80, y: 40, width: 80, height: 40 };

function renderMenu(children: React.ReactNode) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>, {
    createNodeMock: (element) => {
      const testID = element.props?.testID as string | undefined;
      if (testID === 'trigger') {
        return {
          focus: jest.fn(),
          measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
            callback(TRIGGER_RECT.x, TRIGGER_RECT.y, TRIGGER_RECT.width, TRIGGER_RECT.height),
        };
      }
      if (testID) return { focus: jest.fn() };
      return null;
    },
  });
}

// DropdownMenuItem had no secondary-line slot, so a store switcher
// wanting a muted address line under the store name had to hand-nest two `Text`s
// and lose the family's label styling.
describe('BeeUI DropdownMenuItem description slot', () => {
  it('renders a description as a muted secondary line alongside the primary content', async () => {
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Stores</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem description="123 Cầu Giấy, Hà Nội" testID="item">
            Tạp hoá Cầu Giấy
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() => expect(screen.getByTestId('item', { includeHiddenElements: true })).toBeTruthy());
    expect(screen.getByText('Tạp hoá Cầu Giấy', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('123 Cầu Giấy, Hà Nội', { includeHiddenElements: true })).toBeTruthy();
  });

  it('renders without a description column when none is provided', async () => {
    const screen = renderMenu(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem testID="item">Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() => expect(screen.getByTestId('item', { includeHiddenElements: true })).toBeTruthy());
    expect(screen.getByText('Edit', { includeHiddenElements: true })).toBeTruthy();
  });
});
