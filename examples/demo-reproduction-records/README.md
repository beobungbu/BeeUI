# BeeUI demo reproduction — records flow (#241)

A fresh-agent reproduction of the production demo's **searchable / filterable
records Table flow** (demo screen [#260](https://github.com/beobungbu/BeeUI/issues/260)),
built as [#241](https://github.com/beobungbu/BeeUI/issues/241)'s reproducibility
evaluation.

The flow was rebuilt using **only BeeUI's AI-agent-facing context** — the
`llms.txt` family, `docs/ai-agent-cookbook.md`, `docs/component-reference.md`,
`docs/pattern-library.md`, ADR-007 (Table) and ADR-013 (demo architecture), plus
the real exported TypeScript surface a package consumer's compiler sees. The
existing `apps/demo` records source was treated as unseen and compared only at
the end. The reproducibility verdict and the documentation gap list are in
[`plans/reports/from-fresh-agent-241-demo-reproduction-eval-report.md`](../../plans/reports/from-fresh-agent-241-demo-reproduction-eval-report.md).

## Unpublished status

BeeUI is **not published to npm** (ADR-011 owner guard). This app consumes real
`pnpm pack` tarballs of `@beemvp/beeui-core` / `@beemvp/beeui-tokens` /
`@beemvp/beeui-ui` through the same package boundary CI's `verify-web-consumer.sh`
uses — never a `workspace:*` link, never a hand-copied `dist/`. It is not
registered in the pnpm workspace, so root `pnpm typecheck` / `pnpm build` do not
touch it.

## What it exercises

- `Table` family with **caller-owned** search / filter / sort / selection state
  (ADR-007 D2 — BeeUI stores none of it).
- `SearchInput` (text search), `ChipGroup`/`Chip` (multi-select role filter),
  `SegmentedControl` (single-select status filter).
- Controlled column sort via `TableHead` `sortDirection` / `onSortChange`.
- Row selection with `Checkbox` (indeterminate select-all), `Badge` status cells,
  `DropdownMenu` row actions with `useToast` feedback.
- `Pagination` over a caller-owned page, and the loading / success / empty /
  no-results / error states behind a replaceable mock service seam (ADR-013 D4).

## Run

From the repo root, build the packages once:

```sh
pnpm build
```

Then in this directory:

```sh
bash setup.sh        # packs BeeUI tarballs, npm installs everything
npm run typecheck    # tsc --noEmit
npm run build        # vite production build
npm run preview      # serve the build locally
```
