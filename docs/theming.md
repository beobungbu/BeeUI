# BeeUI theming and token contract v2

BeeUI's theme contract is semantic. Components ask for intent such as `surface`, `foreground`, `primary`, `destructive`, `focus-ring`, or `disabled`; applications change the values behind those contracts instead of branching component source by brand.

The implementation remains **Uniwind + Tailwind CSS v4**. `@beeui/tokens` defines the vocabulary and the CSS theme variables; it is not a second styling engine, runtime CSS-in-JS layer, compiler, or component-theme object system.

## Current inventory and v1 gaps

The pre-v2 token package already exposed 30 public semantic color names plus spacing and radius scales. The light and dark CSS themes implemented those color names directly. Raw palette colors were CSS implementation values rather than public palette exports.

Usage across the component library and the 37-screen Pattern Gallery showed the remaining conventions were mostly implicit:

| Area | Pre-v2 evidence | v2 decision |
| --- | --- | --- |
| Semantic color | `bg-primary`, `text-foreground`, `border-border`, status/focus/disabled roles | Preserve all existing public names; add complete Brand B values |
| Typography | `Text` used `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl` + separate leading utilities | Six semantic roles own size + line height |
| Controls | `Button` and `Input` repeated `h-9`, `h-11`, `h-12`; icon button repeated 44 px | Compact/default/large/icon + 44 px native touch target |
| Icons | Product patterns repeatedly use small-to-large icon geometry but no library-independent vocabulary | `xs/sm/md/lg` geometry only |
| Avatar/media | `Avatar` already converged on 32/40/48/64 px | Preserve those four stable intents as semantic sizes |
| Content width | Form/dialog/page compositions repeatedly use max-width literals | Form/reading/page/dialog contracts |
| Elevation | Raised card used generic `shadow-sm`; overlay intent had no named scale | Flat/raised/overlay semantic levels |
| Motion | No shared duration/easing vocabulary | Fast/normal/slow + intentional easing; no automatic animation |
| Focus | Input had semantic focus color but no ring width/offset/visibility policy | 2 px ring, 2 px offset, keyboard `focus-visible` on web |
| Branding | One amber light/dark theme | Brand A (Bee) + Brand B (Violet), both light/dark |

This inventory intentionally does **not** produce an exhaustive scale. A mono font, component-specific theme objects, arbitrary media sizes, and per-component color tokens are omitted because current product evidence does not justify them.

## Public semantic colors

The existing semantic color token names remain the public color contract:

- foundations: `background`, `foreground`, `surface`, `surface-muted`, `surface-raised`, `muted`, `muted-foreground`, `subtle-foreground`;
- actions: `primary`, `primary-foreground`, `primary-hover`, `primary-pressed`, `secondary`, `secondary-foreground`, `secondary-hover`;
- feedback: `destructive`, `success`, `warning`, `info` and their `*-foreground` counterparts;
- structure/input: `border`, `border-strong`, `input`, `focus-ring`, `disabled`, `disabled-foreground`, `overlay`.

Raw hex values may exist inside `theme.css`, but component APIs and reusable component source should not expose or depend on palette names such as `blue500` or `gray200`.

## Typography

The default family is the platform system font. BeeUI does not force a font-family utility until an application deliberately loads and names a cross-platform family. No mono family is part of v2 because current components and patterns do not establish a reusable mono requirement.

| Role | Size | Line height | Typical use |
| --- | ---: | ---: | --- |
| `display` | 32 | 40 | sparse hero/display text |
| `title` | 24 | 32 | page/section title |
| `heading` | 18 | 24 | card/dialog subsection heading |
| `body` | 16 | 24 | normal reading and input text |
| `label` | 14 | 20 | controls and compact metadata |
| `caption` | 12 | 16 | low-density supporting metadata |

Weights are `regular` 400, `medium` 500, `semibold` 600, and `bold` 700. Tracking is deliberately small: `normal` 0 and `tight` -0.2 px equivalent. Semantic roles should be preferred over inventing parallel numeric aliases.

## Sizing

### Controls and touch targets

