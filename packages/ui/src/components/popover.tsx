import {
  cn,
  type AnchoredOverlayAlign,
  type AnchoredOverlayCollisionPadding,
  type AnchoredOverlayDirection,
  type AnchoredOverlayPlacement,
} from '@beeui/core';
import * as React from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { Button, type ButtonProps } from './button';
import {
  OverlayDismissLayer,
  OverlayPortal,
  useAnchoredOverlayPosition,
  useOverlayDismissable,
  useOverlayId,
  type OverlayMeasurableNode,
} from './overlay-runtime';
import { Text, type TextProps } from './text';

export type PopoverPlacement = AnchoredOverlayPlacement;
export type PopoverAlign = AnchoredOverlayAlign;
export type PopoverDirection = AnchoredOverlayDirection;
export type PopoverCollisionPadding = AnchoredOverlayCollisionPadding;

type PopoverContextValue = {
  anchorRef: React.RefObject<OverlayMeasurableNode | null>;
  contentNativeID: string;
  open: boolean;
  overlayId: string;
  setOpen: (open: boolean) => void;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('Popover components must be used inside Popover.');
  return context;
}

type PopoverContentAccessibilityContextValue = {
  defaultDescriptionNativeID: string;
  defaultTitleNativeID: string;
  registerDescription: (nativeID?: string, text?: string) => void;
  registerTitle: (nativeID?: string, text?: string) => void;
  setOpen: (open: boolean) => void;
};

const PopoverContentAccessibilityContext =
  React.createContext<PopoverContentAccessibilityContextValue | null>(null);

function getPrimitiveText(children: React.ReactNode) {
  const values = React.Children.toArray(children);
  if (!values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    return undefined;
  }
  return values.map(String).join('');
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

type PopoverBaseProps = {
  children?: React.ReactNode;
};

type PopoverControlledProps = PopoverBaseProps & {
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type PopoverUncontrolledProps = PopoverBaseProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: undefined;
};

export type PopoverProps = PopoverControlledProps | PopoverUncontrolledProps;

export function Popover(props: PopoverProps) {
  const { children, defaultOpen = false, onOpenChange, open } = props;
  const hasOpenProp = open !== undefined;
  const controlled = hasOpenProp && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = React.useState(open ?? defaultOpen);
  const resolvedOpen = controlled && open !== undefined ? open : internalOpen;
  const anchorRef = React.useRef<OverlayMeasurableNode | null>(null);
  const overlayId = useOverlayId('beeui-popover');
  const contentNativeID = `${overlayId}-content`;

  React.useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI Popover: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
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

  const context = React.useMemo<PopoverContextValue>(
    () => ({ anchorRef, contentNativeID, open: resolvedOpen, overlayId, setOpen }),
    [contentNativeID, overlayId, resolvedOpen, setOpen],
  );

  return <PopoverContext.Provider value={context}>{children}</PopoverContext.Provider>;
}

Popover.displayName = 'Popover';

export type PopoverTriggerProps = ButtonProps;

export const PopoverTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PopoverTriggerProps
>(({ accessibilityState, onPress, ...props }, forwardedRef) => {
  const { anchorRef, contentNativeID, open, setOpen } = usePopoverContext();
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
      aria-controls={contentNativeID}
      accessibilityState={{ ...accessibilityState, expanded: open }}
      onPress={(event) => {
        onPress?.(event);
        setOpen(!open);
      }}
    />
  );
});

PopoverTrigger.displayName = 'PopoverTrigger';

export type PopoverContentProps = Omit<
  ViewProps,
  'accessibilityViewIsModal' | 'role'
> & {
  align?: PopoverAlign;
  alignOffset?: number;
  avoidKeyboard?: boolean;
  avoidSafeArea?: boolean;
  closeOnOutsidePress?: boolean;
  collisionPadding?: PopoverCollisionPadding;
  direction?: PopoverDirection;
  flip?: boolean;
  outsidePressProps?: Omit<PressableProps, 'children' | 'onPress' | 'style'>;
  outsidePressTestID?: string;
  placement?: PopoverPlacement;
  shift?: boolean;
  sideOffset?: number;
};

