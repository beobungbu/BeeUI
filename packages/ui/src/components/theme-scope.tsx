import {
  beeRuntimeThemeByBrand,
  beeThemeRegistry,
  type RegistryAppearance,
  type RegistryBrand,
  type RegistryRuntimeTheme,
  type ThemeRegistry,
  type ThemeRegistryDefinition,
} from '@beemvp/beeui-tokens';
import * as React from 'react';
import { ScopedTheme, type ThemeName } from 'uniwind';

/**
 * `BeeThemeScope` is a thin typed wrapper around Uniwind's own `ScopedTheme`
 * component. Uniwind remains the sole runtime theme authority: this component
 * owns no React context, no state, and no propagation logic of its own — it only
 * maps a typed `{ brand, appearance }` selection (or an already-resolved
 * runtime-theme name) through a `@beemvp/beeui-tokens` theme registry (see #67,
 * `defineThemeRegistry`) and forwards the resulting Uniwind runtime-theme name to
 * `<ScopedTheme theme={...}>`. Nesting, precedence, nested-scope, and
 * sibling-scope semantics are exactly whatever Uniwind's `ScopedTheme` defines;
 * BeeUI does not reimplement or mirror them.
 *
 * ## When to use this vs. `Uniwind.setTheme()`
 *
 * - Application-level theme switching (a user's light/dark or brand
 *   preference for the whole app) stays an explicit `Uniwind.setTheme(...)`
 *   call the application owns — unchanged by this component.
 * - `BeeThemeScope` themes one subtree independently of the application theme:
 *   an embedded preview, a white-label widget, a docs example, a dark sidebar in
 *   a light app, or a brand A/B comparison rendered side by side.
 *
 * ## Two typed forms
 *
 * 1. Registry selection — `brand` + `appearance`, resolved through a registry:
 *    ```tsx
 *    <BeeThemeScope brand="violet" appearance="dark">
 *      <Card>...</Card>
 *    </BeeThemeScope>
 *    ```
 *    Omitting `registry` uses the default `beeThemeRegistry` (Bee + Violet). A
 *    consumer-defined registry from `defineThemeRegistry` (#67) narrows `brand`
 *    and `appearance` to that registry's own vocabulary:
 *    ```tsx
 *    <BeeThemeScope registry={acmeRegistry} brand="acme" appearance="dark">
 *      <Card>...</Card>
 *    </BeeThemeScope>
 *    ```
 * 2. Resolved runtime-theme name — for callers that already hold a Uniwind
 *    runtime-theme name (e.g. round-tripped through `registry.selectionFor`):
 *    ```tsx
 *    <BeeThemeScope theme="violet-dark">
 *      <Card>...</Card>
 *    </BeeThemeScope>
 *    ```
 *    `theme` is still typed against the supplied/default registry's runtime-theme
 *    union, and is validated against it at construction time (see below) — it is
 *    not an escape hatch to an arbitrary unchecked string.
 *
 * ## Unknown/unsupported selections
 *
 * There is no silent fallback to the wrong brand. An unknown `brand`/`appearance`
 * pair throws from the registry's own `resolve()` (see `defineThemeRegistry`,
 * #67); an unrecognized `theme` name throws from this component. Both throw
 * synchronously during render, before `Uniwind.setTheme`/`ScopedTheme` ever sees
 * an invalid name.
 *
 * ## Portals and overlays (Dialog, Popover, DropdownMenu, Select, AlertDialog)
 *
 * BeeUI's overlay primitives all render their portal-able content through the
 * shared overlay transport in `overlay-transport.ts`/`.web.tsx`/`.native.tsx`.
 * That transport has three modes, and only two of them preserve the React
 * ancestry (and therefore the scoped theme) that `BeeThemeScope` set up at the
 * overlay's declaration site:
 *
 * - `web-dom` (`ReactDOM.createPortal`) — preserves React context. A scoped
 *   theme applied above a `Dialog`/`Popover`/`DropdownMenu`/`Select` reaches its
 *   portaled content on web.
 * - `native-teleport` (`react-native-teleport`, requires the New Architecture and
 *   a registered native host view) — content stays in its source fiber tree, so
 *   context (and the scoped theme) is preserved.
 * - `legacy` (the defensive store-and-reparent fallback used when neither of the
 *   above is available — notably, JS-only test environments, and a native
 *   runtime without the New Architecture or without a registered teleport host
 *   view) — content is stored and re-rendered under a host mounted at
 *   `BeeUIProvider`, outside any subtree-level `BeeThemeScope`. **On this path a
 *   scoped theme does not reach portaled overlay content**; the overlay renders
 *   under whatever theme is active at the application root instead. This is an
 *   existing, pre-#68 constraint of the overlay transport itself (see
 *   `overlay-host-mode.ts`), not something this component special-cases —
 *   `BeeThemeScope` does not add a second propagation path to work around it.
 *
 * This component never modifies focus-trap, dismissal, or event-routing
 * behavior; it only supplies the `theme` value Uniwind's `ScopedTheme` already
 * accepts.
 *
 * ## Component/overlay state
 *
 * Changing `brand`/`appearance`/`theme` only ever changes the `theme` prop value
 * passed to Uniwind's `ScopedTheme` — `children` are forwarded as-is, in the same
 * position, with no additional wrapping component, conditional remount, or `key`
 * change. Local component state and open overlay state inside the scope survive
 * a scope change the same way they would survive any other prop update.
 *
 * ## SSR / web / native
 *
 * `BeeThemeScope` itself renders nothing platform-specific — it is a pure
 * pass-through to Uniwind's own `ScopedTheme`, whose web/native/SSR behavior
 * (including that library's own DOM/host requirements) is documented by Uniwind,
 * not by BeeUI. BeeUI adds no additional SSR constraint beyond what Uniwind
 * itself requires (see the platform notes above for the one known constraint
 * that does originate here: portal/overlay transport mode).
 *
 * ## No new theme store/provider
 *
 * `BeeThemeScope` introduces no `React.createContext`, no module-level mutable
 * state, and no subscription mechanism of its own. It is a stateless function
 * component that resolves a name and renders Uniwind's `ScopedTheme`.
 */
