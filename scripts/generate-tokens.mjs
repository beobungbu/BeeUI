#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATOR_PATH = 'scripts/generate-tokens.mjs';
const CANONICAL_PATH = 'packages/tokens/tokens.json';
const FORMAT_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/format.json';
const RESOLVER_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/resolver.json';
const DTCG_VERSION = '2025.10';
const BEEUI_EXTENSION = 'com.beeui';
const ARTIFACT_PATHS = [
  'packages/tokens/src/index.ts',
  'packages/tokens/src/theme.css',
  'packages/tokens/src/tokens.resolver.json',
];
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DTCG_TYPES = new Set([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid canonical tokens: ${message}`);
}

function beeExtension(value) {
  return value?.$extensions?.[BEEUI_EXTENSION] ?? {};
}

function metadata(source) {
  return beeExtension(source);
}

function publicEntries(group) {
  invariant(group && typeof group === 'object' && !Array.isArray(group), 'token group must be an object');
  return Object.entries(group)
    .filter(([name]) => !name.startsWith('$'))
    .map(([name, token]) => [beeExtension(token).publicName ?? name, token, name]);
}

function tokenValues(group) {
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => {
      invariant(token && Object.hasOwn(token, '$value'), `${name} is missing $value`);
      return [name, token.$value];
    }),
  );
}

function dimensionValues(group, expectedUnit = 'px') {
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => {
      const value = token?.$value;
      invariant(value?.unit === expectedUnit, `${name} must use ${expectedUnit}`);
      invariant(typeof value.value === 'number' && Number.isFinite(value.value), `${name} must contain a finite numeric value`);
      return [name, value.value];
    }),
  );
}

function assertUnique(values, label) {
  invariant(new Set(values).size === values.length, `${label} contains duplicate names`);
}

function assertExactNames(actual, expected, label) {
  assertUnique(actual, label);
  invariant(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `${label} must contain exactly: ${expected.join(', ')}`,
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function dtcgNameIsValid(name) {
  return typeof name === 'string' && name.length > 0 && !name.startsWith('$') && !/[{}.]/.test(name);
}

function validateDimensionValue(value, label, units = new Set(['px', 'rem'])) {
  invariant(isPlainObject(value), `${label} must be a DTCG dimension object`);
  invariant(typeof value.value === 'number' && Number.isFinite(value.value), `${label}.value must be finite`);
  invariant(units.has(value.unit), `${label}.unit must be one of: ${[...units].join(', ')}`);
}

function validateColorValue(value, label) {
  invariant(isPlainObject(value), `${label} must be a DTCG color object`);
  invariant(value.colorSpace === 'srgb', `${label}.colorSpace must be srgb for BeeUI`);
  invariant(Array.isArray(value.components) && value.components.length === 3, `${label}.components must contain 3 sRGB components`);
  for (const component of value.components) {
    invariant(typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1, `${label}.components must be finite numbers from 0 to 1`);
  }
  if (value.alpha !== undefined) {
    invariant(typeof value.alpha === 'number' && Number.isFinite(value.alpha) && value.alpha >= 0 && value.alpha <= 1, `${label}.alpha must be from 0 to 1`);
  }
  if (value.hex !== undefined) {
    invariant(/^#[0-9a-f]{6}$/i.test(value.hex), `${label}.hex must be a 6-digit fallback color`);
    const channels = value.hex.slice(1).match(/.{2}/g).map((part) => Number.parseInt(part, 16) / 255);
    channels.forEach((channel, index) => {
      invariant(Math.abs(channel - value.components[index]) <= 0.000001, `${label}.components must match its hex fallback`);
    });
  }
}

function validateShadowLayer(value, label) {
  invariant(isPlainObject(value), `${label} must be a shadow object`);
  validateColorValue(value.color, `${label}.color`);
  validateDimensionValue(value.offsetX, `${label}.offsetX`);
  validateDimensionValue(value.offsetY, `${label}.offsetY`);
  validateDimensionValue(value.blur, `${label}.blur`);
  validateDimensionValue(value.spread, `${label}.spread`);
  invariant(value.blur.value >= 0, `${label}.blur cannot be negative`);
  if (value.inset !== undefined) invariant(typeof value.inset === 'boolean', `${label}.inset must be boolean`);
}

function validateTokenValue(type, value, label) {
  switch (type) {
    case 'dimension':
      validateDimensionValue(value, label);
      break;
    case 'fontFamily':
      invariant(
        (typeof value === 'string' && value.length > 0) ||
          (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0)),
        `${label} must be a font-family string or non-empty string array`,
      );
      break;
    case 'fontWeight':
      invariant(
        (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 1000) ||
          ['thin', 'hairline', 'extra-light', 'ultra-light', 'light', 'normal', 'regular', 'book', 'medium', 'semi-bold', 'demi-bold', 'bold', 'extra-bold', 'ultra-bold', 'black', 'heavy', 'extra-black', 'ultra-black'].includes(value),
        `${label} must be a valid DTCG font weight`,
      );
      break;
    case 'duration':
      validateDimensionValue(value, label, new Set(['ms', 's']));
      break;
    case 'cubicBezier':
      invariant(Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === 'number' && Number.isFinite(item)), `${label} must be an array of four finite numbers`);
      invariant(value[0] >= 0 && value[0] <= 1 && value[2] >= 0 && value[2] <= 1, `${label} x coordinates must be between 0 and 1`);
      break;
    case 'shadow': {
      const layers = Array.isArray(value) ? value : [value];
      invariant(layers.length > 0, `${label} must contain at least one shadow layer`);
      layers.forEach((layer, index) => validateShadowLayer(layer, `${label}[${index}]`));
      break;
    }
    case 'color':
      validateColorValue(value, label);
      break;
    case 'number':
      invariant(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`);
      break;
    default:
      invariant(DTCG_TYPES.has(type), `${label} has unknown DTCG type ${type}`);
      throw new Error(`Invalid canonical tokens: ${label} uses supported DTCG type "${type}" that BeeUI does not author yet`);
  }
}

