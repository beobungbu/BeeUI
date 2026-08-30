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
