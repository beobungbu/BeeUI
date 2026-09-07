---
title: Reference
description: Exact BeeUI API, token, CLI, Registry and styling facts, derived from the canonical sources rather than restated.
---

Use **Reference** when you need a fact, not a tutorial: does this symbol exist, what is it called,
where does it come from. For how to achieve something use [Guides](/docs/guides/); for the model
behind it use [Learn](/docs/learn/).

## Public surface

These pages are generated from the same public-surface inventory that enforces documentation
ownership, so they list exactly what the packages export — no more, and nothing that has been
removed.

| Page | Covers |
| --- | --- |
| [Tokens](/docs/reference/tokens/) | token groups, runtime values and types, machine-readable exports from `@beemvp/beeui-tokens` |
| [Core](/docs/reference/core/) | public values and types from `@beemvp/beeui-core` |
| [CLI](/docs/reference/cli/) | every Registry CLI command and flag |
| [Registry](/docs/reference/registry/) | public Registry items that are not component families |
| [Styling](/docs/reference/styling/) | the public CSS entry point |

Component families have their own generated pages under [Components](/docs/components/), and
production patterns under [Patterns](/docs/patterns/).

## Adjacent reference surfaces

| Surface | Where |
| --- | --- |
| Supported and tested versions | [Compatibility](/docs/compatibility/) |
| Release channel, version authority and publication state | [Migration & versioning](/docs/guides/migration-versioning/) |
| Security reporting and source-ownership implications | [Release & security](/docs/release-security/) |
| Performance envelope and budgets | [Performance](/docs/performance/) |
| Machine-readable docs for agents | [AI & LLM surfaces](/docs/ai/) |
| Architecture decisions | [Architecture](/docs/architecture/) |

:::caution[Publication state]
BeeUI packages and the CLI are not published to npm. Every command on these pages runs from a
repository checkout; publication remains owner-gated by [#254](https://github.com/beobungbu/BeeUI/issues/254).
:::
