import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { textVariants } from './text';
import { useDirection } from './use-direction';
import { useRequiredCallbackWarning } from './use-required-callback-warning';
import { plainTextContent, resolveTableDensityRowHeight, type TableAlign, type TableDensity, type TableLayout, type TableSortDirection } from './table-shared';

export type { TableAlign, TableDensity, TableLayout, TableSortDirection } from './table-shared';

// `align` drives real CSS `text-align` for plain text flow, matching the
// documented `className="text-end"` workaround (see `TableAlign`'s own
// docblock in `table-shared.ts`).
const textAlignClassName: Record<TableAlign, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

// `align` also drives `justify-content` on the inner flex-row wrapper every
// `TableCell` renders (see that component below) so non-text content (a
// `Badge`, an icon) can be aligned the same way, not just plain text.
const justifyAlignClassName: Record<TableAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

// A package consumer can write cross-platform, RN-shaped accessibility props
// (`accessibilityLabel`/`accessibilityLabelledBy`) against `Table`'s public
// typing — the native (`table.tsx`) file is `ViewProps`-based and accepts
// them natively. This file renders plain HTML directly (ADR-007's platform
// split — native has no `<table>`/`<tr>`/`<td>`), bypassing react-native-web's
// automatic RN-prop-to-DOM-attribute bridge, so those same props previously
// fell through an unrelated `{...props}` spread as a literal, unrecognized,
// lowercased DOM attribute (`accessibilitylabel="..."`, never `aria-label`) —
// silently losing the intended accessible name on Web only. Every exported
// component below that can take a caller-supplied accessible name now
// destructures both RN-shaped props explicitly and bridges them to their real
// ARIA equivalent, with an explicit `aria-label`/`aria-labelledby` (the
// Web-native escape hatch already in each component's own DOM attribute
// typing) always taking precedence when both are supplied.
type WebAccessibilityLabelProps = {
  accessibilityLabel?: string;
  accessibilityLabelledBy?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

function resolveWebAccessibilityLabelProps({
  accessibilityLabel,
  accessibilityLabelledBy,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: WebAccessibilityLabelProps): { 'aria-label'?: string; 'aria-labelledby'?: string } {
  return {
    'aria-label': ariaLabel ?? accessibilityLabel,
    'aria-labelledby': ariaLabelledBy ?? accessibilityLabelledBy,
  };
}

// Web's accessible "activate with the keyboard" contract for an element that
// is not natively a button/link — `Table`'s pressable-row opt-in (`TableRow`'s
// `onPress` below) needs this instead of just an `onClick`, which a
// keyboard-only user reaching the row via Tab (not a pointer) never fires.
// The row itself must stay a real `<tr>`/plain `<div role="row">` (not
// `role="button"`) so it keeps its row semantics inside the table structure —
// changing that role would break the very grouping this file's `layout`
// contract depends on. `Enter`/`Space` are the two keys a real `<button>`
// itself would answer to.
function handleRowActivationKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  onPress: () => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (isEmbeddedInteractiveActivation(event)) return;
  event.preventDefault();
  onPress();
}

// A pressable `TableRow`'s own `onClick`/keydown handlers fire for a click/keypress
// originating anywhere inside the row, including an embedded cell action (a `Button`,
// `Checkbox`, `SegmentedControlItem`, `SelectTrigger`, link, etc.) — without this guard,
// tapping/activating that control also activates the whole row (e.g. navigating away
// mid-checkbox-toggle). Bounded to a real `Element`-shaped `target`/`currentTarget` pair (a
// DOM `MouseEvent`/`KeyboardEvent` at runtime; a plain stub object in unit tests) so it
// degrades to "not embedded" rather than throwing when either is absent. Covers every native
// interactive element/attribute BeeUI's own controls render as on Web, plus the full
// WAI-ARIA widget-role vocabulary those controls expose (`role="radio"`/`"combobox"`/
// `"slider"`/etc.) — not just the small subset BeeUI happened to ship first. `[tabindex]:
// not([tabindex="-1"])` catches any other Tab-reachable custom control a consumer embeds;
// `isEmbeddedInteractiveActivation`'s own `interactiveAncestor === currentTarget` check
// below is what excludes the row itself when the row's own pressable wrapper also carries a
// `tabIndex`, so this selector does not need to exclude the row separately.
const INTERACTIVE_DESCENDANT_SELECTOR =
  [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    '[contenteditable]',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="scrollbar"]',
  ].join(', ');

