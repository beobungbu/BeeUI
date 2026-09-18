import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type LayoutChangeEvent, type ViewProps, Platform } from 'react-native';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

// A trailing space reserved once at least one item collapses, so the
// remaining visible items plus the overflow trigger button itself never
// overflow the measured container width. `control-compact`'s own 36px
// (`--spacing-control-compact`) is the smallest control height/width BeeUI
// ships (`icon-button.tsx`'s `sm` size), reused here as a conservative
// estimate for the icon-only overflow trigger's own footprint.
const OVERFLOW_TRIGGER_WIDTH_RESERVATION = 36;

export type ToolbarItemProps = {
  /**
   * Rendered in the toolbar row while this item fits. A single element is expected — an
   * `IconButton`/`Button` is the common case — since `Toolbar` reads its rendered width to
   * decide what fits; it is never cloned or otherwise modified.
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
  /** Base `testID` (Toolbar's own `testID`, when given) — derives the trigger's and each menu row's own `testID` for targeting them in tests. */
  testID?: string;
};

// Internal — not exported from the package barrel. A thin `DropdownMenu` composition so the
// overflow trigger gets `aria-haspopup="menu"` and full keyboard/dismiss behavior for free
// from the existing family, rather than a second bespoke popover implementation.
function ToolbarOverflowMenu({ accessibilityLabel, items, testID }: ToolbarOverflowMenuProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        accessibilityLabel={accessibilityLabel}
        size="icon"
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
}

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

    return (
      <View
        ref={ref}
        {...props}
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
        {items
          .filter((item) => !collapsedIndices.has(item.index))
          .map((item) => (
            <React.Fragment key={item.index}>{item.children}</React.Fragment>
          ))}
        {overflowItems.length > 0 ? (
          <ToolbarOverflowMenu
            accessibilityLabel={overflowAccessibilityLabel}
            items={overflowItems}
            testID={testID}
          />
        ) : null}
      </View>
    );
  },
);

Toolbar.displayName = 'Toolbar';
