---
title: Table
description: BeeUI's Table / DataTable component.
---

Table/DataTable is one of BeeUI 1.0's hard release gates, covering core anatomy, Web
keyboard/a11y semantics, native rendering/a11y, a 100/500-row performance envelope, and
production patterns.

:::note[Looking for the task guide?]
[Table](/docs/guides/table/) covers anatomy, state ownership, keyboard and accessibility
behavior, the native/Web split, the performance envelope and limitations. This page keeps
the measured performance evidence behind those recommendations.
:::

## Performance

Table ships **no default virtualization**. `TableBody` renders every supplied
`TableRow` directly (`docs/decisions/007-table-datatable-architecture.md`
"Virtualization" — Option B, adapter/optional, evidence-gated).

Real (not fabricated), harness-measured evidence via `pnpm bench:web`
(`scripts/benchmark/scenarios/web/table-render.mjs`, issue #168) on a
representative Apple M1 dev host — reproduce locally for your own environment's
numbers; see `docs/benchmark-harness.md` for the full methodology:

| Scenario | Rows | Median render pass |
| --- | --- | --- |
| `web/table-render-100` | 100 | ~0.10ms |
| `web/table-render-500` | 500 | ~0.44ms |

Both stay comfortably inside a 16ms frame budget, so the default (non-
virtualized) render meets the accepted 100/500-row envelope — no virtualization
adapter is currently justified.

Table is a thin compositional layer (it owns no row data or selection state),
so it does not itself memoize rows: a plain `rows.map(...)` re-runs every row's
render function when any row's props change (proven empirically in
`apps/showcase/__tests__/table-performance.test.tsx`). This stays inexpensive
at the accepted envelope per the numbers above, but if your list is
significantly larger than ~500 rows, or a single interaction (selection/sort)
needs to feel instant on low-end hardware, two options exist:

- wrap your row content in `React.memo` — the same test proves this isolates a
  selection/sort update to only the changed row; or
- reach for an external virtualization/data-grid library once your data scale
  exceeds this envelope — BeeUI Table intentionally does not bundle one
  (`docs/decisions/007-table-datatable-architecture.md`), to avoid forcing a
  nested-scroll-container architecture and `<table>` `aria-rowcount`/
  `aria-rowindex` accessibility cost on every consumer before evidence justifies
  it.
