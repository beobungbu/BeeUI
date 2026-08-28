// Compile-time (type-level) tests for the extensible theme registry.
//
// This file is type-checked by `tsc -p packages/tokens/tsconfig.json`
// (via `pnpm typecheck`) but never emitted or shipped. It asserts that the
// generic `defineThemeRegistry` infers the brand, appearance, and runtime-theme
// unions from the passed object, that `resolve` returns the exact runtime-theme
// literal, and that invalid brand/appearance access is a compile error.

import {
  beeThemeRegistry,
  defineThemeRegistry,
  type BeeRuntimeThemeName,
  type RegistryAppearance,
  type RegistryBrand,
  type RegistryRuntimeTheme,
  type ThemeSelection,
} from '../src/index';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

// A third brand defined WITHOUT editing BeeUI package source, from the public API.
const acmeRegistry = defineThemeRegistry({
  bee: { light: 'light', dark: 'dark' },
  violet: { light: 'violet-light', dark: 'violet-dark' },
  acme: { light: 'acme-light', dark: 'acme-dark' },
});

type AcmeDef = typeof acmeRegistry.map;

// Inferred brand union comes from the object keys.
type _Brand = Expect<Equal<RegistryBrand<AcmeDef>, 'bee' | 'violet' | 'acme'>>;

// Inferred appearance union comes from the (shared) appearance keys.
type _Appearance = Expect<Equal<RegistryAppearance<AcmeDef>, 'light' | 'dark'>>;

// Inferred runtime-theme union comes from the mapped values.
type _Runtime = Expect<
  Equal<
    RegistryRuntimeTheme<AcmeDef>,
    'light' | 'dark' | 'violet-light' | 'violet-dark' | 'acme-light' | 'acme-dark'
  >
>;

// `resolve` returns the exact runtime-theme literal, not a widened union.
type _ResolveAcmeDark = Expect<Equal<ReturnType<typeof acmeRegistry.resolve<'acme', 'dark'>>, 'acme-dark'>>;
const acmeDark = acmeRegistry.resolve('acme', 'dark');
type _ResolveInferred = Expect<Equal<typeof acmeDark, 'acme-dark'>>;

// `selectionFor` is typed to the inferred brand/appearance unions.
type _Selection = Expect<Equal<ReturnType<typeof acmeRegistry.selectionFor>, ThemeSelection<AcmeDef> | undefined>>;

// Unknown brand is a compile error.
// @ts-expect-error - 'ghost' is not a brand in this registry.
acmeRegistry.resolve('ghost', 'dark');

// Unknown appearance is a compile error.
// @ts-expect-error - 'sepia' is not an appearance in this registry.
acmeRegistry.resolve('acme', 'sepia');

// The default Bee/Violet registry keeps the shipped runtime-theme union.
type _BeeBrand = Expect<Equal<RegistryBrand<typeof beeThemeRegistry.map>, 'bee' | 'violet'>>;
type _BeeRuntime = Expect<Equal<RegistryRuntimeTheme<typeof beeThemeRegistry.map>, BeeRuntimeThemeName>>;

const beeVioletDark = beeThemeRegistry.resolve('violet', 'dark');
type _BeeResolve = Expect<Equal<typeof beeVioletDark, 'violet-dark'>>;

// A single-appearance registry infers a single-appearance union (extensible
// enough for #77 to add appearances later without changing this API).
const minimalRegistry = defineThemeRegistry({ solo: { light: 'solo-light' } });
type _MinimalAppearance = Expect<Equal<RegistryAppearance<typeof minimalRegistry.map>, 'light'>>;
