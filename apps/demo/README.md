# @beeui/demo

The production reference application (ADR-013, `docs/decisions/013-production-demo-
architecture.md`) — one coherent, routed, multi-screen Expo app proving `@beeui/ui` in a
realistic application flow, not a component catalog. Unlike `apps/showcase` (which
deliberately "owns no router"), this app owns its own navigation, mock data/service layer,
and application state — exactly what a BeeUI consumer app would.

This phase (#258) scaffolds the app and its responsive navigation shell only. The six
functional screens are separate, parallel lanes (#259 dashboard, #260 records table, #261
record detail/edit, #262 scheduling, #263 settings + final integration) that fill in the
placeholder routes this shell already wires up.

> **Unpublished status.** BeeUI is pre-1.0 and unpublished — no `@beeui/*` package or the
> `beeui` CLI is on npm. This app dogfoods the **published package shape** (public
> `@beeui/ui`/`@beeui/tokens` barrel imports only, never `packages/**/src/**` deep paths)
> resolved through the pnpm workspace during development, exactly like `apps/showcase`.

## Architecture (owned by #258)

- **Consumption model.** Package-consumption only (ADR-013 D1) — imports come from
  `@beeui/ui`/`@beeui/tokens` public exports.
- **Navigation.** App-owned [Expo Router](https://docs.expo.dev/router/introduction/)
  (ADR-013 D3). BeeUI supplies chrome only (`Screen`, `SafeArea`, `AppHeader`,
  `BottomActionBar`, `Box`/`VStack`); the tab bar/side-rail items, routing, and the
  responsive layout switch are application-owned (`src/shell/**`).
- **Responsive shell.** Compact (`< 768px`) renders a bottom tab bar; `medium`/`expanded`
  promote to a persistent side rail — the single documented native/Web width-switch
  pattern from `docs/responsive-layout.md`, driven by `@beeui/tokens`' `breakpoint` values
  (`src/shell/responsive-nav.ts`), never a literal or a second media-query engine.
- **State & data.** No global store framework. `src/services/**` is the thin, replaceable
  mock-service seam (`mockFetch`) plus the shared `useAsync` idle/loading/success/empty/
  error lifecycle hook every data screen composes with its own fixtures. `src/state/
  preferences.tsx` is the single small app-preferences context (theme/density/direction/
  text-scale), wired to BeeUI's *existing* runtimes (`Uniwind.setTheme`, `applyDensity`,
  the platform's ambient RTL authority) — never a second theme/direction runtime.

## Routes

| Route | Screen | Owning issue |
| --- | --- | --- |
| `/` | Dashboard | #259 |
| `/records` | Records table | #260 |
| `/records/[id]` | Record detail/edit | #261 |
| `/schedule` | Scheduling | #262 |
| `/settings` | Settings + integration | #263 |

## Scripts

| Script | What it does |
| --- | --- |
| `start` | Expo dev server + QR (native preview over the air) |
| `web` | Metro dev server on the Web target |
| `build:web` | Static Web export → `dist-web/` |
| `ios` / `android` | Local native debug build + install (simulator/emulator/device) |
| `bundle:ios` / `bundle:android` | Native Metro bundle export (evidence) |
| `typecheck` | `tsc` over the app |
| `test` | Jest unit suite (shell/services logic; deterministic feature tests land with #259-263) |

## Related

- `docs/decisions/013-production-demo-architecture.md` — the architecture authority.
- `plans/260831-1708-production-demo-app/plan.md` — the screen-by-screen build plan.
- `apps/showcase` — the router-less component catalog this app's Expo/Metro/Uniwind wiring
  mirrors.