function validateDtcgNode(node, pathLabel, inheritedType, isRoot = false) {
  invariant(isPlainObject(node), `${pathLabel} must be an object`);
  const hasValue = Object.hasOwn(node, '$value');
  const hasRef = Object.hasOwn(node, '$ref');

  if (hasValue || hasRef) {
    invariant(!(hasValue && hasRef), `${pathLabel} cannot define both $value and $ref`);
    for (const key of Object.keys(node)) {
      invariant(
        ['$value', '$ref', '$type', '$description', '$extensions', '$deprecated'].includes(key),
        `${pathLabel} token contains unsupported property ${key}`,
      );
    }
    const type = node.$type ?? inheritedType;
    invariant(type && DTCG_TYPES.has(type), `${pathLabel} must resolve to a DTCG token type`);
    if (hasValue) validateTokenValue(type, node.$value, `${pathLabel}.$value`);
    else invariant(typeof node.$ref === 'string' && node.$ref.startsWith('#/'), `${pathLabel}.$ref must be a JSON Pointer reference`);
    return;
  }

  const groupType = node.$type ?? inheritedType;
  if (node.$type !== undefined) invariant(DTCG_TYPES.has(node.$type), `${pathLabel} has unknown DTCG type ${node.$type}`);
  if (node.$extensions !== undefined) invariant(isPlainObject(node.$extensions), `${pathLabel}.$extensions must be an object`);
  if (node.$description !== undefined) invariant(typeof node.$description === 'string', `${pathLabel}.$description must be a string`);

  for (const [name, child] of Object.entries(node)) {
    if (name.startsWith('$')) {
      invariant(
        ['$schema', '$type', '$description', '$extensions', '$extends', '$deprecated', '$root'].includes(name),
        `${pathLabel} group contains unsupported reserved property ${name}`,
      );
      invariant(isRoot || name !== '$schema', `${pathLabel} may not declare $schema`);
      continue;
    }
    invariant(dtcgNameIsValid(name), `${pathLabel} contains invalid DTCG token/group name "${name}"`);
    validateDtcgNode(child, pathLabel === '<root>' ? name : `${pathLabel}.${name}`, groupType, false);
  }
}

export function validateDtcgDocument(source) {
  invariant(source?.$schema === FORMAT_SCHEMA_URL, `$schema must target the DTCG ${DTCG_VERSION} format schema`);
  validateDtcgNode(source, '<root>', undefined, true);
  return source;
}