type ClosestCapable = { closest?: (selector: string) => unknown };
type ContainsCapable = { contains?: (node: unknown) => boolean };

function isEmbeddedInteractiveActivation(
  event: { target?: unknown; currentTarget?: unknown } | null | undefined,
): boolean {
  if (!event) return false;
  const target = event.target as ClosestCapable | null | undefined;
  const currentTarget = event.currentTarget as ContainsCapable | null | undefined;
  if (!target || typeof target.closest !== 'function') return false;

  const interactiveAncestor = target.closest(INTERACTIVE_DESCENDANT_SELECTOR);
  if (!interactiveAncestor || interactiveAncestor === currentTarget) return false;

  // Bound the match to inside the row when the real DOM `Node.contains` API is available, so
  // an interactive ancestor *above* the row (outside this component's control) never
  // suppresses the row's own activation.
  if (currentTarget && typeof currentTarget.contains === 'function') {
    return currentTarget.contains(interactiveAncestor);
  }
  return true;
}

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

// See `table.tsx` (native) for the full rationale — same shape, same "undefined means no
// override" contract, only the rendered host element (`<tr>`, not a native `View`) differs.
const TableDensityRowHeightContext = React.createContext<number | undefined>(undefined);

function useTableDensityRowHeight(): number | undefined {
  return React.useContext(TableDensityRowHeightContext);
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
//
// `testID` (#144): every other BeeUI Web component renders through
// react-native-web, which maps RN's `testID` prop to a `data-testid` DOM
// attribute automatically. This file renders plain HTML elements directly
// (the ADR-007 platform split — native has no `<table>`/`<td>`/`<th>`), so it
// never got that automatic mapping: passing `testID` here previously fell
// through to `{...props}` as a literal, unrecognized DOM attribute (rendered
// lowercased, e.g. `testid="..."`, never `data-testid="..."`), which
// `page.getByTestId()` (Playwright's default `data-testid` strategy) could
// never find — real evidence from #144's Playwright suite, which timed out
// resolving `TableCell` targets that were visibly present with the right
// content. Every exported component below now accepts the same `testID` prop
// its native (`table.tsx`) counterpart does and forwards it as `data-testid`,
// restoring Web/native testability parity.

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export type TableProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Cross-platform accessible name, bridged to `aria-label` — see the file header. */
  accessibilityLabel?: string;
  /** Cross-platform reference to a labelling element's id, bridged to `aria-labelledby` — see the file header. */
  accessibilityLabelledBy?: string;
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
   * Responsive presentation. Defaults to `'scroll'` (a real `<table>` inside
   * an `overflow-x-auto` container). Set `'stacked'` to render a card/
   * label-value presentation instead.
   */
  layout?: TableLayout;
  /** Forwarded as `data-testid` — see the file header for why Web needs this
   * explicit mapping instead of relying on react-native-web's automatic one. */
  testID?: string;
};

