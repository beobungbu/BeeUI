import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  generateTokenArtifacts,
  loadCanonicalTokens,
  validateCanonicalTokens,
} from '../generate-tokens.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = loadCanonicalTokens();

function semanticNames(tokens = source) {
  return Object.keys(tokens.semanticColors).filter((name) => !name.startsWith('$'));
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

test('one canonical mutation propagates to both TypeScript and CSS outputs', () => {
  const mutated = structuredClone(source);
  mutated.tokens.fontSize.body.$value.value = 17;
  const artifacts = generateTokenArtifacts(mutated);

  assert.match(artifacts.get('packages/tokens/src/index.ts'), /"body": 17/);
  assert.match(artifacts.get('packages/tokens/src/theme.css'), /--text-body: 1\.0625rem;/);
});

test('every runtime theme implements the exact unique semantic vocabulary', () => {
  const expected = semanticNames();
  assert.equal(new Set(expected).size, expected.length);
  for (const name of source.metadata.runtimeThemeNames) {
    const actual = Object.keys(source.themes[name].colors);
    assert.equal(new Set(actual).size, actual.length);
    assert.deepEqual([...actual].sort(), [...expected].sort(), name);
  }
});

test('the accepted #65, #66, and brand mapping values remain canonical', () => {
  assert.deepEqual(source.metadata.runtimeThemeByBrand, {
    bee: { light: 'light', dark: 'dark' },
    violet: { light: 'violet-light', dark: 'violet-dark' },
  });
  assert.equal(source.themes.light.colors['primary-hover'].$value, '#e58a05');
  assert.equal(source.themes.light.colors['primary-pressed'].$value, '#d97706');
  assert.equal(source.themes['violet-dark'].colors['primary-pressed'].$value, '#9066f4');
  assert.deepEqual(
    source.metadata.runtimeThemeNames.map((theme) => source.themes[theme].colors['control-border'].$value),
    ['#8590a2', '#667085', '#9488a4', '#786d87'],
  );
});

test('letter-spacing px and CSS em representations are intentionally equivalent at 16px', () => {
  const canonicalPx = source.tokens.letterSpacing.tight.$value.value;
  const referencePx = source.metadata.cssPixelReference;
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

test('machine-readable artifact identifies its canonical ownership', () => {
  const artifact = JSON.parse(
    generateTokenArtifacts(source).get('packages/tokens/src/tokens.json'),
  );
  assert.equal(artifact.$generated.notice, 'AUTO-GENERATED — DO NOT EDIT DIRECTLY');
  assert.equal(artifact.$generated.canonicalSource, 'packages/tokens/tokens.json');
  assert.equal(artifact.$generated.generator, 'scripts/generate-tokens.mjs');
});