export function parseCanonicalJson(text, sourceLabel = CANONICAL_PATH) {
  let index = 0;

  function fail(message) {
    throw new Error(`Invalid canonical tokens: ${sourceLabel}: ${message}`);
  }

  function skipWhitespace() {
    while (index < text.length && /\s/.test(text[index])) index += 1;
  }

  function parseString() {
    skipWhitespace();
    if (text[index] !== '"') fail(`expected string at offset ${index}`);
    const start = index;
    index += 1;
    while (index < text.length) {
      const char = text[index];
      if (char === '\\') {
        index += 2;
        continue;
      }
      index += 1;
      if (char === '"') {
        try {
          return JSON.parse(text.slice(start, index));
        } catch (error) {
          fail(`invalid string at offset ${start}: ${error.message}`);
        }
      }
    }
    fail(`unterminated string at offset ${start}`);
  }

  function parseNumber() {
    skipWhitespace();
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail(`expected value at offset ${index}`);
    index += match[0].length;
    return Number(match[0]);
  }

  function parseLiteral(literal, value) {
    if (!text.startsWith(literal, index)) fail(`expected ${literal} at offset ${index}`);
    index += literal.length;
    return value;
  }

  function parseArray(pathLabel) {
    const result = [];
    index += 1;
    skipWhitespace();
    if (text[index] === ']') {
      index += 1;
      return result;
    }
    while (index < text.length) {
      result.push(parseValue(`${pathLabel}[${result.length}]`));
      skipWhitespace();
      if (text[index] === ',') {
        index += 1;
        continue;
      }
      if (text[index] === ']') {
        index += 1;
        return result;
      }
      fail(`expected ',' or ']' at offset ${index}`);
    }
    fail(`unterminated array ${pathLabel}`);
  }

  function parseObject(pathLabel) {
    const result = {};
    const keys = new Set();
    index += 1;
    skipWhitespace();
    if (text[index] === '}') {
      index += 1;
      return result;
    }
    while (index < text.length) {
      const key = parseString();
      if (keys.has(key)) fail(`duplicate JSON key "${key}" in ${pathLabel}`);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ':') fail(`expected ':' after "${key}" at offset ${index}`);
      index += 1;
      const childPath = pathLabel === '<root>' ? key : `${pathLabel}.${key}`;
      const value = parseValue(childPath);
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      skipWhitespace();
      if (text[index] === ',') {
        index += 1;
        continue;
      }
      if (text[index] === '}') {
        index += 1;
        return result;
      }
      fail(`expected ',' or '}' at offset ${index}`);
    }
    fail(`unterminated object ${pathLabel}`);
  }

  function parseValue(pathLabel) {
    skipWhitespace();
    const char = text[index];
    if (char === '{') return parseObject(pathLabel);
    if (char === '[') return parseArray(pathLabel);
    if (char === '"') return parseString();
    if (char === 't') return parseLiteral('true', true);
    if (char === 'f') return parseLiteral('false', false);
    if (char === 'n') return parseLiteral('null', null);
    return parseNumber();
  }

  const parsed = parseValue('<root>');
  skipWhitespace();
  if (index !== text.length) fail(`unexpected trailing content at offset ${index}`);
  return parsed;
}

export function dtcgColorToHex(value) {
  validateColorValue(value, 'color');
  const channels = value.components.map((component) => Math.round(component * 255));
  const base = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  if (value.alpha === undefined || value.alpha === 1) return base;
  return `${base}${Math.round(value.alpha * 255).toString(16).padStart(2, '0')}`;
}

function formatNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function colorToCss(value) {
  const hex = dtcgColorToHex(value);
  const alpha = value.alpha ?? 1;
  if (alpha === 1) return hex.slice(0, 7);
  const channels = value.components.map((component) => Math.round(component * 255));
  return `rgb(${channels.join(' ')} / ${formatNumber(alpha)})`;
}

function dimensionCss(value) {
  validateDimensionValue(value, 'dimension');
  return value.value === 0 ? '0' : `${formatNumber(value.value)}${value.unit}`;
}

function shadowLayerCss(layer) {
  return [
    layer.inset ? 'inset ' : '',
    dimensionCss(layer.offsetX),
    dimensionCss(layer.offsetY),
    dimensionCss(layer.blur),
    dimensionCss(layer.spread),
    colorToCss(layer.color),
  ].filter((value) => value !== '').join(' ');
}

function shadowCss(value) {
  return (Array.isArray(value) ? value : [value]).map(shadowLayerCss).join(', ');
}

