import { cn } from '@beemvp/beeui-core';
import { layer } from '@beemvp/beeui-tokens';
import * as React from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Button } from './button';
import {
  OverlayPortal,
  useAnchoredOverlayPosition,
  useOverlayDismissable,
} from './overlay-runtime';
import { Text } from './text';
import {
  getTooltipContentText,
  hasInteractiveTooltipChild,
  useTooltipContext,
  type TooltipContentProps,
  type TooltipTriggerProps,
} from './tooltip-shared';
import { resolveDirection } from './use-direction';

export * from './tooltip-shared';

// Web behavior for `Tooltip` (#152, `docs/decisions/005-tooltip-contract.md`). The
// composition root, context, and open/close delay state machine live in
// `tooltip-shared.tsx`; this file only owns what is genuinely Web-specific:
// pointer hover + keyboard focus as trigger channels, `role="tooltip"` +
// `aria-describedby` as the accessible relationship, and no outside-press dismiss
// layer (Tooltip is never modal).

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

// The BeeUI primitives whose presence inside `TooltipContent` violates the
// non-interactive contract (ADR-005 "Interaction / non-interaction constraints").
const INTERACTIVE_TOOLTIP_CHILD_TYPES = new Set<unknown>([Button, Pressable, TextInput]);

export const TooltipTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  TooltipTriggerProps
>(({ onBlur, onFocus, onHoverIn, onHoverOut, onPress, ...props }, forwardedRef) => {
  const { anchorRef, contentNativeID, open, requestClose, requestOpen, cancelPendingOpen } =
    useTooltipContext();
  const setTriggerRef = React.useCallback(
    (node: React.ComponentRef<typeof Pressable> | null) => {
      anchorRef.current = node;
      assignRef(forwardedRef, node);
    },
    [anchorRef, forwardedRef],
  );

  return (
    <Button
      ref={setTriggerRef}
      {...props}
      // `aria-describedby` is a description relationship (ADR-005), never
      // `aria-labelledby`/`aria-controls` — it only resolves once content is
      // actually mounted, exactly like Popover's own accessibility-label gating.
      aria-describedby={open ? contentNativeID : undefined}
      onBlur={(event) => {
        onBlur?.(event);
        requestClose(true);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        requestOpen(true);
      }}
      onHoverIn={(event) => {
        onHoverIn?.(event);
        requestOpen();
      }}
      onHoverOut={(event) => {
        onHoverOut?.(event);
        // Quick enter/leave cancellation: if the pointer left before openDelay
        // committed, cancel the pending open instead of scheduling a close for a
        // tooltip that was never actually shown.
        if (open) requestClose();
        else cancelPendingOpen();
      }}
      // TooltipTrigger never toggles open state on press (ADR-005): tapping the
      // trigger is reserved for its own action, Tooltip is strictly additive.
      onPress={onPress}
    />
  );
});

TooltipTrigger.displayName = 'TooltipTrigger';

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  TooltipContentProps
>(
  (
    {
      accessibilityElementsHidden,
      'aria-hidden': ariaHidden,
      align = 'center',
      alignOffset = 0,
      avoidKeyboard = false,
      avoidSafeArea = true,
      children,
      className,
      collisionPadding = 8,
      direction = resolveDirection(),
      flip = true,
      importantForAccessibility,
      nativeID,
      onAccessibilityEscape,
      onHoverIn,
      onHoverOut,
      onLayout,
      placement = 'top',
      shift = true,
      sideOffset = 8,
      style,
      ...props
    },
    ref,
  ) => {
    const { anchorRef, contentNativeID, open, overlayId, requestClose, cancelPendingClose } =
      useTooltipContext();
    const resolvedNativeID = nativeID ?? contentNativeID;

    React.useEffect(() => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;
      if (hasInteractiveTooltipChild(children, INTERACTIVE_TOOLTIP_CHILD_TYPES)) {
        console.warn(
          'BeeUI TooltipContent: interactive content (Button/Pressable/TextInput) was found ' +
            'inside a Tooltip. Tooltip content must not be focusable or actionable ' +
            '(WAI-ARIA tooltip pattern); use Popover for interactive disclosure content.',
        );
      }
    }, [children]);

    // Escape dismisses without pointer/focus movement (WCAG 1.4.13 "dismissible").
    // No `OverlayDismissLayer` is registered: Tooltip is never modal and must
    // never capture outside presses (ADR-005). `isTopmost` also drives the native
    // accessibility-escape gesture path below, exactly like `PopoverContent`.
    const { isTopmost } = useOverlayDismissable({
      onDismiss: () => requestClose(true),
      open,
      overlayId,
    });

    const handleAnchorUnavailable = React.useCallback(() => {
      if (open) requestClose(true);
    }, [open, requestClose]);

    const { onOverlayLayout, position } = useAnchoredOverlayPosition({
      align,
      alignOffset,
      anchorRef,
      avoidKeyboard,
      avoidSafeArea,
      collisionPadding,
      direction,
      flip,
      onAnchorUnavailable: handleAnchorUnavailable,
      open,
      placement,
      shift,
      sideOffset,
    });

    if (!open) return null;

    const resolvedStyle = position
      ? [styles.content, { left: position.x, top: position.y }, style]
      : [styles.content, styles.measuring, style];
    const primitiveText = getTooltipContentText(children);

    return (
      <OverlayPortal overlayId={overlayId}>
        <Pressable
          ref={ref}
          {...props}
          accessibilityElementsHidden={position ? accessibilityElementsHidden : true}
          aria-hidden={position ? ariaHidden : true}
          className={cn(
            'max-w-64 rounded-md border border-border bg-surface px-2.5 py-1.5 shadow-sm',
            className,
          )}
          importantForAccessibility={position ? importantForAccessibility : 'no-hide-descendants'}
          nativeID={resolvedNativeID}
          onAccessibilityEscape={() => {
            onAccessibilityEscape?.();
            if (isTopmost()) requestClose(true);
          }}
          onHoverIn={(event) => {
            onHoverIn?.(event);
            // Hoverable (WCAG 1.4.13): the pointer travelling from the trigger onto
            // the content itself must not let a pending close fire mid-transit.
            cancelPendingClose();
          }}
          onHoverOut={(event) => {
            onHoverOut?.(event);
            requestClose();
          }}
          onLayout={(event) => {
            onOverlayLayout(event);
            onLayout?.(event);
          }}
          pointerEvents={position ? 'auto' : 'none'}
          role="tooltip"
          style={resolvedStyle}
          // `Pressable` is otherwise a natural Tab stop (default `tabIndex={0}`)
          // — but Tooltip content must never receive focus, natural or
          // programmatic (ADR-005 "no focus transfer into content"). `-1` drops
          // it from the Tab sequence entirely while the description
          // relationship (`aria-describedby`) still reaches it without needing
          // it to ever be a focus target itself.
          tabIndex={-1}
        >
          {primitiveText !== undefined ? <Text tone="muted" variant="caption">{primitiveText}</Text> : children}
        </Pressable>
      </OverlayPortal>
    );
  },
);

TooltipContent.displayName = 'TooltipContent';

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    zIndex: layer.overlay,
  },
  measuring: {
    left: -10000,
    opacity: 0,
    top: -10000,
  },
});
