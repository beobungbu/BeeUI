import type {
  AnchoredOverlayAlign,
  AnchoredOverlayCollisionPadding,
  AnchoredOverlayDirection,
  AnchoredOverlayPlacement,
} from '@beeui/core';
import * as React from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import type { ButtonProps } from './button';
import { useOverlayId, type OverlayMeasurableNode } from './overlay-runtime';

// Shared, platform-agnostic Tooltip kernel (ADR-005, `docs/decisions/005-tooltip-contract.md`).
//
// This module intentionally holds everything that does NOT differ between Web and
// native: the composition root (`Tooltip`), its context, its controlled/uncontrolled
// state, and the open/close delay state machine. `TooltipTrigger`/`TooltipContent`
// differ per platform (hover+`role="tooltip"`/`aria-describedby` on Web vs.
// long-press+merged `accessibilityHint` on native, #153) and live in
// `tooltip.web.tsx` (and, later, `tooltip.native.tsx`), each re-exporting this
// module so `import ... from './tooltip'` resolves to one coherent public shape
// regardless of platform. Named `-shared` (not `tooltip.tsx`) so a platform file's
// own `export * from './tooltip-shared'` cannot be shadowed by Metro's
// platform-extension resolution re-matching that platform file itself.

export type TooltipPlacement = AnchoredOverlayPlacement;
export type TooltipAlign = AnchoredOverlayAlign;
export type TooltipDirection = AnchoredOverlayDirection;
export type TooltipCollisionPadding = AnchoredOverlayCollisionPadding;

type TooltipContextValue = {
  anchorRef: React.RefObject<OverlayMeasurableNode | null>;
  contentNativeID: string;
  open: boolean;
  overlayId: string;
  /** Hover/focus request an open. `immediate` skips `openDelay` (focus channel). */
  requestOpen: (immediate?: boolean) => void;
  /** Hover-out/blur/Escape request a close. `immediate` skips `closeDelay`. */
  requestClose: (immediate?: boolean) => void;
  /** Cancels a pending (not-yet-committed) open — quick enter/leave cancellation. */
  cancelPendingOpen: () => void;
  /** Cancels a pending close — the hoverable requirement (pointer travels onto content). */
  cancelPendingClose: () => void;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

export function useTooltipContext(): TooltipContextValue {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error('Tooltip components must be used inside Tooltip.');
  return context;
}

type TooltipBaseProps = {
  children?: React.ReactNode;
  /**
   * Hover-only open delay in milliseconds (default **500**, ADR-005). Never applies
   * to the focus channel, which always opens immediately.
   */
  openDelay?: number;
  /**
   * Hover-out-only close delay in milliseconds (default **300**, ADR-005) — lets a
   * pointer travel from the trigger onto `TooltipContent` without closing mid-transit
   * (WCAG 1.4.13 "hoverable"). Never applies to blur, which always closes immediately.
   */
  closeDelay?: number;
};

type TooltipControlledProps = TooltipBaseProps & {
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type TooltipUncontrolledProps = TooltipBaseProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: undefined;
};

export type TooltipProps = TooltipControlledProps | TooltipUncontrolledProps;

const DEFAULT_OPEN_DELAY = 500;
const DEFAULT_CLOSE_DELAY = 300;

export function Tooltip(props: TooltipProps) {
  const {
    children,
    closeDelay = DEFAULT_CLOSE_DELAY,
    defaultOpen = false,
    onOpenChange,
    open,
    openDelay = DEFAULT_OPEN_DELAY,
  } = props;
  const hasOpenProp = open !== undefined;
  const controlled = hasOpenProp && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = React.useState(open ?? defaultOpen);
  const resolvedOpen = controlled && open !== undefined ? open : internalOpen;
  const overlayId = useOverlayId('beeui-tooltip');
  const contentNativeID = `${overlayId}-content`;
  const anchorRef = React.useRef<OverlayMeasurableNode | null>(null);

  React.useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI Tooltip: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
      );
    }
  }, [hasOpenProp, onOpenChange]);

  React.useEffect(() => {
    if (!controlled && hasOpenProp && open !== undefined) setInternalOpen(open);
  }, [controlled, hasOpenProp, open]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!controlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const openRef = React.useRef(resolvedOpen);
  openRef.current = resolvedOpen;
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = React.useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearCloseTimer, clearOpenTimer],
  );

  const requestOpen = React.useCallback(
    (immediate = false) => {
      // A newer open intent always wins over a previously scheduled close (the
      // hoverable/re-entry path): once we know we're opening, any pending close
      // for this same tooltip no longer applies.
      clearCloseTimer();
      if (openRef.current) {
        // Already open (e.g. focus arriving while a hover-out close was pending,
        // or a redundant hover-in while already open): nothing left to schedule.
        clearOpenTimer();
        return;
      }
      if (immediate || openDelay <= 0) {
        clearOpenTimer();
        setOpen(true);
        return;
      }
      if (openTimerRef.current !== null) return; // already pending
      openTimerRef.current = setTimeout(() => {
        openTimerRef.current = null;
        setOpen(true);
      }, openDelay);
    },
    [clearCloseTimer, clearOpenTimer, openDelay, setOpen],
  );

  const requestClose = React.useCallback(
    (immediate = false) => {
      clearOpenTimer();
      if (!openRef.current) {
        // Already closed (or never opened, e.g. cancelled before openDelay
        // elapsed): nothing left to schedule.
        clearCloseTimer();
        return;
      }
      if (immediate || closeDelay <= 0) {
        clearCloseTimer();
        setOpen(false);
        return;
      }
      if (closeTimerRef.current !== null) return; // already pending
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setOpen(false);
      }, closeDelay);
    },
    [clearOpenTimer, closeDelay, setOpen],
  );

  const cancelPendingOpen = React.useCallback(() => {
    clearOpenTimer();
  }, [clearOpenTimer]);

  const cancelPendingClose = React.useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const context = React.useMemo<TooltipContextValue>(
    () => ({
      anchorRef,
      cancelPendingClose,
      cancelPendingOpen,
      contentNativeID,
      open: resolvedOpen,
      overlayId,
      requestClose,
      requestOpen,
    }),
    [
      cancelPendingClose,
      cancelPendingOpen,
      contentNativeID,
      overlayId,
      requestClose,
      requestOpen,
      resolvedOpen,
    ],
  );

  return <TooltipContext.Provider value={context}>{children}</TooltipContext.Provider>;
}

