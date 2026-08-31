import { Popover, PopoverContent, PopoverTrigger } from '@beemvp/beeui-ui';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet, Text } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/anchor-measurement-seam';

/**
 * Proof test for the shared anchor-measurement seam (BeeUI issue #58).
 *
 * Every other suite that renders a trigger only asserts existence/state/context —
 * none of them read the post-measurement positioned style, so a silently-broken
 * measurement seam causes no red tests there. This suite is the one genuinely
 * load-bearing geometry assertion: it proves `createAnchorSeam` resolves a real
 * component ref's `measureInWindow` to a configured rect, driving Popover from its
 * unresolved offscreen placeholder to a real positioned style.
 */

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
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
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };

afterEach(() => {
  clearActiveAnchorSeam();
});

describe('anchor-measurement seam proof (issue #58)', () => {
  it('resolves a real trigger ref to positioned Popover content, not the unresolved placeholder', async () => {
    createAnchorSeam({
      // Register PopoverTrigger explicitly, in addition to the always-patched
      // Pressable/View base captures — the RN mock layer can expose a distinct
      // prototype for a component reached through product code.
      captures: [
        (ref) => (
          <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
            <Popover>
              <PopoverTrigger ref={ref as never} testID="capture-trigger" />
            </Popover>
          </OverlayRuntimeProvider>
        ),
      ],
      match: (testID) => testID === 'trigger',
      rectFor: (testID) => (testID === 'trigger' ? ANCHOR_RECT : undefined),
    });

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        <Popover defaultOpen>
          <PopoverTrigger testID="trigger">Open</PopoverTrigger>
          <PopoverContent align="start" avoidSafeArea={false} placement="bottom" sideOffset={8} testID="content">
            <Text>Content</Text>
          </PopoverContent>
        </Popover>
      </OverlayRuntimeProvider>,
    );

    // Measurement resolves synchronously off the seam-patched ref (see
    // useAnchoredOverlayPosition's mount effect), so the anchor rect is already
    // known — but `position` additionally requires overlay size from a layout
    // pass, which jest's RN environment never fires on its own. Firing it here is
    // exactly what a real device does after the content view mounts and lays out.
    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    fireEvent(screen.getByTestId('content', { includeHiddenElements: true }), 'layout', {
      nativeEvent: { layout: { width: 100, height: 50, x: 0, y: 0 } },
    });

    const content = await waitFor(() => {
      const node = screen.getByTestId('content', { includeHiddenElements: true });
      const flatStyle = StyleSheet.flatten(node.props.style) as { left?: number; top?: number };
      expect(flatStyle.left).not.toBe(-10000);
      return node;
    });

    const flatStyle = StyleSheet.flatten(content.props.style) as { left: number; top: number };
    // align="start", placement="bottom", sideOffset=8, ltr: left = anchor.x, top =
    // anchor.y + anchor.height + sideOffset. This is only reachable if the seam's
    // measureInWindow patch actually delivered ANCHOR_RECT to the real trigger ref.
    expect(flatStyle.left).toBe(ANCHOR_RECT.x);
    expect(flatStyle.top).toBe(ANCHOR_RECT.y + ANCHOR_RECT.height + 8);
    expect(content.props.pointerEvents).toBe('auto');
    expect(content.props.accessibilityElementsHidden).not.toBe(true);
    expect(content.props['aria-hidden']).not.toBe(true);
  });
});
