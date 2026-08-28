import assert from 'node:assert/strict';
import test from 'node:test';

import {
  densityMetricGroupNames,
  densityModeNames,
  densityVariableName,
  generateTokenArtifacts,
  kebabCase,
  loadCanonicalTokens,
  validateCanonicalTokens,
} from '../generate-tokens.mjs';

const source = loadCanonicalTokens();
const artifacts = generateTokenArtifacts(source);
const indexTs = artifacts.get('packages/tokens/src/index.ts');
const themeCss = artifacts.get('packages/tokens/src/theme.css');

function beeExtension(node) {
  return node?.$extensions?.['com.beeui'] ?? {};
}

function publicValues(group) {
  return Object.fromEntries(
    Object.entries(group)
      .filter(([name]) => !name.startsWith('$'))
      .map(([name, token]) => [name, token.$value.value]),
  );
}

test('the approved density-mode vocabulary is exactly compact/comfortable/spacious', () => {
  assert.deepEqual(densityModeNames(source), ['compact', 'comfortable', 'spacious']);
  assert.equal(source.$extensions['com.beeui'].densityIntents.defaultMode, 'comfortable');
});

test('exactly rowHeight, rowGap, and formGap are flagged com.beeui.densityAxis', () => {
  assert.deepEqual(densityMetricGroupNames(source).sort(), ['formGap', 'rowGap', 'rowHeight']);
  for (const groupName of Object.keys(source.tokens)) {
    if (['formGap', 'rowGap', 'rowHeight'].includes(groupName)) continue;
    assert.notEqual(beeExtension(source.tokens[groupName]).densityAxis, true, `${groupName} must not be flagged densityAxis`);
  }
});

test('every density metric group defines exactly the approved mode vocabulary as its keys', () => {
  for (const groupName of densityMetricGroupNames(source)) {
    assert.deepEqual(
      Object.keys(publicValues(source.tokens[groupName])).sort(),
      [...densityModeNames(source)].sort(),
    );
  }
});

test('comfortable density preserves the exact pre-#74 literal for every metric', () => {
  // rowHeight/rowGap: `min-h-14`/`gap-3` on ListItem before #74 (56px / 12px).
  // formGap: `gap-2` on FormGroup/Field before #74 (8px).
  assert.deepEqual(publicValues(source.tokens.rowHeight), { compact: 44, comfortable: 56, spacious: 64 });
  assert.deepEqual(publicValues(source.tokens.rowGap), { compact: 8, comfortable: 12, spacious: 16 });
  assert.deepEqual(publicValues(source.tokens.formGap), { compact: 4, comfortable: 8, spacious: 12 });
});

test('density values are deterministic — strictly ascending compact < comfortable < spacious for every metric', () => {
  for (const groupName of densityMetricGroupNames(source)) {
    const values = densityModeNames(source).map((mode) => publicValues(source.tokens[groupName])[mode]);
    assert.deepEqual([...values].sort((a, b) => a - b), values);
    assert.equal(new Set(values).size, values.length);
  }
});

test('compact rowHeight never falls below the canonical native touch-target minimum', () => {
  const touchTarget = publicValues(source.tokens.controlSize).touchTarget;
  assert.equal(touchTarget, 44);
  const rowHeight = publicValues(source.tokens.rowHeight);
  assert.ok(rowHeight.compact >= touchTarget, `rowHeight.compact (${rowHeight.compact}px) must be >= touchTarget (${touchTarget}px)`);
  assert.ok(rowHeight.comfortable >= touchTarget);
  assert.ok(rowHeight.spacious >= touchTarget);
});

test('rowHeight is flagged nativeHitTargetSensitive; rowGap/formGap (not interactive geometry) are not', () => {
  assert.equal(beeExtension(source.tokens.rowHeight).nativeHitTargetSensitive, true);
  assert.notEqual(beeExtension(source.tokens.rowGap).nativeHitTargetSensitive, true);
  assert.notEqual(beeExtension(source.tokens.formGap).nativeHitTargetSensitive, true);
});

test('an out-of-vocabulary density mode on a metric group is rejected', () => {
  const mutated = structuredClone(source);
  mutated.tokens.rowHeight.roomy = mutated.tokens.rowHeight.compact;
  assert.throws(() => validateCanonicalTokens(mutated), /rowHeight density modes must contain exactly/);
});

test('a metric group missing one of the approved modes is rejected', () => {
  const mutated = structuredClone(source);
  delete mutated.tokens.rowGap.spacious;
  assert.throws(() => validateCanonicalTokens(mutated), /rowGap density modes must contain exactly/);
});

test('lowering compact rowHeight below the touch-target minimum is rejected at canonical-validation time', () => {
  const mutated = structuredClone(source);
  mutated.tokens.rowHeight.compact.$value.value = 40;
  assert.throws(
    () => validateCanonicalTokens(mutated),
    /rowHeight\.compact \(40px\) must stay >= controlSize\.touchTarget \(44px\)/,
  );
});

test('a density metric group with zero flagged groups is rejected (density must have a real effect)', () => {
  const mutated = structuredClone(source);
  for (const groupName of densityMetricGroupNames(mutated)) {
    delete mutated.tokens[groupName].$extensions['com.beeui'].densityAxis;
  }
  assert.throws(() => validateCanonicalTokens(mutated), /at least one canonical token group must be flagged com\.beeui\.densityAxis/);
});

