import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  dtcgColorToHex,
  generateTokenArtifacts,
  loadCanonicalTokens,
  parseCanonicalJson,
  resolveTokenReferences,
  validateCanonicalTokens,
  validateDtcgDocument,
  validateTokenReferences,
} from '../generate-tokens.mjs';
import {
  validateOfficialDtcg2025_10,
  validateOfficialDtcgFormat,
  validateOfficialDtcgResolver,
  verifyPinnedDtcgSchemaSnapshots,
} from '../validate-dtcg-schemas.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORMAT_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/format.json';
const RESOLVER_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/resolver.json';
const source = loadCanonicalTokens();
const resolvedSource = resolveTokenReferences(source);

function beeMetadata(tokens = source) {
  return tokens.$extensions['com.beeui'];
}

function semanticNames(tokens = source) {
  return Object.keys(beeMetadata(tokens).semanticColorDescriptions);
}

test('committed generated token artifacts are byte-current', () => {
  for (const [relativePath, generated] of generateTokenArtifacts(source)) {
    assert.equal(fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8'), generated, relativePath);
  }
});

test('generation is deterministic and contains no environment-specific data', () => {
  const first = [...generateTokenArtifacts(source)];
  const second = [...generateTokenArtifacts(structuredClone(source))];
  assert.deepEqual(first, second);
  for (const [, content] of first) {
    assert.doesNotMatch(content, /(?:\\|\/)workspace\//);
    assert.doesNotMatch(content, /generatedAt|timestamp/i);
  }
});

test('raw canonical JSON rejects duplicate object keys before JSON overwrite', () => {
  assert.throws(
    () => parseCanonicalJson('{"tokens":{"body":1,"body":2}}', 'duplicate-key-fixture'),
    /duplicate JSON key "body"/,
  );
});

test('raw canonical JSON preserves __proto__ as inert own data', () => {
  const parsed = parseCanonicalJson('{"__proto__":{"polluted":true}}', 'prototype-key-fixture');
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal(Object.hasOwn(parsed, '__proto__'), true);
  assert.equal(parsed.__proto__.polluted, true);
  assert.equal({}.polluted, undefined);
});

test('canonical source conforms to the DTCG 2025.10 format contract BeeUI emits', () => {
  assert.equal(source.$schema, FORMAT_SCHEMA_URL);
  assert.equal(beeMetadata().dtcgVersion, '2025.10');
  assert.doesNotThrow(() => validateDtcgDocument(source));

  assert.deepEqual(source.tokens.motionEasing.standard.$value, [0.2, 0, 0, 1]);
  assert.equal(source.tokens.elevation.$type, 'shadow');
  assert.ok(Array.isArray(source.tokens.elevation.raised.$value));
  assert.equal(Object.hasOwn(source.tokens.focusRing, '$value'), false);
  assert.equal(source.tokens.focusRing.width.$type, 'dimension');
  assert.equal(source.themes.light.colors.$type, 'color');
  // light primary is authored as an alias to a private amber primitive; it
  // resolves to the accepted #65 value.
  assert.equal(Object.hasOwn(source.themes.light.colors.primary, '$ref'), true);
  assert.deepEqual(resolvedSource.themes.light.colors.primary.$value, {
    colorSpace: 'srgb',
    components: [0.960784, 0.619608, 0.043137],
    hex: '#f59e0b',
  });
});

test('DTCG-invalid token names are rejected while the legacy public spacing key stays compatible', () => {
  assert.equal(Object.hasOwn(source.tokens.spacing, '2.5'), false);
  assert.equal(source.tokens.spacing['2-5'].$extensions['com.beeui'].publicName, '2.5');
  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');
  assert.match(index, /"2\.5": 10/);

  const invalid = structuredClone(source);
  invalid.tokens.spacing['bad.name'] = invalid.tokens.spacing['2-5'];
  assert.throws(() => validateDtcgDocument(invalid), /invalid DTCG token\/group name "bad\.name"/);
});

test('one canonical mutation propagates to both TypeScript and CSS outputs', () => {
  const mutated = structuredClone(source);
  mutated.tokens.fontSize.body.$value.value = 17;
  const artifacts = generateTokenArtifacts(mutated);

  assert.match(artifacts.get('packages/tokens/src/index.ts'), /"body": 17/);
  assert.match(artifacts.get('packages/tokens/src/theme.css'), /--text-body: 1\.0625rem;/);
});

test('font-size and line-height roles must stay exactly aligned', () => {
  const missing = structuredClone(source);
  delete missing.tokens.lineHeight.body;
  assert.throws(() => validateCanonicalTokens(missing), /lineHeight roles/);

  const extra = structuredClone(source);
  extra.tokens.lineHeight.extra = { $value: { value: 48, unit: 'px' } };
  assert.throws(() => validateCanonicalTokens(extra), /lineHeight roles/);
});

test('adds composable data-typography semantics without touching the six size roles', () => {
  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');

  // The six size/line-height roles remain byte-identical.
  assert.match(index, /export const fontSize = \{\s*"caption": 12,\s*"label": 14,\s*"body": 16,\s*"heading": 18,\s*"title": 24,\s*"display": 32\s*\} as const;/);
  assert.match(index, /export const lineHeight = \{\s*"caption": 16,\s*"label": 20,\s*"body": 24,\s*"heading": 24,\s*"title": 32,\s*"display": 40\s*\} as const;/);
  assert.doesNotMatch(index, /"tabular": 1[0-9]/); // never a size role

  // Mono family is composed onto the existing family group, not a new size scale.
  assert.match(index, /export const fontFamily = \{[\s\S]*"sans": "system"[\s\S]*"mono": \[[\s\S]*"monospace"[\s\S]*\]\s*\} as const;/);
  assert.match(index, /export const monoFontFamily = \{[\s\S]*"webUtilityClass": "font-mono"[\s\S]*"native": \{[\s\S]*"ios": "Menlo"[\s\S]*"android": "monospace"[\s\S]*"default": "monospace"/);
  assert.match(index, /export const numericVariants = \{[\s\S]*"tabular": \{[\s\S]*"webUtilityClass": "bee-tabular-nums"[\s\S]*"nativeFontVariant": \[\s*"tabular-nums"/);
  assert.match(index, /export type NumericVariant = keyof typeof numericVariants;/);

  // Web utilities/variables are generated, not hand-authored.
  assert.match(css, /--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;/);
  assert.match(css, /@utility bee-tabular-nums \{\n {2}font-variant-numeric: tabular-nums;\n\}/);
});

test('rejects data-typography metadata regressions', () => {
  const noMono = structuredClone(source);
  delete noMono.tokens.fontFamily.mono;
  assert.throws(() => validateCanonicalTokens(noMono), /fontFamily\.mono/);

  const openMono = structuredClone(source);
  openMono.tokens.fontFamily.mono.$value = ['Menlo'];
  assert.throws(() => validateCanonicalTokens(openMono), /generic monospace fallback/);

  const noNative = structuredClone(source);
  delete noNative.$extensions['com.beeui'].monoFontFamilyNative.android;
  assert.throws(() => validateCanonicalTokens(noNative), /monoFontFamilyNative\.android/);

  const noFeatures = structuredClone(source);
  noFeatures.$extensions['com.beeui'].numericVariants = {};
  assert.throws(() => validateCanonicalTokens(noFeatures), /numericVariants must declare at least one/);

  const brokenFeature = structuredClone(source);
  brokenFeature.$extensions['com.beeui'].numericVariants.tabular.nativeFontVariant = [];
  assert.throws(() => validateCanonicalTokens(brokenFeature), /nativeFontVariant must be a non-empty/);
});

test('every runtime theme implements the exact unique semantic vocabulary', () => {
  const expected = semanticNames();
  assert.equal(new Set(expected).size, expected.length);
  for (const name of beeMetadata().runtimeThemeNames) {
    const actual = Object.keys(source.themes[name].colors).filter((key) => !key.startsWith('$'));
    assert.equal(new Set(actual).size, actual.length);
    assert.deepEqual([...actual].sort(), [...expected].sort(), name);
  }
});

test('the accepted #65, #66, and brand mapping values remain canonical', () => {
  assert.deepEqual(beeMetadata().runtimeThemeByBrand, {
    bee: { light: 'light', dark: 'dark' },
    violet: { light: 'violet-light', dark: 'violet-dark' },
  });
  // Values are asserted after alias resolution so #65 filled-action states stay
  // exactly equal whether authored as literals or as primitive aliases.
  assert.equal(dtcgColorToHex(resolvedSource.themes.light.colors['primary-hover'].$value), '#e58a05');
  assert.equal(dtcgColorToHex(resolvedSource.themes.light.colors['primary-pressed'].$value), '#d97706');
  assert.equal(dtcgColorToHex(resolvedSource.themes['violet-dark'].colors['primary-pressed'].$value), '#9066f4');
  // #66 control-border is authored as an explicit literal in every runtime theme
  // (never aliased) and keeps its accepted boundary values.
  for (const theme of beeMetadata().runtimeThemeNames) {
    assert.equal(Object.hasOwn(source.themes[theme].colors['control-border'], '$value'), true);
  }
  assert.deepEqual(
    beeMetadata().runtimeThemeNames.map((theme) =>
      dtcgColorToHex(source.themes[theme].colors['control-border'].$value),
    ),
    ['#8590a2', '#667085', '#9488a4', '#786d87'],
  );
});

test('letter-spacing px and CSS em representations are intentionally equivalent at 16px', () => {
  const canonicalPx = source.tokens.letterSpacing.tight.$value.value;
  const referencePx = beeMetadata().cssPixelReference;
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');
  const cssEm = Number(css.match(/--tracking-tight:\s*(-?[0-9.]+)em;/)?.[1]);

  assert.equal(cssEm * referencePx, canonicalPx);
  assert.equal(cssEm, -0.0125);
});

test('invalid theme vocabulary cannot generate partial runtime output', () => {
  const invalid = structuredClone(source);
  delete invalid.themes.dark.colors['control-border'];
  assert.throws(() => validateCanonicalTokens(invalid), /dark semantic colors/);
});

test('semantic layer contract encodes the exact evidence-based z-order vocabulary', () => {
  const names = Object.keys(source.tokens.layer).filter((key) => !key.startsWith('$'));
  assert.deepEqual(names, ['base', 'overlay', 'toast']);
  const values = names.map((name) => source.tokens.layer[name].$value);
  assert.deepEqual(values, [0, 100, 1000]);
});

test('semantic layer values are emitted to TypeScript, CSS variables, and z-index utilities', () => {
  const artifacts = generateTokenArtifacts(source);
  const index = artifacts.get('packages/tokens/src/index.ts');
  const css = artifacts.get('packages/tokens/src/theme.css');

  assert.match(index, /export const layer = \{\n {2}"base": 0,\n {2}"overlay": 100,\n {2}"toast": 1000\n\} as const;/);
  assert.match(index, /export type LayerName = keyof typeof layer;/);
  assert.match(index, /export function layerVariable\(name: LayerName\): LayerVariableName/);

  for (const [name, value] of [
    ['base', 0],
    ['overlay', 100],
    ['toast', 1000],
  ]) {
    assert.match(css, new RegExp(`--layer-${name}: ${value};`));
    assert.match(css, new RegExp(`@utility bee-layer-${name} \\{\\n {2}z-index: var\\(--layer-${name}\\);\\n\\}`));
  }
});

test('a canonical layer mutation propagates to both TypeScript and CSS outputs', () => {
  const mutated = structuredClone(source);
  mutated.tokens.layer.toast.$value = 1200;
  const artifacts = generateTokenArtifacts(mutated);

  assert.match(artifacts.get('packages/tokens/src/index.ts'), /"toast": 1200/);
  assert.match(artifacts.get('packages/tokens/src/theme.css'), /--layer-toast: 1200;/);
});

test('layer roles must be a strictly ascending, unique, base-zero integer scale', () => {
  const nonZeroBase = structuredClone(source);
  nonZeroBase.tokens.layer.base.$value = 10;
  assert.throws(() => validateCanonicalTokens(nonZeroBase), /layer\.base must equal 0/);

  const notAscending = structuredClone(source);
  notAscending.tokens.layer.toast.$value = 50;
  assert.throws(() => validateCanonicalTokens(notAscending), /strictly ascend/);

  const duplicate = structuredClone(source);
  duplicate.tokens.layer.toast.$value = 100;
  assert.throws(() => validateCanonicalTokens(duplicate), /strictly ascend/);

  const fractional = structuredClone(source);
  fractional.tokens.layer.overlay.$value = 10.5;
  assert.throws(() => validateCanonicalTokens(fractional), /non-negative integer/);

  const missingBase = structuredClone(source);
  delete missingBase.tokens.layer.base;
  assert.throws(() => validateCanonicalTokens(missingBase), /layer must declare "base"/);
});

test('DTCG value-shape regressions are rejected', () => {
  const easing = structuredClone(source);
  easing.tokens.motionEasing.standard.$value = 'cubic-bezier(0.2, 0, 0, 1)';
  assert.throws(() => validateDtcgDocument(easing), /array of four finite numbers/);

  const color = structuredClone(source);
  // foreground is authored as a direct semantic literal (no alias), so it still
  // exercises the color-object shape guard.
  assert.equal(Object.hasOwn(color.themes.light.colors.foreground, '$value'), true);
  color.themes.light.colors.foreground.$value = '#101828';
  assert.throws(() => validateDtcgDocument(color), /DTCG color object/);

  const shadow = structuredClone(source);
  shadow.tokens.elevation.raised.$value = { web: '0 1px 3px #000', nativeElevation: 2 };
  assert.throws(() => validateDtcgDocument(shadow), /DTCG color object/);
});

test('canonical distributable token artifact remains DTCG-conformant', () => {
  assert.equal(source.$schema, FORMAT_SCHEMA_URL);
  assert.doesNotThrow(() => validateDtcgDocument(source));
});

test('vendored official DTCG 2025.10 schemas are byte-pinned', () => {
  assert.doesNotThrow(() => verifyPinnedDtcgSchemaSnapshots());
});

test('canonical tokens and generated resolver pass the official DTCG 2025.10 schemas offline', async () => {
  const resolver = JSON.parse(
    generateTokenArtifacts(source).get('packages/tokens/src/tokens.resolver.json'),
  );
  await assert.doesNotReject(() =>
    validateOfficialDtcg2025_10({ canonical: source, resolver }),
  );
});

test('official schema validation rejects format and resolver regressions independently of BeeUI policy checks', async () => {
  const invalidFormat = structuredClone(source);
  invalidFormat.tokens.spacing['bad.name'] = invalidFormat.tokens.spacing['2-5'];
  await assert.rejects(() => validateOfficialDtcgFormat(invalidFormat), /does not validate/);

  const invalidResolver = JSON.parse(
    generateTokenArtifacts(source).get('packages/tokens/src/tokens.resolver.json'),
  );
  invalidResolver.version = '2025.11';
  await assert.rejects(() => validateOfficialDtcgResolver(invalidResolver), /does not validate/);
});

test('semantic motion exposes exactly the approved recurring-transition vocabulary', () => {
  const intents = Object.keys(beeMetadata().semanticMotion);
  assert.deepEqual(intents, ['overlay-enter', 'overlay-exit', 'sheet-enter', 'sheet-exit', 'disclosure']);
  assert.equal(new Set(intents).size, intents.length);

  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');
  assert.match(
    index,
    /export const motionIntents = \[\n\s*"overlay-enter",\n\s*"overlay-exit",\n\s*"sheet-enter",\n\s*"sheet-exit",\n\s*"disclosure"\n\] as const;/,
  );
});

test('every motion intent declares web, native, and a reduced-motion policy from the supported set', () => {
  const policies = new Set(['immediate', 'opacity-or-state', 'shorten', 'remove-spatial']);
  const durations = new Set(Object.keys(source.tokens.motionDuration).filter((key) => !key.startsWith('$')));
  const easings = new Set(Object.keys(source.tokens.motionEasing).filter((key) => !key.startsWith('$')));

  for (const [name, spec] of Object.entries(beeMetadata().semanticMotion)) {
    assert.ok(policies.has(spec.reducedMotion), `${name} reduced-motion policy`);
    assert.ok(durations.has(spec.web.durationToken), `${name} web duration token`);
    assert.ok(easings.has(spec.web.easingToken), `${name} web easing token`);
    assert.ok(Array.isArray(spec.web.properties) && spec.web.properties.length > 0, `${name} web properties`);
    assert.ok(spec.native.type === 'spring' || spec.native.type === 'timing', `${name} native type`);
    if (spec.native.type === 'spring') {
      for (const parameter of ['stiffness', 'damping', 'mass']) {
        assert.ok(Number.isFinite(spec.native[parameter]) && spec.native[parameter] > 0, `${name} spring ${parameter}`);
      }
    } else {
      assert.ok(durations.has(spec.native.durationToken), `${name} native duration token`);
      assert.ok(easings.has(spec.native.easingToken), `${name} native easing token`);
    }
  }
});

test('generated motion object resolves web timing and native spring/timing representations', () => {
  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');

  // Web representation derives from the shared duration/easing tokens.
  assert.match(index, /"overlay-enter": \{\s*"web": \{\s*"durationMs": 200,\s*"easing": "cubic-bezier\(0\.2, 0, 0, 1\)"/);
  // Native spring keeps raw physics as an implementation detail behind the semantic name.
  assert.match(index, /"native": \{\s*"type": "spring",\s*"stiffness": 260,\s*"damping": 26,\s*"mass": 1\s*\}/);
  // Native timing keeps the DTCG cubic-bezier array (distinct from the web string form).
  assert.match(index, /"overlay-exit":[\s\S]*?"native": \{\s*"type": "timing",\s*"durationMs": 120,\s*"easing": \[\s*0\.2,\s*0,\s*0,\s*1\s*\]/);
});

test('theme.css exposes motion variables and a reduced-motion override for immediate/shorten intents', () => {
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');

  for (const intent of ['overlay-enter', 'overlay-exit', 'sheet-enter', 'sheet-exit', 'disclosure']) {
    assert.ok(css.includes(`--motion-${intent}-duration:`), `${intent} duration var`);
    assert.ok(css.includes(`--motion-${intent}-easing:`), `${intent} easing var`);
  }

  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  :root \{/);
  // Exit and disclosure declare `immediate`, so their duration collapses under reduced motion.
  assert.match(css, /--motion-overlay-exit-duration: 0\.01ms;/);
  assert.match(css, /--motion-sheet-exit-duration: 0\.01ms;/);
  assert.match(css, /--motion-disclosure-duration: 0\.01ms;/);
  // Enter declares `opacity-or-state`, so its (opacity) timing is preserved, not collapsed.
  const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.doesNotMatch(reducedBlock, /--motion-overlay-enter-duration:/);
  assert.doesNotMatch(reducedBlock, /--motion-sheet-enter-duration:/);
});

test('theme.css exposes a per-intent spatial flag that flips under reduced motion by canonical policy', () => {
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');
  const reducedIndex = css.indexOf('@media (prefers-reduced-motion: reduce)');
  const baseBlock = css.slice(0, reducedIndex);
  const reducedBlock = css.slice(reducedIndex);

  // Single source: the CSS flag under reduced motion must equal the policy-derived spatial value.
  const spatialDropping = new Set(['immediate', 'opacity-or-state', 'remove-spatial']);
  for (const [name, spec] of Object.entries(beeMetadata().semanticMotion)) {
    const spatialByDefault = spec.web.properties.some((property) => property === 'transform' || property === 'height');
    const expectedBase = spatialByDefault ? 1 : 0;
    const expectedReduced = spec.reducedMotion === 'shorten' ? expectedBase : 0;

    assert.ok(baseBlock.includes(`--motion-${name}-spatial: ${expectedBase};`), `${name} base spatial flag`);

    if (expectedReduced !== expectedBase) {
      assert.ok(reducedBlock.includes(`--motion-${name}-spatial: ${expectedReduced};`), `${name} reduced spatial flag`);
    } else {
      assert.ok(!reducedBlock.includes(`--motion-${name}-spatial:`), `${name} keeps spatial under reduced motion`);
    }

    // Cross-check the derivation is policy-driven, not hardcoded per intent.
    assert.equal(expectedReduced === 0, spatialDropping.has(spec.reducedMotion) || !spatialByDefault, `${name} policy drives spatial drop`);
  }
});

test('legacy motion duration and easing exports remain byte-compatible', () => {
  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');
  assert.match(index, /export const motionDuration = \{\n\s*"fast": 120,\n\s*"normal": 200,\n\s*"slow": 320\n\} as const;/);
  assert.match(index, /export const motionEasing = \{\n\s*"standard": "cubic-bezier\(0\.2, 0, 0, 1\)",\n\s*"emphasized": "cubic-bezier\(0\.2, 0, 0, 1\.2\)"\n\} as const;/);

  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');
  for (const variable of ['--motion-duration-fast: 120ms;', '--motion-duration-normal: 200ms;', '--motion-duration-slow: 320ms;']) {
    assert.ok(css.includes(variable), variable);
  }
});

test('canonical motion validation rejects dangling or unsafe platform config', () => {
  const unknownDuration = structuredClone(source);
  unknownDuration.$extensions['com.beeui'].semanticMotion['overlay-enter'].web.durationToken = 'nope';
  assert.throws(() => validateCanonicalTokens(unknownDuration), /web\.durationToken references unknown duration nope/);

  const badPolicy = structuredClone(source);
  badPolicy.$extensions['com.beeui'].semanticMotion.disclosure.reducedMotion = 'fade-please';
  assert.throws(() => validateCanonicalTokens(badPolicy), /reducedMotion must be one of/);

  const unstableSpring = structuredClone(source);
  unstableSpring.$extensions['com.beeui'].semanticMotion['overlay-enter'].native.stiffness = 0;
  assert.throws(() => validateCanonicalTokens(unstableSpring), /native\.stiffness must be a positive finite number/);

  const danglingTiming = structuredClone(source);
  danglingTiming.$extensions['com.beeui'].semanticMotion['overlay-exit'].native.easingToken = 'ghost';
  assert.throws(() => validateCanonicalTokens(danglingTiming), /native\.easingToken references unknown easing ghost/);

  const empty = structuredClone(source);
  empty.$extensions['com.beeui'].semanticMotion = {};
  assert.throws(() => validateCanonicalTokens(empty), /semanticMotion must define at least one intent/);
});

test('a motion metadata change propagates deterministically to generated outputs', () => {
  const mutated = structuredClone(source);
  mutated.$extensions['com.beeui'].semanticMotion.disclosure.web.durationToken = 'slow';
  const artifacts = generateTokenArtifacts(mutated);
  assert.match(artifacts.get('packages/tokens/src/index.ts'), /"disclosure":[\s\S]*?"durationMs": 320/);
  assert.ok(artifacts.get('packages/tokens/src/theme.css').includes('--motion-disclosure-duration: 320ms;'));
});

test('generated resolver is a DTCG 2025.10 resolver document for every runtime theme, including accessibility variants', () => {
  const resolver = JSON.parse(
    generateTokenArtifacts(source).get('packages/tokens/src/tokens.resolver.json'),
  );
  const allRuntimeThemes = [
    ...beeMetadata().runtimeThemeNames,
    ...beeMetadata().accessibilityRuntimeThemeNames,
  ];
  assert.equal(resolver.$schema, RESOLVER_SCHEMA_URL);
  assert.equal(resolver.version, '2025.10');
  assert.deepEqual(Object.keys(resolver.modifiers.runtimeTheme.contexts), allRuntimeThemes);
  assert.equal(resolver.modifiers.runtimeTheme.default, 'light');
  assert.deepEqual(resolver.sets.foundation.sources, [
    { $ref: '../tokens.json#/tokens' },
  ]);
  for (const theme of allRuntimeThemes) {
    // #78 — the chart (data-visualization) color group sits beside `colors` under every
    // runtime theme, so the resolver context references both.
    assert.deepEqual(resolver.modifiers.runtimeTheme.contexts[theme], [
      { $ref: `../tokens.json#/themes/${theme}/colors` },
      { $ref: `../tokens.json#/themes/${theme}/chart` },
    ]);
  }
  assert.deepEqual(resolver.resolutionOrder, [
    { $ref: '#/sets/foundation' },
    { $ref: '#/modifiers/runtimeTheme' },
  ]);
  assert.deepEqual(
    resolver.modifiers.runtimeTheme.$extensions['com.beeui'].accessibilityRuntimeThemeByBrand,
    beeMetadata().accessibilityRuntimeThemeByBrand,
  );
});

// --- #70 private authoring primitive -> semantic alias hierarchy -------------

function colorValue(hex) {
  const components = hex
    .slice(1)
    .match(/.{2}/g)
    .map((part) => Number((Number.parseInt(part, 16) / 255).toFixed(6)));
  return { colorSpace: 'srgb', components, hex };
}

test('private authoring primitives are classified with single machine-readable metadata', () => {
  assert.deepEqual(beeMetadata().privateTokenGroups, ['primitives']);
  assert.equal(source.primitives.$extensions['com.beeui'].visibility, 'private');
  assert.equal(source.primitives.$type, 'color');
  // Every leaf primitive is a concrete authored value (no dangling private layer).
  for (const [family, group] of Object.entries(source.primitives)) {
    if (family.startsWith('$')) continue;
    for (const [leaf, token] of Object.entries(group)) {
      if (leaf.startsWith('$')) continue;
      assert.equal(Object.hasOwn(token, '$value'), true, `${family}.${leaf}`);
    }
  }
});

test('semantic tokens alias private primitives and resolve to identical values', () => {
  // destructive is brand-independent and aliases the shared danger primitive in
  // both Bee and Violet light themes.
  assert.equal(source.themes.light.colors.destructive.$ref, '#/primitives/danger/default');
  assert.equal(source.themes['violet-light'].colors.destructive.$ref, '#/primitives/danger/default');
  assert.equal(Object.hasOwn(source.themes.light.colors.destructive, '$value'), false);
  assert.equal(dtcgColorToHex(resolvedSource.themes.light.colors.destructive.$value), '#dc2626');
  assert.equal(dtcgColorToHex(resolvedSource.themes['violet-light'].colors.destructive.$value), '#dc2626');
});

test('direct semantic literals remain allowed where an alias adds no reuse', () => {
  assert.equal(Object.hasOwn(source.themes.light.colors.foreground, '$value'), true);
  assert.equal(Object.hasOwn(source.themes.dark.colors.surface, '$value'), true);
  assert.equal(Object.hasOwn(source.themes['violet-dark'].colors['control-border'], '$value'), true);
});

test('generated CSS carries resolved runtime values, never unresolved private references', () => {
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');
  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');
  for (const artifact of [css, index]) {
    assert.doesNotMatch(artifact, /#\/primitives/);
    assert.doesNotMatch(artifact, /\$ref/);
    assert.doesNotMatch(artifact, /\bprimitives\b/);
  }
  assert.match(css, /--color-destructive: #dc2626;/);
});

test('one primitive change propagates to every semantic token that aliases it', () => {
  const mutated = structuredClone(source);
  mutated.primitives.danger.default.$value = colorValue('#123456');
  const css = generateTokenArtifacts(mutated).get('packages/tokens/src/theme.css');
  const lightDestructive = css.match(/@variant light \{([\s\S]*?)\n {4}\}/)[1];
  const violetLightDestructive = css.match(/@variant violet-light \{([\s\S]*?)\n {4}\}/)[1];
  assert.match(lightDestructive, /--color-destructive: #123456;/);
  assert.match(violetLightDestructive, /--color-destructive: #123456;/);
  // A destructive state that aliases a different primitive is unaffected.
  assert.match(lightDestructive, /--color-destructive-hover: #b91c1c;/);
});

test('dangling references are rejected deterministically', () => {
  const invalid = structuredClone(source);
  invalid.themes.light.colors.foreground = { $ref: '#/primitives/danger/does-not-exist' };
  assert.throws(() => generateTokenArtifacts(invalid), /missing node/);
  assert.throws(() => validateTokenReferences(invalid), /missing node/);
});

test('reference cycles, including multi-node cycles, are rejected', () => {
  const invalid = structuredClone(source);
  invalid.primitives.cycle = {
    $type: 'color',
    a: { $ref: '#/primitives/cycle/b' },
    b: { $ref: '#/primitives/cycle/c' },
    c: { $ref: '#/primitives/cycle/a' },
  };
  invalid.themes.light.colors.foreground = { $ref: '#/primitives/cycle/a' };
  assert.throws(() => generateTokenArtifacts(invalid), /reference cycle/);
});

test('cross-category references between token types are rejected', () => {
  const invalid = structuredClone(source);
  invalid.primitives.measure = {
    $type: 'dimension',
    gap: { $value: { value: 4, unit: 'px' } },
  };
  invalid.themes.light.colors.foreground = { $ref: '#/primitives/measure/gap' };
  assert.throws(() => generateTokenArtifacts(invalid), /invalid cross-category reference/);
});

test('semantic tokens may only alias the private authoring layer', () => {
  const invalid = structuredClone(source);
  invalid.themes.light.colors.foreground = { $ref: '#/themes/light/colors/background' };
  assert.throws(() => generateTokenArtifacts(invalid), /private authoring primitive/);
});

test('reusable @beemvp/beeui-ui components do not consume private primitive identifiers', () => {
  const uiSrc = path.join(ROOT_DIR, 'packages/ui/src');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(t|j)sx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(uiSrc);
  assert.ok(files.length > 0, 'expected @beemvp/beeui-ui component sources to scan');

  const families = Object.keys(source.primitives).filter((name) => !name.startsWith('$'));
  const identifiers = [];
  for (const family of families) {
    identifiers.push(family);
    for (const leaf of Object.keys(source.primitives[family])) {
      if (leaf.startsWith('$')) continue;
      identifiers.push(`${family}-${leaf}`);
    }
  }
  // Match a private identifier only when it is consumed as a styling token:
  // a Tailwind color utility, a CSS custom property, or a primitives pointer.
  const utility =
    '(?:bg|text|border|ring|fill|stroke|outline|shadow|from|via|to|divide|accent|caret|decoration|placeholder)';
  const patterns = identifiers.flatMap((id) => [
    new RegExp(`\\b${utility}-${id}\\b`),
    new RegExp(`--color-${id}\\b`),
  ]);
  patterns.push(/#\/primitives\//, /\bprimitives\.[a-z]/);

  const violations = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(text)) violations.push(`${path.relative(ROOT_DIR, file)} :: ${pattern}`);
    }
  }
  assert.deepEqual(violations, [], `components must stay semantic-only:\n${violations.join('\n')}`);
});

test('multi-hop aliasing resolves deterministically to the base value', () => {
  const chained = structuredClone(source);
  chained.primitives.chain = {
    $type: 'color',
    base: { $value: colorValue('#0a0b0c') },
    mid: { $ref: '#/primitives/chain/base' },
    leaf: { $ref: '#/primitives/chain/mid' },
  };
  chained.themes.light.colors.foreground = { $ref: '#/primitives/chain/leaf' };
  const resolved = resolveTokenReferences(chained);
  assert.equal(dtcgColorToHex(resolved.themes.light.colors.foreground.$value), '#0a0b0c');
  const css = generateTokenArtifacts(chained).get('packages/tokens/src/theme.css');
  assert.match(css, /--color-foreground: #0a0b0c;/);
});

// --- #77 accessibility (high-contrast) theme path & contrast contract --------

function contrastRatioOf(hexA, hexB) {
  function luminance(hex) {
    const channels = hex
      .slice(1, 7)
      .match(/.{2}/g)
      .map((part) => Number.parseInt(part, 16) / 255);
    const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  const [lighter, darker] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('accessibility runtime themes are registered as a second, opt-in registry layer, not a primary-brand slot', () => {
  const meta = beeMetadata();
  // The primary brand/appearance registry (bee + violet) is untouched: adding an
  // accessibility variant never forces every brand to define one.
  assert.deepEqual(meta.brandNames, ['bee', 'violet']);
  assert.deepEqual(meta.runtimeThemeNames, ['light', 'dark', 'violet-light', 'violet-dark']);
  assert.deepEqual(meta.runtimeThemeByBrand, {
    bee: { light: 'light', dark: 'dark' },
    violet: { light: 'violet-light', dark: 'violet-dark' },
  });

  // The accessibility axis currently opts in only `bee`, per #77's required scope
  // (Bee high-contrast light/dark first; no automatic Violet symmetry).
  assert.deepEqual(meta.accessibilityBrandNames, ['bee']);
  assert.deepEqual(meta.accessibilityRuntimeThemeNames, ['high-contrast-light', 'high-contrast-dark']);
  assert.deepEqual(meta.accessibilityRuntimeThemeByBrand, {
    bee: { light: 'high-contrast-light', dark: 'high-contrast-dark' },
  });

  // Runtime-theme names are one flat Uniwind namespace: no collisions across axes.
  const combined = [...meta.runtimeThemeNames, ...meta.accessibilityRuntimeThemeNames];
  assert.equal(new Set(combined).size, combined.length);
});

test('every accessibility runtime theme implements the exact unique semantic vocabulary', () => {
  const expected = semanticNames();
  for (const name of beeMetadata().accessibilityRuntimeThemeNames) {
    const actual = Object.keys(source.themes[name].colors).filter((key) => !key.startsWith('$'));
    assert.equal(new Set(actual).size, actual.length);
    assert.deepEqual([...actual].sort(), [...expected].sort(), name);
  }
});

test('theme.css registers a custom variant and complete color block for every accessibility runtime theme', () => {
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');
  for (const theme of beeMetadata().accessibilityRuntimeThemeNames) {
    assert.match(css, new RegExp(`@custom-variant ${theme} \\(&:where\\(\\.${theme}, \\.${theme} \\*\\)\\);`));
    assert.match(css, new RegExp(`@variant ${theme} \\{`));
  }
  // Custom-variant registration precedes its @variant block, matching every other
  // custom (non-built-in) theme (#67).
  assert.ok(
    css.indexOf('@custom-variant high-contrast-light') < css.indexOf('@variant high-contrast-light {'),
  );
});

test('index.ts exposes a second registry built from the same defineThemeRegistry primitive, scoped to opted-in brands', () => {
  const index = generateTokenArtifacts(source).get('packages/tokens/src/index.ts');
  assert.match(index, /export const beeAccessibilityBrandNames = \[\s*"bee"\s*\] as const/);
  assert.match(
    index,
    /export const beeAccessibilityThemeRegistry = defineThemeRegistry\(beeAccessibilityRuntimeThemeByBrand\);/,
  );
  assert.match(index, /export function resolveBeeAccessibilityRuntimeTheme\(/);
  assert.match(index, /export function getBeeAccessibilityThemeSelection\(/);
});

test('rejects an accessibility brand that is not a declared brand', () => {
  const invalid = structuredClone(source);
  invalid.$extensions['com.beeui'].accessibilityBrandNames = ['bee', 'acme'];
  assert.throws(() => validateCanonicalTokens(invalid), /accessibilityBrandNames must be a subset of brandNames/);
});

test('rejects an accessibility runtime theme name that collides with the primary registry', () => {
  const invalid = structuredClone(source);
  // Adding a colliding name alongside the two real ones keeps the by-brand mapping
  // itself valid, so this mutation exercises only the collision invariant.
  invalid.$extensions['com.beeui'].accessibilityRuntimeThemeNames = [
    'high-contrast-light',
    'high-contrast-dark',
    'dark',
  ];
  assert.throws(
    () => validateCanonicalTokens(invalid),
    /accessibilityRuntimeThemeNames must not collide with runtimeThemeNames/,
  );
});

test('rejects an accessibility brand mapping missing an appearance', () => {
  const invalid = structuredClone(source);
  delete invalid.$extensions['com.beeui'].accessibilityRuntimeThemeByBrand.bee.dark;
  assert.throws(() => validateCanonicalTokens(invalid), /accessibility "bee" appearance mapping/);
});

test('rejects incomplete accessibility runtime theme color contracts', () => {
  const invalid = structuredClone(source);
  delete invalid.themes['high-contrast-dark'].colors['control-border'];
  assert.throws(() => validateCanonicalTokens(invalid), /high-contrast-dark semantic colors/);
});

// --- contrastContract: structural coverage ------------------------------------

test('contrastContract covers every semantic color token exactly once as a canvas, a required relationship, or a documented exception', () => {
  const contract = beeMetadata().contrastContract;
  const semantics = new Set(semanticNames());
  const covered = new Set(contract.canvasTokens);
  const addRole = (value) => covered.add(value);
  for (const entry of contract.textPairs) {
    addRole(entry.foreground);
    entry.backgrounds.forEach(addRole);
  }
  for (const entry of contract.filledActionPairs) {
    addRole(entry.foreground);
    entry.backgrounds.forEach(addRole);
  }
  for (const entry of contract.feedbackFillPairs) {
    addRole(entry.fill);
    addRole(entry.foreground);
  }
  for (const entry of [...contract.controlBoundaryPairs, ...contract.focusRingPairs, ...contract.invalidBoundaryPairs, ...contract.accessibilityOnlyPairs]) {
    addRole(entry.boundary);
    entry.adjacent.forEach(addRole);
  }
  for (const entry of contract.essentialIndicatorPairs) {
    addRole(entry.indicator);
    entry.adjacent.forEach(addRole);
  }
  for (const entry of contract.exceptions) addRole(entry.token);

  assert.deepEqual([...semantics].filter((token) => !covered.has(token)), []);
  // Every referenced token is a real semantic color token (no typos slip through).
  for (const token of covered) assert.ok(semantics.has(token), `unknown token referenced: ${token}`);
});

test('rejects contrastContract metadata that leaves a semantic token uncovered', () => {
  const invalid = structuredClone(source);
  invalid.$extensions['com.beeui'].contrastContract.exceptions =
    invalid.$extensions['com.beeui'].contrastContract.exceptions.filter((entry) => entry.token !== 'overlay');
  assert.throws(() => validateCanonicalTokens(invalid), /contrastContract does not cover every semantic color token/);
});

test('rejects a contrastContract relationship that references an unknown token', () => {
  const invalid = structuredClone(source);
  invalid.$extensions['com.beeui'].contrastContract.textPairs.push({
    foreground: 'not-a-real-token',
    backgrounds: ['background'],
    minRatio: 4.5,
    usage: 'fixture',
  });
  assert.throws(() => validateCanonicalTokens(invalid), /must reference a known semantic color token/);
});

test('rejects an undocumented contrastContract exception', () => {
  const invalid = structuredClone(source);
  invalid.$extensions['com.beeui'].contrastContract.exceptions[0].reason = '';
  assert.throws(() => validateCanonicalTokens(invalid), /must document why the token is excepted/);
});

// --- contrastContract: substance (real contrast math against resolved colors) --

test('contrastContract relationships hold for every runtime theme, primary and accessibility alike', () => {
  const contract = beeMetadata().contrastContract;
  const allThemes = [...beeMetadata().runtimeThemeNames, ...beeMetadata().accessibilityRuntimeThemeNames];
  const hex = (theme, token) => dtcgColorToHex(resolvedSource.themes[theme].colors[token].$value);

  for (const theme of allThemes) {
    for (const entry of contract.textPairs) {
      for (const bg of entry.backgrounds) {
        assert.ok(
          contrastRatioOf(hex(theme, entry.foreground), hex(theme, bg)) >= entry.minRatio,
          `${theme}: ${entry.foreground} vs ${bg} below ${entry.minRatio}:1`,
        );
      }
    }
    for (const entry of contract.filledActionPairs) {
      for (const bg of entry.backgrounds) {
        assert.ok(contrastRatioOf(hex(theme, entry.foreground), hex(theme, bg)) >= entry.minRatio);
      }
    }
    for (const entry of contract.feedbackFillPairs) {
      assert.ok(contrastRatioOf(hex(theme, entry.fill), hex(theme, entry.foreground)) >= entry.minRatio);
    }
    for (const entry of [...contract.controlBoundaryPairs, ...contract.focusRingPairs, ...contract.invalidBoundaryPairs]) {
      for (const adjacent of entry.adjacent) {
        assert.ok(contrastRatioOf(hex(theme, entry.boundary), hex(theme, adjacent)) >= entry.minRatio);
      }
    }
    for (const entry of contract.essentialIndicatorPairs) {
      for (const adjacent of entry.adjacent) {
        assert.ok(contrastRatioOf(hex(theme, entry.indicator), hex(theme, adjacent)) >= entry.minRatio);
      }
    }
  }
});

test('accessibilityOnlyPairs and the AAA text minimum are certified for high-contrast themes but not asserted (and are not all true) for default themes', () => {
  const contract = beeMetadata().contrastContract;
  const hex = (theme, token) => dtcgColorToHex(resolvedSource.themes[theme].colors[token].$value);

  for (const theme of beeMetadata().accessibilityRuntimeThemeNames) {
    for (const entry of contract.accessibilityOnlyPairs) {
      for (const adjacent of entry.adjacent) {
        assert.ok(contrastRatioOf(hex(theme, entry.boundary), hex(theme, adjacent)) >= entry.minRatio);
      }
    }
    for (const entry of contract.textPairs) {
      for (const bg of entry.backgrounds) {
        assert.ok(contrastRatioOf(hex(theme, entry.foreground), hex(theme, bg)) >= contract.accessibilityMinTextRatio);
      }
    }
  }

  // Documents *why* accessibilityOnlyPairs is its own list: the default light theme's
  // border-strong/input pair (the Checkbox/Radio unchecked boundary) does not meet the
  // 3:1 non-text minimum today. #77 does not silently widen the default contract to
  // cover this — it is tracked in contrastContract.exceptions as a known limitation.
  for (const entry of contract.accessibilityOnlyPairs) {
    for (const adjacent of entry.adjacent) {
      assert.ok(
        contrastRatioOf(hex('light', entry.boundary), hex('light', adjacent)) < entry.minRatio,
        'expected default light theme to NOT meet the accessibility-only boundary contract',
      );
    }
  }
});

test('rejects a contrastContract relationship that does not actually hold against resolved colors', () => {
  const invalid = structuredClone(source);
  invalid.$extensions['com.beeui'].contrastContract.textPairs.push({
    foreground: 'subtle-foreground',
    backgrounds: ['background'],
    minRatio: 4.5,
    usage: 'fixture: subtle-foreground is intentionally low-contrast and must fail this assertion',
  });
  assert.throws(() => validateCanonicalTokens(invalid), /textPairs fails in runtime theme "light"/);
});

test('#65 and #66 baseline contrast invariants are unaffected by the accessibility axis', () => {
  // Re-derive the exact #65/#66 relationships this generator already certified before
  // #77, to prove #77 only adds coverage rather than displacing it.
  for (const theme of beeMetadata().runtimeThemeNames) {
    const hex = (token) => dtcgColorToHex(resolvedSource.themes[theme].colors[token].$value);
    for (const [foreground, backgrounds] of [
      ['primary-foreground', ['primary', 'primary-hover', 'primary-pressed']],
      ['secondary-foreground', ['secondary', 'secondary-hover', 'secondary-pressed']],
      ['destructive-foreground', ['destructive', 'destructive-hover', 'destructive-pressed']],
    ]) {
      for (const background of backgrounds) {
        assert.ok(contrastRatioOf(hex(background), hex(foreground)) >= 4.5, `${theme}: ${foreground} vs ${background}`);
      }
    }
    assert.ok(contrastRatioOf(hex('control-border'), hex('input')) >= 3, `${theme}: control-border`);
    assert.ok(contrastRatioOf(hex('destructive'), hex('input')) >= 3, `${theme}: destructive vs input`);
  }
});
