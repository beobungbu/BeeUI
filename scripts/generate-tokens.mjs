#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATOR_PATH = 'scripts/generate-tokens.mjs';
const CANONICAL_PATH = 'packages/tokens/tokens.json';
const ARTIFACT_PATHS = [
  'packages/tokens/src/index.ts',
  'packages/tokens/src/theme.css',
  'packages/tokens/src/tokens.json',
];
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid canonical tokens: ${message}`);
}

function publicEntries(group) {
  invariant(group && typeof group === 'object', 'token group must be an object');
  return Object.entries(group).filter(([name]) => !name.startsWith('$'));
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
      invariant(typeof value.value === 'number', `${name} must contain a numeric value`);
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

export function validateCanonicalTokens(source) {
  const { metadata, semanticColors, themes, tokens } = source;
  invariant(source.$schema && source.$description, '$schema and $description are required');
  invariant(metadata?.cssPixelReference === 16, 'cssPixelReference must preserve the accepted 16px baseline');

  for (const [name, values] of Object.entries({
    themeNames: metadata.themeNames,
    brandNames: metadata.brandNames,
    runtimeThemeNames: metadata.runtimeThemeNames,
  })) {
    invariant(Array.isArray(values) && values.length > 0, `${name} must be a non-empty array`);
    assertUnique(values, name);
  }

  const semanticNames = publicEntries(semanticColors).map(([name]) => name);
  invariant(semanticNames.length > 0, 'semanticColors must define at least one token');
  assertUnique(semanticNames, 'semanticColors');

  assertExactNames(Object.keys(themes), metadata.runtimeThemeNames, 'themes');
  for (const themeName of metadata.runtimeThemeNames) {
    const colors = themes[themeName]?.colors;
    const names = Object.keys(colors ?? {});
    assertExactNames(names, semanticNames, `${themeName} semantic colors`);
    for (const [name, token] of Object.entries(colors)) {
      invariant(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(token?.$value), `${themeName}.${name} must be a 6- or 8-digit hex color`);
    }
  }

  for (const brandName of metadata.brandNames) {
    const mapping = metadata.runtimeThemeByBrand?.[brandName];
    assertExactNames(Object.keys(mapping ?? {}), metadata.themeNames, `${brandName} appearance mapping`);
    for (const runtimeName of Object.values(mapping)) {
      invariant(metadata.runtimeThemeNames.includes(runtimeName), `${brandName} maps to unknown runtime theme ${runtimeName}`);
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
  dimensionValues(tokens.motionDuration, 'ms');
  tokenValues(tokens.fontFamily);
  tokenValues(tokens.fontWeight);
  tokenValues(tokens.elevation);
  tokenValues(tokens.motionEasing);

  const focus = tokens.focusRing?.$value;
  invariant(focus?.width?.unit === 'px' && focus?.offset?.unit === 'px', 'focusRing dimensions must use px');
  invariant(semanticNames.includes(focus?.colorToken), 'focusRing.colorToken must be a semantic color token');

  return source;
}

function ts(value) {
  return JSON.stringify(value, null, 2);
}

function formatNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function pxToRem(value, reference) {
  return `${formatNumber(value / reference)}rem`;
}

function pxToEm(value, reference) {
  return `${formatNumber(value / reference)}em`;
}

function renderIndex(source) {
  const { metadata, semanticColors, tokens } = source;
  const semanticNames = publicEntries(semanticColors).map(([name]) => name);
  const focusValue = tokens.focusRing.$value;
  const focusRing = {
    width: focusValue.width.value,
    offset: focusValue.offset.value,
    colorToken: focusValue.colorToken,
    webVisibility: focusValue.webVisibility,
    nativeVisibility: focusValue.nativeVisibility,
  };

  return `// AUTO-GENERATED — DO NOT EDIT DIRECTLY.\n// Canonical source: ${CANONICAL_PATH}\n// Generator: ${GENERATOR_PATH}\n\nexport const beeThemeNames = ${ts(metadata.themeNames)} as const;\n\nexport type BeeThemeName = (typeof beeThemeNames)[number];\n\nexport const beeBrandNames = ${ts(metadata.brandNames)} as const;\n\nexport type BeeBrandName = (typeof beeBrandNames)[number];\n\nexport const beeRuntimeThemeNames = ${ts(metadata.runtimeThemeNames)} as const;\n\nexport type BeeRuntimeThemeName = (typeof beeRuntimeThemeNames)[number];\n\nexport const beeRuntimeThemeByBrand = ${ts(metadata.runtimeThemeByBrand)} as const satisfies Record<BeeBrandName, Record<BeeThemeName, BeeRuntimeThemeName>>;\n\nexport function resolveBeeRuntimeTheme(\n  brand: BeeBrandName,\n  theme: BeeThemeName,\n): BeeRuntimeThemeName {\n  return beeRuntimeThemeByBrand[brand][theme];\n}\n\nexport function getBeeThemeSelection(runtimeTheme: string):\n  | { brand: BeeBrandName; theme: BeeThemeName }\n  | undefined {\n  for (const brand of beeBrandNames) {\n    for (const theme of beeThemeNames) {\n      if (beeRuntimeThemeByBrand[brand][theme] === runtimeTheme) {\n        return { brand, theme };\n      }\n    }\n  }\n\n  return undefined;\n}\n\nexport function isBeeDarkRuntimeTheme(runtimeTheme: string) {\n  return getBeeThemeSelection(runtimeTheme)?.theme === 'dark';\n}\n\nexport const semanticColorTokens = ${ts(semanticNames)} as const;\n\nexport type SemanticColorToken = (typeof semanticColorTokens)[number];\nexport type SemanticColorVariableName = \`--color-\${SemanticColorToken}\`;\nexport type SemanticColorOverrides = Partial<Record<SemanticColorVariableName, string>>;\n\nexport function semanticColorVariable(token: SemanticColorToken): SemanticColorVariableName {\n  return \`--color-\${token}\`;\n}\n\nexport function defineSemanticColorOverrides<const T extends SemanticColorOverrides>(\n  overrides: T,\n): Readonly<T> {\n  return Object.freeze({ ...overrides });\n}\n\nexport const spacing = ${ts(dimensionValues(tokens.spacing))} as const;\n\nexport const radius = ${ts(dimensionValues(tokens.radius))} as const;\n\n/**\n * \`system\` means the platform default font. BeeUI deliberately does not force a\n * font-family utility until the consuming app loads and names a cross-platform font.\n */\nexport const fontFamily = ${ts(tokenValues(tokens.fontFamily))} as const;\n\nexport const fontSize = ${ts(dimensionValues(tokens.fontSize))} as const;\n\nexport const lineHeight = ${ts(dimensionValues(tokens.lineHeight))} as const;\n\nexport const fontWeight = ${ts(tokenValues(tokens.fontWeight))} as const;\n\nexport const letterSpacing = ${ts(dimensionValues(tokens.letterSpacing))} as const;\n\nexport type TypographyRole = keyof typeof fontSize;\n\nexport const controlSize = ${ts(dimensionValues(tokens.controlSize))} as const;\n\nexport const iconSize = ${ts(dimensionValues(tokens.iconSize))} as const;\n\nexport const avatarSize = ${ts(dimensionValues(tokens.avatarSize))} as const;\n\nexport const contentWidth = ${ts(dimensionValues(tokens.contentWidth))} as const;\n\nexport const elevation = ${ts(tokenValues(tokens.elevation))} as const;\n\nexport type ElevationLevel = keyof typeof elevation;\n\nexport const motionDuration = ${ts(dimensionValues(tokens.motionDuration, 'ms'))} as const;\n\nexport const motionEasing = ${ts(tokenValues(tokens.motionEasing))} as const;\n\nexport const focusRing = ${ts(focusRing)} as const satisfies {\n  width: number;\n  offset: number;\n  colorToken: SemanticColorToken;\n  webVisibility: 'focus-visible';\n  nativeVisibility: 'platform-focus';\n};\n`;
}

