# BeeUI theming and token contract v2

BeeUI's theme contract is semantic. Components ask for intent such as `surface`, `foreground`, `primary`, `destructive`, `focus-ring`, or `disabled`; applications change the values behind those contracts instead of branching component source by brand.

The runtime implementation remains **Uniwind + Tailwind CSS v4**. `@beeui/tokens` owns the design-token vocabulary and generated artifacts; it is not a second runtime styling engine, CSS-in-JS layer, mutable theme store, or component-theme object system.

## Canonical source and DTCG 2025.10

`packages/tokens/tokens.json` is the only authored source for BeeUI token values. The document follows the **Design Tokens Community Group (DTCG) 2025.10** Format and Color contracts:

- token and group names follow the DTCG naming grammar;
- every token resolves to a standard DTCG `$type`;
- dimensions and durations use structured `{ value, unit }` values;
- colors use structured sRGB values with `colorSpace`, `components`, optional `alpha`, and a six-digit `hex` fallback;
- easing uses the normative four-number `cubicBezier` array;
- elevation uses normative DTCG `shadow` objects/arrays;
- focus is represented as a group of standard dimension tokens rather than an invented generic composite type;
- BeeUI-only runtime/native metadata lives under `$extensions["com.beeui"]`.

The root `$schema` points at the published DTCG 2025.10 Format JSON Schema for editor/tooling validation. The Format specification itself does **not** define `$schema` as a normative design-token property; the published schema intentionally accepts it as tooling metadata and notes that caveat. BeeUI keeps it for deterministic validation and editor integration without treating it as token semantics. DTCG-specific data stays in standard fields; platform information such as React Native elevation, Uniwind runtime-theme mapping, exact CSS serialization, and backward-compatible public names is namespaced in the BeeUI extension.

DTCG token/group names cannot contain `.`. The canonical spacing token historically exposed to TypeScript as `"2.5"` is therefore authored as the valid DTCG name `2-5`, with `$extensions["com.beeui"].publicName: "2.5"`. Generated TypeScript continues to expose `"2.5": 10`, so standards conformance does not break the existing public API.

## Package and generated artifacts

The canonical `packages/tokens/tokens.json` is also the distributable `@beeui/tokens/tokens.json` export. Exporting the canonical file directly avoids a second machine-readable copy that could drift while preserving the single-source contract.

The deterministic build-time generator is `scripts/generate-tokens.mjs`. It commits four derived consumer-ready outputs:

