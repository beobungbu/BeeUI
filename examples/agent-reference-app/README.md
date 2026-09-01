# BeeUI agent reference app (#235)

R10.6 — a small reference application ("Access Requests" review console) built
**only from BeeUI's AI-agent-facing context**: [`llms.txt`](../../llms.txt),
[`llms-full.txt`](../../llms-full.txt), [`llms-components.txt`](../../llms-components.txt),
[`llms-patterns.txt`](../../llms-patterns.txt), and
[`docs/ai-agent-cookbook.md`](../../docs/ai-agent-cookbook.md). It validates that
those docs are enough for a fresh agent to build a real BeeUI app.

The friction found along the way — anything the AI docs did not tell us — is
recorded in [`AGENT-BUILD-NOTES.md`](AGENT-BUILD-NOTES.md), which is the point of
this example.

## Unpublished status

BeeUI is **not published to npm** (see [`../../llms.txt`](../../llms.txt) STATUS
and [ADR-011](../../docs/decisions/011-distribution-architecture.md)). There is no
`@beemvp/beeui-*` package or `@beemvp/beeui-cli` on any registry. This app therefore
consumes real `pnpm pack` tarballs through the same package boundary CI's
`scripts/verify-web-consumer.sh` uses — never a `workspace:*` link and never a
hand-copied `dist/` folder. It is **not** registered in the root pnpm workspace;
it installs its own dependencies with plain `npm install`.

## Run it

```sh
# from the repo root, once (builds package dist for packing):
pnpm build

cd examples/agent-reference-app
bash setup.sh      # packs BeeUI tarballs, npm installs everything
npm run build      # vite build — production bundle
npm run preview    # optional: serve the production build locally
npm run dev        # optional: dev server
```

## What it demonstrates

A realistic, application-owned domain composed from public `@beemvp/beeui-ui`
exports only (BeeUI owns UI; the app owns all request/approval state):

- app shell + provider — `BeeUIProvider`, `Screen`, `AppHeader`
- **theme switching** (a real interaction) — app-level `Uniwind.setTheme`
- a **form flow** — `Field` + `Input` / `Textarea` / `Select` / `SegmentedControl` / `Switch`
- **overlays** — `Dialog` (detail), `AlertDialog` (approve/deny confirm), `Sheet` (panel), `Tooltip`
- a **caller-owned `Table`** — the app maps its own rows; BeeUI ships no data grid ([ADR-007](../../docs/decisions/007-table-datatable-architecture.md))
- **`Calendar`** — timezone-free single date; the app owns formatting ([ADR-008](../../docs/decisions/008-datetime-architecture.md))
- **`useToast`** transient notifications
- `Stat` / `Badge` layout adornments

### Platform note

This is a **Web** target (Vite + react-native-web). `DatePicker` /
`DateTimePicker` are native-only modules (`*.native.tsx`, backed by
`@react-native-community/datetimepicker`) with no Web build, so this app uses
`Calendar` for date entry instead. See `AGENT-BUILD-NOTES.md` gap G4.

## Acceptance evidence

See [`AGENT-BUILD-NOTES.md`](AGENT-BUILD-NOTES.md) for the recorded `npm run build`
output and base SHA.
