# Application density

BeeUI ships a small, evidence-backed **application density** axis: `compact` /
`comfortable` / `spacious`. Density lets an application coordinate a handful of recurring
layout metrics (list-row height/gap, form-field gap) for a dense desktop/admin surface
versus a comfortable or touch-oriented one, without turning every spacing/radius/font
token into an arbitrary runtime multiplier.

**Density is not a component size prop, and it does not replace one.** `Button`'s `size`
prop (`sm`/`md`/`lg`/`icon`), `Card`'s `padding` prop, and every other component-level size
API keep their existing meaning under every density mode — see
[Interaction with component size props](#interaction-with-component-size-props).

## Where density tokens come from

- Canonical source: `packages/tokens/tokens.json`, under
  `$extensions["com.beeui"].densityIntents` (the approved mode vocabulary and default —
  same shape as `semanticMotion`, see [`motion.md`](./motion.md)), plus one canonical
  `tokens.tokens` group per density-sensitive metric, each flagged
  `$extensions["com.beeui"].densityAxis: true` and defining exactly one dimension value per
  approved mode.
- Generator: `scripts/generate-tokens.mjs` (`densityMetricGroupNames`, `densityModeNames`,
  `kebabCase`/`densityVariableName`, `renderDensityArtifact`).
- Generated artifacts:
  - `packages/tokens/src/index.ts` — `densityModes`, `defaultDensityMode`,
    `densityModeDescriptions`, `densityMetrics`, `densityMetricVariables`,
    `densityPresets`, `resolveDensityOverrides`, `applyDensity`;
  - `packages/tokens/src/theme.css` — `--spacing-density-<metric>` baked to the **default**
    (`comfortable`) mode's value under the same `--spacing-*` namespace `controlSize` and
    `pageGutter` already use, so Tailwind/Uniwind derives the matching `h-*`/`min-h-*`/
    `gap-*` utilities automatically, and first paint (before any `applyDensity` call)
    always renders the default mode.

Nothing downstream hand-maintains a second list of density-sensitive token names: a group
becomes density-sensitive by flagging `densityAxis: true` and regenerating.

## Approved modes

| Mode | Intended use |
| --- | --- |
| `compact` | Dense desktop/admin surfaces (dashboards, data tables, settings lists) where users benefit from higher information density and precise pointer input. |
| `comfortable` (default) | Preserves the BeeUI v2 visual baseline exactly. |
| `spacious` | Roomier touch-oriented surfaces and wide desktop layouts where extra breathing room improves scanability. |

`spacious` reuses the `pageGutter`/`controlSize` three-tier naming precedent already
established elsewhere in the token set. `pageGutter`'s own `compact`/`regular`/`spacious`
vocabulary is a **different, unrelated axis** (a viewport-responsive, build-time constant
selected by breakpoint) — see [`responsive-layout.md`](./responsive-layout.md). Density is
an explicit, runtime application intent.

## Density-sensitive metrics (what density coordinates)

Only metrics with real, recurring evidence in existing component source participate:

| Metric | CSS variable | `compact` | `comfortable` (default) | `spacious` | Evidence |
| --- | --- | --- | --- | --- | --- |
| `rowHeight` | `--spacing-density-row-height` | 44px | 56px | 64px | `ListItem`'s pre-#74 `min-h-14` (56px) literal |
| `rowGap` | `--spacing-density-row-gap` | 8px | 12px | 16px | `ListItem`'s pre-#74 `gap-3` (12px) literal |
| `formGap` | `--spacing-density-form-gap` | 4px | 8px | 12px | `FormGroup`'s and `Field`'s shared pre-#74 `gap-2` (8px) literal |

`rowHeight`/`rowGap` are consumed by `ListItem` (`min-h-density-row-height`,
`gap-density-row-gap`); `formGap` is consumed by `FormGroup` and `Field`
(`gap-density-form-gap`). `comfortable` is pixel-identical to each component's pre-#74
literal, so the default Pattern Gallery is visually unchanged by this feature.

`compact` values reuse existing BeeUI scale numbers deterministically
(`rowHeight.compact` = `controlSize.touchTarget`, `rowGap`/`formGap` step down one entry on
the `spacing` scale) rather than any free-form multiplier.

### Invariant metrics (what density deliberately does NOT touch)

Explicitly out of scope for this release, and enforced by not flagging their canonical
token group `densityAxis: true`:

- **`controlSize`** (`compact`/`default`/`large`/`icon`/`touchTarget`) — this is the
  `Button` `size` prop's own scale, a component-level API, not an application intent. See
  [Interaction with component size props](#interaction-with-component-size-props).
- **`iconSize`** — icon glyph geometry is unaffected.
- **`focusRing`** (width/offset) — accessibility geometry stays fixed.
- **Typography** (`fontSize`/`lineHeight`/`letterSpacing`/`fontWeight`) — readability is
  unaffected by layout density.
- **`contentWidth`** — density does not currently have evidence that it should affect
  max-width container semantics.
- **Card padding / Section spacing** — `Card` already owns an explicit `padding` size prop
  (`sm`/`md`/`lg`); `Section`'s literals had no *recurring* evidence across more than one
  component, so no separate density metric was introduced. Panel/card padding may become a
  density metric in a future issue **if** recurring product evidence for it appears.
- **Navigation item height** — BeeUI has no repeating nav-*item* component yet (only
  `AppHeader`, a single header bar), so there is nothing to attach a "nav item height"
  metric to. When a repeating nav-item pattern exists, it should reuse `rowHeight` or add
  its own evidence-backed metric — not invent an unused one now.

Adding a new density-sensitive metric later requires **recurring product evidence** (the
same literal value repeated across two or more components), not a single occurrence.

## Native interactive hit-target guarantee

`rowHeight` is flagged `nativeHitTargetSensitive: true` in canonical tokens.json. Canonical
validation (`pnpm tokens:check`, and `scripts/__tests__/density-tokens.test.mjs`) fails the
build if any mode's `rowHeight` value falls below `controlSize.touchTarget` (44px) — `44` is
exactly `rowHeight.compact`, so `compact` density sits at, never below, the accepted native
minimum.

Defensively, `ListItem`'s className also carries the same
`ios:min-h-touch-target android:min-h-touch-target` guard `Button`'s `sm` size already uses,
so the rendered native height can never regress below 44px even if a future override or
consuming-app CSS mistake shrinks `--spacing-density-row-height` further. `rowGap`/`formGap`
are not native-interactive geometry and are not hit-target guarded.

## Applying a density mode

Density reuses the existing [#71 runtime-override mechanism](./theming.md) — there is no
second override compiler and no density store:

```ts
import { applyDensity } from '@beeui/tokens';
import { Uniwind } from 'uniwind';

applyDensity(Uniwind, 'light', 'compact');
```

`applyDensity(uniwind, runtimeTheme, mode)` is a thin call-through to #71's
`applyThemeOverrides`, applying `resolveDensityOverrides(mode)` — a precompiled, sorted
`CompiledThemeOverrides` bundle built once at module init from `densityMetrics`.
`resolveDensityOverrides` throws on an unknown mode rather than silently returning
`undefined`. Like every #71 override, this targets exactly one named Uniwind runtime theme
(e.g. `'light'`, `'violet-dark'`) — not a component subtree.

BeeUI keeps no density preference store. **Persisting a user's or an application's chosen
density is application-owned** (e.g. read a stored preference at startup and call
`applyDensity` once), the same way reduced-motion and theme preference persistence are
application-owned elsewhere in BeeUI.

## Interaction with component size props

An explicit component size prop (`<Button size="sm">`, `<Card padding="lg">`, ...) keeps
its exact existing meaning under every density mode. Component size classes
(`h-control-*`) and density classes (`*-density-*`) are disjoint CSS-variable namespaces —
applying a density mode never changes what `size="sm"` renders as, and choosing a component
size never opts a component out of (or into) density. The two axes compose independently:
an app can run `compact` density with `<Button size="lg">` rows in the same screen.

## Scoping — global/application only in this release

Density has **no scoped/subtree application surface** in this release: `applyDensity`
targets one named Uniwind runtime theme, exactly like #71's `applyThemeOverrides`, not a
component subtree. This is a deliberate decision, not an oversight:

- #68's `BeeThemeScope` (see [`theme-scope.md`](./theme-scope.md)) resolves a
  `{ brand, appearance }` selection to a Uniwind runtime-theme *name*. Density is an
  orthogonal axis (the same runtime theme, different metric values) — reusing
  `BeeThemeScope` for density would conflate two unrelated selections and multiply the
  runtime-theme name space (brand × appearance × density) for no product-evidenced need.
- #71's `applyThemeOverrides`/`Uniwind.updateCSSVariables` mutate one named runtime theme
  globally; it is explicitly not scoped to a subtree. Building subtree-scoped density would
  require a genuinely new propagation mechanism (a React context or an equivalent CSS
  scoping layer keyed on density) — exactly the "second store/provider" this issue's scope
  excludes.
- There is no existing recurring product pattern in BeeUI today that needs *nested* density
  (e.g. a compact table embedded in an otherwise spacious screen). Building the scoping
  mechanism ahead of that evidence would be speculative.

If a real nested-density product need emerges, the natural extension is a
`BeeDensityScope` sibling to `BeeThemeScope` that renders standard CSS custom-property
overrides on web (`style={{ '--spacing-density-row-height': ... }}`, using the existing CSS
cascade — no new propagation) — deferred until that evidence exists, and out of scope here.

## Verifying

- `pnpm tokens:check` — canonical/codegen freshness plus every density invariant above
  (exact mode vocabulary, positive values, `rowHeight` hit-target minimum).
- `pnpm tokens:test` — `scripts/__tests__/density-tokens.test.mjs` (codegen determinism,
  invariant rejection, adding a new metric group requires no generator edit).
- `pnpm --filter @beeui/showcase test` —
  `apps/showcase/__tests__/theme-density-v3.test.tsx` (runtime `applyDensity`/Uniwind
  integration, `ListItem`/`FormGroup`/`Field` consumption, component-size-prop
  independence, no scoped/store surface).
