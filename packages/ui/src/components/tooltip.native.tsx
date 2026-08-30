import { cn } from '@beeui/core';
import { layer } from '@beeui/tokens';
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

// Native (iOS/Android) behavior for `Tooltip` (#153,
// `docs/decisions/005-tooltip-contract.md`). The composition root, context,
// and open/close delay state machine live in `tooltip-shared.tsx`; this file
// only owns what is genuinely native-specific: long-press + external-keyboard/
// Switch-Control focus as trigger channels (no mouse hover exists), a merged
// `accessibilityHint` as the native accessible-relationship path (there is no
// RN equivalent of `aria-describedby`), and hiding the floating visual bubble
// from the accessibility tree so it never produces a second, redundant
// announcement alongside the merged hint.

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
>(
  (
    { accessibilityHint, onBlur, onFocus, onLongPress, onPress, onPressOut, ...props },
    forwardedRef,
  ) => {
    const { anchorRef, contentText, open, requestClose, requestOpen } = useTooltipContext();
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
        // Native has no `aria-describedby`-equivalent relationship API
        // (ADR-005 "Accessible relationship semantics"). Instead, the
        // resolved tooltip text is merged into the trigger's own
        // `accessibilityHint` unconditionally — independent of whether the
        // visual bubble below has ever mounted — so a VoiceOver/TalkBack user
        // gets the supplementary text every time they land on the trigger,
        // whether or not they ever perform the long-press that reveals it
        // visually. An explicit `accessibilityHint` from the consumer always
        // wins (never silently overwritten).
        accessibilityHint={accessibilityHint ?? contentText}
        onBlur={(event) => {
          onBlur?.(event);
          // External keyboard / Switch Control focus leaving the trigger
          // closes immediately, matching the Web focus channel's contract.
          requestClose(true);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          // External keyboard / Switch Control focus opens immediately, no
          // `openDelay` — same rationale as Web's focus channel.
          requestOpen(true);
        }}
        onLongPress={(event) => {
          onLongPress?.(event);
          // Long-press opens immediately: no additional `openDelay` beyond
          // the platform's own long-press gesture recognition (ADR-005's
          // trigger-events table). A short tap never fires `onLongPress`, so
          // no separate pending/cancel bookkeeping is needed here the way
          // hover requires it on Web.
          requestOpen(true);
        }}
        // TooltipTrigger never toggles open state on press (ADR-005): tapping
        // the trigger is reserved for its own action, Tooltip is strictly
        // additive.
        onPress={onPress}
        onPressOut={(event) => {
          onPressOut?.(event);
          // Release/touch-end after a long-press reveal schedules a close
          // after a fixed reveal window (ADR-005's trigger-events table).
          // Reused as `closeDelay` — the same bounded-window timer the
          // hover-out channel already uses on Web — rather than introducing a
          // second timing concept/prop for a single new channel (`open` guard
          // keeps a bare tap's `onPressOut`, which fires on every press, from
          // scheduling a close for a tooltip that was never opened).
          if (open) requestClose();
        }}
      />
    );
  },
);

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
      onLayout,
      placement = 'top',
      shift = true,
      sideOffset = 8,
      style,
      ...props
    },
    ref,
  ) => {
    const { anchorRef, contentNativeID, open, overlayId, requestClose, setContentText } =
      useTooltipContext();
    const resolvedNativeID = nativeID ?? contentNativeID;
    const primitiveText = getTooltipContentText(children);

    // Registers the resolved text with `TooltipTrigger`'s merged
    // `accessibilityHint` unconditionally (ADR-005) — this effect runs on
    // every render regardless of `open`, since the `if (!open) return null`
    // below only skips producing host nodes, not the hook itself.
    React.useEffect(() => {
      setContentText(primitiveText);
      return () => setContentText(undefined);
    }, [primitiveText, setContentText]);

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

    // Escape (external keyboard) / accessibility-escape (iOS VoiceOver
    // two-finger-Z) dismisses without pointer/focus movement (WCAG 1.4.13
    // "dismissible"), reusing `useOverlayDismissable()` exactly as
    // `PopoverContent` and Web's `TooltipContent` already do. No
    // `OverlayDismissLayer` is registered: Tooltip is never modal and must
    // never capture outside touches (ADR-005).
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

    return (
      <OverlayPortal overlayId={overlayId}>
        <Pressable
          ref={ref}
          {...props}
          // The visual bubble is hidden from the accessibility tree
          // unconditionally (not gated on `position` the way Web gates its
          // `role="tooltip"` surface on mount): the trigger's merged
          // `accessibilityHint` above is the sole native accessibility path
          // for this text (ADR-005's "native-visible vs. accessibility-only
          // policy boundary"). Exposing this floating, untethered view to
          // VoiceOver/TalkBack as well would produce a redundant, confusing
          // second announcement of the same text and an unpredictable extra
          // swipe-navigation stop that appears/disappears as the bubble
          // opens/closes. A consumer may still explicitly override either
          // prop if a concrete need arises.
          accessibilityElementsHidden={accessibilityElementsHidden ?? true}
          aria-hidden={ariaHidden ?? true}
          className={cn(
            'max-w-64 rounded-md border border-border bg-surface px-2.5 py-1.5 shadow-sm',
            className,
          )}
          importantForAccessibility={importantForAccessibility ?? 'no-hide-descendants'}
          nativeID={resolvedNativeID}
          onAccessibilityEscape={() => {
            onAccessibilityEscape?.();
            if (isTopmost()) requestClose(true);
          }}
          onLayout={(event) => {
            onOverlayLayout(event);
            onLayout?.(event);
          }}
          // The bubble must never capture touches (ADR-005: Tooltip must
          // never block interaction with content underneath it) — unlike
          // Web, native has no hover channel to preserve, so there is no
          // reason to ever make it `'auto'`.
          pointerEvents="none"
          style={resolvedStyle}
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
