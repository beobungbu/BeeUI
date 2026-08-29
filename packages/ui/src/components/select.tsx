import {
  cn,
  type AnchoredOverlayAlign,
  type AnchoredOverlayCollisionPadding,
  type AnchoredOverlayDirection,
  type AnchoredOverlayPlacement,
} from '@beeui/core';
import { layer } from '@beeui/tokens';
import * as React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type ScrollViewProps,
  type TextProps as RNTextProps,
  type ViewProps,
} from 'react-native';
import {
  OverlayDismissLayer,
  OverlayPortal,
  useAnchoredOverlayPosition,
  useOverlayDismissable,
  useOverlayId,
  type OverlayMeasurableNode,
} from './overlay-runtime';
import { Text } from './text';
import { resolveDirection } from './use-direction';

export type SelectOptionValue = string;
export type SelectPlacement = AnchoredOverlayPlacement;
export type SelectAlign = AnchoredOverlayAlign;
export type SelectDirection = AnchoredOverlayDirection;
export type SelectCollisionPadding = AnchoredOverlayCollisionPadding;

type SelectFocusableNode = React.ComponentRef<typeof Pressable> &
  OverlayMeasurableNode & {
    focus?: () => void;
  };

type SelectItemRegistration = {
  disabled: boolean;
  focus: () => void;
  id: string;
  order: number;
  textValue: string;
  value: SelectOptionValue;
};

type SelectRootContextValue = {
  anchorRef: React.RefObject<SelectFocusableNode | null>;
  contentNativeID: string;
  disabled: boolean;
  duplicateValues: ReadonlySet<SelectOptionValue>;
  items: SelectItemRegistration[];
  open: boolean;
  overlayId: string;
  registerItem: (item: SelectItemRegistration) => void;
  selectItem: (id: string) => void;
  selectedItem: SelectItemRegistration | undefined;
  setOpen: (open: boolean) => void;
  unregisterItem: (id: string) => void;
  value: SelectOptionValue | undefined;
};

const SelectRootContext = React.createContext<SelectRootContextValue | null>(null);

function useSelectRootContext() {
  const context = React.useContext(SelectRootContext);
  if (!context) throw new Error('Select components must be used inside Select.');
  return context;
}

type SelectItemsContextValue = {
  claimOrder: () => number;
  currentItemId: string | null;
  registerLayout: (id: string, y: number, height: number) => void;
  setCurrentItem: (id: string) => void;
};

const SelectItemsContext = React.createContext<SelectItemsContextValue | null>(null);

type SelectGroupContextValue = {
  labelNativeID: string;
};

const SelectGroupContext = React.createContext<SelectGroupContextValue | null>(null);

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

const SELECT_DEFAULT_PLACEHOLDER = 'Select an option';

function inferSelectAccessibleFallback(children: React.ReactNode): string {
  if (React.isValidElement(children) && children.type === SelectValue) {
    const placeholder = (children.props as SelectValueProps).placeholder;
    if (typeof placeholder === 'string' && placeholder.trim().length > 0) return placeholder;
  }
  return SELECT_DEFAULT_PLACEHOLDER;
}

function primitiveText(children: React.ReactNode): string | undefined {
  const childArray = React.Children.toArray(children);
  if (!childArray.length) return undefined;
  if (!childArray.every((child) => typeof child === 'string' || typeof child === 'number')) {
    return undefined;
  }
  return childArray.map(String).join('').trim();
}

function renderItemChildren(children: React.ReactNode, textClassName?: string) {
  return React.Children.toArray(children).map((child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text key={`select-item-label-${index}`} className={textClassName} variant="body">
          {child}
        </Text>
      );
    }
    return child;
  });
}

type SelectBaseProps = {
  children?: React.ReactNode;
  defaultOpen?: boolean;
  defaultValue?: SelectOptionValue;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: SelectOptionValue) => void;
  open?: boolean;
  value?: SelectOptionValue;
};

export type SelectProps = SelectBaseProps;

