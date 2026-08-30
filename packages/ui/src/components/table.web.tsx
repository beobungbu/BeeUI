import { cn } from '@beeui/core';
import * as React from 'react';
import { textVariants } from './text';
import { useDirection } from './use-direction';
import { useRequiredCallbackWarning } from './use-required-callback-warning';
import type { TableLayout, TableSortDirection } from './table-shared';

export type { TableLayout, TableSortDirection } from './table-shared';

// ---------------------------------------------------------------------------
// Internal, subtree-scoped context — see `table.tsx` (native) for the full
// rationale; both platform files share the same context shape/behavior so a
// caller-facing subtree behaves identically on Web and native, only the
// rendered host elements differ (ADR-007 "Platform rendering strategy").
// ---------------------------------------------------------------------------

const TableLayoutContext = React.createContext<TableLayout>('scroll');

function useTableLayout(): TableLayout {
  return React.useContext(TableLayoutContext);
}

type TableColumnLabelRegistry = {
  getLabel: (columnIndex: number | undefined) => string | undefined;
  setLabel: (columnIndex: number | undefined, label: string | undefined) => void;
};

const TableColumnLabelRegistryContext = React.createContext<TableColumnLabelRegistry | null>(null);

function useTableColumnLabel(columnIndex: number | undefined): string | undefined {
  const registry = React.useContext(TableColumnLabelRegistryContext);
  return registry?.getLabel(columnIndex);
}

type TableColumnPositionProps = {
  /** @internal assigned by the parent `TableRow` — not part of the public API. */
  columnIndex?: number;
};

// `Table`'s root element is always a `<div>` — a plain wrapper in
// `layout="stacked"`, or the horizontal-scroll container (`overflow-x-auto`)
// around the real `<table>` in `layout="scroll"`. Several descendants
// (`TableCaption`/`TableHeader`/`TableRow`/`TableHead`/`TableCell`) render a
// genuinely different host element per layout (e.g. `<caption>` vs. a plain
// text block), so their `ref`/passthrough-attribute type is widened to
// `HTMLElement`/`React.HTMLAttributes<HTMLElement>` rather than one specific
// element interface.

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export type TableProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Responsive presentation. Defaults to `'scroll'` (a real `<table>` inside
   * an `overflow-x-auto` container). Set `'stacked'` to render a card/
   * label-value presentation instead.
   */
  layout?: TableLayout;
};

export const Table = React.forwardRef<HTMLDivElement, TableProps>(
  ({ children, className, layout = 'scroll', ...props }, ref) => {
    const direction = useDirection();
    const labelsRef = React.useRef<Map<number, string>>(new Map());
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

    return (
      <TableLayoutContext.Provider value={layout}>
        <TableColumnLabelRegistryContext.Provider value={registry}>
          <div ref={ref} {...props} className={cn('w-full', className)}>
            {layout === 'stacked' ? (
              children
            ) : (
              <div className="w-full overflow-x-auto" dir={direction}>
                <table className="w-full caption-bottom border-collapse text-start">
                  {children}
                </table>
              </div>
            )}
          </div>
        </TableColumnLabelRegistryContext.Provider>
      </TableLayoutContext.Provider>
    );
  },
);

Table.displayName = 'Table';

// ---------------------------------------------------------------------------
// TableCaption
// ---------------------------------------------------------------------------

export type TableCaptionProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableCaption = React.forwardRef<HTMLElement, TableCaptionProps>(
  ({ children, className, ...props }, ref) => {
    const layout = useTableLayout();
    const captionClassName = cn('px-1 py-2 text-center', className);

    if (layout === 'stacked') {
      return (
        <p
          className={cn(textVariants({ variant: 'caption', tone: 'muted' }), captionClassName)}
          ref={ref as React.Ref<HTMLParagraphElement>}
          {...props}
        >
          {children}
        </p>
      );
    }

    return (
      <caption ref={ref as React.Ref<HTMLElement>} {...props} className={captionClassName}>
        {children}
      </caption>
    );
  },
);

TableCaption.displayName = 'TableCaption';

// ---------------------------------------------------------------------------
// TableHeader / TableBody / TableFooter
// ---------------------------------------------------------------------------

