import { beeTokenReader, readTokenValue, type BeeTokenPath, type BeeTokenValue } from '@beeui/tokens';
import { Uniwind, useCSSVariable } from 'uniwind';

/**
 * `useBeeToken` / `getBeeToken` are BeeUI's typed runtime-token-read adapter
 * (#72) for non-`className` consumers: SVG props, chart libraries, React
 * Navigation theme objects, `StatusBar`/platform APIs, canvas, imperative
 * animation setup, or any other API that cannot accept a Tailwind/Uniwind
 * `className`.
 *
 * ## What this is not
 *
 * This is **not** a theme store, a cached theme object, or a second React
 * context/provider. Both functions below are thin, stateless adapters over
 * Uniwind's own public read APIs (`useCSSVariable` / `Uniwind.getCSSVariable`
 * from the `uniwind` package) — see that package's exports for the exact
 * primitives this file wraps. `@beeui/tokens`'s `beeTokenReader` only derives
 * *which* CSS variable to ask Uniwind for and *how* to normalize whatever
 * Uniwind returns (see `packages/tokens/src/token-reader.ts`); it never reads
 * Uniwind itself and holds no state. Uniwind remains the sole runtime theme
 * authority — nothing here mirrors, caches, or duplicates its CSS variables in
 * JavaScript.
 *
 * ## Token paths
 *
 * A `BeeTokenPath` is a `"category.key"` string derived from canonical token
 * metadata: `\`colors.\${SemanticColorToken}\``, `\`radius.\${RadiusName}\``, or
 * `\`motion.\${MotionDurationName}\`` (e.g. `'colors.primary'`, `'radius.md'`,
 * `'motion.normal'`). Passing any other string is a compile-time error, and a
 * non-literal/dynamic string that is not one of these paths throws at runtime
 * (`beeTokenReader.resolve` fails fast — see `token-reader.ts`).
 *
 * Only these three categories are exposed, deliberately:
 *
 * - **Included** — `colors` (every public `SemanticColorToken`), `radius`,
 *   `motion` (duration). Each is real-runtime-reactive: its resolved value can
 *   differ between the initial build and the live app, because it is
 *   theme/appearance/scope-dependent (`colors`) or because #71 lets it be
 *   overridden at runtime (`radius`, `motion`).
 * - **Rejected: private #70 primitives** — authoring-only primitives (e.g.
 *   `amber-500`, `neutral-800`) are never part of `semanticColorTokens` and so
 *   are structurally unreachable through any `BeeTokenPath` — there is no
 *   `'colors.amber-500'` to construct, typed or otherwise.
 * - **Rejected: build-time-only values** — `breakpoint` is a Tailwind/Uniwind
 *   build-time constant (see its JSDoc in `@beeui/tokens`); it is not part of
 *   `beeTokenReaderCategories`, so `'breakpoint.medium'` is neither a valid
 *   type nor a resolvable runtime path. Import `breakpoint` directly instead.
 * - **Rejected: metadata-only / theme-invariant values** — `spacing`,
 *   typography (`fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`,
 *   `fontFamily`), `controlSize`, `iconSize`, `avatarSize`, `contentWidth`,
 *   `pageGutter`, `elevation`, `motionEasing`, `layer`, and `focusRing`
 *   geometry are identical across every runtime theme and never
 *   runtime-overridable. Reading them through Uniwind would add indirection
 *   and a platform-representation mismatch for a value that never changes —
 *   import the already-typed constant from `@beeui/tokens` directly (see
 *   `docs/data-typography.md`'s "Runtime-reader note").
 *
 * ## Value normalization
 *
 * | Category | TS type | Representation |
 * | --- | --- | --- |
 * | `colors.*` | `string` | CSS color, normalized to `#rrggbb` / `#rrggbbaa` hex (Uniwind's own normalization). |
 * | `radius.*` | `number` | CSS pixels, unit stripped (web returns `"10px"`; native already returns `10`). |
 * | `motion.*` | `number` | Milliseconds, unit stripped (web returns `"200ms"`; native already returns `200`). |
 *
 * Uniwind's own `useCSSVariable`/`getCSSVariable` return `string | number`
 * (web is always a string; native can be either), so this platform mismatch
 * is real, not hypothetical — `useBeeToken`/`getBeeToken` normalize it away so
 * every consumer gets the same typed shape on every platform.
 *
 * ## Hook vs. non-hook: read this before choosing
 *
 * ### `useBeeToken(path)` — hook, scope-aware, live-updating
 *
 * Delegates directly to Uniwind's `useCSSVariable`, which subscribes through
 * Uniwind's own listener (`StyleDependency.Theme` + `StyleDependency.Variables`)
 * and reads through Uniwind's ambient scope context. Concretely:
 *
 * - Re-renders when the **global** active theme changes (`Uniwind.setTheme`).
 * - Re-renders when a **runtime override** (#71 `applyThemeOverrides`) changes
 *   the read variable — there is no stale cache, because this hook never
 *   caches anything itself; it re-reads through Uniwind on every notified
 *   change.
 * - Resolves against the **nearest `BeeThemeScope`/Uniwind `ScopedTheme`**
 *   ancestor when called inside one, and against the global theme otherwise —
 *   because it uses the same ambient context `ScopedTheme` provides. BeeUI
 *   does not reimplement or mirror this: it is exactly Uniwind's own
 *   `useUniwindContext()`-based scope resolution.
 *
 * Use this for any value rendered as part of a React tree: an SVG `fill`, a
 * chart's color/duration input, a `StatusBar` prop computed during render.
 *
 * ```tsx
 * function BeeIcon() {
 *   const fill = useBeeToken('colors.primary');
 *   return <Svg><Path fill={fill} d="..." /></Svg>;
 * }
 * ```
 *
 * ### `getBeeToken(path)` — imperative, global-theme-only, snapshot read
 *
 * Delegates directly to `Uniwind.getCSSVariable`, which Uniwind hardcodes to
 * read against the **global** theme only (`{ scopedTheme: null }` — see
 * Uniwind's own `Uniwind.getCSSVariable` source). This is a genuine, provable
 * Uniwind limitation, not a BeeUI design choice:
 *
 * - **Ignores `BeeThemeScope`.** Calling it inside a scoped subtree still
 *   returns the app's current global-theme value, never the scope's. Prefer
 *   `useBeeToken` inside a scoped subtree; reserve `getBeeToken` for call
 *   sites outside any scope you care about (app root setup, a platform API
 *   configured once, code that runs outside React entirely).
 * - **Is a snapshot, not a subscription.** It returns the value valid *at the
 *   moment it is called* and does not re-run on a later theme change or
 *   override — call it again to get a fresh value (e.g. from inside your own
 *   theme-change callback). It has no cache of its own, so back-to-back calls
 *   after a real Uniwind change never return a stale value.
 * - **Requires Uniwind/BeeUI's `theme.css` to already be loaded.** Calling it
 *   before the app's theme has initialized (e.g. very early startup, or a web
 *   SSR pass before hydration) can resolve to no value; `getBeeToken` throws a
 *   descriptive error in that case rather than silently returning `undefined`.
 *
 * Use this for one-time/imperative configuration outside render: setting a
 * native `StatusBar` color on mount, configuring a React Navigation theme
 * object before rendering the navigator, or seeding a canvas/chart library
 * that manages its own redraw loop.
 *
 * ```ts
 * const navigationTheme = {
 *   dark: false,
 *   colors: {
 *     primary: getBeeToken('colors.primary'),
 *     background: getBeeToken('colors.background'),
 *     card: getBeeToken('colors.surface'),
 *     text: getBeeToken('colors.foreground'),
 *     border: getBeeToken('colors.border'),
 *     notification: getBeeToken('colors.destructive'),
 *   },
 * };
 * ```
 */
export function useBeeToken<Path extends BeeTokenPath>(path: Path): BeeTokenValue<Path> {
  const variable = beeTokenReader.resolve(path).variable;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `variable` is derived
  // deterministically from `path` on every render, so this hook is always
  // called; only *which* CSS variable name it subscribes to can change.
  const raw = useCSSVariable(variable);
  return readTokenValue(beeTokenReader, path, raw);
}

/**
 * The non-hook form of {@link useBeeToken}. See the module documentation above
 * — in particular, **this always reads the global theme, never an ambient
 * `BeeThemeScope`**, and it is a one-shot snapshot read, not a subscription.
 */
export function getBeeToken<Path extends BeeTokenPath>(path: Path): BeeTokenValue<Path> {
  const variable = beeTokenReader.resolve(path).variable;
  const raw = Uniwind.getCSSVariable(variable);
  return readTokenValue(beeTokenReader, path, raw);
}
