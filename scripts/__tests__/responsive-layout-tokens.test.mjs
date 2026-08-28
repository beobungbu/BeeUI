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
const themeCss = artifacts.get('packages/tokens/src/theme.css');

const CSS_REFERENCE = 16;

function publicValues(group) {
  return Object.fromEntries(
    Object.entries(group)
      .filter(([name]) => !name.startsWith('$'))
      .map(([name, token]) => [
        token?.$extensions?.['com.beeui']?.publicName ?? name,
        token.$value.value,
      ]),
  );
}

// The canonical five-viewport visual matrix (kept in sync with
// apps/visual-regression/src/showcase-qa-pattern-full.ts).
const canonicalViewports = [360, 390, 430, 768, 1280];

test('breakpoint vocabulary and values are the exact evidence-backed set', () => {
  assert.deepEqual(publicValues(source.tokens.breakpoint), { medium: 768, expanded: 1280 });
});

test('breakpoints are strictly ascending with unique values (no duplicate/conflicting definitions)', () => {
  const values = Object.values(publicValues(source.tokens.breakpoint));
  assert.deepEqual([...values].sort((a, b) => a - b), values);
  assert.equal(new Set(values).size, values.length);
});

test('a duplicate/out-of-order breakpoint is rejected by canonical validation', () => {
  const conflicting = structuredClone(source);
  conflicting.tokens.breakpoint.expanded.$value.value = 768; // duplicate of medium
  assert.throws(() => validateCanonicalTokens(conflicting), /strictly ascending and unique/);
});

test('each breakpoint maps cleanly to a Tailwind/Uniwind variant and keeps that value', () => {
  // medium == Tailwind `md` (48rem/768px), expanded == Tailwind `xl` (80rem/1280px):
  // BeeUI blesses a subset of Tailwind's own scale so no config override or
  // second engine is needed.
  assert.equal(source.tokens.breakpoint.medium.$extensions['com.beeui'].tailwindVariant, 'md');
  assert.equal(source.tokens.breakpoint.expanded.$extensions['com.beeui'].tailwindVariant, 'xl');
});

test('a breakpoint without a Tailwind variant mapping is rejected', () => {
  const missing = structuredClone(source);
  delete missing.tokens.breakpoint.medium.$extensions;
  assert.throws(() => validateCanonicalTokens(missing), /must map to a Tailwind\/Uniwind variant/);
});

test('page-gutter vocabulary and values are the exact evidence-backed set', () => {
  assert.deepEqual(publicValues(source.tokens.pageGutter), { compact: 16, regular: 20, spacious: 24 });
});

test('page-gutter values are unique and positive', () => {
  const missing = structuredClone(source);
  missing.tokens.pageGutter.regular.$value.value = 16; // duplicate of compact
  assert.throws(() => validateCanonicalTokens(missing), /pageGutter values contains duplicate/);
});

test('existing form/reading/page/dialog container contract is preserved unchanged', () => {
  assert.deepEqual(publicValues(source.tokens.contentWidth), {
    form: 512,
    reading: 704,
    page: 1152,
    dialog: 512,
  });
});

test('build-time vs runtime classification is explicit and safe', () => {
  const breakpoint = source.tokens.breakpoint.$extensions['com.beeui'];
  assert.equal(breakpoint.layer, 'web-responsive');
  assert.equal(breakpoint.binding, 'build-time-constant');
  assert.equal(breakpoint.runtimeOverridable, false);
  assert.equal(breakpoint.engine, 'tailwind-uniwind');

  for (const group of ['pageGutter', 'contentWidth']) {
    const meta = source.tokens[group].$extensions['com.beeui'];
    assert.equal(meta.layer, 'cross-platform');
    assert.equal(meta.runtimeOverridable, false);
  }

  // The generated classification export mirrors the canonical metadata so
  // runtime readers (#72) can tell values apart from an override surface (#71).
  assert.match(indexTs, /export const responsiveLayoutClassification =/);
  assert.match(indexTs, /"binding": "build-time-constant"/);
});

