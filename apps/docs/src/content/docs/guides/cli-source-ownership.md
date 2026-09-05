---
title: CLI & source ownership
description: Copy BeeUI component source into your repository with the repository-local Registry CLI, and own it safely afterwards.
---

Source ownership means the component source lives in **your** repository: you read it, edit it,
review its diffs, and decide when to take upstream changes. The BeeUI CLI is the deterministic
copier for that model. It runs today from a BeeUI checkout.

:::caution[No public npm CLI yet]
Do not use `npx @beemvp/beeui-cli …`, `npx beeui …`, or public npm install commands as if they resolve today — the packages are not published and stable publication remains owner-gated.
:::

## Run `beeui add` and the rest of the CLI

<p data-pagefind-weight="8">`beeui add` is the command that copies a component's source into your project; the CLI has no
project-targeting flag, so it resolves the project from the current working directory. `pnpm beeui`
runs with the cwd at the BeeUI repository root, so these commands act on **this checkout**, which
is what you want while evaluating the registry from a BeeUI clone:</p>

```bash
pnpm beeui init
pnpm beeui list
pnpm beeui add button
pnpm beeui add --dry-run dialog select
pnpm beeui doctor
pnpm beeui diff
pnpm beeui update
```

`init` writes the config, `list` prints the addable set, `add` copies source plus its dependency
closure, `doctor` validates everything, `diff` shows what moved upstream, and `update` re-syncs
only what is safe to re-sync.

## Command contract

These are all the commands that exist. There are no others.

| Command | Behavior |
| --- | --- |
| `help` | Print the usage text. |
| `version` | Print the installed CLI package name and version. |
| `init` | Create the config file without overwriting an existing one. |
| `list` | List the supported public registry items in stable order. |
| `add <items...>` | Preflight and copy source plus transitive BeeUI dependencies. |
| `doctor` | Validate the canonical registry, the local config, and bundled registry integrity. |
| `verify` | Alias for `doctor`. |
| `diff [items...]` | Compare previously added source against the current registry. Never mutates. With no items, diffs everything `add` has synced at least one file for. |
| `update [items...]` | Re-sync previously added files whose upstream source changed since the last sync. |

| Option | Applies to | Behavior |
| --- | --- | --- |
| `--all` | `add` | Add the complete stable public registry surface instead of naming items. Use as `pnpm beeui add --all`. |
| `--dry-run` | `add`, `update` | Compute and print the deterministic plan with no filesystem mutation. |
| `--overwrite` | `add` | Explicitly replace differing destination files, after the whole operation passes preflight. |
| `--force` | `update` | Also overwrite files where both local and upstream changed, discarding the local edit. Never applied without the flag. |

**Exit codes:** `0` on success; `1` for any usage error, validation failure, or runtime error,
with the reason written to stderr. There is no third code and no partial-success code.

## Source ownership versus package consumption

| | Package boundary | Source ownership |
| --- | --- | --- |
| What lands in your repo | A dependency declaration | Actual component/theme source files |
| Who can edit the component | Upstream only | You |
| Upgrade | Bump the dependency | Review a diff, then re-sync deliberately |
| Version identity | Package version | Content digest recorded per file |
| Available today | Evaluation through locally packed tarballs | Yes, through the repository-local CLI |

Choose source ownership when local visibility and customization are worth owning future diffs.
Choose the package boundary when you would rather take centralized upgrades. The two are not
exclusive — a project can consume packages and own a few customized components.

## Registry and dependency behavior

- **`add` resolves the full closure.** Requested names are de-duplicated, normalized to a stable
  order, and every transitive BeeUI registry dependency is emitted before its dependents.
- **The registry is JSON, never executable.** Registry entries describe files, targets,
  transforms, dependencies and peer expectations. Nothing in the registry is evaluated or shelled
  out to.
- **The registry is bundled, never fetched.** A packed CLI ships its own frozen registry snapshot
  and sources, so no command needs network access and one installed CLI version always resolves
  one registry state. `doctor` reports which delivery mode it is in — bundled with verified
  checksums, or repository-local dev mode against the live source tree.
- **External packages are reported, not installed.** The CLI never invokes a package manager on
  your behalf. `add` reports the external requirements it found; installing them is your explicit
  step. `doctor` adds a semver-aware, informational compatibility report for the peers relevant to
  your detected project kind (Expo, bare React Native, web, or unknown) and never blocks on it.
- **Theme data is part of the contract.** Items using semantic classes declare the `theme` item in
  their closure, so it is copied when absent. Copy it explicitly with `pnpm beeui add theme`.
  The CLI does **not** edit your global CSS entry — after the copy, import the copied theme file
  from the CSS entry your build already owns.

## Files you own after a copy

| File | Created by | Your responsibility |
| --- | --- | --- |
| `beeui.config.json` | `init` | Commit it. Hand-edit the paths if the defaults do not fit. It is versioned; an unrecognized `schemaVersion` fails loudly instead of being migrated. |
| `beeui.manifest.json` | the first non-dry-run `add` | Commit it. It records the item name, source path and content digest last written to each destination — it is the only thing that lets `diff`/`update` tell "you edited this" from "upstream moved this". |
| Copied component/lib source | `add` | Yours outright. BeeUI never touches it again on its own. |
| Copied theme CSS | `add` | Yours, plus the import wiring into your CSS entry. |

