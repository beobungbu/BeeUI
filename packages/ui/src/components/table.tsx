import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, ScrollView, View, type ViewProps } from 'react-native';
import { Text } from './text';
import { useDirection } from './use-direction';
import { useRequiredCallbackWarning } from './use-required-callback-warning';
import type { TableLayout, TableSortDirection } from './table-shared';

export type { TableLayout, TableSortDirection } from './table-shared';

// ---------------------------------------------------------------------------
// Internal, subtree-scoped context (not exported from the package barrel).
// Mirrors `ListGroupMembershipContext` (`list-group.tsx`) and ADR-004's
// stateless-local-context precedent: every value here is recomputed fresh on
// each `Table` render and carries no state across renders.
// ---------------------------------------------------------------------------

// `layout` decides how every descendant renders itself (real horizontal-
// scrolling row grid vs. a labelled card/block list) — ADR-007 "Responsive
// mobile strategy". Table does not measure viewport/container width itself.
const TableLayoutContext = React.createContext<TableLayout>('scroll');

function useTableLayout(): TableLayout {
  return React.useContext(TableLayoutContext);
}

// `TableHead` cells register their column's label text here as they render;
// `TableCell` looks its column's label up by the same index. One `Table`
// owns one registry for its whole subtree. The backing map is cleared and
// re-populated on every render (see `Table` below) rather than persisted
// across renders, so removed/renamed columns never leave stale entries.
type TableColumnLabelRegistry = {
  getLabel: (columnIndex: number | undefined) => string | undefined;
  setLabel: (columnIndex: number | undefined, label: string | undefined) => void;
};

const TableColumnLabelRegistryContext = React.createContext<TableColumnLabelRegistry | null>(null);

function useTableColumnLabel(columnIndex: number | undefined): string | undefined {
  const registry = React.useContext(TableColumnLabelRegistryContext);
  return registry?.getLabel(columnIndex);
}

// Column position is assigned by the nearest `TableRow`, which knows the
// concrete, already-resolved `children` it was given and can therefore
// compute indices with a pure `React.Children.map` pass (no side-effecting
// counter mutated during render, which would double-count under React's
// StrictMode dev double-invoke). It is threaded down as a plain internal prop
// rather than a second context.
type TableColumnPositionProps = {
  /** @internal assigned by the parent `TableRow` — not part of the public API. */
  columnIndex?: number;
};

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export type TableProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Responsive presentation. Defaults to `'scroll'` (horizontal `ScrollView`
   * around the row grid). Set `'stacked'` to render a card/label-value
   * presentation instead — typically driven by the caller's own breakpoint
   * decision (BeeUI does not own viewport/breakpoint policy).
   */
  layout?: TableLayout;
};

export const Table = React.forwardRef<React.ComponentRef<typeof View>, TableProps>(
  ({ children, className, layout = 'scroll', ...props }, ref) => {
    const labelsRef = React.useRef<Map<number, string>>(new Map());
    // Fresh registry contents every render — see `TableColumnLabelRegistry` above.
    labelsRef.current.clear();
    const registry = React.useMemo<TableColumnLabelRegistry>(
      () => ({
        getLabel: (columnIndex) =>
          columnIndex === undefined ? undefined : labelsRef.current.get(columnIndex),
        setLabel: (columnIndex, label) => {
          if (columnIndex === undefined) return;
          if (label === undefined) labelsRef.current.delete(columnIndex);
          else labelsRef.current.set(columnIndex, label);
        },
      }),
      [],
    );

    // Native has no CSS table layout algorithm. A horizontal `ScrollView`
    // sets its content container to `flexDirection: 'row'`, so a full-width
    // `TableCaption` cannot be a sibling of the row stack inside that
    // ScrollView without being pulled onto the same horizontal axis. Caption
    // children render outside the scroll region; everything else
    // (`TableHeader`/`TableBody`/`TableFooter`) renders inside it.
    const captionChildren: React.ReactNode[] = [];
    const gridChildren: React.ReactNode[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === TableCaption) captionChildren.push(child);
      else gridChildren.push(child);
    });

    return (
      <TableLayoutContext.Provider value={layout}>
        <TableColumnLabelRegistryContext.Provider value={registry}>
          <View ref={ref} {...props} className={cn('w-full', className)}>
            {layout === 'stacked' ? (
              <View className="gap-density-row-gap">{gridChildren}</View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="min-w-full">{gridChildren}</View>
              </ScrollView>
            )}
            {captionChildren}
          </View>
        </TableColumnLabelRegistryContext.Provider>
      </TableLayoutContext.Provider>
    );
  },
);

