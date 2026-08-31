#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLifecycleManifest,
  deprecatedByCategory,
  deprecationJsDocMessage,
  validateTokenLifecycle,
} from './token-lifecycle.mjs';

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
  'packages/tokens/src/lifecycle.json',
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

const MOTION_REDUCED_POLICIES = ['immediate', 'opacity-or-state', 'shorten', 'remove-spatial'];
const MOTION_WEB_PROPERTIES = new Set(['opacity', 'transform', 'height']);
const MOTION_NATIVE_TYPES = new Set(['spring', 'timing']);

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

// WCAG relative luminance / contrast ratio, computed from the first 6 hex digits (alpha, if
// any, is ignored — no contrastContract relationship references a token with alpha). Mirrors
// the reader-side implementation in apps/showcase/__tests__/theme-tokens-v2.test.ts so codegen
// validation and the deterministic test suite can never silently disagree.
function relativeLuminanceFromHex(hex) {
  const channels = hex
    .slice(1, 7)
    .match(/.{2}/g)
    .map((part) => Number.parseInt(part, 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatioFromHex(left, right) {
  const [lighter, darker] = [relativeLuminanceFromHex(left), relativeLuminanceFromHex(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
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

function fontFamilyStackCss(value) {
  const members = Array.isArray(value) ? value : [value];
  return members.map((name) => (/\s/.test(name) ? JSON.stringify(name) : name)).join(', ');
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

function layerValues(group) {
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => {
      const value = token?.$value;
      invariant(
        typeof value === 'number' && Number.isInteger(value) && value >= 0,
        `layer.${name} must be a non-negative integer z-order value`,
      );
      return [name, value];
    }),
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

function motionEasingArrays(group) {
  return Object.fromEntries(publicEntries(group).map(([name, token]) => [name, token.$value]));
}

function semanticMotionSpecs(source) {
  return metadata(source).semanticMotion ?? {};
}

// Whether an intent moves in space by default (transform/size), mirroring resolveMotion.
function motionSpatialByDefault(spec) {
  return spec.web.properties.some((property) => property === 'transform' || property === 'height');
}

// Whether spatial motion survives under reduced motion, derived from the canonical policy.
// Only `shorten` keeps spatial motion; the other policies drop it. This is the single source
// the generated CSS flag and the JS `resolveMotion().spatial` value both derive from.
function motionReducedSpatial(spec) {
  return spec.reducedMotion === 'shorten' ? motionSpatialByDefault(spec) : false;
}

function motionIntentNames(source) {
  return Object.keys(semanticMotionSpecs(source));
}

function motionValues(source) {
  const durations = dimensionValues(source.tokens.motionDuration, 'ms');
  const easingCss = motionEasingValues(source.tokens.motionEasing);
  const easingArrays = motionEasingArrays(source.tokens.motionEasing);
  return Object.fromEntries(
    Object.entries(semanticMotionSpecs(source)).map(([name, spec]) => {
      const web = {
        durationMs: durations[spec.web.durationToken],
        easing: easingCss[spec.web.easingToken],
        properties: [...spec.web.properties],
      };
      const native =
        spec.native.type === 'spring'
          ? {
              type: 'spring',
              stiffness: spec.native.stiffness,
              damping: spec.native.damping,
              mass: spec.native.mass,
            }
          : {
              type: 'timing',
              durationMs: durations[spec.native.durationToken],
              easing: [...easingArrays[spec.native.easingToken]],
            };
      return [name, { web, native, reducedMotion: spec.reducedMotion }];
    }),
  );
}

export function semanticNames(source) {
  return Object.keys(metadata(source).semanticColorDescriptions ?? {});
}

// BeeUI issue #78 — semantic data-visualization (chart) color tokens. A distinct
// semantic-color domain from `semanticNames()`/`colors` above: chart tokens describe
// chart-rendering roles (categorical series, positive/negative delta, neutral, highlight,
// grid, axis), never feedback/status meaning, and are never allowed to share a name with a
// `colors` semantic token (validated in `validateCanonicalTokens`). Kept as a sibling
// function/metadata key (`com.beeui.chartColorDescriptions`, `themes.<theme>.chart`) rather
// than folded into `colors` so the two vocabularies stay structurally, not just
// conventionally, separate in every generated artifact (TS, CSS, resolver).
export function chartSemanticNames(source) {
  return Object.keys(metadata(source).chartColorDescriptions ?? {});
}

export function brandNames(source) {
  const names = metadata(source).brandNames ?? [];
  invariant(Array.isArray(names), 'com.beeui.brandNames must be an array of brand names');
  return names;
}

// BeeUI issue #74 — application density semantic axis.
//
// `com.beeui.densityIntents` (metadata, mirrors the `semanticMotion` shape) declares the
// approved density-mode vocabulary and default. Individual canonical token groups opt into
// being density-sensitive by declaring `com.beeui.densityAxis: true` and defining exactly
// one dimension value per approved mode (the same shape `pageGutter` already uses for its
// own three-tier vocabulary, reused here for codegen convenience — pageGutter's axis is
// viewport-responsive and build-time, density's is an explicit runtime application intent;
// the two are deliberately unrelated). This is the single source of truth for "which token
// groups are density-sensitive" — nothing downstream hand-maintains a second list.
function densityIntentsMeta(source) {
  return metadata(source).densityIntents ?? {};
}

export function densityModeNames(source) {
  return densityIntentsMeta(source).modes ?? [];
}

export function densityMetricGroupNames(source) {
  const { tokens } = source;
  return Object.keys(tokens).filter((name) => beeExtension(tokens[name]).densityAxis === true);
}

// Deterministic camelCase -> kebab-case conversion for density metric group names, used to
// derive their Uniwind CSS-variable name (`rowHeight` -> `--spacing-density-row-height`).
// Adding a new density-sensitive metric therefore never requires hand-registering a naming
// convention (contrast with `OVERRIDABLE_GROUP_BUILDERS`, which #71 categories need because
// their CSS-variable shape is not uniform); flagging `densityAxis: true` and regenerating is
// the entire integration.
export function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function densityVariableName(groupName) {
  return `--spacing-density-${kebabCase(groupName)}`;
}

// Every runtime theme name BeeUI generates CSS/resolver contexts for: the primary
// brand/appearance registry (`runtimeThemeNames`, e.g. light/dark/violet-light/violet-dark)
// plus any accessibility-variant runtime themes (e.g. high-contrast-light/dark, #77).
// The accessibility axis is a second, optional registry layered through the same
// runtime-theme-name mechanism rather than a slot inside the primary brand mapping, so a
// brand can adopt an accessibility variant without every other brand being forced to define
// one, and `beeRuntimeThemeNames`/`beeThemeRegistry` (the primary registry) stay untouched.
function allRuntimeThemeNames(meta) {
  return [...meta.runtimeThemeNames, ...(meta.accessibilityRuntimeThemeNames ?? [])];
}

// Validates com.beeui.contrastContract (#77): the centralized, deterministic metadata that
// describes exactly which semantic-token relationships BeeUI certifies for contrast, and at
// what minimum ratio. Two things are checked, both deterministically:
//  1. structure — every referenced token is real, every relationship documents its usage and
//     minimum ratio, and every semantic color token is either a canvas token, covered by a
//     required relationship, or a documented exception (no silent gaps, no undocumented
//     "trust me" tokens);
//  2. substance — every declared relationship actually holds against the *resolved* colors of
//     every runtime theme it applies to. accessibilityOnlyPairs and accessibilityMinTextRatio
//     apply only to accessibility (high-contrast) runtime themes, since default brand themes
//     are not certified for them (see contrastContract.exceptions "known-limitation" entries).
function validateContrastContract(source, combinedRuntimeThemeNames) {
  const meta = metadata(source);
  const contract = meta.contrastContract;
  invariant(isPlainObject(contract), 'com.beeui.contrastContract must be an object');
  invariant(
    typeof contract.description === 'string' && contract.description.length > 0,
    'contrastContract.description must document the contract',
  );

  const semantics = new Set(semanticNames(source));
  const canvasTokens = contract.canvasTokens ?? [];
  invariant(Array.isArray(canvasTokens), 'contrastContract.canvasTokens must be an array');
  for (const token of canvasTokens) {
    invariant(semantics.has(token), `contrastContract.canvasTokens references unknown token "${token}"`);
  }
  const covered = new Set(canvasTokens);

  function validatePairList(listName, roleFields) {
    const list = contract[listName] ?? [];
    invariant(Array.isArray(list), `contrastContract.${listName} must be an array`);
    for (const [index, entry] of list.entries()) {
      const label = `contrastContract.${listName}[${index}]`;
      invariant(isPlainObject(entry), `${label} must be an object`);
      invariant(typeof entry.minRatio === 'number' && entry.minRatio > 0, `${label}.minRatio must be a positive number`);
      invariant(typeof entry.usage === 'string' && entry.usage.length > 0, `${label}.usage must document the relationship`);
      for (const field of roleFields.single) {
        const value = entry[field];
        invariant(typeof value === 'string' && semantics.has(value), `${label}.${field} must reference a known semantic color token`);
        covered.add(value);
      }
      for (const field of roleFields.list) {
        const values = entry[field];
        invariant(Array.isArray(values) && values.length > 0, `${label}.${field} must be a non-empty array`);
        for (const value of values) {
          invariant(semantics.has(value), `${label}.${field} references unknown token "${value}"`);
          covered.add(value);
        }
      }
    }
    return list;
  }

  const textPairs = validatePairList('textPairs', { single: ['foreground'], list: ['backgrounds'] });
  const filledActionPairs = validatePairList('filledActionPairs', { single: ['foreground'], list: ['backgrounds'] });
  const feedbackFillPairs = validatePairList('feedbackFillPairs', { single: ['fill', 'foreground'], list: [] });
  const controlBoundaryPairs = validatePairList('controlBoundaryPairs', { single: ['boundary'], list: ['adjacent'] });
  const focusRingPairs = validatePairList('focusRingPairs', { single: ['boundary'], list: ['adjacent'] });
  const invalidBoundaryPairs = validatePairList('invalidBoundaryPairs', { single: ['boundary'], list: ['adjacent'] });
  const essentialIndicatorPairs = validatePairList('essentialIndicatorPairs', { single: ['indicator'], list: ['adjacent'] });
  const accessibilityOnlyPairs = validatePairList('accessibilityOnlyPairs', { single: ['boundary'], list: ['adjacent'] });

  invariant(
    contract.accessibilityMinTextRatio === undefined ||
      (typeof contract.accessibilityMinTextRatio === 'number' && contract.accessibilityMinTextRatio > 0),
    'contrastContract.accessibilityMinTextRatio must be a positive number when declared',
  );

  const exceptions = contract.exceptions ?? [];
  invariant(Array.isArray(exceptions), 'contrastContract.exceptions must be an array');
  for (const [index, entry] of exceptions.entries()) {
    const label = `contrastContract.exceptions[${index}]`;
    invariant(isPlainObject(entry), `${label} must be an object`);
    invariant(typeof entry.token === 'string' && semantics.has(entry.token), `${label}.token must reference a known semantic color token`);
    invariant(typeof entry.category === 'string' && entry.category.length > 0, `${label}.category must be a non-empty string`);
    invariant(typeof entry.reason === 'string' && entry.reason.length > 0, `${label}.reason must document why the token is excepted`);
    covered.add(entry.token);
  }

  const uncovered = [...semantics].filter((token) => !covered.has(token));
  invariant(
    uncovered.length === 0,
    `contrastContract does not cover every semantic color token; add a required relationship or a documented exception for: ${uncovered.join(', ')}`,
  );

  function hexOf(themeName, token) {
    const value = source.themes[themeName]?.colors?.[token]?.$value;
    invariant(value, `theme "${themeName}" is missing resolved color "${token}"`);
    return dtcgColorToHex(value);
  }

  function checkRatio(themeName, listName, a, b, minRatio) {
    const ratio = contrastRatioFromHex(hexOf(themeName, a), hexOf(themeName, b));
    invariant(
      ratio >= minRatio,
      `contrastContract.${listName} fails in runtime theme "${themeName}": ${a} vs ${b} = ${ratio.toFixed(2)}:1, requires >= ${minRatio}:1`,
    );
  }

  for (const themeName of combinedRuntimeThemeNames) {
    for (const entry of textPairs) for (const bg of entry.backgrounds) checkRatio(themeName, 'textPairs', entry.foreground, bg, entry.minRatio);
    for (const entry of filledActionPairs) for (const bg of entry.backgrounds) checkRatio(themeName, 'filledActionPairs', entry.foreground, bg, entry.minRatio);
    for (const entry of feedbackFillPairs) checkRatio(themeName, 'feedbackFillPairs', entry.fill, entry.foreground, entry.minRatio);
    for (const entry of controlBoundaryPairs) for (const adjacent of entry.adjacent) checkRatio(themeName, 'controlBoundaryPairs', entry.boundary, adjacent, entry.minRatio);
    for (const entry of focusRingPairs) for (const adjacent of entry.adjacent) checkRatio(themeName, 'focusRingPairs', entry.boundary, adjacent, entry.minRatio);
    for (const entry of invalidBoundaryPairs) for (const adjacent of entry.adjacent) checkRatio(themeName, 'invalidBoundaryPairs', entry.boundary, adjacent, entry.minRatio);
    for (const entry of essentialIndicatorPairs) for (const adjacent of entry.adjacent) checkRatio(themeName, 'essentialIndicatorPairs', entry.indicator, adjacent, entry.minRatio);
  }

  for (const themeName of meta.accessibilityRuntimeThemeNames ?? []) {
    for (const entry of accessibilityOnlyPairs) {
      for (const adjacent of entry.adjacent) checkRatio(themeName, 'accessibilityOnlyPairs', entry.boundary, adjacent, entry.minRatio);
    }
    if (contract.accessibilityMinTextRatio) {
      for (const entry of textPairs) {
        for (const bg of entry.backgrounds) checkRatio(themeName, 'accessibilityMinTextRatio', entry.foreground, bg, contract.accessibilityMinTextRatio);
      }
    }
  }
}

// Validates com.beeui.chartContrastContract (#78): the data-viz counterpart to
// validateContrastContract above, deliberately kept as a separate function/metadata key
// rather than a new list appended to contrastContract itself — its `indicator` role draws
// from the *chart* semantic-color domain (chartSemanticNames), never the ordinary `colors`
// domain contrastContract validates, so reusing contrastContract's own validatePairList/
// hexOf helpers (which resolve strictly against `colors`) would be structurally wrong. Same
// two-part contract shape and substance-checking approach as #77's contract, applied to the
// smaller chart vocabulary: every chart token is either a required relationship's indicator
// or a documented exception, and every required relationship actually holds against the
// *resolved* colors of every runtime theme (chart tokens are required to be complete, and
// therefore checked, in every runtime theme, not only the primary brand set).
function validateChartContrastContract(source, combinedRuntimeThemeNames) {
  const meta = metadata(source);
  const contract = meta.chartContrastContract;
  invariant(isPlainObject(contract), 'com.beeui.chartContrastContract must be an object');
  invariant(
    typeof contract.description === 'string' && contract.description.length > 0,
    'chartContrastContract.description must document the contract',
  );

  const chartSemantics = new Set(chartSemanticNames(source));
  const colorSemantics = new Set(semanticNames(source));
  const covered = new Set();

  const requiredPairs = contract.requiredPairs ?? [];
  invariant(Array.isArray(requiredPairs), 'chartContrastContract.requiredPairs must be an array');
  for (const [index, entry] of requiredPairs.entries()) {
    const label = `chartContrastContract.requiredPairs[${index}]`;
    invariant(isPlainObject(entry), `${label} must be an object`);
    invariant(typeof entry.minRatio === 'number' && entry.minRatio > 0, `${label}.minRatio must be a positive number`);
    invariant(typeof entry.usage === 'string' && entry.usage.length > 0, `${label}.usage must document the relationship`);
    invariant(
      typeof entry.indicator === 'string' && chartSemantics.has(entry.indicator),
      `${label}.indicator must reference a known chart color token`,
    );
    covered.add(entry.indicator);
    invariant(Array.isArray(entry.adjacent) && entry.adjacent.length > 0, `${label}.adjacent must be a non-empty array`);
    for (const value of entry.adjacent) {
      invariant(colorSemantics.has(value), `${label}.adjacent references unknown semantic color token "${value}"`);
    }
  }

  const exceptions = contract.exceptions ?? [];
  invariant(Array.isArray(exceptions), 'chartContrastContract.exceptions must be an array');
  for (const [index, entry] of exceptions.entries()) {
    const label = `chartContrastContract.exceptions[${index}]`;
    invariant(isPlainObject(entry), `${label} must be an object`);
    invariant(typeof entry.token === 'string' && chartSemantics.has(entry.token), `${label}.token must reference a known chart color token`);
    invariant(typeof entry.category === 'string' && entry.category.length > 0, `${label}.category must be a non-empty string`);
    invariant(typeof entry.reason === 'string' && entry.reason.length > 0, `${label}.reason must document why the token is excepted`);
    covered.add(entry.token);
  }

  const uncovered = [...chartSemantics].filter((token) => !covered.has(token));
  invariant(
    uncovered.length === 0,
    `chartContrastContract does not cover every chart color token; add a required relationship or a documented exception for: ${uncovered.join(', ')}`,
  );

  function chartHexOf(themeName, token) {
    const value = source.themes[themeName]?.chart?.[token]?.$value;
    invariant(value, `theme "${themeName}" is missing resolved chart color "${token}"`);
    return dtcgColorToHex(value);
  }

  function colorHexOf(themeName, token) {
    const value = source.themes[themeName]?.colors?.[token]?.$value;
    invariant(value, `theme "${themeName}" is missing resolved color "${token}"`);
    return dtcgColorToHex(value);
  }

  for (const themeName of combinedRuntimeThemeNames) {
    for (const entry of requiredPairs) {
      for (const adjacent of entry.adjacent) {
        const ratio = contrastRatioFromHex(chartHexOf(themeName, entry.indicator), colorHexOf(themeName, adjacent));
        invariant(
          ratio >= entry.minRatio,
          `chartContrastContract.requiredPairs fails in runtime theme "${themeName}": chart.${entry.indicator} vs ${adjacent} = ${ratio.toFixed(2)}:1, requires >= ${entry.minRatio}:1`,
        );
      }
    }
  }
}

function groupClassification(group) {
  const extension = beeExtension(group);
  return {
    layer: extension.layer,
    binding: extension.binding,
    runtimeOverridable: extension.runtimeOverridable,
    engine: extension.engine,
  };
}

function responsiveLayoutClassification(source) {
  const { tokens } = source;
  return {
    breakpoint: groupClassification(tokens.breakpoint),
    pageGutter: groupClassification(tokens.pageGutter),
    contentWidth: groupClassification(tokens.contentWidth),
  };
}

// BeeUI issue #74 — application density semantic axis. Every value here is read straight
// from canonical `tokens.tokens` groups flagged `com.beeui.densityAxis: true`; nothing is
// hand-maintained. See `densityMetricGroupNames`/`densityVariableName` above.
function densityMetricsData(source) {
  return Object.fromEntries(
    densityMetricGroupNames(source).map((groupName) => [groupName, dimensionValues(source.tokens[groupName])]),
  );
}

function densityMetricVariablesData(source) {
  return Object.fromEntries(
    densityMetricGroupNames(source).map((groupName) => [groupName, densityVariableName(groupName)]),
  );
}

// Renders the #74 density TS artifact: the approved mode vocabulary, the codegen-derived
// per-mode metric values, and a small apply surface that reuses #71's `applyThemeOverrides`
// / `CompiledThemeOverrides` as its only runtime-mutation primitive (see theme-overrides.ts)
// instead of introducing a second override-compiler or a density store/provider.
function renderDensityArtifact(source) {
  const modes = densityModeNames(source);
  const meta = densityIntentsMeta(source);
  const metrics = densityMetricsData(source);
  const variables = densityMetricVariablesData(source);

  return `/**
 * BeeUI issue #74 — application density semantic axis. \`${modes.join('\`/\`')}\` are the
 * only approved density-mode names, evidence-backed by recurring list-row and form-field
 * spacing/height literals across \`ListItem\`, \`FormGroup\`, and \`Field\`. \`${meta.defaultMode}\`
 * is the default and preserves the pre-#74 BeeUI v2 visual baseline exactly (see
 * \`densityMetrics.*.${meta.defaultMode}\` below against each component's prior literal).
 *
 * Density deliberately does NOT scale every spacing/radius/font token: only the metric
 * groups flagged \`com.beeui.densityAxis: true\` in canonical tokens.json participate
 * (currently ${Object.keys(metrics).map((name) => `\`${name}\``).join(', ')}). Component
 * \`size\` props (Button, Card, ...), icon geometry, focus-ring geometry, controlSize, and
 * typography are untouched by density — see docs/density.md for the full invariant list
 * and the native interactive hit-target guarantee enforced on \`rowHeight\` at codegen time.
 */
export const densityModes = ${ts(modes)} as const;

export type DensityMode = (typeof densityModes)[number];

export const defaultDensityMode: DensityMode = ${ts(meta.defaultMode)};

export const densityModeDescriptions = ${ts(meta.descriptions)} as const satisfies Record<DensityMode, string>;

/** Per-mode pixel values for every density-sensitive metric, read from canonical tokens.json. */
export const densityMetrics = ${ts(metrics)} as const;

export type DensityMetric = keyof typeof densityMetrics;

/**
 * Uniwind CSS-variable name for one density metric (e.g. \`rowHeight\` ->
 * \`--spacing-density-row-height\`). Lives under the same \`--spacing-*\` namespace as
 * \`controlSize\`/\`pageGutter\`, so Tailwind/Uniwind derives the matching \`h-*\`/\`min-h-*\`/
 * \`gap-*\` utility classes the same way it already does for those groups.
 */
export const densityMetricVariables = ${ts(variables)} as const satisfies Record<DensityMetric, string>;

function compileDensityPreset(mode: DensityMode): CompiledThemeOverrides {
  const cssVariables: Record<string, string> = {};
  for (const metric of Object.keys(densityMetrics) as DensityMetric[]) {
    cssVariables[densityMetricVariables[metric]] = \`\${densityMetrics[metric][mode]}px\`;
  }
  const orderedNames = Object.keys(cssVariables).sort();
  const ordered: Record<string, string> = {};
  for (const name of orderedNames) ordered[name] = cssVariables[name];
  return Object.freeze({ cssVariables: Object.freeze(ordered) });
}

/**
 * One precompiled #71-shaped \`CompiledThemeOverrides\` per approved density mode, built at
 * module init from \`densityMetrics\`. Deterministic and pure — never touches Uniwind.
 */
export const densityPresets: Readonly<Record<DensityMode, CompiledThemeOverrides>> = Object.freeze(
  Object.fromEntries(densityModes.map((mode) => [mode, compileDensityPreset(mode)])),
) as Readonly<Record<DensityMode, CompiledThemeOverrides>>;

/** Resolve one density mode's precompiled override bundle. Throws on an unknown mode instead of silently returning \`undefined\`. */
export function resolveDensityOverrides(mode: DensityMode): CompiledThemeOverrides {
  if (!Object.prototype.hasOwnProperty.call(densityPresets, mode)) {
    throw new Error(\`Unknown density mode "\${String(mode)}"; supported modes: \${densityModes.join(', ')}\`);
  }
  return densityPresets[mode];
}

/**
 * Apply one density mode to a named Uniwind runtime theme. A thin call-through to the
 * existing #71 \`applyThemeOverrides\` — BeeUI keeps no separate density store, cache, React
 * context, or provider (see \`applyThemeOverrides\` in theme-overrides.ts for the exact
 * contract this reuses). Like #71 overrides, and #68's \`ScopedTheme\`, this targets exactly
 * one named runtime theme: density has no scoped/subtree application surface in this
 * release (see docs/density.md for why, and the deferred path if that changes).
 */
export function applyDensity<RuntimeThemeName extends string>(
  uniwind: UniwindCSSVariableClient<RuntimeThemeName>,
  runtimeTheme: RuntimeThemeName,
  mode: DensityMode,
): void {
  applyThemeOverrides(uniwind, runtimeTheme, resolveDensityOverrides(mode));
}`;
}

/**
 * Runtime-override safety classification (#71) for every token group in
 * `tokens.tokens`, derived purely from each group's `$extensions.com.beeui`
 * metadata. A group without that metadata is explicitly classified
 * `runtimeOverridable: false` here rather than left ambiguous — every group
 * gets one of the four documented buckets (runtime-overridable public
 * semantic value; public build-time/invariant value; private authoring
 * primitive [never a `tokens.tokens` group — see `privateTokenGroups`];
 * metadata-only value) even when most groups fall into the second bucket by
 * default. This is the single source of truth `themeOverrideCategories`
 * (below, generated into index.ts) reads: a group can only ever become a
 * `defineThemeOverrides` category by first being flagged here, never by
 * hand-editing the generated category list.
 */
function tokenOverrideClassification(source) {
  const { tokens } = source;
  return Object.fromEntries(
    Object.keys(tokens).map((groupName) => {
      const extension = beeExtension(tokens[groupName]);
      return [
        groupName,
        {
          layer: extension.layer,
          binding: extension.binding,
          runtimeOverridable: extension.runtimeOverridable === true,
          engine: extension.engine,
        },
      ];
    }),
  );
}

// Public override-category name + generated-TS-object rendering for each
// token group that may be flagged `runtimeOverridable: true` in tokens.json.
// Exposing a new group through #71 requires BOTH flipping its canonical
// metadata flag AND registering its Uniwind CSS-variable-naming convention
// here (the same convention `renderThemeCss` already emits for that group) —
// `validateThemeOverrideCategories` fails the build if a flag has no
// registered convention, so the flag can never silently do nothing.
const OVERRIDABLE_GROUP_BUILDERS = {
  radius: {
    // Reader-category name (matches the `beeTokenReaderCategories`/`BeeTokenPath` key,
    // e.g. `radius.md`) and the Uniwind CSS-variable prefix this group is rendered under
    // (`renderThemeCss`'s own convention, mirrored by `radiusVariable()` in the generated
    // index.ts). `readableTokenNamespaces()` below reads these two fields — plus
    // `helperName`, the `*Variable()` string-helper a caller should reach for instead of
    // spelling the CSS variable out raw — so the #83 semantic-token-consumption guard can
    // derive its raw-CSS-variable-namespace rule from this single source instead of a
    // hand-maintained second list.
    readerCategory: 'radius',
    variablePrefix: '--radius-',
    helperName: 'radiusVariable',
    renderTsEntry: () =>
      [
        '  radius: {',
        '    keys: Object.keys(radius) as (keyof typeof radius)[],',
        "    valueKind: 'number',",
        '    variable: (key: keyof typeof radius) => `--radius-${key}` as const,',
        '    format: (value: number) => `${value}px`,',
        '  },',
      ].join('\n'),
    // #72 runtime-reader category entry — same key vocabulary and CSS-variable
    // convention as `renderTsEntry` above, read direction instead of write.
    renderReaderTsEntry: () =>
      [
        '  radius: {',
        "    kind: 'dimension',",
        '    keys: Object.keys(radius) as RadiusName[],',
        '    variable: (key: RadiusName) => radiusVariable(key),',
        '  },',
      ].join('\n'),
  },
  motionDuration: {
    readerCategory: 'motion',
    variablePrefix: '--motion-duration-',
    helperName: 'motionDurationVariable',
    renderTsEntry: () =>
      [
        '  motion: {',
        '    keys: Object.keys(motionDuration) as (keyof typeof motionDuration)[],',
        "    valueKind: 'number',",
        '    variable: (key: keyof typeof motionDuration) => `--motion-duration-${key}` as const,',
        '    format: (value: number) => `${value}ms`,',
        '  },',
      ].join('\n'),
    renderReaderTsEntry: () =>
      [
        '  motion: {',
        "    kind: 'duration',",
        '    keys: Object.keys(motionDuration) as MotionDurationName[],',
        '    variable: (key: MotionDurationName) => motionDurationVariable(key),',
        '  },',
      ].join('\n'),
  },
};

// The two color reader categories are always present in `beeTokenReaderCategories`
// (never gated by a group's `runtimeOverridable` flag — see that object's own
// generated JSDoc above), so their namespace metadata is fixed rather than derived
// from `OVERRIDABLE_GROUP_BUILDERS`/canonical group iteration. `variablePrefix` mirrors
// `semanticColorVariable()`/`chartColorVariable()`'s naming convention exactly.
const READER_COLOR_NAMESPACES = [
  { readerCategory: 'colors', variablePrefix: '--color-', helperName: 'semanticColorVariable' },
  { readerCategory: 'chart', variablePrefix: '--chart-', helperName: 'chartColorVariable' },
];

/**
 * Every CSS custom-property namespace with a typed BeeUI runtime reader
 * (`useBeeToken`/`getBeeToken` in `@beemvp/beeui-ui`) — the exact same category set as
 * `beeTokenReaderCategories` in the generated `index.ts`: the two always-present color
 * categories (`colors`, `chart`) plus every token group flagged `runtimeOverridable: true`
 * in `packages/tokens/tokens.json` (currently `radius`, `motionDuration`). This is the
 * single source of truth the #83 semantic-token-consumption guard reads to broaden its raw
 * CSS-variable rule beyond `--color-*` — there is no second hand-maintained namespace list,
 * mirroring how `privatePrimitiveIdentifiers()` derives the private side of that guard.
 */
export function readableTokenNamespaces(source) {
  const { tokens } = source;
  const overridable = Object.keys(tokens)
    .filter((groupName) => beeExtension(tokens[groupName]).runtimeOverridable === true)
    .map((groupName) => {
      const builder = OVERRIDABLE_GROUP_BUILDERS[groupName];
      invariant(
        builder,
        `token group "${groupName}" is flagged runtimeOverridable but generate-tokens.mjs has no ` +
          'registered Uniwind CSS-variable convention for it; add an entry to OVERRIDABLE_GROUP_BUILDERS ' +
          'in scripts/generate-tokens.mjs or unset com.beeui.runtimeOverridable for this group',
      );
      invariant(
        builder.readerCategory && builder.variablePrefix && builder.helperName,
        `OVERRIDABLE_GROUP_BUILDERS.${groupName} is missing readable-namespace metadata ` +
          '(readerCategory/variablePrefix/helperName)',
      );
      return { readerCategory: builder.readerCategory, variablePrefix: builder.variablePrefix, helperName: builder.helperName };
    });
  return [...READER_COLOR_NAMESPACES, ...overridable];
}

/** Just the CSS-variable prefixes from {@link readableTokenNamespaces}, e.g. `['--color-', '--chart-', '--radius-', '--motion-duration-']`. */
export function readableVariablePrefixes(source) {
  return readableTokenNamespaces(source).map((namespace) => namespace.variablePrefix);
}

function validateThemeOverrideCategories(source) {
  const { tokens } = source;
  for (const groupName of Object.keys(tokens)) {
    if (beeExtension(tokens[groupName]).runtimeOverridable !== true) continue;
    invariant(
      Object.hasOwn(OVERRIDABLE_GROUP_BUILDERS, groupName),
      `token group "${groupName}" is flagged runtimeOverridable but generate-tokens.mjs has no ` +
        'registered Uniwind CSS-variable convention for it; add an entry to OVERRIDABLE_GROUP_BUILDERS ' +
        'in scripts/generate-tokens.mjs or unset com.beeui.runtimeOverridable for this group',
    );
  }
}

// Renders the non-color entries of the generated `themeOverrideCategories` object: one
// entry per token group flagged `runtimeOverridable: true`, in canonical tokens.json
// group order. A group loses its category the moment its flag is unset and the
// artifacts are regenerated — nothing here is a hand-maintained parallel list.
function themeOverrideCategoryEntriesTs(source) {
  const { tokens } = source;
  return Object.keys(tokens)
    .filter((groupName) => beeExtension(tokens[groupName]).runtimeOverridable === true)
    .map((groupName) => OVERRIDABLE_GROUP_BUILDERS[groupName].renderTsEntry())
    .join('\n');
}

// Renders the non-color entries of the generated `beeTokenReaderCategories`
// object (#72): the exact same runtimeOverridable-flagged token groups as
// `themeOverrideCategoryEntriesTs` above, read direction instead of write.
// Reusing that flag (rather than a second one) keeps BeeUI's read and write
// runtime surfaces symmetric by construction: a group only becomes readable
// here the moment it is proven real-runtime-reactive enough to be
// override-eligible, and it loses its reader category the moment that flag
// is unset and the artifacts are regenerated.
function tokenReaderCategoryEntriesTs(source) {
  const { tokens } = source;
  return Object.keys(tokens)
    .filter((groupName) => beeExtension(tokens[groupName]).runtimeOverridable === true)
    .map((groupName) => OVERRIDABLE_GROUP_BUILDERS[groupName].renderReaderTsEntry())
    .join('\n');
}

function breakpointCssValues(group) {
  const semanticValues = dimensionValues(group);
  return Object.fromEntries(
    publicEntries(group).map(([name, token]) => [
      beeExtension(token).tailwindVariant,
      semanticValues[name],
    ]),
  );
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

const REFERENCE_PREFIX = '#/';

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function pointerSegments(pointer, label) {
  invariant(
    typeof pointer === 'string' && pointer.startsWith(REFERENCE_PREFIX),
    `${label} must be a same-document JSON Pointer starting with "#/"`,
  );
  return pointer
    .slice(REFERENCE_PREFIX.length)
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(decodePointerSegment);
}

// Walks a same-document JSON Pointer, tracking the DTCG group $type inherited at
// each step so cross-category references can be rejected deterministically.
function typedNodeAtPointer(root, pointer, label) {
  let node = root;
  let type;
  for (const segment of pointerSegments(pointer, label)) {
    invariant(
      isPlainObject(node) && Object.hasOwn(node, segment),
      `${label} points at a missing node (${pointer})`,
    );
    node = node[segment];
    if (isPlainObject(node) && typeof node.$type === 'string') type = node.$type;
  }
  return { node, type };
}

export function privateTokenGroups(source) {
  const groups = metadata(source).privateTokenGroups ?? [];
  invariant(Array.isArray(groups), 'com.beeui.privateTokenGroups must be an array of group names');
  return groups;
}

/**
 * Flatten every private authoring-primitive identifier declared under the canonical
 * document's `com.beeui.privateTokenGroups` (currently just `primitives`) into the
 * styling-name shapes a component could accidentally reference:
 *  - the bare family name (e.g. `neutral`, `danger`);
 *  - `family-leaf` (e.g. `neutral-500`, `danger-emphasis-hover`), matching how a Tailwind
 *    color utility or a `--color-*` custom property would spell the identifier.
 *
 * This is the single source of truth for "what is a private primitive identifier" so
 * downstream enforcement (issue #83) and tests never hand-maintain a second copy of this
 * list — it is derived from the canonical document every time it runs.
 */
export function privatePrimitiveIdentifiers(source) {
  const families = [];
  const identifiers = [];
  for (const groupName of privateTokenGroups(source)) {
    const group = source[groupName];
    invariant(isPlainObject(group), `private token group "${groupName}" is declared but missing`);
    for (const [family, familyGroup] of Object.entries(group)) {
      if (family.startsWith('$')) continue;
      families.push(family);
      identifiers.push(family);
      if (!isPlainObject(familyGroup)) continue;
      for (const leaf of Object.keys(familyGroup)) {
        if (leaf.startsWith('$')) continue;
        identifiers.push(`${family}-${leaf}`);
      }
    }
  }
  return { families, identifiers };
}

// Follows a reference chain to its resolved $value, rejecting dangling pointers,
// reference cycles (including multi-node cycles), references that escape the
// private authoring layer, and cross-category references.
function resolveReferenceChain(root, startPointer, referencingType, label) {
  const privateGroups = privateTokenGroups(root);
  const seen = new Set();
  let pointer = startPointer;
  for (;;) {
    invariant(!seen.has(pointer), `${label} forms a reference cycle at ${pointer}`);
    seen.add(pointer);
    const [firstSegment] = pointerSegments(pointer, label);
    invariant(
      privateGroups.includes(firstSegment),
      `${label} must reference a private authoring primitive; ${pointer} is not inside ${privateGroups.join(', ') || '(none)'}`,
    );
    const { node, type } = typedNodeAtPointer(root, pointer, label);
    invariant(isPlainObject(node), `${label} must reference a token object (${pointer})`);
    const hasValue = Object.hasOwn(node, '$value');
    const hasRef = Object.hasOwn(node, '$ref');
    invariant(hasValue || hasRef, `${label} references a group, not a token (${pointer})`);
    if (referencingType && type) {
      invariant(
        type === referencingType,
        `${label} makes an invalid cross-category reference to ${pointer} (${referencingType} cannot alias ${type})`,
      );
    }
    if (hasValue) return node.$value;
    pointer = node.$ref;
  }
}

function walkReferenceNodes(node, inheritedType, label, visit) {
  if (!isPlainObject(node)) return;
  const type = node.$type ?? inheritedType;
  if (Object.hasOwn(node, '$ref')) {
    visit(node, type, label);
    return;
  }
  if (Object.hasOwn(node, '$value')) return;
  for (const [name, child] of Object.entries(node)) {
    if (name.startsWith('$')) continue;
    walkReferenceNodes(child, type, label === '<root>' ? name : `${label}.${name}`, visit);
  }
}

function validatePrivateClassification(source) {
  const meta = metadata(source);
  for (const groupName of privateTokenGroups(source)) {
    const group = source[groupName];
    invariant(isPlainObject(group), `private token group "${groupName}" is declared but missing`);
    invariant(
      beeExtension(group).visibility === 'private',
      `private token group "${groupName}" must declare com.beeui.visibility "private"`,
    );
  }
  for (const themeName of allRuntimeThemeNames(meta)) {
    const colors = source.themes?.[themeName]?.colors;
    if (!isPlainObject(colors)) continue;
    for (const [name, token] of publicEntries(colors)) {
      invariant(
        beeExtension(token).visibility !== 'private',
        `semantic token ${themeName}.${name} must stay public; only authoring primitives may be private`,
      );
    }
  }
  for (const themeName of allRuntimeThemeNames(meta)) {
    const chart = source.themes?.[themeName]?.chart;
    if (!isPlainObject(chart)) continue;
    for (const [name, token] of publicEntries(chart)) {
      invariant(
        beeExtension(token).visibility !== 'private',
        `chart token ${themeName}.chart.${name} must stay public; only authoring primitives may be private`,
      );
    }
  }
}

// Validates the reference graph on the raw (unresolved) canonical document.
export function validateTokenReferences(source) {
  walkReferenceNodes(source, undefined, '<root>', (node, type, label) => {
    resolveReferenceChain(source, node.$ref, type, `${label} ($ref ${node.$ref})`);
  });
  validatePrivateClassification(source);
  return source;
}

// Returns a deep clone of the canonical document with every $ref replaced by its
// deterministically resolved $value. Runtime artifacts are rendered from this so
// generated output never contains unresolved private references.
export function resolveTokenReferences(source) {
  const resolved = structuredClone(source);
  walkReferenceNodes(resolved, undefined, '<root>', (node, type, label) => {
    const value = resolveReferenceChain(source, node.$ref, type, `${label} ($ref ${node.$ref})`);
    delete node.$ref;
    node.$value = structuredClone(value);
  });
  return resolved;
}

export function validateCanonicalTokens(rawSource) {
  validateDtcgDocument(rawSource);
  validateTokenReferences(rawSource);
  const source = resolveTokenReferences(rawSource);
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

  // #78 — chart (data-visualization) semantic colors are a distinct vocabulary from
  // `colors` above. They must never share a name with a `colors` semantic token: the two
  // domains are read through different runtime-reader/CSS-variable namespaces (`chart.*`
  // vs `colors.*`, `--chart-*` vs `--color-*`), so a name collision here would only be a
  // silent trap for a future author, never an actual runtime ambiguity — this invariant
  // catches it at generation time regardless.
  const chartSemantics = chartSemanticNames(source);
  invariant(chartSemantics.length > 0, 'chartColorDescriptions must define at least one token');
  assertUnique(chartSemantics, 'chart colors');
  const chartSemanticNameCollisions = chartSemantics.filter((name) => semantics.includes(name));
  invariant(
    chartSemanticNameCollisions.length === 0,
    `chart color tokens must not reuse a "colors" semantic token name: ${chartSemanticNameCollisions.join(', ')}`,
  );

  // Accessibility-variant metadata (#77) is optional structurally (a document with no
  // accessibility variants is still valid), but once declared it must be well-formed and its
  // runtime-theme names must never collide with the primary registry's, since Uniwind resolves
  // every runtime theme from one flat, global class-name namespace.
  const accessibilityBrandNames = meta.accessibilityBrandNames ?? [];
  const accessibilityRuntimeThemeNames = meta.accessibilityRuntimeThemeNames ?? [];
  invariant(Array.isArray(accessibilityBrandNames), 'com.beeui.accessibilityBrandNames must be an array');
  invariant(Array.isArray(accessibilityRuntimeThemeNames), 'com.beeui.accessibilityRuntimeThemeNames must be an array');
  if (accessibilityBrandNames.length > 0 || accessibilityRuntimeThemeNames.length > 0) {
    assertUnique(accessibilityBrandNames, 'accessibilityBrandNames');
    invariant(
      accessibilityBrandNames.every((brand) => meta.brandNames.includes(brand)),
      'accessibilityBrandNames must be a subset of brandNames; an accessibility variant opts a brand in, it does not define a new brand',
    );
    assertUnique(accessibilityRuntimeThemeNames, 'accessibilityRuntimeThemeNames');
    invariant(
      accessibilityRuntimeThemeNames.every((name) => !meta.runtimeThemeNames.includes(name)),
      'accessibilityRuntimeThemeNames must not collide with runtimeThemeNames (Uniwind runtime-theme names are one flat namespace)',
    );

    for (const brandName of accessibilityBrandNames) {
      const mapping = meta.accessibilityRuntimeThemeByBrand?.[brandName];
      assertExactNames(Object.keys(mapping ?? {}), meta.themeNames, `accessibility "${brandName}" appearance mapping`);
      for (const runtimeName of Object.values(mapping)) {
        invariant(
          accessibilityRuntimeThemeNames.includes(runtimeName),
          `accessibility "${brandName}" maps to unknown accessibility runtime theme ${runtimeName}`,
        );
      }
    }
    invariant(
      Object.keys(meta.accessibilityRuntimeThemeByBrand ?? {}).every((brand) => accessibilityBrandNames.includes(brand)),
      'accessibilityRuntimeThemeByBrand must declare exactly accessibilityBrandNames',
    );
  }

  const combinedRuntimeThemeNames = allRuntimeThemeNames(meta);
  assertExactNames(publicEntries(themes).map(([name]) => name), combinedRuntimeThemeNames, 'themes');
  for (const themeName of combinedRuntimeThemeNames) {
    const colors = themes[themeName]?.colors;
    const names = publicEntries(colors).map(([name]) => name);
    assertExactNames(names, semantics, `${themeName} semantic colors`);
    for (const [name, token] of publicEntries(colors)) {
      validateColorValue(token.$value, `${themeName}.${name}`);
    }
  }

  // #78 — every runtime theme (built-in brand themes and accessibility high-contrast themes
  // alike) must ship a complete chart-token vocabulary, exactly like `colors` above. Charts
  // are a general-purpose UI feature usable from any theme, so — unlike a hypothetical
  // brand-scoped vocabulary — there is no runtime theme the public chart vocabulary does not
  // apply to.
  for (const themeName of combinedRuntimeThemeNames) {
    const chart = themes[themeName]?.chart;
    const chartNames = publicEntries(chart).map(([name]) => name);
    assertExactNames(chartNames, chartSemantics, `${themeName} chart colors`);
    for (const [name, token] of publicEntries(chart)) {
      validateColorValue(token.$value, `${themeName}.chart.${name}`);
    }
  }

  for (const brandName of meta.brandNames) {
    const mapping = meta.runtimeThemeByBrand?.[brandName];
    assertExactNames(Object.keys(mapping ?? {}), meta.themeNames, `${brandName} appearance mapping`);
    for (const runtimeName of Object.values(mapping)) {
      invariant(meta.runtimeThemeNames.includes(runtimeName), `${brandName} maps to unknown runtime theme ${runtimeName}`);
    }
  }

  validateContrastContract(source, combinedRuntimeThemeNames);
  validateChartContrastContract(source, combinedRuntimeThemeNames);

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
    'breakpoint',
    'pageGutter',
  ]) {
    dimensionValues(tokens[groupName]);
  }

  const breakpointMeta = beeExtension(tokens.breakpoint);
  invariant(
    breakpointMeta.layer === 'web-responsive' &&
      breakpointMeta.binding === 'build-time-constant' &&
      breakpointMeta.runtimeOverridable === false,
    'breakpoint group must be classified as a web-only build-time constant that is not runtime-overridable (compiler needs constant breakpoints; runtime override belongs to #71)',
  );
  invariant(
    breakpointMeta.engine === 'tailwind-uniwind',
    'breakpoint execution engine must remain Tailwind/Uniwind; BeeUI does not author a second media-query engine',
  );
  let previousBreakpoint = 0;
  const breakpointVariants = [];
  for (const [name, token] of publicEntries(tokens.breakpoint)) {
    const value = token.$value.value;
    invariant(value > 0, `breakpoint.${name} must be a positive min-width threshold`);
    invariant(value > previousBreakpoint, 'breakpoint values must be strictly ascending and unique (no duplicate or conflicting definitions)');
    previousBreakpoint = value;
    const variant = beeExtension(token).tailwindVariant;
    invariant(typeof variant === 'string' && variant.length > 0, `breakpoint.${name} must map to a Tailwind/Uniwind variant`);
    breakpointVariants.push(variant);
  }
  assertUnique(breakpointVariants, 'breakpoint Tailwind variants');

  const pageGutterMeta = beeExtension(tokens.pageGutter);
  invariant(
    pageGutterMeta.layer === 'cross-platform' && pageGutterMeta.runtimeOverridable === false,
    'pageGutter group must be classified as a cross-platform, non-runtime-overridable value',
  );
  assertUnique(Object.values(dimensionValues(tokens.pageGutter)), 'pageGutter values');
  for (const value of Object.values(dimensionValues(tokens.pageGutter))) {
    invariant(value > 0, 'pageGutter values must be positive');
  }

  // BeeUI issue #74 — application density semantic axis.
  const densityMeta = metadata(source).densityIntents;
  invariant(isPlainObject(densityMeta), 'com.beeui.densityIntents must be an object');
  const densityModes = densityMeta.modes;
  invariant(Array.isArray(densityModes) && densityModes.length > 0, 'com.beeui.densityIntents.modes must be a non-empty array');
  assertUnique(densityModes, 'densityIntents.modes');
  invariant(
    typeof densityMeta.defaultMode === 'string' && densityModes.includes(densityMeta.defaultMode),
    'com.beeui.densityIntents.defaultMode must be one of densityIntents.modes',
  );
  invariant(isPlainObject(densityMeta.descriptions), 'com.beeui.densityIntents.descriptions must be an object');
  assertExactNames(Object.keys(densityMeta.descriptions), densityModes, 'densityIntents.descriptions');
  for (const mode of densityModes) {
    invariant(
      typeof densityMeta.descriptions[mode] === 'string' && densityMeta.descriptions[mode].length > 0,
      `densityIntents.descriptions.${mode} must be a non-empty string`,
    );
  }

  const densityGroupNames = densityMetricGroupNames(source);
  invariant(
    densityGroupNames.length > 0,
    'at least one canonical token group must be flagged com.beeui.densityAxis to give densityIntents a real effect',
  );
  const touchTargetPx = dimensionValues(tokens.controlSize).touchTarget;
  for (const groupName of densityGroupNames) {
    const group = tokens[groupName];
    // A density-sensitive group's public entries must be exactly the approved mode
    // vocabulary — no extra/missing mode, and never a free-form key.
    assertExactNames(publicEntries(group).map(([name]) => name), densityModes, `${groupName} density modes`);
    const values = dimensionValues(group);
    for (const mode of densityModes) {
      invariant(values[mode] > 0, `${groupName}.${mode} must be a positive dimension value`);
    }
    // Native interactive hit-target invariant (#74 DoD): a density metric group that
    // governs native-interactive geometry must never let ANY mode — including compact —
    // fall below the canonical touch-target minimum. Opt-in via nativeHitTargetSensitive
    // so metrics that are not interactive geometry (e.g. rowGap, formGap) are unaffected.
    if (beeExtension(group).nativeHitTargetSensitive === true) {
      for (const mode of densityModes) {
        invariant(
          values[mode] >= touchTargetPx,
          `${groupName}.${mode} (${values[mode]}px) must stay >= controlSize.touchTarget (${touchTargetPx}px) — ` +
            'compact visual density must never reduce the native interactive hit target',
        );
      }
    }
  }

  const contentWidthMeta = beeExtension(tokens.contentWidth);
  invariant(
    contentWidthMeta.layer === 'cross-platform' && contentWidthMeta.runtimeOverridable === false,
    'contentWidth group must remain a cross-platform, non-runtime-overridable value contract',
  );

  const fontSizeNames = publicEntries(tokens.fontSize).map(([name]) => name);
  const lineHeightNames = publicEntries(tokens.lineHeight).map(([name]) => name);
  assertExactNames(lineHeightNames, fontSizeNames, 'lineHeight roles');

  dimensionValues(tokens.motionDuration, 'ms');
  const fontFamilyValues = tokenValues(tokens.fontFamily);
  invariant(fontFamilyValues.sans === 'system', 'fontFamily.sans must remain the platform system default');
  const monoStack = fontFamilyValues.mono;
  invariant(
    Array.isArray(monoStack) && monoStack.length > 0 && monoStack[monoStack.length - 1] === 'monospace',
    'fontFamily.mono must be a non-empty stack ending in the generic monospace fallback',
  );

  const monoNative = meta.monoFontFamilyNative;
  invariant(isPlainObject(monoNative), 'com.beeui.monoFontFamilyNative must be an object');
  for (const platform of ['ios', 'android', 'default']) {
    invariant(
      typeof monoNative[platform] === 'string' && monoNative[platform].length > 0,
      `com.beeui.monoFontFamilyNative.${platform} must be a non-empty platform monospace family`,
    );
  }

  const numericVariants = meta.numericVariants;
  invariant(
    isPlainObject(numericVariants) && Object.keys(numericVariants).length > 0,
    'com.beeui.numericVariants must declare at least one numeric feature',
  );
  for (const [name, variant] of Object.entries(numericVariants)) {
    invariant(isPlainObject(variant), `com.beeui.numericVariants.${name} must be an object`);
    invariant(typeof variant.webUtility === 'string' && variant.webUtility.length > 0, `numericVariants.${name}.webUtility must be a non-empty string`);
    invariant(typeof variant.cssProperty === 'string' && variant.cssProperty.length > 0, `numericVariants.${name}.cssProperty must be a non-empty string`);
    invariant(typeof variant.cssValue === 'string' && variant.cssValue.length > 0, `numericVariants.${name}.cssValue must be a non-empty string`);
    invariant(
      Array.isArray(variant.nativeFontVariant) && variant.nativeFontVariant.length > 0 && variant.nativeFontVariant.every((entry) => typeof entry === 'string' && entry.length > 0),
      `numericVariants.${name}.nativeFontVariant must be a non-empty string array`,
    );
  }
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

  const layerNames = publicEntries(tokens.layer).map(([name]) => name);
  invariant(layerNames.length > 0, 'layer must define at least one stacking role');
  assertUnique(layerNames, 'layer roles');
  invariant(layerNames[0] === 'base', 'layer must declare "base" as the first (ground) role');
  const layerNumbers = Object.values(layerValues(tokens.layer));
  invariant(layerNumbers[0] === 0, 'layer.base must equal 0 so the ground plane is the numeric origin');
  for (let index = 1; index < layerNumbers.length; index += 1) {
    invariant(
      layerNumbers[index] > layerNumbers[index - 1],
      'layer values must strictly ascend in declaration order to encode a deterministic z-order',
    );
  }
  assertUnique(layerNumbers.map(String), 'layer values');

  const durationTokenNames = new Set(publicEntries(tokens.motionDuration).map(([name]) => name));
  const easingTokenNames = new Set(publicEntries(tokens.motionEasing).map(([name]) => name));
  const motionSpecs = semanticMotionSpecs(source);
  const motionNames = Object.keys(motionSpecs);
  invariant(motionNames.length > 0, 'semanticMotion must define at least one intent');
  assertUnique(motionNames, 'semantic motion intents');
  for (const [name, spec] of Object.entries(motionSpecs)) {
    invariant(dtcgNameIsValid(name), `semanticMotion intent "${name}" is not a valid name`);
    invariant(isPlainObject(spec), `semanticMotion.${name} must be an object`);
    invariant(typeof spec.description === 'string' && spec.description.length > 0, `semanticMotion.${name} must document its description`);
    invariant(
      MOTION_REDUCED_POLICIES.includes(spec.reducedMotion),
      `semanticMotion.${name}.reducedMotion must be one of: ${MOTION_REDUCED_POLICIES.join(', ')}`,
    );

    const web = spec.web;
    invariant(isPlainObject(web), `semanticMotion.${name}.web must be an object`);
    invariant(durationTokenNames.has(web.durationToken), `semanticMotion.${name}.web.durationToken references unknown duration ${web.durationToken}`);
    invariant(easingTokenNames.has(web.easingToken), `semanticMotion.${name}.web.easingToken references unknown easing ${web.easingToken}`);
    invariant(
      Array.isArray(web.properties) && web.properties.length > 0 && web.properties.every((property) => MOTION_WEB_PROPERTIES.has(property)),
      `semanticMotion.${name}.web.properties must be a non-empty subset of: ${[...MOTION_WEB_PROPERTIES].join(', ')}`,
    );

    const native = spec.native;
    invariant(isPlainObject(native), `semanticMotion.${name}.native must be an object`);
    invariant(MOTION_NATIVE_TYPES.has(native.type), `semanticMotion.${name}.native.type must be one of: ${[...MOTION_NATIVE_TYPES].join(', ')}`);
    if (native.type === 'spring') {
      for (const parameter of ['stiffness', 'damping', 'mass']) {
        invariant(
          typeof native[parameter] === 'number' && Number.isFinite(native[parameter]) && native[parameter] > 0,
          `semanticMotion.${name}.native.${parameter} must be a positive finite number`,
        );
      }
    } else {
      invariant(durationTokenNames.has(native.durationToken), `semanticMotion.${name}.native.durationToken references unknown duration ${native.durationToken}`);
      invariant(easingTokenNames.has(native.easingToken), `semanticMotion.${name}.native.easingToken references unknown easing ${native.easingToken}`);
    }
  }

  const focus = focusValue(source);
  invariant(semanticNames(source).includes(focus.colorToken), 'focusRing colorToken must be a semantic color token');
  invariant(focus.webVisibility === 'focus-visible', 'focusRing webVisibility must preserve focus-visible');
  invariant(focus.nativeVisibility === 'platform-focus', 'focusRing nativeVisibility must preserve platform-focus');

  validateTokenLifecycle(source);
  validateThemeOverrideCategories(source);

  return source;
}

function ts(value) {
  return JSON.stringify(value, null, 2);
}

// Render a public token record. When no token in the record is deprecated, the output is
// byte-identical to `ts(record)`, so stable tokens generate exactly as before. Deprecated
// tokens keep their key (the compatibility alias) and gain an `@deprecated` JSDoc pointing
// at the replacement.
function renderRecord(record, deprecatedNames) {
  const names = Object.keys(record);
  if (!deprecatedNames || !names.some((name) => deprecatedNames.has(name))) return ts(record);

  const lines = ['{'];
  names.forEach((name, index) => {
    const deprecated = deprecatedNames.get(name);
    if (deprecated) lines.push(`  /** @deprecated ${deprecationJsDocMessage(deprecated)} */`);
    const suffix = index < names.length - 1 ? ',' : '';
    // Reuse ts() formatting so object-valued scales keep the same multi-line indentation
    // as the non-deprecated fast path; nested lines are re-indented under the property.
    const value = ts(record[name]).replace(/\n/g, '\n  ');
    lines.push(`  ${JSON.stringify(name)}: ${value}${suffix}`);
  });
  lines.push('}');
  return lines.join('\n');
}

function emptyMap() {
  return new Map();
}

function pxToRem(value, reference) {
  return `${formatNumber(value / reference)}rem`;
}

function pxToEm(value, reference) {
  return `${formatNumber(value / reference)}em`;
}

function dataTypographyModels(source) {
  const meta = metadata(source);
  const { tokens } = source;
  const monoFontFamily = {
    webUtilityClass: 'font-mono',
    cssVariable: '--font-mono',
    stack: tokens.fontFamily.mono.$value,
    native: meta.monoFontFamilyNative,
  };
  const numericVariants = Object.fromEntries(
    Object.entries(meta.numericVariants).map(([name, variant]) => [
      name,
      {
        webUtilityClass: variant.webUtility,
        cssProperty: variant.cssProperty,
        cssValue: variant.cssValue,
        nativeFontVariant: variant.nativeFontVariant,
      },
    ]),
  );
  return { monoFontFamily, numericVariants };
}

function renderIndex(source) {
  const meta = metadata(source);
  const { tokens } = source;
  const semantics = semanticNames(source);
  const chartSemantics = chartSemanticNames(source);
  const focusRing = focusValue(source);
  const { monoFontFamily, numericVariants } = dataTypographyModels(source);
  const deprecated = deprecatedByCategory(source);
  const dep = (category) => deprecated.get(category) ?? emptyMap();

  return `// AUTO-GENERATED — DO NOT EDIT DIRECTLY.\n// Canonical source: ${CANONICAL_PATH}\n// Generator: ${GENERATOR_PATH}\n\nimport { defineThemeRegistry } from './registry';\nimport { applyThemeOverrides, createThemeOverridesDefiner, type CompiledThemeOverrides, type OverrideCategoryMap, type ThemeOverridesInput, type UniwindCSSVariableClient } from './theme-overrides';\nimport { defineTokenReader, type TokenCategoryMap, type TokenPath, type TokenValueForPath } from './token-reader';\n\nexport * from './registry';\nexport * from './theme-overrides';\nexport * from './token-reader';\n\nexport const beeThemeNames = ${ts(meta.themeNames)} as const;\n\nexport type BeeThemeName = (typeof beeThemeNames)[number];\n\nexport const beeBrandNames = ${ts(meta.brandNames)} as const;\n\nexport type BeeBrandName = (typeof beeBrandNames)[number];\n\nexport const beeRuntimeThemeNames = ${ts(meta.runtimeThemeNames)} as const;\n\nexport type BeeRuntimeThemeName = (typeof beeRuntimeThemeNames)[number];\n\nexport const beeRuntimeThemeByBrand = ${ts(meta.runtimeThemeByBrand)} as const satisfies Record<BeeBrandName, Record<BeeThemeName, BeeRuntimeThemeName>>;\n\n/**\n * The default BeeUI theme registry (Bee + Violet). Built from the same canonical\n * mapping as the standalone helpers, so its \`resolve\`/\`selectionFor\` results match\n * \`resolveBeeRuntimeTheme\`/\`getBeeThemeSelection\` exactly. Applications may define\n * their own registry with \`defineThemeRegistry\` without editing BeeUI source.\n */\nexport const beeThemeRegistry = defineThemeRegistry(beeRuntimeThemeByBrand);\n\nexport function resolveBeeRuntimeTheme(\n  brand: BeeBrandName,\n  theme: BeeThemeName,\n): BeeRuntimeThemeName {\n  return beeRuntimeThemeByBrand[brand][theme];\n}\n\nexport function getBeeThemeSelection(runtimeTheme: string):\n  | { brand: BeeBrandName; theme: BeeThemeName }\n  | undefined {\n  for (const brand of beeBrandNames) {\n    for (const theme of beeThemeNames) {\n      if (beeRuntimeThemeByBrand[brand][theme] === runtimeTheme) {\n        return { brand, theme };\n      }\n    }\n  }\n\n  return undefined;\n}\n\nexport function isBeeDarkRuntimeTheme(runtimeTheme: string) {\n  return getBeeThemeSelection(runtimeTheme)?.theme === 'dark';\n}\n\nexport const beeAccessibilityBrandNames = ${ts(meta.accessibilityBrandNames ?? [])} as const satisfies readonly BeeBrandName[];\n\nexport type BeeAccessibilityBrandName = (typeof beeAccessibilityBrandNames)[number];\n\nexport const beeAccessibilityRuntimeThemeNames = ${ts(meta.accessibilityRuntimeThemeNames ?? [])} as const;\n\nexport type BeeAccessibilityRuntimeThemeName = (typeof beeAccessibilityRuntimeThemeNames)[number];\n\nexport const beeAccessibilityRuntimeThemeByBrand = ${ts(meta.accessibilityRuntimeThemeByBrand ?? {})} as const satisfies Record<BeeAccessibilityBrandName, Record<BeeThemeName, BeeAccessibilityRuntimeThemeName>>;\n\n/**\n * Accessibility (high-contrast) variant registry (#77): a second, optional\n * \`brand -> appearance -> runtime-theme\` mapping built from the exact same\n * \`defineThemeRegistry\` primitive as \`beeThemeRegistry\`. Only brands that ship a\n * certified accessibility appearance appear here — currently just \`bee\` — so this\n * never forces every brand in \`beeThemeRegistry\` to define a high-contrast variant.\n * A resolved runtime theme is still applied with the ordinary \`Uniwind.setTheme\`\n * call; there is no second theme store or context, only a second, narrower registry\n * over the same runtime-theme-name namespace.\n */\nexport const beeAccessibilityThemeRegistry = defineThemeRegistry(beeAccessibilityRuntimeThemeByBrand);\n\nexport function resolveBeeAccessibilityRuntimeTheme(\n  brand: BeeAccessibilityBrandName,\n  theme: BeeThemeName,\n): BeeAccessibilityRuntimeThemeName {\n  return beeAccessibilityRuntimeThemeByBrand[brand][theme];\n}\n\nexport function getBeeAccessibilityThemeSelection(runtimeTheme: string):\n  | { brand: BeeAccessibilityBrandName; theme: BeeThemeName }\n  | undefined {\n  for (const brand of beeAccessibilityBrandNames) {\n    for (const theme of beeThemeNames) {\n      if (beeAccessibilityRuntimeThemeByBrand[brand][theme] === runtimeTheme) {\n        return { brand, theme };\n      }\n    }\n  }\n\n  return undefined;\n}\n\nexport const semanticColorTokens = ${ts(semantics)} as const;\n\nexport type SemanticColorToken = (typeof semanticColorTokens)[number];\nexport type SemanticColorVariableName = \`--color-\${SemanticColorToken}\`;\nexport type SemanticColorOverrides = Partial<Record<SemanticColorVariableName, string>>;\n\nexport function semanticColorVariable(token: SemanticColorToken): SemanticColorVariableName {\n  return \`--color-\${token}\`;\n}\n\nexport function defineSemanticColorOverrides<const T extends SemanticColorOverrides>(\n  overrides: T,\n): Readonly<T> {\n  return Object.freeze({ ...overrides });\n}\n\n/**\n * Semantic data-visualization (chart) color tokens (#78) — a distinct color\n * vocabulary from \`semanticColorTokens\` above, never a component/status color.\n * Chart tokens describe chart-rendering roles only (categorical series,\n * positive/negative delta, neutral baseline, highlight/emphasis, gridline, axis)\n * and never reuse a \`SemanticColorToken\` name; the canonical source enforces this\n * disjointness at generation time. Every shipped runtime theme -- including the\n * #77 accessibility high-contrast themes -- defines a complete, exact set of\n * these tokens (the same completeness rule \`semanticColorTokens\` gets). Read via\n * the \`chart\` category of \`beeTokenReaderCategories\`/\`useBeeToken\`/\`getBeeToken\`\n * below (e.g. \`useBeeToken('chart.series-1')\`), never a separate chart reader.\n */\nexport const chartColorTokens = ${ts(chartSemantics)} as const;\n\nexport type SemanticChartToken = (typeof chartColorTokens)[number];\nexport type SemanticChartVariableName = \`--chart-\${SemanticChartToken}\`;\n\nexport function chartColorVariable(token: SemanticChartToken): SemanticChartVariableName {\n  return \`--chart-\${token}\`;\n}\n\nexport const spacing = ${renderRecord(dimensionValues(tokens.spacing), dep('spacing'))} as const;\n\nexport const radius = ${renderRecord(dimensionValues(tokens.radius), dep('radius'))} as const;\n\nexport type RadiusName = keyof typeof radius;\n\nexport type RadiusVariableName = \`--radius-\${RadiusName}\`;\n\nexport function radiusVariable(name: RadiusName): RadiusVariableName {\n  return \`--radius-\${name}\`;\n}\n\n/**\n * \`system\` means the platform default font. BeeUI deliberately does not force a\n * font-family utility until the consuming app loads and names a cross-platform font.\n */\nexport const fontFamily = ${renderRecord(tokenValues(tokens.fontFamily), dep('fontFamily'))} as const;\n\nexport const fontSize = ${renderRecord(dimensionValues(tokens.fontSize), dep('fontSize'))} as const;\n\nexport const lineHeight = ${renderRecord(dimensionValues(tokens.lineHeight), dep('lineHeight'))} as const;\n\nexport const fontWeight = ${renderRecord(tokenValues(tokens.fontWeight), dep('fontWeight'))} as const;\n\nexport const letterSpacing = ${renderRecord(dimensionValues(tokens.letterSpacing), dep('letterSpacing'))} as const;\n\nexport type TypographyRole = keyof typeof fontSize;\n\nexport type FontFamilyToken = keyof typeof fontFamily;\n\n/**\n * Composable numeric typography features. These compose with any of the six\n * semantic size roles (they are never size roles themselves). \`webUtilityClass\`\n * drives the CSS \`font-variant-numeric\` utility; \`nativeFontVariant\` maps to the\n * React Native \`fontVariant\` style so equal-width figures render on iOS/Android.\n */\nexport const numericVariants = ${ts(numericVariants)} as const;\n\nexport type NumericVariant = keyof typeof numericVariants;\n\n/**\n * System-monospace family for reference codes, IDs, and technical values. BeeUI\n * bundles no proprietary font: \`stack\`/\`webUtilityClass\` drive the web fallback\n * stack and \`native\` supplies the per-platform monospace family for React Native.\n * A consuming app may map these to a licensed monospace font it loads itself.\n */\nexport const monoFontFamily = ${ts(monoFontFamily)} as const;\n\nexport const controlSize = ${renderRecord(dimensionValues(tokens.controlSize), dep('controlSize'))} as const;\n\nexport const iconSize = ${renderRecord(dimensionValues(tokens.iconSize), dep('iconSize'))} as const;\n\nexport const avatarSize = ${renderRecord(dimensionValues(tokens.avatarSize), dep('avatarSize'))} as const;\n\nexport const contentWidth = ${renderRecord(dimensionValues(tokens.contentWidth), dep('contentWidth'))} as const;\n\nexport type ContentWidthName = keyof typeof contentWidth;\n\n/**\n * Minimum stable responsive breakpoints (min-width thresholds, px). Web-only\n * build-time constants — Tailwind/Uniwind compiles these into responsive\n * variants and remains the sole responsive execution engine. Viewports below\n * \`medium\` are the implicit compact base. These values are readable (e.g. to\n * classify a measured width) but are NOT a runtime override surface: the web\n * compiler needs constant breakpoints, so a runtime-mutable breakpoint API is\n * out of scope here (see #71).\n */\nexport const breakpoint = ${renderRecord(dimensionValues(tokens.breakpoint), dep('breakpoint'))} as const;\n\nexport type BreakpointName = keyof typeof breakpoint;\n\n/**\n * Semantic horizontal page-edge padding (px). Cross-platform: consumed on web\n * through the generated \`--spacing-page-gutter-*\` Tailwind utility and on React\n * Native through this constant. Composes additively with safe-area insets —\n * apply the gutter inside the safe area, never in place of the inset.\n */\nexport const pageGutter = ${renderRecord(dimensionValues(tokens.pageGutter), dep('pageGutter'))} as const;\n\nexport type PageGutterName = keyof typeof pageGutter;\n\n${renderDensityArtifact(source)}\n\n/**\n * Build-time vs runtime classification for the responsive-layout token groups.\n * \`breakpoint\` is a web-only build-time constant; \`pageGutter\` and\n * \`contentWidth\` are cross-platform values. None are runtime-overridable.\n */\nexport const responsiveLayoutClassification = ${ts(responsiveLayoutClassification(source))} as const;\n\nexport const elevation = ${renderRecord(elevationValues(tokens.elevation), dep('elevation'))} as const;\n\nexport type ElevationLevel = keyof typeof elevation;\n\n/**\n * Semantic z-order (stacking) contract. Deliberately separate from \`elevation\`,\n * which encodes shadow depth. Values keep intentional gaps so applications can\n * insert local sublayers between roles without colliding with BeeUI surfaces.\n */\nexport const layer = ${renderRecord(layerValues(tokens.layer), dep('layer'))} as const;\n\nexport type LayerName = keyof typeof layer;\n\nexport type LayerVariableName = \`--layer-\${LayerName}\`;\n\nexport function layerVariable(name: LayerName): LayerVariableName {\n  return \`--layer-\${name}\`;\n}\n\nexport const motionDuration = ${renderRecord(dimensionValues(tokens.motionDuration, 'ms'), dep('motionDuration'))} as const;\n\nexport type MotionDurationName = keyof typeof motionDuration;\n\nexport type MotionDurationVariableName = \`--motion-duration-\${MotionDurationName}\`;\n\nexport function motionDurationVariable(name: MotionDurationName): MotionDurationVariableName {\n  return \`--motion-duration-\${name}\`;\n}\n\nexport const motionEasing = ${renderRecord(motionEasingValues(tokens.motionEasing), dep('motionEasing'))} as const;\n\nexport const motionIntents = ${ts(motionIntentNames(source))} as const;\n\nexport type MotionIntent = (typeof motionIntents)[number];\n\n/**\n * Reduced-motion policy per intent. Chosen from the four BeeUI-supported strategies:\n * - \`immediate\`: skip animation entirely and jump to the final state;\n * - \`opacity-or-state\`: keep the opacity/state change, drop spatial (transform/size) motion;\n * - \`shorten\`: keep the motion but clamp its duration to the fast token;\n * - \`remove-spatial\`: keep non-spatial timing, drop spatial motion.\n */\nexport type MotionReducedMotionPolicy = ${MOTION_REDUCED_POLICIES.map((policy) => `'${policy}'`).join(' | ')};\n\n/**\n * Semantic motion vocabulary for recurring spatial/state transitions.\n *\n * Token presence never makes animation mandatory. Web and native representations may\n * differ while sharing a semantic intent; no frame- or time-identical parity is promised.\n * Raw spring physics (\`stiffness\`, \`damping\`, \`mass\`; unitless React-Native spring units)\n * are an implementation detail behind the semantic name, not the primary public API.\n */\nexport const motion = ${ts(motionValues(source))} as const;\n\nexport type MotionSpec = (typeof motion)[MotionIntent];\n\nexport type ResolvedMotion = {\n  /** Whether the caller should animate at all (false means jump to the final state). */\n  animate: boolean;\n  /** Effective web duration in milliseconds after any reduced-motion policy. */\n  durationMs: number;\n  /** Whether spatial (transform/size) motion should be applied. */\n  spatial: boolean;\n  /** Whether a reduced-motion policy changed the base specification. */\n  reducedMotionApplied: boolean;\n};\n\n/**\n * Resolve a semantic motion intent against the caller-supplied reduced-motion signal.\n *\n * BeeUI adds no motion/preference store: the platform or app owns the reduced-motion\n * signal (e.g. \`AccessibilityInfo.isReduceMotionEnabled\` on native, the\n * \`prefers-reduced-motion\` media query on web) and passes it in. The final state is the\n * same in every branch; reduced motion only changes how (or whether) the transition plays.\n */\nexport function resolveMotion(\n  intent: MotionIntent,\n  options: { reducedMotion?: boolean } = {},\n): ResolvedMotion {\n  const spec = motion[intent];\n  const baseDurationMs = spec.web.durationMs;\n  const spatialByDefault = spec.web.properties.some(\n    (property) => property === 'transform' || property === 'height',\n  );\n\n  if (!options.reducedMotion) {\n    return {\n      animate: true,\n      durationMs: baseDurationMs,\n      spatial: spatialByDefault,\n      reducedMotionApplied: false,\n    };\n  }\n\n  // The active intents only use a subset of policies; the exhaustive switch keeps the\n  // resolver correct if a future intent adopts \`shorten\` or \`remove-spatial\`.\n  switch (spec.reducedMotion as MotionReducedMotionPolicy) {\n    case 'immediate':\n      return { animate: false, durationMs: 0, spatial: false, reducedMotionApplied: true };\n    case 'shorten':\n      return {\n        animate: true,\n        durationMs: Math.min(baseDurationMs, motionDuration.fast),\n        spatial: spatialByDefault,\n        reducedMotionApplied: true,\n      };\n    case 'opacity-or-state':\n    case 'remove-spatial':\n      return {\n        animate: true,\n        durationMs: baseDurationMs,\n        spatial: false,\n        reducedMotionApplied: true,\n      };\n  }\n}\n\nexport const focusRing = ${ts(focusRing)} as const satisfies {\n  width: number;\n  offset: number;\n  colorToken: SemanticColorToken;\n  webVisibility: 'focus-visible';\n  nativeVisibility: 'platform-focus';\n};\n\n/**\n * Runtime-override safety classification (#71) for every canonical token group,\n * generated straight from each group's \`$extensions.com.beeui\` metadata (see\n * tokens.json). \`runtimeOverridable: true\` is the only signal that gates a\n * group into \`themeOverrideCategories\` below; every other group is public but\n * build-time/invariant. The private authoring token group has its own\n * visibility flag (see \`privateTokenGroups\` in \`$extensions.com.beeui\`) and\n * is never a \`tokens.tokens\` group, so it never appears in this table. Colors\n * have their own established public/private classification\n * (\`semanticColorDescriptions\` / \`privateTokenGroups\`) and are not repeated here.\n */\nexport const themeOverrideClassification = ${ts(tokenOverrideClassification(source))} as const;\n\n/**\n * BeeUI's #71 typed runtime-override category vocabulary, instantiated from\n * canonical, codegen-derived data. \`colors\` mirrors the existing\n * \`semanticColorTokens\` vocabulary (kept for \`defineSemanticColorOverrides\`\n * compatibility -- both compile to the identical \`--color-*\` representation).\n * Every other category here exists only because its source token group is\n * flagged \`runtimeOverridable: true\` in \`themeOverrideClassification\` above:\n * unsetting that flag and regenerating removes the category, and every\n * category's accepted \`keys\` are read live from the already-generated token\n * record (never a hand-maintained parallel list of names).\n */\nconst themeOverrideCategories = {\n  colors: {\n    keys: semanticColorTokens,\n    valueKind: 'string',\n    variable: (key: SemanticColorToken) => semanticColorVariable(key),\n    format: (value: string) => value,\n  },\n${themeOverrideCategoryEntriesTs(source)}\n} as const satisfies OverrideCategoryMap;\n\n/**\n * Typed, validated runtime-override definer for the supported safe\n * runtime-overridable public token categories. Pure define/validate/compile:\n * unknown categories, unknown keys within a known category (which includes\n * every private authoring primitive and every build-time-only/invariant\n * token -- see \`themeOverrideClassification\`), and wrong-kind values are all\n * rejected. Applying the compiled result to Uniwind is always a separate,\n * explicit \`applyThemeOverrides()\` call -- this function itself never touches\n * Uniwind, \`document\`, or any global state.\n *\n * \`\`\`ts\n * const overrides = defineThemeOverrides({\n *   colors: { primary: '#123456', focusRing: '#654321' },\n *   radius: { md: 12 },\n *   motion: { normal: 180 },\n * });\n * applyThemeOverrides(Uniwind, 'light', overrides);\n * \`\`\`\n *\n * \`defineSemanticColorOverrides()\` remains available unchanged for existing\n * color-only consumers; \`defineThemeOverrides({ colors: { primary: '#123456' } })\`\n * compiles to the identical \`--color-primary\` CSS-variable entry.\n */\nexport const defineThemeOverrides = createThemeOverridesDefiner(themeOverrideCategories);\n\n/** The exact object shape \`defineThemeOverrides\` accepts. */\nexport type ThemeOverrides = ThemeOverridesInput<typeof themeOverrideCategories>;\n\n/**\n * BeeUI's #72 typed runtime-token-read category vocabulary, instantiated from\n * canonical, codegen-derived data. Deliberately the same category set as\n * \`themeOverrideCategories\` above (\`colors\`, \`radius\`, \`motion\`) and nothing\n * else: every readable category here is real-runtime-reactive -- its value can\n * differ between the initial build and the live app, either because it is\n * theme/appearance/scope-dependent (\`colors\`) or because #71 lets it be\n * overridden at runtime (\`radius\`, \`motion\`). Every other canonical token\n * group is theme-invariant and never runtime-mutable, so it stays an ordinary\n * typed export (e.g. \`spacing\`, \`fontSize\`, \`layer\`) rather than gaining a\n * runtime-reader category -- see \`docs/data-typography.md\`'s \"Runtime-reader\n * note\" and \`token-reader.ts\`'s module documentation for the full rationale.\n */\nexport const beeTokenReaderCategories = {\n  colors: {\n    kind: 'color',\n    keys: semanticColorTokens,\n    variable: (key: SemanticColorToken) => semanticColorVariable(key),\n  },\n  chart: {\n    kind: 'color',\n    keys: chartColorTokens,\n    variable: (key: SemanticChartToken) => chartColorVariable(key),\n  },\n${tokenReaderCategoryEntriesTs(source)}\n} as const satisfies TokenCategoryMap;\n\n/**\n * BeeUI's #72 typed runtime-token reader. Pure and stateless: only derives\n * valid \`category.key\` paths and their Uniwind CSS-variable name from\n * canonical metadata (see \`token-reader.ts\`). It never reads Uniwind itself --\n * \`useBeeToken\`/\`getBeeToken\` in \`@beemvp/beeui-ui\` (\`use-bee-token.ts\`) are the only\n * place this feature actually calls into Uniwind, so \`@beemvp/beeui-tokens\` keeps\n * zero dependency on \`uniwind\` or React, exactly like \`beeThemeRegistry\` and\n * \`defineThemeOverrides\` above.\n */\nexport const beeTokenReader = defineTokenReader(beeTokenReaderCategories);\n\n/** Every valid runtime-readable token path, e.g. \`colors.primary\` | \`radius.md\` | \`motion.normal\`. */\nexport type BeeTokenPath = TokenPath<typeof beeTokenReaderCategories>;\n\n/** The normalized TypeScript return type for one specific \`BeeTokenPath\`. */\nexport type BeeTokenValue<Path extends BeeTokenPath> = TokenValueForPath<typeof beeTokenReaderCategories, Path>;\n\nexport type ContrastTextPair = {\n  readonly foreground: SemanticColorToken;\n  readonly backgrounds: readonly SemanticColorToken[];\n  readonly minRatio: number;\n  readonly usage: string;\n};\n\nexport type ContrastFeedbackFillPair = {\n  readonly fill: SemanticColorToken;\n  readonly foreground: SemanticColorToken;\n  readonly minRatio: number;\n  readonly usage: string;\n};\n\nexport type ContrastBoundaryPair = {\n  readonly boundary: SemanticColorToken;\n  readonly adjacent: readonly SemanticColorToken[];\n  readonly minRatio: number;\n  readonly usage: string;\n};\n\nexport type ContrastIndicatorPair = {\n  readonly indicator: SemanticColorToken;\n  readonly adjacent: readonly SemanticColorToken[];\n  readonly minRatio: number;\n  readonly usage: string;\n};\n\nexport type ContrastException = {\n  readonly token: SemanticColorToken;\n  readonly category: string;\n  readonly reason: string;\n};\n\n/**\n * Centralized, deterministic semantic contrast-relationship metadata (#77).\n *\n * This is the canonical, machine-tested description of which semantic-token\n * relationships BeeUI certifies for contrast, and at what minimum ratio — moving\n * the contract from ad-hoc test code into data every runtime theme (built-in\n * brand themes and accessibility high-contrast themes alike) is validated\n * against at codegen time. \`canvasTokens\` lists tokens that are backdrops, not\n * content, so they carry no contrast requirement of their own. Every other\n * semantic color token is covered by at least one required relationship below or\n * by a documented entry in \`exceptions\` — nothing is silently uncertified.\n * \`accessibilityOnlyPairs\` and \`accessibilityMinTextRatio\` are certified only for\n * \`beeAccessibilityRuntimeThemeNames\`, not the default brand themes.\n */\nexport type ContrastContract = {\n  readonly description: string;\n  readonly canvasTokens: readonly SemanticColorToken[];\n  readonly textPairs: readonly ContrastTextPair[];\n  readonly filledActionPairs: readonly ContrastTextPair[];\n  readonly feedbackFillPairs: readonly ContrastFeedbackFillPair[];\n  readonly controlBoundaryPairs: readonly ContrastBoundaryPair[];\n  readonly focusRingPairs: readonly ContrastBoundaryPair[];\n  readonly invalidBoundaryPairs: readonly ContrastBoundaryPair[];\n  readonly essentialIndicatorPairs: readonly ContrastIndicatorPair[];\n  readonly accessibilityOnlyPairs: readonly ContrastBoundaryPair[];\n  readonly accessibilityMinTextRatio: number;\n  readonly exceptions: readonly ContrastException[];\n};\n\nexport const contrastContract = ${ts(metadata(source).contrastContract)} as const satisfies ContrastContract;\n\nexport type ChartContrastPair = {\n  readonly indicator: SemanticChartToken;\n  readonly adjacent: readonly SemanticColorToken[];\n  readonly minRatio: number;\n  readonly usage: string;\n};\n\nexport type ChartContrastException = {\n  readonly token: SemanticChartToken;\n  readonly category: string;\n  readonly reason: string;\n};\n\n/**\n * Centralized, deterministic chart-token contrast-relationship metadata (#78) --\n * the data-visualization counterpart to \`contrastContract\` above, kept as its own\n * export (never merged into \`contrastContract\`) because its \`indicator\`/\`token\`\n * fields draw from the \`chart\` semantic-color domain (\`SemanticChartToken\`), not\n * \`colors\` (\`SemanticColorToken\`). \`adjacent\` still references ordinary\n * \`SemanticColorToken\`s -- the real canvas/surface colors a chart renders on.\n * Every chart color token is covered by at least one required relationship in\n * \`requiredPairs\` or by a documented entry in \`exceptions\` -- nothing is silently\n * uncertified. Required in every runtime theme (built-in brand themes and\n * accessibility high-contrast themes alike): charts are a general-purpose UI\n * feature, not scoped to a subset of themes.\n */\nexport type ChartContrastContract = {\n  readonly description: string;\n  readonly requiredPairs: readonly ChartContrastPair[];\n  readonly exceptions: readonly ChartContrastException[];\n};\n\nexport const chartContrastContract = ${ts(metadata(source).chartContrastContract)} as const satisfies ChartContrastContract;\n`;
}

function renderThemeCss(source) {
  const meta = metadata(source);
  const { themes, tokens } = source;
  const reference = meta.cssPixelReference;
  const semantics = semanticNames(source);
  const chartSemantics = chartSemanticNames(source);
  const radius = dimensionValues(tokens.radius);
  const fontSize = dimensionValues(tokens.fontSize);
  const lineHeight = dimensionValues(tokens.lineHeight);
  const fontWeight = tokenValues(tokens.fontWeight);
  const letterSpacing = dimensionValues(tokens.letterSpacing);
  const controlSize = dimensionValues(tokens.controlSize);
  const iconSize = dimensionValues(tokens.iconSize);
  const avatarSize = dimensionValues(tokens.avatarSize);
  const contentWidth = dimensionValues(tokens.contentWidth);
  const breakpoint = breakpointCssValues(tokens.breakpoint);
  const pageGutter = dimensionValues(tokens.pageGutter);
  const elevation = elevationCssValues(tokens.elevation);
  const motionDuration = dimensionValues(tokens.motionDuration, 'ms');
  const motionEasing = motionEasingValues(tokens.motionEasing);
  const motionSpecs = semanticMotionSpecs(source);
  const layer = layerValues(tokens.layer);
  const deprecatedColors = deprecatedByCategory(source).get('color') ?? emptyMap();
  const focus = focusValue(source);
  const { numericVariants } = dataTypographyModels(source);
  const monoStackCss = fontFamilyStackCss(tokens.fontFamily.mono.$value);
  const renderedRuntimeThemeNames = allRuntimeThemeNames(meta);
  const customThemes = renderedRuntimeThemeNames.filter((name) => !meta.themeNames.includes(name));
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
  lines.push(`  --font-mono: ${monoStackCss};`);
  lines.push('');
  for (const [name, value] of Object.entries(controlSize)) {
    const variable = name === 'touchTarget' ? 'touch-target' : `control-${name}`;
    lines.push(`  --spacing-${variable}: ${pxToRem(value, reference)};`);
  }
  for (const [name, value] of Object.entries(iconSize)) lines.push(`  --spacing-icon-${name}: ${pxToRem(value, reference)};`);
  for (const [name, value] of Object.entries(avatarSize)) lines.push(`  --spacing-avatar-${name}: ${pxToRem(value, reference)};`);
  for (const [name, value] of Object.entries(pageGutter)) lines.push(`  --spacing-page-gutter-${name}: ${pxToRem(value, reference)};`);
  // BeeUI issue #74 — bake the default density mode's value into `@theme` so first paint
  // (before any JS `applyDensity` call) always renders `defaultDensityMode`, matching how
  // `radius`/`motionDuration` bake a default that #71's runtime overrides can then swap.
  const densityDefaultMode = metadata(source).densityIntents.defaultMode;
  for (const groupName of densityMetricGroupNames(source)) {
    const valuesByMode = dimensionValues(tokens[groupName]);
    lines.push(`  ${densityVariableName(groupName)}: ${pxToRem(valuesByMode[densityDefaultMode], reference)};`);
  }
  lines.push('');
  for (const [name, value] of Object.entries(contentWidth)) lines.push(`  --container-${name}: ${pxToRem(value, reference)};`);
  lines.push('');
  for (const [name, value] of Object.entries(breakpoint)) lines.push(`  --breakpoint-${name}: ${pxToRem(value, reference)};`);
  lines.push('');
  for (const [name, value] of Object.entries(elevation)) lines.push(`  --shadow-${name}: ${value};`);
  lines.push('');
  for (const [name, value] of Object.entries(motionEasing)) lines.push(`  --ease-${name}: ${value};`);
  lines.push('}', '', '@theme static {');
  for (const [name, value] of Object.entries(motionDuration)) lines.push(`  --motion-duration-${name}: ${value}ms;`);
  lines.push(`  --focus-ring-width: ${focus.width}px;`);
  lines.push(`  --focus-ring-offset: ${focus.offset}px;`);
  for (const [name, value] of Object.entries(layer)) lines.push(`  --layer-${name}: ${value};`);
  for (const [name, spec] of Object.entries(motionSpecs)) {
    lines.push(`  --motion-${name}-duration: ${motionDuration[spec.web.durationToken]}ms;`);
    lines.push(`  --motion-${name}-easing: ${motionEasing[spec.web.easingToken]};`);
    // 1 = run the spatial transform, 0 = drop it. Lets className-only consumers gate the
    // transform under prefers-reduced-motion without a JavaScript signal.
    lines.push(`  --motion-${name}-spatial: ${motionSpatialByDefault(spec) ? 1 : 0};`);
  }
  lines.push('}', '', '@utility bee-focus-ring {');
  lines.push('  outline-color: var(--color-focus-ring);');
  lines.push('  outline-offset: var(--focus-ring-offset);');
  lines.push('  outline-style: solid;');
  lines.push('  outline-width: var(--focus-ring-width);');
  lines.push('}');
  for (const name of Object.keys(layer)) {
    lines.push('', `@utility bee-layer-${name} {`, `  z-index: var(--layer-${name});`, '}');
  }
  for (const [, variant] of Object.entries(numericVariants)) {
    lines.push('', `@utility ${variant.webUtilityClass} {`);
    lines.push(`  ${variant.cssProperty}: ${variant.cssValue};`);
    lines.push('}');
  }
  lines.push('', '@layer theme {', '  :root {');
  for (const [themeIndex, themeName] of renderedRuntimeThemeNames.entries()) {
    lines.push(`    @variant ${themeName} {`);
    for (const name of semantics) {
    const deprecatedColor = deprecatedColors.get(name);
    if (deprecatedColor && deprecatedColor.replacement && deprecatedColor.compatibilityAlias) {
      const replacementName = deprecatedColor.replacement.slice('color.'.length);
      lines.push(`      /* @deprecated: use --color-${replacementName} */`);
      lines.push(`      --color-${name}: var(--color-${replacementName});`);
    } else {
      lines.push(`      --color-${name}: ${dtcgColorToHex(themes[themeName].colors[name].$value)};`);
    }
  }
    // #78 — data-visualization chart color tokens, deliberately a distinct `--chart-*`
    // CSS custom-property namespace from `--color-*` above (never `--color-chart-*`),
    // so the chart and semantic-color domains stay structurally separate in shipped CSS,
    // not just by naming convention.
    for (const name of chartSemantics) {
      lines.push(`      --chart-${name}: ${dtcgColorToHex(themes[themeName].chart[name].$value)};`);
    }
    lines.push('    }');
    if (themeIndex < renderedRuntimeThemeNames.length - 1) lines.push('');
  }
  lines.push('  }', '}', '');
  const reducedMotionLines = [];
  for (const [name, spec] of Object.entries(motionSpecs)) {
    if (spec.reducedMotion === 'immediate') {
      reducedMotionLines.push(`    --motion-${name}-duration: 0.01ms;`);
    } else if (spec.reducedMotion === 'shorten') {
      reducedMotionLines.push(`    --motion-${name}-duration: ${motionDuration.fast}ms;`);
    }
    if (motionReducedSpatial(spec) !== motionSpatialByDefault(spec)) {
      reducedMotionLines.push(`    --motion-${name}-spatial: ${motionReducedSpatial(spec) ? 1 : 0};`);
    }
  }
  if (reducedMotionLines.length > 0) {
    lines.push('@media (prefers-reduced-motion: reduce) {', '  :root {', ...reducedMotionLines, '  }', '}', '');
  }

  return lines.join('\n');
}

function renderResolverArtifact(source) {
  const meta = metadata(source);
  const contexts = Object.fromEntries(
    allRuntimeThemeNames(meta).map((themeName) => [
      themeName,
      [
        { $ref: `../tokens.json#/themes/${themeName}/colors` },
        // #78 — the chart (data-visualization) color group sits beside `colors` under
        // every runtime theme; referenced here too so the resolver context reflects the
        // theme's full resolved token set, not only its semantic-color subset.
        { $ref: `../tokens.json#/themes/${themeName}/chart` },
      ],
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
            accessibilityRuntimeThemeByBrand: meta.accessibilityRuntimeThemeByBrand ?? {},
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

function renderLifecycleManifest(source) {
  return `${JSON.stringify(buildLifecycleManifest(source), null, 2)}\n`;
}

export function generateTokenArtifacts(source) {
  validateDtcgDocument(source);
  validateTokenReferences(source);
  const resolved = resolveTokenReferences(source);
  validateCanonicalTokens(resolved);
  return new Map([
    [ARTIFACT_PATHS[0], renderIndex(resolved)],
    [ARTIFACT_PATHS[1], renderThemeCss(resolved)],
    [ARTIFACT_PATHS[2], renderResolverArtifact(resolved)],
    [ARTIFACT_PATHS[3], renderLifecycleManifest(resolved)],
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
