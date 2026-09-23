# @beemvp/beeui-cli

BeeUI's source-ownership CLI: copies BeeUI component source and its transitive dependencies into a consumer project, rewriting `@beemvp/beeui-core`/`@beemvp/beeui-tokens` imports so copied files compile and run standalone — the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) path described in ADR-011's D5.

## Distribution state

**Public release candidate:** `@beemvp/beeui-cli@0.86.2-rc.2` is published on npm. During RC use the explicit `@next` channel (or pin the exact version):

```bash
npx @beemvp/beeui-cli@next --help
```

The live registry currently also resolves `latest` to this RC, but the bootstrap publish used `--tag next` and the mechanism that also created the observed `latest` value has not been established. BeeUI therefore documents `@next` as the RC contract; a bare install is not the recommended RC path because `latest` moves to stable at the first deliberate stable promotion.

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
