# Fresh-agent reproduction of the demo records flow (#241)

**Task:** #241 (R10.12) — reproduce a representative slice of the production demo
_as a fresh coding agent would_, using **only** BeeUI's AI-agent-facing context,
to validate that the accepted demo is reproducible from the published guidance.

**Target flow:** the searchable / filterable records **Table** flow — demo screen
[#260](https://github.com/beobungbu/BeeUI/issues/260).

**Deliverable:** `examples/demo-reproduction-records/` — a minimal Web build
consuming BeeUI honestly through `pnpm pack` tarballs (BeeUI is unpublished).

## Method (discipline)

The sole spec was BeeUI's AI-agent context:

- `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt`
- `docs/ai-agent-cookbook.md` (esp. Recipe C — Table/DataTable)
- `docs/component-reference.md`, `docs/pattern-library.md`
- ADR-007 (Table) and ADR-013 (demo architecture)
- the source-ownership `beeui` CLI surface and, for concrete prop signatures, the
  **exported TypeScript types** a package consumer's compiler sees (which
  `llms-components.txt` explicitly points agents to: "see the source file or
  `packages/ui/src/index.ts` for `Props` and value-type exports").

The existing `apps/demo/src/features/records/**` was treated as **unseen** and
opened only for the fidelity comparison, after the reproduction built and ran.
Every point where reproduction required leaving the AI docs is logged in the gap
list below.

## Build context

- **Agent identity:** Claude (Anthropic) coding agent — BeeUI 1.0 implementation
  agent session.
- **Base SHA:** `7f9decb95fc2336340819626e507420f6e63a1fc` (`main`, worktree HEAD).
- **Node:** v24.13.1 (nvm), pnpm 10.15.0.
- **Target:** Web (Vite 8 + react-native-web), package-consumption model via real
  `pnpm pack` tarballs of `@beemvp/beeui-{core,tokens,ui}`.
- **Consumption honesty:** no `workspace:*` link, no deep `packages/**/src`
  import — only the public `@beemvp/beeui-ui` / `@beemvp/beeui-tokens` barrels.

## What was reproduced (from AI-only context)

A complete records screen (`src/records/records-screen.tsx`) over an app-owned
domain (directory members) with an app-owned service seam, `useAsync` lifecycle,
and pure filter/sort/paginate helpers:

- `SearchInput` full-text search (name/email), page reset on change.
- `ChipGroup`/`Chip` multi-select **role** filter; `SegmentedControl`
  single-select **status** filter.
- `Table` family with real Web `<table>`/`<th scope>`/`aria-sort` semantics;
  controlled column sort on `TableHead` (`sortDirection` + `onSortChange`) for two
  columns; caller-owned sort state (ADR-007 D2).
- `Checkbox` row selection with an indeterminate select-all header; caller-owned
  `Set<string>`; `TableRow selected`; `Badge` status cells; `DropdownMenu` row
  actions with `useToast` feedback.
- `Pagination` over caller-owned page; `TableCaption` count.
- Five functional states behind a replaceable mock service (ADR-013 D4):
  **loading** (`Skeleton`), **success** (table), **empty** (no data),
  **no-results** (filtered to zero, with "Clear filters"), **error**
  (`ErrorState` + retry).

### Acceptance evidence (nvm 24.13.1)

`pnpm build` (package dist) at the repo root, then in
`examples/demo-reproduction-records/`:

```
$ bash setup.sh
==> Packing @beemvp/beeui-core, @beemvp/beeui-tokens, @beemvp/beeui-ui through the package boundary
==> Installing BeeUI tarballs and Web runtime/tooling dependencies (npm, no monorepo/pnpm fallback)
==> Setup complete. Run: npm run build  (and: npm run typecheck)

$ npm run typecheck
> tsc --noEmit
                       # (clean — no output)

$ npm run build
vite v8.2.2 building client environment for production...
✓ 573 modules transformed.
dist/index.html                   0.42 kB │ gzip:   0.29 kB
dist/assets/index-BDcDJb-b.css   37.26 kB │ gzip:   7.37 kB
dist/assets/index-ZFJsHzbf.js   431.73 kB │ gzip: 137.83 kB
✓ built in 368ms
```

The **37.26 kB CSS bundle** (≈ the `web-consumer` starter's 35.91 kB) confirms
Tailwind/Uniwind discovered BeeUI's semantic utility classes through the
`@source` globs — i.e. the app ships **styled**, not just built.

**Runtime validation** (vite preview + browser): the table renders with real
semantic markup, sortable header indicators, semantic `Badge` colors
(active=success, invited=info, suspended=destructive), `24 of 24 records`
caption, 8 rows/page, `page 1 of 3` pagination, and a working data-scenario
switch — the **error** state shows "Couldn't load records → Retry" and the
**empty** state shows "No records yet". (One real bug was found and fixed during
this validation — see below.)

Root gates remain green (examples/ is outside the workspace, so root
`pnpm typecheck` / `pnpm hygiene:check` do not compile the example, but its new
tracked files pass hygiene: LF endings, final newline, `setup.sh` mode `100644`).

### One bug found by dogfooding

The first `useAsync` implementation keyed its effect on a `reload` nonce only,
not on the memoized `loader`, so switching data scenario didn't refetch. Caught
by runtime testing (not by typecheck or build), fixed to depend on
`[loader, nonce]`. This is exactly the class of interaction bug the #241 exercise
exists to surface, and it is a reproduction-app bug, **not** a BeeUI gap.

## Fidelity comparison vs the real `apps/demo` records flow

Done last, after the reproduction built and ran. The real screen is
`apps/demo/src/features/records/records-screen.tsx` (domain: support **tickets**).

**Verdict: HIGH fidelity.** Reproduced independently from the docs + type surface,
the two screens converge on the same architecture and the same component
vocabulary:

| Dimension | Real `apps/demo` | This reproduction | Match |
| --- | --- | --- | --- |
| Component set | Table family, SearchInput, ChipGroup/Chip, DropdownMenu, Checkbox, Badge, Pagination, EmptyState/ErrorState, Skeleton, useToast, `TableSortDirection` | identical set (+ `SegmentedControl`) | ✅ |
| State ownership (ADR-007 D2) | caller owns query/filter/sort/selection/page; Table stores none | identical | ✅ |
| Selection | `Set<string>`, indeterminate select-all on page, `TableRow selected` | identical | ✅ |
| Sort | controlled `sortDirection`+`onSortChange` on `TableHead` | identical mechanism | ✅ |
| States | loading/success/empty/no-results/error via mock service seam + `useAsync` | identical five states + seam | ✅ |
| Pagination | `Pagination` + prev / all-pages / next `PaginationItem` | identical | ✅ |
| Row actions | `DropdownMenu` + `useToast` | identical | ✅ |
| Caption / label overrides | `TableCaption` count; `label` on checkbox/actions heads | identical | ✅ |

**Substantive divergences (all doc-compliant, none a fidelity failure):**

1. **Domain** — mine is a member directory (name/email/role/status/joined); demo
   is support tickets. Expected: proves independence, not copying.
2. **Status filter control** — I used `SegmentedControl` (single-select) for
   status + `ChipGroup` for role; the demo uses two `ChipGroup`s (priority +
   status). Both are on the docs' #260 component list; the docs don't say which
   filter axis maps to which control (gap G-FILTER-CHOICE).
3. **Responsive `layout`** — the demo drives `Table layout="stacked"` on compact
   via a shell breakpoint hook; I stayed on the accepted **scroll** default
   because the AI docs expose no breakpoint/viewport hook to drive stacked from
   (gap G-STACKED-LAYOUT). ADR-007/ADR-013 both allow scroll-only, so this is
   compliant but is the clearest reproduction gap.
4. **Sort cycle** — demo cycles 3-state (none→descending→ascending), default
   descending; mine toggles 2-state, two sortable columns. Both honor the
   controlled contract; the cycle itself is undocumented (gap G-SORT-SEMANTICS).
5. **Detail route / optimistic save** — demo navigates to a `[id]` detail route
   (#261) and optimistically saves; my slice is single-screen with read-only
   toast actions. Expected for a #260-only slice.
6. **State wrappers / tests** — demo wraps state screens in `Card` and ships Jest
   feature tests; mine renders states bare and keeps pure, unit-testable query
   helpers without a test runner (matching the minimal-starter precedent).

The convergence on the exact `Table` prop contract (`sortDirection`,
`onSortChange`, `label`, `selected`, `colSpan`, `layout`, `TableSortDirection`)
and on ADR-007's state boundary — derived without seeing `apps/demo` — is the
core positive result: **the flow is reproducible from the published guidance.**

## Gap list (what the AI docs lacked)

Feeds #242. Ordered by impact. G-BUILD-1/2 reconfirm #235's G1/G2; the rest are
records/Table-specific.

### G-BUILD-1 — No Web bundler recipe (blocking) [reconfirms #235 G1]

Nothing in the llms family or cookbook says how to bundle a Web app: the
`vite-plugin-rnw` + `@tailwindcss/vite` + `uniwind/vite` stack, nor that
`global.css` must `@import 'tailwindcss'`/`'uniwind'` and declare
`@source '.../@beemvp/beeui-ui/src'` so utilities are discovered (without the
`@source` globs the app builds **unstyled**). Reconstructed from
`examples/web-consumer` + `docs/compatibility-matrix.md`.
_Fix:_ add a "Web bundling (Vite + react-native-web)" block to `llms-full.txt`.

### G-BUILD-2 — No standalone tarball-consumption path while unpublished (blocking) [reconfirms #235 G2]

The cookbook says npm install is wrong and `pnpm beeui -- add` is the working
path, but source-ownership targets an _existing_ consumer and still needs the
`@beemvp/beeui-tokens` package. For a new standalone app on the package model, the
only working mechanism (`pnpm pack` → `file:*.tgz` → `npm install`) is documented
only in `examples/README.md`, which is **not** in the AI-agent context set.
_Fix:_ add a "Consuming the packages before release (pnpm pack tarballs)"
subsection to `llms-full.txt` §Consumption models.

### G-TABLE-API — Table's concrete prop contract is not in the AI docs (high, records-specific)

The Table docs page (`apps/docs/.../components/table.md`) is **"Content pending"**,
and `docs/component-reference.md` lists only type _names_ (`TableProps`,
`TableHeadProps`, `TableSortDirection`, `TableLayout`, …), not signatures. To
learn that sortability is signaled by the _presence_ of `sortDirection`, that
`onSortChange` is a bare `() => void` the caller drives, that `TableHead`/
`TableCell` accept a `label` override for non-text headers, that `selected` lives
on `TableRow`, and that `colSpan` lives on `TableCell`, I had to read the exported
`.d.ts`/source. ADR-007 gives the architecture but no usage example.
_Fix:_ fill in the Table docs page with a worked `Table`/`TableHeader`/
`TableHead sortDirection`/`TableRow selected`/`TableCell` example, and expand the
Table entry in `component-reference.md` beyond type names.

### G-SORT-SEMANTICS — Sort-toggle cycle undocumented (medium)

ADR-007 mentions a "pure sort-toggle-cycling function" headless helper, but none
is exported (registry/llms-components list none), and no doc states the intended
cycle (2-state vs 3-state incl. `'none'`) or that `onSortChange` receives **no**
direction argument (the caller computes the next state). Each caller reinvents it.
_Fix:_ either ship the documented `aria-sort`-cycling helper ADR-007 alludes to,
or show the toggle in the Table docs example.

### G-STACKED-LAYOUT — No way to drive `layout="stacked"` from the AI docs (medium)

ADR-007 designs the `scroll`/`stacked` responsive split and the column-label
registration, and `component-reference.md` lists `TableLayout` — but the AI docs
expose **no** breakpoint/viewport hook to pick the layout value (responsive
policy is app-owned per ADR-013 D3). The demo uses an internal
`useShellLayoutClass`; a fresh agent has no documented equivalent and must either
invent one or stay on the scroll default (I stayed on the default).
_Fix:_ document one canonical caller-side width-switch pattern (Web `md:` +
native `useWindowDimensions()` vs a breakpoint token) in the cookbook/Table page,
so the stacked half of ADR-007 is reachable from the docs.

### G-FILTER-CHOICE — Filter-control mapping is ambiguous (low)

ADR-013 D5 / cookbook Recipe C list `SearchInput`, `Chip`/`ChipGroup`,
`SegmentedControl`, and `Pagination` as #260's "filters" without saying which
control fits which filter axis (multi-select facet vs single-select status vs
paging). All compile, so an agent guesses the UX — I chose `SegmentedControl` for
status where the demo used a second `ChipGroup`.
_Fix:_ a one-line "when to use Chip vs SegmentedControl for filters" note.

### G-CHIPGROUP-VALUE — `ChipGroup` value narrowing is inferable only from the type (low)

`ChipGroup`'s `onValueChange` yields `ChipGroupValue = string | string[]`;
driving a caller-owned `string[]` filter needs
`Array.isArray(value) ? value : [value]`. Neither the cookbook nor
`component-reference.md` shows this; it is inferable from the type alone.
_Fix:_ a multi-select `ChipGroup` snippet in Recipe B/C.

## Constraints honored

New files are confined to `examples/demo-reproduction-records/**` plus this
report. No `packages/*`, registry, component source, CLI, or `llms*.txt`/cookbook
edits were made (gap-closing is #242's lane — gaps are reported here only), so
`pnpm llms:check` / `pnpm ai-contract:check` / `docs:*:check` remain green
unchanged. No publish, no tag, no owner gate crossed.
