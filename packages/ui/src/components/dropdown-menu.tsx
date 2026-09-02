import {
  cn,
  type AnchoredOverlayAlign,
  type AnchoredOverlayCollisionPadding,
  type AnchoredOverlayDirection,
  type AnchoredOverlayPlacement,
} from '@beemvp/beeui-core';
import { layer } from '@beemvp/beeui-tokens';
import * as React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { Button, type ButtonProps } from './button';
import { resolveDirection } from './use-direction';
import {
  OverlayDismissLayer,
  OverlayPortal,
  useAnchoredOverlayPosition,
  useOverlayDismissable,
  useOverlayId,
  type OverlayMeasurableNode,
} from './overlay-runtime';
import { Text, type TextProps } from './text';

export type DropdownMenuPlacement = AnchoredOverlayPlacement;
export type DropdownMenuAlign = AnchoredOverlayAlign;
export type DropdownMenuDirection = AnchoredOverlayDirection;
export type DropdownMenuCollisionPadding = AnchoredOverlayCollisionPadding;

type DropdownMenuRootContextValue = {
  anchorRef: React.RefObject<OverlayMeasurableNode | null>;
  contentNativeID: string;
  open: boolean;
  overlayId: string;
  setOpen: (open: boolean) => void;
};

const DropdownMenuRootContext = React.createContext<DropdownMenuRootContextValue | null>(null);

function useDropdownMenuRootContext() {
  const context = React.useContext(DropdownMenuRootContext);
  if (!context) throw new Error('DropdownMenu components must be used inside DropdownMenu.');
  return context;
}

type MenuFocusableNode = React.ComponentRef<typeof Pressable> & {
  focus?: () => void;
};

type MenuItemRegistration = {
  activate: () => void;
  disabled: boolean;
  focus: () => void;
  id: string;
};

type DropdownMenuItemsContextValue = {
  currentItemId: string | null;
  registerItem: (item: MenuItemRegistration) => void;
  setCurrentItem: (id: string) => void;
  unregisterItem: (id: string) => void;
};

const DropdownMenuItemsContext = React.createContext<DropdownMenuItemsContextValue | null>(null);

type DropdownMenuRadioGroupContextValue = {
  duplicateValues: ReadonlySet<string>;
  onValueChange?: (value: string) => void;
  registerValue: (value: string) => () => void;
  value?: string;
};

const DropdownMenuRadioGroupContext =
  React.createContext<DropdownMenuRadioGroupContextValue | null>(null);

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

function renderMenuChildren(children: React.ReactNode, textClassName?: string) {
  return React.Children.toArray(children).map((child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text key={`dropdown-menu-label-${index}`} className={textClassName} variant="body">
          {child}
        </Text>
      );
    }
    return child;
  });
}

type DropdownMenuBaseProps = {
  children?: React.ReactNode;
};

type DropdownMenuControlledProps = DropdownMenuBaseProps & {
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type DropdownMenuUncontrolledProps = DropdownMenuBaseProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: undefined;
};

export type DropdownMenuProps = DropdownMenuControlledProps | DropdownMenuUncontrolledProps;

