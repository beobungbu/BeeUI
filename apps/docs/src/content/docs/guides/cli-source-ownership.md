---
title: CLI & source ownership
description: Use the public BeeUI CLI release candidate to copy governed component source into your repository and own it safely afterwards.
---

Source ownership means BeeUI component source lives in **your** repository: you read it, edit it,
review its diffs, and decide when to take upstream changes. The public CLI is
`@beemvp/beeui-cli` and the current release candidate is `0.86.2-rc.1` on npm tag `next`.

## Run the public RC CLI

```bash
npx @beemvp/beeui-cli@next --help
npx @beemvp/beeui-cli@next init
npx @beemvp/beeui-cli@next list
npx @beemvp/beeui-cli@next add --dry-run button
npx @beemvp/beeui-cli@next add button
npx @beemvp/beeui-cli@next doctor
npx @beemvp/beeui-cli@next diff
npx @beemvp/beeui-cli@next update
```

Pin `@0.86.2-rc.1` instead of `@next` when you need an immutable CLI version in automation.

The CLI resolves the project from the current working directory, so run it from the consumer project you want it to modify.

## Command contract

| Command | Behavior |
| --- | --- |
| `help` | Print usage text. |
| `version` | Print the CLI package name and version. |
| `init` | Create the config file without overwriting an existing one. |
| `list` | List supported public Registry items in stable order. |
| `add <items...>` | Preflight and copy source plus transitive BeeUI dependencies. |
| `doctor` | Validate Registry integrity and the local source-ownership state. |
| `verify` | Alias for `doctor`. |
| `diff [items...]` | Compare previously added source against the bundled Registry; never mutates. |
| `update [items...]` | Re-sync previously added files whose upstream source changed. |

| Option | Applies to | Behavior |
| --- | --- | --- |
| `--all` | `add` | Add the complete stable Registry surface. |
| `--dry-run` | `add`, `update` | Print the deterministic plan without filesystem mutation. |
| `--overwrite` | `add` | Explicitly replace differing destination files after preflight. |
| `--force` | `update` | Overwrite files where both local and upstream changed, discarding the local edit. |

Exit code `0` means success; usage, validation and runtime errors exit `1` with the reason on stderr.

## Source ownership versus package consumption

| | Package boundary | Source ownership |
| --- | --- | --- |
| What lands in your repo | Dependency declarations | Actual component/theme source files |
| Who edits component implementation | Upstream BeeUI package | Your project |
| Upgrade | Bump package version/tag | Review `diff`, then `update` deliberately |
| Version identity | npm package version | Per-file content digest + bundled Registry version |
| Public RC today | `@beemvp/beeui-*@next` | `npx @beemvp/beeui-cli@next …` |

The models are not mutually exclusive: a project can consume BeeUI packages centrally while owning a small number of customized components.

## Registry behavior

- Requested items are normalized and dependency closure is resolved deterministically.
- Registry metadata is JSON, not executable code.
- Every copied file is checked against the bundled Registry and expected digest.
- `add` preflights the full operation before writing.
- `diff` is read-only.
- `update` refuses destructive overwrite unless the appropriate explicit option is present.
- Source ownership changes file ownership, not BeeUI's accessibility/token/behavior contracts.

## Repository-local maintainer mode

When developing BeeUI itself, maintainers can still run the workspace CLI from the BeeUI checkout:

```bash
pnpm beeui list
pnpm beeui add --dry-run button
pnpm beeui doctor
pnpm beeui diff
pnpm beeui update
```

That repository-local path is a maintainer/development convenience. External consumers should use the published CLI RC.

## Release channel

`0.86.2-rc.1` is a prerelease. Stable `latest` is not promoted yet, so documentation and automation must keep using `@next` or the exact RC until the stable release flow completes.

See the repository authority `docs/dist-tag-policy.md` for channel rules and `docs/registry-cli.md` for the full Registry/source-ownership contract.
