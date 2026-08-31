import { cn } from '@beemvp/beeui-core';
import { resolveMotion, spacing } from '@beemvp/beeui-tokens';
import { resolveNativeMotion } from '@beemvp/beeui-tokens/motion-runtime';
import * as React from 'react';
import {
  Animated,
  Easing,
  Pressable,
  View,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { Button, type ButtonProps } from './button';
import {
  ModalOverlayHost,
  OverlayPortal,
  useOverlayDismissable,
  useOverlayEscapeKey,
  useOverlayId,
} from './overlay-runtime';
import { Text, type TextProps } from './text';

/**
 * BeeUI 1.0 Sheet — Web implementation (#159, per accepted ADR-006
 * `docs/decisions/006-sheet-gesture-engine.md`).
 *
 * ADR-006 assigns Web its own engine: no `@gorhom/bottom-sheet`, no
 * Reanimated/Gesture-Handler, no drag-to-dismiss gesture parity claim for
 * 1.0. `sheet.tsx` (the #157 skeleton) documents that this file replaces its
 * rendering behind the identical public contract by reusing
 * `overlay-transport.web.tsx`'s `ReactDOM.createPortal` transport directly —
 * `OverlayPortal`/`ModalOverlayHost` from `overlay-runtime.tsx` — instead of
 * React Native's `<Modal>`. `Sheet`/`SheetTrigger`/`SheetTitle`/
 * `SheetDescription`/`SheetFooter`/`SheetClose`/`SheetHandle` need no
 * platform-specific behavior (they are plain state/JSX over `react-native`
 * primitives that `react-native-web` already resolves correctly), but this
 * file still owns full re-implementations of them: platform-file resolution
 * is whole-file (a bundler that picks `sheet.web.tsx` for the `./sheet`
 * specifier never falls back to `sheet.tsx` for the exports this file does
 * not redeclare), and duplicating the platform-neutral context/logic here
 * mirrors this repo's own established `table.tsx`/`table.web.tsx` platform
 * split rather than inventing cross-file private-context coupling.
 *
 * Web platform-specific behavior this file adds on top of the shared
 * contract (see `docs/components.md` "Sheet boundary" for the summary):
 * - Escape and backdrop-press dismissal, real Tab focus-trap while open, and
 *   focus restoration to the previously focused element on close — BeeUI's
 *   own Web overlay primitives, not a second dismiss/focus authority.
 * - `sheet-enter`/`sheet-exit` motion (`docs/motion.md`) drives an
 *   opacity + translateY panel transition via `resolveMotion`/
 *   `resolveNativeMotion` and React Native's built-in `Animated` (already
 *   proven cross-platform by `apps/showcase/theme-inspector/motion-preview.tsx`),
 *   honoring `prefers-reduced-motion` — no Reanimated dependency.
 * - Responsive layout: edge-to-edge bottom sheet below the `medium` (768px)
 *   breakpoint; a centered, inset, fully-rounded panel capped at the
 *   existing `max-w-dialog` (512px) content width at `medium` and above.
 * - No drag-to-dismiss gesture (ADR-006): the decorative handle stays
 *   non-interactive, matching the native skeleton's own current behavior.
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
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type SheetUncontrolledProps = SheetBaseProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: undefined;
};

export type SheetProps = SheetControlledProps | SheetUncontrolledProps;

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

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

/**
 * Animating the backdrop's own opacity requires the animated node to be the
 * absolutely-positioned element itself (not a non-positioned wrapper around
 * it) — an intermediate `Animated.View` with no intrinsic size would collapse
 * to zero height as the containing block for an `absolute inset-0` child.
 * Created once at module scope, matching the standard React Native pattern
 * (recreating an animated component type per render would remount it).
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** See `sheet.tsx` for the full contract description — identical on Web. */
export type SheetSnapPoint = `${number}%` | number;

const DEFAULT_SHEET_MAX_HEIGHT: SheetSnapPoint = '90%';

function resolveSheetPresentationHeight(
  snapPoints: readonly SheetSnapPoint[] | undefined,
  initialSnapIndex: number,
): SheetSnapPoint {
  if (!snapPoints || snapPoints.length === 0) return DEFAULT_SHEET_MAX_HEIGHT;
  const clampedIndex = Math.min(Math.max(initialSnapIndex, 0), snapPoints.length - 1);
  return snapPoints[clampedIndex];
}

export type SheetContentProps = Omit<
  ViewProps,
  'accessibilityRole' | 'accessibilityViewIsModal' | 'role'
> & {
  /**
   * Native keyboard-avoidance contract (#157). Web relies on normal document
   * flow and the browser's own scroll-into-view behavior; this cross-platform
   * prop is accepted for signature parity but intentionally unread here.
   */
  avoidKeyboard?: boolean;
  /** Backdrop dismissal policy. Defaults to `true`, matching `DialogContent`. */
  closeOnBackdropPress?: boolean;
  containerClassName?: string;
  /**
   * Whether any close request (backdrop press, Escape, or `onRequestClose`)
   * actually closes the Sheet, mirroring `sheet.tsx`'s contract exactly.
   * `false` keeps the Sheet open for every implicit dismiss path while still
   * invoking `onRequestClose` — only an explicit `SheetClose` still closes
   * it. Defaults to `true`.
   */
  dismissOnRequestClose?: boolean;
  /**
   * Native swipe/gesture dismissal contract (#157, per ADR-006). Web has no
   * drag-to-dismiss gesture for 1.0 — this prop is accepted for signature
   * parity but intentionally unread here.
   */
  enableSwipeToDismiss?: boolean;
  /** Applied to the default `SheetHandle` when `showHandle` is true. */
  handleClassName?: string;
  /** Index into `snapPoints` the sheet renders at. See `sheet.tsx`. */
  initialSnapIndex?: number;
  /**
   * Native `<Modal>` passthrough contract (#157). Web renders no `<Modal>` at
   * all (see this file's module docblock); accepted for signature parity but
   * intentionally unread here.
   */
  modalProps?: Record<string, unknown>;
  onRequestClose?: () => void;
  overlayClassName?: string;
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  overlayTestID?: string;
  /** Renders the default drag-handle affordance above `children`. Defaults to `true`. */
  showHandle?: boolean;
  /** Snap points / presentation sizes. See `sheet.tsx`. */
  snapPoints?: readonly SheetSnapPoint[];
};

// `packages/ui` excludes the `dom` lib (see `use-direction.ts`'s
// `WebDocumentLike`) — this file is Web-only at runtime (`react-native-web`
// resolves it), so real DOM APIs exist, but TypeScript needs a narrow
// structural shape to check against rather than the full `lib.dom.d.ts`.
// Mirrors `overlay-dismiss-events.web.ts`'s `KeyboardEventLike` convention.
type WebElementLike = {
  contains: (other: WebElementLike | null) => boolean;
  focus: (options?: { preventScroll?: boolean }) => void;
  getClientRects: () => ArrayLike<unknown>;
  hasAttribute: (name: string) => boolean;
  querySelectorAll: (selectors: string) => ArrayLike<WebElementLike>;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
};

type WebKeyboardEventLike = {
  key?: string;
  preventDefault?: () => void;
  shiftKey?: boolean;
  stopPropagation?: () => void;
};

type WebDocumentLike = {
  activeElement: WebElementLike | null;
  addEventListener: (
    type: string,
    listener: (event: WebKeyboardEventLike) => void,
    useCapture?: boolean,
  ) => void;
  contains: (node: WebElementLike | null) => boolean;
  removeEventListener: (
    type: string,
    listener: (event: WebKeyboardEventLike) => void,
    useCapture?: boolean,
  ) => void;
};

type WebMediaQueryListLike = {
  addEventListener: (type: 'change', listener: () => void) => void;
  matches: boolean;
  removeEventListener: (type: 'change', listener: () => void) => void;
};

type WebWindowLike = {
  cancelAnimationFrame: (handle: number) => void;
  matchMedia?: (query: string) => WebMediaQueryListLike;
  requestAnimationFrame: (callback: () => void) => number;
};

function getWebDocument(): WebDocumentLike | undefined {
  return (globalThis as { document?: WebDocumentLike }).document;
}

/** `globalThis` is `window` in a browser and needs no `dom` lib to name. */
function getWebWindow(): WebWindowLike | undefined {
  return globalThis as unknown as WebWindowLike;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getFocusableElements(container: WebElementLike): WebElementLike[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (node) => !node.hasAttribute('disabled') && node.getClientRects().length > 0,
  );
}

/**
 * Real Tab focus-trap + focus-restoration while the panel is open. BeeUI owns
 * this directly (ADR-006 "no second modal state engine") instead of relying
 * on any per-platform `<Modal>` behavior, since this file deliberately does
 * not render one. Registers no global state — it reads/writes the DOM focus
 * position only for the lifetime of `open`.
 */
function useSheetFocusTrap(panelRef: React.RefObject<WebElementLike | null>, open: boolean) {
  React.useEffect(() => {
    if (!open) return undefined;
    const doc = getWebDocument();
    const win = getWebWindow();
    if (!doc || !win) return undefined;
    const previouslyFocused = doc.activeElement;
    const panel = panelRef.current;
    let addedTabIndex = false;

    const focusInitialTarget = () => {
      if (!panel) return;
      const [first] = getFocusableElements(panel);
      if (first) {
        first.focus({ preventScroll: true });
        return;
      }
      if (!panel.hasAttribute('tabindex')) {
        panel.setAttribute('tabindex', '-1');
        addedTabIndex = true;
      }
      panel.focus({ preventScroll: true });
    };

    // Defer one frame so the panel has finished mounting/laying out before a
    // focus move is attempted.
    const raf = win.requestAnimationFrame(focusInitialTarget);

    const handleKeyDown = (event: WebKeyboardEventLike) => {
      if (event.key !== 'Tab' || !panel) return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault?.();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = doc.activeElement;
      const activeInsidePanel = active !== null && panel.contains(active);

      if (event.shiftKey) {
        if (!activeInsidePanel || active === first) {
          event.preventDefault?.();
          last.focus({ preventScroll: true });
        }
      } else if (!activeInsidePanel || active === last) {
        event.preventDefault?.();
        first.focus({ preventScroll: true });
      }
    };

    // Capture phase, matching `SheetEscapeBinding`'s Escape listener: a
    // focused text `Input` inside the panel stops a keydown's bubble phase
    // before it would reach a bubble-phase document listener, which would
    // silently defeat the wrap-around trap on every other Tab/Shift+Tab
    // press. Capture fires before that.
    doc.addEventListener('keydown', handleKeyDown, true);

    return () => {
      win.cancelAnimationFrame(raf);
      doc.removeEventListener('keydown', handleKeyDown, true);
      if (addedTabIndex) panel?.removeAttribute('tabindex');
      if (previouslyFocused && doc.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}

function useReducedMotionPreference(): boolean {
  const getSnapshot = React.useCallback(() => {
    const win = getWebWindow();
    if (!win?.matchMedia) return false;
    return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  const [reducedMotion, setReducedMotion] = React.useState(getSnapshot);

  React.useEffect(() => {
    const win = getWebWindow();
    if (!win?.matchMedia) return undefined;
    const query = win.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReducedMotion(query.matches);
    listener();
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reducedMotion;
}

type SheetMotionIntent = 'sheet-enter' | 'sheet-exit';

function playSheetMotion(
  value: Animated.Value,
  intent: SheetMotionIntent,
  toValue: 0 | 1,
  reducedMotion: boolean,
  onDone?: (finished: boolean) => void,
) {
  const plan = resolveNativeMotion(intent, { reducedMotion });
  if (plan.type === 'immediate') {
    value.setValue(toValue);
    onDone?.(true);
    return { stop: () => undefined };
  }
  const animation =
    plan.type === 'spring'
      ? Animated.spring(value, {
          toValue,
          stiffness: plan.stiffness,
          damping: plan.damping,
          mass: plan.mass,
          useNativeDriver: true,
        })
      : Animated.timing(value, {
          toValue,
          duration: plan.durationMs,
          easing: Easing.bezier(...plan.easing),
          useNativeDriver: true,
        });
  animation.start((result) => onDone?.(result.finished));
  return animation;
}

/**
 * Registers this Sheet's own Escape dismissal into its own modal scope (see
 * this file's module docblock). Rendered as a genuine descendant of
 * `ModalOverlayHost`'s scope provider so `useOverlayDismissable` resolves the
 * Sheet's own scope rather than its parent's — a nested overlay opened from
 * inside the Sheet (e.g. a `Popover`) registers into the same scope and is
 * dismissed first by BeeUI's existing LIFO dismiss stack, matching Dialog's
 * documented nested-overlay Escape precedence exactly.
 *
 * Also attaches its own **capture-phase** `document` Escape listener via the
 * shared `useOverlayEscapeKey` (`overlay-runtime.tsx`, #318). BeeUI's shared
 * cross-overlay Escape bridge (`overlay-dismiss-events.web.ts`) listens in
 * the bubble phase at the window; a focused text `Input` inside the panel (a
 * common Sheet content shape — search/filter forms) stops that event's
 * propagation before it bubbles that far, silently swallowing Escape.
 * Capture fires on the way down, before the focused element's own
 * bubble-phase handling runs, so it reaches this listener regardless. The
 * `isTopmost()` guard preserves the exact same nested-overlay precedence:
 * this only actually dismisses the Sheet when nothing registered later in
 * its own scope (e.g. a nested Popover) should be dismissed first.
 */
function SheetEscapeBinding({
  onDismiss,
  open,
  overlayId,
}: {
  onDismiss: () => void;
  open: boolean;
  overlayId: string;
}) {
  const { isTopmost } = useOverlayDismissable({ onDismiss, open, overlayId });
  useOverlayEscapeKey({ isTopmost, onDismiss, open });
  return null;
}

export const SheetContent = React.forwardRef<React.ComponentRef<typeof View>, SheetContentProps>(
  (
    {
      // `avoidKeyboard`/`enableSwipeToDismiss`/`modalProps` are destructured
      // (never spread onto the rendered `View`) but intentionally unread by
      // this Web implementation — see their contract documentation above.
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      avoidKeyboard: _avoidKeyboard,
      children,
      className,
      closeOnBackdropPress = true,
      containerClassName,
      dismissOnRequestClose = true,
      enableSwipeToDismiss: _enableSwipeToDismiss,
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
    const { open, setOpen } = useSheetContext();
    const overlayId = useOverlayId('beeui-sheet');
    const reactID = React.useId().replace(/:/g, '');
    const defaultTitleNativeID = `beeui-sheet-title-${reactID}`;
    const defaultDescriptionNativeID = `beeui-sheet-description-${reactID}`;
    const [titleNativeID, setTitleNativeID] = React.useState<string>();
    const [titleText, setTitleText] = React.useState<string>();
    const [descriptionText, setDescriptionText] = React.useState<string>();
    const panelRef = React.useRef<WebElementLike | null>(null);
    const setPanelRef = React.useCallback(
      (node: React.ComponentRef<typeof View> | null) => {
        // On react-native-web a host View ref is the underlying DOM element
        // (see `overlay-transport.web.tsx`), which the focus trap needs directly.
        panelRef.current = (node as unknown as WebElementLike) ?? null;
        assignRef(ref, node);
      },
      [ref],
    );

    const reducedMotion = useReducedMotionPreference();
    const progress = React.useRef(new Animated.Value(open ? 1 : 0)).current;
    const [mounted, setMounted] = React.useState(open);
    const hasOpenedRef = React.useRef(open);

    React.useEffect(() => {
      if (open) {
        hasOpenedRef.current = true;
        setMounted(true);
        const animation = playSheetMotion(progress, 'sheet-enter', 1, reducedMotion);
        return () => animation.stop();
      }
      if (!hasOpenedRef.current) return undefined;
      const animation = playSheetMotion(progress, 'sheet-exit', 0, reducedMotion, (finished) => {
        if (finished) setMounted(false);
      });
      return () => animation.stop();
      // `progress` is a stable Animated.Value ref; excluding it keeps this
      // effect keyed on the two inputs that actually change its behavior.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, reducedMotion]);

    // Gated on `mounted`, not just `open`: `open` flips true one render
    // before `mounted` does (the animation effect above sets it), so gating
    // on `open` alone would run the trap's initial-focus move against a
    // `panelRef.current` that is still null (the panel has not rendered
    // yet). Gating on `open` still restores focus immediately on dismissal
    // (rather than waiting for the exit animation to finish unmounting).
    useSheetFocusTrap(panelRef, open && mounted);

    const requestClose = React.useCallback(() => {
      onRequestClose?.();
      if (dismissOnRequestClose) setOpen(false);
    }, [dismissOnRequestClose, onRequestClose, setOpen]);

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

    const presentationHeight = React.useMemo(
      () => resolveSheetPresentationHeight(snapPoints, initialSnapIndex),
      [snapPoints, initialSnapIndex],
    );

    if (!mounted) return null;

    const spatial = resolveMotion('sheet-enter', { reducedMotion }).spatial;
    const translateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: spatial ? [spacing['6'], 0] : [0, 0],
    });

    return (
      <OverlayPortal overlayId={overlayId}>
        <ModalOverlayHost active={open}>
          <SheetEscapeBinding onDismiss={requestClose} open={open} overlayId={overlayId} />
          <View
            className={cn('flex-1 justify-end', containerClassName)}
            pointerEvents={open ? 'box-none' : 'none'}
          >
            <AnimatedPressable
              {...overlayProps}
              accessible={false}
              aria-hidden
              className={cn('absolute inset-0 bg-overlay', overlayClassName)}
              onPress={() => {
                if (closeOnBackdropPress) requestClose();
              }}
              pointerEvents={open ? 'auto' : 'none'}
              style={{ opacity: progress }}
              testID={overlayTestID}
            />
            <SheetContentAccessibilityContext.Provider value={accessibilityContext}>
              <Animated.View
                style={{
                  opacity: progress,
                  transform: [{ translateY }],
                }}
              >
                <View
                  ref={setPanelRef}
                  {...props}
                  accessibilityHint={accessibilityHint ?? descriptionText}
                  accessibilityLabel={accessibilityLabel ?? titleText}
                  accessibilityLabelledBy={accessibilityLabelledBy ?? titleNativeID}
                  aria-modal
                  className={cn(
                    'w-full gap-4 rounded-t-xl border border-border bg-surface px-5 pt-5',
                    'md:mx-auto md:mb-6 md:w-full md:max-w-dialog md:rounded-b-xl',
                    className,
                  )}
                  onAccessibilityEscape={() => {
                    onAccessibilityEscape?.();
                    requestClose();
                  }}
                  pointerEvents={open ? 'auto' : 'none'}
                  role="dialog"
                  // No bottom safe-area inset is added here (unlike the native
                  // skeleton): `DialogContent` sets no Web precedent for it
                  // either, and `react-native-safe-area-context` reports zero
                  // insets on most Web targets. Base spacing only for 1.0.
                  style={[{ maxHeight: presentationHeight, paddingBottom: spacing['5'] }, style]}
                >
                  {showHandle ? <SheetHandle className={handleClassName} /> : null}
                  {children}
                </View>
              </Animated.View>
            </SheetContentAccessibilityContext.Provider>
          </View>
        </ModalOverlayHost>
      </OverlayPortal>
    );
  },
);

SheetContent.displayName = 'SheetContent';

export type SheetHandleProps = Omit<ViewProps, 'accessibilityRole' | 'role'>;

/** Decorative only on Web too (ADR-006: no drag-to-dismiss gesture parity for 1.0). */
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
