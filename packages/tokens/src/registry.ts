// Extensible, type-safe theme registry for BeeUI.
//
// This module is AUTHORED (not generated). It defines the generic
// `defineThemeRegistry()` API. The default BeeUI registry (`beeThemeRegistry`,
// Bee + Violet) is constructed from the generated canonical mapping inside
// `index.ts`, so the example brands are no longer the only allowed public type
// boundary.
//
// A registry is typed **mapping metadata only**. It is not a React context, a
// state store, a provider, or a mutable singleton, and constructing one never
// mutates Uniwind or any global state. Uniwind remains the sole runtime theme
// authority; the registry only tells callers which Uniwind runtime-theme name a
// semantic `brand + appearance` selection resolves to (and back).

/**
 * The shape a consumer passes to {@link defineThemeRegistry}: a mapping from
 * semantic brand name -> appearance name -> Uniwind runtime-theme name.
 *
 * Example:
 * ```ts
 * {
 *   bee:    { light: 'light',        dark: 'dark' },
 *   violet: { light: 'violet-light', dark: 'violet-dark' },
 * }
 * ```
 */
export type ThemeRegistryDefinition = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Brand-name union inferred from the definition's top-level keys. */
export type RegistryBrand<Def extends ThemeRegistryDefinition> = keyof Def & string;

/**
 * Appearance union inferred from the definition. Indexing the definition by the
 * brand union yields the union of every brand's appearance map; `keyof` of that
 * union is the set of appearance keys common to all brands, which is exactly the
 * appearance vocabulary the registry guarantees for every brand.
 */
export type RegistryAppearance<Def extends ThemeRegistryDefinition> =
  keyof Def[RegistryBrand<Def>] & string;

/** Runtime-theme-name union inferred from the definition's mapped values. */
export type RegistryRuntimeTheme<Def extends ThemeRegistryDefinition> =
  Def[RegistryBrand<Def>][RegistryAppearance<Def>] & string;

/** Result of a deterministic reverse lookup from a runtime-theme name. */
export interface ThemeSelection<Def extends ThemeRegistryDefinition> {
  readonly brand: RegistryBrand<Def>;
  readonly appearance: RegistryAppearance<Def>;
}

/**
 * An immutable, fully-typed theme registry. All fields are read-only and all
 * methods are pure; a registry holds no mutable state.
 */
export interface ThemeRegistry<Def extends ThemeRegistryDefinition> {
  /** The original brand -> appearance -> runtime-theme mapping. */
  readonly map: Def;
  /** Inferred brand-name union, in definition order. */
  readonly brands: readonly RegistryBrand<Def>[];
  /** Inferred appearance union, in definition order. */
  readonly appearances: readonly RegistryAppearance<Def>[];
  /** Inferred runtime-theme-name union, in definition order. */
  readonly runtimeThemes: readonly RegistryRuntimeTheme<Def>[];
  /** Resolve a semantic `brand + appearance` to its Uniwind runtime-theme name. */
  resolve<B extends RegistryBrand<Def>, A extends keyof Def[B] & string>(
    brand: B,
    appearance: A,
  ): Def[B][A];
  /**
   * Deterministic reverse lookup: runtime-theme name -> `{ brand, appearance }`.
   * Returns `undefined` for an unknown name. Runtime-theme names are validated
   * unique at construction, so this mapping is never ambiguous.
   */
  selectionFor(runtimeTheme: string): ThemeSelection<Def> | undefined;
  /** Whether a runtime-theme name resolves to the given appearance. */
  isAppearance(runtimeTheme: string, appearance: RegistryAppearance<Def>): boolean;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid theme registry: ${message}`);
}

/**
 * Define a type-safe theme registry from a `brand -> appearance -> runtime-theme`
 * mapping. Brand, appearance, and runtime-theme unions are inferred from the
 * passed object, so a consumer can add a brand such as `acme` without editing
 * BeeUI package source.
 *
 * Validation (deterministic, at construction):
 * - at least one brand and one appearance;
 * - every brand defines exactly the same appearance set (completeness);
 * - every mapped runtime-theme name is a non-empty string;
 * - runtime-theme names are unique across the whole registry, so reverse lookup
 *   can never be ambiguous.
 *
 * The returned registry is frozen and stateless. Constructing it does not touch
 * Uniwind; applying a resolved runtime theme stays an explicit `Uniwind.setTheme`
 * call owned by the application.
 */
export function defineThemeRegistry<const Def extends ThemeRegistryDefinition>(
  definition: Def,
): ThemeRegistry<Def> {
  invariant(
    definition !== null && typeof definition === 'object' && !Array.isArray(definition),
    'definition must be an object of brands',
  );

  const brands = Object.keys(definition) as RegistryBrand<Def>[];
  invariant(brands.length > 0, 'a registry must define at least one brand');

  const referenceAppearances = Object.keys(definition[brands[0]]) as RegistryAppearance<Def>[];
  invariant(
    referenceAppearances.length > 0,
    `brand "${brands[0]}" must define at least one appearance`,
  );
  const requiredAppearances = new Set<string>(referenceAppearances);

  for (const brand of brands) {
    const appearances = Object.keys(definition[brand]);
    invariant(
      appearances.length === requiredAppearances.size &&
        appearances.every((appearance) => requiredAppearances.has(appearance)),
      `brand "${brand}" must define exactly the appearances: ${referenceAppearances.join(', ')}`,
    );
  }

  const reverse = new Map<string, ThemeSelection<Def>>();
  const runtimeThemes: RegistryRuntimeTheme<Def>[] = [];

  for (const brand of brands) {
    for (const appearance of referenceAppearances) {
      const runtimeTheme = definition[brand][appearance];
      invariant(
        typeof runtimeTheme === 'string' && runtimeTheme.length > 0,
        `brand "${brand}" appearance "${appearance}" must map to a non-empty runtime-theme name`,
      );
      invariant(
        !reverse.has(runtimeTheme),
        `runtime-theme name "${runtimeTheme}" is mapped by more than one brand/appearance; reverse lookup would be ambiguous`,
      );
      reverse.set(runtimeTheme, Object.freeze({ brand, appearance }) as ThemeSelection<Def>);
      runtimeThemes.push(runtimeTheme as RegistryRuntimeTheme<Def>);
    }
  }

  const frozenBrands = Object.freeze(brands.slice());
  const frozenAppearances = Object.freeze(referenceAppearances.slice());
  const frozenRuntimeThemes = Object.freeze(runtimeThemes.slice());

  function resolve<B extends RegistryBrand<Def>, A extends keyof Def[B] & string>(
    brand: B,
    appearance: A,
  ): Def[B][A] {
    const appearances = definition[brand];
    invariant(appearances !== undefined, `unknown brand "${String(brand)}"`);
    const runtimeTheme = appearances[appearance];
    invariant(
      runtimeTheme !== undefined,
      `unknown appearance "${String(appearance)}" for brand "${String(brand)}"`,
    );
    return runtimeTheme;
  }

  function selectionFor(runtimeTheme: string): ThemeSelection<Def> | undefined {
    return reverse.get(runtimeTheme);
  }

  function isAppearance(runtimeTheme: string, appearance: RegistryAppearance<Def>): boolean {
    return reverse.get(runtimeTheme)?.appearance === appearance;
  }

  return Object.freeze({
    map: definition,
    brands: frozenBrands,
    appearances: frozenAppearances,
    runtimeThemes: frozenRuntimeThemes,
    resolve,
    selectionFor,
    isAppearance,
  });
}