Table.displayName = 'Table';

// ---------------------------------------------------------------------------
// TableCaption
// ---------------------------------------------------------------------------

export type TableCaptionProps = Omit<React.ComponentProps<typeof Text>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableCaption = React.forwardRef<React.ComponentRef<typeof Text>, TableCaptionProps>(
  ({ children, className, ...props }, ref) => (
    <Text
      ref={ref}
      {...props}
      className={cn('px-1 py-2 text-center', className)}
      tone="muted"
      variant="caption"
    >
      {children}
    </Text>
  ),
);

TableCaption.displayName = 'TableCaption';

// ---------------------------------------------------------------------------
// TableHeader / TableBody / TableFooter
// ---------------------------------------------------------------------------

export type TableHeaderProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableHeader = React.forwardRef<React.ComponentRef<typeof View>, TableHeaderProps>(
  ({ children, style, ...props }, ref) => {
    const layout = useTableLayout();
    return (
      // Stacked layout inlines each column's label next to its own value
      // (see `TableCell`), so the header row becomes redundant. It stays
      // mounted (its `TableHead` cells still register column labels) but is
      // hidden from layout *and* the accessibility tree via `display: 'none'`
      // rather than removed, so registration keeps running every render.
      <View
        ref={ref}
        {...props}
        style={layout === 'stacked' ? [style, { display: 'none' }] : style}
      >
        {children}
      </View>
    );
  },
);

TableHeader.displayName = 'TableHeader';

export type TableBodyProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableBody = React.forwardRef<React.ComponentRef<typeof View>, TableBodyProps>(
  ({ children, className, ...props }, ref) => {
    const layout = useTableLayout();
    return (
      <View
        ref={ref}
        {...props}
        className={cn(layout === 'stacked' && 'gap-density-row-gap', className)}
      >
        {children}
      </View>
    );
  },
);

TableBody.displayName = 'TableBody';

export type TableFooterProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableFooter = React.forwardRef<React.ComponentRef<typeof View>, TableFooterProps>(
  ({ children, className, ...props }, ref) => {
    const layout = useTableLayout();
    return (
      <View
        ref={ref}
        {...props}
        className={cn(
          layout === 'stacked' ? 'gap-density-row-gap' : 'border-t border-border bg-surface-muted',
          className,
        )}
      >
        {children}
      </View>
    );
  },
);

TableFooter.displayName = 'TableFooter';

// ---------------------------------------------------------------------------
// TableRow
// ---------------------------------------------------------------------------

export type TableRowProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Visual highlight for a caller-selected row. Table owns no selection
   * state (ADR-007) — this only reflects a boolean the caller already tracks
   * (e.g. alongside a `Checkbox` in one of the row's cells).
   */
  selected?: boolean;
};

