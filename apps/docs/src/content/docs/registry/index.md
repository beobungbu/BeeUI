---
title: Registry & source ownership
description: Understand BeeUI Registry items, dependency closure, integrity, and consumer-owned update behavior.
---

The BeeUI Registry is the machine-readable map that powers source ownership. A Registry item points to public source, transitive BeeUI dependencies, external package requirements and integrity information. It is not a remote code marketplace and it is not a second package manager.

## Registry item lifecycle

1. **Inspect** the requested item and resolved dependency closure.
2. **Dry-run** the copy plan before mutation.
3. **Copy** source into the consumer paths configured by `beeui.config.json`.
4. **Commit** the copied source in the consumer repository: it is now consumer-owned.
5. **Diff** local files against the current Registry snapshot before an update.
6. **Update** only after reviewing local/upstream changes and re-running consumer verification.

The CLI does not fetch or execute remote code. Its Registry snapshot is bundled with the CLI/package build and verified by integrity metadata.

## Dependencies and setup

BeeUI-to-BeeUI source dependencies are closed transitively by the Registry. External requirements remain explicit consumer responsibilities. For example, an overlay or native sheet may require provider/native peers that should be installed and configured deliberately; the CLI reports those requirements rather than silently changing your app.

Component reference pages read Registry identity/dependency metadata from the same `registry/registry.json` authority. If a component is removed, renamed, or its dependency closure changes, the public Web gate must fail until docs and Registry truth agree.

## Collision and local-edit policy

A normal `add`/`update` must not silently destroy a differing destination file. Use dry-run/diff first. The update flow distinguishes unchanged files, upstream-only changes, local-only changes and true conflicts. Forceful replacement is explicit because, after copying, the consumer owns the source.

## Package boundary vs Registry

Registry ownership is not inherently “better” than package consumption. It trades centralized upgrades for source visibility and customization. See [CLI & source ownership](/docs/guides/cli-source-ownership/) for the decision table and commands, and [Examples](/examples/) for buildable consumers of both models.

## Canonical sources

- [Registry JSON](https://github.com/beobungbu/BeeUI/blob/main/registry/registry.json)
- [Registry/CLI contract](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md)
- [CLI implementation](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs)
- [Distribution architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)
