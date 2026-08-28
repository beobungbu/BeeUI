import assert from 'node:assert/strict';
import test from 'node:test';

import { loadCanonicalTokens } from '../generate-tokens.mjs';
import { validateTokenRemovalDiff } from '../check-token-removals.mjs';
import { assertRemovalAllowed } from '../token-lifecycle.mjs';

const source = loadCanonicalTokens();

function setLifecycle(node, lifecycle) {
  node.$extensions = {
    ...(node.$extensions ?? {}),
    'com.beeui': {
      ...(node.$extensions?.['com.beeui'] ?? {}),
      lifecycle,
    },
  };
}

function setVersion(fixture, version) {
  fixture.$extensions['com.beeui'].lifecyclePolicy.packageVersion = version;
}

function previousDeprecatedRadius(options = {}) {
  const replacement = Object.hasOwn(options, 'replacement') ? options.replacement : 'radius.sm';
  const migrationEvidence = Object.hasOwn(options, 'migrationEvidence')
    ? options.migrationEvidence
    : 'migration verified';
  const fixture = structuredClone(source);
  setLifecycle(fixture.tokens.radius.xs, {
    status: 'deprecated',
    since: '0.1.0',
    reason: 'Scale cleanup.',
    ...(replacement === undefined ? {} : { replacement }),
    removal: {
      target: '0.2.0',
      ...(migrationEvidence === undefined ? {} : { migrationEvidence }),
    },
  });
  return fixture;
}

function withoutRadiusXs(previous, version = '0.2.0') {
  const current = structuredClone(previous);
  delete current.tokens.radius.xs;
  setVersion(current, version);
  return current;
}

test('baseline-aware guard rejects direct removal of a stable public token', () => {
  const current = structuredClone(source);
  delete current.tokens.radius.xs;

  assert.throws(
    () => validateTokenRemovalDiff(source, current),
    /radius\.xs was removed while stable; public tokens must be deprecated before removal/,
  );
});

test('baseline-aware guard rejects deprecated removal without migration evidence', () => {
  const previous = previousDeprecatedRadius({ migrationEvidence: undefined });
  const current = withoutRadiusXs(previous);

  assert.throws(
    () => validateTokenRemovalDiff(previous, current),
    /without migration evidence/,
  );
});

test('baseline-aware guard rejects deprecated removal before the compatibility window', () => {
  const previous = previousDeprecatedRadius();
  const tooEarly = withoutRadiusXs(previous, '0.1.5');

  assert.throws(
    () => validateTokenRemovalDiff(previous, tooEarly),
    /compatibility window is not satisfied/,
  );
});

test('baseline-aware guard allows a fully eligible deprecated alias removal', () => {
  const previous = previousDeprecatedRadius();
  const current = withoutRadiusXs(previous);

  assert.deepEqual(validateTokenRemovalDiff(previous, current), ['radius.xs']);
});

test('pure-removal deprecation can actually be removed after target, evidence, and compatibility window', () => {
  const previous = previousDeprecatedRadius({ replacement: undefined });
  const current = withoutRadiusXs(previous);

  const entry = previous.tokens.radius.xs.$extensions['com.beeui'].lifecycle;
  assert.equal(entry.replacement, undefined);
  assert.equal(assertRemovalAllowed(previous, 'radius.xs', { currentVersion: '0.2.0' }), true);
  assert.deepEqual(validateTokenRemovalDiff(previous, current), ['radius.xs']);
});

test('replacement must remain live in the head when its deprecated alias is removed', () => {
  const previous = previousDeprecatedRadius();
  const current = withoutRadiusXs(previous);
  delete current.tokens.radius.sm;

  assert.throws(
    () => validateTokenRemovalDiff(previous, current),
    /radius\.xs replacement "radius\.sm" must remain a live governed token/,
  );
});

test('experimental public tokens may be removed without the stable deprecation window', () => {
  const previous = structuredClone(source);
  setLifecycle(previous.tokens.radius.xs, {
    status: 'experimental',
    since: '0.1.0',
  });
  const current = structuredClone(previous);
  delete current.tokens.radius.xs;

  assert.deepEqual(validateTokenRemovalDiff(previous, current), ['radius.xs']);
});