| Intent | Size |
| --- | ---: |
| compact | 36 px |
| default | 44 px |
| large | 48 px |
| icon-only | 44 px |
| minimum native touch target | 44 px |

Compact controls may visually remain 36 px on web. Representative `Button` and `Input` compact variants enforce a 44 px minimum on iOS and Android. Do not use a 36 px native interactive target without a surrounding hit target that still satisfies the 44 px contract.

### Icons

`xs/sm/md/lg` = 12/16/20/24 px. These tokens describe geometry only and do not couple BeeUI to an icon library.

### Avatars

`sm/md/lg/xl` = 32/40/48/64 px. This is the recurring product vocabulary already present in `Avatar`; v2 names the intent rather than adding arbitrary intermediate sizes.

### Content width

| Intent | Max width |
| --- | ---: |
| form | 512 px |
| reading | 704 px |
| page/dashboard | 1152 px |
| dialog | 512 px |

These are normal max-width constraints. They are useful on larger surfaces but do not imply a browser-only layout model; React Native layouts still own actual available width and flex behavior.

## Elevation

Elevation describes layering intent, not pixel identity across platforms:

- `flat`: no elevation;
- `raised`: cards or locally raised content;
- `overlay`: modal/popover-class surface depth when a component chooses to consume it.

The JS contract exposes representative native elevation levels (`0`, `2`, `8`) and matching web shadow intent. Tailwind/Uniwind shadow variables back `shadow-flat`, `shadow-raised`, and `shadow-overlay`. React Native platform rendering differs by OS and renderer; exact web/native shadow parity is not a promise.

The current representative migration moves `Card`'s raised variant to `shadow-raised`. Overlay behavior code is intentionally outside this PR; consumers may migrate overlay presentation classes separately after visual acceptance.

## Motion and reduced motion

Durations are:

- `fast`: 120 ms;
- `normal`: 200 ms;
- `slow`: 320 ms.

The default easing is `cubic-bezier(0.2, 0, 0, 1)`; an emphasized curve is available only where stronger spatial continuity is justified. Tokens do not make animation mandatory.

For CSS/web transitions, pair optional motion with a `motion-reduce` path that removes or simplifies non-essential animation. For JavaScript/Reanimated motion, consult the platform reduced-motion preference and skip or simplify non-essential motion. Never use motion tokens as a reason to animate every state change.

## Focus

The focus contract is:

- semantic color: `focus-ring`;
- ring width: 2 px;
- ring offset: 2 px;
- web visibility: keyboard-oriented `focus-visible`;
- native visibility: platform focus semantics rather than forced web-ring parity.

Representative `Button` and `Input` consume `web:focus-visible:bee-focus-ring`. Input keeps its semantic focused border as well.

## Brand model

BeeUI ships two demonstrator brands to prove that component source is brand-independent:

| Brand | Light runtime theme | Dark runtime theme |
| --- | --- | --- |
| Brand A — Bee | `light` | `dark` |
| Brand B — Violet | `violet-light` | `violet-dark` |

Showcase and visual-regression Metro configs register the two custom Violet themes through Uniwind `extraThemes`. Each runtime theme defines the exact same semantic color-variable set.

Use the typed mapping instead of component branches:

```ts
import { resolveBeeRuntimeTheme } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

Uniwind.setTheme(resolveBeeRuntimeTheme('violet', 'dark'));
```

Applications that want a different brand add another complete semantic theme variant and register its custom runtime theme names with Uniwind. Do not add `if (brand === ...)` branches inside `Button`, `Input`, `Card`, or other reusable components.

### Runtime semantic overrides

Uniwind can also update CSS variables for a registered theme. Keep overrides semantic and typed:

```ts
import { defineSemanticColorOverrides } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

const overrides = defineSemanticColorOverrides({
  '--color-primary': '#123456',
  '--color-focus-ring': '#654321',
});

Uniwind.updateCSSVariables('light', overrides);
```

When overriding at runtime, the application owns contrast validation and must update every related foreground/state token necessary to keep the semantic contract coherent.

