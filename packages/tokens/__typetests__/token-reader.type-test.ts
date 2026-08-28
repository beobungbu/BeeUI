// Compile-time (type-level) tests for the typed runtime-token-read surface (#72).
//
// This file is type-checked by `tsc -p packages/tokens/tsconfig.json`
// (via `pnpm typecheck`) but never emitted or shipped. It asserts that
// `BeeTokenPath` is exactly the `colors.*` | `radius.*` | `motion.*` union
// derived from generated token data, that `BeeTokenValue<Path>` resolves to
// the correct per-category return type, and that an unknown/private/
// build-time-only path is a compile error rather than a valid `BeeTokenPath`.

import {
  beeTokenReader,
  defineTokenReader,
  type BeeTokenPath,
  type BeeTokenValue,
  type TokenPath,
  type TokenValueForPath,
} from '../src/index';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

// A valid color/radius/motion path from the issue's proposed API compiles and
// is assignable to `BeeTokenPath`.
const colorPath: BeeTokenPath = 'colors.primary';
const radiusPath: BeeTokenPath = 'radius.md';
const motionPath: BeeTokenPath = 'motion.normal';
void colorPath;
void radiusPath;
void motionPath;

// Per-category return types: colors normalize to `string`, radius/motion to `number`.
type _ColorValue = Expect<Equal<BeeTokenValue<'colors.primary'>, string>>;
type _RadiusValue = Expect<Equal<BeeTokenValue<'radius.md'>, number>>;
type _MotionValue = Expect<Equal<BeeTokenValue<'motion.normal'>, number>>;

// `beeTokenReader.resolve` returns the exact category/key/variable/kind for a
// valid path (asserted at the value level below via the runtime test file;
// here only the path type itself is checked).
const resolved = beeTokenReader.resolve(colorPath);
void resolved;

// Unknown path is a compile error — not a hand-maintained union, but exactly
// the generated `colors | radius | motion` category/key vocabulary.
// @ts-expect-error - 'colors.brand' is not a canonical semantic color token.
const _unknownColor: BeeTokenPath = 'colors.brand';
void _unknownColor;

// Private #70 authoring primitives are never reachable as a path at all —
// there is no 'colors.amber-500' to construct.
// @ts-expect-error - 'amber-500' is a private authoring primitive, never a public path.
const _privatePrimitive: BeeTokenPath = 'colors.amber-500';
void _privatePrimitive;

// Build-time-only/invariant token groups are never a category, so their paths
// do not type-check either.
// @ts-expect-error - 'breakpoint' is a build-time-only constant, never a runtime-readable category.
const _breakpointPath: BeeTokenPath = 'breakpoint.medium';
void _breakpointPath;

// @ts-expect-error - 'spacing' is theme-invariant and was never flagged runtime-overridable.
const _spacingPath: BeeTokenPath = 'spacing.4';
void _spacingPath;

// @ts-expect-error - unknown radius key.
const _unknownRadius: BeeTokenPath = 'radius.notAKey';
void _unknownRadius;

// The generic engine infers the same path/value shapes for a consumer-defined
// reader (mirrors `defineThemeRegistry`'s extensibility story for #67).
const customCategories = {
  spacing: {
    kind: 'dimension',
    keys: ['sm', 'lg'] as const,
    variable: (key: 'sm' | 'lg') => `--spacing-${key}`,
  },
} as const;
const customReader = defineTokenReader(customCategories);

type _CustomPath = Expect<Equal<TokenPath<typeof customCategories>, 'spacing.sm' | 'spacing.lg'>>;
type _CustomValue = Expect<Equal<TokenValueForPath<typeof customCategories, 'spacing.sm'>, number>>;

customReader.resolve('spacing.sm');
// @ts-expect-error - 'spacing.md' was not declared in this custom reader's keys.
customReader.resolve('spacing.md');
