import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type LayoutChangeEvent, type ViewProps, Platform } from 'react-native';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { useDirection } from './use-direction';

// A trailing space reserved once at least one item collapses, so the
// remaining visible items plus the overflow trigger button itself never
// overflow the measured container width. `control-compact`'s own 36px
// (`--spacing-control-compact`) is the smallest control height/width BeeUI
// ships (`icon-button.tsx`'s `sm` size), reused here as a conservative
// estimate for the icon-only overflow trigger's own footprint.
const OVERFLOW_TRIGGER_WIDTH_RESERVATION = 36;

// Sentinel id for the overflow trigger's own slot in the roving-tabindex sequence — see
// `ToolbarSequenceEntry`. Distinguishable from every `item-<index>` id.
const OVERFLOW_SEQUENCE_ID = '__toolbar-overflow__';

type WebKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
};

type ToolbarFocusableNode = { focus?: () => void };

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref && typeof ref === 'object' && 'current' in ref) {
    (ref as React.RefObject<T | null>).current = value;
  }
}

export type ToolbarItemProps = {
  /**
   * Rendered in the toolbar row while this item fits. A single element is expected — an
   * `IconButton`/`Button` is the common case — since `Toolbar` reads its rendered width to
   * decide what fits, and (on Web) clones it to wire `ref`/`tabIndex`/`onFocus` for
   * arrow-key roving-tabindex navigation, preserving any `ref`/`onFocus` the element
   * already carries. Content and every other prop are left untouched.
   */
  children: React.ReactNode;
  className?: string;
  /** Disables this item everywhere it renders: in the toolbar row and inside the overflow menu. Defaults to false. */
  disabled?: boolean;
  /** Icon shown next to `label` when this item renders inside the overflow menu instead of the row. */
  icon?: React.ReactNode;
  /**
   * Accessible label and overflow-menu row text for this item. Required — the overflow menu
   * has no other way to describe a collapsed item's action.
   */
  label: string;
  /** Called when this item is activated, whether it currently renders in the toolbar row or the overflow menu. */
  onPress?: () => void;
  /**
   * Collapse priority: an item with a **lower** number collapses first when the row does
   * not fit. Items that omit `priority` never collapse — they always render in the row,
   * even if that means the row itself overflows. Items sharing the same priority collapse
   * in trailing-to-leading order (the later item in `children` order collapses first).
   */
  priority?: number;
};

/**
 * Declares one toolbar action and how it behaves once `Toolbar` runs out of row space. Not a
 * rendering primitive on its own — `Toolbar` reads each `ToolbarItem`'s props to lay out the
 * row and the overflow menu; a `ToolbarItem` rendered outside a `Toolbar` renders nothing.
 */
const isWeb = Platform.OS === 'web';
// react-native-web supports `visibility` even though React Native's ViewStyle type omits it.
const measurementLayerStyle = { visibility: 'hidden' } as unknown as ViewProps['style'];

export function ToolbarItem(_props: ToolbarItemProps): React.ReactElement | null {
  return null;
}

ToolbarItem.displayName = 'ToolbarItem';

type ResolvedToolbarItem = ToolbarItemProps & { index: number };

type ToolbarOverflowMenuProps = {
  accessibilityLabel?: string;
  items: ResolvedToolbarItem[];
  /** Roving-tabindex `onFocus` (see `Toolbar`'s own roving-focus section) — updates the roving "current" slot when the trigger receives focus by any means (Tab, mouse). */
  onFocus?: (event: unknown) => void;
  /** Base `testID` (Toolbar's own `testID`, when given) — derives the trigger's and each menu row's own `testID` for targeting them in tests. */
  testID?: string;
  /** Roving-tabindex value (see `Toolbar`'s own roving-focus section): `0` when this trigger is the sequence's "current" slot, `-1` otherwise. `undefined` outside Web. */
  tabIndex?: 0 | -1;
};

// Internal — not exported from the package barrel. A thin `DropdownMenu` composition so the
// overflow trigger gets `aria-haspopup="menu"` and full keyboard/dismiss behavior for free
// from the existing family, rather than a second bespoke popover implementation. Forwards its
// ref to the trigger so `Toolbar`'s roving-tabindex sequence can call `.focus()` on it, the
// same as every row item.
const ToolbarOverflowMenu = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuTrigger>,
  ToolbarOverflowMenuProps
