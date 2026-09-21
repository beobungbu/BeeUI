import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { Text } from './text';
import { useDirection } from './use-direction';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

type WebKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
};

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

type TabsContextValue = {
  disabled: boolean;
  onValueChange?: (value: string) => void;
  value: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error(`${component} must be rendered inside <Tabs>.`);
  }

  return context;
}

// Ordered `value`s of every `TabsTrigger` a `TabsList` currently renders, computed straight
// from its own `children` (a static, synchronously-inspectable React tree — unlike
// `Table`'s dynamically-labeled columns, no separate registration-during-render pass is
// needed). `TabsTrigger`'s close control uses this to find the previous/next sibling to
// select when the currently-selected tab is closed.
const TabsOrderContext = React.createContext<readonly string[]>([]);

type TabsTriggerLayout = { width: number; x: number };

type TabsFocusableNode = { focus?: () => void };

type TabsListLayoutContextValue = {
  register: (value: string, layout: TabsTriggerLayout) => void;
  /** Registers a `TabsTrigger`'s `focus()` function for arrow-key roving (see `TabsRovingFocusContextValue`); disabled state is read directly from `children` in `TabsList`, not stored here. Only consulted when `scrollable` is true. */
  registerFocusable: (value: string, focus: () => void) => void;
  /** Whether the owning `TabsList` renders inside a horizontal scroll container. Read by
   * `TabsTrigger` to decide whether it should stretch (`flex-1`, the pre-scrollable default)
   * or size to its own content (`scrollable`), and whether it participates in Web
   * arrow-key roving-tabindex navigation. */
  scrollable: boolean;
  unregister: (value: string) => void;
  unregisterFocusable: (value: string) => void;
};

// `null` (not just an unregistered default) so `TabsTrigger` can tell "not inside a
// `TabsList` that tracks layout at all" apart from "inside one, not scrollable" — the same
// shape distinction `TabsColumnLabelRegistryContext` uses in `table.tsx`.
const TabsListLayoutContext = React.createContext<TabsListLayoutContextValue | null>(null);

type TabsRovingFocusContextValue = {
  /**
   * The `value` of the roving-tabindex "current" trigger — the one with `tabIndex={0}`
   * on Web, reached by Tab; every other trigger has `tabIndex={-1}`. Only meaningful
   * (and only read) when `scrollable` is true — see `TabsTrigger`'s own tabIndex
   * computation. `null` before any `TabsTrigger` has registered.
   */
  currentValue: string | null;
  /** Moves the roving-tabindex "current" trigger without changing `Tabs`'s own selection — mirrors `onFocus` naturally updating it when focus moves by any other means (Tab, mouse). */
  setCurrentValue: (value: string) => void;
};

// Deliberately a *separate* context from `TabsListLayoutContext`: `currentValue` changes on
// every arrow-key/Home/End/focus interaction, but `TabsTrigger`'s register/unregister
// cleanup effects key their dependency array on `TabsListLayoutContext`'s own object
// identity (see that effect's comment). Folding a frequently-changing value into that same
// object would recreate it on every roving-focus interaction, which would fire that
// cleanup's stale-closure `unregister` on every keystroke and silently drop a still-mounted
// trigger's tracked layout/focus registration — a real, reproduced regression this split
// exists specifically to prevent.
const TabsRovingFocusContext = React.createContext<TabsRovingFocusContextValue | null>(null);

export type TabsProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  className?: string;
  /** Disables every `TabsTrigger` inside, overriding each trigger's own `disabled`. Defaults to false. */
  disabled?: boolean;
  /** Called with the pressed tab's `value` when a non-selected `TabsTrigger` is pressed. Required for enabled usage (logs a dev warning otherwise). */
  onValueChange?: (value: string) => void;
  /** The `value` of the currently active tab, matched against each `TabsTrigger`/`TabsContent`'s own `value`. Always controlled by the caller — there is no uncontrolled mode. */
  value: string;
};

export const Tabs = React.forwardRef<React.ComponentRef<typeof View>, TabsProps>(
  ({ children, className, disabled = false, onValueChange, value, ...props }, ref) => {
    useRequiredCallbackWarning('Tabs', 'onValueChange', onValueChange, disabled);

    const contextValue = React.useMemo(
      () => ({ disabled, onValueChange, value }),
      [disabled, onValueChange, value],
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <View ref={ref} className={cn('gap-4', className)} {...props}>
          {children}
        </View>
      </TabsContext.Provider>
    );
  },
);

