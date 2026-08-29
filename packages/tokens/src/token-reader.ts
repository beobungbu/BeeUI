// Generic runtime-token-read adapter for BeeUI theme tokens (issue #72).
//
// This module is AUTHORED (not generated). It defines the generic
// `defineTokenReader()` engine plus the pure `normalizeTokenValue()` /
// `readTokenValue()` helpers. The concrete, codegen-derived category
// vocabulary (which token groups are runtime-readable, their keys, and their
// exact Uniwind CSS-variable names) is instantiated inside the generated
// `index.ts` as `beeTokenReader` — the same authored-engine/generated-
// instantiation split already used for `defineThemeRegistry()` (registry.ts)
// and `createThemeOverridesDefiner()` (theme-overrides.ts).
//
// Design invariants (BeeUI issue #72):
// - Uniwind remains the sole runtime theme authority. This module never
//   touches `document`, a Uniwind singleton, React, or any other global or
//   framework state — it has zero dependency on `uniwind` or `react`, exactly
//   like `registry.ts` and `theme-overrides.ts`.
// - `defineTokenReader()` returns a pure, stateless `TokenReader`: path
//   derivation, validation, and CSS-variable-name resolution only. It holds
//   no mutable state, subscribes to nothing, and performs no I/O.
// - The actual runtime read (Uniwind's `useCSSVariable` hook / the imperative
//   `Uniwind.getCSSVariable()`) happens one layer up, in `@beeui/ui`
//   (`use-bee-token.ts`), which is the only place this feature touches
//   `uniwind`. This module only tells that layer *which* CSS variable to ask
//   Uniwind for and *how* to normalize whatever Uniwind returns — it never
//   asks Uniwind anything itself, so it can never become a second store or a
//   stale JS mirror of theme values.
// - Only categories with a real runtime-reactive use case (a value that can
//   differ between the initial build and the live app — because it is
//   theme/appearance/scope-dependent, or because #71 lets it be overridden at
//   runtime) are ever instantiated as readable categories. Token groups whose
//   value is identical across every runtime theme and never runtime-mutable
//   (spacing, typography, control/icon/avatar sizes, elevation, layer,
//   focus-ring geometry, responsive layout) are intentionally not readable
//   here — they are already ordinary typed exports in `@beeui/tokens`, correct
//   to import directly (see `docs/data-typography.md`'s "Runtime-reader note").
//   Private authoring primitives and build-time-only/invariant tokens (e.g.
//   `breakpoint`) are simply never given a category entry, so they are
//   unreachable through this API by construction, not by a denylist.

/** The normalized value shape BeeUI returns for one token category. */
export type TokenValueKind = 'color' | 'dimension' | 'duration';

/**
 * One runtime-readable token category (e.g. "colors", "radius", "motion").
 *
 * `Key` is the exact accepted key vocabulary for the category, derived from
 * canonical token metadata (never hand-maintained). `variable` deterministically
 * builds the exact Uniwind CSS custom-property name Uniwind's read APIs expect
 * (no leading `var(...)` wrapper — Uniwind's `useCSSVariable`/`getCSSVariable`
 * take the bare `--name`).
 */
export interface TokenCategoryDefinition<Key extends string> {
  /** How BeeUI normalizes this category's raw Uniwind value. */
  readonly kind: TokenValueKind;
  /** The exact accepted key vocabulary for this category. */
  readonly keys: readonly Key[];
  /** Deterministically build the exact Uniwind CSS variable name for a key. */
  readonly variable: (key: Key) => string;
}

/**
 * A fixed set of readable categories, keyed by their public category name.
 * Bound with `any` for the same reason `OverrideCategoryMap` is in
 * `theme-overrides.ts`: TypeScript checks the `variable` function property
 * contravariantly, so a concrete `(key: 'xs' | 'sm' | ...) => string` would
 * not otherwise be assignable to a map bound as `(key: string) => string`,
 * even though every category's `variable` is only ever called with keys drawn
 * from that same category's own `keys` array.
 */