Tooltip.displayName = 'Tooltip';

// Shared prop shapes so `tooltip.web.tsx`/`tooltip.native.tsx` implement one
// coherent public API instead of two independently-drifting sibling types.
export type TooltipTriggerProps = ButtonProps;

// Rendered as `Pressable` (not `View`) on Web so it can participate in the
// hoverable requirement (`onHoverIn`/`onHoverOut`) — PressableProps is a superset
// of ViewProps, so this stays a strict widening of Popover's `View`-based content
// prop shape, not a behavioral divergence. `children`/`style` are re-narrowed to
// plain (non-function) values: Tooltip content never needs Pressable's
// per-press-state render props, only its hover event surface.
export type TooltipContentProps = Omit<
  PressableProps,
  'accessibilityViewIsModal' | 'role' | 'children' | 'style'
> & {
  align?: TooltipAlign;
  alignOffset?: number;
  avoidKeyboard?: boolean;
  avoidSafeArea?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  collisionPadding?: TooltipCollisionPadding;
  direction?: TooltipDirection;
  flip?: boolean;
  placement?: TooltipPlacement;
  shift?: boolean;
  sideOffset?: number;
};

/**
 * True when `children` renders any element BeeUI already ships as a
 * focusable/actionable primitive (`Button`, `Pressable`, `TextInput`). Interactive
 * content structurally violates the non-interactive Tooltip contract (ADR-005);
 * BeeUI never strips or blocks it, this only powers a `__DEV__` warning.
 */
export function hasInteractiveTooltipChild(
  children: React.ReactNode,
  interactiveTypes: ReadonlySet<unknown>,
): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement(child)) return false;
    if (interactiveTypes.has(child.type)) return true;
    const childProps = child.props as { children?: React.ReactNode } | null;
    return childProps ? hasInteractiveTooltipChild(childProps.children, interactiveTypes) : false;
  });
}