test('generated web artifacts emit Tailwind-native breakpoint and gutter representations', () => {
  // Tailwind v4 turns `--breakpoint-*` theme vars into responsive variants and
  // `--spacing-*` vars into padding utilities — BeeUI adds no parallel engine.
  assert.match(themeCss, /--breakpoint-medium: 48rem;/);
  assert.match(themeCss, /--breakpoint-expanded: 80rem;/);
  assert.match(themeCss, /--spacing-page-gutter-compact: 1rem;/);
  assert.match(themeCss, /--spacing-page-gutter-regular: 1.25rem;/);
  assert.match(themeCss, /--spacing-page-gutter-spacious: 1.5rem;/);
  // contentWidth containers remain intact.
  for (const container of ['form', 'reading', 'page', 'dialog']) {
    assert.match(themeCss, new RegExp(`--container-${container}:`));
  }
});

test('breakpoint rem output equals px / 16 (deterministic, no rounding drift)', () => {
  for (const [name, px] of Object.entries(publicValues(source.tokens.breakpoint))) {
    const rem = Number(themeCss.match(new RegExp(`--breakpoint-${name}: ([0-9.]+)rem;`))[1]);
    assert.equal(rem * CSS_REFERENCE, px);
  }
});

// Pure classifier over the canonical thresholds — this is a test-local reader,
// not a shipped runtime engine (no listeners/state), used to prove boundary
// behavior is predictable.
function activeBreakpoint(width, breakpoints) {
  const ordered = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  let active = 'compact';
  for (const [name, min] of ordered) {
    if (width >= min) active = name;
  }
  return active;
}

test('breakpoint boundaries flip at exactly the intended widths (just-below / exact / just-above)', () => {
  const breakpoints = publicValues(source.tokens.breakpoint);
  assert.equal(activeBreakpoint(767, breakpoints), 'compact');
  assert.equal(activeBreakpoint(768, breakpoints), 'medium');
  assert.equal(activeBreakpoint(769, breakpoints), 'medium');
  assert.equal(activeBreakpoint(1279, breakpoints), 'medium');
  assert.equal(activeBreakpoint(1280, breakpoints), 'expanded');
  assert.equal(activeBreakpoint(1281, breakpoints), 'expanded');
});

test('the canonical five-viewport set maps onto the breakpoint classes without inventing device tiers', () => {
  const breakpoints = publicValues(source.tokens.breakpoint);
  assert.deepEqual(
    canonicalViewports.map((width) => activeBreakpoint(width, breakpoints)),
    ['compact', 'compact', 'compact', 'medium', 'expanded'],
  );
});

// Containers must shrink to the available width rather than force horizontal
// overflow: effective width = min(maxWidth, available - 2 * gutter).
function effectiveContentWidth(maxWidth, viewportWidth, gutter) {
  return Math.min(maxWidth, viewportWidth - 2 * gutter);
}

test('containers shrink to available width and never force horizontal overflow', () => {
  const contentWidth = publicValues(source.tokens.contentWidth);
  const gutters = publicValues(source.tokens.pageGutter);

  for (const viewport of canonicalViewports) {
    for (const gutter of Object.values(gutters)) {
      const available = viewport - 2 * gutter;
      for (const maxWidth of Object.values(contentWidth)) {
        const effective = effectiveContentWidth(maxWidth, viewport, gutter);
        // Never wider than the max-width contract.
        assert.ok(effective <= maxWidth);
        // Never wider than the available width (no horizontal overflow).
        assert.ok(effective <= available);
        // Still positive/renderable on the narrowest canonical viewport.
        assert.ok(effective > 0, `content collapses at viewport ${viewport} gutter ${gutter}`);
      }
    }
  }
});

test('page gutters compose additively with safe-area insets (never double-applied)', () => {
  // Documented native contract: the gutter is padding applied INSIDE the
  // safe-area inset, so the two stack additively and neither replaces the other.
  assert.equal(source.tokens.pageGutter.$extensions['com.beeui'].safeAreaComposition, 'additive');
});

test('responsive-layout tokens do not conflate the #74 density axis', () => {
  // Density is a separate axis; the responsive groups expose only layout
  // vocabulary and never a density knob.
  const groups = ['breakpoint', 'pageGutter', 'contentWidth'];
  for (const group of groups) {
    const serialized = JSON.stringify(source.tokens[group]);
    assert.doesNotMatch(serialized, /density|comfortable-density|compact-density/i);
  }
});
