import test from 'node:test';
import assert from 'node:assert/strict';

import {
  summarizePackEntry,
  summarizeBundleMetafile,
  buildScenarioReport,
} from '../benchmark/lib/footprint-analysis.mjs';

function fakePackEntry(overrides = {}) {
  return {
    name: '@beemvp/beeui-ui',
    version: '0.1.0',
    size: 129306,
    unpackedSize: 567807,
    entryCount: 3,
    files: [
      { path: 'package.json', size: 1824 },
      { path: 'src/components/button.tsx', size: 500 },
      { path: 'src/components/table.tsx', size: 12000 },
    ],
    ...overrides,
  };
}

test('summarizePackEntry normalizes fields and sorts files by size descending', () => {
  const summary = summarizePackEntry(fakePackEntry());
  assert.equal(summary.name, '@beemvp/beeui-ui');
  assert.equal(summary.packedGzipBytes, 129306);
  assert.equal(summary.unpackedBytes, 567807);
  assert.deepEqual(
    summary.files.map((f) => f.path),
    ['src/components/table.tsx', 'package.json', 'src/components/button.tsx'],
  );
  assert.equal(summary.largestFiles[0].path, 'src/components/table.tsx');
});

test('summarizePackEntry rejects a non-object input', () => {
  assert.throws(() => summarizePackEntry(null), TypeError);
});

function fakeMetafile() {
  return {
    inputs: {
      '/repo/packages/ui/src/components/button.tsx': {
        bytes: 1000,
        imports: [
          { path: 'react', external: true },
          { path: '@beemvp/beeui-core', external: false },
          // A fully type-only import (e.g. `import { type X } from './shared'`)
          // is TS-erased and esbuild still tags it `external: true` in the
          // metafile as bookkeeping — it is not a real runtime dependency and
          // must not be reported as one (see #183 footprint script).
          { path: './shared', external: true },
        ],
      },
      '/repo/packages/core/src/index.ts': {
        bytes: 200,
        imports: [],
      },
      '/repo/node_modules/class-variance-authority/index.js': {
        bytes: 3000,
        imports: [],
      },
    },
  };
}

test('summarizeBundleMetafile separates owned source from bundled third-party bytes', () => {
  const summary = summarizeBundleMetafile(fakeMetafile(), [
    '/repo/packages/ui/src',
    '/repo/packages/core/src',
  ]);
  assert.equal(summary.ownedSourceInputBytes, 1200);
  assert.equal(summary.thirdPartyDependencyInputBytes, 3000);
  assert.deepEqual(summary.externalModules, ['react']);
  assert.equal(summary.largestOwnedFiles[0].path, '/repo/packages/ui/src/components/button.tsx');
  assert.equal(
    summary.largestThirdPartyFiles[0].path,
    '/repo/node_modules/class-variance-authority/index.js',
  );
});

test('summarizeBundleMetafile excludes elided type-only relative imports from externalModules', () => {
  const summary = summarizeBundleMetafile(fakeMetafile(), ['/repo/packages/ui/src']);
  assert.deepEqual(summary.externalModules, ['react']);
});

test('summarizeBundleMetafile requires a non-empty ownedSourceDirs list', () => {
  assert.throws(() => summarizeBundleMetafile(fakeMetafile(), []), TypeError);
});

test('summarizeBundleMetafile requires a metafile with inputs', () => {
  assert.throws(() => summarizeBundleMetafile({}, ['/repo']), TypeError);
});

test('buildScenarioReport merges scenario identity with bytes and attribution', () => {
  const report = buildScenarioReport(
    { id: 'web/button-direct', title: 'Button (direct)', platform: 'web' },
    { rawBytes: 4200, gzipBytes: 1600, metafile: fakeMetafile() },
    ['/repo/packages/ui/src', '/repo/packages/core/src'],
  );
  assert.equal(report.id, 'web/button-direct');
  assert.equal(report.rawBytes, 4200);
  assert.equal(report.gzipBytes, 1600);
  assert.equal(report.ownedSourceInputBytes, 1200);
  assert.equal(report.thirdPartyDependencyInputBytes, 3000);
  assert.deepEqual(report.externalModules, ['react']);
});