export type TableHeaderProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableHeader = React.forwardRef<HTMLElement, TableHeaderProps>(
  ({ children, className, ...props }, ref) => {
    const layout = useTableLayout();

    if (layout === 'stacked') {
      // Stacked layout inlines each column's label next to its own value
      // (see `TableCell`), so the header row becomes redundant. It stays
      // mounted (its `TableHead` cells still register column labels) but is
      // hidden from layout *and* the accessibility tree via `display:none`.
      return (
        <div className="hidden" ref={ref as React.Ref<HTMLDivElement>} {...props}>
          {children}
        </div>
      );
    }

    return (
      <thead ref={ref as React.Ref<HTMLTableSectionElement>} {...props} className={className}>
        {children}
      </thead>
    );
  },
);

TableHeader.displayName = 'TableHeader';

export type TableBodyProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableBody = React.forwardRef<HTMLElement, TableBodyProps>(
  ({ children, className, ...props }, ref) => {
    const layout = useTableLayout();

    if (layout === 'stacked') {
      return (
        <div className={cn('gap-density-row-gap flex flex-col', className)} ref={ref as React.Ref<HTMLDivElement>} {...props}>
          {children}
        </div>
      );
    }

    return (
      <tbody ref={ref as React.Ref<HTMLTableSectionElement>} {...props} className={className}>
        {children}
      </tbody>
    );
  },
);

TableBody.displayName = 'TableBody';

export type TableFooterProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const TableFooter = React.forwardRef<HTMLElement, TableFooterProps>(
  ({ children, className, ...props }, ref) => {
    const layout = useTableLayout();

    if (layout === 'stacked') {
      return (
        <div className={cn('gap-density-row-gap flex flex-col', className)} ref={ref as React.Ref<HTMLDivElement>} {...props}>
          {children}
        </div>
      );
    }

    return (
      <tfoot
        ref={ref as React.Ref<HTMLTableSectionElement>}
        {...props}
        className={cn('border-t border-border bg-surface-muted', className)}
      >
        {children}
      </tfoot>
    );
  },
);

TableFooter.displayName = 'TableFooter';

// ---------------------------------------------------------------------------
// TableRow
// ---------------------------------------------------------------------------

export type TableRowProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Visual highlight for a caller-selected row. Table owns no selection
   * state (ADR-007) — this only reflects a boolean the caller already tracks.
   */
  selected?: boolean;
};

export const TableRow = React.forwardRef<HTMLElement, TableRowProps>(
  ({ children, className, selected = false, ...props }, ref) => {
    const layout = useTableLayout();

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
      // `aria-selected` is only an allowed ARIA attribute on elements whose
      // role supports it (option/row/tab/treeitem/gridcell/columnheader/
      // rowheader — WAI-ARIA 1.2). This card is a plain, roleless `<div>`
      // (axe-core's `aria-allowed-attr` rule correctly flags `aria-selected`
      // here as a critical violation — proven by the `component-gallery-table`
      // a11y scenario), unlike the `scroll` layout's real `<tr>` below, which
      // has an implicit `row` role from being inside a `<table>` and so
      // legitimately supports it. The row's selection state is still exposed
      // to assistive technology correctly via its own `Checkbox`'s
      // `aria-checked` (ADR-007: Table composes selection from `Checkbox`,
      // it does not invent a second, invalid selection-state attribute).
      return (
        <div
          className={cn(
            'gap-1 rounded-lg border border-border bg-surface p-3',
            selected && 'border-primary',
            className,
          )}
          ref={ref as React.Ref<HTMLDivElement>}
          {...props}
        >
          {content}
        </div>
      );
    }

    return (
      <tr
        aria-selected={selected}
        className={cn('border-b border-border last:border-b-0', selected && 'bg-surface-raised', className)}
        ref={ref as React.Ref<HTMLTableRowElement>}
        {...props}
      >
        {content}
      </tr>
    );
  },
);

TableRow.displayName = 'TableRow';

// ---------------------------------------------------------------------------
// TableHead
// ---------------------------------------------------------------------------