>(({ accessibilityLabel, items, onFocus, tabIndex, testID }, ref) => {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        ref={ref}
        accessibilityLabel={accessibilityLabel}
        onFocus={onFocus}
        size="icon"
        tabIndex={tabIndex}
        testID={testID ? `${testID}-overflow-trigger` : undefined}
        variant="ghost"
      >
        {'⋯'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" testID={testID ? `${testID}-overflow-content` : undefined}>
        {items.map((item) => (
          <DropdownMenuItem
            disabled={item.disabled}
            key={item.index}
            onSelect={item.onPress}
            testID={testID ? `${testID}-overflow-item-${item.index}` : undefined}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

ToolbarOverflowMenu.displayName = 'ToolbarOverflowMenu';

function computeCollapsedIndices(
  items: ResolvedToolbarItem[],
  itemWidths: Readonly<Record<number, number>>,
  containerWidth: number | null,
): ReadonlySet<number> {
  if (containerWidth === null) return new Set();

  const total = items.reduce((sum, item) => sum + (itemWidths[item.index] ?? 0), 0);
  if (total <= containerWidth) return new Set();

  // Lower `priority` collapses first; a tie collapses in trailing-to-leading (higher
  // `index`) order — see `ToolbarItemProps.priority`'s own docblock.
  const collapsible = items
    .filter((item) => item.priority !== undefined)
    .sort((a, b) => {
      const priorityDelta = (a.priority ?? 0) - (b.priority ?? 0);
      return priorityDelta !== 0 ? priorityDelta : b.index - a.index;
    });

  const collapsed = new Set<number>();
  let remaining = total;
  const budget = containerWidth - OVERFLOW_TRIGGER_WIDTH_RESERVATION;

  for (const item of collapsible) {
    if (remaining <= budget) break;
    collapsed.add(item.index);
    remaining -= itemWidths[item.index] ?? 0;
  }

  return collapsed;
}

export type ToolbarProps = Omit<ViewProps, 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Accessible name for the trailing overflow menu button. Required whenever any child
   * `ToolbarItem` declares a `priority` (only a prioritized item can ever collapse) — a dev
   * warning fires if it is missing once the overflow menu actually renders.
   */
  overflowAccessibilityLabel?: string;
};

/**
 * Single-row toolbar that measures its own width and every `ToolbarItem` child's natural
 * width, then moves whichever items do not fit into a trailing overflow `DropdownMenu`
 * (lowest `priority` first — see `ToolbarItemProps.priority`). Defaults to `w-full` so its
 * measured width reflects the space its parent actually gives it, not just its own visible
 * children's combined width — override via `className` when a different width contract is
 * needed. A collapsed item keeps its `onPress`/`label`/`icon` in the overflow menu.
 */
export const Toolbar = React.forwardRef<React.ComponentRef<typeof View>, ToolbarProps>(
  ({ children, className, onLayout, overflowAccessibilityLabel, testID, ...props }, ref) => {
    const [containerWidth, setContainerWidth] = React.useState<number | null>(null);
    const [itemWidths, setItemWidths] = React.useState<Record<number, number>>({});

    const items = React.useMemo<ResolvedToolbarItem[]>(
      () =>
        React.Children.toArray(children)
          .filter(
            (child): child is React.ReactElement<ToolbarItemProps> =>
              React.isValidElement(child) && child.type === ToolbarItem,
          )
          .map((child, index) => ({ index, ...child.props })),
      [children],
    );

    const collapsedIndices = React.useMemo(
      () => computeCollapsedIndices(items, itemWidths, containerWidth),
      [containerWidth, itemWidths, items],
    );

    React.useEffect(() => {
      if (
        collapsedIndices.size > 0 &&
        !overflowAccessibilityLabel &&
        typeof __DEV__ !== 'undefined' &&
        __DEV__
      ) {
        console.warn(
          'BeeUI Toolbar: the overflow menu is rendering but `overflowAccessibilityLabel` ' +
            'is missing — its trigger button has no accessible name without it.',
        );
      }
    }, [collapsedIndices, overflowAccessibilityLabel]);

    const registerItemWidth = React.useCallback((index: number, width: number) => {
      setItemWidths((current) => (current[index] === width ? current : { ...current, [index]: width }));
    }, []);

    const handleContainerLayout = (event: LayoutChangeEvent) => {
      setContainerWidth(event.nativeEvent.layout.width);
      onLayout?.(event);
    };

    const overflowItems = items.filter((item) => collapsedIndices.has(item.index));
    const visibleItems = items.filter((item) => !collapsedIndices.has(item.index));

    // --- Web roving-tabindex (WAI-ARIA Toolbar Pattern) -----------------------------------
    // One item is Tab-reachable at a time; ArrowLeft/ArrowRight move the roving "current"
    // slot with wrap-around (RTL-aware), Home/End jump to the first/last. Applies only to
    // visible row items whose cloned child actually mounted and registered a focus function
    // (see `registerItemFocus`/`focusableIds` below) plus the overflow trigger, which is
    // always the sequence's last stop once anything has collapsed — a collapsed item itself
    // is only reachable by opening that menu, never directly. An item whose child rendered
    // null/text/a `Fragment` (or any element that never attaches a ref) never occupies a
    // sequence slot, so the single `tabIndex=0` never lands on a dead control.
    const direction = useDirection();
    const focusablesRef = React.useRef<Map<string, () => void>>(new Map());
    const focusableIdsSnapshotRef = React.useRef<ReadonlySet<string>>(new Set());
    const [focusableIds, setFocusableIds] = React.useState<ReadonlySet<string>>(() => new Set());
    const warnedNonFocusableIdsRef = React.useRef<Set<string>>(new Set());
    const [currentId, setCurrentIdState] = React.useState<string | null>(null);

    const sequence = React.useMemo(() => {
      const visibleEntries = visibleItems
        .filter((item) => focusableIds.has(`item-${item.index}`))
        .map((item) => ({
          disabled: item.disabled === true,
          id: `item-${item.index}`,
        }));
      return overflowItems.length > 0
        ? [...visibleEntries, { disabled: false, id: OVERFLOW_SEQUENCE_ID }]
        : visibleEntries;
    }, [focusableIds, overflowItems.length, visibleItems]);

    // The roving-tabindex "current" slot: the last one explicitly focused/navigated to,
    // falling back to the first enabled slot. Computed at render time (not in an effect) so
    // the very first render already has exactly one `tabIndex={0}` control.
    const resolvedCurrentId = React.useMemo(() => {
      if (currentId && sequence.some((entry) => entry.id === currentId && !entry.disabled)) {
        return currentId;
      }
      return sequence.find((entry) => !entry.disabled)?.id ?? null;
    }, [currentId, sequence]);

    const registerItemFocus = React.useCallback((id: string, focus: (() => void) | null) => {
      if (focus) focusablesRef.current.set(id, focus);
      else focusablesRef.current.delete(id);
    }, []);

    // `withRovingFocus` recreates its `ref` callback on every render (it closes over
    // per-render values like `resolvedCurrentId`), so React detaches/reattaches every
    // cloned child's ref on every commit — `registerItemFocus` above runs far more often
    // than "an item actually became (non-)focusable". Deliberately no dependency array:
    // this must re-check `focusablesRef` after *every* commit (there is no prop/state this
    // effect could depend on that would fire exactly when a ref actually changes), and only
    // calling `setFocusableIds` when the resolved id set actually changed — not on every
    // run — is what keeps that per-render ref churn from ever becoming a render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useLayoutEffect(() => {
      const next = new Set(focusablesRef.current.keys());
      const previous = focusableIdsSnapshotRef.current;
      const unchanged =
        next.size === previous.size && Array.from(next).every((id) => previous.has(id));
      if (unchanged) return;
      focusableIdsSnapshotRef.current = next;
      setFocusableIds(next);
    });

    const warnNonFocusableChildOnce = React.useCallback((id: string, label: string) => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;
      if (warnedNonFocusableIdsRef.current.has(id)) return;
      warnedNonFocusableIdsRef.current.add(id);
      console.warn(
        `BeeUI Toolbar: the "${label}" item's children did not render a focusable control ` +
          '(a Fragment or other non-element child) — it is skipped in keyboard/roving-tabindex ' +
          'navigation.',
      );
    }, []);

    const handleItemFocus = React.useCallback((id: string) => {
      setCurrentIdState(id);
    }, []);

    const focusEntry = React.useCallback((id: string | undefined) => {
      if (id === undefined) return;
      focusablesRef.current.get(id)?.();
      setCurrentIdState(id);
    }, []);

    const moveCurrent = React.useCallback(
      (delta: 1 | -1) => {
        const enabled = sequence.filter((entry) => !entry.disabled);
        if (!enabled.length) return;
        const index = enabled.findIndex((entry) => entry.id === resolvedCurrentId);
        const baseIndex = index >= 0 ? index : delta > 0 ? -1 : 0;
        const nextIndex = (baseIndex + delta + enabled.length) % enabled.length;
        focusEntry(enabled[nextIndex]?.id);
      },
      [focusEntry, resolvedCurrentId, sequence],
    );

    const handleWebKeyDown = React.useCallback(
      (event: WebKeyboardEvent) => {
        const enabled = sequence.filter((entry) => !entry.disabled);
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
            focusEntry(enabled[0]?.id);
            break;
          case 'End':
            event.preventDefault?.();
            focusEntry(enabled[enabled.length - 1]?.id);
            break;
          default:
            break;
        }
      },
      [direction, focusEntry, moveCurrent, sequence],
    );

    // `item.children` is a caller-supplied `React.ReactNode` (typically an `IconButton`/
    // `Button` — see `ToolbarItemProps.children`'s own docblock), so its concrete prop
    // shape is unknown to this generic wrapper. The cast only asserts the narrow
    // `ref`/`onFocus`/`tabIndex` triple every BeeUI-owned focusable control already
    // accepts (the same contract `Button`'s own `...props` passthrough documents).
    function withRovingFocus(item: ResolvedToolbarItem): React.ReactNode {
      const child = item.children;
      const id = `item-${item.index}`;
      // `null`/`undefined`/`false` is the normal "conditionally hide this item" pattern (e.g.
      // `condition && <IconButton .../>`) — silently skip it. A `Fragment` (React never
      // attaches a `ref` to one) or any other non-element value (text/number) is unlikely to
      // be intentional, so warn once in dev; either way, the item is skipped and never claims
      // a roving-tabindex slot (see `sequence`'s `focusableIds` filter above).
      if (!React.isValidElement(child) || child.type === React.Fragment) {
        if (child !== null && child !== undefined && child !== false) {
          warnNonFocusableChildOnce(id, item.label);
        }
        return child;
      }
      const tabIndexValue = Platform.OS === 'web' ? (id === resolvedCurrentId ? 0 : -1) : undefined;
      const element = child as React.ReactElement<{
        onFocus?: (event: unknown) => void;
        ref?: React.Ref<ToolbarFocusableNode>;
        tabIndex?: 0 | -1;
      }> & { ref?: React.Ref<ToolbarFocusableNode> };
      // React 19 exposes `ref` via `props.ref`; older element shapes still carry it on the
      // element itself — read whichever is present so a caller-supplied `ref` on the
      // child is preserved instead of silently overwritten.
      const originalRef = element.props.ref ?? element.ref;
      const originalOnFocus = element.props.onFocus;
      return React.cloneElement(element, {
        onFocus: (event: unknown) => {
          handleItemFocus(id);
          originalOnFocus?.(event);
        },
        ref: (node: ToolbarFocusableNode | null) => {
          assignRef(originalRef, node);
          registerItemFocus(id, node ? () => node.focus?.() : null);
        },
        tabIndex: tabIndexValue,
      });
    }

    const webKeyboardProps =
      Platform.OS === 'web' ? ({ onKeyDown: handleWebKeyDown } as unknown as ViewProps) : ({} as ViewProps);

    return (
      <View
        ref={ref}
        {...props}
        {...webKeyboardProps}
        accessibilityRole="toolbar"
        className={cn('relative w-full flex-row items-center gap-1', className)}
        onLayout={handleContainerLayout}
        testID={testID}
      >
        {/*
          Hidden measurement pass: renders every item at its natural (never-collapsed) width
          so `itemWidths` reflects real content size regardless of which items the visible
          row below currently shows. Positioned absolutely (out of normal flow, so it never
          affects the visible row's layout or this container's own height) and never
          toggles which items are present, so a previously-measured width is never zeroed
          out the moment an item collapses — the bug a "just hide the collapsed item" naive
          implementation would have.
        */}
        <View
          accessibilityElementsHidden
          aria-hidden
          className="absolute inset-x-0 top-0 flex-row items-center gap-1 opacity-0"
          pointerEvents="none"
          // Web: `visibility: hidden` keeps the layout box (so `onLayout` still measures)
          // but makes every descendant unfocusable, which `aria-hidden` alone does not.
          style={isWeb ? measurementLayerStyle : undefined}
          testID={testID ? `${testID}-measure` : undefined}
        >
          {items.map((item) => (
            <View
              key={item.index}
              onLayout={(event) => registerItemWidth(item.index, event.nativeEvent.layout.width)}
              testID={testID ? `${testID}-measure-${item.index}` : undefined}
            >
              {item.children}
            </View>
          ))}
        </View>
        {visibleItems.map((item) => (
          <React.Fragment key={item.index}>{withRovingFocus(item)}</React.Fragment>
        ))}
        {overflowItems.length > 0 ? (
          <ToolbarOverflowMenu
            ref={(node) =>
              registerItemFocus(
                OVERFLOW_SEQUENCE_ID,
                node ? () => (node as ToolbarFocusableNode).focus?.() : null,
              )
            }
            accessibilityLabel={overflowAccessibilityLabel}
            items={overflowItems}
            onFocus={() => handleItemFocus(OVERFLOW_SEQUENCE_ID)}
            tabIndex={
              Platform.OS === 'web' ? (OVERFLOW_SEQUENCE_ID === resolvedCurrentId ? 0 : -1) : undefined
            }
            testID={testID}
          />
        ) : null}
      </View>
    );
  },
);

Toolbar.displayName = 'Toolbar';
