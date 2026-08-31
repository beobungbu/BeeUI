import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  UIManager,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { SafeArea } from './safe-area';

// Extra space kept between the focused input's bottom edge and the top of
// the keyboard once scrolled into view on Android.
const DEFAULT_KEYBOARD_SCROLL_MARGIN = 24;

const CONTENT_WIDTH_CLASSES = {
  sm: 'max-w-[440px]',
  md: 'max-w-[680px]',
  lg: 'max-w-[960px]',
  full: 'max-w-none',
} as const;

export type KeyboardAwareScreenContentWidth = keyof typeof CONTENT_WIDTH_CLASSES;
export type KeyboardAwareScreenKeyboardDismissMode = NonNullable<ScrollViewProps['keyboardDismissMode']>;
export type KeyboardAwareScreenSafeAreaEdges = NonNullable<React.ComponentProps<typeof SafeArea>['edges']>;

export type KeyboardAwareScreenProps = {
  /** Screen content. Composed inside the bounded, scrollable, keyboard-avoiding body. */
  children: React.ReactNode;
  className?: string;
  /**
   * Bounded max-width applied to the scrollable content so long-line forms stay
   * readable on wide/tablet/web viewports. Defaults to `'full'` (no bound) —
   * opt into a narrower measure for form-style screens.
   */
  contentWidth?: KeyboardAwareScreenContentWidth;
  /**
   * Gap kept between the focused input and the keyboard once scrolled into
   * view on Android. Defaults to 24.
   */
  keyboardScrollMargin?: number;
  /**
   * Maps to the underlying `ScrollView`'s `keyboardDismissMode`. Defaults to
   * `'interactive'` on iOS and `'on-drag'` elsewhere so drag-to-dismiss stays
   * effective on Android, where React Native treats `interactive` like `none`.
   */
  keyboardDismissMode?: KeyboardAwareScreenKeyboardDismissMode;
  /**
   * Maps to the underlying `ScrollView`'s `keyboardShouldPersistTaps`.
   * Defaults to `'handled'` so taps on interactive children (buttons, links)
   * inside the scroll body do not require a second tap after the keyboard
   * has focus.
   */
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  /**
   * Safe-area edges this screen owns. Left unset by default: a screen
   * composed under a header/tab-bar shell that already owns safe-area
   * insets should not also apply them here (double-inset). Pass the edges
   * this screen actually touches (e.g. `['top', 'bottom']`) when it owns
   * the full window.
   */
  safeAreaEdges?: KeyboardAwareScreenSafeAreaEdges;
  testID?: string;
};

type KeyboardAdjustment = {
  field: number;
  keyboardTop: number;
};

/**
 * Resolves whichever input currently has focus and scrolls it above the
 * software keyboard on Android.
 *
 * Expo's `edgeToEdgeEnabled` config (and, as of Android 16, the platform
 * itself) disables the native `adjustResize` window behavior, so the window
 * never shrinks for the soft keyboard and `KeyboardAvoidingView` has nothing
 * to react to on Android. Android's own "scroll the focused view into
 * sight" only runs once, at focus time, before the keyboard exists to
 * account for. This hook re-scrolls explicitly once the keyboard's real
 * on-screen position is known, via `keyboardDidShow`.
 *
 * Android also needs temporary bottom content space while the keyboard is
 * visible. Without it, a short form can have no remaining ScrollView range,
 * so a mathematically-correct `scrollTo` request is clamped before the final
 * field clears an overlaid keyboard. The keyboard height plus requested margin
 * becomes temporary content padding and is removed on `keyboardDidHide`.
 *
 * While the keyboard remains visible, focus can move from one input to
 * another without another `keyboardDidShow`. React Native focus events bubble,
 * so the ScrollView also re-measures the newly focused native TextInput on
 * descendant focus. The last field/keyboard-top pair is remembered to suppress
 * duplicate keyboard events without blocking a legitimate A -> B focus move.
 *
 * iOS is unaffected (`KeyboardAvoidingView behavior="padding"` already
 * handles it) — the listener is not attached there. Web has no software
 * keyboard event stream and is skipped the same way, so this degrades to a
 * plain scroll view with no runtime cost.
 *
 * This dynamic path intentionally targets native-`TextInput`-backed fields
 * (BeeUI's `Input`, `Textarea`, `PasswordInput`, `OTPInput`, `SearchInput` all
 * qualify). A custom text-entry widget that does not mount a real `TextInput`
 * is outside this component's focus-resolution contract.
 */
