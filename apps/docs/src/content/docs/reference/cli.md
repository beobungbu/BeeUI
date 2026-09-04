---
title: CLI reference
description: Every command and flag the BeeUI Registry CLI accepts.
---

:::caution[Generated file]
Do not hand-edit this page. It is written by `scripts/public-reference.mjs` from
`docs/public-surface.inventory.json`, so it lists exactly the surfaces the #473 ownership
gate routes here. Prose lives in `docs/reference.content.json`.
:::

The exact command surface. [CLI and source ownership](/docs/guides/cli-source-ownership/) explains when to use each one and what it does to your project; this page is the lookup table.

The CLI copies component source into your repository and never installs npm packages, fetches remote code, or executes anything it did not ship with. Its registry data is bundled with the package.

Run commands as `pnpm beeui <command>` from a checkout. pnpm forwards `--` to the script as a literal argument, so `pnpm beeui -- <command>` fails on the separator rather than running.

## Commands (9)

| Name | Classification | Source |
| --- | --- | --- |
| `add` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `diff` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `doctor` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `help` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `init` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `list` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `update` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `verify` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `version` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |

## Flags (8)

| Name | Classification | Source |
| --- | --- | --- |
| `--all` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `--dry-run` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `--force` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `--help` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `--overwrite` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `--version` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `-h` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
| `-v` | consumer | [`packages/cli/src/beeui.mjs`](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs) |
