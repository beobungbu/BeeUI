import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateTokenArtifacts,
  loadCanonicalTokens,
  validateCanonicalTokens,
} from '../generate-tokens.mjs';

const source = loadCanonicalTokens();
const artifacts = generateTokenArtifacts(source);
const indexTs = artifacts.get('packages/tokens/src/index.ts');

function beeExtension(group) {
  return group?.$extensions?.['com.beeui'] ?? {};
}

test('exactly radius and motionDuration are flagged runtimeOverridable in canonical metadata', () => {
  const overridable = Object.keys(source.tokens).filter(
    (name) => beeExtension(source.tokens[name]).runtimeOverridable === true,
  );
  assert.deepEqual(overridable.sort(), ['motionDuration', 'radius']);
});

test('every other canonical token group is explicit and false, never ambiguous', () => {
  for (const groupName of Object.keys(source.tokens)) {
    if (groupName === 'radius' || groupName === 'motionDuration') continue;
    const runtimeOverridable = beeExtension(source.tokens[groupName]).runtimeOverridable;
    assert.ok(
      runtimeOverridable === undefined || runtimeOverridable === false,
      `${groupName} must not be flagged runtimeOverridable: true without a registered CSS builder`,
    );
  }
});

test('generated themeOverrideClassification is an explicit four-way-safe table for every token group', () => {
  assert.match(indexTs, /export const themeOverrideClassification = \{/);
  for (const groupName of Object.keys(source.tokens)) {
    assert.match(indexTs, new RegExp(`"${groupName}":\\s*\\{`));
  }
  // radius/motionDuration are the only groups whose generated entry declares `true`.
  const trueCount = (indexTs.match(/"runtimeOverridable": true/g) ?? []).length;
  assert.equal(trueCount, 2);
});

test('the private authoring token group never leaks into public generated artifacts', () => {
  assert.doesNotMatch(indexTs, /\bprimitives\b/);
});

test('themeOverrideCategories only contains colors, radius, and motion — no arbitrary token exposure', () => {
  assert.match(indexTs, /const themeOverrideCategories = \{/);
  assert.match(indexTs, /^\s*colors: \{/m);
  assert.match(indexTs, /^\s*radius: \{/m);
  assert.match(indexTs, /^\s*motion: \{/m);
  // build-time/invariant/private groups are never instantiated as categories.
  for (const excluded of ['breakpoint', 'pageGutter', 'contentWidth', 'controlSize', 'fontSize', 'elevation', 'layer']) {
    assert.doesNotMatch(indexTs, new RegExp(`^\\s*${excluded}: \\{\\n\\s*keys:`, 'm'));
  }
});

test('generated CSS-variable builders match the exact convention theme.css already emits', () => {
  assert.match(indexTs, /variable: \(key: keyof typeof radius\) => `--radius-\$\{key\}` as const/);
  assert.match(indexTs, /format: \(value: number\) => `\$\{value\}px`/);
  assert.match(indexTs, /variable: \(key: keyof typeof motionDuration\) => `--motion-duration-\$\{key\}` as const/);
  assert.match(indexTs, /format: \(value: number\) => `\$\{value\}ms`/);
});

test('unsetting a group\'s runtimeOverridable flag and regenerating removes its override category', () => {
  const mutated = structuredClone(source);
  mutated.tokens.radius.$extensions['com.beeui'].runtimeOverridable = false;
  const mutatedIndexTs = generateTokenArtifacts(mutated).get('packages/tokens/src/index.ts');
  assert.doesNotMatch(mutatedIndexTs, /^\s*radius: \{\n\s*keys: Object\.keys\(radius\)/m);
  const classificationMatch = mutatedIndexTs.match(/"radius":\s*\{[^}]*\}/);
  assert.ok(classificationMatch, 'radius classification entry must still be present');
  assert.match(classificationMatch[0], /"runtimeOverridable": false/);
  // motion is untouched by this mutation.
  assert.match(mutatedIndexTs, /^\s*motion: \{/m);
});

test('flagging an unregistered group runtimeOverridable fails fast instead of silently doing nothing', () => {
  const mutated = structuredClone(source);
  mutated.tokens.spacing.$extensions = { 'com.beeui': { runtimeOverridable: true } };
  assert.throws(
    () => validateCanonicalTokens(mutated),
    /"spacing" is flagged runtimeOverridable but generate-tokens\.mjs has no registered Uniwind CSS-variable convention/,
  );
});

test('the runtime-override surface composes with the existing color-only compatibility helper', () => {
  // `defineThemeOverrides({ colors: { <token> } })` and `defineSemanticColorOverrides({ '--color-<token>': ... })`
  // must be two entry points to the identical `--color-*` representation.
  assert.match(indexTs, /export function defineSemanticColorOverrides/);
  assert.match(indexTs, /export const defineThemeOverrides = createThemeOverridesDefiner\(themeOverrideCategories\);/);
  assert.match(indexTs, /keys: semanticColorTokens,/);
  assert.match(indexTs, /variable: \(key: SemanticColorToken\) => semanticColorVariable\(key\),/);
});

test('the authored engine is imported, never hand-duplicated inside the generated file', () => {
  assert.match(indexTs, /import \{ createThemeOverridesDefiner, type OverrideCategoryMap, type ThemeOverridesInput \} from '\.\/theme-overrides';/);
  assert.match(indexTs, /export \* from '\.\/theme-overrides';/);
});
