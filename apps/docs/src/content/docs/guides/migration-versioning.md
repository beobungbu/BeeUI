---
title: Migration & versioning
description: Understand BeeUI's public RC channel, version authority, and the migration rules that will govern later upgrades.
---

BeeUI now has its first public npm release: **`0.86.2-rc.1`** under the opt-in **`next`** dist-tag. Stable **`latest`** is intentionally not promoted yet.

Because this is the first public package release, there is still no older public BeeUI version to migrate from. The migration work today is primarily for repository/internal consumers moving onto the public package boundary.

Canonical source: https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md

## Which channel am I on?

| Channel | Exists today | What it means |
| --- | --- | --- |
| **Prerelease (`next`)** | Yes | Public opt-in release-candidate channel; currently `0.86.2-rc.1`. |
| **Stable (`latest`)** | Not promoted yet | Reserved for a fully verified stable version; never points to a prerelease. |
| **Repository source** | Yes | Development/evaluation path for exact commits and unpublished work. |

Install the current RC explicitly:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

Pin `@0.86.2-rc.1` instead of `@next` when reproducibility matters more than following the newest RC.

## Version authority

- `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` release in lockstep.
- The root workspace manifest carries the candidate version.
- `docs/dist-tag-policy.md` is the machine-checked authority for public channel state.
- Package exports and generated references are the authority for public API shape.
- Publication requires the protected GitHub `release` environment and the approved npm release workflow.

## Moving from repository/internal consumption to the public RC

Replace monorepo-relative imports, workspace links, or manually packed release artifacts with the public scoped packages.

Before:

```text
workspace link / local tarball / monorepo-relative package path
```

After:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
```

Application imports stay on the public package surface:

```ts
import { BeeUIProvider, Button } from '@beemvp/beeui-ui';
```

For source ownership, use the published CLI rather than a repository-local shim:

```bash
npx @beemvp/beeui-cli@next add button
```

## Stability terminology

| Status | Promise | Removal path |
| --- | --- | --- |
| **stable** | Part of the governed public contract. | Deprecate first; remove only through an appropriate major-version path after the compatibility window. |
| **experimental** | Publicly available but not yet covered by the full stability promise. | May change with lighter notice until promoted. |
| **deprecated** | Still available for compatibility while consumers migrate. | Remove only after the documented replacement/window requirements are met. |

Authoring aliases and deprecated compatibility aliases are distinct concepts and must not be conflated in token/API metadata.

## Semver policy for future releases

BeeUI applies semver to its inventoried public surface: package exports/subpaths, typed component contracts, CLI commands and exit-code behavior, governed public tokens, and Registry/config schemas.

| Level | Examples |
| --- | --- |
| **Major** | Removing/renaming a public export; incompatible prop change; removing a CLI command/flag; removing a stable token after its window; incompatible schema change. |
| **Minor** | Adding a component, optional prop, CLI command/flag or token; widening a peer range after verification; promoting an experimental surface to stable. |
| **Patch** | Backward-compatible fixes, docs corrections, packaging fixes that do not change the public contract. |

Prerelease identifiers (`-rc.N`) are opt-in test releases and do not change the rule that `latest` must never point to a prerelease.

## What to check before upgrading between RCs

1. Read `CHANGELOG.md` for the target RC.
2. Check `docs/compatibility-matrix.md` for peer/toolchain changes.
3. Check migration notes for any intentional public-surface change.
4. Upgrade all BeeUI packages together; do not mix RC numbers inside one application.
5. Typecheck and build/export every platform you ship.
6. Re-run source-ownership `diff` before `update` if you own BeeUI source locally.

## Stable promotion

Stable `0.86.2` will be a separate release event. A successful RC does not authorize or imply stable `latest` promotion. The stable package set must be published/verified according to `docs/dist-tag-policy.md` before the owner moves `latest` in a coordinated operation.

For exact current status, follow `docs/dist-tag-policy.md`; do not copy an old prose statement about publication state into new documentation.