function elevationValues(group) {
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => {
      const extension = beeExtension(token);
      return [
        name,
        {
          web: extension.legacyWebValue ?? shadowCss(token.$value),
          nativeElevation: extension.nativeElevation,
        },
      ];
    }),
  );
}

function elevationCssValues(group) {
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => [
      name,
      beeExtension(token).cssValue ?? beeExtension(token).legacyWebValue ?? shadowCss(token.$value),
    ]),
  );
}

function motionEasingValues(group) {
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => [
      name,
      `cubic-bezier(${token.$value.map(formatNumber).join(', ')})`,
    ]),
  );
}

function semanticNames(source) {
  return Object.keys(metadata(source).semanticColorDescriptions ?? {});
}

function focusValue(source) {
  const group = source.tokens.focusRing;
  const extension = beeExtension(group);
  return {
    width: group.width.$value.value,
    offset: group.offset.$value.value,
    colorToken: extension.colorToken,
    webVisibility: extension.webVisibility,
    nativeVisibility: extension.nativeVisibility,
  };
}

export function validateCanonicalTokens(source) {
  validateDtcgDocument(source);
  const meta = metadata(source);
  const { themes, tokens } = source;

  invariant(meta.dtcgVersion === DTCG_VERSION, `com.beeui.dtcgVersion must be ${DTCG_VERSION}`);
  invariant(meta.cssPixelReference === 16, 'cssPixelReference must preserve the accepted 16px baseline');

  for (const [name, values] of Object.entries({
    themeNames: meta.themeNames,
    brandNames: meta.brandNames,
    runtimeThemeNames: meta.runtimeThemeNames,
  })) {
    invariant(Array.isArray(values) && values.length > 0, `${name} must be a non-empty array`);
    assertUnique(values, name);
  }

  const semantics = semanticNames(source);
  invariant(semantics.length > 0, 'semanticColorDescriptions must define at least one token');
  assertUnique(semantics, 'semantic colors');

  assertExactNames(publicEntries(themes).map(([name]) => name), meta.runtimeThemeNames, 'themes');
  for (const themeName of meta.runtimeThemeNames) {
    const colors = themes[themeName]?.colors;
    const names = publicEntries(colors).map(([name]) => name);
    assertExactNames(names, semantics, `${themeName} semantic colors`);
    for (const [name, token] of publicEntries(colors)) {
      validateColorValue(token.$value, `${themeName}.${name}`);
    }
  }

  for (const brandName of meta.brandNames) {
    const mapping = meta.runtimeThemeByBrand?.[brandName];
    assertExactNames(Object.keys(mapping ?? {}), meta.themeNames, `${brandName} appearance mapping`);
    for (const runtimeName of Object.values(mapping)) {
      invariant(meta.runtimeThemeNames.includes(runtimeName), `${brandName} maps to unknown runtime theme ${runtimeName}`);
    }
  }

  for (const groupName of [
    'spacing',
    'radius',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'controlSize',
    'iconSize',
    'avatarSize',
    'contentWidth',
  ]) {
    dimensionValues(tokens[groupName]);
  }

  const fontSizeNames = publicEntries(tokens.fontSize).map(([name]) => name);
  const lineHeightNames = publicEntries(tokens.lineHeight).map(([name]) => name);
  assertExactNames(lineHeightNames, fontSizeNames, 'lineHeight roles');

  dimensionValues(tokens.motionDuration, 'ms');
  tokenValues(tokens.fontFamily);
  tokenValues(tokens.fontWeight);

  invariant(publicEntries(tokens.spacing).some(([name, , canonicalName]) => canonicalName === '2-5' && name === '2.5'), 'spacing.2-5 must preserve public name "2.5"');
  assertUnique(publicEntries(tokens.spacing).map(([name]) => name), 'spacing public names');

  for (const [name, token] of publicEntries(tokens.elevation)) {
    const extension = beeExtension(token);
    invariant(Number.isFinite(extension.nativeElevation) && extension.nativeElevation >= 0, `${name} nativeElevation must be a non-negative finite number`);
  }

  for (const [name, token] of publicEntries(tokens.motionEasing)) {
    validateTokenValue('cubicBezier', token.$value, `motionEasing.${name}`);
  }

  const focus = focusValue(source);
  invariant(semanticNames(source).includes(focus.colorToken), 'focusRing colorToken must be a semantic color token');
  invariant(focus.webVisibility === 'focus-visible', 'focusRing webVisibility must preserve focus-visible');
  invariant(focus.nativeVisibility === 'platform-focus', 'focusRing nativeVisibility must preserve platform-focus');

  return source;
}