function useScrollFocusedInputAboveKeyboard(
  scrollRef: React.RefObject<React.ComponentRef<typeof ScrollView> | null>,
  margin: number,
) {
  const scrollOffsetRef = React.useRef(0);
  const keyboardTopRef = React.useRef<number | null>(null);
  const lastAdjustmentRef = React.useRef<KeyboardAdjustment | null>(null);
  const [keyboardInset, setKeyboardInset] = React.useState(0);

  const adjustFocusedField = React.useCallback(
    (keyboardTop: number) => {
      const scrollNode = scrollRef.current;
      const focusedField = TextInput.State.currentlyFocusedField();
      if (!scrollNode || focusedField == null) {
        return;
      }

      const lastAdjustment = lastAdjustmentRef.current;
      if (
        lastAdjustment?.field === focusedField &&
        Math.abs(lastAdjustment.keyboardTop - keyboardTop) < 1
      ) {
        return;
      }

      UIManager.measureInWindow(focusedField, (_x, y, _width, height) => {
        // Mark the pair as observed even when no scroll is needed. A repeated
        // keyboardDidShow for the same settled geometry should not stack another
        // correction; a different field or keyboard top remains eligible.
        lastAdjustmentRef.current = { field: focusedField, keyboardTop };

        const inputBottom = y + height;
        const overlap = inputBottom - keyboardTop;
        if (overlap <= 0) {
          return;
        }

        // Instant, not animated: the measurement and the logical scroll offset
        // stay aligned, avoiding double-counting while the keyboard settles.
        scrollNode.scrollTo({
          animated: false,
          y: scrollOffsetRef.current + overlap + margin,
        });
      });
    },
    [margin, scrollRef],
  );

  React.useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      keyboardTopRef.current = keyboardTop;
      setKeyboardInset(Math.max(0, event.endCoordinates.height + margin));

      // Apply the temporary scroll range before measuring/scrolling. On a short
      // form this prevents the native ScrollView from clamping the requested
      // correction to an old, too-small maximum content offset.
      requestAnimationFrame(() => adjustFocusedField(keyboardTop));
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      lastAdjustmentRef.current = null;
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [adjustFocusedField, margin]);

  const onFocus = React.useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    // On the first focus the keyboard may not have emitted `keyboardDidShow`
    // yet; that event will perform the correction. For A -> B focus moves while
    // it is already visible, cached/official metrics let us correct immediately.
    const keyboardTop = keyboardTopRef.current ?? Keyboard.metrics()?.screenY;
    if (keyboardTop == null) {
      return;
    }

    // Let TextInput.State settle to the descendant that produced this bubbled
    // focus event before resolving the current native field handle.
    requestAnimationFrame(() => adjustFocusedField(keyboardTop));
  }, [adjustFocusedField]);

  const onScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { keyboardInset, onFocus, onScroll, scrollEventThrottle: 16 as const };
}

/**
 * Reusable keyboard-aware form-screen shell (closes #43): a scrollable body
 * that coordinates keyboard avoidance, keyboard dismissal/tap behavior,
 * bounded content width, and explicit safe-area ownership around arbitrary
 * children.
 *
 * - iOS: native `KeyboardAvoidingView behavior="padding"`.
 * - Android: the native window never resizes for the keyboard once
 *   `edgeToEdgeEnabled` is on, so the focused field is scrolled above the
 *   keyboard explicitly — see `useScrollFocusedInputAboveKeyboard` above.
 * - Web / no software keyboard: both mechanisms are inert, so this renders
 *   as a plain bounded `ScrollView`.
 *
 * This does not own routing, forms, or auth — it only composes the
 * scroll/keyboard/width/safe-area shell around whatever screen content is
 * passed as `children`.
 */
export function KeyboardAwareScreen({
  children,
  className,
  contentWidth = 'full',
  keyboardDismissMode,
  keyboardScrollMargin = DEFAULT_KEYBOARD_SCROLL_MARGIN,
  keyboardShouldPersistTaps = 'handled',
  safeAreaEdges,
  testID,
}: KeyboardAwareScreenProps) {
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { keyboardInset, ...keyboardHandlers } = useScrollFocusedInputAboveKeyboard(
    scrollRef,
    keyboardScrollMargin,
  );
  const resolvedKeyboardDismissMode =
    keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');

  const body = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardInset }}
        keyboardDismissMode={resolvedKeyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        ref={scrollRef}
        testID={testID ? `${testID}-scroll` : undefined}
        {...keyboardHandlers}
      >
        <View
          className={cn('mx-auto w-full flex-1', CONTENT_WIDTH_CLASSES[contentWidth])}
          testID={testID ? `${testID}-content` : undefined}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View className={cn('flex-1 bg-background', className)} testID={testID}>
      {safeAreaEdges ? (
        <SafeArea
          className="flex-1"
          edges={safeAreaEdges}
          testID={testID ? `${testID}-safe-area` : undefined}
        >
          {body}
        </SafeArea>
      ) : (
        body
      )}
    </View>
  );
}

KeyboardAwareScreen.displayName = 'KeyboardAwareScreen';
