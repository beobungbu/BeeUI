import { cn } from '@beemvp/beeui-core';
import { spacing } from '@beemvp/beeui-tokens';
import * as React from 'react';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  useBottomSheetModalInternal,
  type BottomSheetBackdropProps,
  type BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  View,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, ReduceMotion, useAnimatedStyle } from 'react-native-reanimated';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Button, type ButtonProps } from './button';
import {
  BeeThemeScopeBridge,
  useBeeThemeScopeSnapshot,
  type BeeThemeScopeSnapshot,
} from './theme-scope-bridge';
import {
  ModalOverlayHost,
  OverlayRuntimeBridge,
  useOverlayRuntimeSnapshot,
  type ModalOverlayDismissScope,
} from './overlay-runtime';
import { Text, type TextProps } from './text';
import {
  ToastRuntimeBridge,
  ToastRuntimeLocalViewport,
  useToastRuntimeSnapshot,
  type ToastRuntimeSnapshot,
} from './toast-runtime-bridge';
import {
  EMPTY_SHEET_BRIDGE_CONTEXTS,
  SheetBridgeContextCapture,
  SheetConsumerContextBridge,
  type SheetBridgeContext,
} from './sheet-context-bridge';

/**
 * BeeUI 1.0 Sheet — native implementation (#158, per accepted ADR-006
 * `docs/decisions/006-sheet-gesture-engine.md`).
 *
 * ADR-006 delegates native gesture/spring drag physics, multi-snap-point
 * resolution, nested-scroll gesture arbitration, and keyboard-aware
 * repositioning to the optional `@gorhom/bottom-sheet` adapter (with
 * `react-native-reanimated` + `react-native-gesture-handler` as its own
 * required primitives, plus `react-native-worklets` as Reanimated v4's own
 * required runtime peer — a version-shape fact discovered at implementation
 * time, not a fourth independent BeeUI dependency decision). BeeUI still owns
 * the public API, accessibility contract, and its own dismiss-scope/backdrop
 * semantics on top of it, mirroring `sheet.tsx`'s (#157 skeleton) own
 * `<Modal>` + `ModalOverlayHost` composition with `<BottomSheetModal>` (the
 * real native "portal to top + Android back interception" surface) standing
 * in for RN's `<Modal>`.
 *
 * **Required native root wiring** is owned by BeeUI's public `SheetProvider`.
 * Mount it below `BeeUIProvider`: on native it installs the required
 * `GestureHandlerRootView` + `BottomSheetModalProvider`, so gorhom's portal host
 * is constructed below BeeUI's runtime contexts instead of above them (#619).
 * `SheetProvider` deliberately does not reuse an already-present outer gorhom
 * provider: that topology is the context-loss bug this boundary fixes, so an outer
 * provider is reported as a dev-time misconfiguration while BeeUI still mounts its
 * own inner provider. This is intentionally **not** routed through BeeUI's own
 * `react-native-teleport` transport
 * (`overlay-transport.native.tsx`): `BottomSheetModalProvider` owns its own
 * portal/stacking coordination (`push`/`switch`/`replace` between multiple
 * concurrently-mounted sheets) that BeeUI does not reimplement, matching
 * ADR-006's "no duplicate overlay authority" the other way around — BeeUI
 * does not force its own portal underneath an engine that already ships one.
 *
 * Ownership split preserved exactly like `sheet.tsx`/`sheet.web.tsx`:
 * `ModalOverlayHost` still establishes BeeUI's own iOS accessibility-modal
 * boundary and nested-overlay dismiss-scope (so a Popover opened from inside
 * this Sheet is dismissed before the Sheet itself, matching Dialog's
 * documented precedent), and BeeUI's own custom backdrop/handle visuals
 * replace gorhom's defaults so `overlayClassName`/`overlayProps`/
 * `overlayTestID`/`closeOnBackdropPress`/`handleClassName` behave identically
 * to the other two platform files. Android hardware back is **not**
 * integrated by `@gorhom/bottom-sheet` itself (verified against its own
 * source: no `BackHandler` usage anywhere in the package) — this file wires
 * its own `BackHandler` listener, reusing the exact same nested-scope-first
 * dismiss precedence `sheet.tsx`'s `handleModalRequestClose` already
 * documents for `DialogContent` parity.
 *
 * Known 1.0 visual/limitation notes (native runtime acceptance owed to #160,
 * not claimed here beyond compile/deterministic-test evidence — see
 * `docs/compatibility-matrix.md`):
 * - The drag handle renders through gorhom's own dedicated
 *   `handleComponent` slot (required so the real pan-gesture wiring on the
 *   handle keeps working) rather than as the first child inside the styled
 *   panel `View` the way `sheet.tsx`/`sheet.web.tsx` render `SheetHandle` —
 *   visually similar, structurally distinct from the other two platforms.
 * - `avoidKeyboard` cannot be mapped to a true "off" switch: gorhom's
 *   `keyboardBehavior` enum (`interactive` | `extend` | `fillParent`) has no
 *   "ignore the keyboard" option upstream. `avoidKeyboard === false` maps to
 *   `fillParent` (a materially different, but still keyboard-aware,
 *   behavior) rather than disabling avoidance outright.
 * - A known upstream iOS limitation (gorhom/react-native-bottom-sheet#832):
 *   presenting a `BottomSheetModal` from *inside* an already-presented RN
 *   `<Modal>` (e.g. opening a Sheet from a Dialog) can render behind the
 *   native modal window without a `react-native-screens` `FullWindowOverlay`
 *   `containerComponent`. BeeUI does not add a fourth dependency for this;
 *   the "Sheet opened from another overlay" acceptance scenario should
 *   prefer a BeeUI-native overlay (e.g. Popover) as the opener, and this is
 *   flagged for #160's real-device verification.
 */

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error('Sheet components must be used inside Sheet.');
  return context;
}

