import { densityMetrics, spacing } from '@beemvp/beeui-tokens';
import * as React from 'react';

// Platform-agnostic type contracts shared by `table.tsx` (native/default) and
// `table.web.tsx` (Web), mirroring the `overlay-transport-shared.ts` split
// (ADR-004/ADR-007 "platform-diverging files behind one import path"). Neither
// platform file imports React-DOM- or React-Native-specific types from here —
// only the small, render-agnostic vocabulary both renderers need to agree on.

/**
 * Table responsive presentation (ADR-007 "Responsive mobile strategy").
 * `'scroll'` (default) keeps the real tabular grid and lets it overflow
 * horizontally. `'stacked'` is an explicit opt-in card/label-value
 * presentation for narrow viewports — BeeUI does not measure viewport width
 * itself, the caller supplies whichever value its own breakpoint policy picks.
 */
export type TableLayout = 'scroll' | 'stacked';

/**
 * Controlled sort-affordance state for `TableHead` (ADR-007 "State
 * boundaries"). Table stores no sort state itself — the caller owns the
 * current direction and reacts to `onSortChange`. Mirrors the `aria-sort`
 * value vocabulary directly, so no translation layer is needed on Web.
 */
export type TableSortDirection = 'ascending' | 'descending' | 'none';

/**
 * Content alignment for `TableHead`/`TableCell`. On Web this drives real
 * `text-align`; on native (no CSS text-align-for-block-content engine) it
 * drives the cross-axis `align-items` of the cell's own row-direction flex
 * layout — a `className="items-end text-end"` combination consumers
 * previously had to write by hand for a right-aligned numeric column (`text-*`
 * has no effect on a Web `<td>`'s cross-axis layout; `items-*` has no effect
 * on Web `text-align` inside a table cell). Defaults to `'start'`.
 */
export type TableAlign = 'start' | 'center' | 'end';

/**
 * Per-table row-height override (`Table`'s `density` prop, `layout="scroll"` only).
 * `'compact'`/`'comfortable'`/`'spacious'` reuse the exact `--spacing-density-row-height`
 * values the global application-density axis already defines
 * (`packages/tokens` — 44px/56px/64px), applied to this one `Table` only, never through
 * `applyDensity`/Uniwind runtime overrides (the global axis and every other table are
 * unaffected). `'dense48'` is a fourth, table-specific 48px step — evidence: a
 * pointer-driven desktop table wants 48px rows while touch surfaces keep the 56px
 * `comfortable` default, sometimes on the same screen — sourced from
 * `spacing['row-dense']`, not the three-mode density-axis vocabulary (which stays exactly
 * `compact`/`comfortable`/`spacious` everywhere else). Omitting `density` entirely leaves a
 * `Table`'s rows following the ambient global density exactly as before this prop existed.
 */
export type TableDensity = 'compact' | 'comfortable' | 'spacious' | 'dense48';

/**
 * The text of a header/cell whose children are only strings and numbers, or `undefined`
 * for any other content. JSX such as `Row {n}` passes an array (`['Row ', n]`), not a
 * string, so a plain `typeof children === 'string'` check sends it down the complex-content
 * path: on native that places bare strings inside a `View` (outside any foreground `Text`)
 * and on both platforms it loses the inferred column/accessible label.
 */
export function plainTextContent(children: React.ReactNode): string | undefined {
  const parts = React.Children.toArray(children);
  if (parts.length === 0) return undefined;
  if (!parts.every((part) => typeof part === 'string' || typeof part === 'number')) return undefined;
  return parts.join('');
}

/** Resolves one `TableDensity` step to its row-height pixel value — see `TableDensity`. */
export function resolveTableDensityRowHeight(density: TableDensity): number {
  return density === 'dense48' ? spacing['row-dense'] : densityMetrics.rowHeight[density];
}