Tabs.displayName = 'Tabs';

export type TabsListProps = Omit<ViewProps, 'accessibilityRole' | 'role'> & {
  /**
   * Extra content rendered after the tab strip (e.g. a pinned "+ new order" action). Stays
   * fixed in place even when `scrollable` is true and the strip itself scrolls underneath
   * it — it is never part of the horizontally-scrollable region.
   */
  addon?: React.ReactNode;
  className?: string;
  /**
   * Renders the strip inside a horizontal scroll container instead of an equal-width flex
   * row — each `TabsTrigger` sizes to its own content instead of stretching — and scrolls
   * the selected `TabsTrigger` into view whenever the parent `Tabs`'s `value` changes.
   * Existing (non-scrollable) tab strips are unaffected. Defaults to false.
   */
  scrollable?: boolean;
};

export const TabsList = React.forwardRef<React.ComponentRef<typeof View>, TabsListProps>(
  ({ addon, children, className, scrollable = false, ...props }, ref) => {
    const tabs = useTabsContext('TabsList');
    const direction = useDirection();
    const scrollViewRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
    const layoutsRef = React.useRef<Map<string, TabsTriggerLayout>>(new Map());
    const focusablesRef = React.useRef<Map<string, () => void>>(new Map());
    const [currentValue, setCurrentValueState] = React.useState<string | null>(null);

    const order = React.useMemo(
      () =>
        React.Children.toArray(children)
          .filter(
            (child): child is React.ReactElement<TabsTriggerProps> =>
              React.isValidElement(child) && child.type === TabsTrigger,
          )
          .map((child) => child.props.value),
      [children],
    );

    // Keyboard order + each trigger's own disabled state (its `disabled` prop OR the
    // parent `Tabs`'s own `disabled`), used only by the arrow-key roving logic below —
    // separate from `order` (plain values, `TabsOrderContext`'s existing contract for
    // `TabsTrigger`'s close-neighbour lookup). Read directly from `children` (always
    // in sync with this render pass) rather than `focusablesRef`'s registration
    // effects, which commit one tick later.
    const keyboardOrder = React.useMemo(
      () =>
        React.Children.toArray(children)
          .filter(
            (child): child is React.ReactElement<TabsTriggerProps> =>
              React.isValidElement(child) && child.type === TabsTrigger,
          )
          .map((child) => ({
            disabled: child.props.disabled === true || tabs.disabled,
            value: child.props.value,
          })),
      [children, tabs.disabled],
    );

    // The roving-tabindex "current" trigger: the last one explicitly focused/navigated
    // to, falling back to the currently *selected* tab (WAI-ARIA Tabs Pattern's usual
    // starting point), falling back to the first enabled trigger. Computed at render
    // time (not in an effect) so the very first render already has exactly one
    // `tabIndex={0}` trigger instead of a Tab-unreachable strip.
    const resolvedCurrentValue = React.useMemo(() => {
      if (currentValue && keyboardOrder.some((entry) => entry.value === currentValue && !entry.disabled)) {
        return currentValue;
      }
      if (keyboardOrder.some((entry) => entry.value === tabs.value && !entry.disabled)) {
        return tabs.value;
      }
      return keyboardOrder.find((entry) => !entry.disabled)?.value ?? null;
    }, [currentValue, keyboardOrder, tabs.value]);

    const focusValue = React.useCallback((value: string | undefined) => {
      if (value === undefined) return;
      focusablesRef.current.get(value)?.();
      setCurrentValueState(value);
    }, []);

    const moveCurrent = React.useCallback(
      (delta: 1 | -1) => {
        const enabled = keyboardOrder.filter((entry) => !entry.disabled);
        if (!enabled.length) return;
        const index = enabled.findIndex((entry) => entry.value === resolvedCurrentValue);
        const baseIndex = index >= 0 ? index : delta > 0 ? -1 : 0;
        const nextIndex = (baseIndex + delta + enabled.length) % enabled.length;
        focusValue(enabled[nextIndex]?.value);
      },
      [focusValue, keyboardOrder, resolvedCurrentValue],
    );

    const handleWebKeyDown = React.useCallback(
      (event: WebKeyboardEvent) => {
        const enabled = keyboardOrder.filter((entry) => !entry.disabled);
        // RTL flips which arrow key means "next"/"previous" (ADR-004 direction precedence).
        const forwardKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        const backwardKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        switch (event.key) {
          case forwardKey:
            event.preventDefault?.();
            moveCurrent(1);
            break;
          case backwardKey:
            event.preventDefault?.();
            moveCurrent(-1);
            break;
          case 'Home':
            event.preventDefault?.();
            focusValue(enabled[0]?.value);
            break;
          case 'End':
            event.preventDefault?.();
            focusValue(enabled[enabled.length - 1]?.value);
            break;
          default:
            break;
        }
      },
      [direction, focusValue, keyboardOrder, moveCurrent],
    );

    // Deliberately excludes `resolvedCurrentValue`/`setCurrentValueState` (see
    // `TabsRovingFocusContext`'s own header comment) — this object's identity must stay
    // stable across roving-focus interactions, since `TabsTrigger`'s register/unregister
    // cleanup effects key their dependency array on it.
    const layoutContext = React.useMemo<TabsListLayoutContextValue>(
      () => ({
        register: (value, layout) => {
          layoutsRef.current.set(value, layout);
        },
        registerFocusable: (value, focus) => {
          focusablesRef.current.set(value, focus);
        },
        scrollable,
        unregister: (value) => {
          layoutsRef.current.delete(value);
        },
        unregisterFocusable: (value) => {
          focusablesRef.current.delete(value);
        },
      }),
      [scrollable],
    );

    const rovingFocusContext = React.useMemo<TabsRovingFocusContextValue>(
      () => ({ currentValue: resolvedCurrentValue, setCurrentValue: setCurrentValueState }),
      [resolvedCurrentValue],
    );

    // Selection changes scroll the newly-selected tab into view.
    React.useEffect(() => {
      if (!scrollable) return;
      const layout = layoutsRef.current.get(tabs.value);
      if (!layout) return;
      // Brings the selected tab's leading edge into view with a little leading breathing
      // room; RN's `ScrollView` clamps an out-of-range offset itself, so no extra
      // viewport-width bookkeeping is needed here.
      // Keyboard-driven focus moves must land instantly: an animated scroll leaves the
      // trigger clipped for a few frames, which is what a screen-magnifier user sees.
      scrollViewRef.current?.scrollTo({ animated: false, x: Math.max(0, layout.x - 16) });
    }, [scrollable, tabs.value]);

    // Arrow-key/Home/End roving focus also scrolls the newly-focused trigger into view,
    // independent of selection (manual-activation model: moving focus does not select).
    React.useEffect(() => {
      if (!scrollable || currentValue === null) return;
      const layout = layoutsRef.current.get(currentValue);
      if (!layout) return;
      // Keyboard-driven focus moves must land instantly: an animated scroll leaves the
      // trigger clipped for a few frames, which is what a screen-magnifier user sees.
      scrollViewRef.current?.scrollTo({ animated: false, x: Math.max(0, layout.x - 16) });
    }, [currentValue, scrollable]);

    const webKeyboardProps =
      Platform.OS === 'web' && scrollable
        ? ({ onKeyDown: handleWebKeyDown } as unknown as ViewProps)
        : ({} as ViewProps);

    return (
      <TabsOrderContext.Provider value={order}>
        <TabsListLayoutContext.Provider value={layoutContext}>
          <TabsRovingFocusContext.Provider value={rovingFocusContext}>
            <View
              ref={ref}
              {...props}
              {...webKeyboardProps}
              accessibilityRole="tablist"
              className={cn('flex-row items-center gap-1 rounded-md bg-muted p-1', className)}
            >
              {scrollable ? (
                <ScrollView horizontal ref={scrollViewRef} showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1">{children}</View>
                </ScrollView>
              ) : (
                children
              )}
              {addon}
            </View>
          </TabsRovingFocusContext.Provider>
        </TabsListLayoutContext.Provider>
      </TabsOrderContext.Provider>
    );
  },
);