export type TokenCategoryMap = Readonly<Record<string, TokenCategoryDefinition<any>>>;

/** Every valid `"category.key"` path for a fixed `Categories` map. */
export type TokenPath<Categories extends TokenCategoryMap> = {
  [C in keyof Categories & string]: Categories[C] extends TokenCategoryDefinition<infer Key>
    ? `${C}.${Key}`
    : never;
}[keyof Categories & string];

type ValueForKind<Kind extends TokenValueKind> = Kind extends 'color'
  ? string
  : Kind extends 'dimension'
    ? number
    : Kind extends 'duration'
      ? number
      : never;

/** The normalized TypeScript return type for one specific token path. */
export type TokenValueForPath<Categories extends TokenCategoryMap, Path extends TokenPath<Categories>> =
  Path extends `${infer C}.${string}`
    ? C extends keyof Categories
      ? ValueForKind<Categories[C]['kind']>
      : never
    : never;

/** The result of resolving one token path against a `TokenReader`. */
export interface ResolvedTokenPath {
  readonly category: string;
  readonly key: string;
  /** The exact Uniwind CSS custom-property name (e.g. `--color-primary`). */
  readonly variable: string;
  readonly kind: TokenValueKind;
}

/**
 * A pure, stateless reader over a fixed set of runtime-readable token
 * categories. Holds no mutable state and never touches Uniwind, `document`,
 * or React — it only maps typed `"category.key"` paths to the CSS-variable
 * name and value kind a caller needs to actually perform the read elsewhere.
 */
