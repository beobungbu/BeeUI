import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateTokenArtifacts,
  loadCanonicalTokens,
  validateCanonicalTokens,
} from '../generate-tokens.mjs';
import {
  assertRemovalAllowed,
  buildLifecycleManifest,
  buildMigrationReport,
  collectGovernedTokens,
  validateTokenLifecycle,
} from '../token-lifecycle.mjs';

const source = loadCanonicalTokens();

function withBeeExtension(node, lifecycle) {
  node.$extensions = { ...(node.$extensions ?? {}), 'com.beeui': { ...(node.$extensions?.['com.beeui'] ?? {}), lifecycle } };
  return node;
}

function deprecateRadiusFixture(overrides = {}) {
  const fixture = structuredClone(source);
  withBeeExtension(fixture.tokens.radius.xs, {
    status: 'deprecated',
    since: '0.1.0',
    reason: 'Renamed for scale clarity.',
    replacement: 'radius.sm',
    removal: { target: '0.2.0' },
    ...overrides,
  });
  return fixture;
}

function deprecateSemanticColorFixture() {
  const fixture = structuredClone(source);
  const meta = fixture.$extensions['com.beeui'];
  meta.semanticColorLifecycle = {
    'surface-raised': {
      status: 'deprecated',
      since: '0.1.0',
      reason: 'Consolidated onto the base surface token.',
      replacement: 'color.surface',
    },
  };
  return fixture;
}

test('production model initializes every governed token as stable with no deprecations', () => {
  const manifest = buildLifecycleManifest(source);
  assert.equal(manifest.summary.deprecated, 0);
  assert.equal(manifest.summary.experimental, 0);
  assert.equal(manifest.summary.stable, manifest.summary.governed);
  assert.deepEqual(manifest.tokens, []);
  assert.equal(manifest.aliasKinds.authoring, 'publicName');
  assert.equal(manifest.aliasKinds.deprecatedCompatibility, 'deprecated-compatibility');
});

test('production migration report is empty and states no deprecations', () => {
  const report = buildMigrationReport(source);
  assert.match(report, /No deprecated tokens\./);
  assert.match(report, /No experimental tokens\./);
});

test('lifecycle schema validity accepts the canonical source', () => {
  assert.doesNotThrow(() => validateTokenLifecycle(source));
  assert.doesNotThrow(() => validateCanonicalTokens(source));
});

