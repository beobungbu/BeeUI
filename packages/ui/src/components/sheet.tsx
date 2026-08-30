import { cn } from '@beeui/core';
import { spacing } from '@beeui/tokens';
import * as React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  View,
  type ModalProps,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, type ButtonProps } from './button';
import { ModalOverlayHost, type ModalOverlayDismissScope } from './overlay-runtime';
import { Text, type TextProps } from './text';

/**
 * BeeUI 1.0 Sheet public API/contract (#157, per accepted ADR-006
 * `docs/decisions/006-sheet-gesture-engine.md`).
 *
 * This file is the platform-neutral public composition surface plus a minimal,
 * honest cross-platform skeleton: `SheetContent` reuses the exact same
 * `Modal` + `ModalOverlayHost` kernel `DialogContent` already proves on both
 * Web (via `react-native-web`) and native, anchored to the bottom edge instead
 * of centered. It has **no drag-to-dismiss gesture, no interactive snap-point
 * animation, and no Reanimated/Gesture-Handler dependency** — those are #158's
 * job, an internal `sheet.native.tsx` engine swap behind this same public
 * prop/type contract, wrapping the optional `@gorhom/bottom-sheet` adapter
 * ADR-006 selected. Web's own richer implementation (#159) also replaces this
 * skeleton's rendering behind the same contract, reusing
 * `overlay-transport.web.tsx` directly instead of `Modal`.
 *
 * Ownership split (ADR-006 "Ownership split"): every type and every default
 * exported here is 100% BeeUI-owned and is never gorhom's own ref/prop shape.
 * `SheetSnapPoint` is a plain data shape (`"40%"` or a pixel number) that #158
 * translates into gorhom's `snapPoints` prop behind its own internal engine
 * seam; nothing in this file imports or depends on gorhom's types.
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

/** Controlled/uncontrolled root contract, identical shape to `DialogProps`. */
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

/**
 * One snap point / presentation size, expressed either as a percentage of the
 * available viewport height (`"40%"`) or an absolute pixel height (`320`).
 * Contract-only for #157: this skeleton always renders at
 * `snapPoints[initialSnapIndex]` (or a sane default) as a static `maxHeight`
 * and has no interactive drag-to-snap behavior. #158's gorhom adapter drives
 * real interactive multi-snap-point resolution from this exact same array.
 */
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

type SheetModalProps = Omit<
  ModalProps,
  'children' | 'onRequestClose' | 'presentationStyle' | 'transparent' | 'visible'
>;

export type SheetContentProps = Omit<
  ViewProps,
  'accessibilityRole' | 'accessibilityViewIsModal' | 'role'
> & {
  /**
   * Keyboard-interaction contract (#157, per ADR-006). Defaults to `true`.
   * This cross-platform skeleton relies on the platform's own default Modal
   * keyboard behavior and does not itself read this flag; #158 (native) and
   * #159 (Web) drive real, platform-appropriate keyboard avoidance from it —
   * native and Web keyboard interaction are not the same problem per ADR-006
   * and are not expected to share one implementation.
   */
  avoidKeyboard?: boolean;
  /** Backdrop dismissal policy. Defaults to `true`, matching `DialogContent`. */
  closeOnBackdropPress?: boolean;
  containerClassName?: string;
  /** Whether a native request-close (Android Back, iOS swipe) actually closes the Sheet. */
  dismissOnRequestClose?: boolean;
  /**
   * Swipe/gesture dismissal contract (#157, per ADR-006). This cross-platform
   * skeleton has no drag gesture and never reads this value; #158's optional
   * `@gorhom/bottom-sheet` native adapter is the actual driver of real
   * swipe-to-dismiss from this same flag.
   */
  enableSwipeToDismiss?: boolean;
  /** Applied to the default `SheetHandle` when `showHandle` is true. */
  handleClassName?: string;
  /**
   * Index into `snapPoints` the sheet renders at. Contract-only static sizing
   * signal for this skeleton (see {@link SheetSnapPoint}); #158 drives real
   * interactive snapping from the same `snapPoints`/`initialSnapIndex` pair.
   */
  initialSnapIndex?: number;
  modalProps?: SheetModalProps;
  onRequestClose?: () => void;
  overlayClassName?: string;
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  overlayTestID?: string;
  /** Renders the default drag-handle affordance above `children`. Defaults to `true`. */
  showHandle?: boolean;
  /** Snap points / presentation sizes. See {@link SheetSnapPoint}. */
  snapPoints?: readonly SheetSnapPoint[];
};

