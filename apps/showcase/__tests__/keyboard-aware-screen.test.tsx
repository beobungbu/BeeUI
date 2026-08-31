import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { Keyboard, Platform, TextInput, UIManager } from 'react-native';
import { KeyboardAwareScreen, Text } from '@beemvp/beeui-ui';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

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

describe('BeeUI KeyboardAwareScreen', () => {
  const originalOS = Platform.OS;
  const originalMeasureInWindow = Object.getOwnPropertyDescriptor(UIManager, 'measureInWindow');

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
    if (originalMeasureInWindow) {
      Object.defineProperty(UIManager, 'measureInWindow', originalMeasureInWindow);
    } else {
      delete (UIManager as unknown as Record<string, unknown>).measureInWindow;
    }
  });

  it('renders children inside the scrollable body', () => {
    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Form content</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByText('Form content')).toBeTruthy();
    expect(screen.getByTestId('ka-screen')).toBeTruthy();
    expect(screen.getByTestId('ka-screen-scroll')).toBeTruthy();
  });

  it('applies the requested contentWidth token to the bounded content wrapper', () => {
    const screen = render(
      <KeyboardAwareScreen contentWidth="sm" testID="ka-screen">
        <Text>Narrow form</Text>
      </KeyboardAwareScreen>,
    );

    const content = screen.getByTestId('ka-screen-content');
    expect(content.props.className).toContain('max-w-[440px]');
  });

  it('defaults contentWidth to an unbounded body', () => {
    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Full-width body</Text>
      </KeyboardAwareScreen>,
    );

    const content = screen.getByTestId('ka-screen-content');
    expect(content.props.className).toContain('max-w-none');
  });

  it('defaults keyboard dismissal to interactive on iOS and keeps handled taps', () => {
    Platform.OS = 'ios';
    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Body</Text>
      </KeyboardAwareScreen>,
    );

    const scrollView = screen.getByTestId('ka-screen-scroll');
    expect(scrollView.props.keyboardDismissMode).toBe('interactive');
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('defaults keyboard dismissal to on-drag on Android', () => {
    Platform.OS = 'android';
    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Body</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByTestId('ka-screen-scroll').props.keyboardDismissMode).toBe('on-drag');
  });

  it('lets callers override keyboardDismissMode and keyboardShouldPersistTaps', () => {
    const screen = render(
      <KeyboardAwareScreen
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="always"
        testID="ka-screen"
      >
        <Text>Body</Text>
      </KeyboardAwareScreen>,
    );

    const scrollView = screen.getByTestId('ka-screen-scroll');
    expect(scrollView.props.keyboardDismissMode).toBe('on-drag');
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('always');
  });

  it('keeps Android short forms scrollable and re-measures a newly focused field while the keyboard stays visible', () => {
    Platform.OS = 'android';
    const listeners = new Map<string, (event?: unknown) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, listener: (event?: unknown) => void) => {
      listeners.set(event, listener);
      return { remove: jest.fn() };
    }) as typeof Keyboard.addListener);

    let focusedField = 101;
    jest.spyOn(TextInput.State, 'currentlyFocusedField').mockImplementation(() => focusedField);
    const measure = jest.fn((_field: number, callback: (x: number, y: number, width: number, height: number) => void) => {
      callback(0, 700, 200, 50);
    });
    // jest-expo's UIManager mock does not expose measureInWindow at runtime even
    // though React Native's TypeScript surface does. Install the seam explicitly.
    Object.defineProperty(UIManager, 'measureInWindow', {
      configurable: true,
      value: measure,
      writable: true,
    });
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Short body</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(0);

    act(() => {
      listeners.get('keyboardDidShow')?.({
        endCoordinates: { height: 300, screenY: 600 },
      });
    });
    expect(measure).toHaveBeenCalledTimes(1);
    expect(measure.mock.calls[0]?.[0]).toBe(101);
    // Keyboard height + default 24px margin creates enough temporary content
    // range for a short form's final field to scroll above an overlaid keyboard.
    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(324);

    focusedField = 202;
    act(() => {
      screen.getByTestId('ka-screen-scroll').props.onFocus?.({});
    });
    expect(measure).toHaveBeenCalledTimes(2);
    expect(measure.mock.calls[1]?.[0]).toBe(202);

    // Repeated focus/keyboard noise for the same field + same keyboard geometry
    // is ignored, so the focus-switch fix does not reintroduce overshoot.
    act(() => {
      screen.getByTestId('ka-screen-scroll').props.onFocus?.({});
    });
    expect(measure).toHaveBeenCalledTimes(2);

    act(() => {
      listeners.get('keyboardDidHide')?.();
    });
    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(0);
  });

  it('wraps content in a SafeArea only when safeAreaEdges is explicitly provided', () => {
    const withoutEdges = render(
      <KeyboardAwareScreen testID="ka-plain">
        <Text>Plain body</Text>
      </KeyboardAwareScreen>,
    );
    // No double-inset by default: the safe area is opt-in via safeAreaEdges.
    expect(withoutEdges.queryByTestId('ka-plain-safe-area')).toBeNull();

    const withEdges = render(
      <KeyboardAwareScreen safeAreaEdges={['top', 'bottom']} testID="ka-edges">
        <Text>Edged body</Text>
      </KeyboardAwareScreen>,
    );
    const safeArea = withEdges.getByTestId('ka-edges-safe-area');
    expect(safeArea.props.edges).toEqual(['top', 'bottom']);
    expect(withEdges.getByText('Edged body')).toBeTruthy();
  });

  it('does not crash when rendered on web, where the Android keyboard listener is inert', () => {
    Platform.OS = 'web';

    const screen = render(
      <KeyboardAwareScreen testID="ka-web">
        <Text>Web body</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByText('Web body')).toBeTruthy();
  });
});
