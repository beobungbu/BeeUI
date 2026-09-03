# BeeUI Web deployment — Cloudflare Workers

`beeui.beemvp.com` is designed as one Cloudflare Worker origin with Static Assets. The static site remains asset-first; only `/api/*` invokes Worker code first. The launch runtime intentionally provisions no D1, KV, R2, Durable Object, Analytics Engine or Workers AI binding until a real feature needs one.

Canonical configuration: [`web/worker/wrangler.jsonc`](../web/worker/wrangler.jsonc).

Official platform references used for this launch contract:

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/wrangler/environments/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

## Build one deploy artifact

From a clean checkout on the pinned Node/pnpm toolchain:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir web/worker build
pnpm --dir web/worker typecheck
pnpm --dir web/worker test
pnpm --dir web/worker validate
```

The build runs the public Docs, Showcase and Demo production builds, regenerates landing/examples/SEO/LLM assets, then composes them into `web/worker/dist/` with final-path collision detection. Showcase and Demo use their dedicated `/showcase` and `/demo` public base-path exports, not the root-hosted engineering builds.

The composed tree also contains `build-identity.json` with workspace version, exact Git SHA and build environment. `/api/health` reads that asset, so runtime identity travels atomically with the static deployment.

## Route model

- Existing static asset -> served directly by Workers Static Assets.
- `/api/health` -> Worker JSON with exact build identity, `Cache-Control: no-store`.
- Unknown `/api/*` -> intentional JSON 404.
- Missing static file -> real asset 404. There is no site-wide SPA fallback that could return HTML as missing JavaScript/CSS.

`_headers` adds `nosniff`, referrer and permissions policy to static assets, longer browser caching only for fingerprinted Astro/Expo asset folders, short revalidation for `llms*.txt`, and `X-Robots-Tag: noindex` for versioned `workers.dev` previews. We intentionally do not set `X-Frame-Options`/`frame-ancestors` at launch because component docs embed the same-origin Showcase. A restrictive CSP must be introduced only after verifying it against Starlight, Expo Web and embedded previews.

## Local production-like development

Build first, then:

```bash
pnpm --dir web/worker dev
```

The command uses pinned Wrangler `4.128.0` and the same `wrangler.jsonc`. No Cloudflare production token is needed for ordinary local `wrangler dev`.

Smoke at least `/`, `/docs/`, one component page, one pattern page, `/showcase/`, `/demo/`, `/llms.txt`, `/api/health`, an unknown static route and an unknown `/api/*` route.

## Preview deployment

The top-level Wrangler environment is `beeui-web-preview`, enables `workers.dev` and preview URLs, and has no Custom Domain. CI pull requests build and dry-run only; they never receive Cloudflare credentials.

An authorized manual workflow dispatch may deploy preview with:

```bash
BEEUI_WEB_ENV=preview pnpm --dir web/worker build
pnpm --dir web/worker deploy:preview
```

CI requires least-privilege `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only in the manual deploy job/environment. Record the deployed URL and exact SHA from the build identity/health endpoint. Preview URLs are never canonical in generated HTML and receive `X-Robots-Tag: noindex` where the Workers hostname pattern matches.

## Production Custom Domain — OWNER ACTION REQUIRED

Production is the named Wrangler `production` environment. It changes the Worker name to `beeui-web`, disables `workers.dev`/preview URLs and declares:

```json
{
  "pattern": "beeui.beemvp.com",
  "custom_domain": true
}
```

**Do not run the production deployment autonomously.** Deploying this environment is the owner-authorized action that can create/change the Worker Custom Domain, DNS and certificate state:

```bash
BEEUI_WEB_ENV=production pnpm --dir web/worker build
pnpm --dir web/worker deploy:production
```

Before that action, confirm the Cloudflare zone is active and inspect `beeui.beemvp.com` for an existing CNAME/service conflict. Cloudflare documents that a Custom Domain cannot be created on a hostname with an existing CNAME. Do not delete or replace DNS without explicit owner authorization.

After activation verify TLS, canonical metadata, all route families and `/api/health` against the production hostname. `workers.dev` must not be treated as the production canonical origin.

## Future bindings

When a real API needs D1/KV/R2/DO/Workers AI/service bindings, add only the required binding to Wrangler and the `Env` runtime contract. The public hostname, composed static artifact and `/api/*` namespace do not need to move. Bindings and secrets must remain environment-specific; secrets never belong in source control or `build-identity.json`.