function ts(value) {
  return JSON.stringify(value, null, 2);
}

function pxToRem(value, reference) {
  return `${formatNumber(value / reference)}rem`;
}

function pxToEm(value, reference) {
  return `${formatNumber(value / reference)}em`;
}

function renderIndex(source) {
  const meta = metadata(source);
  const { tokens } = source;
  const semantics = semanticNames(source);
  const focusRing = focusValue(source);

  return `// AUTO-GENERATED — DO NOT EDIT DIRECTLY.\n// Canonical source: ${CANONICAL_PATH}\n// Generator: ${GENERATOR_PATH}\n\nimport { defineThemeRegistry } from './registry';\n\nexport * from './registry';\n\nexport const beeThemeNames = ${ts(meta.themeNames)} as const;\n\nexport type BeeThemeName = (typeof beeThemeNames)[number];\n\nexport const beeBrandNames = ${ts(meta.brandNames)} as const;\n\nexport type BeeBrandName = (typeof beeBrandNames)[number];\n\nexport const beeRuntimeThemeNames = ${ts(meta.runtimeThemeNames)} as const;\n\nexport type BeeRuntimeThemeName = (typeof beeRuntimeThemeNames)[number];\n\nexport const beeRuntimeThemeByBrand = ${ts(meta.runtimeThemeByBrand)} as const satisfies Record<BeeBrandName, Record<BeeThemeName, BeeRuntimeThemeName>>;\n\n/**\n * The default BeeUI theme registry (Bee + Violet). Built from the same canonical\n * mapping as the standalone helpers, so its \`resolve\`/\`selectionFor\` results match\n * \`resolveBeeRuntimeTheme\`/\`getBeeThemeSelection\` exactly. Applications may define\n * their own registry with \`defineThemeRegistry\` without editing BeeUI source.\n */\nexport const beeThemeRegistry = defineThemeRegistry(beeRuntimeThemeByBrand);\n\nexport function resolveBeeRuntimeTheme(\n  brand: BeeBrandName,\n  theme: BeeThemeName,\n): BeeRuntimeThemeName {\n  return beeRuntimeThemeByBrand[brand][theme];\n}\n\nexport function getBeeThemeSelection(runtimeTheme: string):\n  | { brand: BeeBrandName; theme: BeeThemeName }\n  | undefined {\n  for (const brand of beeBrandNames) {\n    for (const theme of beeThemeNames) {\n      if (beeRuntimeThemeByBrand[brand][theme] === runtimeTheme) {\n        return { brand, theme };\n      }\n    }\n  }\n\n  return undefined;\n}\n\nexport function isBeeDarkRuntimeTheme(runtimeTheme: string) {\n  return getBeeThemeSelection(runtimeTheme)?.theme === 'dark';\n}\n\nexport const semanticColorTokens = ${ts(semantics)} as const;\n\nexport type SemanticColorToken = (typeof semanticColorTokens)[number];\nexport type SemanticColorVariableName = \`--color-\${SemanticColorToken}\`;\nexport type SemanticColorOverrides = Partial<Record<SemanticColorVariableName, string>>;\n\nexport function semanticColorVariable(token: SemanticColorToken): SemanticColorVariableName {\n  return \`--color-\${token}\`;\n}\n\nexport function defineSemanticColorOverrides<const T extends SemanticColorOverrides>(\n  overrides: T,\n): Readonly<T> {\n  return Object.freeze({ ...overrides });\n}\n\nexport const spacing = ${ts(dimensionValues(tokens.spacing))} as const;\n\nexport const radius = ${ts(dimensionValues(tokens.radius))} as const;\n\n/**\n * \`system\` means the platform default font. BeeUI deliberately does not force a\n * font-family utility until the consuming app loads and names a cross-platform font.\n */\nexport const fontFamily = ${ts(tokenValues(tokens.fontFamily))} as const;\n\nexport const fontSize = ${ts(dimensionValues(tokens.fontSize))} as const;\n\nexport const lineHeight = ${ts(dimensionValues(tokens.lineHeight))} as const;\n\nexport const fontWeight = ${ts(tokenValues(tokens.fontWeight))} as const;\n\nexport const letterSpacing = ${ts(dimensionValues(tokens.letterSpacing))} as const;\n\nexport type TypographyRole = keyof typeof fontSize;\n\nexport const controlSize = ${ts(dimensionValues(tokens.controlSize))} as const;\n\nexport const iconSize = ${ts(dimensionValues(tokens.iconSize))} as const;\n\nexport const avatarSize = ${ts(dimensionValues(tokens.avatarSize))} as const;\n\nexport const contentWidth = ${ts(dimensionValues(tokens.contentWidth))} as const;\n\nexport const elevation = ${ts(elevationValues(tokens.elevation))} as const;\n\nexport type ElevationLevel = keyof typeof elevation;\n\nexport const motionDuration = ${ts(dimensionValues(tokens.motionDuration, 'ms'))} as const;\n\nexport const motionEasing = ${ts(motionEasingValues(tokens.motionEasing))} as const;\n\nexport const focusRing = ${ts(focusRing)} as const satisfies {\n  width: number;\n  offset: number;\n  colorToken: SemanticColorToken;\n  webVisibility: 'focus-visible';\n  nativeVisibility: 'platform-focus';\n};\n`;
}