export const Table = React.forwardRef<HTMLDivElement, TableProps>(
  (
    {
      accessibilityLabel,
      accessibilityLabelledBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      children,
      className,
      density,
      layout = 'scroll',
      testID,
      ...props
    },
    ref,
  ) => {
    const direction = useDirection();
    const densityRowHeight = density === undefined ? undefined : resolveTableDensityRowHeight(density);
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
        <TableDensityRowHeightContext.Provider value={densityRowHeight}>
          <TableColumnLabelRegistryContext.Provider value={registry}>
            <div
              ref={ref}
              {...props}
              {...resolveWebAccessibilityLabelProps({
                accessibilityLabel,
                accessibilityLabelledBy,
                'aria-label': ariaLabel,
                'aria-labelledby': ariaLabelledBy,
              })}
              // `text-foreground`: every cell, caption and stacked value below is a raw DOM
              // element whose text inherits colour. Without a colour here they inherit the
              // document's default black, unreadable on a dark surface.
              className={cn('w-full text-foreground', className)}
              data-testid={testID}
              // `layout="stacked"` has no real `<table>` element to supply the
              // implicit `table` role every `<tr>`'s `row` role (below, in
              // `TableRow`) depends on for a screen reader/row-scoped query to
              // recognize it as row grouping rather than an anonymous `<div>`.
              role={layout === 'stacked' ? 'table' : undefined}
            >
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
        </TableDensityRowHeightContext.Provider>
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
  testID?: string;
};

export const TableCaption = React.forwardRef<HTMLElement, TableCaptionProps>(
  ({ children, className, testID, ...props }, ref) => {
    const layout = useTableLayout();
    const captionClassName = cn(
      textVariants({ variant: 'caption', tone: 'muted' }),
      'px-1 py-2 text-center',
      className,
    );

    if (layout === 'stacked') {
      return (
        <p
          className={captionClassName}
          data-testid={testID}
          ref={ref as React.Ref<HTMLParagraphElement>}
          {...props}
        >
          {children}
        </p>
      );
    }

    return (
      <caption
        data-testid={testID}
        ref={ref as React.Ref<HTMLElement>}
        {...props}
        className={captionClassName}
      >
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
  testID?: string;
};

export const TableHeader = React.forwardRef<HTMLElement, TableHeaderProps>(
  ({ children, className, testID, ...props }, ref) => {
    const layout = useTableLayout();

    if (layout === 'stacked') {
      // Stacked layout inlines each column's label next to its own value
      // (see `TableCell`), so the header row becomes redundant. It stays
      // mounted (its `TableHead` cells still register column labels) but is
      // hidden from layout *and* the accessibility tree via `display:none`.
      return (
        <div
          className="hidden"
          data-testid={testID}
          ref={ref as React.Ref<HTMLDivElement>}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <thead
        data-testid={testID}
        ref={ref as React.Ref<HTMLTableSectionElement>}
        {...props}
        className={className}
      >
        {children}
      </thead>
    );
  },
);

TableHeader.displayName = 'TableHeader';

export type TableBodyProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  testID?: string;
};

export const TableBody = React.forwardRef<HTMLElement, TableBodyProps>(
  ({ children, className, testID, ...props }, ref) => {
    const layout = useTableLayout();

    if (layout === 'stacked') {
      return (
        <div
          className={cn('gap-density-row-gap flex flex-col', className)}
          data-testid={testID}
          ref={ref as React.Ref<HTMLDivElement>}
          role="rowgroup"
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <tbody
        data-testid={testID}
        ref={ref as React.Ref<HTMLTableSectionElement>}
        {...props}
        className={className}
      >
        {children}
      </tbody>
    );
  },
);

TableBody.displayName = 'TableBody';

export type TableFooterProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  testID?: string;
};

export const TableFooter = React.forwardRef<HTMLElement, TableFooterProps>(
  ({ children, className, testID, ...props }, ref) => {
    const layout = useTableLayout();

    if (layout === 'stacked') {
      return (
        <div
          className={cn('gap-density-row-gap flex flex-col', className)}
          data-testid={testID}
          ref={ref as React.Ref<HTMLDivElement>}
          role="rowgroup"
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <tfoot
        data-testid={testID}
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
  /** Cross-platform accessible name, bridged to `aria-label` — see the file header. */
  accessibilityLabel?: string;
  /** Cross-platform reference to a labelling element's id, bridged to `aria-labelledby` — see the file header. */
  accessibilityLabelledBy?: string;
  children?: React.ReactNode;
  className?: string;
  /**
   * Makes the row itself pressable (e.g. a row-to-detail navigation pattern),
   * mirroring `ListItem`'s own opt-in `onPress`. The row stays a real
   * `<tr>`/`role="row"` element (row semantics/grouping are not replaced by a
   * `button` role — see `handleRowActivationKeyDown`'s docblock) but gains a
   * pointer cursor, `tabIndex={0}`, and `Enter`/`Space` keyboard activation
   * alongside the `onClick`. A row with no `onPress` keeps rendering exactly
   * as before.
   */
  onPress?: () => void;
  /**
   * Visual highlight for a caller-selected row. Table owns no selection
   * state (ADR-007) — this only reflects a boolean the caller already tracks.
   */
  selected?: boolean;
  testID?: string;
};

export const TableRow = React.forwardRef<HTMLElement, TableRowProps>(
  (
    {
      accessibilityLabel,
      accessibilityLabelledBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      children,
      className,
      onPress,
      selected = false,
      style,
      testID,
      ...props
    },
    ref,
  ) => {
    const layout = useTableLayout();
    const densityRowHeight = useTableDensityRowHeight();
    const interactive = typeof onPress === 'function';
    const accessibilityLabelProps = resolveWebAccessibilityLabelProps({
      accessibilityLabel,
      accessibilityLabelledBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    });
    const interactiveProps = interactive
      ? {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            if (isEmbeddedInteractiveActivation(event)) return;
            onPress();
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => handleRowActivationKeyDown(event, onPress),
          tabIndex: 0,
        }
      : {};

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
      // rowheader — WAI-ARIA 1.2), which is also why this stays `bg-primary/10`
      // rather than reintroducing `aria-selected` here now that it has a real
      // `role="row"` (added below, for row-grouping — see `Table`'s own
      // `role="table"` docblock): `row` DOES allow `aria-selected` per WAI-ARIA
      // 1.2, but this card's selection state is already exposed correctly via
      // its own `Checkbox`'s `aria-checked` (ADR-007: Table composes
      // selection from `Checkbox`, it does not invent a second signal), so
      // adding a second one here would be redundant, not a correctness fix.
      return (
        <div
          className={cn(
            'gap-1 rounded-lg border border-border bg-surface p-3',
            interactive && 'cursor-pointer web:hover:bg-surface-muted',
            // `bg-primary/10` (not `bg-surface-raised`): every light theme in
            // this repo's token set defines `--color-surface-raised` equal to
            // `--color-surface`, so a "selected" row painted that way computed
            // to the exact same background as an unselected one in light mode
            // — a real, currently-reproducible bug, not just a missing class.
            // `bg-primary/10` is guaranteed distinct from the surface in every
            // theme because it derives from `--color-primary`.
            selected && 'border-primary bg-primary/10',
            className,
          )}
          data-testid={testID}
          ref={ref as React.Ref<HTMLDivElement>}
          role="row"
          {...accessibilityLabelProps}
          {...interactiveProps}
          {...props}
          style={style}
        >
          {content}
        </div>
      );
    }

    // `densityRowHeight` (from the parent `Table`'s `density` prop) sets an explicit `<tr>`
    // `height` — mirrors `table.tsx`'s (native) `minHeight` override, using `height` here
    // because an unstyled `<tr>` has no intrinsic min-height class to override on Web (its
    // row height is normal content flow from each cell's own padding — see the file-level
    // note on `layout="scroll"` row height). A caller-supplied `style` still wins on any
    // overlapping key, same precedence `table.tsx` gives its own `style` array.
    const rowHeightStyle = densityRowHeight === undefined ? undefined : { height: densityRowHeight };

    return (
      <tr
        aria-selected={selected}
        className={cn(
          'border-b border-border last:border-b-0',
          interactive && 'cursor-pointer web:hover:bg-surface-muted',
          // See the stacked branch above for why this is `bg-primary/10`, not
          // `bg-surface-raised`.
          selected && 'bg-primary/10',
          className,
        )}
        data-testid={testID}
        ref={ref as React.Ref<HTMLTableRowElement>}
        {...accessibilityLabelProps}
        {...interactiveProps}
        {...props}
        style={{ ...rowHeightStyle, ...style }}
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

export type TableHeadProps = Omit<React.ThHTMLAttributes<HTMLElement>, 'align' | 'children' | 'scope'> &
  TableColumnPositionProps & {
    /**
     * Header content alignment — see `table-shared.ts`'s `TableAlign`. Not
     * the deprecated HTML `align` attribute (`"left"|"center"|"right"|...`,
     * explicitly excluded above) `React.ThHTMLAttributes` otherwise types
     * this same prop name as. Defaults to `'start'`.
     */
    align?: TableAlign;
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
    testID?: string;
  };

const sortGlyphs: Record<TableSortDirection, string> = {
  ascending: '↑',
  descending: '↓',
  none: '↕',
};

export const TableHead = React.forwardRef<HTMLElement, TableHeadProps>(
  (
    { align = 'start', children, className, columnIndex, label, onSortChange, sortDirection, testID, ...props },
    ref,
  ) => {
    const layout = useTableLayout();
    const registry = React.useContext(TableColumnLabelRegistryContext);
    const resolvedLabel = label ?? plainTextContent(children);
    const sortable = sortDirection !== undefined;

    useRequiredCallbackWarning('TableHead', 'onSortChange', onSortChange, !sortable);

    // Registered synchronously during render — see `table.tsx` (native) for
    // the same-render-pass ordering rationale.
    registry?.setLabel(columnIndex, resolvedLabel);

    const innerContent = sortable ? (
      <button
        aria-label={resolvedLabel ? `Sort by ${resolvedLabel}` : undefined}
        className={cn(
          'flex w-full items-center gap-1 rounded-sm bg-transparent font-semibold hover:opacity-80 focus-visible:bee-focus-ring',
          textAlignClassName[align],
          justifyAlignClassName[align],
        )}
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
        <div
          data-testid={testID}
          ref={ref as React.Ref<HTMLDivElement>}
          {...props}
          className={className}
        >
          {innerContent}
        </div>
      );
    }

    return (
      <th
        aria-sort={sortDirection}
        // `text-foreground`: previously this `<th>` carried no color class at
        // all, so its text inherited the browser's own document color —
        // black on a dark `bg-surface`, ~1.1:1 contrast.
        className={cn(
          'px-3 py-2 align-middle font-semibold text-foreground',
          textAlignClassName[align],
          className,
        )}
        data-testid={testID}
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

export type TableCellProps = Omit<React.TdHTMLAttributes<HTMLElement>, 'align' | 'children'> &
  TableColumnPositionProps & {
    /** Cross-platform accessible name, bridged to `aria-label` — see the file header. */
    accessibilityLabel?: string;
    /** Cross-platform reference to a labelling element's id, bridged to `aria-labelledby` — see the file header. */
    accessibilityLabelledBy?: string;
    /**
     * Cell content alignment — see `table-shared.ts`'s `TableAlign`. Not the
     * deprecated HTML `align` attribute `React.TdHTMLAttributes` otherwise
     * types this same prop name as (explicitly excluded above). Defaults
     * to `'start'` in `layout="scroll"` and `'end'` in `layout="stacked"`
     * (the value column's long-standing default, opposite its label —
     * preserved so existing `layout="stacked"` usage renders unchanged).
     */
    align?: TableAlign;
    children?: React.ReactNode;
    className?: string;
    /**
     * Explicit column label override for `layout="stacked"`. Falls back to
     * the corresponding `TableHead`'s inferred label when omitted.
     */
    label?: string;
    testID?: string;
  };

export const TableCell = React.forwardRef<HTMLElement, TableCellProps>(
  (
    {
      accessibilityLabel,
      accessibilityLabelledBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      align,
      children,
      className,
      colSpan,
      columnIndex,
      label,
      testID,
      ...props
    },
    ref,
  ) => {
    const layout = useTableLayout();
    const registeredLabel = useTableColumnLabel(columnIndex);
    const resolvedLabel = label ?? registeredLabel;
    const accessibilityLabelProps = resolveWebAccessibilityLabelProps({
      accessibilityLabel,
      accessibilityLabelledBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    });

    if (layout === 'stacked') {
      const resolvedAlign = align ?? 'end';
      return (
        <div
          className={cn(
            'flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0',
            className,
          )}
          data-testid={testID}
          ref={ref as React.Ref<HTMLDivElement>}
          role="cell"
          {...accessibilityLabelProps}
          {...props}
        >
          {resolvedLabel ? (
            <span className={cn('shrink-0', textVariants({ variant: 'caption', tone: 'muted' }))}>
              {resolvedLabel}
            </span>
          ) : null}
          <div className={cn('min-w-0 flex-1', textAlignClassName[resolvedAlign])}>{children}</div>
        </div>
      );
    }

    const resolvedAlign = align ?? 'start';

    return (
      <td
        className={cn('px-3 py-2 align-middle text-foreground', className)}
        colSpan={colSpan}
        data-testid={testID}
        ref={ref as React.Ref<HTMLElement>}
        {...accessibilityLabelProps}
        {...props}
      >
        {/* `flex flex-row` (not this `<td>`'s own default block flow): a
            `Badge` (or any other block-level child) placed directly inside a
            `<td>` previously stretched to the full column width, because a
            block-level `display:flex` element (`Badge` renders one) still
            takes its containing block's full auto-width in normal block
            flow. Making a *child* wrapper the flex row (not the `<td>`
            itself, which must stay `display:table-cell` to keep
            participating in the table's own column-width algorithm) turns
            that same child into a flex item that hugs its own content width
            instead, and lets `justify-{align}` position it horizontally —
            the Web half of the `align` contract `table-shared.ts` documents
            (native's `TableCell` gets the equivalent fix in `table.tsx`). */}
        <div className={cn('flex min-w-0 flex-row items-center gap-2', justifyAlignClassName[resolvedAlign])}>
          {children}
        </div>
      </td>
    );
  },
);

TableCell.displayName = 'TableCell';