export function Select(props: SelectProps) {
  const hasOpenProp = Object.prototype.hasOwnProperty.call(props, 'open');
  const hasValueProp = Object.prototype.hasOwnProperty.call(props, 'value');
  const {
    children,
    defaultOpen = false,
    defaultValue,
    disabled = false,
    onOpenChange,
    onValueChange,
    open,
    value,
  } = props;

  const openControlled = hasOpenProp && typeof onOpenChange === 'function' && open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(
    hasOpenProp && open !== undefined ? open : defaultOpen,
  );
  const resolvedOpen = openControlled && open !== undefined ? open : internalOpen;

  const valueControlled = hasValueProp;
  const [internalValue, setInternalValue] = React.useState<SelectOptionValue | undefined>(
    hasValueProp ? value : defaultValue,
  );
  const resolvedValue = valueControlled ? value : internalValue;

  const [items, setItems] = React.useState<SelectItemRegistration[]>([]);
  const anchorRef = React.useRef<SelectFocusableNode | null>(null);
  const overlayId = useOverlayId('beeui-select');
  const contentNativeID = `${overlayId}-content`;
  const warnedDuplicatesRef = React.useRef(new Set<SelectOptionValue>());

  React.useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    if (hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI Select: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
      );
    }
    if (hasValueProp && !onValueChange && !disabled) {
      console.warn('BeeUI Select: enabled controlled `value` usage requires `onValueChange`.');
    }
  }, [disabled, hasOpenProp, hasValueProp, onOpenChange, onValueChange]);

  React.useEffect(() => {
    if (!openControlled && hasOpenProp && open !== undefined) setInternalOpen(open);
  }, [hasOpenProp, open, openControlled]);

  const valueCounts = React.useMemo(() => {
    const counts = new Map<SelectOptionValue, number>();
    for (const item of items) counts.set(item.value, (counts.get(item.value) ?? 0) + 1);
    return counts;
  }, [items]);

  const duplicateValues = React.useMemo(
    () => new Set([...valueCounts].filter(([, count]) => count > 1).map(([itemValue]) => itemValue)),
    [valueCounts],
  );

  React.useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    for (const duplicateValue of duplicateValues) {
      if (warnedDuplicatesRef.current.has(duplicateValue)) continue;
      warnedDuplicatesRef.current.add(duplicateValue);
      console.warn(
        `BeeUI Select: duplicate option value \`${duplicateValue}\` detected. All options with that value are disabled until the duplicate is removed.`,
      );
    }
    for (const warnedValue of [...warnedDuplicatesRef.current]) {
      if (!duplicateValues.has(warnedValue)) warnedDuplicatesRef.current.delete(warnedValue);
    }
  }, [duplicateValues]);

  const registerItem = React.useCallback((item: SelectItemRegistration) => {
    setItems((current) => {
      const index = current.findIndex((entry) => entry.id === item.id);
      if (index < 0) return [...current, item];
      const existing = current[index];
      if (
        existing.disabled === item.disabled &&
        existing.focus === item.focus &&
        existing.order === item.order &&
        existing.textValue === item.textValue &&
        existing.value === item.value
      ) {
        return current;
      }
      const next = [...current];
      next[index] = item;
      return next;
    });
  }, []);

  const unregisterItem = React.useCallback((id: string) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const focusTrigger = React.useCallback(() => {
    if (Platform.OS === 'web') anchorRef.current?.focus?.();
  }, []);

  const previousOpenRef = React.useRef(resolvedOpen);
  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = resolvedOpen;
    if (wasOpen && !resolvedOpen) focusTrigger();
  }, [focusTrigger, resolvedOpen]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && disabled) return;
      if (!openControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [disabled, onOpenChange, openControlled],
  );

  const selectItem = React.useCallback(
    (id: string) => {
      const item = items.find((entry) => entry.id === id);
      if (!item || disabled || item.disabled || duplicateValues.has(item.value)) return;
      if (item.value !== resolvedValue) {
        if (!valueControlled) setInternalValue(item.value);
        onValueChange?.(item.value);
      }
      setOpen(false);
    },
    [disabled, duplicateValues, items, onValueChange, resolvedValue, setOpen, valueControlled],
  );

  const selectedItem = React.useMemo(
    () =>
      resolvedValue === undefined || duplicateValues.has(resolvedValue)
        ? undefined
        : items.find((item) => item.value === resolvedValue),
    [duplicateValues, items, resolvedValue],
  );

  const context = React.useMemo<SelectRootContextValue>(
    () => ({
      anchorRef,
      contentNativeID,
      disabled,
      duplicateValues,
      items,
      open: resolvedOpen,
      overlayId,
      registerItem,
      selectItem,
      selectedItem,
      setOpen,
      unregisterItem,
      value: resolvedValue,
    }),
    [
      contentNativeID,
      disabled,
      duplicateValues,
      items,
      overlayId,
      registerItem,
      resolvedOpen,
      resolvedValue,
      selectItem,
      selectedItem,
      setOpen,
      unregisterItem,
    ],
  );

  return <SelectRootContext.Provider value={context}>{children}</SelectRootContext.Provider>;
}