- `packages/tokens/src/index.ts` — the existing public TypeScript API;
- `packages/tokens/src/theme.css` — Tailwind CSS v4 variables and Uniwind runtime themes;
- `packages/tokens/src/tokens.resolver.json` — a DTCG 2025.10 Resolver document describing the foundation set plus every registered runtime-theme context (the four primary Bee/Violet themes and the two Bee accessibility high-contrast themes, see [#77](#accessibility-high-contrast-theme-path--77)).
- `packages/tokens/src/lifecycle.json` — a machine-readable lifecycle manifest (status, deprecations, replacements) derived from canonical lifecycle metadata. See [`docs/token-lifecycle.md`](./token-lifecycle.md).

The Resolver artifact uses the official 2025.10 resolver schema and references the packaged canonical document via URI + JSON Pointer sources instead of duplicating the token payload. It models `light`, `dark`, `violet-light`, `violet-dark`, `high-contrast-light`, and `high-contrast-dark` as contexts of one `runtimeTheme` modifier.

To add or change a token:

1. edit only `packages/tokens/tokens.json`;
2. run `pnpm tokens:generate`;
3. review the canonical change and every generated change;
4. run `pnpm tokens:check`, `pnpm tokens:test`, and the normal test/visual gates;
5. commit the canonical source and generated artifacts together.

`pnpm tokens:check` performs a read-only byte comparison. CI runs it explicitly, typecheck guards it, and release verification refuses to package stale generated artifacts. Generation uses no network, timestamp, absolute path, or platform-specific shell behavior, so a clean checkout produces byte-identical output.

The canonical JSON loader rejects duplicate object keys before normal JavaScript parsing can overwrite an earlier value and treats special keys such as `__proto__` as inert own data. Typography generation also requires exact `fontSize`/`lineHeight` role parity, preventing missing/`NaN` CSS line heights or TS-only roles.

CI applies two independent validation layers. First, `packages/tokens/tokens.json` and the generated resolver are validated with `@hyperjump/json-schema` against byte-pinned snapshots of the published DTCG 2025.10 Format and Resolver schemas under `scripts/vendor/dtcg/2025.10/`; this path performs no network access. Second, BeeUI-specific validation enforces authoring/runtime invariants that generic JSON Schema cannot express, including duplicate raw JSON keys, public-name compatibility, exact theme vocabulary, typography-role parity, and deterministic generated output. The official-schema gate supplements rather than replaces the BeeUI validator.

## DTCG conformance versus alias architecture

DTCG conformance and BeeUI's primitive-to-semantic authoring model are separate concerns.

PR #90 / issue #69 establishes a conformant canonical format, generated DTCG tooling artifacts, deterministic generation, and runtime-theme resolution metadata. Issue #70 adds the **private primitive -> semantic alias hierarchy** on top of that model: recurring brand/neutral palette values become private authoring primitives, semantic roles alias them with standard DTCG references, and the generator resolves those references (including multi-hop) while rejecting cycles, dangling references, cross-category references, and references that escape the private layer. Primitive identifiers stay out of reusable component APIs.

A DTCG document does not need to use aliases to be conformant. BeeUI's aliases use DTCG reference semantics (`$ref` JSON Pointers) rather than a parallel BeeUI reference syntax. See [Private authoring primitives and semantic aliases](./theme-authoring-primitives.md) for the authoring contract.

## Current inventory and v1 compatibility

The v2 token package preserves the existing public semantic color vocabulary while adding the accepted interaction/control roles from #65 and #66. Raw palette values remain an authoring concern rather than a public component API.

| Area | Contract |
| --- | --- |
| Semantic colors | Existing public names preserved; Bee and Violet each provide complete light/dark contexts |
| Typography | Six semantic roles own size + line height |
| Controls | compact/default/large/icon plus a 44 px native touch target |
| Icons | `xs/sm/md/lg` geometry |
| Avatars | `sm/md/lg/xl` = 32/40/48/64 px |
| Content width | form/reading/page/dialog |
| Elevation | flat/raised/overlay semantic shadow levels |
| Layer | base/overlay/toast semantic z-order (stacking) levels |
| Motion | fast/normal/slow durations, standard/emphasized easing, and semantic motion intents with reduced-motion policy (see `docs/motion.md`) |
| Density | compact/comfortable/spacious application-level intent coordinating list-row and form-field metrics, applied via #71 overrides (see `docs/density.md`) |
| Focus | 2 px ring, 2 px offset, semantic color, web/native visibility policy |
| Branding | Bee + Violet, both light/dark |
| Accessibility appearances | Bee high-contrast, both light/dark (see [#77](#accessibility-high-contrast-theme-path--77)) |

The canonical DTCG representation is allowed to differ structurally from the generated public API. The generator is the compatibility boundary: current TypeScript exports, CSS variable names, runtime-theme names, and accepted CSS values remain stable unless an explicit migration is documented.

## Public semantic colors

The public semantic color contract is:

- foundations: `background`, `foreground`, `surface`, `surface-muted`, `surface-raised`, `muted`, `muted-foreground`, `subtle-foreground`;
- actions: `primary`, `primary-foreground`, `primary-hover`, `primary-pressed`, `secondary`, `secondary-foreground`, `secondary-hover`, `secondary-pressed`;
- feedback: `destructive`, `destructive-hover`, `destructive-pressed`, `success`, `warning`, `info` and their `*-foreground` counterparts;
- structure/input: `border`, `border-strong`, `control-border`, `input`, `focus-ring`, `disabled`, `disabled-foreground`, `overlay`.

Each runtime theme implements exactly the same color-token names. Components and reusable component source should consume semantic names, never raw palette identifiers.

## Typography

The default family is the platform system font. BeeUI does not force a font-family utility until an application deliberately loads and names a cross-platform family.

| Role | Size | Line height | Typical use |
| --- | ---: | ---: | --- |
| `display` | 32 | 40 | sparse hero/display text |
| `title` | 24 | 32 | page/section title |
| `heading` | 18 | 24 | card/dialog subsection heading |
| `body` | 16 | 24 | normal reading and input text |
| `label` | 14 | 20 | controls and compact metadata |
| `caption` | 12 | 16 | supporting metadata |

Weights are `regular` 400, `medium` 500, `semibold` 600, and `bold` 700. Tracking is `normal` 0 and `tight` -0.2 px; the CSS generator deterministically emits `-0.0125em` at BeeUI's accepted 16 px reference.

The six roles remain the entire size hierarchy. Technical/numeric content composes **orthogonal features** onto a role rather than adding new roles or a numeric type scale: `numeric="tabular"` for equal-width figures (aligned amount columns, KPIs, timers, reference digits) and `family="mono"` for reference codes/IDs. Both are canonical, typed (`numericVariants`, `monoFontFamily`, `fontFamily.mono` in `@beeui/tokens`), and platform-honest — web utilities (`bee-tabular-nums`, `font-mono`) and native `fontVariant`/`fontFamily` styles. BeeUI bundles no font and forces no global custom font. See [`data-typography.md`](./data-typography.md).

## Sizing and touch targets

Control intents are 36/44/48 px for compact/default/large, with 44 px for icon-only controls and the minimum native touch target. Compact controls may visually remain 36 px on web, but representative native controls enforce a 44 px minimum hit target.

Icon geometry is `xs/sm/md/lg` = 12/16/20/24 px. Avatar geometry is `sm/md/lg/xl` = 32/40/48/64 px. Content-width intents are form 512 px, reading 704 px, page 1152 px, and dialog 512 px.

## Elevation

Elevation describes layering intent rather than pixel identity across platforms:

- `flat`: no elevation;
- `raised`: cards or locally raised content;
- `overlay`: modal/popover-class depth.

The canonical `$value` is a DTCG `shadow` value. Exact historical web serialization and React Native elevation (`0`, `2`, `8`) are platform metadata under `$extensions["com.beeui"]`. Generated `index.ts` therefore preserves the existing `{ web, nativeElevation }` API while `theme.css` preserves the accepted `--shadow-*` CSS declarations.

## Stacking layers (z-order)

Layer tokens define the **stacking order** of reusable BeeUI surfaces. This is a
separate concern from elevation: elevation is shadow/visual depth, layer is
paint/z-order. The two never share a token family, and a surface can be `flat`
elevation while still owning a distinct layer (and vice versa).

The vocabulary is intentionally minimal and derived from the actual recurring
surfaces in BeeUI, not a generic `z1..z99` scale:

| Layer | Value | Meaning | Consumed by |
| --- | ---: | --- | --- |
| `base` | 0 | Default in-flow content plane (the ground). | Implicit for normal content; app persistent/sticky surfaces sit just above it. |
| `overlay` | 100 | Anchored transient surfaces and the overlay host outlet. | `DropdownMenu`, `Popover`, `Select`, and the overlay host in `overlay-runtime`. |
| `toast` | 1000 | Transient notifications that float above content and anchored overlays. | `Toast` viewport. |

Required ordering contract (asserted by tests): `base < overlay < toast`. Values
are unitless integers with **intentional gaps** so an application can insert its
own local sublayers — a sticky header at `50`, a bespoke scrim at `500`, a
tooltip at `1100` — without colliding with a BeeUI role.

### Dialogs and native windows

`Dialog` / `AlertDialog` present through the React Native `Modal` (a native
window on iOS/Android and a portaled top-level layer on web). Their stacking is
owned by the platform window model, so they do **not** consume a numeric layer
token. Anchored overlays opened *inside* a modal render into that modal's own
overlay host, so they layer correctly within the modal's window rather than
competing with root-level `overlay` values.

### Coexistence and portal caveats

- Multiple anchored surfaces (e.g. a `Popover` and a `DropdownMenu`) share the
  single `overlay` layer. Their relative paint order is decided by portal/DOM
  order (later-opened paints above), not by competing z-index values — the same
  behavior as before these tokens existed.
- On Android, the `elevation` style prop also governs sibling draw order. The
  `Toast` viewport therefore feeds the same `layer.toast` value to both `zIndex`
  and `elevation` purely for native draw-order parity; that `elevation` value is
  a z-order mechanism there, not a shadow token.
- These tokens change only which stacking value a surface reads. Overlay
  portals, focus traps, pointer/event routing, Escape handling, dismissal, and
  React context propagation are unchanged.

### When to use a layer token vs a local z-index

- Use a semantic layer token when the surface is a reusable design-system role
  that must stack deterministically against other BeeUI surfaces.
- Keep a plain local `zIndex` for product-specific, in-component ordering that
  does not represent a shared design-system layer (for example ordering two
  children inside one custom widget). Do not migrate those to layer tokens.

### Adding a new layer role

Add a role only when there is **recurring behavioral evidence** that a distinct
stacking level is required (multiple components inventing the same new value, or
a demonstrated stacking conflict). Add it to `tokens.layer` in
`packages/tokens/tokens.json` with a value that preserves strict ascending order
and keeps deliberate gaps, then run `pnpm tokens:generate`. The generator emits
the TypeScript `layer` constant, the `--layer-*` CSS variables, and the
`bee-layer-*` utilities, and validation enforces the base-zero, unique,
strictly-ascending integer contract.

## Motion and reduced motion

Durations are `fast` 120 ms, `normal` 200 ms, and `slow` 320 ms.

Canonical easing values are DTCG `cubicBezier` arrays. The generator emits the existing CSS strings, including `cubic-bezier(0.2, 0, 0, 1)` for the standard curve. Tokens do not make animation mandatory.

On top of these primitives, BeeUI defines a small vocabulary of semantic motion intents
(`overlay-enter`, `overlay-exit`, `disclosure`) with web timing, native spring/timing
config, and a mandatory reduced-motion policy per intent. Web transitions get a
`prefers-reduced-motion` override in `theme.css`; JS consumers call `resolveMotion(intent,
{ reducedMotion })`, passing the platform reduced-motion signal (BeeUI keeps no motion
store). The repository standardizes on no animation runtime today, so motion tokens add no
dependency. See [`docs/motion.md`](./motion.md) for the full contract.

## Focus

Focus is a DTCG group containing standard dimension tokens:

- width: 2 px;
- offset: 2 px.

The semantic color token (`focus-ring`) and platform visibility policies (`focus-visible` on web and platform focus semantics on native) live in `$extensions["com.beeui"]` because they are BeeUI runtime policy rather than a DTCG composite token type.

Representative `Button` and `Input` consume `web:focus-visible:bee-focus-ring`.

## Brand and runtime theme model

BeeUI ships two demonstrator brands:

| Brand | Light runtime theme | Dark runtime theme |
| --- | --- | --- |
| Bee | `light` | `dark` |
| Violet | `violet-light` | `violet-dark` |

The brand/appearance-to-runtime mapping is BeeUI runtime metadata under `$extensions["com.beeui"]`. The generated DTCG Resolver document exposes the four runtime themes as mutually exclusive contexts of one `runtimeTheme` modifier. This avoids inventing overlapping DTCG modifiers for brand and appearance while still preserving BeeUI's typed convenience mapping.

Use the typed mapping instead of branching component source:

```ts
import { resolveBeeRuntimeTheme } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

Uniwind.setTheme(resolveBeeRuntimeTheme('violet', 'dark'));
```

Uniwind remains the runtime theme authority. Code generation changes build-time ownership only; it does not add a runtime store, runtime reader, or second theme engine.

### Extensible theme registry

`resolveBeeRuntimeTheme` and the `bee | violet` union are convenient but closed: they hard-code the shipped example brands. `defineThemeRegistry` opens that boundary so an application can add its own brand from an ordinary TypeScript project, using only the public `@beeui/tokens` API and without editing BeeUI source.

A registry is **typed mapping metadata only**. It is not a React context, state store, provider, or mutable singleton, and constructing one never mutates Uniwind or any global state. It simply records `brand -> appearance -> Uniwind runtime-theme name` and derives typed, deterministic lookups from it.

```ts
import { defineThemeRegistry } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

// Brand, appearance, and runtime-theme unions are inferred from this object.
const registry = defineThemeRegistry({
  bee: { light: 'light', dark: 'dark' },
  violet: { light: 'violet-light', dark: 'violet-dark' },
  acme: { light: 'acme-light', dark: 'acme-dark' },
});

registry.resolve('acme', 'dark'); // typed as 'acme-dark'
registry.selectionFor('acme-dark'); // { brand: 'acme', appearance: 'dark' }

// Applying the theme stays an explicit, app-owned Uniwind call.
Uniwind.setTheme(registry.resolve('acme', 'dark'));
```

The default registry `beeThemeRegistry` (Bee + Violet) is exported for callers that want the registry API against the shipped brands. It is built from the same canonical mapping as the standalone helpers, so its results match them exactly.

**Mapping to Uniwind names.** The runtime-theme names in the mapping (`acme-light`, `acme-dark`, …) are the exact strings passed to `Uniwind.setTheme`. Registering the corresponding CSS/native theme with Uniwind stays the application's responsibility; the registry only names the mapping. BeeUI's own themes are registered through `packages/tokens/tokens.json` and the generated `theme.css`.

**Reverse-lookup guarantees.** `selectionFor(runtimeTheme)` is a deterministic reverse lookup: it returns `{ brand, appearance }` for a known runtime-theme name and `undefined` otherwise. Because runtime-theme names are validated unique at construction, the reverse mapping is never ambiguous.

**Duplicate and completeness rules.** `defineThemeRegistry` validates its input deterministically at construction and throws on:

- an empty registry or a brand with no appearances;
- a brand that does not define exactly the same appearance set as the rest (completeness);
- a runtime-theme name reused by more than one brand/appearance (which would make reverse lookup ambiguous).

Unknown brands and unknown appearances passed to `resolve` are compile-time errors under the inferred unions.

**Compatibility.** The existing helpers stay as they are: `resolveBeeRuntimeTheme`, `getBeeThemeSelection`, `isBeeDarkRuntimeTheme`, `beeRuntimeThemeByBrand`, `beeBrandNames`/`BeeBrandName`, `beeThemeNames`/`BeeThemeName`, and `beeRuntimeThemeNames`/`BeeRuntimeThemeName` are unchanged. `getBeeThemeSelection` keeps its `{ brand, theme }` shape (the registry's `selectionFor` uses the more general `{ brand, appearance }`). No migration is required; adopting the registry is additive.

**The registry is metadata, not a store.** It holds no mutable state, exposes only frozen data and pure functions, and does not own or observe the active theme. Uniwind stays the single runtime theme authority.

**Layering scoped themes (#68).** Issue #68's scoped-theme wrapper will consume this registry as read-only metadata to resolve a scope's `brand + appearance` to a Uniwind runtime-theme name; it will not change where theme authority lives, add a second registry, or make the registry mutable. This issue intentionally does not implement scoped themes, runtime overrides (#71), or token readers (#72) — the registry only stays extensible enough not to block them. #77 (below) is the high-contrast appearance contract this section anticipated: a brand may declare additional appearances beyond `light`/`dark` through a second, narrower registry rather than by extending `beeThemeRegistry` itself.

### Runtime semantic overrides

Uniwind may update registered CSS variables at runtime. Keep overrides semantic and typed:

```ts
import { defineSemanticColorOverrides } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

const overrides = defineSemanticColorOverrides({
  '--color-primary': '#123456',
  '--color-focus-ring': '#654321',
});

Uniwind.updateCSSVariables('light', overrides);
```

Applications own contrast validation when overriding runtime values. `defineSemanticColorOverrides` still works exactly as shown above — it is unchanged by #71 below, and remains keyed by the raw `--color-*` CSS variable name for existing consumers.

### Typed runtime overrides beyond colors (#71)

`defineThemeOverrides` widens the typed override surface from colors-only to every **runtime-overridable public** token category, without inventing a second theme store or a second token-path schema:

```ts
import { applyThemeOverrides, defineThemeOverrides } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

const overrides = defineThemeOverrides({
  colors: { primary: '#123456', 'focus-ring': '#654321' },
  radius: { md: 12 },
  motion: { normal: 180 },
});

applyThemeOverrides(Uniwind, 'light', overrides);
```

**Define vs apply.** `defineThemeOverrides` is a pure define/validate/compile step: it never touches Uniwind, `document`, or any global state, and returns a frozen `{ cssVariables }` map. Applying it to the running app is always the separate, explicit `applyThemeOverrides(uniwind, runtimeTheme, overrides)` call (a thin forward to `uniwind.updateCSSVariables(runtimeTheme, overrides.cssVariables)`) — or your own direct `Uniwind.updateCSSVariables` call, since `overrides.cssVariables` is already the exact CSS-variable map Uniwind expects.

**Supported categories.** Only `colors`, `radius`, and `motion` are exposed today. Each category's accepted keys are read live from already-generated token data (`semanticColorTokens`, `radius`, `motionDuration`) — never a hand-maintained parallel list — and each category's *inclusion* is driven by `$extensions.com.beeui.runtimeOverridable: true` on the corresponding group in `tokens.json` (see `packages/tokens/src/index.ts`'s generated `themeOverrideClassification` for the full, explicit per-group classification). Today only the `radius` and `motionDuration` token groups carry that flag.

**Unsupported/private categories, and why.** Every other canonical token group — `spacing`, `fontFamily`, `fontSize`/`lineHeight` (paired for vertical rhythm), `fontWeight`, `letterSpacing`, `controlSize`/`iconSize`/`avatarSize` (touch-target/accessibility sizing), `contentWidth`, `elevation` (a compound shadow value, not a single scalar), `motionEasing`, `focusRing`, `layer`, `breakpoint` (a build-time Tailwind/Uniwind constant), and `pageGutter` — is classified `runtimeOverridable: false` and is unreachable through `defineThemeOverrides`. Private authoring primitives (the `primitives` group) are never a `tokens.tokens` group at all, so they have no category and no key in this API by construction — passing one is rejected the same way any unknown key is. Flagging a new group `runtimeOverridable: true` without also teaching `scripts/generate-tokens.mjs` its CSS-variable-naming convention fails the token build fast, so a flag can never silently do nothing.

**Unit behavior.** Conversion is deterministic and category-fixed: `radius` values are plain numbers compiled to `px` (matching `--radius-*` in `theme.css`), `motion` values are plain numbers compiled to `ms` (matching `--motion-duration-*`), and `colors` values are opaque CSS color strings passed through unchanged (matching `--color-*`). A category never accepts an ambiguous mixed-unit string.

**Compatibility.** `defineThemeOverrides({ colors: { primary: '#123456' } })` and `defineSemanticColorOverrides({ '--color-primary': '#123456' })` compile to the identical `--color-primary` CSS-variable entry — the new API is additive, not a replacement; migrate only if the wider vocabulary is useful.

**Global vs scoped.** `applyThemeOverrides`/`Uniwind.updateCSSVariables` targets exactly one named Uniwind runtime theme (e.g. `"light"`, `"violet-dark"`) — call it once per runtime theme you want affected. It is not applied to every theme at once, and it is not scoped to a component subtree. Issue #68's scoped-theme wrapper (not part of this branch) will only ever select *which named theme* a subtree resolves to; it will not scope override *values* to that subtree. Theme-name scoping and variable overrides remain related but distinct capabilities.

**Accessibility/coherence responsibility.** A typed API cannot guarantee an arbitrary caller-supplied color stays accessible. BeeUI's own built-in fixtures keep the [#65 filled-state ≥4.5:1](./theme-interactive-states.md) and [#66 ≥3:1 control-boundary](./theme-control-boundaries.md) contracts regardless of whether runtime overrides exist elsewhere in an app; `defineThemeOverrides`/`applyThemeOverrides` never auto-adjust a consumer-supplied color to compensate. Applications overriding linked foreground/background pairs (e.g. `primary` + `primary-foreground`) own re-verifying contrast for their own override values.

**Uniwind remains the mutation authority.** `defineThemeOverrides` holds no override store, cache, React context, or provider; every call is stateless. Only `Uniwind.updateCSSVariables` (called directly, or through `applyThemeOverrides`) ever mutates runtime theme state.

Issue #74's application-density axis (`applyDensity`) reuses this exact mechanism — `resolveDensityOverrides(mode)` compiles to the same `CompiledThemeOverrides` shape, and `applyDensity` is a thin call-through to `applyThemeOverrides` — rather than adding a second override compiler. See [`docs/density.md`](./density.md).

### Typed runtime token readers (#72)

`useBeeToken`/`getBeeToken` (from `@beeui/ui`) let JS/TS consumers that cannot use `className` — SVG props, chart libraries, a React Navigation theme object, `StatusBar`/platform APIs, canvas, imperative animation/configuration — read a resolved BeeUI semantic value without spelling `--color-*`/`--radius-*`/`--motion-duration-*` by hand:

```ts
// Hook form: live, scope-aware, re-renders on theme change or a #71 override.
const fill = useBeeToken('colors.primary');
const cornerRadius = useBeeToken('radius.md');

// Non-hook form: a one-shot snapshot of the *global* theme only.
const navigationTheme = {
  colors: {
    primary: getBeeToken('colors.primary'),
    background: getBeeToken('colors.background'),
  },
};
```

**A read adapter, not a store.** Both functions are thin, stateless wrappers over Uniwind's own public read APIs — `useCSSVariable` and `Uniwind.getCSSVariable` from the `uniwind` package. `@beeui/tokens`'s `beeTokenReader` only derives *which* CSS variable to ask Uniwind for and *how* to normalize whatever it returns; it never reads Uniwind itself, holds no cache, and adds no React context/provider. Uniwind remains the sole runtime theme authority.

**Path vocabulary.** A `BeeTokenPath` is a `"category.key"` string derived from canonical token metadata: `colors.<SemanticColorToken>`, `radius.<RadiusName>`, or `motion.<MotionDurationName>` — deliberately the same three categories `defineThemeOverrides` (#71) exposes, since every readable category here is real-runtime-reactive (theme/appearance/scope-dependent, or #71-overridable). Everything else is rejected by construction: private #70 authoring primitives are never part of `semanticColorTokens`, so there is no `'colors.amber-500'` path to construct; `breakpoint` is a build-time-only Tailwind/Uniwind constant and has no reader category; theme-invariant groups (`spacing`, typography, `controlSize`/`iconSize`/`avatarSize`, `contentWidth`/`pageGutter`, `elevation`, `motionEasing`, `layer`, `focusRing`) never change at runtime, so they stay ordinary typed exports — import them directly instead of reading them through Uniwind (see the "Runtime-reader note" in `docs/data-typography.md`).

**Units.** `colors.*` normalizes to a `string` CSS color (`#rrggbb`/`#rrggbbaa` hex); `radius.*`/`motion.*` normalize to a plain `number` (CSS pixels / milliseconds, unit stripped). Uniwind's own `useCSSVariable` returns `string | number` and documents that web is always a string while native can be either — BeeUI's reader absorbs that platform difference so every consumer gets the same typed shape everywhere.

**Global vs. scoped.** `useBeeToken` reads through Uniwind's own ambient scope context, so it resolves the nearest `BeeThemeScope`/`ScopedTheme` ancestor exactly like a `className` would, and falls back to the global theme outside any scope. `getBeeToken` delegates to `Uniwind.getCSSVariable`, which Uniwind itself hardcodes to the global theme only — calling it inside a scoped subtree still returns the app's current global-theme value. This is a genuine Uniwind limitation, not a BeeUI choice; prefer `useBeeToken` inside a scope, and reserve `getBeeToken` for call sites outside any scope you care about.

**Override interaction.** A #71 `applyThemeOverrides`/`Uniwind.updateCSSVariables` write is visible to both readers on the very next read — `useBeeToken` re-renders through Uniwind's own listener, and `getBeeToken` re-reads live on every call. Neither reader caches a value itself, so there is nothing to go stale.

**Non-hook lifecycle caveat.** `getBeeToken` is a snapshot, not a subscription: it returns the value valid *at the moment it is called* and does not re-run later — call it again after a theme change to get a fresh value. It also requires BeeUI's `theme.css`/Uniwind's active runtime theme to already be initialized; calling it too early throws a descriptive error rather than silently returning the wrong value.

See `packages/tokens/src/token-reader.ts` and `packages/ui/src/components/use-bee-token.ts` for the full API documentation, including SVG/chart/React-Navigation/platform-API examples.

## Completeness and accessibility gates

Every registered runtime theme — the primary Bee/Violet themes and the accessibility high-contrast themes below — must implement the exact same semantic-color vocabulary. Adding or removing a role is rejected unless all runtime themes move together.

Contrast relationships are no longer a small, ad-hoc list of assertions in test code: they are centralized, machine-tested metadata exported as `contrastContract` from `@beeui/tokens` (canonical source: `$extensions["com.beeui"].contrastContract` in `packages/tokens/tokens.json`). See [Accessibility (high-contrast) theme path](#accessibility-high-contrast-theme-path--77) for the full contract and how it is validated. The 44 px native touch-target minimum and web keyboard-focus policy remain part of the accessibility contract.

These deterministic checks do not replace VoiceOver/TalkBack or physical-device acceptance testing.

## Accessibility (high-contrast) theme path — #77

BeeUI ships a documented, machine-tested **Bee high-contrast** accessibility appearance, in both light and dark, alongside the default Bee and Violet themes. It is reached through the exact same mechanism as every other runtime theme — `Uniwind.setTheme(<runtime-theme-name>)` — with no second theme store, no React context, and no `if (highContrast)` branch anywhere in reusable component source.

### Modeling decision: a second, narrower registry

High contrast is **not** an additional appearance on `beeThemeRegistry`. `defineThemeRegistry` requires every brand in one registry to define exactly the same appearance set (its completeness rule) — adding `high-contrast-light`/`high-contrast-dark` as appearances there would force Violet to define a high-contrast pair too, immediately, which the accepted scope explicitly rejects ("Bee high-contrast light/dark is the required first implementation... do not automatically add Violet high-contrast without evidence").

Instead, `@beeui/tokens` exports a **second registry built from the identical `defineThemeRegistry` primitive**, scoped only to the brands that have shipped a certified accessibility appearance:

```ts
import {
  beeAccessibilityThemeRegistry, // defineThemeRegistry({ bee: { light: 'high-contrast-light', dark: 'high-contrast-dark' } })
  resolveBeeAccessibilityRuntimeTheme,
  getBeeAccessibilityThemeSelection,
} from '@beeui/tokens';
import { Uniwind } from 'uniwind';

Uniwind.setTheme(resolveBeeAccessibilityRuntimeTheme('bee', 'dark')); // 'high-contrast-dark'
getBeeAccessibilityThemeSelection('high-contrast-dark'); // { brand: 'bee', theme: 'dark' }
```

This satisfies every criterion the registry docs above set out for the eventual high-contrast contract:

- **type inference stays clean** — `beeAccessibilityThemeRegistry` infers its own brand (`'bee'`) and runtime-theme (`'high-contrast-light' | 'high-contrast-dark'`) unions from `defineThemeRegistry`, the same as any consumer-defined registry;
- **runtime-theme names stay unique and deterministic** — codegen validates `accessibilityRuntimeThemeNames` never collides with the primary `runtimeThemeNames`, since Uniwind resolves every runtime theme from one flat class-name namespace;
- **global + scoped selection needs no second store** — a resolved accessibility runtime-theme name is applied with the ordinary `Uniwind.setTheme` call (or, once #68 lands, the ordinary scoped-theme selection path), because it is just another registered Uniwind runtime theme;
- **future brands opt in, they are never forced in** — `beeAccessibilityBrandNames` (currently `['bee']`) is independent of `beeBrandNames` (`['bee', 'violet']`). Violet can adopt a high-contrast pair later by adding one entry to the accessibility mapping; nothing about adding it required touching Violet today;
- **default Bee/Violet compatibility is exact, not just "close"** — `beeRuntimeThemeNames`, `beeRuntimeThemeByBrand`, and `beeThemeRegistry` are byte-identical to before #77. The `apps/showcase/__tests__/theme-tokens-v2.test.ts` suite (#65/#66's baseline invariants) is unmodified and still passes against the same values it certified before this change.

### Applying it

```tsx
import { resolveBeeAccessibilityRuntimeTheme } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

function useBeeHighContrast(mode: 'light' | 'dark') {
  Uniwind.setTheme(resolveBeeAccessibilityRuntimeTheme('bee', mode));
}
```

The Theme & tokens inspector in the showcase app (`apps/showcase/theme-inspector`) exposes a "High contrast" toggle that calls exactly this. Because Uniwind is the single global runtime theme authority, switching it there changes every other screen — Component Gallery, Pattern Gallery, forms, buttons — with no per-screen code, proving the "no second store" claim in practice.

### The contrast-relationship contract

`contrastContract` (generated from `$extensions["com.beeui"].contrastContract` in `tokens.json`) replaces the small representative pair list #65/#66 originally shipped with a complete, centralized description of which semantic-token relationships BeeUI certifies, and at what minimum ratio:

| Group | Relationship | Minimum |
| --- | --- | --- |
| `textPairs` | `foreground`/`muted-foreground` against every realistic canvas (`background`, `surface`, `surface-muted`, `surface-raised`, `muted`) | 4.5:1 |
| `filledActionPairs` | `primary`/`secondary`/`destructive` `-foreground` against default/hover/pressed fills (#65) | 4.5:1 |
| `feedbackFillPairs` | `success`/`warning`/`info` fill against its own `-foreground` | 4.5:1 |
| `controlBoundaryPairs` | `control-border` against `input` (#66) | 3:1 |
| `focusRingPairs` | `focus-ring` against every realistic adjacent surface (`background`, `input`, `surface`, `surface-muted`, `surface-raised`) | 3:1 |
| `invalidBoundaryPairs` | `destructive` (invalid/destructive control boundary) against realistic surfaces | 3:1 |
| `essentialIndicatorPairs` | `success`/`warning`/`info`/`destructive` as a non-text status indicator against `surface` | 3:1 |
| `accessibilityOnlyPairs` | `border-strong` (the Checkbox/Radio unchecked boundary) against `input` — **certified only for `beeAccessibilityRuntimeThemeNames`** | 3:1 |
| `accessibilityMinTextRatio` | every `textPairs` relationship, re-asserted at AAA level — **certified only for `beeAccessibilityRuntimeThemeNames`** | 7:1 |

Every semantic color token is covered by `contrastContract`: it appears in `canvasTokens` (a backdrop, not content — `background`, `surface`, `surface-muted`, `surface-raised`, `muted`, `input`), in one of the required-relationship groups above, or in `contrastContract.exceptions` with a `category` and a `reason`. `scripts/generate-tokens.mjs` rejects a canonical change that leaves any semantic token uncovered, references an unknown token, or declares a relationship that does not actually hold against the resolved colors of every runtime theme it applies to (`textPairs`/`filledActionPairs`/… against every runtime theme; `accessibilityOnlyPairs`/`accessibilityMinTextRatio` against the accessibility runtime themes only).

### Disabled and decorative exceptions

`contrastContract.exceptions` documents, per token, exactly why it carries no required relationship:

- `subtle-foreground` — low-emphasis role, intentionally below the 4.5:1 body-text threshold, not approved for normal body copy;
- `disabled`, `disabled-foreground` — inactive-component contrast exemption; disabled state is also signalled by reduced opacity, never by color alone;
- `border` — a subtle structural divider, decorative, never the sole means of conveying a required boundary or state;
- `overlay` — a decorative scrim, not content;
- `border-strong` — a **known limitation**, not a decorative exception: it is the real Checkbox/Radio unchecked boundary against `input`, and the default light/dark/violet-light/violet-dark themes do not yet certify 3:1 for that pair. #77 does not silently widen the default contract to paper over this or redesign Checkbox/Radio; `accessibilityOnlyPairs` certifies the relationship for the high-contrast themes, where it does hold, and the gap in the default themes is tracked as a separate, out-of-scope follow-up.

### How future brands opt in

A brand adopts a high-contrast appearance by adding one entry to the accessibility axis in `tokens.json` — `$extensions["com.beeui"].accessibilityBrandNames` (must be a subset of `brandNames`), `accessibilityRuntimeThemeByBrand.<brand>` (mapping `light`/`dark` to two new, globally-unique runtime-theme names), and two new `themes.<runtime-theme>.colors` entries defining every semantic color token — then `pnpm tokens:generate`. Nothing about another brand's existing themes needs to change, and no component source changes at all: the moment the runtime theme is registered, every reusable component already renders correctly against it because components only ever consume semantic tokens.

### Manual assistive-technology acceptance checklist

Automated checks certify the exact relationships in `contrastContract`, keyboard focus visibility, and 44 px touch targets. They do not certify screen-reader behavior, platform high-contrast/forced-colors interop, or real-device perception. Before treating a high-contrast release as accessibility-reviewed, manually verify on a physical device or simulator with an assistive technology enabled:

- **VoiceOver (iOS)** — rotor navigation through Component Gallery reads every control's role/state/label correctly in `high-contrast-light` and `high-contrast-dark`; focus order matches visual order; no control is reachable but unlabeled.
- **TalkBack (Android)** — same pass as VoiceOver; additionally confirm switch/checkbox state announcements match the (now higher-contrast) visual boundary.
- **Keyboard-only (web)** — tab through Component Gallery and a representative Pattern Gallery screen; the focus ring must be visible against every surface it lands on (page background, card, input, muted card) without zooming in.
- **OS-level forced-colors / high-contrast mode (web)** — confirm BeeUI's own `high-contrast-light`/`high-contrast-dark` theme is not fighting the browser's own forced-colors mode when both are active.
- **Physical-device color perception spot check** — compare a filled button, an invalid input boundary, and a status badge in the default theme versus `high-contrast-light`/`high-contrast-dark` side by side.

### What this does not claim

BeeUI does **not** claim complete WCAG conformance or certification from this work. The only accessibility claims BeeUI makes are the exact, machine-tested relationships enumerated in `contrastContract` (plus the pre-existing 44 px touch-target and `focus-visible` policy). Everything else — including full WCAG 2.x Level AA/AAA conformance across every criterion, screen-reader UX quality, and assistive-technology compatibility beyond the manual checklist above — is out of scope for #77 and is not implied by shipping a "high-contrast" theme name.

## Representative migration

The existing public API remains stable:

| Previous literal/convention | Semantic v2 use |
| --- | --- |
| `text-base leading-6` | `text-body` |
| `text-sm leading-5` | `text-label` |
| `text-xs leading-4` | `text-caption` |
| `text-lg leading-6` | `text-heading` |
| `text-2xl leading-8` | `text-title` |
| `h-9` | `h-control-compact` |
| `h-11` | `h-control-default` / `h-control-icon` |
| `h-12` | `h-control-large` |
| Avatar `h-8/10/12/16` | `h-avatar-sm/md/lg/xl` |
| raised `shadow-sm` | `shadow-raised` |
| contextual `max-w-lg` | `max-w-dialog` / `max-w-form` |

Do not mechanically replace literals whose product intent does not match the semantic contract.

For the canonical responsive breakpoint, page-gutter, and content-container vocabulary (and how it composes with safe-area insets on native), see [`docs/responsive-layout.md`](./responsive-layout.md).

## Extending BeeUI tokens

1. Edit only `packages/tokens/tokens.json`.
2. Use valid DTCG names and standard DTCG value shapes.
3. Put BeeUI/platform-only metadata under `$extensions["com.beeui"]`.
4. Define every semantic color for every runtime theme.
5. Regenerate all artifacts with `pnpm tokens:generate`.
6. Run `pnpm tokens:check`, token tests, workspace tests, contrast checks, Component Gallery, the complete Pattern Gallery matrix, and native export/compile gates.
7. Keep reusable components semantic-only.

If a repeated raw value deserves a reusable primitive or semantic reference, implement that through the primitive/alias contract in [Private authoring primitives and semantic aliases](./theme-authoring-primitives.md) rather than adding an ad-hoc reference convention.
