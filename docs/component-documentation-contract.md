# Component documentation contract

This is the per-component documentation contract for BeeUI (#221). It defines the
documentation every public `@beemvp/beeui-ui` component must carry, and how that coverage
is mechanically enforced so a new public component cannot ship without docs and the
docs cannot drift away from the real component surface.

It is the documentation sibling of the [accessibility documentation
contract](accessibility-contract.md): a fixed set of required fields plus a
machine check that fails CI when the fields are missing or the facts drift.

> STATUS: BeeUI is pre-1.0 and UNPUBLISHED. No `@beemvp/beeui-*` package or CLI is on npm.
> Import/install lines in the generated reference are release-ready-but-not-published
> targets; the working, in-repo path is the source-ownership CLI
> (`pnpm beeui -- add <component>`). See [llms.txt](../llms.txt) for the full status.

## Scope

The contract applies to every registry item that is `public` with `type: "component"`
in [registry/registry.json](../registry/registry.json) — the same set the
[`@beemvp/beeui-ui`](../packages/ui/src/index.ts) barrel exports and
[llms-components.txt](../llms-components.txt) inventories. There are **62** such
components. Private utilities and non-public helpers are out of scope.

## Required sections

Each component's entry in [component-reference.md](component-reference.md) must
document all of the following. Fields marked _derived_ are produced mechanically
from canonical sources; fields marked _curated_ are authored in
[component-reference.content.json](component-reference.content.json).

| Section | Source | What it answers |
| --- | --- | --- |
| **Purpose** | curated | What the component is for, in one sentence (anatomy where it matters). |
| **Import** | derived | The exact `import { … } from '@beemvp/beeui-ui'` line with the real exported symbols. |
| **API** | derived | The exported runtime symbols, typed props, and the source file. |
| **Source ownership** | derived | The `pnpm beeui -- add <name>` command that copies the source into a consumer. |
| **Dependencies / provider** | derived | Peer dependencies, whether a `BeeUIProvider` ancestor is required, and the registry dependencies source-ownership pulls in. |
| **Accessibility** | derived | Link to the authoritative accessibility contract and font-scaling behavior. |
| **Platform (iOS / Android / Web)** | derived | Link to the compatibility matrix and web support contract; platform-split modules are flagged. |
| **Theme / density** | derived | Links to the theming and density contracts. |
| **Behavior contract** | derived | Link to the authoritative behavior description in the [component catalog](components.md). |
| **Executable examples** | derived | Links to typechecked `@beemvp/beeui-showcase` fixtures that import the component's symbols. |
| **Limitations** / **Notes** | curated (optional) | Ownership boundaries and platform caveats where they exist. |

The contract deliberately keeps the detailed behavior prose in one place (the
[component catalog](components.md)) and links to the shared accessibility,
platform, theming, and density contracts rather than copying them per component —
the reference enforces *coverage*, not a duplicate of every shared contract.

## Enforcement

The reference is generated and checked by
[scripts/generate-component-reference.mjs](../scripts/generate-component-reference.mjs)
via [scripts/component-docs-lib.mjs](../scripts/component-docs-lib.mjs):

```
pnpm docs:contract:generate   # (re)write docs/component-reference.md
pnpm docs:contract:check      # fail if stale, incomplete, or drifted
pnpm docs:contract:test       # unit tests for the derivation + checks
```

`pnpm docs:contract:check` runs inside `pnpm typecheck` and the tests run inside
`pnpm test`, so the contract is load-bearing in CI. The check fails when:

- a public component has **no curated content entry**, or an entry names a
  component that is not public (coverage cannot silently lag the component set);
- a content entry has an **empty purpose**;
- a component has **no executable showcase example** importing its symbols;
- the generated document is **missing any required section** for any component;
- the committed `component-reference.md` is **stale** (drifted from the registry,
  the barrel exports, or the showcase — regenerate to fix).

Because the import lines, API symbols, dependencies, and example links are all
derived from `registry/registry.json`, `packages/ui/src/index.ts`, and the
`@beemvp/beeui-showcase` app, a renamed export, a new component, or a removed example
changes the generated output and fails the freshness check until the docs are
regenerated.

## Related

- [component-reference.md](component-reference.md) — the generated per-component reference.
- [components.md](components.md) — the authoritative behavior catalog.
- [pattern-library.md](pattern-library.md) — composed production screens (#223).
- [Executable examples check](../scripts/check-doc-examples.mjs) — validates that
  code examples across the docs reference only real `@beemvp/beeui-ui` exports (#222).
- [accessibility-contract.md](accessibility-contract.md), [compatibility-matrix.md](compatibility-matrix.md),
  [theming.md](theming.md), [density.md](density.md) — the shared contracts the reference links to.
