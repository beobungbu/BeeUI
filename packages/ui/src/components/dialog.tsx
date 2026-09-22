import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  View,
  type ModalProps,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { Button, type ButtonProps } from './button';
import { getWebMutationObserverConstructor, watchDialogOwnerRole } from './dialog-role-watch';
import {
  ModalOverlayHost,
  useOverlayDismissable,
  useOverlayEscapeKey,
  useOverlayId,
  type ModalOverlayDismissScope,
} from './overlay-runtime';
import { Text, type TextProps } from './text';

// #146 — Web-only real Tab focus-trap + initial-focus + focus-restoration for
// DialogContent/AlertDialogContent while open. React Native's core `Modal`
// gives BeeUI accessibility semantics (`aria-modal`, `role="dialog"`) and
// real native platform modal behavior, but on Web it does not itself
// constrain keyboard Tab order to the dialog's own content: without this,
// a sighted keyboard user can Tab past the dialog into background page
// content while it is open, which the R3.8 keyboard/focus acceptance matrix
// (#146, "no focus behind overlays") names explicitly and which a real
// keyboard-driven Playwright test (not a `.focus()` shortcut) confirmed was
// reachable before this change. BeeUI owns this directly on top of the RN
// Modal kernel here, the same way `sheet.web.tsx`'s `useSheetFocusTrap` owns
// an equivalent contract on top of Sheet's own non-Modal Web engine (#159) —
// this is an independent, Dialog-local implementation of that same contract,
// not a shared coupling between the two overlay kernels (mirrors this
// repo's established "duplicate the platform-neutral logic" convention
// documented in `sheet.web.tsx`'s module docblock).
//
// `@beemvp/beeui-ui` targets React Native and excludes the DOM lib, so this reaches
// the DOM through narrow structural types instead of `lib.dom.d.ts`, exactly
// like `use-direction.ts`'s `WebDocumentLike` convention.
type WebFocusableElement = {
  contains: (other: WebFocusableElement | null) => boolean;
  focus: (options?: { preventScroll?: boolean }) => void;
  getAttribute: (name: string) => string | null;
  getClientRects: () => ArrayLike<unknown>;
  hasAttribute: (name: string) => boolean;
  querySelectorAll: (selectors: string) => ArrayLike<WebFocusableElement>;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
};

type WebFocusKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
  shiftKey?: boolean;
  stopPropagation?: () => void;
};

type WebFocusDocument = {
  activeElement: WebFocusableElement | null;
  addEventListener: (
    type: string,
    listener: (event: WebFocusKeyboardEvent) => void,
    useCapture?: boolean,
  ) => void;
  contains: (node: WebFocusableElement | null) => boolean;
  removeEventListener: (
    type: string,
    listener: (event: WebFocusKeyboardEvent) => void,
    useCapture?: boolean,
  ) => void;
};

function getWebFocusDocument(): WebFocusDocument | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis as { document?: WebFocusDocument }).document;
}

const DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getDialogFocusableElements(container: WebFocusableElement): WebFocusableElement[] {
  return Array.from(container.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)).filter(
    (node) => !node.hasAttribute('disabled') && node.getClientRects().length > 0,
  );
}

