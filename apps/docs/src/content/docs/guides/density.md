---
title: Density
description: Coordinate list-row and form-field spacing across an application with the compact, comfortable and spacious density modes.
---

BeeUI ships exactly three density modes — **`compact`**, **`comfortable`** (the default) and
**`spacious`** — and they coordinate three metrics only: list-row height, list-row gap, and
form-field gap. Density is an *application* intent, not a component size prop and not a global
spacing multiplier.

## Do it

```ts
import { applyDensity } from '@beemvp/beeui-tokens';
import { Uniwind } from 'uniwind';

applyDensity(Uniwind, 'light', 'compact');
```

`applyDensity(uniwind, runtimeTheme, mode)` targets **one named runtime theme**. Call it once per
runtime theme your app can switch to:

```ts
import { applyDensity, type DensityMode } from '@beemvp/beeui-tokens';
import { Uniwind } from 'uniwind';

export function applyAppDensity(mode: DensityMode) {
  for (const theme of ['light', 'dark'] as const) {
    applyDensity(Uniwind, theme, mode);
  }
}
```

An unknown mode throws rather than silently resolving to `undefined`.

## What each mode actually changes

| Metric | CSS variable | `compact` | `comfortable` (default) | `spacious` | Consumed by |
| --- | --- | --- | --- | --- | --- |
| `rowHeight` | `--spacing-density-row-height` | 44px | 56px | 64px | `ListItem`, `Table` |
| `rowGap` | `--spacing-density-row-gap` | 8px | 12px | 16px | `ListItem`, `Table` |
| `formGap` | `--spacing-density-form-gap` | 4px | 8px | 12px | `FormGroup`, `Field` |

Concretely, in a ten-row settings list: `compact` renders roughly 440px of row height plus 72px
of gaps, `comfortable` 560px plus 108px, and `spacious` 640px plus 144px — 512px, 668px and
784px in total, so about 270px between `compact` and `spacious` across one screen of rows, with identical type sizes, icon sizes, control heights and
focus rings in all three. A three-field form tightens or loosens by 4px per field boundary and
nothing else. There is no side-by-side screenshot in this guide because the difference is exactly
these numbers, not a restyle.

`comfortable` is pixel-identical to the pre-density literals in `ListItem`, `FormGroup` and
`Field`, so the default rendering is unchanged by this feature. `compact` values are derived from
existing scale numbers (`rowHeight.compact` equals the 44px touch-target size; the gaps step down
one entry on the spacing scale), not a free-form multiplier.

### What density deliberately does not touch

`controlSize` (the `Button` `size` scale), `iconSize`, `focusRing` geometry, all typography
(`fontSize`/`lineHeight`/`letterSpacing`/`fontWeight`), `contentWidth`, `Card` padding and
`Section` spacing are all invariant across modes. A token group participates in density only by
being flagged as a density axis in the canonical token source — nothing downstream keeps a second
list of density-sensitive names.

## Who owns what

| Concern | Owner |
| --- | --- |
| Mode vocabulary, per-mode values, CSS variables | BeeUI runtime (generated from the canonical token source) |
| Which components read the density variables | BeeUI runtime (`ListItem`, `Table`, `FormGroup`, `Field`) |
| Choosing a mode | Your application |
| Persisting the user's or workspace's choice | Your application |
| Calling `applyDensity` at startup and on change | Your application |

BeeUI keeps **no** density store, context, provider, or preference cache. Read your stored
preference at startup and call `applyDensity` once — the same posture theme and reduced-motion
preferences already use. Before any call, first paint always renders the default `comfortable`
values, because they are baked into the generated theme CSS.

## Layout, touch targets and accessibility

- **`rowHeight` can never drop below 44px.** The value is flagged hit-target-sensitive in the
  canonical token source, and token generation fails the build if any mode's `rowHeight` falls
  under the 44px touch-target minimum. `compact` sits exactly at that minimum, never below it.
- **`ListItem` carries a defensive native floor** (`ios:min-h-touch-target
  android:min-h-touch-target`) so the rendered native height cannot regress below 44px even if a
  consuming app's CSS shrinks the variable further.
- **`rowGap` and `formGap` are not interactive geometry** and are not hit-target guarded.
- **Readability is unaffected**, because density never scales typography. Choosing `compact` is a
  density decision, not a "make everything smaller" decision.
- **Focus visibility is unaffected** — focus-ring width and offset are invariant.

## How density composes

**With themes.** Density is orthogonal to brand and appearance: the same runtime theme carries
different metric values. It reuses the ordinary runtime-override mechanism, so applying a density
mode never changes which theme is active, and switching theme never resets density — but a
runtime theme you have not called `applyDensity` for still shows `comfortable`.

**With component size props.** Component size classes and density classes live in disjoint CSS
variable namespaces. A `Button` with `size="lg"` renders identically under every mode, and
choosing a component size never opts a component into or out of density. The two axes compose
freely: a `compact` screen can hold large buttons inside its rows, and a `spacious` screen can
hold small ones. Density changes the row that contains the control; the control's own size prop
changes the control.

**With responsive layout.** The `pageGutter` token's `compact` / `regular` / `spacious` names are a
**different, unrelated axis** — a build-time constant selected by breakpoint. Density is an
explicit runtime application intent and is not breakpoint-driven; BeeUI never changes density for
you when the viewport changes. If you want a viewport-driven density, watch the breakpoint in your
own code and call `applyDensity` yourself. See [Responsive](/docs/responsive/).

## Known limitations

- **Global per runtime theme, never per subtree.** There is no `BeeDensityScope`. `Table` is
  density-aware like `ListItem`, but it reads the same global mode as everything else: a compact
  table embedded in an otherwise spacious screen is not supported today. The deliberate reason is
  that subtree density would need a genuinely new propagation mechanism, and no recurring product
  evidence for nested density exists yet.
- **Three metrics only.** Panel/card padding and navigation-item height are explicitly out of
  scope. New metrics require recurring evidence — the same literal repeated across two or more
  components — not a single occurrence.
- **No persistence and no OS signal.** BeeUI does not read a platform density setting and does not
  remember a choice between sessions.
- **Per-theme application.** Forgetting a runtime theme in the loop above leaves that theme at the
  default silently; there is no "apply to all themes" call.

## Related

- [Branding](/docs/guides/branding/) — the orthogonal color/brand axis.
- [Theming](/docs/theming/) — the semantic token contract.
- [Accessibility](/docs/accessibility/) — touch-target and focus obligations density must respect.

## Canonical sources

- [Application density contract](https://github.com/beobungbu/BeeUI/blob/main/docs/density.md)
- [Theming and runtime overrides](https://github.com/beobungbu/BeeUI/blob/main/docs/theming.md)
- [Canonical token source](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/tokens.json)
- [Generated density API](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/src/index.ts)
