---
title: Registry reference
description: Public Registry items that are not component families.
---

<!-- Generated file: written by scripts/public-reference.mjs from docs/public-surface.inventory.json. Prose lives in docs/reference.content.json. Do not hand-edit. -->

The Registry drives source ownership: each item names the files the CLI copies, the registry items it depends on, and the npm peers it expects. Component families are listed under [Components](/docs/components/); this page covers the public items that are not components.

The canonical data is `registry/registry.json`, validated by `pnpm registry:verify`.

## Registry items (1)

| Name | Files | Registry dependencies | Peer dependencies |
| --- | --- | --- | --- |
| `theme` | [`packages/tokens/src/theme.css`](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/src/theme.css) | — | `tailwindcss@>=4 <5`, `uniwind@>=1.10.1 <2` |
