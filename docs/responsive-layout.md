# BeeUI responsive layout vocabulary

BeeUI defines a small, canonical vocabulary for **breakpoints**, **page gutters**, and **content containers** so screens stop inventing ad-hoc breakpoint literals and page padding. This vocabulary is names and values only.

**Tailwind v4 / Uniwind remains the responsive execution engine.** BeeUI does not ship a second media-query engine, viewport listener, or responsive runtime. The tokens compile into Tailwind's own responsive variants and utilities; the canonical source (`packages/tokens/tokens.json`) owns the values, and `scripts/generate-tokens.mjs` emits the TypeScript, CSS, and resolver artifacts deterministically.

## Breakpoints

| Token | Value | Tailwind variant | Intent |
| --- | --- | --- | --- |
| _(compact base)_ | `< 768px` | — (default, no variant) | Phones. Single column, `compact` page gutter. |
| `medium` | `768px` | `md` | Tablet portrait and up. Multi-pane layouts and wider gutters become available. |
| `expanded` | `1280px` | `xl` | Desktop-wide. Max-width containers stop growing and center. |

The set is deliberately minimal and evidence-based. Across the Showcase and all 37 Pattern Gallery screens there are **no** existing Tailwind width variants and only one ad-hoc width switch (`width >= 960` in the Pattern Gallery master/detail). The canonical viewport matrix (`360×800`, `390×844`, `430×932`, `768×1024`, `1280×800`) collapses to exactly three layout classes:

| Viewport | Class |
| --- | --- |
| 360×800, 390×844, 430×932 | compact (base) |
| 768×1024 | `medium` |
| 1280×800 | `expanded` |

`medium` and `expanded` are BeeUI's semantic names; their canonical `tailwindVariant` bindings are `md` and `xl`. The generator emits the actual Tailwind breakpoint namespace through those bindings, so changing `breakpoint.medium` changes `md:` rather than accidentally creating a second `medium:` variant. Tailwind/Uniwind remains the only responsive execution engine.

### Web-only, build-time constants