export function DropdownMenu(props: DropdownMenuProps) {
  const { children, defaultOpen = false, onOpenChange, open } = props;
  const hasOpenProp = open !== undefined;
  const controlled = hasOpenProp && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = React.useState(open ?? defaultOpen);
  const resolvedOpen = controlled && open !== undefined ? open : internalOpen;
  const anchorRef = React.useRef<OverlayMeasurableNode | null>(null);
  const overlayId = useOverlayId('beeui-dropdown-menu');
  const contentNativeID = `${overlayId}-content`;

  React.useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI DropdownMenu: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
      );
    }
  }, [hasOpenProp, onOpenChange]);

  React.useEffect(() => {
    if (!controlled && hasOpenProp && open !== undefined) setInternalOpen(open);
  }, [controlled, hasOpenProp, open]);

  // #146 — focus-restoration contract: mirrors `select.tsx`'s identical
  // `focusTrigger`/`previousOpenRef` effect. `DropdownMenuContent` now moves
  // real DOM focus onto the roving-tabindex current item while open (see
  // that file's own #146 comment); closing (Escape, outside press, item
  // selection) then unmounts that focused item, which the browser would
  // otherwise resolve by moving focus to `document.body` instead of back to
  // the trigger that opened the menu.
  const focusTrigger = React.useCallback(() => {
    if (Platform.OS === 'web') (anchorRef.current as MenuFocusableNode | null)?.focus?.();
  }, []);

  const previousOpenRef = React.useRef(resolvedOpen);
  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = resolvedOpen;
    if (wasOpen && !resolvedOpen) focusTrigger();
  }, [focusTrigger, resolvedOpen]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!controlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const context = React.useMemo<DropdownMenuRootContextValue>(
    () => ({ anchorRef, contentNativeID, open: resolvedOpen, overlayId, setOpen }),
    [contentNativeID, overlayId, resolvedOpen, setOpen],
  );

  return (
    <DropdownMenuRootContext.Provider value={context}>
      {children}
    </DropdownMenuRootContext.Provider>
  );
}

DropdownMenu.displayName = 'DropdownMenu';

export type DropdownMenuTriggerProps = ButtonProps;

export const DropdownMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DropdownMenuTriggerProps
>(({ accessibilityState, onPress, ...props }, forwardedRef) => {
  const { anchorRef, contentNativeID, open, setOpen } = useDropdownMenuRootContext();
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
      aria-controls={open ? contentNativeID : undefined}
      accessibilityState={{ ...accessibilityState, expanded: open }}
      onPress={(event) => {
        onPress?.(event);
        setOpen(!open);
      }}
    />
  );
});

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

type WebKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
};

export type DropdownMenuContentProps = Omit<ViewProps, 'role'> & {
  align?: DropdownMenuAlign;
  alignOffset?: number;
  avoidKeyboard?: boolean;
  avoidSafeArea?: boolean;
  closeOnOutsidePress?: boolean;
  collisionPadding?: DropdownMenuCollisionPadding;
  direction?: DropdownMenuDirection;
  flip?: boolean;
  outsidePressProps?: Omit<PressableProps, 'children' | 'onPress' | 'style'>;
  outsidePressTestID?: string;
  placement?: DropdownMenuPlacement;
  shift?: boolean;
  sideOffset?: number;
};

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof View>,
  DropdownMenuContentProps
