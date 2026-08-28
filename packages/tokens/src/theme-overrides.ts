// Generic runtime-override compiler for BeeUI theme tokens.
//
// This module is AUTHORED (not generated). It defines the generic
// `createThemeOverridesDefiner()` engine and the `applyThemeOverrides()` apply
// helper. The concrete, codegen-derived category vocabulary (which token
// groups are runtime-overridable, their keys, and their exact Uniwind CSS
// variable names) is instantiated inside the generated `index.ts` as
// `defineThemeOverrides`, the same authored-engine/generated-instantiation
// split already used for `defineThemeRegistry()` (see `registry.ts`) and
// `beeThemeRegistry`.
//
// Design invariants (BeeUI issue #71):
// - Uniwind remains the sole runtime/mutation theme authority. This module
//   never touches `document`, a Uniwind singleton, or any other global state.
// - `createThemeOverridesDefiner()` returns a pure `defineThemeOverrides`
//   function: define/validate/compile only. It holds no mutable state and
//   performs no side effects.
// - `applyThemeOverrides()` is a thin, stateless call-through to a
//   Uniwind-shaped client's `updateCSSVariables`. BeeUI keeps no override
//   store, cache, React context, or provider of its own.
// - Only categories with a real runtime use case and a safe, deterministic
//   Uniwind CSS-variable representation are ever instantiated here. Private
//   authoring primitives and build-time-only/invariant tokens are never
//   reachable through this API — they simply have no category entry.

/**
 * One runtime-overridable token category (e.g. "radius", "motion", "colors").
 *
 * `Value` is fixed per category (currently `number` for dimension/duration
 * categories, `string` for color categories) so unit conversion stays
 * deterministic: a caller can never pass an ambiguous mixed-unit string for a
 * category that expects a plain number.
 */
export interface OverrideCategoryDefinition<Key extends string, Value extends number | string> {
  /** The exact accepted key vocabulary for this category, derived from canonical token metadata. */
  readonly keys: readonly Key[];
  /** Runtime value-kind check. Kept explicit (not inferred from `Value`) so validation errors name the expected kind. */
  readonly valueKind: 'number' | 'string';
  /** Deterministically build the exact Uniwind CSS variable name for a key. */
  readonly variable: (key: Key) => string;
  /** Format a caller-supplied value into the exact CSS variable value string Uniwind expects. */
  readonly format: (value: Value, key: Key) => string;
}

/**
 * A fixed set of override categories, keyed by their public category name
 * (e.g. `colors`, `radius`, `motion`). Bound with `any` type parameters
 * (rather than `string, number | string`) purely so a concrete category map
 * with per-category literal key unions and a single fixed `Value` type-checks
 * against this constraint: TypeScript checks function-typed properties like
 * `variable`/`format` contravariantly, so a `(key: 'xs' | 'sm' | ...) => ...`
 * function is not assignable to `(key: string) => ...` even though it is safe
 * here (every category's `variable`/`format` is only ever called with keys
 * drawn from that same category's own `keys` array). `Categories extends
 * OverrideCategoryMap` still infers the precise, unwidened category shapes at
 * each call site — this loosened bound only avoids a false-positive variance
 * error on the bound itself.
 */
export type OverrideCategoryMap = Readonly<Record<string, OverrideCategoryDefinition<any, any>>>;

/** The exact input shape `defineThemeOverrides` accepts for a fixed `Categories` map. */
export type ThemeOverridesInput<Categories extends OverrideCategoryMap> = {
  [C in keyof Categories]?: Categories[C] extends OverrideCategoryDefinition<infer Key, infer Value>
    ? Partial<Record<Key, Value>>
    : never;
};

/**
 * The result of `defineThemeOverrides()`: a deterministic, exact Uniwind
 * CSS-variable-name -> value map. Frozen; carries no category/key structure
 * because Uniwind's `updateCSSVariables` only ever wants a flat CSS variable
 * record.
 */