Breakpoints are classified `web-responsive` / `build-time-constant` / `runtimeOverridable: false`. Tailwind compiles them into responsive variants at build time, so they cannot be a runtime override surface — a runtime-mutable breakpoint API is out of scope (that concern belongs to #71). The generated `breakpoint` TypeScript constant is a *readable* semantic value (`breakpoint.medium`, `breakpoint.expanded`) but is not an override path, and it must not be used to build a parallel media-query engine on native. `responsiveLayoutClassification` in `@beeui/tokens` records this classification.

Generated web artifact (`packages/tokens/src/theme.css`):

```css
--breakpoint-md: 48rem; /* semantic: medium = 768px */
--breakpoint-xl: 80rem; /* semantic: expanded = 1280px */
```

This is intentionally a semantic-to-engine binding: TypeScript/application vocabulary stays `medium`/`expanded`, while Tailwind utility syntax stays `md:`/`xl:`. There is no generated `medium:` or `expanded:` responsive namespace.

## Page gutters

Semantic horizontal page-edge padding. Cross-platform: on web via the generated `--spacing-page-gutter-*` Tailwind utility (`px-page-gutter-compact`, …); on React Native via the `pageGutter` constant from `@beeui/tokens`.

| Token | Value | Intent |
| --- | --- | --- |
| `compact` | `16px` | Dense list/feed screens and narrow viewports (commerce, dashboard). |
| `regular` | `20px` | Default content and form screens (auth, settings). |
| `spacious` | `24px` | Wide or web-comfortable page edges (`web:` gutters, wide shells). |

These are the horizontal page paddings that actually recur in the shells today (`px-4` = 16, `px-5` = 20, `px-6`/`web:px-6` = 24). Smaller inline paddings such as `px-3` (12px) on dense rows are **not** page gutters and remain local literals — see below.

### Safe-area composition (native)

Page gutters compose **additively** with safe-area insets and never replace them. Apply the gutter as padding on content *inside* the safe area; the inset keeps content clear of system edges and the gutter adds the page margin on top. Do not add the inset a second time as a gutter (no double-inset).

BeeUI's safe-area ownership model (`SafeArea`, `KeyboardAwareScreen`) assigns each system edge to exactly one shell element. `KeyboardAwareScreen` deliberately leaves `safeAreaEdges` unset by default so a screen composed under a shell that already owns insets does not double-apply them; it applies gutters on the inner content box, inside any safe area it does own.

## Content containers (max-width)

The existing semantic `contentWidth` contract is preserved unchanged and is the canonical container vocabulary:

| Token | Value | Web utility |
| --- | --- | --- |
| `form` | `512px` | `max-w-form` |
| `reading` | `704px` | `max-w-reading` |
| `page` | `1152px` | `max-w-page` |
| `dialog` | `512px` | `max-w-dialog` |

No new container semantics are added: the widths that drift in the codebase today (`max-w-3xl` = 768, `max-w-[680px]`, `KeyboardAwareScreen`'s `440/680/960`, …) approximate the existing `form`/`reading`/`page` intents rather than introducing genuinely new meaning. Prefer the `max-w-form/reading/page/dialog` utilities (and the `contentWidth` constant on native) over raw `max-w-Nxl` or arbitrary pixel literals.

### Shrink-to-available-width

A container is a **maximum** width, not a fixed one. Compose max-width with a full-width base and centering so the container shrinks safely when the viewport is narrower than the cap:

```
class="mx-auto w-full max-w-reading px-page-gutter-regular"
```

Effective content width is `min(maxWidth, availableWidth)` where `availableWidth = viewport − 2 × gutter`. This never forces horizontal overflow: on the narrowest canonical viewport (360px) every `contentWidth` cap shrinks to the available width minus gutters and stays positive. Never pin a fixed `width` equal to a `contentWidth` value.

## Classification summary

| Group | Layer | Binding | Runtime-overridable | Engine |
| --- | --- | --- | --- | --- |
| `breakpoint` | web-responsive | build-time constant | no | Tailwind/Uniwind |
| `pageGutter` | cross-platform | value | no | — |
| `contentWidth` | cross-platform | value | no | — |

`breakpoint` values are meaningful only where a build-time responsive variant is compiled (web). `pageGutter` and `contentWidth` are plain cross-platform dimensions usable on web and React Native. None are runtime-mutable.

## When a local layout literal is still appropriate

The vocabulary is for **page-level** structure. Keep a local literal when:

- the value is component-internal spacing, not a page edge (e.g. a dense row's `px-3`/12px, a chip's inner padding);
- a one-off canvas needs a bespoke cap that is not a reusable container intent (e.g. the Pattern Gallery's 760px preview canvas);
- the intent genuinely differs from every semantic token — do not mechanically replace a literal whose product meaning does not match `compact`/`regular`/`spacious` or `form`/`reading`/`page`/`dialog`.

Mass replacement of every layout number is explicitly out of scope. This document defines the vocabulary; adopting it in individual shells is incremental and must preserve current rendered layouts.

## Relationship to density (#74)

Responsive layout and density are **separate axes**. Breakpoints, gutters, and containers describe how a page adapts to viewport width; they never encode a density knob. The two must not be conflated.

## Adding or changing responsive-layout tokens

1. Edit only `packages/tokens/tokens.json`.
2. Keep breakpoint values strictly ascending and unique, each mapped to a Tailwind/Uniwind variant via `$extensions["com.beeui"].tailwindVariant`; the generator must emit that variant name as `--breakpoint-<variant>`.
3. Keep page-gutter values unique and positive; keep the `contentWidth` contract compatible unless an overflow bug is directly demonstrated.
4. Regenerate with `pnpm tokens:generate` and review every generated change.
5. Run `pnpm tokens:check`, `pnpm tokens:test`, `pnpm typecheck`, the workspace tests, and the full Pattern Gallery viewport matrix.
