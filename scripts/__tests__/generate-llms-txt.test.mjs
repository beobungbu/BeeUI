import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFamily,
  buildModel,
  collectMissingLinkedPaths,
  OUTPUT_FILES,
  parseBarrelExports,
} from '../generate-llms-txt.mjs';

const SAMPLE_BARREL = `
export { Button, ButtonLabel, buttonVariants, type ButtonProps } from './components/button';
export {
  EmptyState,
  ErrorState,
  type EmptyStateProps,
} from './components/state-message';
// commented illustration, must be ignored:
// export { Ghost } from './components/ghost';
export type { CalendarDate } from '@beemvp/beeui-core';
`;

function sampleRegistry() {
  return {
    items: [
      {
        name: 'button',
        type: 'component',
        public: true,
        files: [{ source: 'packages/ui/src/components/button.tsx' }],
        peerDependencies: { react: '>=19 <20', 'react-native': '>=0.86.0 <0.87.0' },
      },
      {
        name: 'state-message',
        type: 'component',
        public: true,
        files: [{ source: 'packages/ui/src/components/state-message.tsx' }],
        peerDependencies: {},
      },
      { name: 'theme', type: 'theme', public: true, files: [{ source: 'packages/tokens/src/theme.css' }] },
      { name: 'core-cn', type: 'utility', public: false, files: [{ source: 'packages/core/src/utils/cn.ts' }] },
    ],
  };
}

function samplePackages() {
  return {
    core: { name: '@beemvp/beeui-core', version: '0.1.0', description: 'core', private: false },
    tokens: { name: '@beemvp/beeui-tokens', version: '0.1.0', description: 'tokens', private: false },
    ui: { name: '@beemvp/beeui-ui', version: '0.1.0', description: 'ui', private: false },
  };
}

test('parseBarrelExports groups value/type symbols by specifier and ignores comments', () => {
  const parsed = parseBarrelExports(SAMPLE_BARREL);
  assert.deepEqual(parsed.get('./components/button'), {
    values: ['Button', 'ButtonLabel', 'buttonVariants'],
    types: ['ButtonProps'],
  });
  assert.deepEqual(parsed.get('./components/state-message'), {
    values: ['EmptyState', 'ErrorState'],
    types: ['EmptyStateProps'],
  });
  assert.deepEqual(parsed.get('@beemvp/beeui-core'), { values: [], types: ['CalendarDate'] });
  assert.equal(parsed.has('./components/ghost'), false);
});

// A renamed re-export is a public symbol under its exported name. Recording the raw
// `Foo as Bar` specifier would have published a name no consumer can import, in the
// public-surface inventory, llms.txt and the generated reference pages simultaneously.
test('parseBarrelExports records a renamed re-export under the name consumers import', () => {
  const parsed = parseBarrelExports(
    "export { Sheet as Drawer, type SheetProps as DrawerProps } from './components/sheet';\n" +
    "export type { InnerRef as PublicRef } from './components/sheet';\n",
  );
  assert.deepEqual(parsed.get('./components/sheet'), {
    values: ['Drawer'],
    types: ['DrawerProps', 'PublicRef'],
  });
});

test('buildModel maps public components to their barrel symbols and source paths', () => {
  const model = buildModel({
    registry: sampleRegistry(),
    barrelSource: SAMPLE_BARREL,
    packages: samplePackages(),
  });
  assert.equal(model.componentCount, 2);
  const button = model.components.find((c) => c.name === 'button');
  assert.deepEqual(button.values, ['Button', 'ButtonLabel', 'buttonVariants']);
  assert.equal(button.source, 'packages/ui/src/components/button.tsx');
  assert.deepEqual(button.peerDependencies, ['react', 'react-native']);
  assert.deepEqual(model.privateUtilities, ['core-cn']);
});

// Load-bearing: this is the staleness guard the DoD requires. If a component becomes
// public in the registry but is not exported from @beemvp/beeui-ui (or vice versa), generation
// must fail rather than emit a silently-wrong inventory.
test('buildModel throws when a public registry component is missing from the barrel', () => {
  const registry = sampleRegistry();
  registry.items.push({
    name: 'phantom',
    type: 'component',
    public: true,
    files: [{ source: 'packages/ui/src/components/phantom.tsx' }],
    peerDependencies: {},
  });
  assert.throws(
    () => buildModel({ registry, barrelSource: SAMPLE_BARREL, packages: samplePackages() }),
    /registry item "phantom" is public but @beemvp\/beeui-ui barrel/,
  );
});

test('buildFamily emits all four files, each with the unpublished disclaimer', () => {
  const model = buildModel({
    registry: sampleRegistry(),
    barrelSource: SAMPLE_BARREL,
    packages: samplePackages(),
  });
  const family = buildFamily(model);
  const names = Object.keys(family).sort();
  assert.deepEqual(names, [OUTPUT_FILES.components, OUTPUT_FILES.full, OUTPUT_FILES.index, OUTPUT_FILES.patterns].sort());
  for (const content of Object.values(family)) {
    assert.match(content, /UNPUBLISHED/);
    assert.match(content, /\n$/); // final newline (repo hygiene)
  }
});

// Guards against a false "available on npm" claim slipping into the agent surface.
test('buildFamily never presents the packages as published/available on npm', () => {
  const model = buildModel({
    registry: sampleRegistry(),
    barrelSource: SAMPLE_BARREL,
    packages: samplePackages(),
  });
  for (const content of Object.values(buildFamily(model))) {
    assert.doesNotMatch(content, /available on npm/i);
    // The unscoped tombstone must never appear as an endorsed command (it may only appear
    // inside an explicit "NOT `npx beeui`" warning).
    assert.doesNotMatch(content, /npx beeui add/);
  }
});

test('buildFamily is deterministic for a fixed model', () => {
  const model = buildModel({
    registry: sampleRegistry(),
    barrelSource: SAMPLE_BARREL,
    packages: samplePackages(),
  });
  assert.deepEqual(buildFamily(model), buildFamily(model));
});

// Integration: every documentation/source path the family links to must resolve to a
// real repository file.
test('all linked paths resolve to real repository files', () => {
  assert.deepEqual(collectMissingLinkedPaths(), []);
});
