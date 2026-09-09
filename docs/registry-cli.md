# BeeUI Registry + Source-Ownership CLI

## Status

`@beemvp/beeui-cli` is publicly published at **`0.86.2-rc.1`** under npm tag **`next`**. It is the supported source-ownership CLI for the current BeeUI release candidate.

External consumers should run the published RC explicitly:

```sh
npx @beemvp/beeui-cli@next help
npx @beemvp/beeui-cli@next version
npx @beemvp/beeui-cli@next init
npx @beemvp/beeui-cli@next list
npx @beemvp/beeui-cli@next add button
npx @beemvp/beeui-cli@next add --dry-run dialog select
npx @beemvp/beeui-cli@next doctor
npx @beemvp/beeui-cli@next diff
npx @beemvp/beeui-cli@next update
```

Pin `@0.86.2-rc.1` instead of `@next` when an immutable CLI version is required.

Stable `latest` is intentionally not promoted yet, so RC documentation must not use an unqualified CLI package name as the recommended install/run command.

Repository contributors may continue to use the workspace shim, which delegates to the same CLI engine:

```sh
pnpm beeui help
pnpm beeui version
pnpm beeui list
pnpm beeui add --dry-run button
pnpm registry:verify
pnpm registry:test
```

The workflow copies supported BeeUI source into a consumer project. The consumer then owns those copied files. It does not fetch executable remote code and it does not silently install unrelated dependencies.

## Command contract

| Command | Arguments | Purpose |
| --- | --- | --- |
| `help` / `--help` / `-h` | none | Print usage. |
| `version` / `--version` / `-v` | none | Print the installed `@beemvp/beeui-cli` name and version. |
| `list` | none | Print the public Registry surface in stable order. |
| `init` | none | Create `beeui.config.json` without overwriting an existing valid config. |
| `add <items...>` | Registry item names | Preflight and copy source plus transitive BeeUI Registry dependencies. |
| `add --all` | none | Add the complete public Registry surface. |
| `doctor` / `verify` | none | Validate Registry/config/path/integrity state; never mutates. |
| `diff [items...]` | optional items | Compare previously added source against the bundled Registry; never mutates. |
| `update [items...]` | optional items | Re-sync previously added files whose upstream source changed. |

### Options

| Option | Applies to | Behavior |
| --- | --- | --- |
| `--dry-run` | `add`, `update` | Print the deterministic plan without writing. |
| `--overwrite` | `add` | Replace differing destinations only after full preflight passes. |
| `--force` | `update` | Permit overwriting a file with local edits; never implicit. |
| `--all` | `add` | Select the complete public Registry set instead of explicit item names. |

Unknown commands/options/items fail before partial mutation.

**Exit codes:** `0` on success; `1` for usage, validation or runtime failure. stdout is plan/status output; errors go to stderr.

## Source ownership model

Source ownership is intentionally different from normal package consumption:

| | Package boundary | Source ownership |
| --- | --- | --- |
| Consumer receives | npm dependency | component/theme source files |
| Implementation owner | BeeUI upstream | consumer project |
| Upgrade | package version/tag | review `diff`, then deliberate `update` |
| Identity | npm version | per-file Registry digest |

A consumer can mix both models: use centralized BeeUI packages for most UI while owning a few customized components.

## Dependency and integrity behavior

- Registry item resolution is deterministic.
- Requested items include required transitive Registry dependencies.
- Registry metadata is JSON and is validated before use.
- Bundled Registry/source integrity is checksum-verified.
- `add` computes/preflights the complete operation before writing.
- `diff` never mutates.
- `update` protects locally edited files unless the user explicitly opts into destructive overwrite.
- Path traversal/out-of-root targets are rejected.
- External package installation is not silently performed; package requirements are reported to the consumer.

## CLI packaging

The shared implementation lives under `packages/cli/src/`; repository-local and published entry points use that same engine rather than maintaining separate behavior forks.

The published CLI package includes its Registry snapshot and source payload required for source ownership, so external `npx @beemvp/beeui-cli@next ...` runs do not depend on a BeeUI repository checkout.

## Release/version contract

The CLI releases in lockstep with:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`

Current public RC: `0.86.2-rc.1` under `next`.

The channel/version authority is `docs/dist-tag-policy.md`. Do not infer stable availability from the existence of a public RC; stable `latest` is a separate owner-controlled release event.

## Tests and verification

Repository tests pin command parsing, negative cases, Registry integrity, dependency resolution, collision behavior and diff/update semantics. `pnpm release:verify` also installs the packed CLI into a clean consumer and executes its binary before release artifacts are accepted.

For public RC verification, prefer the published command:

```sh
npx @beemvp/beeui-cli@0.86.2-rc.1 --help
```

For contributor verification from source:

```sh
pnpm registry:verify
pnpm registry:test
pnpm release:verify
```
