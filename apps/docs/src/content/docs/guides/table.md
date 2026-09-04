---
title: Table
description: Build a sortable, selectable, responsive data table with BeeUI's composable Table primitives on native and Web.
---

# Table

BeeUI's `Table` is a **composable primitive family**, not a data grid. You keep your rows,
your sort state, and your selection set; BeeUI owns the semantic markup, the density,
the accessibility, and the responsive presentation. There is no `columns` prop and no
`data` prop, and there never will be.

That single decision explains almost everything else on this page: you write the `.map()`
loop, so you also control memoization; BeeUI stores nothing, so sorting and selection are
plain React state you already know how to test.

This is the task guide. For the mechanically generated prop and type inventory, use the
[Table reference](/docs/components/reference/table/).

## Anatomy

| Part | Renders on Web | Renders on native | Notes |
| --- | --- | --- | --- |
| `Table` | `<table>` inside an `overflow-x-auto` container | `View` wrapping a horizontal scroll region | Owns the `layout` mode for the whole subtree. |
| `TableCaption` | `<caption>` | `Text` | The table's accessible name. Use it. |
| `TableHeader` | `<thead>` | `View` | Contains one `TableRow` of `TableHead` cells. |
| `TableBody` | `<tbody>` | `View` | Renders every row you supply — no windowing. |
| `TableFooter` | `<tfoot>` | `View` | Totals and summary rows. |
| `TableRow` | `<tr>` | `View` | Takes `selected` for the selected visual/semantic state. |
| `TableHead` | `<th scope="col">` with `aria-sort` | `View` + `Text` | Column header; optionally sortable. |
| `TableCell` | `<td>` | `View` | Takes `colSpan` and an optional `label`. |

Composition rules that matter:

- `TableHead` registers its column label into a small, subtree-scoped context as it renders.
  `TableCell` looks its own label up from that registry. That is what makes stacked layout
  and native accessible names work without you repeating the header text on every cell.
- If a header is not plain text — an icon, a checkbox, a control — give `TableHead` an
  explicit `label`, because there is nothing to infer.
- BeeUI does not implement spreadsheet-style cell navigation. Interactive controls inside
  cells are reached by ordinary tab order, which is why the sort affordance is a real
  button rather than a custom grid pattern.

## Build one

A sortable, selectable table with a caption and a row-action column:

```tsx
import {
  Badge,
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type TableSortDirection,
} from '@beemvp/beeui-ui';
import * as React from 'react';

type Member = { id: string; name: string; role: string; status: 'Active' | 'Invited' };

function nextSortDirection(current: TableSortDirection): TableSortDirection {
  if (current === 'none') return 'ascending';
  if (current === 'ascending') return 'descending';
  return 'none';
}

export function TeamTable({ members }: { members: Member[] }) {
  const [sortDirection, setSortDirection] = React.useState<TableSortDirection>('none');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const rows = React.useMemo(() => {
    if (sortDirection === 'none') return members;
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
    return sortDirection === 'descending' ? sorted.reverse() : sorted;
  }, [members, sortDirection]);

  const allSelected = selectedIds.size === members.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <Table>
      <TableCaption>Team members</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead label="Select all">
            <Checkbox
              accessibilityLabel="Select all team members"
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={(checked) =>
                setSelectedIds(checked ? new Set(members.map((m) => m.id)) : new Set())
              }
            />
          </TableHead>
          <TableHead
            onSortChange={() => setSortDirection(nextSortDirection(sortDirection))}
            sortDirection={sortDirection}
          >
            Name
          </TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead label="Actions">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((member) => (
          <TableRow key={member.id} selected={selectedIds.has(member.id)}>
            <TableCell label="Select">
              <Checkbox
                accessibilityLabel={`Select ${member.name}`}
                checked={selectedIds.has(member.id)}
                onCheckedChange={(checked) =>
                  setSelectedIds((previous) => {
                    const next = new Set(previous);
                    if (checked) next.add(member.id);
                    else next.delete(member.id);
                    return next;
                  })
                }
              />
            </TableCell>
            <TableCell>{member.name}</TableCell>
            <TableCell>{member.role}</TableCell>
            <TableCell>
              <Badge variant={member.status === 'Active' ? 'success' : 'secondary'}>
                {member.status}
              </Badge>
            </TableCell>
            <TableCell label="Actions">
              <IconButton accessibilityLabel={`Edit ${member.name}`} variant="ghost">
                ✎
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Note what BeeUI is *not* doing there: it does not sort, it does not track which rows are
selected, and it does not decide the sort cycle. `sortDirection` is a controlled value and
`onSortChange` is a bare notification — the indicator you see is the value you passed in.

## Who owns what state

| Concern | Owner | Mechanism |
| --- | --- | --- |
| Row data, fetching, query state | Your application | Plain props; BeeUI never fetches. |
| Sort direction and comparator | Your application | `TableHead`'s controlled `sortDirection` + `onSortChange`. |
| Row selection | Your application | A `Set` of ids plus ordinary `Checkbox` components; `TableRow` takes `selected` for presentation and semantics. |
| Pagination | Your application | Compose the separate `Pagination` family; `Table` has no page concept. |
| Filtering and search | Your application | Filter before you map. |
| Responsive mode | Your application decides, BeeUI renders | `Table`'s `layout` prop. |
| Markup, density, a11y semantics, scroll container | BeeUI | Not configurable per call site. |

Any helper BeeUI ships for sort or selection is a pure function — there is no hidden store
behind the primitives.

## Responsive behavior

`Table` has two presentations and one explicit switch.

- **`layout="scroll"` (default)** keeps the real tabular grid and lets it overflow
  horizontally: a scroll container around a real `<table>` on Web, a horizontal scroll
  region on native. Column alignment and header association survive at any width.
- **`layout="stacked"`** turns each row into a card of `label: value` pairs. On Web the
  markup deliberately stops being a `<table>` — a labelled block list is the correct
  semantic for a card layout, and it reads better under large text than a `<table>`
  squeezed into a phone width.

BeeUI does not measure the viewport and does not own a breakpoint policy. You pass the mode
from whatever breakpoint decision your app already makes:

```tsx
<Table layout={isCompact ? 'stacked' : 'scroll'} />
```

In stacked mode the visible label comes from the registered `TableHead` label, or from an
explicit `label` on the cell. Column order — and any directional glyph — resolves through
BeeUI's existing direction resolver, so RTL works without a second direction read.

## Keyboard and accessibility

**Web**

- Real `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th scope="col">`, `<td>` and
  `<caption>` elements, so browser and assistive-technology table semantics — row and column
  announcement, header association, find-in-page, print — work natively.
- A sortable `TableHead` sets `aria-sort` to the exact value you passed
  (`'ascending' | 'descending' | 'none'`) and renders an interactive trigger reachable by
  normal `Tab` order. There is no roving-tabindex grid pattern to learn.
- Every interactive control inside a cell participates in ordinary tab order.

**Native**

- React Native has no dedicated table, row, or column-header accessibility role, so BeeUI
  does not fake one. Instead, each cell folds its column context into its accessible name
  via the registered header label. That is why an icon-only header needs an explicit
  `label`: without it, cells in that column announce without context.
- The horizontal scroll region and the stacked composition are both traversable by swipe
  navigation.

**Both**

- Always render a `TableCaption`. It is the table's name.
- Never rely on color alone for a row state — pair `selected` with a real control or text.
- Row height, gap, and cell padding follow the density axis, so the table respects your
  app's [Density](/docs/guides/density/) choice and large-text settings rather than fixed
  pixel metrics.

## Performance envelope

Table ships **no default virtualization**. `TableBody` renders every `TableRow` you supply.

The accepted envelope is the one recorded in
[ADR-007](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/007-table-datatable-architecture.md):
the default non-virtualized render costs **well under 1 ms per full render pass at both 100 and
500 rows** on a representative dev host, far inside a 16 ms frame budget. That is why no
virtualization adapter is currently justified.

Two committed reports state different exact medians for the same `web/table-render-100` and
`web/table-render-500` scenarios, so this guide deliberately does not restate a precise figure.
Measure your own host instead — that is the number that governs your product:

```bash
pnpm bench:web
```

Methodology is in
[`docs/benchmark-harness.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/benchmark-harness.md);
the machine-enforced guard is `maxOverheadRatio: 15`, not an absolute millisecond target.

