---
title: CLI & source ownership
description: Evaluate and own BeeUI component source through the repository-local Registry workflow.
---

# CLI & source ownership

BeeUI supports two consumption models: a centralized package boundary and source ownership. The package artifacts are release-ready but **not published to npm**. The source-ownership CLI works today from a BeeUI checkout and copies deterministic Registry source into a consumer project.

:::caution[No public npm CLI yet]
Do not use `npx @beemvp/beeui-cli ...`, `npx beeui ...`, or public npm install commands as if they resolve today. Stable publication remains owner-gated.
:::

## Choose a model

| Model | What you own | Upgrade model | Available today |
| --- | --- | --- | --- |
| Centralized packages | Package dependency and app integration | Replace locally packed artifact now; package version after publication | Evaluation through `pnpm pack` tarballs |
| Registry source ownership | Copied component/library source inside your repo | Inspect diff, then update or keep local changes | Yes, repository-local CLI |

Use source ownership when local source visibility/customization is valuable and your team is willing to own future diffs. Use the package boundary when you prefer centralized upgrades and public exports.

## Repository-local commands

Run these from the BeeUI repository while evaluating a consumer:

```bash
pnpm beeui -- init
pnpm beeui -- list
pnpm beeui -- add button
pnpm beeui -- add --dry-run dialog select
pnpm beeui -- doctor
pnpm beeui -- diff
pnpm beeui -- update
```

`add` resolves transitive BeeUI Registry dependencies and copies them in deterministic order. `--dry-run` prints the plan without mutation. `doctor`/`verify` validates the Registry, consumer config and dependency compatibility. `diff` is read-only; `update` refuses to overwrite conflicting local edits unless the explicit force path is chosen.

The CLI **does not install packages**, fetch remote executable code, or silently mutate your CSS/provider/native configuration. External package requirements remain consumer-owned and are reported for you to install deliberately.

## What gets copied

A Registry item records its source files, BeeUI dependency closure, external requirements and integrity metadata. Once copied, those files belong to the consumer repository. Component reference pages expose the Registry item identity and source link mechanically from `registry/registry.json`; the website does not maintain a second Registry inventory.

For provider and native setup after copying source, follow [Provider & safe area](/docs/start/provider-safe-area/) and the component page's dependency section.

## Safe update workflow

1. Run `pnpm beeui -- add --dry-run <items...>` before first copy.
2. Commit the copied files in your consumer repository.
3. Before updating, run `pnpm beeui -- diff [items...]` and review upstream/local changes.
4. Run `pnpm beeui -- update [items...]` only after reviewing the plan.
5. Re-run the consumer's typecheck, build and relevant runtime tests.

Source ownership is not a hidden dependency on this monorepo: copied source must not retain `workspace:*` or private monorepo imports.

## Canonical sources

- [Registry/CLI contract](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md)
- [Registry data](https://github.com/beobungbu/BeeUI/blob/main/registry/registry.json)
- [CLI implementation](https://github.com/beobungbu/BeeUI/blob/main/packages/cli/src/beeui.mjs)
- [Distribution architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)
