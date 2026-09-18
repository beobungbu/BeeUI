import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  Sheet as SheetWeb,
  SheetContent as SheetContentWeb,
  SheetTitle as SheetTitleWeb,
  SheetTrigger as SheetTriggerWeb,
} from '../../../packages/ui/src/components/sheet.web';

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 720 };
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

const HOST_RECT = { x: 0, y: 0, width: 390, height: 720 };

// #548 — a Web Sheet could render partly above the viewport, and leave part
// of the viewport uncovered, whenever the application root was shorter than
// the browser viewport: the root anchored-overlay host's `flex-1` wrapper
// stretches to its own natural content height (not the viewport), so
// SheetContent's backdrop/panel wrapper — a viewport-class modal surface —
// inherited that short height instead, and a percentage `snapPoints` value
// (`'55%'`) resolved against it instead of the real available viewport
// height. `position: 'fixed'; inset: 0` on that wrapper anchors it to the
// browser viewport directly, independent of app-root content height, fixing
// both symptoms with one change.
describe('Sheet (web) viewport geometry (#548)', () => {
  it('anchors the backdrop/panel wrapper to the viewport (position: fixed, inset 0), not the app-root container', async () => {
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        <SheetWeb>
          <SheetTriggerWeb testID="trigger">Open sheet</SheetTriggerWeb>
          <SheetContentWeb overlayTestID="overlay" snapPoints={['55%']} testID="content">
            <SheetTitleWeb>Cart</SheetTitleWeb>
          </SheetContentWeb>
        </SheetWeb>
      </OverlayRuntimeProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );

    const content = screen.getByTestId('content', { includeHiddenElements: true });
    expect(content).toBeTruthy();

    const viewportFixedWrappers = screen.UNSAFE_getAllByType(View).filter((node) => {
      const flattened = StyleSheet.flatten(node.props.style) as { position?: string } | undefined;
      return flattened?.position === 'fixed';
    });
    expect(viewportFixedWrappers).toHaveLength(1);
    expect(StyleSheet.flatten(viewportFixedWrappers[0]?.props.style)).toMatchObject({
      bottom: 0,
      left: 0,
      position: 'fixed',
      right: 0,
      top: 0,
    });
  });
});
