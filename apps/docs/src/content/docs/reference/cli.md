---
title: CLI reference
description: Every command and flag the BeeUI Registry CLI accepts.
---

<!-- Generated file: written by scripts/public-reference.mjs from docs/public-surface.inventory.json. Prose lives in docs/reference.content.json. Do not hand-edit. -->

The exact command surface. [CLI and source ownership](/docs/guides/cli-source-ownership/) explains when to use each one and what it does to your project; this page is the lookup table.

The CLI copies component source into your repository and never installs npm packages, fetches remote code, or executes anything it did not ship with. Its registry data is bundled with the package.

Run commands as `pnpm beeui <command>` from a checkout. pnpm forwards `--` to the script as a literal argument, so `pnpm beeui -- <command>` fails on the separator rather than running.

## Commands (9)

Derived from [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs).

| Command | Description |
| --- | --- |
| `add` | Preflight and copy source plus transitive BeeUI dependencies. |
| `diff` | Compare previously-added source against the current registry, without naming items explicitly diffs every item 'add' has already synced at least one file for. Never mutates the project. |
| `doctor` | Validate the canonical registry, local BeeUI config, and bundled registry integrity (see "registry delivery" below). |
| `help` | Show this help. |
| `init` | Create beeui.config.json without overwriting an existing config. |
| `list` | List supported public registry components in stable order. |
| `update` | Re-sync previously-added files whose upstream source changed since the last sync. Never touches a file with local edits unless the upstream source for that same file also changed. |
| `verify` | Alias for doctor. |
| `version` | Print the installed @beemvp/beeui-cli name and version. |

## Flags (8)

| Flag | Applies to | Description |
| --- | --- | --- |
| `--all` | `add` | Add the complete stable public registry surface (same set as 'beeui list'), instead of naming items explicitly. |
| `--dry-run` | `add`, `update` | **add**: Show the deterministic plan without filesystem mutation. **update**: Show the deterministic update plan without filesystem mutation. |
| `--force` | `update` | Also overwrite files where both local and upstream content changed since the last sync, discarding the local edit. Never applied without this flag. |
| `--help` | any command | Show this help. |
| `--overwrite` | `add` | Explicitly replace differing destination files after preflight. |
| `--version` | any command | Print the installed @beemvp/beeui-cli name and version. |
| `-h` | any command | Show this help. |
| `-v` | any command | Print the installed @beemvp/beeui-cli name and version. |
