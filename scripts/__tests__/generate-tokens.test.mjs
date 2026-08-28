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
  validateCanonicalTokens,
  validateDtcgDocument,
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
  assert.deepEqual(source.themes.light.colors.primary.$value, {
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
  assert.equal(dtcgColorToHex(source.themes.light.colors['primary-hover'].$value), '#e58a05');
  assert.equal(dtcgColorToHex(source.themes.light.colors['primary-pressed'].$value), '#d97706');
  assert.equal(dtcgColorToHex(source.themes['violet-dark'].colors['primary-pressed'].$value), '#9066f4');
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
  color.themes.light.colors.primary.$value = '#f59e0b';
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

test('generated resolver is a DTCG 2025.10 resolver document for every runtime theme', () => {
  const resolver = JSON.parse(
    generateTokenArtifacts(source).get('packages/tokens/src/tokens.resolver.json'),
  );
  assert.equal(resolver.$schema, RESOLVER_SCHEMA_URL);
  assert.equal(resolver.version, '2025.10');
  assert.deepEqual(Object.keys(resolver.modifiers.runtimeTheme.contexts), beeMetadata().runtimeThemeNames);
  assert.equal(resolver.modifiers.runtimeTheme.default, 'light');
  assert.deepEqual(resolver.sets.foundation.sources, [
    { $ref: '../tokens.json#/tokens' },
  ]);
  for (const theme of beeMetadata().runtimeThemeNames) {
    assert.deepEqual(resolver.modifiers.runtimeTheme.contexts[theme], [
      { $ref: `../tokens.json#/themes/${theme}/colors` },
    ]);
  }
  assert.deepEqual(resolver.resolutionOrder, [
    { $ref: '#/sets/foundation' },
    { $ref: '#/modifiers/runtimeTheme' },
  ]);
});
