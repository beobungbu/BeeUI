import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, ScrollView, View, type ViewProps } from 'react-native';
import { Text } from './text';
import { useDirection } from './use-direction';
import { useRequiredCallbackWarning } from './use-required-callback-warning';
import { resolveTableDensityRowHeight, type TableAlign, type TableDensity, type TableLayout, type TableSortDirection } from './table-shared';

export type { TableAlign, TableDensity, TableLayout, TableSortDirection } from './table-shared';

// Native has no CSS text-align-for-block-content engine, so `align` drives
// the cross-axis `align-items` of each header/cell's own row-direction flex
// layout instead — the native half of the `align` contract `table-shared.ts`
// documents. A literal, static record (never a template-built class name),
// matching this repo's "no dynamically constructed utility classes" rule.
const alignItemsClassName: Record<TableAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
};

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

// `density` resolves to a row-height pixel number here (rather than re-exposing the
// `TableDensity` string itself) so `TableRow` never needs to re-import
// `resolveTableDensityRowHeight` or re-derive the mapping — one Table renders one resolved
// value for its whole subtree. `undefined` means "no override": rows keep following the
// ambient `min-h-density-row-height` global-density class exactly as before this prop
// existed (`layout="stacked"` rows ignore this entirely — see `TableRow` below).
const TableDensityRowHeightContext = React.createContext<number | undefined>(undefined);

function useTableDensityRowHeight(): number | undefined {
  return React.useContext(TableDensityRowHeightContext);
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
   * Per-table row-height override for `layout="scroll"` rows, replacing the ambient global
   * application-density row height for this one `Table` only — see `TableDensity`. Omitted
   * (the default) leaves every row following the global density exactly as before this prop
   * existed; existing tables are unaffected.
   */
  density?: TableDensity;
  /**
   * Responsive presentation. Defaults to `'scroll'` (horizontal `ScrollView`
   * around the row grid). Set `'stacked'` to render a card/label-value
   * presentation instead — typically driven by the caller's own breakpoint
   * decision (BeeUI does not own viewport/breakpoint policy).
   */
  layout?: TableLayout;
};