TabsList.displayName = 'TabsList';

export type TabsTriggerProps = Omit<
  PressableProps,
  'accessibilityRole' | 'role' | 'children' | 'onPress'
> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Renders an accessible close control as a **sibling** of this tab's own pressable, never
   * nested inside it (a `Pressable`-in-`Pressable`/`<button>`-in-`<button>` composition is
   * the same anti-pattern flagged for `DropdownMenuTrigger` wrapping `IconButton` — nesting
   * interactive elements breaks Web's DOM validity and native's hit-testing). Requires
   * `closeAccessibilityLabel`. Defaults to false.
   */
  closable?: boolean;
  /**
   * Accessible name for the close control, e.g. `` `Close ${label}` ``. Required whenever
   * `closable` is true — BeeUI does not synthesize an English default from the tab's own
   * label, since that would hardcode a locale. A dev warning fires if `closable` is set
   * without it.
   */
  closeAccessibilityLabel?: string;
  labelClassName?: string;
  /**
   * Called with this tab's `value` when its close control is pressed. If this tab is
   * currently selected, `Tabs`'s `onValueChange` is also called — with the previous
   * sibling's `value` if one exists, else the next sibling's — moving selection away from
   * the tab being closed. No-op (besides `onClose` itself) when a non-selected tab closes,
   * or when the closing tab has no remaining sibling.
   */
  onClose?: (value: string) => void;
  /** Identifies this tab; compared against the parent `Tabs`'s `value` to determine whether it is selected. */
  value: string;
};

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  TabsTriggerProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      closable = false,
      closeAccessibilityLabel,
      disabled = false,
      labelClassName,
      onClose,
      onFocus,
      onLayout,
      value,
      ...props
    },
    ref,
  ) => {
    const tabs = useTabsContext('TabsTrigger');
    const order = React.useContext(TabsOrderContext);
    const listLayout = React.useContext(TabsListLayoutContext);
    const rovingFocus = React.useContext(TabsRovingFocusContext);
    const selected = tabs.value === value;
    const isDisabled = disabled === true || tabs.disabled;
    const childArray = React.Children.toArray(children);
    const inferredLabel = childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
      ? childArray.map(String).join('')
      : undefined;

    const internalRef = React.useRef<TabsFocusableNode | null>(null);
    const setRef = React.useCallback(
      (node: React.ComponentRef<typeof Pressable> | null) => {
        internalRef.current = node as TabsFocusableNode | null;
        assignRef(ref, node);
      },
      [ref],
    );

    React.useEffect(() => {
      if (
        closable &&
        !closeAccessibilityLabel &&
        typeof __DEV__ !== 'undefined' &&
        __DEV__
      ) {
        console.warn(
          `BeeUI TabsTrigger: "closable" requires "closeAccessibilityLabel" (e.g. ` +
            `"Close ${inferredLabel ?? value}") — a locale-correct name cannot be inferred, ` +
            'and the close control renders with no accessible name without it.',
        );
      }
    }, [closable, closeAccessibilityLabel, inferredLabel, value]);

    React.useEffect(() => () => listLayout?.unregister(value), [listLayout, value]);

    // Web arrow-key roving-tabindex (only meaningful inside a `scrollable` `TabsList` —
    // see `TabsListLayoutContextValue.currentValue`'s own docblock). Re-registers on
    // every render so `TabsList`'s roving logic always calls the latest closure.
    React.useEffect(() => {
      if (!listLayout?.scrollable) return;
      listLayout.registerFocusable(value, () => internalRef.current?.focus?.());
    }, [listLayout, value]);

    React.useEffect(() => {
      if (!listLayout?.scrollable) return;
      return () => listLayout.unregisterFocusable(value);
    }, [listLayout, value]);

    const handleLayout = (event: LayoutChangeEvent) => {
      listLayout?.register(value, {
        width: event.nativeEvent.layout.width,
        x: event.nativeEvent.layout.x,
      });
      onLayout?.(event);
    };

    const handleFocus = (event: Parameters<NonNullable<PressableProps['onFocus']>>[0]) => {
      if (listLayout?.scrollable) rovingFocus?.setCurrentValue(value);
      onFocus?.(event);
    };

    const handlePress = () => {
      if (!selected) {
        tabs.onValueChange?.(value);
      }
    };

    const handleClose = () => {
      onClose?.(value);
      if (selected) {
        const index = order.indexOf(value);
        const neighbour = order[index - 1] ?? order[index + 1];
        if (neighbour !== undefined) {
          tabs.onValueChange?.(neighbour);
        }
      }
    };

    const labelNode = childArray.map((child, index) =>
      typeof child === 'string' || typeof child === 'number' ? (
        <Text
          key={`tab-label-${index}`}
          className={cn(selected ? 'text-foreground' : 'text-muted-foreground', labelClassName)}
          variant="label"
        >
          {child}
        </Text>
      ) : (
        child
      ),
    );

    // `flex-1` (equal-width tabs, the pre-`scrollable` default) makes no sense once a
    // `TabsList` sizes its strip to content and scrolls it — a scrollable trigger sizes to
    // its own content (`flex-none`) instead. Outside any layout-tracking `TabsList`
    // (`listLayout` is `null`) or inside a non-`scrollable` one, behavior is unchanged.
    const sizingClassName = listLayout?.scrollable ? 'flex-none' : 'flex-1';

    // Roving tabindex (Web, `scrollable` `TabsList` only — see
    // `TabsRovingFocusContextValue.currentValue`'s own docblock): exactly one trigger is
    // Tab-reachable at a time, matching the WAI-ARIA Tabs Pattern. A non-`scrollable`
    // `TabsList` (or `listLayout` being `null` outside one entirely) leaves `tabIndex`
    // untouched — every trigger keeps ordinary Tab-key reachability, unchanged from
    // before this feature existed.
    const rovingTabIndex =
      Platform.OS === 'web' && listLayout?.scrollable
        ? (value === rovingFocus?.currentValue ? 0 : -1)
        : undefined;
    const rovingCloseTabIndex =
      Platform.OS === 'web' && listLayout?.scrollable
        ? (value === rovingFocus?.currentValue ? 0 : -1)
        : undefined;

    if (!closable) {
      return (
        <Pressable
          ref={setRef}
          {...props}
          accessibilityLabel={accessibilityLabel ?? inferredLabel}
          accessibilityRole="tab"
          accessibilityState={{
            ...accessibilityState,
            disabled: isDisabled,
            selected,
          }}
          // `accessibilityState` alone does not reach the DOM on react-native-web (it is
          // not in its forwarded-props allowlist — see Checkbox), so `role="tab"` would
          // otherwise render without the required `aria-selected`. Setting the web-native
          // `aria-selected` prop directly keeps native platforms (which read
          // `accessibilityState`) and Web (which reads `aria-*`) both correct.
          aria-selected={selected}
          className={cn(
            'min-h-9 items-center justify-center rounded-sm border px-3 py-2 active:opacity-80 web:focus-visible:bee-focus-ring',
            sizingClassName,
            selected
              ? 'border-border bg-surface-raised'
              : 'border-transparent bg-transparent',
            isDisabled && 'opacity-50',
            className,
          )}
          disabled={isDisabled}
          onFocus={handleFocus}
          onLayout={handleLayout}
          onPress={handlePress}
          tabIndex={rovingTabIndex}
        >
          {labelNode}
        </Pressable>
      );
    }

    // `closable`: the pill (border/background/selected state) moves to this wrapping
    // `View` so it can visually enclose both the tab and its close control, which render
    // as siblings inside it — never one `Pressable` nested inside another (see
    // `closable`'s own docblock above).
    return (
      <View
        className={cn(
          'min-h-9 flex-row items-stretch overflow-hidden rounded-sm border',
          sizingClassName,
          selected ? 'border-border bg-surface-raised' : 'border-transparent bg-transparent',
          isDisabled && 'opacity-50',
          className,
        )}
        onLayout={handleLayout}
      >
        <Pressable
          ref={setRef}
          {...props}
          accessibilityLabel={accessibilityLabel ?? inferredLabel}
          accessibilityRole="tab"
          accessibilityState={{
            ...accessibilityState,
            disabled: isDisabled,
            selected,
          }}
          aria-selected={selected}
          className="min-w-0 flex-1 items-center justify-center px-3 py-2 active:opacity-80 web:focus-visible:bee-focus-ring"
          disabled={isDisabled}
          onFocus={handleFocus}
          onPress={handlePress}
          tabIndex={rovingTabIndex}
        >
          {labelNode}
        </Pressable>
        <Pressable
          accessibilityLabel={closeAccessibilityLabel}
          accessibilityRole="button"
          className="items-center justify-center pe-3 ps-1 active:opacity-60 web:focus-visible:bee-focus-ring"
          disabled={isDisabled}
          onPress={handleClose}
          tabIndex={rovingCloseTabIndex}
        >
          <Text tone="muted" variant="label">
            ×
          </Text>
        </Pressable>
      </View>
    );
  },
);

TabsTrigger.displayName = 'TabsTrigger';

export type TabsContentProps = Omit<ViewProps, 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  /** Identifies this panel; it renders only while the parent `Tabs`'s `value` matches. */
  value: string;
};

export const TabsContent = React.forwardRef<React.ComponentRef<typeof View>, TabsContentProps>(
  ({ children, className, value, ...props }, ref) => {
    const tabs = useTabsContext('TabsContent');

    if (tabs.value !== value) {
      return null;
    }

    return (
      <View ref={ref} {...props} className={className} role="tabpanel">
        {children}
      </View>
    );
  },
);

TabsContent.displayName = 'TabsContent';
