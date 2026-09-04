---
title: Styling reference
description: The public CSS entry point for BeeUI's semantic theme.
---

<!-- Generated file: written by scripts/public-reference.mjs from docs/public-surface.inventory.json. Prose lives in docs/reference.content.json. Do not hand-edit. -->

BeeUI ships one public stylesheet subpath. Web consumers import it once at the application entry; native consumers do not import CSS at all and get the same semantic values through the token runtime.

[Web onboarding](/docs/start/web/) shows where the import goes in a real Vite application, and [Branding](/docs/guides/branding/) covers overriding the values it defines.

## Package export subpaths (1)

| Name | Source |
| --- | --- |
| `./theme.css` | [`packages/tokens/package.json`](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/package.json) `exports../theme.css` |
