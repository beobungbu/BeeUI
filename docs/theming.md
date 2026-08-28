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

The deterministic build-time generator is `scripts/generate-tokens.mjs`. It commits three derived consumer-ready outputs:

- `packages/tokens/src/index.ts` — the existing public TypeScript API;
- `packages/tokens/src/theme.css` — Tailwind CSS v4 variables and Uniwind runtime themes;
- `packages/tokens/src/tokens.resolver.json` — a DTCG 2025.10 Resolver document describing the foundation set plus the four registered runtime-theme contexts.

The Resolver artifact uses the official 2025.10 resolver schema and references the packaged canonical document via URI + JSON Pointer sources instead of duplicating the token payload. It models `light`, `dark`, `violet-light`, and `violet-dark` as contexts of one `runtimeTheme` modifier.

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

PR #90 / issue #69 establishes a conformant canonical format, generated DTCG tooling artifacts, deterministic generation, and runtime-theme resolution metadata. Issue #70 still owns the **private primitive -> semantic alias hierarchy**: deciding which repeated palette values deserve primitives, expressing semantic roles as DTCG references, resolving multi-hop references, rejecting cycles/dangling references, and keeping primitive names out of reusable component APIs.

A DTCG document does not need to use aliases to be conformant. When #70 introduces aliases, it must use DTCG reference semantics rather than inventing a parallel BeeUI reference syntax.

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
| Elevation | flat/raised/overlay semantic levels |
| Motion | fast/normal/slow durations plus standard/emphasized easing |
| Focus | 2 px ring, 2 px offset, semantic color, web/native visibility policy |
| Branding | Bee + Violet, both light/dark |

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

## Sizing and touch targets

Control intents are 36/44/48 px for compact/default/large, with 44 px for icon-only controls and the minimum native touch target. Compact controls may visually remain 36 px on web, but representative native controls enforce a 44 px minimum hit target.

Icon geometry is `xs/sm/md/lg` = 12/16/20/24 px. Avatar geometry is `sm/md/lg/xl` = 32/40/48/64 px. Content-width intents are form 512 px, reading 704 px, page 1152 px, and dialog 512 px.

## Elevation

Elevation describes layering intent rather than pixel identity across platforms:

- `flat`: no elevation;
- `raised`: cards or locally raised content;
- `overlay`: modal/popover-class depth.

The canonical `$value` is a DTCG `shadow` value. Exact historical web serialization and React Native elevation (`0`, `2`, `8`) are platform metadata under `$extensions["com.beeui"]`. Generated `index.ts` therefore preserves the existing `{ web, nativeElevation }` API while `theme.css` preserves the accepted `--shadow-*` CSS declarations.

## Motion and reduced motion

Durations are `fast` 120 ms, `normal` 200 ms, and `slow` 320 ms.

Canonical easing values are DTCG `cubicBezier` arrays. The generator emits the existing CSS strings, including `cubic-bezier(0.2, 0, 0, 1)` for the standard curve. Tokens do not make animation mandatory. Web transitions should include a `motion-reduce` path; JS/Reanimated motion should respect the platform reduced-motion preference.

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

Applications own contrast validation when overriding runtime values.

## Completeness and accessibility gates

Every registered runtime theme must implement the exact same semantic-color vocabulary. Adding or removing a role is rejected unless all runtime themes move together.

Deterministic tests require representative normal-text pairs to reach at least 4.5:1 and focus/control boundaries to reach the accepted 3:1 target. Filled primary/secondary/destructive states and status colors keep their existing contrast regressions. The 44 px native touch-target minimum and web keyboard-focus policy remain part of the accessibility contract.

These deterministic checks do not replace VoiceOver/TalkBack or physical-device acceptance testing.

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

If a repeated raw value deserves a reusable primitive or semantic reference, implement that through the #70 primitive/alias contract rather than adding an ad-hoc reference convention.