export interface TokenReader<Categories extends TokenCategoryMap> {
  /** Every valid path this reader accepts, in category/key definition order. */
  readonly paths: readonly TokenPath<Categories>[];
  /** Whether an arbitrary string is a path this reader accepts. */
  isValidPath(path: string): path is TokenPath<Categories>;
  /**
   * Resolve a token path to its category, key, CSS-variable name, and value
   * kind. Typed to `TokenPath<Categories>`, so an unknown path is rejected at
   * compile time for a literal/typed caller — run a dynamic/untyped string
   * through {@link isValidPath} first. For a path that is not actually valid
   * at runtime (e.g. via an `as`/JS escape hatch) this throws deterministically
   * instead of silently falling back — the same fail-fast contract
   * `defineThemeRegistry#resolve` and `defineThemeOverrides` already use
   * elsewhere in this package.
   */
  resolve(path: TokenPath<Categories>): ResolvedTokenPath;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid BeeUI token reader: ${message}`);
}

/**
 * Build a `TokenReader` from a fixed, codegen-derived set of readable
 * categories. Pure and stateless: never touches Uniwind, `document`, React,
 * or any global. See the module documentation above for the full design
 * rationale.
 */
export function defineTokenReader<const Categories extends TokenCategoryMap>(
  categories: Categories,
): TokenReader<Categories> {
  const categoryNames = Object.keys(categories);
  invariant(categoryNames.length > 0, 'a token reader must define at least one category');

  const byPath = new Map<string, ResolvedTokenPath>();
  for (const category of categoryNames) {
    const definition = categories[category];
    invariant(
      Array.isArray(definition.keys) && definition.keys.length > 0,
      `category "${category}" must define at least one key`,
    );
    for (const key of definition.keys as readonly string[]) {
      const path = `${category}.${key}`;
      const variable = definition.variable(key);
      invariant(
        typeof variable === 'string' && variable.startsWith('--'),
        `category "${category}" key "${key}" must map to a CSS custom-property name (got "${String(variable)}")`,
      );
      invariant(!byPath.has(path), `duplicate token path "${path}"`);
      byPath.set(path, Object.freeze({ category, key, variable, kind: definition.kind }));
    }
  }

  const paths = Object.freeze([...byPath.keys()]) as TokenPath<Categories>[];

  function isValidPath(path: string): path is TokenPath<Categories> {
    return byPath.has(path);
  }

  function resolve(path: string): ResolvedTokenPath {
    const resolved = byPath.get(path);
    invariant(resolved !== undefined, `unknown token path "${path}"; supported paths: ${paths.join(', ')}`);
    return resolved;
  }

  return Object.freeze({ paths, isValidPath, resolve });
}

const DIMENSION_PATTERN = /^(-?\d+(?:\.\d+)?)px$/;
const DURATION_PATTERN = /^(-?\d+(?:\.\d+)?)ms$/;

/**
 * Normalize one raw value Uniwind's `useCSSVariable`/`Uniwind.getCSSVariable`
 * returned into BeeUI's documented per-kind representation:
 *
 * - `color` — the CSS color string unchanged (Uniwind itself already
 *   normalizes valid colors to `#rrggbb`/`#rrggbbaa` hex on web; native
 *   returns the same hex string BeeUI's theme source declares).
 * - `dimension` — a plain `number` in CSS pixels. Web returns a raw CSS
 *   string like `"10px"` (BeeUI's `--radius-*` variables are only ever
 *   authored/overridden in px — see `theme-overrides.ts`); native already
 *   returns a plain number. Both normalize to the same `number`.
 * - `duration` — a plain `number` in milliseconds, by the same web-string
 *   vs. native-number reasoning as `dimension` (BeeUI's `--motion-duration-*`
 *   variables are only ever authored/overridden in ms).
 *
 * This function is pure: given the same `resolved`/`raw` input it always
 * returns the same output, and it never touches Uniwind or any global state.
 */
export function normalizeTokenValue(resolved: ResolvedTokenPath, raw: string | number): string | number {
  const { kind, variable, category, key } = resolved;

  if (kind === 'color') {
    invariant(
      typeof raw === 'string',
      `token "${category}.${key}" (${variable}) expected a color string from Uniwind, got ${typeof raw}`,
    );
    return raw;
  }

  if (typeof raw === 'number') return raw;

  const pattern = kind === 'dimension' ? DIMENSION_PATTERN : DURATION_PATTERN;
  const unit = kind === 'dimension' ? 'px' : 'ms';
  const match = pattern.exec(raw.trim());
  invariant(
    match !== null,
    `token "${category}.${key}" (${variable}) expected a "${unit}" ${kind} value from Uniwind, got "${raw}"`,
  );
  return Number(match[1]);
}

/**
 * Resolve + normalize one raw Uniwind CSS-variable read into the exact typed
 * value `useBeeToken`/`getBeeToken` return for `path`. `raw` is whatever
 * Uniwind's own `useCSSVariable`/`Uniwind.getCSSVariable` returned for the
 * resolved variable name — `undefined` is Uniwind's own documented "variable
 * not found" signal (see Uniwind's `useCSSVariable` docs), which this throws
 * on rather than silently returning a wrong-shaped value. In practice this
 * should not happen for BeeUI's own categories: every readable variable is
 * declared unconditionally in BeeUI's generated `theme.css`, for every
 * runtime theme, so it is always defined once that stylesheet/theme has
 * loaded — an `undefined` read means that precondition was not met yet (e.g.
 * called before Uniwind/BeeUI's theme has initialized).
 */
export function readTokenValue<Categories extends TokenCategoryMap, Path extends TokenPath<Categories>>(
  reader: TokenReader<Categories>,
  path: Path,
  raw: string | number | undefined,
): TokenValueForPath<Categories, Path> {
  const resolved = reader.resolve(path);
  invariant(
    raw !== undefined,
    `token "${path}" (${resolved.variable}) resolved to no value. Make sure BeeUI's theme.css/theme ` +
      "stylesheet is loaded and Uniwind's active runtime theme has initialized before reading tokens.",
  );
  return normalizeTokenValue(resolved, raw) as TokenValueForPath<Categories, Path>;
}
