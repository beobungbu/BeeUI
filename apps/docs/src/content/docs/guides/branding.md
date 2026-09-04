---
title: Branding
description: Put your own brand colors behind BeeUI's semantic tokens without forking component source.
---

You brand BeeUI by changing **token values**, never token names and never component source.
Every reusable component consumes semantic roles (`primary`, `surface`, `focus-ring`, …), so
re-pointing those roles at your palette re-brands every screen at once.

Pick the path that matches how far your brand diverges:

| Path | Use it when | Mechanism | Scope |
| --- | --- | --- | --- |
| Runtime overrides | You want your palette on top of a shipped theme | `defineThemeOverrides` + `applyThemeOverrides` | One named runtime theme, changeable at runtime |
| Your own brand themes | You need a complete, named brand (light + dark) registered with the styling engine | `defineThemeRegistry` + your own theme CSS | Whole app, or one subtree via `BeeThemeScope` |
| Source ownership | You want the token CSS itself inside your repository | `pnpm beeui add theme` | Your copy of `theme.css` |

## Step 1: keep components semantic

**Before** — the brand color is baked into a reusable component, so it cannot follow a theme, an
appearance switch, or a scoped preview:

```tsx
import { Button, Text } from '@beemvp/beeui-ui';

export function CheckoutButton() {
  return (
    <Button className="bg-[#7c3aed] active:bg-[#6d28d9]">
      <Text className="text-white">Pay now</Text>
    </Button>
  );
}
```

**After** — the component says what the element *is*, and the brand lives in exactly one place:

```tsx
import { Button, Text } from '@beemvp/beeui-ui';

export function CheckoutButton() {
  return (
    <Button>
      <Text>Pay now</Text>
    </Button>
  );
}
```

The "after" button now inherits `primary`, its hover/pressed fills, its foreground and the focus
ring from whichever runtime theme is active — including dark and high contrast — with no further
edits. Step 2 supplies the values.

Theme one subtree instead of the whole app when you need a side-by-side brand comparison, an
embedded preview, or a white-label widget:

```tsx
import { BeeThemeScope, Card, Text } from '@beemvp/beeui-ui';

export function BrandPreview() {
  return (
    <BeeThemeScope brand="violet" appearance="dark">
      <Card>
        <Text>Rendered in the Violet dark runtime theme.</Text>
      </Card>
    </BeeThemeScope>
  );
}
```

An unknown brand, appearance, or runtime-theme name throws during render — there is no silent
fallback to the wrong brand.

Where `className` cannot reach (SVG props, chart libraries, navigation theme objects), read the
resolved value instead of re-declaring the color:

```tsx
import { useBeeToken } from '@beemvp/beeui-ui';

// Web-only illustration: `svg`/`rect` are DOM elements. On native the same hook feeds an
// `react-native-svg` element or a chart library prop instead — the hook is the portable part,
// the element is not. `react-native-svg` is not a BeeUI peer dependency.
export function BrandGlyph() {
  const fill = useBeeToken('colors.primary');
  const radius = useBeeToken('radius.md');
  return <svg><rect fill={fill} rx={radius} width={24} height={24} /></svg>;
}
```

## Step 2: apply your palette at runtime

```ts
import { applyThemeOverrides, defineThemeOverrides } from '@beemvp/beeui-tokens';
import { Uniwind } from 'uniwind';

const acmeLight = defineThemeOverrides({
  colors: {
    primary: '#7c3aed',
    'primary-hover': '#6d28d9',
    'primary-pressed': '#5b21b6',
    'primary-foreground': '#ffffff',
    'focus-ring': '#5b21b6',
  },
  radius: { md: 12 },
});

applyThemeOverrides(Uniwind, 'light', acmeLight);
```

`defineThemeOverrides` is pure: it validates keys and value kinds and returns a frozen
`{ cssVariables }` map. Nothing is applied until the explicit `applyThemeOverrides` call, and that
call targets **exactly one** named runtime theme — repeat it for `'dark'` (and for every other
runtime theme you ship) if the brand should follow the appearance switch.

`radius` values compile to `px` and `motion` values to `ms`; color values pass through unchanged
as opaque CSS colors.

## Register a brand of your own

A theme registry is typed mapping metadata — `brand → appearance → runtime-theme name`. It is not
a store, a context, or a provider, and constructing one mutates nothing.

```ts
import { defineThemeRegistry } from '@beemvp/beeui-tokens';
import { Uniwind } from 'uniwind';

const acmeRegistry = defineThemeRegistry({
  bee: { light: 'light', dark: 'dark' },
  acme: { light: 'acme-light', dark: 'acme-dark' },
});

Uniwind.setTheme(acmeRegistry.resolve('acme', 'dark'));
```

Registering the CSS/native theme named `acme-dark` with the styling engine stays your
application's job — the registry only names the mapping. Every brand in one registry must declare
the same appearance set, and a runtime-theme name may not be reused, or construction throws.
A registry built this way can also be handed to `BeeThemeScope`, which narrows its `brand` and
`appearance` props to your own vocabulary.

