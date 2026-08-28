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

export function brandNames(source) {
  const names = metadata(source).brandNames ?? [];
  invariant(Array.isArray(names), 'com.beeui.brandNames must be an array of brand names');
  return names;
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
  for (const themeName of meta.runtimeThemeNames ?? []) {
    const colors = source.themes?.[themeName]?.colors;
    if (!isPlainObject(colors)) continue;
    for (const [name, token] of publicEntries(colors)) {
      invariant(
        beeExtension(token).visibility !== 'private',
        `semantic token ${themeName}.${name} must stay public; only authoring primitives may be private`,
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
  const focusRing = focusValue(source);
  const { monoFontFamily, numericVariants } = dataTypographyModels(source);
  const deprecated = deprecatedByCategory(source);
  const dep = (category) => deprecated.get(category) ?? emptyMap();

  return `// AUTO-GENERATED — DO NOT EDIT DIRECTLY.\n// Canonical source: ${CANONICAL_PATH}\n// Generator: ${GENERATOR_PATH}\n\nimport { defineThemeRegistry } from './registry';\n\nexport * from './registry';\n\nexport const beeThemeNames = ${ts(meta.themeNames)} as const;\n\nexport type BeeThemeName = (typeof beeThemeNames)[number];\n\nexport const beeBrandNames = ${ts(meta.brandNames)} as const;\n\nexport type BeeBrandName = (typeof beeBrandNames)[number];\n\nexport const beeRuntimeThemeNames = ${ts(meta.runtimeThemeNames)} as const;\n\nexport type BeeRuntimeThemeName = (typeof beeRuntimeThemeNames)[number];\n\nexport const beeRuntimeThemeByBrand = ${ts(meta.runtimeThemeByBrand)} as const satisfies Record<BeeBrandName, Record<BeeThemeName, BeeRuntimeThemeName>>;\n\n/**\n * The default BeeUI theme registry (Bee + Violet). Built from the same canonical\n * mapping as the standalone helpers, so its \`resolve\`/\`selectionFor\` results match\n * \`resolveBeeRuntimeTheme\`/\`getBeeThemeSelection\` exactly. Applications may define\n * their own registry with \`defineThemeRegistry\` without editing BeeUI source.\n */\nexport const beeThemeRegistry = defineThemeRegistry(beeRuntimeThemeByBrand);\n\nexport function resolveBeeRuntimeTheme(\n  brand: BeeBrandName,\n  theme: BeeThemeName,\n): BeeRuntimeThemeName {\n  return beeRuntimeThemeByBrand[brand][theme];\n}\n\nexport function getBeeThemeSelection(runtimeTheme: string):\n  | { brand: BeeBrandName; theme: BeeThemeName }\n  | undefined {\n  for (const brand of beeBrandNames) {\n    for (const theme of beeThemeNames) {\n      if (beeRuntimeThemeByBrand[brand][theme] === runtimeTheme) {\n        return { brand, theme };\n      }\n    }\n  }\n\n  return undefined;\n}\n\nexport function isBeeDarkRuntimeTheme(runtimeTheme: string) {\n  return getBeeThemeSelection(runtimeTheme)?.theme === 'dark';\n}\n\nexport const semanticColorTokens = ${ts(semantics)} as const;\n\nexport type SemanticColorToken = (typeof semanticColorTokens)[number];\nexport type SemanticColorVariableName = \`--color-\${SemanticColorToken}\`;\nexport type SemanticColorOverrides = Partial<Record<SemanticColorVariableName, string>>;\n\nexport function semanticColorVariable(token: SemanticColorToken): SemanticColorVariableName {\n  return \`--color-\${token}\`;\n}\n\nexport function defineSemanticColorOverrides<const T extends SemanticColorOverrides>(\n  overrides: T,\n): Readonly<T> {\n  return Object.freeze({ ...overrides });\n}\n\nexport const spacing = ${renderRecord(dimensionValues(tokens.spacing), dep('spacing'))} as const;\n\nexport const radius = ${renderRecord(dimensionValues(tokens.radius), dep('radius'))} as const;\n\n/**\n * \`system\` means the platform default font. BeeUI deliberately does not force a\n * font-family utility until the consuming app loads and names a cross-platform font.\n */\nexport const fontFamily = ${renderRecord(tokenValues(tokens.fontFamily), dep('fontFamily'))} as const;\n\nexport const fontSize = ${renderRecord(dimensionValues(tokens.fontSize), dep('fontSize'))} as const;\n\nexport const lineHeight = ${renderRecord(dimensionValues(tokens.lineHeight), dep('lineHeight'))} as const;\n\nexport const fontWeight = ${renderRecord(tokenValues(tokens.fontWeight), dep('fontWeight'))} as const;\n\nexport const letterSpacing = ${renderRecord(dimensionValues(tokens.letterSpacing), dep('letterSpacing'))} as const;\n\nexport type TypographyRole = keyof typeof fontSize;\n\nexport type FontFamilyToken = keyof typeof fontFamily;\n\n/**\n * Composable numeric typography features. These compose with any of the six\n * semantic size roles (they are never size roles themselves). \`webUtilityClass\`\n * drives the CSS \`font-variant-numeric\` utility; \`nativeFontVariant\` maps to the\n * React Native \`fontVariant\` style so equal-width figures render on iOS/Android.\n */\nexport const numericVariants = ${ts(numericVariants)} as const;\n\nexport type NumericVariant = keyof typeof numericVariants;\n\n/**\n * System-monospace family for reference codes, IDs, and technical values. BeeUI\n * bundles no proprietary font: \`stack\`/\`webUtilityClass\` drive the web fallback\n * stack and \`native\` supplies the per-platform monospace family for React Native.\n * A consuming app may map these to a licensed monospace font it loads itself.\n */\nexport const monoFontFamily = ${ts(monoFontFamily)} as const;\n\nexport const controlSize = ${renderRecord(dimensionValues(tokens.controlSize), dep('controlSize'))} as const;\n\nexport const iconSize = ${renderRecord(dimensionValues(tokens.iconSize), dep('iconSize'))} as const;\n\nexport const avatarSize = ${renderRecord(dimensionValues(tokens.avatarSize), dep('avatarSize'))} as const;\n\nexport const contentWidth = ${renderRecord(dimensionValues(tokens.contentWidth), dep('contentWidth'))} as const;\n\nexport type ContentWidthName = keyof typeof contentWidth;\n\n/**\n * Minimum stable responsive breakpoints (min-width thresholds, px). Web-only\n * build-time constants — Tailwind/Uniwind compiles these into responsive\n * variants and remains the sole responsive execution engine. Viewports below\n * \`medium\` are the implicit compact base. These values are readable (e.g. to\n * classify a measured width) but are NOT a runtime override surface: the web\n * compiler needs constant breakpoints, so a runtime-mutable breakpoint API is\n * out of scope here (see #71).\n */\nexport const breakpoint = ${renderRecord(dimensionValues(tokens.breakpoint), dep('breakpoint'))} as const;\n\nexport type BreakpointName = keyof typeof breakpoint;\n\n/**\n * Semantic horizontal page-edge padding (px). Cross-platform: consumed on web\n * through the generated \`--spacing-page-gutter-*\` Tailwind utility and on React\n * Native through this constant. Composes additively with safe-area insets —\n * apply the gutter inside the safe area, never in place of the inset.\n */\nexport const pageGutter = ${renderRecord(dimensionValues(tokens.pageGutter), dep('pageGutter'))} as const;\n\nexport type PageGutterName = keyof typeof pageGutter;\n\n/**\n * Build-time vs runtime classification for the responsive-layout token groups.\n * \`breakpoint\` is a web-only build-time constant; \`pageGutter\` and\n * \`contentWidth\` are cross-platform values. None are runtime-overridable.\n */\nexport const responsiveLayoutClassification = ${ts(responsiveLayoutClassification(source))} as const;\n\nexport const elevation = ${renderRecord(elevationValues(tokens.elevation), dep('elevation'))} as const;\n\nexport type ElevationLevel = keyof typeof elevation;\n\n/**\n * Semantic z-order (stacking) contract. Deliberately separate from \`elevation\`,\n * which encodes shadow depth. Values keep intentional gaps so applications can\n * insert local sublayers between roles without colliding with BeeUI surfaces.\n */\nexport const layer = ${renderRecord(layerValues(tokens.layer), dep('layer'))} as const;\n\nexport type LayerName = keyof typeof layer;\n\nexport type LayerVariableName = \`--layer-\${LayerName}\`;\n\nexport function layerVariable(name: LayerName): LayerVariableName {\n  return \`--layer-\${name}\`;\n}\n\nexport const motionDuration = ${renderRecord(dimensionValues(tokens.motionDuration, 'ms'), dep('motionDuration'))} as const;\n\nexport const motionEasing = ${renderRecord(motionEasingValues(tokens.motionEasing), dep('motionEasing'))} as const;\n\nexport const motionIntents = ${ts(motionIntentNames(source))} as const;\n\nexport type MotionIntent = (typeof motionIntents)[number];\n\n/**\n * Reduced-motion policy per intent. Chosen from the four BeeUI-supported strategies:\n * - \`immediate\`: skip animation entirely and jump to the final state;\n * - \`opacity-or-state\`: keep the opacity/state change, drop spatial (transform/size) motion;\n * - \`shorten\`: keep the motion but clamp its duration to the fast token;\n * - \`remove-spatial\`: keep non-spatial timing, drop spatial motion.\n */\nexport type MotionReducedMotionPolicy = ${MOTION_REDUCED_POLICIES.map((policy) => `'${policy}'`).join(' | ')};\n\n/**\n * Semantic motion vocabulary for recurring spatial/state transitions.\n *\n * Token presence never makes animation mandatory. Web and native representations may\n * differ while sharing a semantic intent; no frame- or time-identical parity is promised.\n * Raw spring physics (\`stiffness\`, \`damping\`, \`mass\`; unitless React-Native spring units)\n * are an implementation detail behind the semantic name, not the primary public API.\n */\nexport const motion = ${ts(motionValues(source))} as const;\n\nexport type MotionSpec = (typeof motion)[MotionIntent];\n\nexport type ResolvedMotion = {\n  /** Whether the caller should animate at all (false means jump to the final state). */\n  animate: boolean;\n  /** Effective web duration in milliseconds after any reduced-motion policy. */\n  durationMs: number;\n  /** Whether spatial (transform/size) motion should be applied. */\n  spatial: boolean;\n  /** Whether a reduced-motion policy changed the base specification. */\n  reducedMotionApplied: boolean;\n};\n\n/**\n * Resolve a semantic motion intent against the caller-supplied reduced-motion signal.\n *\n * BeeUI adds no motion/preference store: the platform or app owns the reduced-motion\n * signal (e.g. \`AccessibilityInfo.isReduceMotionEnabled\` on native, the\n * \`prefers-reduced-motion\` media query on web) and passes it in. The final state is the\n * same in every branch; reduced motion only changes how (or whether) the transition plays.\n */\nexport function resolveMotion(\n  intent: MotionIntent,\n  options: { reducedMotion?: boolean } = {},\n): ResolvedMotion {\n  const spec = motion[intent];\n  const baseDurationMs = spec.web.durationMs;\n  const spatialByDefault = spec.web.properties.some(\n    (property) => property === 'transform' || property === 'height',\n  );\n\n  if (!options.reducedMotion) {\n    return {\n      animate: true,\n      durationMs: baseDurationMs,\n      spatial: spatialByDefault,\n      reducedMotionApplied: false,\n    };\n  }\n\n  // The active intents only use a subset of policies; the exhaustive switch keeps the\n  // resolver correct if a future intent adopts \`shorten\` or \`remove-spatial\`.\n  switch (spec.reducedMotion as MotionReducedMotionPolicy) {\n    case 'immediate':\n      return { animate: false, durationMs: 0, spatial: false, reducedMotionApplied: true };\n    case 'shorten':\n      return {\n        animate: true,\n        durationMs: Math.min(baseDurationMs, motionDuration.fast),\n        spatial: spatialByDefault,\n        reducedMotionApplied: true,\n      };\n    case 'opacity-or-state':\n    case 'remove-spatial':\n      return {\n        animate: true,\n        durationMs: baseDurationMs,\n        spatial: false,\n        reducedMotionApplied: true,\n      };\n  }\n}\n\nexport const focusRing = ${ts(focusRing)} as const satisfies {\n  width: number;\n  offset: number;\n  colorToken: SemanticColorToken;\n  webVisibility: 'focus-visible';\n  nativeVisibility: 'platform-focus';\n};\n`;
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
  lines.push(`  --font-mono: ${monoStackCss};`);
  lines.push('');
  for (const [name, value] of Object.entries(controlSize)) {
    const variable = name === 'touchTarget' ? 'touch-target' : `control-${name}`;
    lines.push(`  --spacing-${variable}: ${pxToRem(value, reference)};`);
  }
  for (const [name, value] of Object.entries(iconSize)) lines.push(`  --spacing-icon-${name}: ${pxToRem(value, reference)};`);
  for (const [name, value] of Object.entries(avatarSize)) lines.push(`  --spacing-avatar-${name}: ${pxToRem(value, reference)};`);
  for (const [name, value] of Object.entries(pageGutter)) lines.push(`  --spacing-page-gutter-${name}: ${pxToRem(value, reference)};`);
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
  for (const [themeIndex, themeName] of meta.runtimeThemeNames.entries()) {
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
    lines.push('    }');
    if (themeIndex < meta.runtimeThemeNames.length - 1) lines.push('');
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