Copied source must not retain workspace-protocol dependencies or private monorepo imports — if it
does, that is a bug in the registry entry, not something to patch locally.

The config shape is fixed and small on purpose — exactly four fields, no others:

| Field | Default | Meaning |
| --- | --- | --- |
| `schemaVersion` | `1` | Config format version. Only `1` is accepted. |
| `componentsDir` | `src/components/beeui` | Destination root for copied components. |
| `libDir` | `src/lib/beeui` | Destination root for copied library helpers. |
| `themeFile` | `src/beeui/theme.css` | Exact destination for the copied theme CSS. |

Paths must be project-relative and forward-slashed. Absolute paths, `..`, empty segments and
anything resolving outside the project root are rejected.

## Safe update workflow

1. Preview before the first copy with `pnpm beeui add --dry-run <items...>`.
2. Run the real `add`, then commit the copied files together with `beeui.config.json` and
   `beeui.manifest.json`.
3. Before taking upstream changes, run `pnpm beeui diff <items...>` and read the report.
4. Run `pnpm beeui update <items...>` only after reviewing the plan.
5. Re-run your own typecheck, build and runtime tests — they are the acceptance gate, not the CLI.

`diff` classifies every managed file by comparing three digests (recorded baseline, file on disk,
what the registry would produce now):

| Status | Meaning | What `update` does |
| --- | --- | --- |
| `UNCHANGED` | Matches baseline and upstream | Nothing |
| `UPSTREAM` | Local untouched, upstream moved | Applies it, no flag needed |
| `LOCAL` | Only your edit differs | Never touched, with or without `--force` |
| `SYNCED` | Diverged from baseline but already equals upstream | Nothing |
| `CONFLICT` | Local and upstream both moved and disagree | Left alone; reported as needing `--force` |
| `NEW` | Never copied here | Applies it, no flag needed |
| `MISSING` | Previously synced, now gone from disk | Applies it, no flag needed |
| `UNTRACKED` | A file exists at the destination with no recorded baseline | Left alone; reported as needing `--force` |

`diff` also prints a trimmed unified diff wherever the comparison is informative, and it never
mutates anything. If a later registry version adds a file to an already-added item's closure, that
file classifies as `NEW` and `update` picks it up — you do not have to know which file appeared.

## Failure and recovery

| Situation | What happens | Recovery |
| --- | --- | --- |
| Destination file exists with different content | `add` fails non-zero at preflight, before any write | Review the file, then re-run with `--overwrite` if replacing is correct |
| Destination file exists with identical content | Reported `UNCHANGED`, no write, success | Nothing to do |
| Partial closure would be copied | Cannot happen — the whole closure is preflighted in memory first | — |
| Both local and upstream changed | `update` leaves the file and reports it as needing `--force` | Merge by hand, or re-run `update` with `--force` to discard your edit |
| Unknown item, malformed config or registry, dependency cycle | Exit `1` before any write, reason on stderr | Fix the input and re-run |
| Config with an unsupported `schemaVersion` | Exit `1`; never auto-migrated | Hand-edit to schema v1, or remove it and re-run `init` |
| Symlinked config, or a destination path escaping the project root | Rejected outright, never followed | Use real paths inside the project |
| Bundled registry or source checksum mismatch | Fails loudly with a specific error, never a silent fallback or partial plan | Reinstall the CLI package |
| A peer dependency is missing or incompatible | `doctor` reports it; the command still succeeds | Install or align the peer yourself |

There is no "always force" configuration. `--overwrite` and `--force` are the only destructive
paths and both must be requested every single time.

## What changes after publication

Publication is owner-gated behind issue [#254](https://github.com/beobungbu/BeeUI/issues/254). Nothing below is available yet.

- **What stays the same:** the command, flag and exit-code contract; the collision and update
  policy; the security boundaries; and the fact that copied source is yours. A consumer who has
  already copied source is never affected by a later CLI release changing what a fresh `add`
  would produce — they must upgrade the CLI and re-run `add` deliberately.
- **What changes:** the CLI becomes installable from the public registry instead of only from a
  checkout, so the invocation loses the `pnpm ` repository-script prefix and becomes plain
  `beeui <command>`; the bundled registry
  snapshot and its checksum manifest become version-pinned to the installed release rather than
  to your working tree; and `doctor` reports bundled delivery with verified checksums instead of
  dev mode. Package-manager mutation stays out of scope under a separate owner-gated decision
  ([#215](https://github.com/beobungbu/BeeUI/issues/215)) — `add` and `doctor` remain read-only toward your dependencies either way.

Until then, treat every command in this guide as repository-local.

## Related

- [Start](/docs/start/) — the two consumption models end to end.
- [Provider & safe area](/docs/start/provider-safe-area/) — wiring after the source lands.
- [Branding](/docs/guides/branding/) — customizing the theme you copied.
- [Registry](/docs/registry/) — the item inventory and its identity contract.

## Canonical sources

- [Registry and CLI contract](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md)
- [Registry data](https://github.com/beobungbu/BeeUI/blob/main/registry/registry.json)
- [CLI implementation](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs)
- [Distribution architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)