## What the runtime supports today

Six runtime themes are registered by the shipped token package:

| Runtime theme | Brand | Appearance | Registry |
| --- | --- | --- | --- |
| `light` | Bee | light | `beeThemeRegistry` |
| `dark` | Bee | dark | `beeThemeRegistry` |
| `violet-light` | Violet | light | `beeThemeRegistry` |
| `violet-dark` | Violet | dark | `beeThemeRegistry` |
| `high-contrast-light` | Bee | light | `beeAccessibilityThemeRegistry` |
| `high-contrast-dark` | Bee | dark | `beeAccessibilityThemeRegistry` |

High contrast is a **second, narrower registry**, not an extra appearance on the default one —
that keeps Violet from being forced to ship a high-contrast pair it has no evidence for. Apply it
through the ordinary theme call:

```ts
import { resolveBeeAccessibilityRuntimeTheme } from '@beemvp/beeui-tokens';
import { Uniwind } from 'uniwind';

Uniwind.setTheme(resolveBeeAccessibilityRuntimeTheme('bee', 'dark')); // 'high-contrast-dark'
```

There is no automatic "follow the OS high-contrast setting" behavior and no second theme store:
selecting the accessibility appearance is an explicit application decision.

## What you may customize, and what stays contractual

Semantic **names** are the contract. Values are yours; roles are not.

| Token group | Runtime-overridable | Notes |
| --- | --- | --- |
| Semantic colors (34 roles) | Yes | The full `colors` category of `defineThemeOverrides` |
| `radius` | Yes | Numbers, compiled to `px` |
| `motionDuration` (category key `motion`) | Yes | Numbers, compiled to `ms` |
| Chart colors (10 roles) | No | Theme-defined; readable through the `chart.*` token paths |
| `spacing`, typography, `controlSize`, `iconSize`, `avatarSize` | No | Sizing and readability are accessibility surface |
| `focusRing`, `elevation`, `layer`, `motionEasing` | No | Fixed geometry and stacking contracts |
| `breakpoint`, `pageGutter`, `contentWidth` | No | Build-time responsive constants |
| Private authoring primitives | No | Not a public token group; unreachable by construction |

Anything not flagged runtime-overridable is rejected by `defineThemeOverrides` with a typed error
rather than silently ignored. Changing an invariant group means changing the canonical token
source and regenerating — a fork-level decision, not a branding knob.

Every registered runtime theme must define the exact same semantic-color vocabulary, so a brand
can never add or drop a role for itself alone.

## Anti-patterns

- **Hard-coding brand hex in a component.** It cannot follow appearance, scope, or an override.
- **Renaming or adding semantic roles to express brand nuance.** Completeness across all runtime
  themes is enforced; a one-brand role breaks it.
- **Overriding a fill without its paired foreground.** `primary` and `primary-foreground` are a
  contrast pair; moving one and not the other is how brands ship unreadable buttons.
- **Using `subtle-foreground`, `disabled`, `border`, or `overlay` as brand accents.** These carry
  documented contrast exemptions and are not certified for content.
- **Treating `className` as a portable branding API.** It is a current-engine escape hatch for
  application and source-owned code, not a cross-engine promise.
- **Calling the override once for `'light'` and assuming dark follows.** Overrides are per named
  runtime theme.

## Known limitations

- **Contrast is yours to re-verify.** BeeUI certifies contrast relationships for its own shipped
  themes; applying overrides never auto-adjusts a color you supply. If you override a linked pair,
  re-check it. See [Accessibility](/docs/accessibility/).
- **`border-strong` against `input`** (the unchecked Checkbox/Radio boundary) is certified at 3:1
  only for the high-contrast runtime themes; the default themes do not yet meet it. This is a
  tracked gap, not a decorative exemption.
- **Overrides are global to a runtime theme, not scoped to a subtree.** `BeeThemeScope` selects
  *which named theme* a subtree resolves to; it does not scope override *values*.
- **The non-hook token read is global-only.** Inside a scope, use the `useBeeToken` hook rather
  than the one-shot snapshot form.
- **The packages are not published to npm yet**, so branding work today happens against a
  repository checkout or a locally packed artifact — see [Start](/docs/start/).

## Related

- [Theming](/docs/theming/) — the semantic token contract end to end.
- [Density](/docs/guides/density/) — the orthogonal layout-density axis.
- [CLI & source ownership](/docs/guides/cli-source-ownership/) — copying `theme.css` into your repo.

## Canonical sources

- [Theming and token contract](https://github.com/beobungbu/BeeUI/blob/main/docs/theming.md)
- [Scoped themes](https://github.com/beobungbu/BeeUI/blob/main/docs/theme-scope.md)
- [Private authoring primitives and semantic aliases](https://github.com/beobungbu/BeeUI/blob/main/docs/theme-authoring-primitives.md)
- [Canonical token source](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/tokens.json)
- [Generated token API](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/src/index.ts)
- [Generated theme CSS](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/src/theme.css)
