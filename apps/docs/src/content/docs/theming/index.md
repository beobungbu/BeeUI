---
title: Theming
description: Apply semantic color, brand, density and runtime theme contracts without coupling product code to the styling engine.
---

BeeUI components consume **semantic tokens** such as background, surface, foreground,
border and intent roles. Your application chooses theme/brand/density; reusable component
behavior should not depend on literal brand colors.

**Prerequisites:** BeeUI installed per [Start](/docs/start/) for your platform — this page
assumes the Web theme CSS import or native token provider from that path is already in place.

## Choose light, dark or system

Your application owns exactly one preference state — BeeUI/Uniwind does not store or persist
it — with three values:

```ts
type ThemePreference = 'system' | 'light' | 'dark';

Uniwind.setTheme(preference);
```

- `Uniwind.setTheme('light')` / `Uniwind.setTheme('dark')` pin the app to that runtime theme
  regardless of what the OS/browser reports afterward.
- `Uniwind.setTheme('system')` is meant to release that pin and resume following the
  platform/browser color scheme.

This three-state preference is a different concern from `BeeThemeScope`: `Uniwind.setTheme`
is the single application-wide preference; `BeeThemeScope` themes one subtree independently
of it (see [Branding](/docs/guides/branding/)). Persisting the user's chosen preference across
sessions is application-owned, the same as any other user setting.

### `system` does not reliably resume OS following today

Verified against `@beemvp/beeui-*@0.86.2-rc.1` with Uniwind `1.10.1`: after an explicit
`setTheme('light')` or `setTheme('dark')`, a later `setTheme('system')` type-checks and does
not throw, but the app can stay pinned to the last explicit theme — on Web the root class no
longer updates when the browser's `prefers-color-scheme` changes, and on native, toggling the
OS appearance has no effect until the process restarts. Treat this as an open behavior gap in
the current pinned Uniwind version rather than a documented contract, and resolve "system"
yourself instead of relying on `setTheme('system')` alone:

```tsx
import * as React from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';

type ThemePreference = 'system' | 'light' | 'dark';

// Web: subscribe to `prefers-color-scheme` directly with `useSyncExternalStore`,
// since `window.matchMedia` — not `Appearance` — is the real OS/browser signal
// there. Native: `useColorScheme()` already tracks OS changes on its own.
function useResolvedSystemScheme(): 'light' | 'dark' {
  const native = useColorScheme();
  const web = React.useSyncExternalStore(
    (onChange) => {
      if (Platform.OS !== 'web') return () => {};
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => (Platform.OS === 'web' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  return Platform.OS === 'web' ? web : (native ?? 'light');
}

function applyThemePreference(preference: ThemePreference, resolvedScheme: 'light' | 'dark') {
  const resolved = preference === 'system' ? resolvedScheme : preference;
  Uniwind.setTheme(resolved);
  // Native only: `Appearance.setColorScheme` is not implemented on
  // react-native-web and throws there if called unguarded.
  if (Platform.OS !== 'web' && preference === 'system') {
    Appearance.setColorScheme(null);
  }
}
```

Re-run this resolution whenever the OS/browser scheme changes while `preference === 'system'`.
Do not patch DOM classes, root CSS variables, or any other app-specific mechanism to work
around this — resolve to `'light'`/`'dark'` yourself and keep calling `Uniwind.setTheme`, which
stays the one supported theme-switching entry point.

Mount `BeeUIProvider` once, then drive the runtime theme through the preference above. The
Showcase demonstrates system/light/dark switching in the same component tree:
[open Theme & tokens](/showcase/).

## Web CSS

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
```

This is the complete, five-line CSS contract used by the clean Expo/Web consumers — the
`@source` lines are required, or Tailwind emits no BeeUI utility classes and the app renders
unstyled with no error. `@source` paths are relative to wherever this CSS file lives in your
project (adjust the leading `../` to `./` if the file sits at your project root rather than
under `src/`). BeeUI `0.86.2-rc.2` is publicly published on npm under the opt-in `next`
dist-tag; see [Start](/docs/start/) for the exact install and styling-entry setup per platform.

## Typography scale

The type scale (`caption`/`label`/`body`/`heading`/`title`) is reachable through the `Text`
component's `variant` prop, **not** through `text-<step>` utility classes. `text-caption`,
`text-label`, `text-heading` and `text-title` generate no CSS in the Uniwind pipeline and
silently leave the element at its default size — there is no error, and `cn()` can also drop
a `text-<step>` string outright when a color class is present on the same element:

| Want | Use |
| --- | --- |
| A `Text` at a scale step | `<Text variant="caption">…</Text>` (also `label`, `body`, `heading`, `title`) |
| A plain React Native `Text` at a scale step | `text-[length:var(--text-body)] leading-[var(--text-body--line-height)]` (swap `body` for the step you need) |

## Chart token paths

Chart colors are their own token category, read as `chart.<name>` — not `colors.chart-<name>`:

```ts
useBeeToken('chart.series-1'); // correct
```

`chart.series-1`, `chart.series-2`, `chart.series-3`, `chart.series-4`, `chart.positive`,
`chart.negative`, `chart.neutral`, `chart.highlight`, `chart.grid` and `chart.axis` are the
complete set. `colors.chart-series-1` does not type-check.

## Brand scope and density

Use `BeeThemeScope` when one subtree needs a different supported brand/appearance while
preserving semantic roles. Density changes spacing/control presentation through the
accepted density contract; it does not reduce accessibility touch-target obligations.
High-contrast variants exist in the current token runtime and are treated as explicit
supported theme variants, not a claim that every device accessibility setting is simulated.

On Web, `BeeThemeScope` correctly overriding semantic tokens for a nested subtree (and
`useBeeToken` reading the scoped value inside it) depends on `@beemvp/beeui-tokens`'
generated theme CSS emitting each runtime theme as its own plain, un-anchored class
selector rather than nesting it under a single shared root selector — only a plain class
selector resolves per subtree via ordinary CSS custom-property inheritance, including
correctly for a scope nested inside another scope. Consume a `@beemvp/beeui-tokens`
release built with that contract for scoped theming to take effect.

## Stable API vs escape hatch

Semantic token names, typed component variants and behavior contracts are the reusable
surface. `className` remains a current-engine escape hatch for application/source-owned
work and is **not** a portability promise across future styling engines.

## Task guides built on this contract

- [Branding](/docs/guides/branding/) — override a brand palette without leaving the semantic model.
- [Density](/docs/guides/density/) — the orthogonal row-height and gap axis.

Deeper authorities: [theming](https://github.com/beobungbu/BeeUI/blob/main/docs/theming.md),
[theme scope](https://github.com/beobungbu/BeeUI/blob/main/docs/theme-scope.md), [density](https://github.com/beobungbu/BeeUI/blob/main/docs/density.md), and [token lifecycle](https://github.com/beobungbu/BeeUI/blob/main/docs/token-lifecycle.md).
