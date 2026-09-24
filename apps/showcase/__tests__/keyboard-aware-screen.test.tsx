import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { Keyboard, Platform, ScrollView, TextInput } from 'react-native';
import { KeyboardAwareScreen, Text } from '@beemvp/beeui-ui';

// A minimal stand-in for the host-component ref `TextInput.State.currentlyFocusedInput()`
// returns (RN 0.86+), replacing the deprecated numeric field ID from
// `currentlyFocusedField()`.
function createFocusedInputStub(
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void,
) {
  return { measureInWindow: jest.fn(measureInWindow) };
}

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

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
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

    let focusedInput = createFocusedInputStub((callback) => callback(0, 700, 200, 50));
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focusedInput as never);

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
    expect(focusedInput.measureInWindow).toHaveBeenCalledTimes(1);
    // Keyboard height + default 24px margin creates enough temporary content
    // range for a short form's final field to scroll above an overlaid keyboard.
    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(324);

    const secondFocusedInput = createFocusedInputStub((callback) => callback(0, 700, 200, 50));
    focusedInput = secondFocusedInput;
    act(() => {
      screen.getByTestId('ka-screen-scroll').props.onFocus?.({});
    });
    expect(secondFocusedInput.measureInWindow).toHaveBeenCalledTimes(1);

    // Repeated focus/keyboard noise for the same field + same keyboard geometry
    // is ignored, so the focus-switch fix does not reintroduce overshoot.
    act(() => {
      screen.getByTestId('ka-screen-scroll').props.onFocus?.({});
    });
    expect(secondFocusedInput.measureInWindow).toHaveBeenCalledTimes(1);

    act(() => {
      listeners.get('keyboardDidHide')?.();
    });
    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(0);
  });

  // #631 item 1 — `TextInput.State.currentlyFocusedField()` is deprecated as of
  // RN 0.86 and raises a LogBox `console.error` on every focus.
  // `currentlyFocusedInput()` is the supported replacement.
  it('resolves the focused field through the non-deprecated currentlyFocusedInput API', () => {
    Platform.OS = 'android';
    const listeners = new Map<string, (event?: unknown) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, listener: (event?: unknown) => void) => {
      listeners.set(event, listener);
      return { remove: jest.fn() };
    }) as typeof Keyboard.addListener);

    const deprecatedSpy = jest.spyOn(TextInput.State, 'currentlyFocusedField');
    const focusedInput = createFocusedInputStub((callback) => callback(0, 700, 200, 50));
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focusedInput as never);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Body</Text>
      </KeyboardAwareScreen>,
    );

    act(() => {
      listeners.get('keyboardDidShow')?.({
        endCoordinates: { height: 300, screenY: 600 },
      });
    });

    expect(focusedInput.measureInWindow).toHaveBeenCalledTimes(1);
    expect(deprecatedSpy).not.toHaveBeenCalled();
  });

  // #588 — `KeyboardAvoidingView behavior="padding"` on iOS makes room for the
  // keyboard but never itself scrolls a specific already-below-the-fold
  // focused field into that newly visible area. KeyboardAwareScreen runs the
  // same field-measure-and-scroll correction on iOS as it always has on
  // Android.
  it('scrolls the focused field above the keyboard on iOS', () => {
    Platform.OS = 'ios';
    const listeners = new Map<string, (event?: unknown) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, listener: (event?: unknown) => void) => {
      listeners.set(event, listener);
      return { remove: jest.fn() };
    }) as typeof Keyboard.addListener);

    const focusedInput = createFocusedInputStub((callback) => {
      // Field bottom (y + height = 780) sits 130px below the keyboard top (650).
      callback(0, 730, 200, 50);
    });
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focusedInput as never);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scrollToSpy = jest.fn();
    Object.defineProperty(ScrollView.prototype, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
      writable: true,
    });

    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Long form body</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(0);

    act(() => {
      listeners.get('keyboardDidShow')?.({
        endCoordinates: { height: 300, screenY: 650 },
      });
    });

    expect(focusedInput.measureInWindow).toHaveBeenCalledTimes(1);
    // overlap (780 - 650 = 130) + default 24px margin.
    expect(scrollToSpy).toHaveBeenCalledWith({ animated: false, y: 154 });
  });

  // #588/#631 item 6 — inside a shell layout (header above, tab bar below) the
  // screen's own frame ends short of the window's bottom edge, so
  // `KeyboardAvoidingView`'s own shrink of its frame does not guarantee enough
  // ScrollView range for the last field to clear the keyboard. iOS now
  // reserves the same temporary bottom content-padding safety net Android
  // always has, instead of assuming `KeyboardAvoidingView` alone reserves
  // enough room. This only asserts the padding/offset math, since the actual
  // clamping behavior of a shell-constrained ScrollView needs a real device or
  // simulator to observe (see the report's simulator-proof note).
  it('reserves temporary bottom content space on iOS too, so a shell-constrained screen keeps room to scroll the last field clear', () => {
    Platform.OS = 'ios';
    const listeners = new Map<string, (event?: unknown) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, listener: (event?: unknown) => void) => {
      listeners.set(event, listener);
      return { remove: jest.fn() };
    }) as typeof Keyboard.addListener);

    const focusedInput = createFocusedInputStub((callback) => callback(0, 700, 200, 50));
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focusedInput as never);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const screen = render(
      <KeyboardAwareScreen testID="ka-screen">
        <Text>Body inside a header/tab-bar shell</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(0);

    act(() => {
      listeners.get('keyboardDidShow')?.({
        endCoordinates: { height: 300, screenY: 600 },
      });
    });

    // Keyboard height + default 24px margin, the same safety-net formula
    // Android already relies on — no longer 0 on iOS.
    expect(screen.getByTestId('ka-screen-scroll').props.contentContainerStyle.paddingBottom).toBe(324);

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
