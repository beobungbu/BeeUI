# @beemvp/beeui-cli

BeeUI's source-ownership CLI: copies BeeUI component source and its transitive dependencies into a consumer project, rewriting `@beemvp/beeui-core`/`@beemvp/beeui-tokens` imports so copied files compile and run standalone — the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) path described in ADR-011's D5.

## Distribution state

**Unpublished:** `@beemvp/beeui-cli` is not currently available from the public npm registry and must not be presented as an available global install or `npx` command. Publication remains owner-gated by issue #254. The supported evaluation path today is the repository-local command, for example `pnpm beeui -- help` or `pnpm beeui -- add button`.

After publication is explicitly authorized, the intended global install/invocation shapes are:

```bash
npm install -g @beemvp/beeui-cli
```

```bash
npx @beemvp/beeui-cli add button
```

## Usage

Current repository-local usage:

```bash
pnpm beeui -- help
pnpm beeui -- list
pnpm beeui -- add <component> [<component> ...]
pnpm beeui -- doctor
pnpm beeui -- verify
```

See [`docs/registry-cli.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) for the full command/flag reference, dependency resolution model, and collision/overwrite semantics.

## Package contents

- `dist/beeui.mjs` + supporting modules: the release-ready standalone CLI entry point (no monorepo tree required after packing).
- `dist/registry/`: canonical `registry.json` plus every source file it can reference, bundled so packed-consumer verification works independently of this repository.
- `src/`: original CLI source, packed alongside `dist/` for reference.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation and architecture decisions.

## License

MIT © Trần Đức Lân