function useDialogFocusTrap(
  panelRef: React.RefObject<WebFocusableElement | null>,
  open: boolean,
) {
  React.useEffect(() => {
    if (!open) return undefined;
    const doc = getWebFocusDocument();
    if (!doc) return undefined;
    const previouslyFocused = doc.activeElement;
    const panel = panelRef.current;
    let addedTabIndex = false;

    const focusInitialTarget = () => {
      if (!panel) return;
      const [first] = getDialogFocusableElements(panel);
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

    // One JS tick is enough for the Modal's freshly mounted content to be
    // present in the DOM; a plain timeout avoids adding a second Web-only
    // scheduler primitive to this shared cross-platform file.
    const timer = setTimeout(focusInitialTarget, 0);

    const handleKeyDown = (event: WebFocusKeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const focusable = getDialogFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault?.();
        panel.focus({ preventScroll: true });
        return;
      }
      // Every Tab inside the panel is moved by this handler, not just the two
      // that wrap. Handling only the edges left each interior step to the
      // browser's own sequential navigation, which resumes from a starting
      // point that a programmatic `.focus()` does not always update in time:
      // after the wrap focused `last`, the very next Shift+Tab could resume
      // from the pre-wrap position and land somewhere else entirely — and the
      // handler could not correct it, because it inspects focus before the
      // move, never after. Measured on the dialog matrix spec: 3 of 10 local
      // runs and one CI shard failed that second Shift+Tab. Driving every step
      // from this list makes the order the panel's own, not the browser's.
      const active = doc.activeElement;
      const index = active === null ? -1 : focusable.indexOf(active as WebFocusableElement);

      event.preventDefault?.();

      // Focus outside the panel, or on the panel box itself, re-enters at the
      // edge the key came from rather than guessing an interior position.
      if (index === -1) {
        const entry = event.shiftKey ? focusable[focusable.length - 1] : focusable[0];
        entry.focus({ preventScroll: true });
        return;
      }

      const step = event.shiftKey ? -1 : 1;
      const next = (index + step + focusable.length) % focusable.length;
      focusable[next].focus({ preventScroll: true });
    };

    // Capture phase: a focused text Input inside the dialog would otherwise
    // stop a keydown's bubble phase before it reaches a bubble-phase
    // document listener, silently defeating the wrap-around trap.
    doc.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(timer);
      doc.removeEventListener('keydown', handleKeyDown, true);
      if (addedTabIndex) panel?.removeAttribute('tabindex');
      if (previouslyFocused && doc.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}

/**
 * Reads BeeUI's own ambient reduced-motion signal the same "compose, don't
 * own a second store" way `sheet.native.tsx`'s own `useReducedMotionPreference`
 * does (`docs/motion.md`, ADR-006 "Reduced motion — composed, not
 * duplicated") and feeds it into this file's `animationType` default below.
 * `AccessibilityInfo.isReduceMotionEnabled()` is genuinely cross-platform
 * here (unlike Sheet, which needs a Web-specific `matchMedia` variant
 * because it also drives a JS-owned `Animated` interpolation): on Web,
 * `react-native-web` itself implements `isReduceMotionEnabled`/
 * `addEventListener('reduceMotionChanged', ...)` by reading
 * `window.matchMedia('(prefers-reduced-motion: reduce)')`, so one
 * implementation already covers both platforms.
 *
 * This exists because React Native Web's `Modal`/`ModalAnimation` (the
 * engine `animationType` reaches on Web) applies its `fade`/`slide` CSS
 * keyframe unconditionally — it never itself checks `prefers-reduced-motion`
 * — so `DialogContent`/`AlertDialogContent` would otherwise always run a
 * real ~300ms transition regardless of the user's reduced-motion
 * preference. `fade` (the default) has no spatial component, so this was
 * never a "no mandatory spatial animation" violation, but it did not honor
 * the ambient preference either; this closes that gap for the default case.
 * An explicit caller-supplied `modalProps.animationType` always wins
 * (`slide`/`fade`/`none`), matching Sheet's own "explicit override always
 * wins" precedent.
 *
 * Gated on `enabled` (this Dialog's own `open` state): `DialogContent`
 * always mounts regardless of `open` (`Modal`'s own `visible` prop is what
 * actually hides it), so reading/subscribing to the ambient signal
 * unconditionally would query the native accessibility bridge — and, in
 * tests, trigger a post-`act()` state update — for every closed Dialog in
 * the tree, never just the ones actually being shown.
 *
 * On Web the value is additionally read synchronously from `matchMedia` on
 * every render, because the `animationType` it feeds must be right on the
 * very first open render, not one microtask later. `isReduceMotionEnabled()`
 * is a Promise even on Web (react-native-web wraps the same synchronous
 * `matchMedia` read), so before this the first open render always used
 * `fade` and flipped to `none` once the Promise resolved — while the Modal
 * was already visible. react-native-web's `ModalAnimation` only calls its
 * `onShow` callback manually when `visible` *changes* with `animationType`
 * already `'none'`, and otherwise waits for the `animationend` event of the
 * fade keyframe that the flip had just removed — so its internal "active"
 * flag never flipped, and it never wrote `role="dialog"` onto the owner
 * node under `prefers-reduced-motion: reduce` (reproduced in Chromium
 * against the Showcase: `aria-modal`/`aria-labelledby` present, `role`
 * absent, one second after opening). Reading synchronously means the open
 * render already carries the current preference, and a preference change
 * while closed is picked up on reopen without any transient value. A
 * preference toggled *while* a Dialog is open still changes `animationType`
 * mid-presentation, and react-native-web's internal "active" flag then stays
 * unset for that cycle; nothing user-visible depends on it — the owner
 * node's `role` is stamped by `watchDialogOwnerRole` regardless, and this
 * component owns its own Web focus trap and Escape handling.
 * `readWebReducedMotionPreference` returns `undefined` off Web and where
 * `matchMedia` is unavailable (SSR, this repo's Jest harness), which keeps
 * the async native path — and the existing deterministic tests that mock
 * it — unchanged.
 */
function useReducedMotionPreference(enabled: boolean): boolean {
  const [ambientReducedMotion, setAmbientReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setAmbientReducedMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setAmbientReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [enabled]);

  return readWebReducedMotionPreference() ?? ambientReducedMotion;
}

const reducedMotionMediaQuery = '(prefers-reduced-motion: reduce)';

/**
 * Web only: the browser's live `prefers-reduced-motion` value, read
 * synchronously — the same query react-native-web's `AccessibilityInfo`
 * resolves asynchronously. `undefined` off Web or where `matchMedia` is not
 * available, so callers fall back to the async signal there.
 */
function readWebReducedMotionPreference(): boolean | undefined {
  if (Platform.OS !== 'web') return undefined;
  const { matchMedia } = globalThis as {
    matchMedia?: (query: string) => { matches: boolean };
  };
  if (typeof matchMedia !== 'function') return undefined;
  return matchMedia.call(globalThis, reducedMotionMediaQuery).matches;
}

/**
 * Registers this Dialog's own Escape dismissal deterministically, instead of
 * relying on React Native Web's `Modal` internal Escape handling. RNW's
 * `ModalContent` only treats a physical `Escape` `keyup` as a close request
 * once its own internal `isActive` modal-stack flag has flipped true — a
 * flag RNW sets asynchronously via an `onShow` callback fired after the
 * Modal's own entrance bookkeeping, not synchronously with `visible`/mount.
 * Under load (slower CI runners, a busy main thread during the entrance
 * fade), a keyboard user's Escape keypress can land before that internal
 * flip happens; RNW's own listener then silently no-ops on that keypress —
 * this Dialog never closes for it. This mirrors `sheet.web.tsx`'s
 * `SheetEscapeBinding`'s original approach exactly: a BeeUI-owned
 * **capture-phase** `document` `keydown` listener attached synchronously as
 * soon as `open` is true, with the same `isTopmost()` nested-overlay
 * precedence (a `Popover` opened from inside this `Dialog` is dismissed
 * child-first, the `Dialog` stays open). Capture phase also survives a
 * focused text `Input` inside the panel (this showcase's own "Project
 * settings" dialog has one) stopping the bubble phase before a bubble-phase
 * listener would see the event (#318) — the actual capture-phase listener
 * now lives in `overlay-runtime.tsx`'s `useOverlayEscapeKey`, shared with
 * `SheetContent` and `PopoverContent` instead of duplicated per component.
 */
function DialogEscapeBinding({
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

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('Dialog components must be used inside Dialog.');
  return context;
}

type DialogContentAccessibilityContextValue = {
  defaultDescriptionNativeID: string;
  defaultTitleNativeID: string;
  registerDescription: (nativeID?: string, text?: string) => void;
  registerTitle: (nativeID?: string, text?: string) => void;
};

const DialogContentAccessibilityContext =
  React.createContext<DialogContentAccessibilityContextValue | null>(null);

function getPrimitiveText(children: React.ReactNode) {
  const values = React.Children.toArray(children);
  if (!values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    return undefined;
  }
  return values.map(String).join('');
}

type DialogBaseProps = {
  children?: React.ReactNode;
};

type DialogControlledProps = DialogBaseProps & {
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

type DialogUncontrolledProps = DialogBaseProps & {
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

export type DialogProps = DialogControlledProps | DialogUncontrolledProps;

export function Dialog(props: DialogProps) {
  const { children, defaultOpen = false, onOpenChange, open } = props;
  const hasOpenProp = open !== undefined;
  const controlled = hasOpenProp && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = React.useState(open ?? defaultOpen);
  const resolvedOpen = controlled && open !== undefined ? open : internalOpen;

  React.useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI Dialog: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
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

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
}

Dialog.displayName = 'Dialog';

export type DialogTriggerProps = ButtonProps;

export const DialogTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DialogTriggerProps
>(({ accessibilityState, onPress, ...props }, ref) => {
  const { setOpen } = useDialogContext();

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

DialogTrigger.displayName = 'DialogTrigger';

type DialogModalProps = Omit<
  ModalProps,
  'children' | 'onRequestClose' | 'transparent' | 'visible'
>;

export type DialogContentProps = Omit<
  ViewProps,
  'accessibilityRole' | 'accessibilityViewIsModal' | 'role'
> & {
  /** Whether pressing the dimmed backdrop behind the panel closes the dialog. Defaults to true. */
  closeOnBackdropPress?: boolean;
  containerClassName?: string;
  /**
   * Web only: whether a physical `Escape` keypress closes this dialog.
   * Defaults to `true`. Independent from `dismissOnRequestClose`, which
   * governs native request-close sources (Android hardware back, iOS/other
   * native modal dismissal) that do not exist on Web — `AlertDialogContent`
   * sets this `false` to keep its documented "Escape never dismisses"
   * contract regardless of `cancelOnRequestClose`.
   */
  dismissOnEscape?: boolean;
  /** Whether native request-close sources (Android hardware back, iOS/other native modal dismissal, and — on Web — the RN `Modal` internal Escape shim) close the dialog. Defaults to true. `AlertDialogContent` maps this to its `cancelOnRequestClose` prop. */
  dismissOnRequestClose?: boolean;
  /** Forwarded to the underlying React Native `Modal`, minus the props this component already controls (`animationType` and `presentationStyle` may still be overridden here). */
  modalProps?: DialogModalProps;
  /** Called whenever a request-close source fires, before this dialog applies its own `dismissOnRequestClose`/`dismissOnEscape` policy. Does not by itself close the dialog. */
  onRequestClose?: () => void;
  overlayClassName?: string;
  /** Forwarded to the backdrop `Pressable`, excluding `children` and `onPress` which this component owns. */
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  /** `testID` applied to the backdrop `Pressable`, for targeting it in tests. */
  overlayTestID?: string;
  /**
   * @internal Selects this panel's ARIA/accessibility dialog role.
   * `AlertDialogContent` (`alert-dialog.tsx`) passes `'alertdialog'`; every
   * other caller keeps the default `'dialog'`. Not meant as a general-purpose
   * public override — a plain `Dialog` that wants `alertdialog` semantics
   * should render an `AlertDialog` instead.
   */
  role?: 'dialog' | 'alertdialog';
};

export const DialogContent = React.forwardRef<React.ComponentRef<typeof View>, DialogContentProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      children,
      className,
      closeOnBackdropPress = true,
      containerClassName,
      dismissOnEscape = true,
      dismissOnRequestClose = true,
      modalProps,
      onAccessibilityEscape,
      onRequestClose,
      overlayClassName,
      overlayProps,
      overlayTestID,
      role = 'dialog',
      ...props
    },
    ref,
  ) => {
    const { open, setOpen } = useDialogContext();
    const overlayId = useOverlayId('beeui-dialog');
    const panelRef = React.useRef<WebFocusableElement | null>(null);
    useDialogFocusTrap(panelRef, open);
    const setPanelRef = React.useCallback(
      (node: React.ComponentRef<typeof View> | null) => {
        panelRef.current = node as unknown as WebFocusableElement | null;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<React.ComponentRef<typeof View> | null>).current = node;
        }
      },
      [ref],
    );
    const reactID = React.useId().replace(/:/g, '');
    const defaultTitleNativeID = `beeui-dialog-title-${reactID}`;
    const defaultDescriptionNativeID = `beeui-dialog-description-${reactID}`;
    const [titleNativeID, setTitleNativeID] = React.useState<string>();
    const [titleText, setTitleText] = React.useState<string>();
    const [descriptionText, setDescriptionText] = React.useState<string>();
    const reducedMotion = useReducedMotionPreference(open);
    const {
      animationType = reducedMotion ? 'none' : 'fade',
      presentationStyle = 'overFullScreen',
      ...restModalProps
    } = modalProps ?? {};

    const modalDismissScopeRef = React.useRef<ModalOverlayDismissScope | null>(null);

    const requestClose = React.useCallback(() => {
      onRequestClose?.();
      if (dismissOnRequestClose) setOpen(false);
    }, [dismissOnRequestClose, onRequestClose, setOpen]);

    // The deterministic Web Escape path (`DialogEscapeBinding`, below) — kept
    // separate from `requestClose`/`dismissOnRequestClose` (native
    // Android-back / iOS-other-request-close semantics) so `dismissOnEscape`
    // alone controls whether a physical keypress closes this dialog.
    const requestCloseFromEscape = React.useCallback(() => {
      onRequestClose?.();
      if (dismissOnEscape) setOpen(false);
    }, [dismissOnEscape, onRequestClose, setOpen]);

    // Native request-close notification is preserved exactly once. Android Modal
    // suppresses the root BackHandler, so hardware back is child-first inside this
    // modal scope. iOS/other request-close (including sheet swipe dismissal) applies
    // the Dialog close policy directly and is never intercepted by an anchored child.
    const handleModalRequestClose = React.useCallback(() => {
      onRequestClose?.();
      if (Platform.OS === 'android' && modalDismissScopeRef.current?.dismissTopmostChild('back')) {
        return;
      }
      // On Web, React Native Web's `Modal` only ever calls `onRequestClose`
      // from its own internal physical-`Escape`-keyup shim — there is no
      // Android-back or other native request-close source on Web. That shim
      // gates on RNW's own internal, asynchronously-set "active" modal-stack
      // flag (see `DialogEscapeBinding`'s docblock), so this branch is a
      // defense-in-depth fallback, not the primary Escape path; it defers to
      // the same `dismissOnEscape` policy `DialogEscapeBinding` uses rather
      // than `dismissOnRequestClose`, which stays reserved for genuine
      // native request-close semantics.
      if (Platform.OS === 'web') {
        if (dismissOnEscape) setOpen(false);
        return;
      }
      if (dismissOnRequestClose) setOpen(false);
    }, [dismissOnEscape, dismissOnRequestClose, onRequestClose, setOpen]);

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

    // React Native's Fabric Modal maps `transparent=true` directly to
    // UIModalPresentationOverFullScreen on iOS and therefore ignores pageSheet /
    // formSheet. Only overFullScreen is transparent; native non-fullscreen/fullScreen
    // presentations must be non-transparent so the requested presentationStyle is real.
    const transparent = presentationStyle === 'overFullScreen';
    const isWeb = Platform.OS === 'web';
    const resolvedAccessibilityLabel = accessibilityLabel ?? titleText;
    const resolvedAccessibilityLabelledBy = accessibilityLabelledBy ?? titleNativeID;

    const modalOwnerRef = React.useRef<WebFocusableElement | null>(null);
    const setModalOwnerRef = React.useCallback((node: React.ComponentRef<typeof Modal> | null) => {
      modalOwnerRef.current = node as unknown as WebFocusableElement | null;
    }, []);

    // Web only, both roles: BeeUI stamps this dialog's `role` onto the one
    // Modal owner node from the first open commit and keeps it there — see
    // `watchDialogOwnerRole`'s docblock for why the owner's own `role` write
    // cannot be relied on (it hinges on react-native-web's animation
    // bookkeeping and never happens at all when `animationType` changes
    // while visible) and why this needs a `MutationObserver` rather than a
    // prop or a fixed-delay correction.
    React.useEffect(() => {
      if (!isWeb || !open) return undefined;
      const MutationObserverCtor = getWebMutationObserverConstructor();
      const node = modalOwnerRef.current;
      if (!node || !MutationObserverCtor) return undefined;
      return watchDialogOwnerRole(node, role, MutationObserverCtor);
    }, [isWeb, open, role]);

    return (
      <Modal
        {...restModalProps}
        ref={setModalOwnerRef}
        // Web only: react-native-web's own `Modal` (verified against 0.21's
        // `ModalContent` source) unconditionally renders `role="dialog"` +
        // `aria-modal="true"` on its own owner node once open, with no prop this
        // component can pass to opt that wrapper out — the object literal that
        // sets those two attributes is applied after this component's own props
        // are spread, so it always wins. Before this, the panel `View` below
        // ALSO carried `role="dialog"`/`aria-modal`, so an open Dialog produced
        // two nested `role="dialog"` nodes on Web: a strict-mode violation for
        // `page.getByRole('dialog')` without a name filter, and two "entered a
        // dialog" announcements for one screen-reader visit. Forwarding this
        // dialog's own computed label/labelledby to the one Web owner
        // react-native-web insists on rendering — instead of also stamping a
        // second `role="dialog"` on the panel underneath — leaves exactly one
        // labelled dialog node. Native has no such forced wrapper (`Modal`
        // there is an opaque OS-level container with no injected role/label of
        // its own), so the panel keeps owning `role="dialog"` there unchanged.
        // The owner's `role` itself (`'dialog'` or `'alertdialog'`) is
        // stamped by the `MutationObserver` effect above that
        // `ref={setModalOwnerRef}` feeds, not left to react-native-web's own
        // forced write.
        accessibilityLabel={isWeb ? resolvedAccessibilityLabel : undefined}
        accessibilityLabelledBy={isWeb ? resolvedAccessibilityLabelledBy : undefined}
        animationType={animationType}
        onRequestClose={handleModalRequestClose}
        presentationStyle={presentationStyle}
        transparent={transparent}
        visible={open}
      >
        <ModalOverlayHost active={open} dismissScopeRef={modalDismissScopeRef}>
          {/* Web-only: `DialogEscapeBinding` exists solely to beat RNW Modal's
              async Escape-keyup gate (see its docblock). It also registers an
              `isTopmost()` dismissable via `useOverlayDismissable`, which lives
              in this same modal-local dismiss stack that Android hardware-back
              (`dismissTopmostChild`, above) walks to find a REAL nested
              anchored-overlay child. Mounting it unconditionally would add the
              Dialog's own binding as a phantom "child" in that stack — on
              native, dismissTopmostChild('back') could then dismiss it instead
              of a real child (or instead of falling through to the Dialog's own
              close policy), double-firing onRequestClose and corrupting the
              child-first back count. Native has no `document` to bind to
              anyway (a no-op there before this gate), so scoping the mount to
              Web keeps native back-handling byte-for-byte unchanged. */}
          {Platform.OS === 'web' ? (
            <DialogEscapeBinding onDismiss={requestCloseFromEscape} open={open} overlayId={overlayId} />
          ) : null}
          <View
            className={cn(
              'flex-1 items-center justify-center px-4 py-8',
              containerClassName,
            )}
          >
            <Pressable
              {...overlayProps}
              accessible={false}
              aria-hidden
              className={cn('absolute inset-0 bg-overlay', overlayClassName)}
              onPress={() => {
                if (closeOnBackdropPress) requestClose();
              }}
              testID={overlayTestID}
            />
            <DialogContentAccessibilityContext.Provider value={accessibilityContext}>
              <View
                ref={setPanelRef}
                {...props}
                accessibilityHint={accessibilityHint ?? descriptionText}
                // Web: already forwarded to `<Modal>` above, onto the one owner
                // node react-native-web actually renders `role="dialog"` on —
                // see that prop's docblock. Setting it again here would restore
                // the double-labelled/double-dialog nesting this fix removes.
                accessibilityLabel={isWeb ? undefined : resolvedAccessibilityLabel}
                accessibilityLabelledBy={isWeb ? undefined : resolvedAccessibilityLabelledBy}
                // The iOS accessibility modal boundary lives on the
                // ModalOverlayHost wrapper so portalled overlays stay inside
                // it (#60). Do not re-add the flag here: it would prune the
                // portal outlet subtree from the accessibility tree.
                //
                // Never re-added on Web for `alertdialog` either: the one
                // Modal owner react-native-web forces (see `role` below)
                // already carries `aria-modal="true"` unconditionally,
                // regardless of `role`/`active` — adding it here too would
                // reintroduce the exact duplicate-`aria-modal` shape this
                // fix removes, just for the alert-dialog path instead.
                aria-modal={isWeb ? undefined : true}
                className={cn(
                  'w-full max-w-lg gap-4 overflow-hidden rounded-xl border border-border bg-surface p-5',
                  className,
                )}
                onAccessibilityEscape={() => {
                  onAccessibilityEscape?.();
                  requestClose();
                }}
                // Web: the one Modal owner node react-native-web renders
                // (its `role` stamped to this panel's `role` by the
                // `MutationObserver` above) is the sole `role`/`aria-modal`
                // owner for both cases — restating either role here would recreate a
                // two-nodes-same-role shape (the exact bug #607 removed for
                // `dialog`, and would reintroduce it for `alertdialog` too).
                role={isWeb ? undefined : role}
              >
                {children}
              </View>
            </DialogContentAccessibilityContext.Provider>
          </View>
        </ModalOverlayHost>
      </Modal>
    );
  },
);

DialogContent.displayName = 'DialogContent';

export type DialogTitleProps = Omit<TextProps, 'accessibilityRole' | 'role' | 'variant'>;

export const DialogTitle = React.forwardRef<React.ComponentRef<typeof Text>, DialogTitleProps>(
  ({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
    const context = React.useContext(DialogContentAccessibilityContext);
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

DialogTitle.displayName = 'DialogTitle';

export type DialogDescriptionProps = Omit<TextProps, 'tone' | 'variant'>;

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  DialogDescriptionProps
>(({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
  const context = React.useContext(DialogContentAccessibilityContext);
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

DialogDescription.displayName = 'DialogDescription';

export type DialogFooterProps = ViewProps & {
  className?: string;
};

export const DialogFooter = React.forwardRef<React.ComponentRef<typeof View>, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('flex-row flex-wrap items-center justify-end gap-3 pt-1', className)}
      {...props}
    />
  ),
);

DialogFooter.displayName = 'DialogFooter';

export type DialogCloseProps = ButtonProps;

export const DialogClose = React.forwardRef<React.ComponentRef<typeof Pressable>, DialogCloseProps>(
  ({ onPress, ...props }, ref) => {
    const { setOpen } = useDialogContext();

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

DialogClose.displayName = 'DialogClose';
