import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canonicalizePublishManifest,
  canonicalizePublishManifestText,
} from '../release/canonicalize-publish-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function manifestA() {
  return {
    name: '@beemvp/example',
    version: '1.0.0',
    exports: {
      '.': {
        source: './src/index.ts',
        'react-native': './dist/native.js',
        import: './dist/module.js',
        require: './dist/commonjs.cjs',
        default: './dist/module.js',
      },
    },
    imports: {
      '#runtime': {
        browser: './browser.js',
        default: './native.js',
      },
    },
    dependencies: {
      zebra: '1.0.0',
      alpha: '2.0.0',
    },
    peerDependencies: {
      react: '>=19',
      '@scope/a': '>=1',
    },
    peerDependenciesMeta: {
      react: { optional: true },
      '@scope/a': { zeta: false, optional: true },
    },
  };
}

function manifestWithSerializationDrift() {
  return {
    peerDependenciesMeta: {
      '@scope/a': { optional: true, zeta: false },
      react: { optional: true },
    },
    peerDependencies: {
      '@scope/a': '>=1',
      react: '>=19',
    },
    dependencies: {
      alpha: '2.0.0',
      zebra: '1.0.0',
    },
    imports: {
      '#runtime': {
        browser: './browser.js',
        default: './native.js',
      },
    },
    exports: {
      '.': {
        source: './src/index.ts',
        'react-native': './dist/native.js',
        import: './dist/module.js',
        require: './dist/commonjs.cjs',
        default: './dist/module.js',
      },
    },
    version: '1.0.0',
    name: '@beemvp/example',
  };
}

test('publish manifest canonicalization removes only semantically unordered serialization drift', () => {
  const first = canonicalizePublishManifestText(JSON.stringify(manifestA()));
  const second = canonicalizePublishManifestText(JSON.stringify(manifestWithSerializationDrift()));
  assert.equal(first, second);
});

test('publish manifest canonicalization preserves conditional exports/imports order', () => {
  const original = manifestA();
  const canonical = canonicalizePublishManifest(original);

  assert.deepEqual(Object.keys(canonical.exports['.']), Object.keys(original.exports['.']));
  assert.deepEqual(Object.keys(canonical.imports['#runtime']), Object.keys(original.imports['#runtime']));

  const changedConditionOrder = manifestA();
  changedConditionOrder.exports = {
    '.': {
      default: './dist/module.js',
      source: './src/index.ts',
      'react-native': './dist/native.js',
      import: './dist/module.js',
      require: './dist/commonjs.cjs',
    },
  };

  assert.notEqual(
    canonicalizePublishManifestText(JSON.stringify(original)),
    canonicalizePublishManifestText(JSON.stringify(changedConditionOrder)),
    'condition-order drift must remain visible to the byte reproducibility gate',
  );
});

test('publish manifest canonicalization never hides semantic value drift', () => {
  const changedValue = manifestWithSerializationDrift();
  changedValue.dependencies.alpha = '9.9.9';

  assert.notEqual(
    canonicalizePublishManifestText(JSON.stringify(manifestA())),
    canonicalizePublishManifestText(JSON.stringify(changedValue)),
  );
});

test('durable pack evidence reuses canonical release artifacts instead of rebuilding or repacking', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/pack-artifacts.mjs'), 'utf8');

  assert.match(source, /\.artifacts', 'release-packages'/);
  assert.match(source, /release-verification\.json/);
  assert.match(source, /fs\.copyFileSync\(sourcePath, destination\)/);
  assert.doesNotMatch(source, /run\('pnpm'/);
  assert.doesNotMatch(source, /run\('npm'/);
});

test('canonical release construction normalizes the packed manifest before tar/gzip canonicalization', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/release/add-artifact-digests.mjs'), 'utf8');

  assert.match(source, /canonicalizePublishManifestFile\(packedManifestPath\)/);
  assert.match(source, /--sort=name/);
  assert.match(source, /--mtime=@0/);
  assert.match(source, /gzip', \['-n', '-9', '-c'/);
});