Select.displayName = 'Select';

type WebKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
};

export type SelectTriggerProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  indicator?: React.ReactNode;
  onKeyDown?: (event: WebKeyboardEvent) => void;
};

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  SelectTriggerProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      accessibilityValue,
      children,
      className,
      disabled,
      indicator,
      onKeyDown,
      onPress,
      ...props
    },
    forwardedRef,
  ) => {
    const { anchorRef, contentNativeID, disabled: rootDisabled, open, selectedItem, setOpen } =
      useSelectRootContext();
    const resolvedDisabled = rootDisabled || disabled === true;
    // The combobox trigger's own text (the selected value or placeholder) is
    // rendered inside an `accessible={false}` View, and `role="combobox"`
    // does not get an accessible name from its content per the ARIA naming
    // algorithm — it requires an explicit `aria-label`/`aria-labelledby`.
    // Per the WAI-ARIA APG combobox pattern, the accessible NAME must stay
    // distinct from the selected VALUE so assistive tech users can perceive
    // both (e.g. name "Choose a plan", value "Pro"). The selected item's
    // label already surfaces as the combobox's value via
    // `accessibilityValue.text` below — never promote it into the name.
    // Fall back to a stable purpose/name derived from the SelectValue
    // placeholder, or a generic default, so every trigger has a real
    // accessible name even when a consumer omits `accessibilityLabel`.
    const fallbackAccessibleLabel = inferSelectAccessibleFallback(children);
    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (props.accessibilityLabelledBy ? undefined : fallbackAccessibleLabel);
    const setTriggerRef = React.useCallback(
      (node: React.ComponentRef<typeof Pressable> | null) => {
        anchorRef.current = node as SelectFocusableNode | null;
        assignRef(forwardedRef, node);
      },
      [anchorRef, forwardedRef],
    );

    const handleWebKeyDown = React.useCallback(
      (event: WebKeyboardEvent) => {
        onKeyDown?.(event);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault?.();
          setOpen(true);
        }
      },
      [onKeyDown, setOpen],
    );

    const webKeyboardProps =
      Platform.OS === 'web'
        ? ({ onKeyDown: handleWebKeyDown } as unknown as PressableProps)
        : ({} as PressableProps);

    return (
      <Pressable
        ref={setTriggerRef}
        {...props}
        {...webKeyboardProps}
        aria-controls={contentNativeID}
        aria-expanded={open}
        aria-haspopup="listbox"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled: resolvedDisabled, expanded: open }}
        accessibilityValue={{
          ...accessibilityValue,
          text: accessibilityValue?.text ?? selectedItem?.textValue,
        }}
        className={cn(
          'h-11 min-w-48 flex-row items-center justify-between gap-3 rounded-md border border-border-strong bg-input px-3 active:opacity-90 web:hover:bg-surface-muted',
          resolvedDisabled && 'border-disabled bg-disabled opacity-60',
          className,
        )}
        disabled={resolvedDisabled}
        onPress={(event) => {
          onPress?.(event);
          setOpen(!open);
        }}
        role="combobox"
      >
        <View accessible={false} className="min-w-0 flex-1" pointerEvents="none">
          {children ?? <SelectValue />}
        </View>
        <View accessible={false} pointerEvents="none">
          {indicator ?? (
            <Text aria-hidden className="text-muted-foreground" variant="body">
              {open ? '⌃' : '⌄'}
            </Text>
          )}
        </View>
      </Pressable>
    );
  },
);