export type TableHeadProps = Omit<React.ThHTMLAttributes<HTMLElement>, 'children' | 'scope'> &
  TableColumnPositionProps & {
    children?: React.ReactNode;
    className?: string;
    /**
     * Explicit column label override. Required when this header's content is
     * not plain text/number — inferred from `children` otherwise. Drives
     * `layout="stacked"`'s visible label-value pairing.
     */
    label?: string;
    /** Caller-driven sort-toggle callback. Table stores no sort state. */
    onSortChange?: () => void;
    /**
     * Controlled current sort state for this column. Presence of this prop
     * marks the column sortable, wires `aria-sort` on the `<th>`, and renders
     * a `<button>` sort trigger reachable by normal tab order (no custom
     * roving-tabindex grid navigation — ADR-007).
     */
    sortDirection?: TableSortDirection;
  };

const sortGlyphs: Record<TableSortDirection, string> = {
  ascending: '↑',
  descending: '↓',
  none: '↕',
};

export const TableHead = React.forwardRef<HTMLElement, TableHeadProps>(
  ({ children, className, columnIndex, label, onSortChange, sortDirection, ...props }, ref) => {
    const layout = useTableLayout();
    const registry = React.useContext(TableColumnLabelRegistryContext);
    const isPlainContent = typeof children === 'string' || typeof children === 'number';
    const resolvedLabel = label ?? (isPlainContent ? String(children) : undefined);
    const sortable = sortDirection !== undefined;

    useRequiredCallbackWarning('TableHead', 'onSortChange', onSortChange, !sortable);

    // Registered synchronously during render — see `table.tsx` (native) for
    // the same-render-pass ordering rationale.
    registry?.setLabel(columnIndex, resolvedLabel);

    const innerContent = sortable ? (
      <button
        aria-label={resolvedLabel ? `Sort by ${resolvedLabel}` : undefined}
        className="flex w-full items-center gap-1 rounded-sm bg-transparent text-start font-semibold hover:opacity-80 focus-visible:bee-focus-ring"
        onClick={onSortChange}
        type="button"
      >
        <span>{children}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          {sortGlyphs[sortDirection ?? 'none']}
        </span>
      </button>
    ) : (
      children
    );

    if (layout === 'stacked') {
      return (
        <div ref={ref as React.Ref<HTMLDivElement>} {...props} className={className}>
          {innerContent}
        </div>
      );
    }

    return (
      <th
        aria-sort={sortDirection}
        className={cn('px-3 py-2 text-start align-middle font-semibold', className)}
        ref={ref as React.Ref<HTMLElement>}
        scope="col"
        {...props}
      >
        {innerContent}
      </th>
    );
  },
);

TableHead.displayName = 'TableHead';

// ---------------------------------------------------------------------------
// TableCell
// ---------------------------------------------------------------------------

export type TableCellProps = Omit<React.TdHTMLAttributes<HTMLElement>, 'children'> &
  TableColumnPositionProps & {
    children?: React.ReactNode;
    className?: string;
    /**
     * Explicit column label override for `layout="stacked"`. Falls back to
     * the corresponding `TableHead`'s inferred label when omitted.
     */
    label?: string;
  };

export const TableCell = React.forwardRef<HTMLElement, TableCellProps>(
  ({ children, className, colSpan, columnIndex, label, ...props }, ref) => {
    const layout = useTableLayout();
    const registeredLabel = useTableColumnLabel(columnIndex);
    const resolvedLabel = label ?? registeredLabel;

    if (layout === 'stacked') {
      return (
        <div
          className={cn(
            'flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0',
            className,
          )}
          ref={ref as React.Ref<HTMLDivElement>}
          {...props}
        >
          {resolvedLabel ? (
            <span className={cn('shrink-0', textVariants({ variant: 'caption', tone: 'muted' }))}>
              {resolvedLabel}
            </span>
          ) : null}
          <div className="min-w-0 flex-1 text-end">{children}</div>
        </div>
      );
    }

    return (
      <td
        className={cn('px-3 py-2 align-middle', className)}
        colSpan={colSpan}
        ref={ref as React.Ref<HTMLElement>}
        {...props}
      >
        {children}
      </td>
    );
  },
);

TableCell.displayName = 'TableCell';
