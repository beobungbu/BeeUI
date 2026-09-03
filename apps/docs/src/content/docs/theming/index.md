---
title: Theming
description: Apply semantic color, brand, density and runtime theme contracts without coupling product code to the styling engine.
---

# Theming

BeeUI components consume **semantic tokens** such as background, surface, foreground,
border and intent roles. Your application chooses theme/brand/density; reusable component
behavior should not depend on literal brand colors.

## Choose light, dark or system

Mount `BeeUIProvider` once, then let Uniwind's adaptive theme follow the OS or switch the
runtime theme intentionally. The Showcase demonstrates system/light/dark switching in the
same component tree: [open Theme & tokens](/showcase/).

## Web CSS

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';
```

This is the same CSS contract used by the clean Expo/Web consumers. The package is still
unpublished; see [Getting Started](/docs/getting-started/) for the current packed/workspace
consumption path.

## Brand scope and density

Use `BeeThemeScope` when one subtree needs a different supported brand/appearance while
preserving semantic roles. Density changes spacing/control presentation through the
accepted density contract; it does not reduce accessibility touch-target obligations.
High-contrast variants exist in the current token runtime and are treated as explicit
supported theme variants, not a claim that every device accessibility setting is simulated.

## Stable API vs escape hatch

Semantic token names, typed component variants and behavior contracts are the reusable
surface. `className` remains a current-engine escape hatch for application/source-owned
work and is **not** a portability promise across future styling engines.

Deeper authorities: [theming](https://github.com/beobungbu/BeeUI/blob/main/docs/theming.md),
[theme scope](https://github.com/beobungbu/BeeUI/blob/main/docs/theme-scope.md), [density](https://github.com/beobungbu/BeeUI/blob/main/docs/density.md), and [token lifecycle](https://github.com/beobungbu/BeeUI/blob/main/docs/token-lifecycle.md).