type SheetContentAccessibilityContextValue = {
  defaultDescriptionNativeID: string;
  defaultTitleNativeID: string;
  registerDescription: (nativeID?: string, text?: string) => void;
  registerTitle: (nativeID?: string, text?: string) => void;
};

const SheetContentAccessibilityContext =
  React.createContext<SheetContentAccessibilityContextValue | null>(null);

function getPrimitiveText(children: React.ReactNode) {
  const values = React.Children.toArray(children);
  if (!values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    return undefined;
  }
  return values.map(String).join('');
}

type SheetBaseProps = {
  children?: React.ReactNode;
};

type SheetControlledProps = SheetBaseProps & {
  /**
   * Not accepted in the controlled variant, where `open` already owns the state.
   * Pass `defaultOpen` on its own, without `open`, to use the uncontrolled variant.
   */
  defaultOpen?: never;
  /**
   * Applies a requested open state, and is required here because the controlled
   * variant never updates its own visibility. If this does not change `open`,
   * nothing does.
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Current open state, owned by the caller; supplying a defined value alongside
   * `onOpenChange` is what selects the controlled variant. Passing `open` without
   * an `onOpenChange` function warns in development and falls back to uncontrolled
   * behavior.
   */
  open: boolean;
};

type SheetUncontrolledProps = SheetBaseProps & {
  /**
   * Open state to start from, read once when the component mounts, so later changes
   * to it are ignored. Defaults to false; drive visibility with `open` +
   * `onOpenChange` instead when it needs to change.
   */
  defaultOpen?: boolean;
  /**
   * Notified after the open state changes, and optional here because the
   * uncontrolled variant updates its own state either way.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Must be left undefined in the uncontrolled variant, because a defined `open`
   * together with `onOpenChange` selects the controlled variant instead.
   */
  open?: undefined;
};

/** Controlled/uncontrolled root contract, identical shape to `sheet.tsx`/`sheet.web.tsx`. */
export type SheetProps = SheetControlledProps | SheetUncontrolledProps;

export type SheetProviderProps = {
  children?: React.ReactNode;
};

/**
 * Native Sheet integration boundary (#619).
 *
 * This component intentionally mounts its own gorhom modal provider even when
 * an outer one exists. Reusing an outer `BottomSheetModalProvider` would put
 * gorhom's store-backed portal above BeeUI's runtime contexts and recreate the
 * context/z-order bug this boundary exists to prevent.
 */
