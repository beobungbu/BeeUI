# @beemvp/beeui-demo

The production reference application (ADR-013, `docs/decisions/013-production-demo-architecture.md`) is one coherent, routed, multi-screen Expo app proving `@beemvp/beeui-ui` in a realistic application flow. It is not a component catalog: `apps/showcase` owns component/pattern inspection, while this app owns navigation, mock data/service boundaries, and application state like a real BeeUI consumer.

The accepted implementation includes the dashboard, records table, record detail/edit, scheduling, and settings flows originally delivered through #259–#263. Treat the source and tests as the current authority; historical implementation issue boundaries are not public feature status.

> **Unpublished status.** BeeUI is pre-1.0 and unpublished — no `@beemvp/beeui-*` package or BeeUI CLI is available from the public npm registry. This app dogfoods the intended public package shape (public `@beemvp/beeui-ui`/`@beemvp/beeui-tokens` barrel imports only, never `packages/**/src/**` deep paths) through the pnpm workspace during repository development.

## Architecture

- **Consumption model.** Package-boundary consumption only (ADR-013 D1): imports come from the public export surface of `@beemvp/beeui-ui` and `@beemvp/beeui-tokens`.
- **Navigation.** App-owned [Expo Router](https://docs.expo.dev/router/introduction/) (ADR-013 D3). BeeUI supplies UI/chrome; the app owns routes and navigation state.
- **Responsive shell.** Compact widths render bottom navigation; medium/expanded widths promote to a persistent side rail using the canonical BeeUI breakpoint tokens from `@beemvp/beeui-tokens`, not a second breakpoint vocabulary.
- **State & data.** `src/services/**` is the replaceable mock-service seam and `src/state/preferences.tsx` owns app preferences while delegating theme/density behavior to BeeUI's accepted runtimes.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Dashboard |
| `/records` | Records table |
| `/records/[id]` | Record detail/edit |
| `/schedule` | Scheduling |
| `/settings` | Settings/preferences |

## Run from the repository root

Use the workspace scripts from the root manifest; do not substitute generic `npm run build` commands.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @beemvp/beeui-demo start
pnpm --filter @beemvp/beeui-demo web
pnpm --filter @beemvp/beeui-demo build:web
pnpm --filter @beemvp/beeui-demo typecheck
pnpm --filter @beemvp/beeui-demo test
```

`start` launches the Expo dev server and native preview QR. `web` runs the Web target locally. `build:web` creates the static Web export in `apps/demo/dist-web/`. Native `ios`/`android` and bundle scripts remain available on the workspace package when the corresponding toolchain is installed.

## Related

- `docs/decisions/013-production-demo-architecture.md` — architecture authority.
- `docs/responsive-layout.md` — shared responsive contract.
- `apps/showcase` — router-less component and pattern inspection surface.
- `apps/demo/src` — current implementation authority for routes and behavior.