The tradeoff to know: because `Table` owns no row state and does not memoize for you, a
plain `rows.map(...)` re-runs **every** row's render function when any row's props change —
including a single-row selection toggle. This is measured, not theoretical. At the envelope
above it is cheap. Beyond it, you have two options:

- **Memoize the row content.** Wrapping a row's content in `React.memo` isolates a
  selection or sort update to only the changed row.
- **Reach for a dedicated virtualization or data-grid library** once your data scale exceeds
  this envelope. BeeUI intentionally does not bundle one: default windowing would force a
  nested-scroll-container architecture on every consumer and would break `<table>` row-count
  semantics for assistive technology unless `aria-rowcount`, `aria-rowindex`, and fixed
  column widths were also solved.

Do the measurement before the mitigation. See [Performance](/docs/performance/) for how
BeeUI's benchmark classes and budgets are defined.

## Limitations

- **No range or grid keyboard navigation.** Arrow-key cell traversal and in-cell editing are
  explicit non-goals; adding them would mean announcing a grid interaction contract that
  does not exist.
- **No built-in virtualization.** See above.
- **No multi-level or grouped headers.** The column-label registry assumes one header row.
- **No BeeUI-owned breakpoint.** You supply `layout`.
- **Stacked mode is a different rendering, not a rearranged table.** On Web it is not a
  `<table>`; do not write assertions that expect one in that mode.
- **Native table semantics are name-based, not role-based.** Native evidence describes what
  React Native actually offers, and does not claim parity with HTML table semantics.
- **`colSpan` on native approximates width** by growing the cell's flex share, because there
  is no native table-layout engine measuring sibling columns.

## Related production patterns

- The routed demo workspace builds a full records screen on these primitives — search,
  filter chips, sort, selection, pagination, loading skeletons, empty and error states, and
  a caller-driven `layout={isCompact ? 'stacked' : 'scroll'}` switch. Read
  [Reference app](/docs/reference-app/).
- [Patterns](/docs/patterns/) — production screen compositions.
- [Showcase](/showcase/) — the interactive Table gallery, including both layouts.

## Related

- [Table reference](/docs/components/reference/table/) — generated props and types.
- [Density](/docs/guides/density/) — the axis that drives row and cell metrics.
- [Responsive](/docs/responsive/) — how BeeUI thinks about width.
- [Accessibility](/docs/accessibility/) and [Keyboard & focus](/docs/accessibility/keyboard-focus/).
- [Troubleshooting](/docs/guides/troubleshooting/) — overflow and provider symptoms.

## Canonical sources

- [ADR-007: Table / DataTable product architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/007-table-datatable-architecture.md)
- [Component behavior catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)
- [Benchmark harness methodology](https://github.com/beobungbu/BeeUI/blob/main/docs/benchmark-harness.md)
- [Table source](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/table.tsx)
