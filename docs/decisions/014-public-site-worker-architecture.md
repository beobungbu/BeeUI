# ADR-014 — BeeUI public site, multi-app composition, and Worker origin

- **Status:** Accepted for the #412 public-web program
- **Date:** 2026-09-02
- **Production origin:** `https://beeui.beemvp.com`
- **Machine authority:** `web/public-site.config.json`

## Context

BeeUI already has a Starlight docs app, an Expo Web Showcase, an Expo Router production reference demo, generated component/pattern/LLM contracts, and repository-local Registry tooling. The launch program must expose those surfaces on one origin without inventing duplicate inventories or forcing static traffic through unnecessary Worker execution.

Cloudflare Workers is the production origin. Cloudflare Pages is not a production authority for this program.

## Decision 1 — canonical route tree

| Route | Owner | Public behavior |
| --- | --- | --- |
| `/` | `web/site` | product landing |
| `/docs/**` | `apps/docs` | canonical Starlight documentation |
| `/showcase/**` | `apps/showcase` | interactive component/pattern Showcase |
| `/demo/**` | `apps/demo` | routed production reference application |
| `/examples/**` | `web/site` | curated consumer/reference index |
| `/changelog/**` | `web/site`, derived from `CHANGELOG.md` | public changelog |
| `/llms*.txt` | existing LLM generator | plain-text agent context |
| `/api/*` | `web/worker` | reserved Worker runtime namespace |

The legacy root-level Starlight families listed in `web/public-site.config.json` redirect permanently with HTTP 308 to the same path under `/docs`. They are redirects only, never duplicate canonical documents.

## Decision 2 — keep Starlight, mount docs at `/docs`

`apps/docs` remains Astro + Starlight and builds as a static site mounted at `/docs`. The product landing is a separate framework-light static surface so landing design can be bespoke without turning the documentation runtime into a React Native app.

Starlight remains the authority for docs sidebar/search/accessibility primitives. Content lanes must not independently mutate global route or top-navigation policy; they consume `web/public-site.config.json` and add route-local content only.

Docs previews may link to or embed the same-origin Showcase. They must not bundle a second React Native runtime merely to reproduce an example already owned by `apps/showcase`.

## Decision 3 — one deterministic static-assets collection

All accepted Web outputs are composed into one clean Worker assets directory (`web/worker/dist`) before deployment. Composition fails on path collision rather than silently overwriting files.

This was chosen over separate Workers because it gives BeeUI:

- one atomic deployment and one Custom Domain;
- stable same-origin URLs for docs, Showcase, demo, examples, changelog, and LLM files;
- direct static-asset caching;
- no service-binding complexity for surfaces that are already static;
- one future API/runtime boundary.

Iframes are optional presentation tools for isolated live previews, not the hosting architecture.

## Decision 4 — static-first Worker routing

The Worker config uses one Static Assets collection and an `ASSETS` binding. Static assets remain asset-first. Only `/api/*` is configured for Worker-first execution.

The current Cloudflare Static Assets contract permits `assets.run_worker_first` to be a route-pattern array. This avoids charging/latency from routing ordinary immutable assets through Worker JavaScript while preserving an explicit runtime namespace.

At launch the runtime surface is intentionally tiny:

- `GET /api/health` returns deterministic build identity;
- unknown `/api/*` returns JSON 404;
- no database, KV, R2, Durable Object, Workers AI, or other binding is provisioned until a product requirement needs it.

Future bindings are local additions to Worker config/types/runtime and do not require moving the origin.

### Health schema

```json
{
  "ok": true,
  "service": "beeui-web",
  "version": "20260902.0.0",
  "commit": "<build-sha>",
  "environment": "production|preview|local"
}
```

The endpoint must not expose secrets or arbitrary environment state and must use intentional JSON/cache headers.

## Decision 5 — Expo Web subpaths use Expo base URL, not post-build patching

The Showcase exports for `/showcase` and the demo exports for `/demo` must use Expo's `experiments.baseUrl` facility. Expo Router automatically prepends the configured base URL to `Link` and router navigation; static assets are likewise emitted with the prefix.

This is preferred over string-rewriting generated HTML because it keeps navigation and asset paths inside the supported Expo export contract. W8/W9 own the exact app-config changes and direct-refresh evidence.

## Decision 6 — source-of-truth mapping is machine-owned

`web/public-site.config.json.contentSources` is the public-site authority map. Public content may summarize or transform these sources, but it must not maintain an independent component list, pattern list, compatibility table, version, publication state, or changelog.

Dynamic truth is read from its canonical source at build/check time:

- version from manifests;
- publication from `docs/dist-tag-policy.md` and its checker;
- compatibility from the compatibility contract;
- components from public exports + Registry + component generator;
- patterns from Pattern Gallery metadata/generator;
- LLM context from existing generators;
- changelog from `CHANGELOG.md`.

## Decision 7 — public, protected, and internal content

A stable public export may be documented even while npm publication is closed; documentation of an API is not a publication claim. Public pages must state the available evaluation/source-ownership path accurately.

Repository maintenance control-plane material, private credentials, owner-only release actions, and internal reproduction/evidence fixtures are not copied into public navigation. They may be linked as repository evidence only when useful and safe.

BeeUI Web support is a platform dimension of the React Native UI system. There is no separate Web Components distribution or route unless a real exported product contract is introduced later.

## Decision 8 — navigation ownership

Top-level navigation is the ordered `navigation` array in `web/public-site.config.json`:

Docs → Components → Patterns → Showcase → Demo → GitHub.

Landing, docs overrides, Showcase, and demo may render that navigation in their own technology, but labels/destinations must be checked against the contract. Mobile rendering may collapse presentation but must preserve destinations, keyboard access, and visible focus.

## Build/output contract

```text
web/dist/                     landing/examples/changelog staging output
apps/docs/dist/               Starlight output, built for /docs
apps/showcase/dist-web/       Expo Web output, built for /showcase
apps/demo/dist-web/           Expo Router Web output, built for /demo
web/worker/dist/              clean collision-checked composed deployment assets
web/worker/src/index.mjs      Worker runtime
web/worker/wrangler.jsonc     Worker deployment authority
```

W13 owns the composer and Worker config. A clean composition must delete stale output first and copy each source only into its contracted prefix.

## 404/fallback contract

- Starlight missing docs routes: real public 404.
- Missing static JS/CSS/image: real missing response, never landing HTML with 200.
- Showcase fallback behavior: defined by its accepted Web navigation model in W8.
- Demo nested route behavior: defined by Expo Router/static export in W9.
- Unknown `/api/*`: JSON 404 from Worker.

## Local developer flow

Once W13 lands, the single production-like flow is:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm web:build
pnpm web:worker:dev
```

Before W13, each constituent app can be built with its existing workspace `build:web`/`docs:build` commands.

## Consequences

- W3–W14 inherit one route/source/navigation contract.
- A final deploy is atomic even though the source contains multiple apps.
- Static traffic can bypass Worker JavaScript.
- React Native runtime code remains in Showcase/demo exports rather than being duplicated across ordinary docs pages.
- Custom Domain activation remains an owner/account action; this ADR performs no DNS mutation.