function renderThemeCss(source) {
  const meta = metadata(source);
  const { themes, tokens } = source;
  const reference = meta.cssPixelReference;
  const semantics = semanticNames(source);
  const radius = dimensionValues(tokens.radius);
  const fontSize = dimensionValues(tokens.fontSize);
  const lineHeight = dimensionValues(tokens.lineHeight);
  const fontWeight = tokenValues(tokens.fontWeight);
  const letterSpacing = dimensionValues(tokens.letterSpacing);
  const controlSize = dimensionValues(tokens.controlSize);
  const iconSize = dimensionValues(tokens.iconSize);
  const avatarSize = dimensionValues(tokens.avatarSize);
  const contentWidth = dimensionValues(tokens.contentWidth);
  const elevation = elevationCssValues(tokens.elevation);
  const motionDuration = dimensionValues(tokens.motionDuration, 'ms');
  const motionEasing = motionEasingValues(tokens.motionEasing);
  const focus = focusValue(source);
  const customThemes = meta.runtimeThemeNames.filter((name) => !meta.themeNames.includes(name));
  const lines = [
    '/* AUTO-GENERATED — DO NOT EDIT DIRECTLY.',
    ` * Canonical source: ${CANONICAL_PATH}`,
    ` * Generator: ${GENERATOR_PATH}`,
    ' */',
    '',
  ];

  for (const theme of customThemes) {
    lines.push(`@custom-variant ${theme} (&:where(.${theme}, .${theme} *));`);
  }
  lines.push('', '@theme {');
  for (const [name, value] of Object.entries(radius)) lines.push(`  --radius-${name}: ${value}px;`);
  lines.push('');
  for (const name of Object.keys(fontSize)) {
    lines.push(`  --text-${name}: ${pxToRem(fontSize[name], reference)};`);
    lines.push(`  --text-${name}--line-height: ${pxToRem(lineHeight[name], reference)};`);
  }
  lines.push('');
  for (const [name, value] of Object.entries(fontWeight)) lines.push(`  --font-weight-${name}: ${value};`);
  for (const [name, value] of Object.entries(letterSpacing)) lines.push(`  --tracking-${name}: ${pxToEm(value, reference)};`);
  lines.push('');
  for (const [name, value] of Object.entries(controlSize)) {
    const variable = name === 'touchTarget' ? 'touch-target' : `control-${name}`;
    lines.push(`  --spacing-${variable}: ${pxToRem(value, reference)};`);
  }
  for (const [name, value] of Object.entries(iconSize)) lines.push(`  --spacing-icon-${name}: ${pxToRem(value, reference)};`);
  for (const [name, value] of Object.entries(avatarSize)) lines.push(`  --spacing-avatar-${name}: ${pxToRem(value, reference)};`);
  lines.push('');
  for (const [name, value] of Object.entries(contentWidth)) lines.push(`  --container-${name}: ${pxToRem(value, reference)};`);
  lines.push('');
  for (const [name, value] of Object.entries(elevation)) lines.push(`  --shadow-${name}: ${value};`);
  lines.push('');
  for (const [name, value] of Object.entries(motionEasing)) lines.push(`  --ease-${name}: ${value};`);
  lines.push('}', '', '@theme static {');
  for (const [name, value] of Object.entries(motionDuration)) lines.push(`  --motion-duration-${name}: ${value}ms;`);
  lines.push(`  --focus-ring-width: ${focus.width}px;`);
  lines.push(`  --focus-ring-offset: ${focus.offset}px;`);
  lines.push('}', '', '@utility bee-focus-ring {');
  lines.push('  outline-color: var(--color-focus-ring);');
  lines.push('  outline-offset: var(--focus-ring-offset);');
  lines.push('  outline-style: solid;');
  lines.push('  outline-width: var(--focus-ring-width);');
  lines.push('}', '', '@layer theme {', '  :root {');
  for (const [themeIndex, themeName] of meta.runtimeThemeNames.entries()) {
    lines.push(`    @variant ${themeName} {`);
    for (const name of semantics) lines.push(`      --color-${name}: ${dtcgColorToHex(themes[themeName].colors[name].$value)};`);
    lines.push('    }');
    if (themeIndex < meta.runtimeThemeNames.length - 1) lines.push('');
  }
  lines.push('  }', '}', '');
  return lines.join('\n');
}

