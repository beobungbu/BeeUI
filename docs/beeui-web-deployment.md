# BeeUI Web deployment — Cloudflare Workers

BeeUI Web uses three Cloudflare Worker environments and a separate package-publication environment:

| Git branch | GitHub environment | Worker | Custom Domain | PR preview |
| --- | --- | --- | --- | --- |
| `development` | `development` | `beeui-dev` | `https://beeui-dev.beemvp.com` | `pr-<n>-beeui-dev.<account-subdomain>.workers.dev` |
| `staging` | `staging` | `beeui-stg` | `https://beeui-stg.beemvp.com` | `pr-<n>-beeui-stg.<account-subdomain>.workers.dev` |
| `main` | `production` | `beeui` | `https://beeui.beemvp.com` | none; staging is the production candidate |

The existing GitHub environment `release` is **not** a Web environment. It remains the owner-approved npm/tag/GitHub Release gate documented in `docs/release-ruleset.md`.

All three Workers use Static Assets. The site remains asset-first; only `/api/*` invokes Worker code first. Launch intentionally provisions no D1, KV, R2, Durable Object, Analytics Engine or Workers AI binding.

## Security boundary

Cloudflare credentials never exist in pull-request/build/test jobs.

`.github/workflows/beeui-web.yml` is the untrusted build side. It checks out the exact source revision, installs repository dependencies, runs Web contracts, builds the composed artifact, validates Wrangler locally, performs HTTP smoke tests and uploads only:

- `worker.mjs`;
- composed `dist/` static assets;
- a non-executable identity manifest.

It contains no `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` reference.

`.github/workflows/beeui-web-delivery.yml` is the trusted side. GitHub only activates a `workflow_run` workflow from the default branch (`main`). The delivery job:

1. verifies the triggering build succeeded;
2. verifies the PR/base branch or exact pushed branch;
3. waits for the exact-SHA delivery gates;
4. checks out **`main`**, never the PR/source branch;
5. downloads the already-built artifact;
6. rejects symlinks or unexpected control-plane files;
7. verifies `manifest.json` and `dist/build-identity.json` against GitHub event data;
8. installs only pinned Wrangler `4.128.0` before the Cloudflare credential is mapped into a process;
9. copies a trusted `.github/deployment/wrangler-*.jsonc` from `main` into the artifact;
10. uses Wrangler `--no-bundle`, so no repository build/postinstall/custom-build hook executes while a Cloudflare token is present.

The only steps receiving `CLOUDFLARE_API_TOKEN` are the final Wrangler upload/deploy commands. The token is never bound into the Worker runtime.

## CI gates

Pull requests into `development` or `staging` receive a preview only after the existing required BeeUI checks are green on the PR check SHA:

- `classify`;
- `verify`;
- `web-a11y`;
- `visual-web-report`;
- `web-consumer`;
- successful `beeui-web` artifact build.

Fork PRs do not receive automatic Cloudflare previews. They remain ordinary no-secret CI until code is brought into a trusted same-repository branch.

After merge into `development` or `staging`, `.github/workflows/beeui-environment-ci.yml` reruns the root `pnpm typecheck` and `pnpm test` contracts on the exact merged SHA. Delivery waits for `environment-ci` plus the successful exact-SHA `beeui-web` artifact before changing the Custom Domain environment.

After merge into `main`, delivery waits for the five branch-protection required checks above on the exact main SHA before production deployment.

Stale environment deliveries are cancelled by per-target concurrency groups.

## Preview semantics

Development and staging enable Workers preview URLs. `wrangler versions upload --preview-alias pr-<n>` creates a non-active Worker Version; it does not replace the active deployment for the Custom Domain.

Cloudflare aliases use the platform format:

```text
<alias>-<worker-name>.<account-subdomain>.workers.dev
```

For example, if the account subdomain is `beemvp`, PR 427 targeting development is expected at:

```text
https://pr-427-beeui-dev.beemvp.workers.dev
```

Preview URLs remain `noindex`. Production has `workers_dev: false` and `preview_urls: false`; `beeui-stg.beemvp.com` is the production candidate.

## Environment secrets

Each deployment environment has one Cloudflare token secret and one account-id variable:

```text
CLOUDFLARE_API_TOKEN   (environment secret)
CLOUDFLARE_ACCOUNT_ID  (environment variable)
```

Use separate Cloudflare tokens for `development`, `staging`, and `production`. Current Worker Version upload/deploy needs `Account -> Workers Scripts -> Edit` (`Workers Scripts Write`). Do not add DNS, KV, R2, D1, billing or token-management permissions unless a future binding actually requires them.

Because `Workers Scripts Write` is account-scoped, token separation is for audit/revocation and GitHub isolation; the hard security boundary is the main-controlled delivery workflow.

### GitHub deployment-branch policy

`beeui-web-delivery.yml` runs from the default branch by design. GitHub matches environment deployment branch policies against the delivery workflow run's `GITHUB_REF`, which is `main` for this `workflow_run` controller. Therefore `development`, `staging`, and `production` must all permit the protected branch `main` (or use **Protected branches only**). Do **not** allow `refs/pull/*` solely to make previews work; PR code never references the environments directly.

The source target (`development`, `staging`, or `main`) is independently verified from the triggering `beeui-web` run before an environment is selected.

## Worker configs

`web/worker/wrangler.jsonc` is the developer/local/dry-run configuration and describes all three targets. It is untrusted when supplied by a PR and is never used by the privileged delivery workflow.

The privileged configs are:

- `.github/deployment/wrangler-development.jsonc`;
- `.github/deployment/wrangler-staging.jsonc`;
- `.github/deployment/wrangler-production.jsonc`.

They contain no custom build command. The Web quality gate fails if executable build hooks are introduced or if trusted delivery starts running repository package scripts.

## Route model

Every environment exposes the same path contract:

- `/` — landing;
- `/docs/**` — documentation;
- `/showcase/**` — Showcase;
- `/demo/**` — Demo;
- `/examples/{slug}` — examples;
- `/changelog/**` — changelog;
- `/llms*.txt` — AI discovery corpus;
- `/api/health` — exact deployment identity;
- unknown `/api/*` — JSON 404;
- missing static asset — real asset 404, never a site-wide SPA fallback.

Examples therefore differ only by hostname, for example:

```text
https://beeui-dev.beemvp.com/examples/<slug>
https://beeui-stg.beemvp.com/examples/<slug>
https://beeui.beemvp.com/examples/<slug>
```

## Runtime evidence

`build-identity.json` travels in the same immutable artifact as the site. `/api/health` returns its `version`, exact source `commit`, and `environment`. Trusted delivery verifies that endpoint after every preview upload and Custom Domain deployment.

Cloudflare preview aliases and Custom Domains are delivery surfaces only; generated canonical metadata remains the production origin `https://beeui.beemvp.com`.

## Future bindings

When a real API needs D1/KV/R2/DO/Workers AI/service bindings, add only the required binding and corresponding least-privilege token permission. Secrets never belong in source control, static assets, `build-identity.json`, or Worker bindings unless the application explicitly needs that runtime secret.