test('deprecated foundation token keeps its generated TS alias and gains @deprecated JSDoc', () => {
  const artifacts = generateTokenArtifacts(deprecateRadiusFixture());
  const index = artifacts.get('packages/tokens/src/index.ts');
  assert.match(index, /\/\*\* @deprecated Use `radius\.sm`\. Renamed for scale clarity\. \*\//);
  assert.match(index, /"xs": 4/);
});

test('deprecated semantic color keeps its CSS variable as a compatibility alias to the replacement', () => {
  const css = generateTokenArtifacts(deprecateSemanticColorFixture()).get('packages/tokens/src/theme.css');
  assert.match(css, /\/\* @deprecated: use --color-surface \*\//);
  assert.match(css, /--color-surface-raised: var\(--color-surface\);/);
  assert.doesNotMatch(css, /--color-surface-raised: #/);
});

test('unchanged production semantic colors still emit literal values, not aliases', () => {
  const css = generateTokenArtifacts(source).get('packages/tokens/src/theme.css');
  assert.match(css, /--color-surface-raised: #ffffff;/);
});

test('replacement target must exist', () => {
  const fixture = deprecateRadiusFixture({ replacement: 'radius.does-not-exist' });
  assert.throws(() => validateTokenLifecycle(fixture), /does not resolve to a governed token/);
});

test('a token cannot be deprecated in favor of itself', () => {
  const fixture = deprecateRadiusFixture({ replacement: 'radius.xs' });
  assert.throws(() => validateTokenLifecycle(fixture), /cannot be deprecated in favor of itself/);
});

test('replacement must stay within the same category', () => {
  const fixture = deprecateRadiusFixture({ replacement: 'spacing.4' });
  assert.throws(() => validateTokenLifecycle(fixture), /replacement must stay in category "radius"/);
});

test('replacement chains must not cycle', () => {
  const fixture = deprecateRadiusFixture({ replacement: 'radius.sm' });
  withBeeExtension(fixture.tokens.radius.sm, {
    status: 'deprecated',
    reason: 'Points back at xs to force a cycle.',
    replacement: 'radius.xs',
  });
  assert.throws(() => validateTokenLifecycle(fixture), /replacement chain cycles/);
});

test('a replacement that points at a deprecated dead-end is rejected', () => {
  const fixture = deprecateRadiusFixture({ replacement: 'radius.sm' });
  withBeeExtension(fixture.tokens.radius.sm, {
    status: 'deprecated',
    reason: 'Also on the way out, with nowhere to send consumers.',
  });
  assert.throws(() => validateTokenLifecycle(fixture), /offers no live replacement/);
});

test('a replacement staged through another deprecated token is rejected even if it eventually resolves live', () => {
  const fixture = deprecateRadiusFixture({ replacement: 'radius.sm' });
  withBeeExtension(fixture.tokens.radius.sm, {
    status: 'deprecated',
    reason: 'Intermediate hop toward the live token.',
    replacement: 'radius.md',
  });
  assert.throws(() => validateTokenLifecycle(fixture), /must point at a live token/);
});

test('a deprecated token may point directly at a live replacement', () => {
  assert.doesNotThrow(() => validateTokenLifecycle(deprecateRadiusFixture()));
});

test('a pure-removal deprecation with no replacement is allowed', () => {
  const fixture = structuredClone(source);
  withBeeExtension(fixture.tokens.radius.xs, {
    status: 'deprecated',
    reason: 'Slated for removal with no direct successor.',
  });
  assert.doesNotThrow(() => validateTokenLifecycle(fixture));
});

test('deprecation must declare a reason', () => {
  const fixture = structuredClone(source);
  withBeeExtension(fixture.tokens.radius.xs, { status: 'deprecated', replacement: 'radius.sm' });
  assert.throws(() => validateTokenLifecycle(fixture), /must declare a reason/);
});

test('standard DTCG $deprecated is honored and must agree with the lifecycle reason', () => {
  const consistent = structuredClone(source);
  consistent.tokens.radius.xs.$deprecated = 'Renamed for scale clarity.';
  withBeeExtension(consistent.tokens.radius.xs, {
    status: 'deprecated',
    reason: 'Renamed for scale clarity.',
    replacement: 'radius.sm',
  });
  assert.doesNotThrow(() => validateTokenLifecycle(consistent));

  const mismatch = structuredClone(source);
  mismatch.tokens.radius.xs.$deprecated = 'One message.';
  withBeeExtension(mismatch.tokens.radius.xs, {
    status: 'deprecated',
    reason: 'A different message.',
    replacement: 'radius.sm',
  });
  assert.throws(() => validateTokenLifecycle(mismatch), /\$deprecated message must match/);

  const contradiction = structuredClone(source);
  contradiction.tokens.radius.xs.$deprecated = 'Deprecated.';
  withBeeExtension(contradiction.tokens.radius.xs, { status: 'experimental' });
  assert.throws(() => validateTokenLifecycle(contradiction), /lifecycle status is "experimental"/);
});

test('DTCG $deprecated=false cannot contradict a BeeUI deprecated lifecycle status', () => {
  const contradiction = deprecateRadiusFixture();
  contradiction.tokens.radius.xs.$deprecated = false;
  assert.throws(
    () => validateTokenLifecycle(contradiction),
    /\$deprecated=false but lifecycle status is "deprecated"/,
  );

  const consistent = structuredClone(source);
  consistent.tokens.radius.xs.$deprecated = false;
  assert.doesNotThrow(() => validateTokenLifecycle(consistent));
});

test('lifecyclePolicy.defaultStatus drives unannotated token classification', () => {
  const fixture = structuredClone(source);
  fixture.$extensions['com.beeui'].lifecyclePolicy.defaultStatus = 'experimental';

  const governed = collectGovernedTokens(fixture);
  assert.ok(governed.length > 0);
  assert.ok(governed.every((entry) => entry.lifecycle.status === 'experimental'));

  const manifest = buildLifecycleManifest(fixture);
  assert.equal(manifest.summary.experimental, manifest.summary.governed);
  assert.equal(manifest.summary.stable, 0);
});

test('experimental tokens are supported without deprecation fields', () => {
  const fixture = structuredClone(source);
  withBeeExtension(fixture.tokens.radius.xs, { status: 'experimental', since: '0.1.0' });
  assert.doesNotThrow(() => validateTokenLifecycle(fixture));
  const manifest = buildLifecycleManifest(fixture);
  assert.equal(manifest.summary.experimental, 1);
  assert.ok(manifest.tokens.some((token) => token.path === 'radius.xs' && token.status === 'experimental'));
});

test('the machine manifest exposes deprecated tokens and replacements as the guardrail hook', () => {
  const manifest = buildLifecycleManifest(deprecateRadiusFixture());
  const entry = manifest.tokens.find((token) => token.path === 'radius.xs');
  assert.equal(entry.status, 'deprecated');
  assert.equal(entry.deprecated.replacement, 'radius.sm');
  assert.equal(entry.deprecated.aliasKind, 'deprecated-compatibility');
  assert.equal(manifest.summary.deprecated, 1);
});

test('the migration report is deterministic and ordered by category', () => {
  const fixture = deprecateRadiusFixture();
  fixture.$extensions['com.beeui'].semanticColorLifecycle = {
    'surface-raised': { status: 'deprecated', reason: 'Consolidated.', replacement: 'color.surface' },
  };

  const first = buildMigrationReport(fixture);
  const second = buildMigrationReport(structuredClone(fixture));
  assert.equal(first, second);

  assert.match(first, /\| `radius\.xs` \| radius \| `radius\.sm` \| 0\.2\.0 \| Renamed for scale clarity\. \|/);
  assert.ok(first.indexOf('`radius.xs`') < first.indexOf('`color.surface-raised`'), 'foundation categories sort before color');
});

test('removal fails policy checks until compatibility and migration prerequisites are met', () => {
  const fixture = deprecateRadiusFixture();

  assert.throws(
    () => assertRemovalAllowed(fixture, 'radius.xs', { currentVersion: '0.1.5', hasMigrationEvidence: true }),
    /compatibility window is not satisfied/,
  );
  assert.throws(
    () => assertRemovalAllowed(fixture, 'radius.sm', { currentVersion: '0.2.0', hasMigrationEvidence: true }),
    /is not deprecated/,
  );
  assert.throws(
    () => assertRemovalAllowed(fixture, 'radius.xs', { currentVersion: '0.2.0' }),
    /without migration evidence/,
  );
  assert.equal(
    assertRemovalAllowed(fixture, 'radius.xs', { currentVersion: '0.2.0', hasMigrationEvidence: true }),
    true,
  );
});

test('governed token collection covers foundation scales and every semantic color', () => {
  const governed = collectGovernedTokens(source);
  assert.ok(governed.some((entry) => entry.path === 'spacing.2.5'));
  assert.ok(governed.some((entry) => entry.path === 'radius.md'));
  assert.ok(governed.some((entry) => entry.path === 'fontFamily.mono'));
  assert.ok(governed.some((entry) => entry.path === 'breakpoint.medium'));
  assert.ok(governed.some((entry) => entry.path === 'pageGutter.regular'));
  assert.ok(governed.some((entry) => entry.path === 'layer.overlay'));
  assert.ok(governed.some((entry) => entry.path === 'color.primary'));
  const colorCount = governed.filter((entry) => entry.category === 'color').length;
  assert.equal(colorCount, Object.keys(source.$extensions['com.beeui'].semanticColorDescriptions).length);
});