function renderResolverArtifact(source) {
  const meta = metadata(source);
  const contexts = Object.fromEntries(
    meta.runtimeThemeNames.map((themeName) => [
      themeName,
      [{ $ref: `../tokens.json#/themes/${themeName}/colors` }],
    ]),
  );

  const resolver = {
    $schema: RESOLVER_SCHEMA_URL,
    name: 'BeeUI runtime theme resolver',
    version: DTCG_VERSION,
    description: 'DTCG 2025.10 resolver document for BeeUI foundation tokens and registered Uniwind runtime theme contexts.',
    sets: {
      foundation: {
        description: 'BeeUI non-color foundation token groups.',
        sources: [{ $ref: '../tokens.json#/tokens' }],
      },
    },
    modifiers: {
      runtimeTheme: {
        description: 'Selects one complete BeeUI semantic-color runtime theme.',
        contexts,
        default: 'light',
        $extensions: {
          [BEEUI_EXTENSION]: {
            runtimeThemeByBrand: meta.runtimeThemeByBrand,
          },
        },
      },
    },
    resolutionOrder: [
      { $ref: '#/sets/foundation' },
      { $ref: '#/modifiers/runtimeTheme' },
    ],
  };

  return `${JSON.stringify(resolver, null, 2)}\n`;
}

export function generateTokenArtifacts(source) {
  validateCanonicalTokens(source);
  return new Map([
    [ARTIFACT_PATHS[0], renderIndex(source)],
    [ARTIFACT_PATHS[1], renderThemeCss(source)],
    [ARTIFACT_PATHS[2], renderResolverArtifact(source)],
  ]);
}

export function loadCanonicalTokens(sourcePath = path.join(ROOT_DIR, CANONICAL_PATH)) {
  return parseCanonicalJson(fs.readFileSync(sourcePath, 'utf8'), sourcePath);
}

export function writeOrCheckTokenArtifacts({ check = false, rootDir = ROOT_DIR } = {}) {
  const source = loadCanonicalTokens(path.join(rootDir, CANONICAL_PATH));
  const artifacts = generateTokenArtifacts(source);
  const stale = [];

  for (const [relativePath, content] of artifacts) {
    const outputPath = path.join(rootDir, relativePath);
    if (check) {
      if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== content) stale.push(relativePath);
      continue;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`generated ${relativePath}`);
  }

  if (stale.length > 0) {
    throw new Error(
      `Generated token artifacts are stale:\n${stale.map((name) => `- ${name}`).join('\n')}\nRun: pnpm tokens:generate`,
    );
  }

  if (check) console.log(`Token artifacts are current (${artifacts.size} files).`);
  return artifacts;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = process.argv.slice(2);
    invariant(args.every((arg) => arg === '--check'), `unsupported argument: ${args.find((arg) => arg !== '--check')}`);
    writeOrCheckTokenArtifacts({ check: args.includes('--check') });
  } catch (error) {
    console.error(error.message ?? error);
    process.exitCode = 1;
  }
}
