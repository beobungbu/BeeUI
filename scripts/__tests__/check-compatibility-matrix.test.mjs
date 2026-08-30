import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCompatibilityMatrixViolations,
  collectPublishedDocsViolations,
  computeActualSnapshot,
  extractSnapshotFromDoc,
} from '../check-compatibility-matrix.mjs';

function fixtures() {
  return {
    rootPackageJson: {
      engines: { node: '24.13.1' },
      packageManager: 'pnpm@10.15.0',
    },
    nvmrc: '24.13.1\n',
    uiPackageJson: {
      devDependencies: {
        react: '19.2.3',
        'react-dom': '19.2.3',
        'react-native': '0.86.2',
        'react-native-safe-area-context': '5.7.0',
        'react-native-teleport': '1.1.13',
      },
    },
    showcasePackageJson: {
      dependencies: {
        expo: '~57.0.0',
        tailwindcss: '4.3.3',
        uniwind: '1.10.1',
        'react-native-safe-area-context': '~5.7.0',
        'react-native-teleport': '~1.1.13',
        'react-native-web': '0.21.0',
      },
    },
    workflowContentsByFile: {
      'ci.yml': 'env:\n  NODE_VERSION: 24.13.1\n  PNPM_VERSION: 10.15.0\n',
      'runtime-native.yml': 'env:\n  NODE_VERSION: 24.13.1\n  PNPM_VERSION: 10.15.0\n',
    },
  };
}

function validMarkdown(snapshot) {
  return [
    '# doc',
    '',
    '```json compatibility-matrix',
    JSON.stringify(snapshot, null, 2),
    '```',
    '',
  ].join('\n');
}

test('extractSnapshotFromDoc parses the fenced snapshot block', () => {
  const snapshot = { node: { repo: '24.13.1', pnpm: '10.15.0' } };
  assert.deepEqual(extractSnapshotFromDoc(validMarkdown(snapshot)), snapshot);
});

test('extractSnapshotFromDoc fails loudly when the block is missing', () => {
  assert.throws(() => extractSnapshotFromDoc('# doc\n\nno snapshot here\n'), /fenced snapshot block/);
});

test('computeActualSnapshot reflects package.json/.nvmrc/CI pins', () => {
  const actual = computeActualSnapshot(fixtures());
  assert.deepEqual(actual, {
    node: { repo: '24.13.1', pnpm: '10.15.0' },
    react: '19.2.3',
    reactDom: '19.2.3',
    reactNative: '0.86.2',
    reactNativeWeb: '0.21.0',
    expoSdkRange: '~57.0.0',
    tailwindcss: '4.3.3',
    uniwind: '1.10.1',
    safeAreaContext: { ui: '5.7.0', showcase: '~5.7.0' },
    teleport: { ui: '1.1.13', showcase: '~1.1.13' },
  });
});

test('computeActualSnapshot rejects an inconsistent Node pin across sources', () => {
  const inputs = fixtures();
  inputs.nvmrc = '22.0.0\n';
  assert.throws(() => computeActualSnapshot(inputs), /Inconsistent repo Node version pins/);
});

test('computeActualSnapshot rejects an inconsistent pnpm pin across CI workflows', () => {
  const inputs = fixtures();
  inputs.workflowContentsByFile['runtime-native.yml'] = 'env:\n  NODE_VERSION: 24.13.1\n  PNPM_VERSION: 9.0.0\n';
  assert.throws(() => computeActualSnapshot(inputs), /Inconsistent pnpm version pins/);
});

test('collectCompatibilityMatrixViolations passes when the doc matches the repo', () => {
  const inputs = fixtures();
  const actual = computeActualSnapshot(inputs);
  const violations = collectCompatibilityMatrixViolations({ markdown: validMarkdown(actual), ...inputs });
  assert.deepEqual(violations, []);
});

test('collectCompatibilityMatrixViolations reports a load-bearing diff on version drift', () => {
  const inputs = fixtures();
  const actual = computeActualSnapshot(inputs);
  const staleSnapshot = { ...actual, react: '18.3.1' };
  const violations = collectCompatibilityMatrixViolations({
    markdown: validMarkdown(staleSnapshot),
    ...inputs,
  });
  assert.deepEqual(violations, ['react: doc says "18.3.1", repo actually pins "19.2.3"']);
});

test('collectCompatibilityMatrixViolations reports nested diffs by dotted path', () => {
  const inputs = fixtures();
  const actual = computeActualSnapshot(inputs);
  const staleSnapshot = {
    ...actual,
    safeAreaContext: { ...actual.safeAreaContext, ui: '4.9.0' },
  };
  const violations = collectCompatibilityMatrixViolations({
    markdown: validMarkdown(staleSnapshot),
    ...inputs,
  });
  assert.deepEqual(violations, ['safeAreaContext.ui: doc says "4.9.0", repo actually pins "5.7.0"']);
});

test('collectPublishedDocsViolations passes when every pinned value appears in the published pages', () => {
  const snapshot = computeActualSnapshot(fixtures());
  const publishedDocsContent = Object.entries(snapshot)
    .flatMap(([key, value]) =>
      typeof value === 'object' ? Object.values(value) : [value],
    )
    .join(' — pinned at ');
  const violations = collectPublishedDocsViolations({
    markdown: validMarkdown(snapshot),
    publishedDocsContent,
  });
  assert.deepEqual(violations, []);
});

test('collectPublishedDocsViolations reports a pinned value missing from the published pages', () => {
  const snapshot = computeActualSnapshot(fixtures());
  const publishedDocsContent = 'Compatibility page mentioning nothing useful.';
  const violations = collectPublishedDocsViolations({
    markdown: validMarkdown(snapshot),
    publishedDocsContent,
  });
  assert.ok(
    violations.includes(
      'reactNative: published apps/docs compatibility pages do not mention pinned value "0.86.2"',
    ),
  );
});