test('densityIntents.defaultMode must be one of densityIntents.modes', () => {
  const mutated = structuredClone(source);
  mutated.$extensions['com.beeui'].densityIntents.defaultMode = 'roomy';
  assert.throws(() => validateCanonicalTokens(mutated), /defaultMode must be one of densityIntents\.modes/);
});

test('kebabCase deterministically derives the CSS-variable name from a camelCase group name', () => {
  assert.equal(kebabCase('rowHeight'), 'row-height');
  assert.equal(kebabCase('formGap'), 'form-gap');
  assert.equal(densityVariableName('rowHeight'), '--spacing-density-row-height');
  assert.equal(densityVariableName('formGap'), '--spacing-density-form-gap');
});

test('generated index.ts exposes the exact density vocabulary, metrics, and apply surface', () => {
  assert.match(indexTs, /export const densityModes = \[\n\s*"compact",\n\s*"comfortable",\n\s*"spacious"\n\]/);
  assert.match(indexTs, /export const defaultDensityMode: DensityMode = "comfortable";/);
  assert.match(indexTs, /export const densityMetrics = \{/);
  assert.match(indexTs, /export const densityMetricVariables = \{/);
  assert.match(indexTs, /export const densityPresets:/);
  assert.match(indexTs, /export function resolveDensityOverrides\(mode: DensityMode\): CompiledThemeOverrides \{/);
  assert.match(indexTs, /export function applyDensity<RuntimeThemeName extends string>\(/);
  assert.match(indexTs, /applyThemeOverrides\(uniwind, runtimeTheme, resolveDensityOverrides\(mode\)\);/);
});

test('the authored #71 engine is imported and reused, never hand-duplicated, for density', () => {
  assert.match(
    indexTs,
    /import \{ applyThemeOverrides, createThemeOverridesDefiner, type CompiledThemeOverrides, type OverrideCategoryMap, type ThemeOverridesInput, type UniwindCSSVariableClient \} from '\.\/theme-overrides';/,
  );
  // No second override-compiler exists for density: it reuses CompiledThemeOverrides'
  // exact shape (a frozen, sorted cssVariables record) via compileDensityPreset, and calls
  // the single existing applyThemeOverrides — not a hand-rolled uniwind.updateCSSVariables call.
  assert.doesNotMatch(indexTs, /updateCSSVariables/);
});

test('density metric groups are never registered as #71 defineThemeOverrides categories', () => {
  // Density switches a fixed named-mode preset into one semantic variable per metric; #71's
  // defineThemeOverrides is for arbitrary per-key customization of an existing category. The
  // two are deliberately different capabilities and are not conflated.
  assert.doesNotMatch(indexTs, /^\s*rowHeight: \{\n\s*keys:/m);
  assert.doesNotMatch(indexTs, /^\s*rowGap: \{\n\s*keys:/m);
  assert.doesNotMatch(indexTs, /^\s*formGap: \{\n\s*keys:/m);
});

test('rowHeight/rowGap/formGap are never flagged runtimeOverridable (they are not a #71 category)', () => {
  for (const groupName of densityMetricGroupNames(source)) {
    assert.notEqual(beeExtension(source.tokens[groupName]).runtimeOverridable, true);
  }
  // The existing #71 invariant (exactly radius + motionDuration) is unaffected by #74.
  const overridable = Object.keys(source.tokens).filter(
    (name) => beeExtension(source.tokens[name]).runtimeOverridable === true,
  );
  assert.deepEqual(overridable.sort(), ['motionDuration', 'radius']);
});

test('generated CSS bakes the default (comfortable) density value under the same --spacing-* namespace as controlSize/pageGutter', () => {
  assert.match(themeCss, /--spacing-density-row-height: 3\.5rem;/); // 56px
  assert.match(themeCss, /--spacing-density-row-gap: 0\.75rem;/); // 12px
  assert.match(themeCss, /--spacing-density-form-gap: 0\.5rem;/); // 8px
});

test('changing the canonical defaultMode changes which mode is baked into CSS, deterministically', () => {
  const mutated = structuredClone(source);
  mutated.$extensions['com.beeui'].densityIntents.defaultMode = 'compact';
  const css = generateTokenArtifacts(mutated).get('packages/tokens/src/theme.css');
  assert.match(css, /--spacing-density-row-height: 2\.75rem;/); // 44px
  assert.match(css, /--spacing-density-row-gap: 0\.5rem;/); // 8px
  assert.match(css, /--spacing-density-form-gap: 0\.25rem;/); // 4px
});

test('adding a new density-sensitive metric group requires no generator edits — only tokens.json + regenerate', () => {
  const mutated = structuredClone(source);
  mutated.tokens.panelPadding = {
    $type: 'dimension',
    $extensions: { 'com.beeui': { densityAxis: true } },
    compact: { $value: { value: 8, unit: 'px' } },
    comfortable: { $value: { value: 12, unit: 'px' } },
    spacious: { $value: { value: 16, unit: 'px' } },
  };
  const mutatedIndexTs = generateTokenArtifacts(mutated).get('packages/tokens/src/index.ts');
  assert.match(mutatedIndexTs, /"panelPadding": \{/);
  assert.match(mutatedIndexTs, /"panelPadding": "--spacing-density-panel-padding"/);
  const mutatedCss = generateTokenArtifacts(mutated).get('packages/tokens/src/theme.css');
  assert.match(mutatedCss, /--spacing-density-panel-padding: 0\.75rem;/); // 12px comfortable
});
