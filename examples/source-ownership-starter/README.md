# BeeUI source-ownership starter (#231)

R10.2 — proves the packed, unpublished `@beemvp/beeui-cli` engine end-to-end:
`beeui init` + `beeui add button popover` copy component source directly
into this app. `popover` is the representative anchored-overlay slice that
declares a resolvable `@beemvp/beeui-tokens` runtime dependency (the
[#355](https://github.com/beobungbu/BeeUI/issues/355) fix,
[ADR-011](../../docs/decisions/011-distribution-architecture.md) D5) —
`button` is the simpler vendored-`@beemvp/beeui-core` vertical slice. There is no
`@beemvp/beeui-ui`/`@beemvp/beeui-core` dependency anywhere in this app: all component
source is local, editable, and committed.

## Unpublished status

`@beemvp/beeui-cli` is not published to npm ([docs/registry-cli.md](../../docs/registry-cli.md)).
`setup.sh` builds the packed artifact (`pnpm --filter @beemvp/beeui-cli run build`,
producing `packages/cli/dist/beeui.mjs`) and runs that built binary directly
— the same packed-artifact verification method `pnpm cli:smoke` already
uses in CI — not a global install and not a monorepo shortcut. `@beemvp/beeui-tokens`
(the one BeeUI package this starter actually depends on) is installed from a
freshly packed `pnpm pack` tarball, same as the other starters.

## Run it

```sh
# from the repo root, once:
pnpm build

cd examples/source-ownership-starter
bash setup.sh   # beeui init + beeui add button popover + npm install
npm run build   # vite build — production bundle
```

`setup.sh` is idempotent: `beeui add` reports `UNCHANGED` for files whose
content already matches (see `docs/registry-cli.md`'s collision policy), so
re-running it after a clean checkout is safe.

## What's committed vs. generated

- **Committed** (this is the point of source ownership): `beeui.config.json`,
  `src/components/beeui/`, `src/lib/beeui/`, `src/beeui/theme.css` — all
  produced by `beeui add` and then owned/versioned by this repo, exactly like
  a real BeeUI source-ownership consumer would.
- **Generated, gitignored**: `node_modules/`, `dist/`, `.beeui-tarballs/`.

## Acceptance evidence (2026-08-31, base `06bca3a`)

```
$ node packages/cli/dist/beeui.mjs add button popover
Requested: button, popover
Resolved: core-cn -> theme -> text -> button -> core-overlay -> overlay-runtime -> use-direction -> popover
...
External package requirements (install/manage manually):
  dependency @beemvp/beeui-tokens@0.1.0 [declared in dependencies as file:.beeui-tarballs/beeui-tokens-0.1.0.tgz]
  dependency class-variance-authority@0.7.1 [declared in dependencies as 0.7.1]
  dependency clsx@2.1.1 [declared in dependencies as 2.1.1]
  dependency tailwind-merge@3.6.0 [declared in dependencies as 3.6.0]
  ...
Source ownership plan applied. External packages, if missing, still require manual installation.

$ node packages/cli/dist/beeui.mjs doctor
BeeUI doctor OK: registry schema v1, 62 public components, valid beeui.config.json.

$ npm run build
vite v8.2.2 building client environment for production...
✓ 491 modules transformed.
dist/index.html                   0.41 kB │ gzip:   0.27 kB
dist/assets/index-rIT8mkt9.css   25.44 kB │ gzip:   5.14 kB
dist/assets/index-j1VeOWRG.js   377.39 kB │ gzip: 122.16 kB
✓ built in 1.21s
```

`src/components/beeui/popover.tsx` keeps its resolvable
`import { layer } from '@beemvp/beeui-tokens';` and has no `@beemvp/beeui-core` or
`workspace:*` reference — confirmed by grep during this run.