export function SheetProvider({ children }: SheetProviderProps) {
  const outerModalProvider = useBottomSheetModalInternal(true);
  const warnedOuterProviderRef = React.useRef(false);

  React.useEffect(() => {
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      outerModalProvider &&
      !warnedOuterProviderRef.current
    ) {
      warnedOuterProviderRef.current = true;
      console.error(
        'BeeUI SheetProvider detected an outer @gorhom/bottom-sheet BottomSheetModalProvider. ' +
          'That boundary sits above BeeUI Sheet integration and creates a split modal-provider topology; ' +
          'BeeUI will use its own inner provider for Sheet.',
      );
    }
  }, [outerModalProvider]);

  return (
    <GestureHandlerRootView style={styles.providerRoot}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

SheetProvider.displayName = 'SheetProvider';

export function Sheet(props: SheetProps) {
  const { children, defaultOpen = false, onOpenChange, open } = props;
  const hasOpenProp = open !== undefined;
  const controlled = hasOpenProp && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = React.useState(open ?? defaultOpen);
  const resolvedOpen = controlled && open !== undefined ? open : internalOpen;

  React.useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI Sheet: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
      );
    }
  }, [hasOpenProp, onOpenChange]);

  React.useEffect(() => {
    if (!controlled && hasOpenProp && open !== undefined) {
      setInternalOpen(open);
    }
  }, [controlled, hasOpenProp, open]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!controlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const context = React.useMemo(
    () => ({ open: resolvedOpen, setOpen }),
    [resolvedOpen, setOpen],
  );

  return <SheetContext.Provider value={context}>{children}</SheetContext.Provider>;
}

Sheet.displayName = 'Sheet';

export type SheetTriggerProps = ButtonProps;

export const SheetTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  SheetTriggerProps
>(({ accessibilityState, onPress, ...props }, ref) => {
  const { setOpen } = useSheetContext();

  return (
    <Button
      ref={ref}
      {...props}
      accessibilityState={accessibilityState}
      onPress={(event) => {
        onPress?.(event);
        setOpen(true);
      }}
    />
  );
});

SheetTrigger.displayName = 'SheetTrigger';

/** See `sheet.tsx` for the full contract description — identical on native. */
export type SheetSnapPoint = `${number}%` | number;

const DEFAULT_SHEET_MAX_HEIGHT: SheetSnapPoint = '90%';

function resolveSheetSnapPoints(
  snapPoints: readonly SheetSnapPoint[] | undefined,
): Array<string | number> {
  if (!snapPoints || snapPoints.length === 0) return [DEFAULT_SHEET_MAX_HEIGHT];
  return [...snapPoints];
}

function clampSnapIndex(index: number, snapPointCount: number): number {
  return Math.min(Math.max(index, 0), snapPointCount - 1);
}

/**
 * Reads BeeUI's own ambient reduced-motion signal (`docs/motion.md`'s "read,
 * don't own a second store" contract, same shape ADR-004 established for
 * RTL) and forwards it into `BottomSheetModal`'s own `overrideReduceMotion`
 * seam. This is the first BeeUI native component to read
 * `AccessibilityInfo.isReduceMotionEnabled()` directly; `resolveNativeMotion`
 * is not used here because gorhom's own drag/spring physics — not a
 * BeeUI-authored `Animated.spring`/`Animated.timing` plan — drives the
 * sheet's motion (ADR-006 "Reduced motion — composed, not duplicated").
 */
function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

/**
 * Created once at module scope (mirrors `sheet.web.tsx`'s own
 * `AnimatedPressable` rationale): recreating an animated component type per
 * render would remount it and drop the worklet-driven opacity binding.
 */
const AnimatedBackdropPressable = Animated.createAnimatedComponent(Pressable);

type SheetBackdropState = {
  closeOnBackdropPress: boolean;
  overlayClassName?: string;
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  overlayTestID?: string;
  requestClose: () => void;
};

/**
 * Module-level so `backdropComponent`'s own identity can stay permanently
 * stable across renders (see `SheetContent`'s `backdropStateRef`) — gorhom
 * remounts whatever component reference `backdropComponent` points to, and
 * a stable reference here avoids needlessly restarting the backdrop's
 * worklet-driven opacity binding on every `SheetContent` render.
 */