export const PopoverContent = React.forwardRef<React.ComponentRef<typeof View>, PopoverContentProps>(
  (
    {
      accessibilityElementsHidden,
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      'aria-hidden': ariaHidden,
      align = 'center',
      alignOffset = 0,
      avoidKeyboard = false,
      avoidSafeArea = true,
      children,
      className,
      closeOnOutsidePress = true,
      collisionPadding = 8,
      direction = I18nManager.isRTL ? 'rtl' : 'ltr',
      flip = true,
      importantForAccessibility,
      nativeID,
      onAccessibilityEscape,
      onLayout,
      outsidePressProps,
      outsidePressTestID,
      placement = 'bottom',
      shift = true,
      sideOffset = 8,
      style,
      ...props
    },
    ref,
  ) => {
    const { anchorRef, contentNativeID, open, overlayId, setOpen } = usePopoverContext();
    const resolvedNativeID = nativeID ?? contentNativeID;
    const reactID = React.useId().replace(/:/g, '');
    const defaultTitleNativeID = `${overlayId}-title-${reactID}`;
    const defaultDescriptionNativeID = `${overlayId}-description-${reactID}`;
    const [titleNativeID, setTitleNativeID] = React.useState<string>();
    const [titleText, setTitleText] = React.useState<string>();
    const [descriptionText, setDescriptionText] = React.useState<string>();

    const { isTopmost } = useOverlayDismissable({
      onDismiss: () => setOpen(false),
      open,
      overlayId,
    });

    const handleAnchorUnavailable = React.useCallback(() => {
      if (open) setOpen(false);
    }, [open, setOpen]);

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

    const registerTitle = React.useCallback((nextNativeID?: string, text?: string) => {
      setTitleNativeID(nextNativeID);
      setTitleText(text);
    }, []);
    const registerDescription = React.useCallback((_nextNativeID?: string, text?: string) => {
      setDescriptionText(text);
    }, []);
    const accessibilityContext = React.useMemo(
      () => ({
        defaultDescriptionNativeID,
        defaultTitleNativeID,
        registerDescription,
        registerTitle,
        setOpen,
      }),
      [
        defaultDescriptionNativeID,
        defaultTitleNativeID,
        registerDescription,
        registerTitle,
        setOpen,
      ],
    );

    if (!open) return null;

    const resolvedStyle = position
      ? [styles.content, { left: position.x, top: position.y }, style]
      : [styles.content, styles.measuring, style];

    return (
      <OverlayPortal overlayId={overlayId}>
        {closeOnOutsidePress ? (
          <OverlayDismissLayer
            {...outsidePressProps}
            overlayId={overlayId}
            testID={outsidePressTestID}
          />
        ) : null}
        <PopoverContentAccessibilityContext.Provider value={accessibilityContext}>
          <View
            ref={ref}
            {...props}
            accessibilityElementsHidden={position ? accessibilityElementsHidden : true}
            accessibilityHint={accessibilityHint ?? descriptionText}
            accessibilityLabel={accessibilityLabel ?? titleText}
            accessibilityLabelledBy={accessibilityLabelledBy ?? titleNativeID}
            aria-hidden={position ? ariaHidden : true}
            className={cn(
              'min-w-48 max-w-sm gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm',
              className,
            )}
            importantForAccessibility={
              position ? importantForAccessibility : 'no-hide-descendants'
            }
            nativeID={resolvedNativeID}
            onAccessibilityEscape={() => {
              onAccessibilityEscape?.();
              if (isTopmost()) setOpen(false);
            }}
            onLayout={(event) => {
              onOverlayLayout(event);
              onLayout?.(event);
            }}
            pointerEvents={position ? 'auto' : 'none'}
            role="dialog"
            style={resolvedStyle}
          >
            {children}
          </View>
        </PopoverContentAccessibilityContext.Provider>
      </OverlayPortal>
    );
  },
);

PopoverContent.displayName = 'PopoverContent';

export type PopoverTitleProps = Omit<TextProps, 'accessibilityRole' | 'role' | 'variant'>;

export const PopoverTitle = React.forwardRef<React.ComponentRef<typeof Text>, PopoverTitleProps>(
  ({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
    const context = React.useContext(PopoverContentAccessibilityContext);
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
        className={className}
        nativeID={resolvedNativeID}
        variant="heading"
      >
        {children}
      </Text>
    );
  },
);

PopoverTitle.displayName = 'PopoverTitle';

export type PopoverDescriptionProps = Omit<TextProps, 'tone' | 'variant'>;

export const PopoverDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  PopoverDescriptionProps
>(({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
  const context = React.useContext(PopoverContentAccessibilityContext);
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

PopoverDescription.displayName = 'PopoverDescription';

export type PopoverCloseProps = ButtonProps;

export const PopoverClose = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PopoverCloseProps
>(({ onPress, ...props }, ref) => {
  const contentContext = React.useContext(PopoverContentAccessibilityContext);
  const popoverContext = React.useContext(PopoverContext);
  const setOpen = contentContext?.setOpen ?? popoverContext?.setOpen;

  if (!setOpen) throw new Error('Popover components must be used inside Popover.');

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
});

PopoverClose.displayName = 'PopoverClose';

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    zIndex: 1,
  },
  measuring: {
    left: -10000,
    opacity: 0,
    top: -10000,
  },
});