>(
  (
    {
      accessibilityElementsHidden,
      'aria-hidden': ariaHidden,
      align = 'start',
      alignOffset = 0,
      avoidKeyboard = false,
      avoidSafeArea = true,
      children,
      className,
      closeOnOutsidePress = true,
      collisionPadding = 8,
      direction = resolveDirection(),
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
    const rootContext = useDropdownMenuRootContext();
    const { anchorRef, contentNativeID, open, overlayId, setOpen } = rootContext;
    const [items, setItems] = React.useState<MenuItemRegistration[]>([]);
    const [currentItemId, setCurrentItemId] = React.useState<string | null>(null);
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

    const registerItem = React.useCallback((item: MenuItemRegistration) => {
      setItems((current) => {
        const index = current.findIndex((entry) => entry.id === item.id);
        if (index < 0) return [...current, item];
        return current.map((entry) => (entry.id === item.id ? item : entry));
      });
    }, []);

    const unregisterItem = React.useCallback((id: string) => {
      setItems((current) => current.filter((entry) => entry.id !== id));
      setCurrentItemId((current) => (current === id ? null : current));
    }, []);

    React.useEffect(() => {
      if (!open) {
        setCurrentItemId(null);
        return;
      }
      setCurrentItemId((current) => {
        if (current && items.some((item) => item.id === current && !item.disabled)) return current;
        return items.find((item) => !item.disabled)?.id ?? null;
      });
    }, [items, open]);

    // #146 — real Web keyboard reachability: without moving actual DOM focus
    // onto the roving-tabindex "current" item, a keyboard user who Tabs to
    // the trigger and opens the menu has no way to reach it at all (Tab from
    // the trigger continues into the rest of the page; the container's own
    // ArrowDown/ArrowUp `onKeyDown` never fires because it is not an
    // ancestor of whatever remains focused). Mirrors `select.tsx`'s
    // identical, already-shipped `orderedItems.find(...).focus()` effect for
    // the same roving-tabindex contract.
    React.useEffect(() => {
      if (!open || Platform.OS !== 'web' || !currentItemId) return;
      items.find((item) => item.id === currentItemId)?.focus();
    }, [currentItemId, items, open]);

    const setCurrentItem = React.useCallback(
      (id: string) => {
        const target = items.find((item) => item.id === id && !item.disabled);
        if (!target) return;
        setCurrentItemId(id);
      },
      [items],
    );

    const focusItem = React.useCallback((item: MenuItemRegistration | undefined) => {
      if (!item || item.disabled) return;
      setCurrentItemId(item.id);
      item.focus();
    }, []);

    const moveCurrent = React.useCallback(
      (delta: 1 | -1) => {
        const enabled = items.filter((item) => !item.disabled);
        if (!enabled.length) return;
        const currentIndex = enabled.findIndex((item) => item.id === currentItemId);
        const baseIndex = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
        const nextIndex = (baseIndex + delta + enabled.length) % enabled.length;
        focusItem(enabled[nextIndex]);
      },
      [currentItemId, focusItem, items],
    );

    const activateCurrent = React.useCallback(() => {
      const current = items.find((item) => item.id === currentItemId && !item.disabled);
      current?.activate();
    }, [currentItemId, items]);

    const handleWebKeyDown = React.useCallback(
      (event: WebKeyboardEvent) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault?.();
            moveCurrent(1);
            break;
          case 'ArrowUp':
            event.preventDefault?.();
            moveCurrent(-1);
            break;
          case 'Home':
            event.preventDefault?.();
            focusItem(items.find((item) => !item.disabled));
            break;
          case 'End':
            event.preventDefault?.();
            focusItem([...items].reverse().find((item) => !item.disabled));
            break;
          case 'Enter':
          case ' ':
            event.preventDefault?.();
            activateCurrent();
            break;
          default:
            break;
        }
      },
      [activateCurrent, focusItem, items, moveCurrent],
    );

    const itemsContext = React.useMemo<DropdownMenuItemsContextValue>(
      () => ({ currentItemId, registerItem, setCurrentItem, unregisterItem }),
      [currentItemId, registerItem, setCurrentItem, unregisterItem],
    );

    if (!open) return null;

    const resolvedStyle = position
      ? [styles.content, { left: position.x, top: position.y }, style]
      : [styles.content, styles.measuring, style];
    const webKeyboardProps =
      Platform.OS === 'web'
        ? ({ onKeyDown: handleWebKeyDown } as unknown as ViewProps)
        : ({} as ViewProps);

    return (
      <OverlayPortal overlayId={overlayId}>
        <DropdownMenuRootContext.Provider value={rootContext}>
          {closeOnOutsidePress ? (
            <OverlayDismissLayer
              {...outsidePressProps}
              overlayId={overlayId}
              testID={outsidePressTestID}
            />
          ) : null}
          <DropdownMenuItemsContext.Provider value={itemsContext}>
            <View
              ref={ref}
              {...props}
              {...webKeyboardProps}
              accessibilityElementsHidden={position ? accessibilityElementsHidden : true}
              aria-hidden={position ? ariaHidden : true}
              className={cn(
                'min-w-48 max-w-sm rounded-lg border border-border bg-surface p-1 shadow-sm',
                className,
              )}
              importantForAccessibility={
                position ? importantForAccessibility : 'no-hide-descendants'
              }
              nativeID={nativeID ?? contentNativeID}
              onAccessibilityEscape={() => {
                onAccessibilityEscape?.();
                if (isTopmost()) setOpen(false);
              }}
              onLayout={(event) => {
                onOverlayLayout(event);
                onLayout?.(event);
              }}
              pointerEvents={position ? 'auto' : 'none'}
              role="menu"
              style={resolvedStyle}
            >
              {children}
            </View>
          </DropdownMenuItemsContext.Provider>
        </DropdownMenuRootContext.Provider>
      </OverlayPortal>
    );
  },
);