export type BeeThemeScopeProps<Def extends ThemeRegistryDefinition = typeof beeRuntimeThemeByBrand> = {
  /**
   * The registry used to resolve `brand`/`appearance` (or validate `theme`).
   * Defaults to `beeThemeRegistry` (Bee + Violet, from #67). Pass a registry
   * built with `defineThemeRegistry` to scope by a consumer-defined brand.
   */
  registry?: ThemeRegistry<Def>;
  children?: React.ReactNode;
} & (
  | {
      /** Semantic brand, resolved through `registry`. */
      brand: RegistryBrand<Def>;
      /** Semantic appearance, resolved through `registry`. */
      appearance: RegistryAppearance<Def>;
      theme?: undefined;
    }
  | {
      /** An already-resolved Uniwind runtime-theme name, validated against `registry`. */
      theme: RegistryRuntimeTheme<Def>;
      brand?: undefined;
      appearance?: undefined;
    }
);

function resolveScopedRuntimeTheme<Def extends ThemeRegistryDefinition>(
  props: BeeThemeScopeProps<Def>,
  registry: ThemeRegistry<Def>,
): RegistryRuntimeTheme<Def> {
  if (props.theme !== undefined) {
    const known = (registry.runtimeThemes as readonly string[]).includes(props.theme);
    if (!known) {
      throw new Error(
        `BeeThemeScope: "${String(props.theme)}" is not a runtime-theme name known to the ` +
          `supplied registry. Known runtime themes: ${registry.runtimeThemes.join(', ')}. Pass one ` +
          'of those names, or use the brand + appearance form instead.',
      );
    }
    return props.theme;
  }

  // The registry's own `resolve()` throws deterministically for an unknown
  // brand/appearance instead of silently falling back — see defineThemeRegistry
  // (#67). BeeThemeScope relies on that behavior rather than duplicating it.
  return registry.resolve(
    props.brand as RegistryBrand<Def>,
    props.appearance as RegistryAppearance<Def>,
  );
}

/**
 * Typed BeeUI wrapper over Uniwind's `ScopedTheme`. See the module documentation
 * above for the full contract (registry selection vs. resolved-name form,
 * unknown-selection behavior, portal/overlay constraints, and why this
 * introduces no new theme store).
 */
export function BeeThemeScope<Def extends ThemeRegistryDefinition = typeof beeRuntimeThemeByBrand>(
  props: BeeThemeScopeProps<Def>,
): React.ReactElement {
  const registry = (props.registry ?? beeThemeRegistry) as unknown as ThemeRegistry<Def>;
  const runtimeTheme = resolveScopedRuntimeTheme(props, registry);

  // BeeUI's registry is the source of truth here: `runtimeTheme` was either
  // returned by `registry.resolve()` or validated against
  // `registry.runtimeThemes` above, so it is proven correct at runtime. The cast
  // only bridges that proven value into Uniwind's `ThemeName`, which a
  // consuming application can (optionally) narrow via ambient `UniwindConfig`
  // module augmentation to a project-specific literal union — a generic
  // component authored once in `@beemvp/beeui-ui` cannot know that app-specific union
  // ahead of time. This mirrors the same, already-established bridge the
  // Showcase's `ThemeInspector` uses for `Uniwind.setTheme(...)`.
  return <ScopedTheme theme={runtimeTheme as ThemeName}>{props.children}</ScopedTheme>;
}

BeeThemeScope.displayName = 'BeeThemeScope';