export type CompiledThemeOverrides = Readonly<{
  readonly cssVariables: Readonly<Record<string, string>>;
}>;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid theme overrides: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Build a `defineThemeOverrides` function bound to a fixed, codegen-derived
 * set of override categories.
 *
 * Pure and stateless: never touches Uniwind, `document`, or any global.
 * Rejects unknown categories, unknown keys within a known category
 * (including every private authoring primitive and build-time-only token,
 * which are simply absent from `categories`), and wrong-kind values. Accepted
 * input compiles into the exact CSS-variable map Uniwind expects, with
 * variable names sorted for deterministic, reproducible output regardless of
 * the caller's key insertion order.
 */
export function createThemeOverridesDefiner<Categories extends OverrideCategoryMap>(categories: Categories) {
  const categoryNames = Object.keys(categories);

  return function defineThemeOverrides<const T extends ThemeOverridesInput<Categories>>(
    input: T,
  ): CompiledThemeOverrides {
    invariant(isPlainObject(input), 'input must be an object of override categories');

    const cssVariables: Record<string, string> = {};

    for (const categoryName of Object.keys(input)) {
      invariant(
        categoryNames.includes(categoryName),
        `unknown override category "${categoryName}"; supported categories: ${categoryNames.join(', ') || '(none)'}`,
      );
      const category = categories[categoryName];
      const values = (input as Record<string, unknown>)[categoryName];
      if (values === undefined) continue;
      invariant(isPlainObject(values), `override category "${categoryName}" must map keys to values`);

      for (const key of Object.keys(values)) {
        invariant(
          (category.keys as readonly string[]).includes(key),
          `unknown "${categoryName}" override key "${key}"; supported keys: ${category.keys.join(', ')}`,
        );
        const raw = values[key];
        invariant(
          typeof raw === category.valueKind,
          `"${categoryName}.${key}" override value must be a ${category.valueKind} (got ${typeof raw})`,
        );
        if (category.valueKind === 'number') {
          invariant(Number.isFinite(raw as number), `"${categoryName}.${key}" override value must be a finite number`);
        } else {
          invariant((raw as string).length > 0, `"${categoryName}.${key}" override value must be a non-empty string`);
        }
        const variableName = category.variable(key);
        cssVariables[variableName] = category.format(raw as number & string, key);
      }
    }

    // Deterministic key order regardless of caller insertion order or category iteration order.
    const orderedNames = Object.keys(cssVariables).sort();
    const ordered: Record<string, string> = {};
    for (const name of orderedNames) ordered[name] = cssVariables[name];

    return Object.freeze({ cssVariables: Object.freeze(ordered) });
  };
}

/**
 * Structural shape of the subset of Uniwind's API `applyThemeOverrides` needs
 * (`Uniwind.updateCSSVariables` from the `uniwind` package). Declared
 * structurally rather than imported so `@beeui/tokens` never takes a hard
 * dependency on `uniwind` — the same boundary the package already keeps
 * (`packages/tokens` has no `uniwind` dependency; only `packages/ui` and
 * consuming apps do).
 */
export interface UniwindCSSVariableClient<RuntimeThemeName extends string = string> {
  updateCSSVariables(theme: RuntimeThemeName, cssVariables: Record<string, string | number>): void;
}

/**
 * Apply already-compiled overrides to one named Uniwind runtime theme.
 *
 * A thin, stateless call-through: forwards `overrides.cssVariables` to
 * `uniwind.updateCSSVariables(runtimeTheme, ...)` unmodified and returns
 * nothing. BeeUI keeps no override store, cache, or provider of its own —
 * Uniwind remains the sole runtime mutation authority.
 *
 * Uniwind's `updateCSSVariables` is scoped to exactly the one named runtime
 * theme passed in (e.g. `"light"`, `"violet-dark"`); it is not applied
 * globally across every theme, and it is not scoped to a component subtree.
 * Call it once per runtime theme you want the override to affect. Uniwind's
 * `ScopedTheme` component selects which named theme a subtree resolves to —
 * it does not scope variable *values* — so theme-name scoping and variable
 * overrides remain related but distinct capabilities.
 */
export function applyThemeOverrides<RuntimeThemeName extends string>(
  uniwind: UniwindCSSVariableClient<RuntimeThemeName>,
  runtimeTheme: RuntimeThemeName,
  overrides: CompiledThemeOverrides,
): void {
  uniwind.updateCSSVariables(runtimeTheme, overrides.cssVariables);
}