DropdownMenuContent.displayName = 'DropdownMenuContent';

type DropdownMenuItemBaseProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'onPress' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  closeOnSelect?: boolean;
  onPress?: PressableProps['onPress'];
  onSelect?: () => void;
  textClassName?: string;
};

function useRegisteredMenuItem({
  activate,
  disabled,
  forwardedRef,
}: {
  activate: () => void;
  disabled: boolean;
  forwardedRef: React.ForwardedRef<React.ComponentRef<typeof Pressable>>;
}) {
  const context = React.useContext(DropdownMenuItemsContext);
  if (!context) throw new Error('DropdownMenu items must be used inside DropdownMenuContent.');
  const { currentItemId, registerItem, setCurrentItem, unregisterItem } = context;
  const id = useOverlayId('beeui-dropdown-menu-item');
  const internalRef = React.useRef<MenuFocusableNode | null>(null);
  const activateRef = React.useRef(activate);
  activateRef.current = activate;

  const setRef = React.useCallback(
    (node: React.ComponentRef<typeof Pressable> | null) => {
      internalRef.current = node as MenuFocusableNode | null;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  React.useEffect(() => {
    registerItem({
      id,
      disabled,
      activate: () => activateRef.current(),
      focus: () => internalRef.current?.focus?.(),
    });
  }, [disabled, id, registerItem]);

  React.useEffect(() => () => unregisterItem(id), [id, unregisterItem]);

  return {
    current: currentItemId === id,
    id,
    setCurrent: () => setCurrentItem(id),
    setRef,
  };
}

export type DropdownMenuItemProps = DropdownMenuItemBaseProps;

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DropdownMenuItemProps
>(
  (
    {
      accessibilityState,
      children,
      className,
      closeOnSelect = true,
      disabled = false,
      onFocus,
      onHoverIn,
      onPress,
      onSelect,
      textClassName,
      ...props
    },
    ref,
  ) => {
    const { setOpen } = useDropdownMenuRootContext();
    const isDisabled = disabled === true;
    const activate = React.useCallback(() => {
      if (isDisabled) return;
      onSelect?.();
      if (closeOnSelect) setOpen(false);
    }, [closeOnSelect, isDisabled, onSelect, setOpen]);
    const registration = useRegisteredMenuItem({
      activate,
      disabled: isDisabled,
      forwardedRef: ref,
    });

    return (
      <Pressable
        ref={registration.setRef}
        {...props}
        accessibilityRole="menuitem"
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        className={cn(
          'min-h-10 flex-row items-center gap-2 rounded-md px-3 py-2 active:bg-muted web:hover:bg-surface-muted web:focus-visible:bee-focus-ring',
          registration.current && 'bg-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onFocus={(event) => {
          registration.setCurrent();
          onFocus?.(event);
        }}
        onHoverIn={(event) => {
          registration.setCurrent();
          onHoverIn?.(event);
        }}
        onPress={(event) => {
          if (isDisabled) return;
          onPress?.(event);
          onSelect?.();
          if (closeOnSelect) setOpen(false);
        }}
        role="menuitem"
        tabIndex={registration.current ? 0 : -1}
      >
        {renderMenuChildren(children, cn('text-foreground', textClassName))}
      </Pressable>
    );
  },
);

DropdownMenuItem.displayName = 'DropdownMenuItem';

export type DropdownMenuCheckboxItemProps = Omit<
  DropdownMenuItemBaseProps,
  'closeOnSelect' | 'onSelect'
> & {
  checked: boolean;
  closeOnSelect?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DropdownMenuCheckboxItemProps
>(
  (
    {
      accessibilityState,
      checked,
      children,
      className,
      closeOnSelect = false,
      disabled = false,
      onCheckedChange,
      onFocus,
      onHoverIn,
      onPress,
      textClassName,
      ...props
    },
    ref,
  ) => {
    const { setOpen } = useDropdownMenuRootContext();
    const isDisabled = disabled === true;
    const toggle = React.useCallback(() => {
      if (isDisabled) return;
      onCheckedChange?.(!checked);
      if (closeOnSelect) setOpen(false);
    }, [checked, closeOnSelect, isDisabled, onCheckedChange, setOpen]);
    const registration = useRegisteredMenuItem({
      activate: toggle,
      disabled: isDisabled,
      forwardedRef: ref,
    });

    React.useEffect(() => {
      if (
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        !isDisabled &&
        typeof onCheckedChange !== 'function'
      ) {
        console.warn(
          'BeeUI DropdownMenuCheckboxItem: enabled controlled usage requires `onCheckedChange`.',
        );
      }
    }, [isDisabled, onCheckedChange]);

    return (
      <Pressable
        ref={registration.setRef}
        {...props}
        accessibilityRole="menuitem"
        accessibilityState={{ ...accessibilityState, checked, disabled: isDisabled }}
        className={cn(
          'min-h-10 flex-row items-center gap-2 rounded-md px-3 py-2 active:bg-muted web:hover:bg-surface-muted web:focus-visible:bee-focus-ring',
          registration.current && 'bg-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onFocus={(event) => {
          registration.setCurrent();
          onFocus?.(event);
        }}
        onHoverIn={(event) => {
          registration.setCurrent();
          onHoverIn?.(event);
        }}
        onPress={(event) => {
          if (isDisabled) return;
          onPress?.(event);
          toggle();
        }}
        role="menuitem"
        tabIndex={registration.current ? 0 : -1}
      >
        <Text accessibilityElementsHidden aria-hidden className="w-4 text-center text-foreground">
          {checked ? '✓' : ''}
        </Text>
        {renderMenuChildren(children, cn('flex-1 text-foreground', textClassName))}
      </Pressable>
    );
  },
);

DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export type DropdownMenuRadioGroupProps = Omit<ViewProps, 'role'> & {
  onValueChange?: (value: string) => void;
  value?: string;
};

export function DropdownMenuRadioGroup({
  children,
  onValueChange,
  value,
  ...props
}: DropdownMenuRadioGroupProps) {
  const [valueCounts, setValueCounts] = React.useState<Record<string, number>>({});
  const registerValue = React.useCallback((itemValue: string) => {
    setValueCounts((current) => ({ ...current, [itemValue]: (current[itemValue] ?? 0) + 1 }));
    return () => {
      setValueCounts((current) => {
        const nextCount = Math.max(0, (current[itemValue] ?? 0) - 1);
        if (nextCount === 0) {
          const { [itemValue]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [itemValue]: nextCount };
      });
    };
  }, []);
  const duplicateValues = React.useMemo(
    () => new Set(Object.keys(valueCounts).filter((itemValue) => (valueCounts[itemValue] ?? 0) > 1)),
    [valueCounts],
  );
  const context = React.useMemo<DropdownMenuRadioGroupContextValue>(
    () => ({ duplicateValues, onValueChange, registerValue, value }),
    [duplicateValues, onValueChange, registerValue, value],
  );

  React.useEffect(() => {
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      value !== undefined &&
      typeof onValueChange !== 'function'
    ) {
      console.warn('BeeUI DropdownMenuRadioGroup: `value` requires `onValueChange`.');
    }
  }, [onValueChange, value]);

  return (
    <DropdownMenuRadioGroupContext.Provider value={context}>
      <View {...props} role="radiogroup">
        {children}
      </View>
    </DropdownMenuRadioGroupContext.Provider>
  );
}

DropdownMenuRadioGroup.displayName = 'DropdownMenuRadioGroup';

export type DropdownMenuRadioItemProps = Omit<
  DropdownMenuItemBaseProps,
  'closeOnSelect' | 'onSelect'
> & {
  closeOnSelect?: boolean;
  value: string;
};

export const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DropdownMenuRadioItemProps
>(
  (
    {
      accessibilityState,
      children,
      className,
      closeOnSelect = false,
      disabled = false,
      onFocus,
      onHoverIn,
      onPress,
      textClassName,
      value,
      ...props
    },
    ref,
  ) => {
    const root = useDropdownMenuRootContext();
    const group = React.useContext(DropdownMenuRadioGroupContext);
    if (!group) throw new Error('DropdownMenuRadioItem must be used inside DropdownMenuRadioGroup.');
    const duplicate = group.duplicateValues.has(value);
    const resolvedDisabled = disabled === true || duplicate;
    const checked = group.value === value;

    const registerValue = group.registerValue;
    React.useEffect(() => registerValue(value), [registerValue, value]);
    React.useEffect(() => {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && duplicate) {
        console.warn(`BeeUI DropdownMenuRadioGroup: duplicate radio value \`${value}\` is disabled.`);
      }
    }, [duplicate, value]);

    const select = React.useCallback(() => {
      if (resolvedDisabled) return;
      if (!checked) group.onValueChange?.(value);
      if (closeOnSelect) root.setOpen(false);
    }, [checked, closeOnSelect, group, resolvedDisabled, root, value]);
    const registration = useRegisteredMenuItem({
      activate: select,
      disabled: resolvedDisabled,
      forwardedRef: ref,
    });

    return (
      <Pressable
        ref={registration.setRef}
        {...props}
        accessibilityRole="menuitem"
        accessibilityState={{ ...accessibilityState, checked, disabled: resolvedDisabled }}
        className={cn(
          'min-h-10 flex-row items-center gap-2 rounded-md px-3 py-2 active:bg-muted web:hover:bg-surface-muted web:focus-visible:bee-focus-ring',
          registration.current && 'bg-muted',
          resolvedDisabled && 'opacity-50',
          className,
        )}
        disabled={resolvedDisabled}
        onFocus={(event) => {
          registration.setCurrent();
          onFocus?.(event);
        }}
        onHoverIn={(event) => {
          registration.setCurrent();
          onHoverIn?.(event);
        }}
        onPress={(event) => {
          if (resolvedDisabled) return;
          onPress?.(event);
          select();
        }}
        role="menuitem"
        tabIndex={registration.current ? 0 : -1}
      >
        <Text accessibilityElementsHidden aria-hidden className="w-4 text-center text-foreground">
          {checked ? '●' : ''}
        </Text>
        {renderMenuChildren(children, cn('flex-1 text-foreground', textClassName))}
      </Pressable>
    );
  },
);

DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

export type DropdownMenuLabelProps = Omit<TextProps, 'role' | 'variant'>;

export const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof Text>,
  DropdownMenuLabelProps
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    {...props}
    className={cn('px-3 py-2 font-semibold text-foreground', className)}
    variant="label"
  />
));

DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export type DropdownMenuSeparatorProps = Omit<ViewProps, 'role'>;

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof View>,
  DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    {...props}
    accessibilityElementsHidden
    accessible={false}
    aria-hidden
    className={cn('my-1 h-px bg-border', className)}
  />
));

DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

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
