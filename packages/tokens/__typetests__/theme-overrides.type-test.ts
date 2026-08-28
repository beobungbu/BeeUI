// Compile-time (type-level) tests for the typed runtime-override surface (#71).
//
// This file is type-checked by `tsc -p packages/tokens/tsconfig.json`
// (via `pnpm typecheck`) but never emitted or shipped. It asserts that
// `defineThemeOverrides` accepts exactly the canonical category/key
// vocabulary derived from generated token data, rejects unknown categories,
// unknown keys, and wrong-kind values at compile time, and that
// `defineSemanticColorOverrides` keeps its own independent, unchanged shape.

import {
  applyThemeOverrides,
  defineSemanticColorOverrides,
  defineThemeOverrides,
  type CompiledThemeOverrides,
  type SemanticColorOverrides,
  type ThemeOverrides,
} from '../src/index';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

// The full, valid shape from the issue's proposed API compiles.
const overrides = defineThemeOverrides({
  colors: { primary: '#123456', 'focus-ring': '#654321' },
  radius: { md: 12 },
  motion: { normal: 180 },
});
type _CompiledShape = Expect<Equal<typeof overrides, CompiledThemeOverrides>>;

// A single-category, single-key input compiles too.
defineThemeOverrides({ radius: { xs: 2 } });
defineThemeOverrides({ motion: { fast: 80 } });
defineThemeOverrides({ colors: { primary: '#000000' } });

// An empty override set is valid (compiles to no CSS variables).
defineThemeOverrides({});

// Unknown top-level category is a compile error — the category vocabulary is
// exactly `colors | radius | motion`, never an arbitrary/hand-typed union.
// @ts-expect-error - 'breakpoint' is not a runtime-overridable category.
defineThemeOverrides({ breakpoint: { medium: 900 } });

// @ts-expect-error - 'spacing' was never flagged runtime-overridable.
defineThemeOverrides({ spacing: { '4': 20 } });

// Unknown key within a known category is a compile error.
// @ts-expect-error - 'notAKey' is not a radius scale name.
defineThemeOverrides({ radius: { notAKey: 1 } });

// @ts-expect-error - 'brand' is not a canonical semantic color token.
defineThemeOverrides({ colors: { brand: '#123456' } });

// Wrong value kind is a compile error: radius/motion are numbers (px/ms), never strings.
// @ts-expect-error - radius values are numbers (px), not strings.
defineThemeOverrides({ radius: { md: '12' } });

// @ts-expect-error - motion values are numbers (ms), not strings.
defineThemeOverrides({ motion: { normal: '180' } });

// @ts-expect-error - color values are strings, not numbers.
defineThemeOverrides({ colors: { primary: 123456 } });

// `ThemeOverrides` is the exact public input type `defineThemeOverrides` accepts.
const explicit: ThemeOverrides = { radius: { lg: 20 } };
defineThemeOverrides(explicit);

// `defineSemanticColorOverrides` keeps its own, unrelated (CSS-variable-name-keyed)
// shape — #71 does not change or narrow its existing public contract.
const legacyOverrides = {
  '--color-primary': '#123456',
  '--color-focus-ring': '#654321',
} satisfies SemanticColorOverrides;
const legacy = defineSemanticColorOverrides(legacyOverrides);
type _LegacyShape = Expect<Equal<typeof legacy, Readonly<typeof legacyOverrides>>>;

// applyThemeOverrides is structurally typed against Uniwind's `updateCSSVariables`
// shape — no import of the real `uniwind` package is required.
const fakeUniwind = {
  updateCSSVariables(_theme: 'light' | 'dark', _vars: Record<string, string | number>) {},
};
applyThemeOverrides(fakeUniwind, 'light', overrides);