export const TableRow = React.forwardRef<React.ComponentRef<typeof View>, TableRowProps>(
  ({ accessibilityState, children, className, selected = false, ...props }, ref) => {
    const layout = useTableLayout();
    const direction = useDirection();

    let nextColumnIndex = 0;
    const content = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child;
      if (child.type !== TableHead && child.type !== TableCell) return child;
      const columnIndex = nextColumnIndex;
      const colSpanProp = (child.props as { colSpan?: number }).colSpan;
      const span = Number.isFinite(colSpanProp) ? Math.max(1, Math.floor(colSpanProp as number)) : 1;
      nextColumnIndex += span;
      return React.cloneElement(child as React.ReactElement<TableColumnPositionProps>, {
        columnIndex,
      });
    });

    if (layout === 'stacked') {
      return (
        <View
          accessibilityState={{ ...accessibilityState, selected }}
          ref={ref}
          {...props}
          className={cn(
            'gap-1 rounded-lg border border-border bg-surface p-3',
            selected && 'border-primary',
            className,
          )}
        >
          {content}
        </View>
      );
    }

    return (
      <View
        accessibilityState={{ ...accessibilityState, selected }}
        ref={ref}
        {...props}
        className={cn(
          // No `last:` pseudo-class variant here (unlike the Web file): CSS
          // pseudo-class selectors have no native equivalent, so every row
          // keeps its bottom border rather than assuming an unverified
          // Uniwind capability (`TimelineItem` computes "last" in JS for the
          // same reason).
          'min-h-density-row-height flex-row items-stretch border-b border-border',
          direction === 'rtl' && 'flex-row-reverse',
          selected && 'bg-surface-raised',
          className,
        )}
      >
        {content}
      </View>
    );
  },
);

TableRow.displayName = 'TableRow';

// ---------------------------------------------------------------------------
// TableHead
// ---------------------------------------------------------------------------

export type TableHeadProps = Omit<ViewProps, 'children'> &
  TableColumnPositionProps & {
    children?: React.ReactNode;
    className?: string;
    /**
     * Explicit column label override. Required when this header's content is
     * not plain text/number (e.g. an icon-only header) — inferred from
     * `children` otherwise. Drives both `layout="stacked"`'s visible
     * label-value pairing and the column context folded into each native
     * `TableCell`'s accessible name (RN has no dedicated table/column-header
     * accessibility role to rely on instead — ADR-007).
     */
    label?: string;
    /** Caller-driven sort-toggle callback. Table stores no sort state. */
    onSortChange?: () => void;
    /**
     * Controlled current sort state for this column. Presence of this prop
     * (any of the three values) marks the column sortable and renders an
     * interactive sort trigger reachable by normal tab order.
     */
    sortDirection?: TableSortDirection;
  };

const sortGlyphs: Record<TableSortDirection, string> = {
  ascending: '↑',
  descending: '↓',
  none: '↕',
};

export const TableHead = React.forwardRef<React.ComponentRef<typeof View>, TableHeadProps>(
  (
    {
      accessibilityLabel,
      children,
      className,
      columnIndex,
      label,
      onSortChange,
      sortDirection,
      ...props
    },
    ref,
  ) => {
    const layout = useTableLayout();
    const registry = React.useContext(TableColumnLabelRegistryContext);
    const isPlainContent = typeof children === 'string' || typeof children === 'number';
    const resolvedLabel = label ?? (isPlainContent ? String(children) : undefined);
    const sortable = sortDirection !== undefined;

    useRequiredCallbackWarning('TableHead', 'onSortChange', onSortChange, !sortable);

    // Registered synchronously during render (not in an effect): React
    // renders `TableHeader`'s cells before `TableBody`'s in the same pass
    // (JSX declaration order), so `TableCell` can read this column's label
    // via `getLabel` the very first time it renders. The write is idempotent
    // (same columnIndex/label in, same map entry out) so React's dev-mode
    // double-render of this component cannot corrupt it.
    registry?.setLabel(columnIndex, resolvedLabel);

    const sortSuffix =
      sortDirection === 'ascending'
        ? ', sorted ascending'
        : sortDirection === 'descending'
          ? ', sorted descending'
          : sortable
            ? ', not sorted'
            : '';
    const computedAccessibilityLabel =
      accessibilityLabel ?? (resolvedLabel ? `${resolvedLabel}${sortSuffix}` : undefined);

    const textNode = isPlainContent ? (
      <Text className="shrink" variant="label">
        {children}
      </Text>
    ) : (
      children
    );

    const innerContent = sortable ? (
      <Pressable
        accessibilityLabel={computedAccessibilityLabel}
        accessibilityRole="button"
        className="flex-row items-center gap-1 active:opacity-80"
        onPress={onSortChange}
      >
        {textNode}
        <Text tone="muted" variant="label">
          {sortGlyphs[sortDirection ?? 'none']}
        </Text>
      </Pressable>
    ) : (
      textNode
    );

    if (layout === 'stacked') {
      // Registration-only render (see `TableHeader`'s `display: 'none'`
      // wrapper); still needs valid layout props so measurement never throws.
      return (
        <View ref={ref} {...props} className={className}>
          {innerContent}
        </View>
      );
    }

    return (
      <View
        ref={ref}
        {...props}
        className={cn('min-w-0 flex-1 justify-center px-3 py-2', className)}
      >
        {innerContent}
      </View>
    );
  },
);

