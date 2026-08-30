import { act, fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Pressable, Text } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../packages/ui/src/components/tooltip.native';

// #153 — Tooltip native (iOS/Android) behavior (`docs/decisions/005-tooltip-contract.md`).
// These are the deterministic, fake-timer-driven unit tests for the native trigger
// channels the ADR requires: long-press reveal (immediate open, fixed reveal-window
// close after release), external-keyboard/Switch-Control focus (immediate open/close,
// same contract as Web's focus channel), Escape/accessibility-escape dismissal without
// pointer/focus movement, and the merged `accessibilityHint` accessible-relationship
// path that is unconditional on whether the visual bubble has ever mounted. Real
// iOS Simulator/Android Emulator long-press + VoiceOver/TalkBack evidence is CI's
// classifier-triggered `ios-native`/`bare-native` jobs' responsibility, not this file's
// (mirrors `issue-152-tooltip-web.test.tsx`'s deterministic-vs-real-device evidence split).
//
// Imports the concrete `tooltip.native` module directly (not the bare `./tooltip`
// specifier) for the same reason `issue-152-tooltip-web.test.tsx` imports `tooltip.web`
// directly: Jest's default platform resolution here already resolves to native for the
// bare specifier, but importing the concrete module keeps the test immune to any future
// resolution-order change.

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

describe('BeeUI issue #153 Tooltip (native)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('opens immediately on long-press, with no additional openDelay', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    expect(screen.queryByTestId('content')).toBeNull();

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'longPress');
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();
  });

  it('closes after a fixed reveal window once the long-press is released', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'longPress');
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      fireEvent(screen.getByTestId('trigger'), 'pressOut');
      jest.advanceTimersByTime(299);
    });
    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('a bare tap release never schedules a close for a tooltip that was never opened', () => {
    const onPress = jest.fn();
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger onPress={onPress} testID="trigger">
          Press me
        </TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent.press(screen.getByTestId('trigger'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
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

  it('dismisses on accessibility-escape without any touch or focus movement', () => {
    const screen = renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      fireEvent(
        screen.getByTestId('content', { includeHiddenElements: true }),
        'accessibilityEscape',
      );
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('never toggles open state on trigger press', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    act(() => {
      fireEvent.press(screen.getByTestId('trigger'));
    });
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('merges tooltip content text into the trigger accessibilityHint unconditionally, before any reveal', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger testID="trigger">Long-press me</TooltipTrigger>
        <TooltipContent testID="content">Helpful description</TooltipContent>
      </Tooltip>,
    );

    // Never revealed (no long-press/focus yet) — the accessible relationship
    // must still be present (ADR-005: unconditional, independent of the
    // bubble ever mounting).
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('trigger').props.accessibilityHint).toBe('Helpful description');
  });

  it('never overwrites an explicit consumer-provided accessibilityHint', () => {
    const screen = renderTooltip(
      <Tooltip>
        <TooltipTrigger accessibilityHint="Custom hint" testID="trigger">
          Long-press me
        </TooltipTrigger>
        <TooltipContent testID="content">Helpful description</TooltipContent>
      </Tooltip>,
    );

    expect(screen.getByTestId('trigger').props.accessibilityHint).toBe('Custom hint');
  });

  it('hides the visual bubble from the accessibility tree unconditionally', () => {
    const screen = renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Long-press me</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    const content = screen.getByTestId('content', { includeHiddenElements: true });
    expect(content.props.accessibilityElementsHidden).toBe(true);
    expect(content.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('warns in dev when TooltipContent renders interactive children', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderTooltip(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Long-press me</TooltipTrigger>
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
