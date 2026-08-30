import { cn } from '@beeui/core';
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
import {
  ModalOverlayHost,
  useOverlayDismissable,
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
// `@beeui/ui` targets React Native and excludes the DOM lib, so this reaches
// the DOM through narrow structural types instead of `lib.dom.d.ts`, exactly
// like `use-direction.ts`'s `WebDocumentLike` convention.
type WebFocusableElement = {
  contains: (other: WebFocusableElement | null) => boolean;
  focus: (options?: { preventScroll?: boolean }) => void;
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
 */
function useReducedMotionPreference(enabled: boolean): boolean {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [enabled]);

  return reducedMotion;
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
 * `SheetEscapeBinding` exactly: a BeeUI-owned **capture-phase** `document`
 * `keydown` listener attached synchronously as soon as `open` is true, with
 * the same `isTopmost()` nested-overlay precedence (a `Popover` opened from
 * inside this `Dialog` is dismissed child-first, the `Dialog` stays open).
 * Capture phase also survives a focused text `Input` inside the panel (this
 * showcase's own "Project settings" dialog has one) stopping the bubble
 * phase before a bubble-phase listener would see the event.
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
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  React.useEffect(() => {
    if (!open) return undefined;
    const doc = getWebFocusDocument();
    if (!doc) return undefined;

    const handleKeyDown = (event: WebFocusKeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopmost()) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      onDismissRef.current();
    };

    doc.addEventListener('keydown', handleKeyDown, true);
    return () => doc.removeEventListener('keydown', handleKeyDown, true);
  }, [isTopmost, open]);

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
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type DialogUncontrolledProps = DialogBaseProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  dismissOnRequestClose?: boolean;
  modalProps?: DialogModalProps;
  onRequestClose?: () => void;
  overlayClassName?: string;
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  overlayTestID?: string;
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

    return (
      <Modal
        {...restModalProps}
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
                accessibilityLabel={accessibilityLabel ?? titleText}
                accessibilityLabelledBy={accessibilityLabelledBy ?? titleNativeID}
                // The iOS accessibility modal boundary lives on the
                // ModalOverlayHost wrapper so portalled overlays stay inside
                // it (#60). Do not re-add the flag here: it would prune the
                // portal outlet subtree from the accessibility tree.
                aria-modal
                className={cn(
                  'w-full max-w-lg gap-4 rounded-xl border border-border bg-surface p-5',
                  className,
                )}
                onAccessibilityEscape={() => {
                  onAccessibilityEscape?.();
                  requestClose();
                }}
                role="dialog"
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