export const Table = React.forwardRef<React.ComponentRef<typeof View>, TableProps>(
  ({ children, className, density, layout = 'scroll', ...props }, ref) => {
    const densityRowHeight = density === undefined ? undefined : resolveTableDensityRowHeight(density);
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
        <TableDensityRowHeightContext.Provider value={densityRowHeight}>
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
        </TableDensityRowHeightContext.Provider>
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
   * Makes the row itself pressable (e.g. a row-to-detail navigation pattern:
   * `onPress={() => router.push(...)}`), mirroring `ListItem`'s own opt-in
   * `onPress` contract. Renders the row as a `Pressable` with
   * `accessibilityRole="button"` (keyboard Enter/Space activate it on Web
   * through RN's own Pressable-on-Web keyboard handling) instead of a plain
   * `View` — a row with no `onPress` keeps rendering exactly as before.
   */
  onPress?: () => void;
  /**
   * Visual highlight for a caller-selected row. Table owns no selection
   * state (ADR-007) — this only reflects a boolean the caller already tracks
   * (e.g. alongside a `Checkbox` in one of the row's cells).
   */
  selected?: boolean;
};

export const TableRow = React.forwardRef<React.ComponentRef<typeof View>, TableRowProps>(
  ({ accessibilityState, children, className, onPress, selected = false, style, ...props }, ref) => {
    const layout = useTableLayout();
    const direction = useDirection();
    const densityRowHeight = useTableDensityRowHeight();
    const interactive = typeof onPress === 'function';
    const resolvedAccessibilityState = { ...accessibilityState, selected };

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
      const stackedClassName = cn(
        'gap-1 rounded-lg border border-border bg-surface p-3',
        interactive && 'active:opacity-80 web:hover:bg-surface-muted',
        // `bg-primary/10` (not `bg-surface-raised`): several themes define
        // `--color-surface-raised` equal to `--color-surface` (e.g. every
        // light theme in this repo's token set), so a "selected" row painted
        // that way computed to the exact same background as an unselected
        // one — a real, currently-reproducible bug, not just a missing
        // class. `bg-primary/10` is guaranteed distinct from the surface in
        // every theme because it derives from `--color-primary`, never the
        // surface token itself.
        selected && 'border-primary bg-primary/10',
        className,
      );

      // `density` is a `layout="scroll"` row-height override — `layout="stacked"` renders a
      // card, not a fixed-height row, so it ignores `densityRowHeight` and forwards `style`
      // unchanged.
      return interactive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={resolvedAccessibilityState}
          onPress={onPress}
          ref={ref}
          {...props}
          className={stackedClassName}
          style={style}
        >
          {content}
        </Pressable>
      ) : (
        <View
          accessibilityState={resolvedAccessibilityState}
          ref={ref}
          {...props}
          className={stackedClassName}
          style={style}
        >
          {content}
        </View>
      );
    }

    // `densityRowHeight` (from the parent `Table`'s `density` prop) overrides the ambient
    // `min-h-density-row-height` class via an explicit `minHeight` style — the same
    // className-plus-computed-style-override pattern `Textarea` already uses for its own
    // per-instance height. `style` comes last in the array so a caller-supplied `style`
    // still wins over both, exactly as `{...props}` would already let it win over
    // `className` alone.
    const rowHeightStyle = densityRowHeight === undefined ? undefined : { minHeight: densityRowHeight };

    const scrollClassName = cn(
      // No `last:` pseudo-class variant here (unlike the Web file): CSS
      // pseudo-class selectors have no native equivalent, so every row
      // keeps its bottom border rather than assuming an unverified
      // Uniwind capability (`TimelineItem` computes "last" in JS for the
      // same reason).
      //
      // `ios:min-h-touch-target android:min-h-touch-target` mirrors
      // `ListItem`'s unconditional guard (`list-item.tsx`): rows are the
      // layout space embedded interactive controls (a sort trigger, a
      // selection `Checkbox`) render into, so a `compact`-density row must
      // never drop the tappable region below the accepted native
      // hit-target floor (ADR-007 "embedded row/cell actions keep >=44dp
      // touch targets"), on top of `--spacing-density-row-height`'s own
      // build-time 44px floor (`docs/density.md`).
      'min-h-density-row-height flex-row items-stretch border-b border-border ios:min-h-touch-target android:min-h-touch-target',
      direction === 'rtl' && 'flex-row-reverse',
      interactive && 'active:bg-surface-muted web:hover:bg-surface-muted',
      // See the stacked branch above for why this is `bg-primary/10`, not
      // `bg-surface-raised`.
      selected && 'bg-primary/10',
      className,
    );

    return interactive ? (
      <Pressable
        accessibilityRole="button"
        accessibilityState={resolvedAccessibilityState}
        onPress={onPress}
        ref={ref}
        {...props}
        className={scrollClassName}
        style={[rowHeightStyle, style]}
      >
        {content}
      </Pressable>
    ) : (
      <View
        accessibilityState={resolvedAccessibilityState}
        ref={ref}
        {...props}
        className={scrollClassName}
        style={[rowHeightStyle, style]}
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
    /** Header content alignment — see `table-shared.ts`'s `TableAlign`. Defaults to `'start'`. */
    align?: TableAlign;
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
      align = 'start',
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
        // `ios:min-h-touch-target android:min-h-touch-target` (ADR-007
        // "embedded row/cell actions keep >=44dp touch targets"): the sort
        // trigger's own content (a label + a small glyph) is shorter than
        // 44px, so without this guard a compact header row would render a
        // real, sub-floor tap target. `justify-center` keeps the label
        // vertically centered once the guard grows the Pressable past its
        // content height. Matches `Button`/`Input`/`ListItem`'s identical
        // guard (`docs/dynamic-type.md` "Minimum hit targets survive scale").
        className="flex-row items-center justify-center gap-1 active:opacity-80 ios:min-h-touch-target android:min-h-touch-target"
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
        className={cn(
          'min-w-0 flex-1 justify-center px-3 py-2',
          alignItemsClassName[align],
          className,
        )}
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
    /**
     * Cell content alignment — see `table-shared.ts`'s `TableAlign`. Defaults
     * to `'start'` in `layout="scroll"` and `'end'` in `layout="stacked"`
     * (the value column's long-standing default, opposite its label —
     * preserved so existing `layout="stacked"` usage renders unchanged).
     */
    align?: TableAlign;
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

const justifyClassName: Record<TableAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

export const TableCell = React.forwardRef<React.ComponentRef<typeof View>, TableCellProps>(
  (
    { accessibilityLabel, align, children, className, colSpan = 1, columnIndex, label, style, ...props },
    ref,
  ) => {
    const layout = useTableLayout();
    const registeredLabel = useTableColumnLabel(columnIndex);
    const resolvedLabel = label ?? registeredLabel;
    const isPlainContent = typeof children === 'string' || typeof children === 'number';
    const span = Number.isFinite(colSpan) ? Math.max(1, Math.floor(colSpan)) : 1;

    if (layout === 'stacked') {
      const resolvedAlign = align ?? 'end';
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
          <View className={cn('min-w-0 flex-1', alignItemsClassName[resolvedAlign])}>
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
    const resolvedAlign = align ?? 'start';

    return (
      <View
        accessibilityLabel={computedAccessibilityLabel}
        accessible={computedAccessibilityLabel ? true : undefined}
        ref={ref}
        {...props}
        // `flex-row items-center` (not the previous default column direction):
        // a `View`'s cross-axis `alignItems` default is `'stretch'`, so a
        // block child (a `Badge`, itself a flex `View`) placed directly here
        // stretched to the cell's full column width with no way to opt out.
        // Row direction's own default `flex` sizing (`flex: 0 1 auto`, hug
        // content) removes the stretch without this cell needing to special-
        // case any particular child type — the same fix `table.web.tsx`'s Web
        // counterpart applies for its own reason (`display:flex` block
        // children fill a block container's width by default there too).
        // `justify-{align}` then positions that content horizontally within
        // the cell's own `flex: colSpan` width.
        className={cn(
          'min-w-0 flex-row items-center px-3 py-2',
          justifyClassName[resolvedAlign],
          className,
        )}
        style={[{ flex: span }, style]}
      >
        {isPlainContent ? (
          // `shrink` (Yoga's default `flexShrink: 0` in a row container would
          // otherwise size this `Text` to its own unwrapped content width
          // instead of wrapping within the cell — the same reason
          // `TableHead`'s own plain-text node carries it): a long value must
          // still wrap onto multiple lines rather than push a neighboring
          // cell/row action off-screen, unaffected by the row-direction cell
          // layout above.
          <Text className="shrink" variant="body">
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    );
  },
);

TableCell.displayName = 'TableCell';
