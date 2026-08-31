# @beeui/cli

BeeUI's source-ownership CLI: copies BeeUI component source and its transitive dependencies into a consumer project, rewriting `@beeui/core`/`@beeui/tokens` imports so the copied files compile and run standalone — the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) path described in ADR-011's D5 (centralized-vs-source-ownership coexistence).

## Install

```bash
npm install -g @beeui/cli
```

Or invoke it without installing:

```bash
npx @beeui/cli add button
```

## Usage

```bash
beeui help
beeui list
beeui add <component> [<component> ...]
beeui doctor
beeui verify
```

See [`docs/registry-cli.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) for the full command reference, dependency resolution model, and collision/overwrite semantics.

## Package contents

- `dist/beeui.mjs` + `dist/registry-lib.mjs`: the bundled, standalone CLI entry point (no monorepo tree required).
- `dist/registry/`: the canonical `registry.json` plus every component source file it can reference, bundled so a packed install works independently of this repository.
- `src/`: original CLI source, packed alongside `dist/` for reference.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation and architecture decisions.

## License

MIT © Trần Đức Lân