function SheetBackdrop({
  animatedIndex,
  stateRef,
  style,
}: BottomSheetBackdropProps & { stateRef: React.RefObject<SheetBackdropState> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    // Tied directly to gorhom's own shared position value rather than a
    // second independently-timed animation: the backdrop fade automatically
    // inherits whatever `overrideReduceMotion` already did to the sheet's
    // own motion (instant snap vs. spring), with no separate reduced-motion
    // branch needed here.
    opacity: interpolate(animatedIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <AnimatedBackdropPressable
      {...stateRef.current?.overlayProps}
      accessible={false}
      aria-hidden
      className={cn('bg-overlay', stateRef.current?.overlayClassName)}
      onPress={() => {
        if (stateRef.current?.closeOnBackdropPress) stateRef.current.requestClose();
      }}
      style={[style, animatedStyle]}
      testID={stateRef.current?.overlayTestID}
    />
  );
}

type SheetModalProps = Record<string, unknown>;

export type SheetContentProps = Omit<
  ViewProps,
  'accessibilityRole' | 'accessibilityViewIsModal' | 'role'
> & {
  /**
   * Consumer-owned contexts that must survive gorhom's store-backed portal. BeeUI automatically bridges its own Sheet/safe-area/overlay/toast/theme state; pass app contexts here only for authorities BeeUI cannot enumerate (query, i18n, navigation, app stores).
   */
  bridgeContexts?: readonly SheetBridgeContext[];
  /**
   * Keyboard-interaction contract (#157). Maps to gorhom's own
   * `keyboardBehavior`; see this file's module docblock for the honest
   * "no true off switch" limitation. Defaults to `true`.
   */
  avoidKeyboard?: boolean;
  /** Backdrop dismissal policy. Defaults to `true`, matching `DialogContent`. */
  closeOnBackdropPress?: boolean;
  /**
   * Native `<Modal>` layout-wrapper contract (#157). `BottomSheetModal` has
   * no equivalent single flex/justify wrapper slot to apply this to;
   * accepted for signature parity but intentionally unread here, matching
   * `sheet.web.tsx`'s own "accepted but unread" props.
   */
  containerClassName?: string;
  /** Whether a native request-close (Android Back, swipe-to-dismiss) actually closes the Sheet. */
  dismissOnRequestClose?: boolean;
  /**
   * Swipe/gesture dismissal contract (#157, per ADR-006). Maps directly to
   * gorhom's `enablePanDownToClose` — the real driver of native
   * swipe-to-dismiss physics. Defaults to `true`.
   */
  enableSwipeToDismiss?: boolean;
  /** Applied to the default `SheetHandle` when `showHandle` is true. */
  handleClassName?: string;
  /**
   * Index into `snapPoints` the sheet presents at. Unlike `sheet.tsx`'s
   * static-`maxHeight` skeleton, this drives gorhom's own real interactive
   * `index`/`snapToIndex` resolution.
   */
  initialSnapIndex?: number;
  /**
   * Native `<Modal>` passthrough contract (#157). This file renders no RN
   * `<Modal>` at all (`BottomSheetModal` is its own portal); accepted for
   * signature parity but intentionally unread here, matching
   * `sheet.web.tsx`'s identical divergence for the same field.
   */
  modalProps?: SheetModalProps;
  onRequestClose?: () => void;
  overlayClassName?: string;
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  overlayTestID?: string;
  /** Renders the default drag-handle affordance via gorhom's own handle slot. Defaults to `true`. */
  showHandle?: boolean;
  /** Snap points / presentation sizes. See `sheet.tsx`. */
  snapPoints?: readonly SheetSnapPoint[];
};

function SheetHandleSlot({
  handleClassNameRef,
}: {
  handleClassNameRef: React.RefObject<string | undefined>;
}) {
  return <SheetHandle className={handleClassNameRef.current} />;
}

type SheetPortalContextBridgeProps = {
  bridgeContexts: readonly SheetBridgeContext[];
  bridgeValues: readonly unknown[];
  children?: React.ReactNode;
  frame: ReturnType<typeof useSafeAreaFrame>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  overlayRuntime: ReturnType<typeof useOverlayRuntimeSnapshot>;
  sheetContext: SheetContextValue;
  themeScope: BeeThemeScopeSnapshot;
  toastRuntime: ToastRuntimeSnapshot | null;
};

/**
 * `@gorhom/bottom-sheet`'s modal renders its children through its own
 * store-backed portal, mounted under `BottomSheetModalProvider` — not under
 * `SheetContent`. React context declared below that provider (the `Sheet`
 * root itself, and a `BeeUIProvider` rendered inside the gorhom provider, as
 * the module docblock's required root wiring allows) is therefore invisible
 * to the sheet's content. This re-provides what `SheetContent` captured in
 * place: BeeUI's Sheet/safe-area/overlay/toast/theme state automatically, plus
 * consumer-owned contexts explicitly named in `bridgeContexts`. BeeUI cannot
 * enumerate application authorities such as React Query/i18n/navigation/store
 * contexts, so those opt in through that prop rather than being silently lost.
 */
function SheetPortalContextBridge({
  bridgeContexts,
  bridgeValues,
  children,
  frame,
  insets,
  overlayRuntime,
  sheetContext,
  themeScope,
  toastRuntime,
}: SheetPortalContextBridgeProps) {
  return (
    <SheetConsumerContextBridge bridgeContexts={bridgeContexts} bridgeValues={bridgeValues}>
      <SheetContext.Provider value={sheetContext}>
        <SafeAreaFrameContext.Provider value={frame}>
          <SafeAreaInsetsContext.Provider value={insets}>
            <BeeThemeScopeBridge snapshot={themeScope}>
              <ToastRuntimeBridge snapshot={toastRuntime}>
                <OverlayRuntimeBridge snapshot={overlayRuntime}>{children}</OverlayRuntimeBridge>
              </ToastRuntimeBridge>
            </BeeThemeScopeBridge>
          </SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
      </SheetContext.Provider>
    </SheetConsumerContextBridge>
  );
}

export const SheetContent = React.forwardRef<React.ComponentRef<typeof View>, SheetContentProps>(
  (
    {
      // `containerClassName`/`modalProps` are destructured (never spread onto
      // the rendered `View`) but intentionally unread by this native
      // implementation — see their contract documentation above.
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      avoidKeyboard = true,
      bridgeContexts = EMPTY_SHEET_BRIDGE_CONTEXTS,
      children,
      className,
      closeOnBackdropPress = true,
      containerClassName: _containerClassName,
      dismissOnRequestClose = true,
      enableSwipeToDismiss = true,
      handleClassName,
      initialSnapIndex = 0,
      modalProps: _modalProps,
      onAccessibilityEscape,
      onRequestClose,
      overlayClassName,
      overlayProps,
      overlayTestID,
      showHandle = true,
      snapPoints,
      style,
      ...props
    },
    ref,
  ) => {
    const sheetContext = useSheetContext();
    const { open, setOpen } = sheetContext;
    const insets = useSafeAreaInsets();
    const frame = useSafeAreaFrame();
    const overlayRuntime = useOverlayRuntimeSnapshot();
    const toastRuntime = useToastRuntimeSnapshot();
    const themeScope = useBeeThemeScopeSnapshot();
    const reducedMotion = useReducedMotionPreference();
    const reactID = React.useId().replace(/:/g, '');
    const defaultTitleNativeID = `beeui-sheet-title-${reactID}`;
    const defaultDescriptionNativeID = `beeui-sheet-description-${reactID}`;
    const [titleNativeID, setTitleNativeID] = React.useState<string>();
    const [titleText, setTitleText] = React.useState<string>();
    const [descriptionText, setDescriptionText] = React.useState<string>();

    const sheetRef = React.useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
    const modalDismissScopeRef = React.useRef<ModalOverlayDismissScope | null>(null);
    // Tracks the caller's own last-intended `open` value so `handleDismiss`
    // (gorhom's `onDismiss`, which fires for *every* close reason: our own
    // imperative `dismiss()`, a completed swipe gesture, a backdrop press, or
    // Android back) can tell "we already caused and notified this close" from
    // "gorhom closed itself and BeeUI's own callers still need to hear about
    // it" — without this, an effect-driven `dismiss()` would double-fire
    // `onOpenChange`.
    const openRef = React.useRef(open);
    // Whether BeeUI has presented this modal and gorhom has not yet reported
    // it dismissed. Never dismiss a never-presented modal (#584).
    const presentedRef = React.useRef(false);
    // gorhom exposes one shared, tokenless onDismiss callback. Serialize engine transitions so
    // an old dismissal and a new presentation are never awaiting the same callback at once.
    const dismissInFlightRef = React.useRef(false);

    React.useEffect(() => {
      openRef.current = open;
      if (open) {
        if (!presentedRef.current && !dismissInFlightRef.current) {
          presentedRef.current = true;
          sheetRef.current?.present();
        }
      } else if (presentedRef.current && !dismissInFlightRef.current) {
        dismissInFlightRef.current = true;
        sheetRef.current?.dismiss();
      }
    }, [open]);

    const requestClose = React.useCallback(() => {
      onRequestClose?.();
      if (dismissOnRequestClose) setOpen(false);
    }, [dismissOnRequestClose, onRequestClose, setOpen]);

    const handleDismiss = React.useCallback(() => {
      const completedBeeUIDismiss = dismissInFlightRef.current;
      dismissInFlightRef.current = false;
      presentedRef.current = false;

      if (completedBeeUIDismiss) {
        if (openRef.current) {
          presentedRef.current = true;
          sheetRef.current?.present();
        }
        return;
      }

      if (!openRef.current) return;
      onRequestClose?.();
      if (dismissOnRequestClose) {
        setOpen(false);
      } else {
        presentedRef.current = true;
        sheetRef.current?.present();
      }
    }, [dismissOnRequestClose, onRequestClose, setOpen]);

    // Mirrors `sheet.tsx`'s `handleModalRequestClose` exactly: Android back
    // is child-first inside this modal scope (a nested overlay opened from
    // inside the Sheet dismisses before the Sheet itself), then applies the
    // Sheet's own close policy. `@gorhom/bottom-sheet` does not integrate
    // `BackHandler` itself (verified against its own source), so this file
    // owns the whole back-press contract.
    const handleAndroidBack = React.useCallback(() => {
      onRequestClose?.();
      if (modalDismissScopeRef.current?.dismissTopmostChild('back')) return true;
      if (dismissOnRequestClose) setOpen(false);
      return true;
    }, [dismissOnRequestClose, onRequestClose, setOpen]);

    React.useEffect(() => {
      if (!open || Platform.OS !== 'android') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleAndroidBack);
      return () => subscription.remove();
    }, [handleAndroidBack, open]);

    const registerTitle = React.useCallback((nativeID?: string, text?: string) => {
      setTitleNativeID(nativeID);
      setTitleText(text);
    }, []);
    const registerDescription = React.useCallback((_nativeID?: string, text?: string) => {
      setDescriptionText(text);
    }, []);
    const accessibilityContext = React.useMemo(
      () => ({
        defaultDescriptionNativeID,
        defaultTitleNativeID,
        registerDescription,
        registerTitle,
      }),
      [defaultDescriptionNativeID, defaultTitleNativeID, registerDescription, registerTitle],
    );

    const resolvedSnapPoints = React.useMemo(() => resolveSheetSnapPoints(snapPoints), [snapPoints]);
    const clampedInitialIndex = clampSnapIndex(initialSnapIndex, resolvedSnapPoints.length);

    const backdropStateRef = React.useRef<SheetBackdropState>({
      closeOnBackdropPress,
      overlayClassName,
      overlayProps,
      overlayTestID,
      requestClose,
    });
    backdropStateRef.current = {
      closeOnBackdropPress,
      overlayClassName,
      overlayProps,
      overlayTestID,
      requestClose,
    };
    const backdropComponent = React.useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <SheetBackdrop {...backdropProps} stateRef={backdropStateRef} />
      ),
      [],
    );

    const handleClassNameRef = React.useRef(handleClassName);
    handleClassNameRef.current = handleClassName;
    const handleComponent = React.useCallback(
      (_handleProps: BottomSheetHandleProps) => <SheetHandleSlot handleClassNameRef={handleClassNameRef} />,
      [],
    );

    return (
      <SheetBridgeContextCapture contexts={bridgeContexts}>
        {(bridgeValues) => (
          <BottomSheetModal
        // gorhom's content container defaults to `accessible` with its own
        // "Bottom Sheet" label, which makes iOS fold the whole subtree into
        // that one element: VoiceOver (and XCTest-driven smoke flows) can
        // then reach neither the dialog content below nor its controls.
        // BeeUI's `role="dialog"` content `View` owns the modal semantics,
        // exactly as in `sheet.tsx`.
        accessible={false}
        // Only compile/deterministic-test evidence backs this mapping today
        // (#160 owns real-device keyboard verification) — see the module
        // docblock's "no true off switch" note.
        android_keyboardInputMode="adjustResize"
        backdropComponent={backdropComponent}
        backgroundComponent={null}
        // #584 — gorhom v5's `enableDynamicSizing` defaults to `true`. With
        // an explicit `snapPoints` array (BeeUI always supplies one — see
        // `resolveSheetSnapPoints`'s default below), dynamic sizing instead
        // measures `BottomSheetView`'s own content height to insert as the
        // *first* snap point. `BottomSheetView` below is given `flex: 1`
        // (`styles.contentFill`) with no bounding parent height, which
        // measures to 0 in an unbounded container, producing a zero-height
        // snap point the sheet then targets — explaining the real-device
        // report of `present()` being called with no visible sheet and no
        // `onChange`. `snapPoints` already IS the explicit sizing contract
        // here, so dynamic sizing is off, matching gorhom's own documented
        // recommendation for a fixed/percentage `snapPoints` array. Real
        // on-device confirmation remains an owner gate — see
        // `plans/260918-1559-consumer-audit-fix-all/reports/ws-b-sheet-584.md`.
        enableDismissOnClose
        enableDynamicSizing={false}
        enablePanDownToClose={enableSwipeToDismiss}
        handleComponent={showHandle ? handleComponent : null}
        index={clampedInitialIndex}
        keyboardBehavior={avoidKeyboard === false ? 'fillParent' : 'interactive'}
        keyboardBlurBehavior="restore"
        onDismiss={handleDismiss}
        overrideReduceMotion={reducedMotion ? ReduceMotion.Always : ReduceMotion.Never}
        ref={sheetRef}
        snapPoints={resolvedSnapPoints}
      >
        {/* Everything below is mounted by gorhom's own portal under
            `BottomSheetModalProvider`, not here, so React context from this
            tree stops at this line (#584): re-provide the Sheet root, the
            safe-area metrics, and the overlay runtime so `SheetClose`,
            `useSafeAreaInsets`, and nested BeeUI overlays inside the sheet
            resolve exactly what they would have resolved in place. */}
        <SheetPortalContextBridge
          bridgeContexts={bridgeContexts}
          bridgeValues={bridgeValues}
          frame={frame}
          insets={insets}
          overlayRuntime={overlayRuntime}
          sheetContext={sheetContext}
          themeScope={themeScope}
          toastRuntime={toastRuntime}
        >
          {/* A plain in-flow `flex: 1` View, the same box gorhom's own
              scrollables use, fills the content area gorhom sizes from the
              snap points (keyboard adjustments included). `BottomSheetView`
              is not used: gorhom positions it absolutely and sizes it from its
              children for `enableDynamicSizing`, which BeeUI turns off, so
              under it the content would sit content-sized at the top of a
              transparent sheet instead of filling it. */}
          <View style={styles.contentFill}>
            <ModalOverlayHost active={open} dismissScopeRef={modalDismissScopeRef}>
              <SheetContentAccessibilityContext.Provider value={accessibilityContext}>
                <View
                  ref={ref}
                  {...props}
                  accessibilityHint={accessibilityHint ?? descriptionText}
                  accessibilityLabel={accessibilityLabel ?? titleText}
                  accessibilityLabelledBy={accessibilityLabelledBy ?? titleNativeID}
                  aria-modal
                  className={cn(
                    'w-full flex-1 gap-4 rounded-t-xl border border-border bg-surface px-5',
                    showHandle ? 'pt-2' : 'pt-5',
                    className,
                  )}
                  onAccessibilityEscape={() => {
                    onAccessibilityEscape?.();
                    requestClose();
                  }}
                  role="dialog"
                  // Bottom safe area (ADR-006 "Safe area — reused, not
                  // reinvented"): same additive pattern as `sheet.tsx`.
                  style={[{ paddingBottom: spacing['5'] + insets.bottom }, style]}
                >
                  {children}
                </View>
              </SheetContentAccessibilityContext.Provider>
              <ToastRuntimeLocalViewport active={open} snapshot={toastRuntime} />
            </ModalOverlayHost>
          </View>
        </SheetPortalContextBridge>
          </BottomSheetModal>
        )}
      </SheetBridgeContextCapture>
    );
  },
);

