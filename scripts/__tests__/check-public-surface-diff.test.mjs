import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyDiff, collectSurfaceDiffViolations, diffInventories, parseChangeset } from '../check-public-surface-diff.mjs';

const row = (id, classification = 'consumer') => ({ id, kind: 'ui-value', name: id, package: '@beemvp/beeui-ui', classification });
const inventory = (...rows) => ({ schemaVersion: 1, rows });
const changeset = (bumps) => [{ name: 'x.md', bumps }];

test('a removed row is breaking', () => {
  const diff = diffInventories(inventory(row('a'), row('b')), inventory(row('a')));
  assert.deepEqual(diff.removed, ['b']);
  assert.equal(classifyDiff(diff), 'breaking');
});

test('a consumer row reclassified away from consumer is breaking', () => {
  const diff = diffInventories(inventory(row('a')), inventory(row('a', 'internal')));
  assert.deepEqual(diff.reclassified, [{ id: 'a', from: 'consumer', to: 'internal' }]);
  assert.equal(classifyDiff(diff), 'breaking');
});

test('an added row is additive, and metadata changes are nothing', () => {
  assert.equal(classifyDiff(diffInventories(inventory(row('a')), inventory(row('a'), row('b')))), 'additive');
  const moved = { ...row('a'), source: 'elsewhere.tsx', primaryDocsOwner: '/docs/x/' };
  assert.equal(classifyDiff(diffInventories(inventory(row('a')), inventory(moved))), 'none');
});

test('a breaking diff needs a minor or major changeset on a public package', () => {
  const diff = diffInventories(inventory(row('a')), inventory());
  assert.equal(collectSurfaceDiffViolations({ diff, changesets: [] }).length, 1);
  assert.equal(collectSurfaceDiffViolations({ diff, changesets: changeset({ '@beemvp/beeui-ui': 'patch' }) }).length, 1, 'a patch does not cover a removal');
  assert.deepEqual(collectSurfaceDiffViolations({ diff, changesets: changeset({ '@beemvp/beeui-ui': 'minor' }) }), []);
  assert.equal(collectSurfaceDiffViolations({ diff, changesets: changeset({ 'some-other-pkg': 'major' }) }).length, 1, 'a non-public package does not count');
});

test('an additive diff needs any changeset on a public package', () => {
  const diff = diffInventories(inventory(), inventory(row('a')));
  assert.equal(collectSurfaceDiffViolations({ diff, changesets: [] }).length, 1);
  assert.deepEqual(collectSurfaceDiffViolations({ diff, changesets: changeset({ '@beemvp/beeui-ui': 'patch' }) }), []);
});

test('changeset frontmatter is read with or without quotes', () => {
  assert.deepEqual(parseChangeset('---\n"@beemvp/beeui-ui": minor\n\'@beemvp/beeui-core\': patch\n---\n\nnote\n'), {
    '@beemvp/beeui-ui': 'minor',
    '@beemvp/beeui-core': 'patch',
  });
  assert.deepEqual(parseChangeset('no frontmatter'), {});
});