SelectTrigger.displayName = 'SelectTrigger';

export type SelectValueProps = Omit<RNTextProps, 'children' | 'role'> & {
  className?: string;
  placeholder?: React.ReactNode;
};

export const SelectValue = React.forwardRef<React.ComponentRef<typeof Text>, SelectValueProps>(
  ({ className, placeholder = SELECT_DEFAULT_PLACEHOLDER, ...props }, ref) => {
    const { disabled, selectedItem } = useSelectRootContext();
    const hasSelection = selectedItem !== undefined;
    return (
      <Text
        ref={ref}
        {...props}
        className={cn(
          hasSelection ? 'text-foreground' : 'text-muted-foreground',
          disabled && 'text-disabled-foreground',
          className,
        )}
        numberOfLines={1}
        variant="body"
      >
        {hasSelection ? selectedItem.textValue : placeholder}
      </Text>
    );
  },
);

SelectValue.displayName = 'SelectValue';

type ItemLayout = { height: number; y: number };

export type SelectContentProps = Omit<ViewProps, 'nativeID' | 'role'> & {
  align?: SelectAlign;
  alignOffset?: number;
  avoidKeyboard?: boolean;
  avoidSafeArea?: boolean;
  closeOnOutsidePress?: boolean;
  collisionPadding?: SelectCollisionPadding;
  direction?: SelectDirection;
  flip?: boolean;
  maxHeight?: number;
  outsidePressProps?: Omit<PressableProps, 'children' | 'onPress' | 'style'>;
  outsidePressTestID?: string;
  placement?: SelectPlacement;
  scrollViewProps?: Omit<ScrollViewProps, 'children'>;
  shift?: boolean;
  sideOffset?: number;
};

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof View>,
  SelectContentProps