export const SheetContent = React.forwardRef<React.ComponentRef<typeof View>, SheetContentProps>(
  (
    {
      // `avoidKeyboard`/`enableSwipeToDismiss` are destructured (never spread
      // onto the rendered `View`) but intentionally unread by this
      // cross-platform skeleton — see their contract documentation above.
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
      modalProps,
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
    const insets = useSafeAreaInsets();
    const reactID = React.useId().replace(/:/g, '');
    const defaultTitleNativeID = `beeui-sheet-title-${reactID}`;
    const defaultDescriptionNativeID = `beeui-sheet-description-${reactID}`;
    const [titleNativeID, setTitleNativeID] = React.useState<string>();
    const [titleText, setTitleText] = React.useState<string>();
    const [descriptionText, setDescriptionText] = React.useState<string>();
    const { animationType = 'slide', ...restModalProps } = modalProps ?? {};

    const modalDismissScopeRef = React.useRef<ModalOverlayDismissScope | null>(null);

    const requestClose = React.useCallback(() => {
      onRequestClose?.();
      if (dismissOnRequestClose) setOpen(false);
    }, [dismissOnRequestClose, onRequestClose, setOpen]);

    // Mirrors `DialogContent`'s native request-close handling exactly (#157
    // reuses the proven Dialog kernel rather than a second implementation):
    // Android Modal back is child-first inside this modal scope; iOS/other
    // native request-close (including a future native swipe completion from
    // #158) applies the Sheet close policy directly.
    const handleModalRequestClose = React.useCallback(() => {
      onRequestClose?.();
      if (Platform.OS === 'android' && modalDismissScopeRef.current?.dismissTopmostChild('back')) {
        return;
      }
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

    return (
      <Modal
        {...restModalProps}
        animationType={animationType}
        onRequestClose={handleModalRequestClose}
        presentationStyle="overFullScreen"
        transparent
        visible={open}
      >
        <ModalOverlayHost active={open} dismissScopeRef={modalDismissScopeRef}>
          <View className={cn('flex-1 justify-end', containerClassName)}>
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
            <SheetContentAccessibilityContext.Provider value={accessibilityContext}>
              <View
                ref={ref}
                {...props}
                accessibilityHint={accessibilityHint ?? descriptionText}
                accessibilityLabel={accessibilityLabel ?? titleText}
                accessibilityLabelledBy={accessibilityLabelledBy ?? titleNativeID}
                // Same iOS accessibility-modal-boundary rationale as
                // `DialogContent` (#60): the boundary lives on `ModalOverlayHost`
                // so a portalled child overlay opened from inside the Sheet
                // stays inside it.
                aria-modal
                className={cn(
                  'w-full gap-4 rounded-t-xl border border-border bg-surface px-5 pt-5',
                  className,
                )}
                onAccessibilityEscape={() => {
                  onAccessibilityEscape?.();
                  requestClose();
                }}
                role="dialog"
                // Bottom safe area (ADR-006 "Safe area — reused, not
                // reinvented"): reuses the existing
                // `react-native-safe-area-context` peer dependency additively
                // on top of the base bottom spacing token, rather than a
                // second safe-area mechanism.
                style={[{ maxHeight: presentationHeight, paddingBottom: spacing['5'] + insets.bottom }, style]}
              >
                {showHandle ? <SheetHandle className={handleClassName} /> : null}
                {children}
              </View>
            </SheetContentAccessibilityContext.Provider>
          </View>
        </ModalOverlayHost>
      </Modal>
    );
  },
);

SheetContent.displayName = 'SheetContent';

export type SheetHandleProps = Omit<ViewProps, 'accessibilityRole' | 'role'>;

/**
 * Decorative drag-handle affordance. Purely visual for #157: it carries no
 * gesture responder. #158's native adapter renders gorhom's own interactive
 * handle in its place; this component still exists as the Web/#159 and
 * fallback visual so a consumer's markup does not need to branch by platform.
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
