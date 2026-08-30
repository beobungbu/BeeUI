import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  Tooltip as WebTooltip,
  TooltipContent as WebTooltipContent,
  TooltipTrigger as WebTooltipTrigger,
} from '../../../packages/ui/src/components/tooltip.web';
import {
  Tooltip as NativeTooltip,
  TooltipContent as NativeTooltipContent,
  TooltipTrigger as NativeTooltipTrigger,
} from '../../../packages/ui/src/components/tooltip.native';

// #154 (R4A.4) — deterministic regression-matrix coverage the ADR-005 sequencing
// defers past #152/#153: anchor-unavailable close (#59 bounded measurement
// behavior applied to Tooltip specifically — the shared hook contract itself is
// proven generically by `overlay-anchor-unavailable-completion.test.tsx` et al.,
// mirroring exactly how `issue-21-popover.test.tsx` proves it for `PopoverContent`)
// and unmount cleanup of the open/close delay timers. Controlled/uncontrolled
// paths, hover/focus delay/cancellation, Escape/dismiss, accessibility
// relationship, and native accessibility policy are already covered by
// `issue-152-tooltip-web.test.tsx`/`issue-153-tooltip-native.test.tsx`. RTL,
// nested Dialog/overlay scope, context preservation, and high-contrast/large-text
// evidence are real-browser/integration-shaped and live in
// `apps/visual-regression/tests/tooltip-showcase.spec.ts`,
// `overlay-context.spec.ts`, and `tooltip-fixture.spec.ts`. Tooltip renders no
// enter/exit transition of its own, so reduced motion has nothing
// Tooltip-specific to gate (`docs/components.md` "Tooltip contract").

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 300, height: 200 };

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

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const TRIGGER_RECT = { x: 100, y: 60, width: 40, height: 20 };

function renderWithAnchor(children: React.ReactNode, registerAnchor: boolean) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = element.props?.testID as string | undefined;
        if (!registerAnchor || testID !== 'trigger') return null;
        return {
          measureInWindow: (
            callback: (x: number, y: number, width: number, height: number) => void,
          ) => callback(TRIGGER_RECT.x, TRIGGER_RECT.y, TRIGGER_RECT.width, TRIGGER_RECT.height),
        };
      },
    },
  );
}

describe.each([
  {
    platform: 'Web',
    Tooltip: WebTooltip,
    TooltipContent: WebTooltipContent,
    TooltipTrigger: WebTooltipTrigger,
    // Web's hover channel schedules the 500ms openDelay (ADR-005) — the
    // pending timer under test.
    pendingTimerEvents: ['hoverIn'],
  },
  {
    platform: 'native',
    Tooltip: NativeTooltip,
    TooltipContent: NativeTooltipContent,
    TooltipTrigger: NativeTooltipTrigger,
    // Native long-press opens immediately (no openDelay); releasing it
    // schedules the fixed close-reveal-window timer instead — the pending
    // timer under test here.
    pendingTimerEvents: ['longPress', 'pressOut'],
  },
])('BeeUI issue #154 Tooltip regression matrix ($platform)', ({
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  pendingTimerEvents,
}) => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('closes an open Tooltip when its anchor is unavailable (#59 bounded measurement)', async () => {
    const onOpenChange = jest.fn();
    const screen = renderWithAnchor(
      <Tooltip defaultOpen onOpenChange={onOpenChange}>
        <TooltipContent testID="content">
          <Text>Orphaned content</Text>
        </TooltipContent>
      </Tooltip>,
      false,
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('clears a pending open timer on unmount without a state-update-on-unmounted warning', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const screen = renderWithAnchor(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover or long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
      true,
    );

    act(() => {
      for (const eventName of pendingTimerEvents) {
        fireEvent(screen.getByTestId('trigger'), eventName);
      }
    });

    expect(() => screen.unmount()).not.toThrow();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('starts closed for uncontrolled usage with no defaultOpen', () => {
    const screen = renderWithAnchor(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover or long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
      true,
    );

    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('starts open for uncontrolled usage with defaultOpen, independent of any trigger event', () => {
    const screen = renderWithAnchor(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Hover or long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
      true,
    );

    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });
});