>(
  (
    {
      accessibilityElementsHidden,
      'aria-hidden': ariaHidden,
      align = 'start',
      alignOffset = 0,
      avoidKeyboard = true,
      avoidSafeArea = true,
      children,
      className,
      closeOnOutsidePress = true,
      collisionPadding = 8,
      direction = resolveDirection(),
      flip = true,
      importantForAccessibility,
      maxHeight,
      onAccessibilityEscape,
      onLayout,
      outsidePressProps,
      outsidePressTestID,
      placement = 'bottom',
      scrollViewProps,
      shift = true,
      sideOffset = 6,
      style,
      ...props
    },
    ref,
  ) => {
    const root = useSelectRootContext();
    const { anchorRef, contentNativeID, duplicateValues, items, open, overlayId, selectedItem, setOpen } =
      root;
    const [currentItemId, setCurrentItemId] = React.useState<string | null>(null);
    const [itemLayouts, setItemLayouts] = React.useState<Record<string, ItemLayout>>({});
    const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView> | null>(null);
    const typeaheadRef = React.useRef({ query: '', timestamp: 0 });
    const renderOrderRef = React.useRef(0);
    renderOrderRef.current = 0;
    const claimOrder = React.useCallback(() => renderOrderRef.current++, []);
    const orderedItems = React.useMemo(
      () => [...items].sort((a, b) => a.order - b.order),
      [items],
    );
    const { isTopmost } = useOverlayDismissable({
      onDismiss: () => setOpen(false),
      open,
      overlayId,
    });

    const handleAnchorUnavailable = React.useCallback(() => {
      if (open) setOpen(false);
    }, [open, setOpen]);

    const { onOverlayLayout, position, viewportRect } = useAnchoredOverlayPosition({
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

    const isEnabled = React.useCallback(
      (item: SelectItemRegistration) => !item.disabled && !duplicateValues.has(item.value),
      [duplicateValues],
    );

    React.useEffect(() => {
      if (!open) {
        setCurrentItemId(null);
        typeaheadRef.current = { query: '', timestamp: 0 };
        return;
      }
      setCurrentItemId((current) => {
        if (current) {
          const currentItem = orderedItems.find((item) => item.id === current);
          if (currentItem && isEnabled(currentItem)) return current;
        }
        if (selectedItem && isEnabled(selectedItem)) return selectedItem.id;
        return orderedItems.find(isEnabled)?.id ?? null;
      });
    }, [isEnabled, open, orderedItems, selectedItem]);

    React.useEffect(() => {
      if (!open || Platform.OS !== 'web' || !currentItemId) return;
      orderedItems.find((item) => item.id === currentItemId)?.focus();
    }, [currentItemId, open, orderedItems]);

    React.useEffect(() => {
      if (!open || !currentItemId) return;
      const layout = itemLayouts[currentItemId];
      if (!layout) return;
      scrollRef.current?.scrollTo({
        animated: false,
        y: Math.max(0, layout.y - 8),
      });
    }, [currentItemId, itemLayouts, open]);

    const setCurrentItem = React.useCallback(
      (id: string) => {
        const target = orderedItems.find((item) => item.id === id);
        if (!target || !isEnabled(target)) return;
        setCurrentItemId(id);
      },
      [isEnabled, orderedItems],
    );

    const focusItem = React.useCallback(
      (item: SelectItemRegistration | undefined) => {
        if (!item || !isEnabled(item)) return;
        setCurrentItemId(item.id);
        if (Platform.OS === 'web') item.focus();
      },
      [isEnabled],
    );

    const moveCurrent = React.useCallback(
      (delta: 1 | -1) => {
        const enabled = orderedItems.filter(isEnabled);
        if (!enabled.length) return;
        const currentIndex = enabled.findIndex((item) => item.id === currentItemId);
        const baseIndex = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
        const nextIndex = (baseIndex + delta + enabled.length) % enabled.length;
        focusItem(enabled[nextIndex]);
      },
      [currentItemId, focusItem, isEnabled, orderedItems],
    );

    const activateCurrent = React.useCallback(() => {
      if (!currentItemId) return;
      root.selectItem(currentItemId);
    }, [currentItemId, root]);

    const handleTypeahead = React.useCallback(
      (key: string) => {
        const now = Date.now();
        const previous = typeaheadRef.current;
        const query = `${now - previous.timestamp > 700 ? '' : previous.query}${key}`.toLocaleLowerCase();
        typeaheadRef.current = { query, timestamp: now };
        const enabled = orderedItems.filter(isEnabled);
        if (!enabled.length) return;
        const currentIndex = enabled.findIndex((item) => item.id === currentItemId);
        const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
        const ordered = [...enabled.slice(startIndex), ...enabled.slice(0, startIndex)];
        focusItem(ordered.find((item) => item.textValue.toLocaleLowerCase().startsWith(query)));
      },
      [currentItemId, focusItem, isEnabled, orderedItems],
    );

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
            focusItem(orderedItems.find(isEnabled));
            break;
          case 'End':
            event.preventDefault?.();
            focusItem([...orderedItems].reverse().find(isEnabled));
            break;
          case 'Enter':
          case ' ':
            event.preventDefault?.();
            activateCurrent();
            break;
          default:
            if (event.key && event.key.length === 1 && !/\s/.test(event.key)) {
              handleTypeahead(event.key);
            }
            break;
        }
      },
      [activateCurrent, focusItem, handleTypeahead, isEnabled, moveCurrent, orderedItems],
    );

    const registerLayout = React.useCallback((id: string, y: number, height: number) => {
      setItemLayouts((current) => {
        const existing = current[id];
        if (existing?.y === y && existing.height === height) return current;
        return { ...current, [id]: { y, height } };
      });
    }, []);

    const itemsContext = React.useMemo<SelectItemsContextValue>(
      () => ({ claimOrder, currentItemId, registerLayout, setCurrentItem }),
      [claimOrder, currentItemId, registerLayout, setCurrentItem],
    );

    const viewportMaxHeight = viewportRect ? Math.max(96, viewportRect.height - 16) : 320;
    const resolvedMaxHeight = Math.max(96, Math.min(maxHeight ?? 320, viewportMaxHeight));
    const resolvedStyle = !open
      ? [styles.content, styles.hidden, style]
      : position
        ? [styles.content, { left: position.x, top: position.y, maxHeight: resolvedMaxHeight }, style]
        : [styles.content, styles.measuring, { maxHeight: resolvedMaxHeight }, style];
    const webKeyboardProps =
      Platform.OS === 'web'
        ? ({ onKeyDown: handleWebKeyDown, role: 'listbox' } as unknown as ViewProps)
        : ({} as ViewProps);

    return (
      <OverlayPortal overlayId={overlayId}>
        <SelectRootContext.Provider value={root}>
          {open && closeOnOutsidePress ? (
            <OverlayDismissLayer
              {...outsidePressProps}
              overlayId={overlayId}
              testID={outsidePressTestID}
            />
          ) : null}
          <SelectItemsContext.Provider value={itemsContext}>
            <View
              ref={ref}
              {...props}
              {...webKeyboardProps}
              accessibilityElementsHidden={open && position ? accessibilityElementsHidden : true}
              aria-hidden={open && position ? ariaHidden : true}
              className={cn(
                'min-w-48 max-w-sm rounded-lg border border-border bg-surface py-1 shadow-sm',
                className,
              )}
              importantForAccessibility={
                open && position ? importantForAccessibility : 'no-hide-descendants'
              }
              nativeID={contentNativeID}
              onAccessibilityEscape={() => {
                onAccessibilityEscape?.();
                if (isTopmost()) setOpen(false);
              }}
              onLayout={(event) => {
                onOverlayLayout(event);
                onLayout?.(event);
              }}
              pointerEvents={open && position ? 'auto' : 'none'}
              style={resolvedStyle}
            >
              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                {...scrollViewProps}
                style={[{ maxHeight: resolvedMaxHeight }, scrollViewProps?.style]}
              >
                {children}
              </ScrollView>
            </View>
          </SelectItemsContext.Provider>
        </SelectRootContext.Provider>
      </OverlayPortal>
    );
  },
);