SheetContent.displayName = 'SheetContent';

const styles = {
  contentFill: { flex: 1 },
  providerRoot: { flex: 1 },
} as const;

export type SheetHandleProps = Omit<ViewProps, 'accessibilityRole' | 'role'>;

/**
 * Decorative drag-handle affordance. Rendered through gorhom's own
 * `handleComponent` slot on native (see this file's module docblock) rather
 * than as a plain child the way `sheet.tsx`/`sheet.web.tsx` render it — the
 * real pan-gesture wiring lives in gorhom's `BottomSheetHandleContainer`,
 * which wraps whatever this renders regardless.
 */
export const SheetHandle = React.forwardRef<React.ComponentRef<typeof View>, SheetHandleProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      {...props}
      accessibilityElementsHidden
      aria-hidden
      className={cn('mb-2 h-1.5 w-10 self-center rounded-full bg-border', className)}
      importantForAccessibility="no-hide-descendants"
    />
  ),
);

SheetHandle.displayName = 'SheetHandle';

export type SheetTitleProps = Omit<TextProps, 'accessibilityRole' | 'role' | 'variant'>;

export const SheetTitle = React.forwardRef<React.ComponentRef<typeof Text>, SheetTitleProps>(
  ({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
    const context = React.useContext(SheetContentAccessibilityContext);
    const resolvedNativeID = nativeID ?? context?.defaultTitleNativeID;
    const resolvedText = accessibilityLabel ?? getPrimitiveText(children);

    React.useEffect(() => {
      context?.registerTitle(resolvedNativeID, resolvedText);
      return () => context?.registerTitle(undefined, undefined);
    }, [context, resolvedNativeID, resolvedText]);

    return (
      <Text
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="header"
        className={cn('pe-8', className)}
        nativeID={resolvedNativeID}
        variant="heading"
      >
        {children}
      </Text>
    );
  },
);

SheetTitle.displayName = 'SheetTitle';

export type SheetDescriptionProps = Omit<TextProps, 'tone' | 'variant'>;

export const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  SheetDescriptionProps
>(({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
  const context = React.useContext(SheetContentAccessibilityContext);
  const resolvedNativeID = nativeID ?? context?.defaultDescriptionNativeID;
  const resolvedText = accessibilityLabel ?? getPrimitiveText(children);

  React.useEffect(() => {
    context?.registerDescription(resolvedNativeID, resolvedText);
    return () => context?.registerDescription(undefined, undefined);
  }, [context, resolvedNativeID, resolvedText]);

  return (
    <Text
      ref={ref}
      {...props}
      accessibilityLabel={accessibilityLabel}
      className={className}
      nativeID={resolvedNativeID}
      tone="muted"
      variant="body"
    >
      {children}
    </Text>
  );
});

SheetDescription.displayName = 'SheetDescription';

export type SheetFooterProps = ViewProps & {
  className?: string;
};

export const SheetFooter = React.forwardRef<React.ComponentRef<typeof View>, SheetFooterProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('flex-row flex-wrap items-center justify-end gap-3 pt-1', className)}
      {...props}
    />
  ),
);

SheetFooter.displayName = 'SheetFooter';

export type SheetCloseProps = ButtonProps;

export const SheetClose = React.forwardRef<React.ComponentRef<typeof Pressable>, SheetCloseProps>(
  ({ onPress, ...props }, ref) => {
    const { setOpen } = useSheetContext();

    return (
      <Button
        ref={ref}
        {...props}
        onPress={(event) => {
          onPress?.(event);
          setOpen(false);
        }}
      />
    );
  },
);

SheetClose.displayName = 'SheetClose';
