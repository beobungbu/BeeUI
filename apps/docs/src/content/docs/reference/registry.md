---
title: Registry reference
description: Public Registry items that are not component families.
---

:::caution[Generated file]
Do not hand-edit this page. It is written by `scripts/public-reference.mjs` from
`docs/public-surface.inventory.json`, so it lists exactly the surfaces the #473 ownership
gate routes here. Prose lives in `docs/reference.content.json`.
:::

The Registry drives source ownership: each item names the files the CLI copies, the registry items it depends on, and the npm peers it expects. Component families are listed under [Components](/docs/components/); this page covers the public items that are not components.

The canonical data is `registry/registry.json`, validated by `pnpm registry:verify`.

## Registry items (1)

| Name | Classification | Source |
| --- | --- | --- |
| `theme` | source-ownership-public | [`registry/registry.json`](https://github.com/beobungbu/BeeUI/blob/main/registry/registry.json) |
