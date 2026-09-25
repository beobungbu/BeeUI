# @beemvp/beeui-cli

BeeUI's source-ownership CLI: copies BeeUI component source and its transitive dependencies into a consumer project, rewriting `@beemvp/beeui-core`/`@beemvp/beeui-tokens` imports so copied files compile and run standalone — the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) path described in ADR-011's D5.

## Distribution state

**Release candidate:** this package currently ships as a release candidate. BeeUI release candidates are published under the explicit `@next` channel; during RC use it (or pin an exact version — see [CHANGELOG.md](https://github.com/beobungbu/BeeUI/blob/main/CHANGELOG.md) for the current candidate):

```bash
npx @beemvp/beeui-cli@next --help
```

During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the BeeUI owner moves it for all four packages, so it lags `next` between an RC publication and that move; stable `0.86.2` moves `latest` at stable promotion. BeeUI therefore documents `@next` as the RC contract, and a bare install is not the recommended RC path.

Repository-local `pnpm beeui ...` remains supported from a source checkout.

## Usage

Current repository-local usage:

```bash
pnpm beeui help
pnpm beeui list
pnpm beeui add <component> [<component> ...]
pnpm beeui doctor
pnpm beeui verify
```

See [`docs/registry-cli.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) for the full command/flag reference, dependency resolution model, and collision/overwrite semantics.

## Package contents

- `dist/beeui.mjs` + supporting modules: the release-ready standalone CLI entry point (no monorepo tree required after packing).
- `dist/registry/`: canonical `registry.json` plus every source file it can reference, bundled so packed-consumer verification works independently of this repository.
- `src/`: original CLI source, packed alongside `dist/` for reference.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation and architecture decisions.

## License

MIT © Trần Đức Lân