function renderThemeCss(source) {
  const { metadata, semanticColors, themes, tokens } = source;
  const reference = metadata.cssPixelReference;
  const semanticNames = publicEntries(semanticColors).map(([name]) => name);
  const radius = dimensionValues(tokens.radius);
  const fontSize = dimensionValues(tokens.fontSize);
  const lineHeight = dimensionValues(tokens.lineHeight);
  const fontWeight = tokenValues(tokens.fontWeight);
  const letterSpacing = dimensionValues(tokens.letterSpacing);
  const controlSize = dimensionValues(tokens.controlSize);
  const iconSize = dimensionValues(tokens.iconSize);
  const avatarSize = dimensionValues(tokens.avatarSize);
  const contentWidth = dimensionValues(tokens.contentWidth);
  const elevation = tokenValues(tokens.elevation);
  const motionDuration = dimensionValues(tokens.motionDuration, 'ms');
  const motionEasing = tokenValues(tokens.motionEasing);
  const focus = tokens.focusRing.$value;
  const customThemes = metadata.runtimeThemeNames.filter((name) => !metadata.themeNames.includes(name));
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
  for (const [name, value] of Object.entries(elevation)) {
    const token = tokens.elevation[name];
    lines.push(`  --shadow-${name}: ${token.$extensions?.['com.beeui.cssValue'] ?? value.web};`);
  }
  lines.push('');
  for (const [name, value] of Object.entries(motionEasing)) lines.push(`  --ease-${name}: ${value};`);
  lines.push('}', '', '@theme static {');
  for (const [name, value] of Object.entries(motionDuration)) lines.push(`  --motion-duration-${name}: ${value}ms;`);
  lines.push(`  --focus-ring-width: ${focus.width.value}px;`);
  lines.push(`  --focus-ring-offset: ${focus.offset.value}px;`);
  lines.push('}', '', '@utility bee-focus-ring {');
  lines.push('  outline-color: var(--color-focus-ring);');
  lines.push('  outline-offset: var(--focus-ring-offset);');
  lines.push('  outline-style: solid;');
  lines.push('  outline-width: var(--focus-ring-width);');
  lines.push('}', '', '@layer theme {', '  :root {');
  for (const [themeIndex, themeName] of metadata.runtimeThemeNames.entries()) {
    lines.push(`    @variant ${themeName} {`);
    for (const name of semanticNames) lines.push(`      --color-${name}: ${themes[themeName].colors[name].$value};`);
    lines.push('    }');
    if (themeIndex < metadata.runtimeThemeNames.length - 1) lines.push('');
  }
  lines.push('  }', '}', '');
  return lines.join('\n');
}

function renderMachineArtifact(source) {
  return `${JSON.stringify(
    {
      $generated: {
        notice: 'AUTO-GENERATED — DO NOT EDIT DIRECTLY',
        canonicalSource: CANONICAL_PATH,
        generator: GENERATOR_PATH,
      },
      ...source,
    },
    null,
    2,
  )}\n`;
}

export function generateTokenArtifacts(source) {
  validateCanonicalTokens(source);
  return new Map([
    [ARTIFACT_PATHS[0], renderIndex(source)],
    [ARTIFACT_PATHS[1], renderThemeCss(source)],
    [ARTIFACT_PATHS[2], renderMachineArtifact(source)],
  ]);
}

export function loadCanonicalTokens(sourcePath = path.join(ROOT_DIR, CANONICAL_PATH)) {
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
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