SelectContent.displayName = 'SelectContent';

export type SelectItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'onPress' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  onPress?: PressableProps['onPress'];
  textClassName?: string;
  textValue?: string;
  value: SelectOptionValue;
};

export const SelectItem = React.forwardRef<React.ComponentRef<typeof Pressable>, SelectItemProps>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled = false,
      onFocus,
      onHoverIn,
      onLayout,
      onPress,
      textClassName,
      textValue,
      value,
      ...props
    },
    forwardedRef,
  ) => {
    const root = useSelectRootContext();
    const itemsContext = React.useContext(SelectItemsContext);
    if (!itemsContext) throw new Error('SelectItem must be used inside SelectContent.');
    const id = useOverlayId('beeui-select-item');
    const order = itemsContext.claimOrder();
    const internalRef = React.useRef<SelectFocusableNode | null>(null);
    const inferredText = primitiveText(children);
    const resolvedTextValue = (textValue ?? inferredText ?? value).trim();
    const duplicate = root.duplicateValues.has(value);
    const resolvedDisabled = root.disabled || disabled === true || duplicate;
    const selected = root.value === value && !duplicate;
    const current = itemsContext.currentItemId === id;

    React.useEffect(() => {
      if (
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        textValue === undefined &&
        inferredText === undefined
      ) {
        console.warn(
          `BeeUI SelectItem: option \`${value}\` has non-text children. Provide \`textValue\` for selected-value display, accessibility, and typeahead.`,
        );
      }
    }, [inferredText, textValue, value]);

    const setRef = React.useCallback(
      (node: React.ComponentRef<typeof Pressable> | null) => {
        internalRef.current = node as SelectFocusableNode | null;
        assignRef(forwardedRef, node);
      },
      [forwardedRef],
    );

    React.useEffect(() => {
      root.registerItem({
        disabled: disabled === true,
        focus: () => internalRef.current?.focus?.(),
        id,
        order,
        textValue: resolvedTextValue,
        value,
      });
      return () => root.unregisterItem(id);
    }, [disabled, id, order, resolvedTextValue, root.registerItem, root.unregisterItem, value]);

    return (
      <Pressable
        ref={setRef}
        {...props}
        accessibilityLabel={accessibilityLabel ?? resolvedTextValue}
        accessibilityState={{
          ...accessibilityState,
          disabled: resolvedDisabled,
          selected,
        }}
        className={cn(
          'min-h-10 flex-row items-center gap-2 rounded-md px-3 py-2 active:bg-muted web:hover:bg-surface-muted',
          current && 'bg-muted',
          resolvedDisabled && 'opacity-50',
          className,
        )}
        disabled={resolvedDisabled}
        nativeID={props.nativeID ?? id}
        onFocus={(event) => {
          itemsContext.setCurrentItem(id);
          onFocus?.(event);
        }}
        onHoverIn={(event) => {
          itemsContext.setCurrentItem(id);
          onHoverIn?.(event);
        }}
        onLayout={(event: LayoutChangeEvent) => {
          itemsContext.registerLayout(id, event.nativeEvent.layout.y, event.nativeEvent.layout.height);
          onLayout?.(event);
        }}
        onPress={(event) => {
          if (resolvedDisabled) return;
          onPress?.(event);
          root.selectItem(id);
        }}
        role="option"
        tabIndex={current ? 0 : -1}
      >
        <Text accessibilityElementsHidden aria-hidden className="w-4 text-center text-foreground">
          {selected ? '✓' : ''}
        </Text>
        <View accessible={false} className="min-w-0 flex-1" pointerEvents="none">
          {renderItemChildren(children, cn('text-foreground', textClassName))}
        </View>
      </Pressable>
    );
  },
);