TableHead.displayName = 'TableHead';

// ---------------------------------------------------------------------------
// TableCell
// ---------------------------------------------------------------------------

export type TableCellProps = Omit<ViewProps, 'children'> &
  TableColumnPositionProps & {
    children?: React.ReactNode;
    className?: string;
    /**
     * Number of columns this cell spans (e.g. a single full-width cell used
     * for an empty/loading/error row — see `Table`'s composition notes).
     * Native has no table-layout engine, so a spanning cell approximates
     * width by growing its flex share proportionally (`flex: colSpan`)
     * rather than measuring sibling column widths.
     */
    colSpan?: number;
    /**
     * Explicit column label override for `layout="stacked"` and native
     * accessible-name column context. Falls back to the corresponding
     * `TableHead`'s inferred label when omitted.
     */
    label?: string;
  };

export const TableCell = React.forwardRef<React.ComponentRef<typeof View>, TableCellProps>(
  (
    { accessibilityLabel, children, className, colSpan = 1, columnIndex, label, style, ...props },
    ref,
  ) => {
    const layout = useTableLayout();
    const registeredLabel = useTableColumnLabel(columnIndex);
    const resolvedLabel = label ?? registeredLabel;
    const isPlainContent = typeof children === 'string' || typeof children === 'number';
    const span = Number.isFinite(colSpan) ? Math.max(1, Math.floor(colSpan)) : 1;

    if (layout === 'stacked') {
      return (
        <View
          ref={ref}
          {...props}
          className={cn(
            'flex-row items-start justify-between gap-3 border-b border-border py-2',
            className,
          )}
          style={style}
        >
          {resolvedLabel ? (
            <Text className="shrink-0" tone="muted" variant="caption">
              {resolvedLabel}
            </Text>
          ) : null}
          <View className="min-w-0 flex-1 items-end">
            {isPlainContent ? (
              <Text className="text-end" variant="body">
                {children}
              </Text>
            ) : (
              children
            )}
          </View>
        </View>
      );
    }

    // Web gets header/cell association for free from `<th scope>`. Native has
    // no equivalent, so a plain-text cell folds its column's label into the
    // accessible name here (ADR-007). Complex content (icons, nested
    // interactive controls) is left untouched so a caller-supplied control's
    // own accessibility contract is never swallowed by a synthetic label.
    const computedAccessibilityLabel =
      accessibilityLabel ?? (resolvedLabel && isPlainContent ? `${resolvedLabel}: ${children}` : undefined);

    return (
      <View
        accessibilityLabel={computedAccessibilityLabel}
        accessible={computedAccessibilityLabel ? true : undefined}
        ref={ref}
        {...props}
        className={cn('min-w-0 justify-center px-3 py-2', className)}
        style={[{ flex: span }, style]}
      >
        {isPlainContent ? <Text variant="body">{children}</Text> : children}
      </View>
    );
  },
);

TableCell.displayName = 'TableCell';