BeeUI does **not** introduce a custom mutable theme store. Uniwind remains the runtime theme authority.

### Runtime limitations

The built-in Bee light/dark pair can continue using normal Uniwind adaptive/system behavior. A custom brand that also follows system appearance must map the resolved appearance to its own registered light/dark theme names in application preference wiring. BeeUI v2 supplies the deterministic mapping; it does not add an app-global preference store merely to mirror Uniwind.

Scoped/per-subtree branding is not a v2 contract. The supported proof is application-level runtime theme switching.

## Light/dark completeness

Every semantic color variable must exist in every registered runtime theme. Adding a token or brand is incomplete until deterministic tests prove exact key parity; mechanically inverting the light palette is not acceptable.

The themes are designed independently around the same intent. In particular, elevated surfaces, muted text, borders, inputs, status feedback, disabled states, focus, and overlays have explicit dark values.

## Accessibility guidance

BeeUI targets representative contrast checks rather than claiming formal WCAG certification.

Deterministic tests require at least 4.5:1 for representative normal-text pairs:

- `foreground` / `background`;
- `muted-foreground` / `background`;
- `primary`, `destructive`, `success`, `warning`, and `info` with their semantic foreground counterparts.

The semantic focus ring is checked at 3:1 or better against the page background. In v2, the Bee light focus ring is intentionally darkened from the primary amber so it remains perceivable on white; Bee light success/warning foregrounds are also changed to dark semantic foregrounds so normal-size labels clear the representative 4.5:1 target.

`subtle-foreground` and `disabled-foreground` are lower-emphasis roles. They are exceptions to the normal-body-text target and must not be used for required instructions, error recovery, or other essential readable content. Disabled controls should remain understandable through surrounding labels/state, not low contrast alone.

The 44 px native touch-target minimum and web keyboard focus policy are part of the accessibility contract. VoiceOver/TalkBack and physical-device focus behavior remain runtime acceptance work; deterministic token tests do not substitute for assistive-technology testing.

## Representative migration and compatibility

This is pre-1.0, but v2 deliberately preserves all existing public semantic color token names. There is no required rename migration for the color API.

Representative internal migrations prove the vocabulary without mass component churn:

| Previous literal/convention | Semantic v2 use | Notes |
| --- | --- | --- |
| `text-base leading-6` | `text-body` | same 16/24 geometry |
| `text-sm ... leading-5` | `text-label` | same 14/20 geometry |
| `text-xs leading-4` | `text-caption` | same 12/16 geometry |
| `text-lg leading-6` | `text-heading` | same 18/24 geometry |
| `text-2xl leading-8` | `text-title` | same 24/32 geometry |
| none | `text-display` | new semantic role; use sparingly |
| `h-9` | `h-control-compact` | 36 px; native representative controls add 44 px minimum |
| `h-11` | `h-control-default` / `h-control-icon` | 44 px |
| `h-12` | `h-control-large` | 48 px |
| Avatar `h-8/10/12/16` | `h-avatar-sm/md/lg/xl` | value-equivalent |
| raised `shadow-sm` | `shadow-raised` | semantic elevation; visual value is intentionally owned by v2 |
| contextual `max-w-lg` dialog/form usage | `max-w-dialog` / `max-w-form` | migrate by intent, never global search/replace |

Do **not** mechanically replace every occurrence of `h-11`, `max-w-lg`, or `shadow-sm`. A literal only becomes a semantic token consumer when its product intent matches the contract.

## Extending a theme

1. Start from the complete `semanticColorTokens` set.
2. Define all semantic values for both light and dark appearances.
3. Register custom runtime names with Uniwind `extraThemes`.
4. Add the names to the application mapping; keep components brand-blind.
5. Run token completeness and representative contrast tests.
6. Run Component Gallery and the complete 5 viewport × 2 appearance × 37 screen Pattern Gallery acceptance matrix.
7. Validate native export/runtime behavior for any platform-sensitive styling change.

If a new need cannot be expressed by the current semantic vocabulary, require recurring product evidence before introducing a component-specific token. Prefer the smallest semantic addition that can remain stable across brands and platforms.
