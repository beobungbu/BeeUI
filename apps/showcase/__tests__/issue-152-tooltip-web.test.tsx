import { act, fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Pressable, Text } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../packages/ui/src/components/tooltip.web';

// #152 — Tooltip Web behavior (`docs/decisions/005-tooltip-contract.md`). These are
// the deterministic, fake-timer-driven unit tests for the open/close delay state
// machine the ADR requires locally from #152 itself (not deferred to #154):
// hover-with-delay, quick enter/leave cancellation, focus/blur without delay,
// hoverable (pointer travel onto content), dismissible (Escape without pointer/
// focus movement), and persistent (no auto-timeout). Real browser hover/focus/
// Escape evidence lives in `apps/visual-regression/tests/tooltip-showcase.spec.ts`.
//
// Imports the concrete `tooltip.web` module directly (not the bare `./tooltip`
// specifier) because Jest's default platform resolution here is native, not web —
// the same reason `overlay-transport.test.tsx` never exercises
// `createWebDomTransport` through the bare `./overlay-transport` import.

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

function renderTooltip(children: React.ReactNode) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = element.props?.testID as string | undefined;
        if (testID !== 'trigger') return null;
        return {
          measureInWindow: (
            callback: (x: number, y: number, width: number, height: number) => void,
          ) => callback(TRIGGER_RECT.x, TRIGGER_RECT.y, TRIGGER_RECT.width, TRIGGER_RECT.height),
        };
      },
    },
  );
}

describe('BeeUI issue #152 Tooltip (Web)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('opens on hover only after the default 500ms openDelay', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    expect(screen.queryByTestId('content')).toBeNull();

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'hoverIn');
    });
    expect(screen.queryByTestId('content')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(screen.queryByTestId('content')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('cancels a pending open when the pointer leaves before openDelay elapses', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'hoverIn');
      jest.advanceTimersByTime(200);
      fireEvent(screen.getByTestId('trigger'), 'hoverOut');
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('opens immediately on focus and closes immediately on blur', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Focus me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'focus');
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'blur');
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('stays open while the pointer travels onto the content (hoverable), then closes after closeDelay', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'hoverIn');
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'hoverOut');
      jest.advanceTimersByTime(200);
      fireEvent(screen.getByTestId('content', { includeHiddenElements: true }), 'hoverIn');
      jest.advanceTimersByTime(1_000);
    });
    // The close scheduled by leaving the trigger must not fire once the pointer
    // travelled onto the content itself.
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      fireEvent(screen.getByTestId('content', { includeHiddenElements: true }), 'hoverOut');
      jest.advanceTimersByTime(299);
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('dismisses on Escape without any pointer or focus movement', () => {
    const screen = renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      fireEvent(screen.getByTestId('content', { includeHiddenElements: true }), 'accessibilityEscape');
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('never auto-closes on a bare timeout while hover/focus stays engaged (persistent)', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'hoverIn');
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('wires role="tooltip" and gates aria-describedby on the trigger to the open state', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    expect(screen.getByTestId('trigger').props['aria-describedby']).toBeUndefined();

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'focus');
    });

    const content = screen.getByTestId('content', { includeHiddenElements: true });
    expect(content.props.role).toBe('tooltip');
    expect(screen.getByTestId('trigger').props['aria-describedby']).toBe(content.props.nativeID);
  });

  it('is never a Tab stop and never receives focus itself', () => {
    const screen = renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    // Pressable defaults to a natural Tab stop (`tabIndex={0}` on Web);
    // Tooltip content must never receive focus, natural or programmatic
    // (ADR-005 "no focus transfer into content").
    expect(screen.getByTestId('content', { includeHiddenElements: true }).props.tabIndex).toBe(-1);
  });

  it('never toggles open state on trigger press', () => {
    const onPress = jest.fn();
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger onPress={onPress} testID="trigger">
          Press me
        </TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    fireEvent.press(screen.getByTestId('trigger'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('warns in dev when TooltipContent renders interactive children', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Hover me</TooltipTrigger>
        <TooltipContent testID="content">
          <Pressable onPress={() => undefined}>
            <Text>Actionable</Text>
          </Pressable>
        </TooltipContent>
      </Tooltip>,
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('interactive content'));
  });
});