SelectItem.displayName = 'SelectItem';

export type SelectGroupProps = Omit<ViewProps, 'accessibilityRole' | 'role'>;

export const SelectGroup = React.forwardRef<React.ComponentRef<typeof View>, SelectGroupProps>(
  ({ children, ...props }, ref) => {
    const labelNativeID = useOverlayId('beeui-select-group-label');
    const context = React.useMemo(() => ({ labelNativeID }), [labelNativeID]);
    const webGroupProps =
      Platform.OS === 'web'
        ? ({ 'aria-labelledby': labelNativeID, role: 'group' } as unknown as ViewProps)
        : ({} as ViewProps);
    return (
      <SelectGroupContext.Provider value={context}>
        <View
          ref={ref}
          {...props}
          {...webGroupProps}
          accessibilityLabelledBy={labelNativeID}
        >
          {children}
        </View>
      </SelectGroupContext.Provider>
    );
  },
);

SelectGroup.displayName = 'SelectGroup';

export type SelectLabelProps = Omit<RNTextProps, 'nativeID' | 'role'> & {
  className?: string;
};

export const SelectLabel = React.forwardRef<React.ComponentRef<typeof Text>, SelectLabelProps>(
  ({ className, ...props }, ref) => {
    const group = React.useContext(SelectGroupContext);
    return (
      <Text
        ref={ref}
        {...props}
        className={cn('px-3 py-2 font-semibold text-muted-foreground', className)}
        nativeID={group?.labelNativeID}
        variant="label"
      />
    );
  },
);

SelectLabel.displayName = 'SelectLabel';

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    zIndex: layer.overlay,
  },
  hidden: {
    display: 'none',
  },
  measuring: {
    left: -10000,
    opacity: 0,
    top: -10000,
  },
});
