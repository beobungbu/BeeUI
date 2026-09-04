import assert from 'node:assert/strict';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import { buildPublicSurfaceInventory } from '../generate-public-surface-inventory.mjs';
import {
  buildReferenceManifest,
  collectPublicReferenceViolations,
  renderReferencePage,
} from '../public-reference.mjs';

const CONTENT = JSON.parse(
  await import('node:fs').then((fs) => fs.readFileSync(`${ROOT_DIR}/docs/reference.content.json`, 'utf8')),
);

// The point of deriving these pages from the inventory is that the ownership gate and the
// page a reader opens cannot disagree. If this drifts, "every public surface is documented"
// is back to being a claim about routing rather than about pages.
test('every reference-owned surface appears on exactly one generated page', () => {
  const inventory = buildPublicSurfaceInventory(ROOT_DIR);
  const expected = inventory.rows.filter((row) => row.primaryDocsOwner.startsWith('/docs/reference/'));
  const manifest = buildReferenceManifest(ROOT_DIR);

  const listed = manifest.flatMap((owner) => owner.rows.map((row) => row.id));
  assert.equal(listed.length, new Set(listed).size, 'a surface is listed on more than one page');
  assert.deepEqual([...listed].sort(), expected.map((row) => row.id).sort());
});

test('every generated page routes to the owner the inventory names', () => {
  for (const owner of buildReferenceManifest(ROOT_DIR)) {
    assert.equal(owner.route, `/docs/reference/${owner.slug}/`);
    for (const row of owner.rows) assert.equal(row.primaryDocsOwner, owner.route);
  }
});

test('the committed pages carry the surfaces and the curated prose', () => {
  for (const owner of buildReferenceManifest(ROOT_DIR)) {
    const page = renderReferencePage(owner, CONTENT);
    assert.match(page, /Generated file/u, `${owner.slug} must warn that it is generated`);
    assert.ok(page.includes(CONTENT.owners[owner.slug].intro.split('\n')[0]), `${owner.slug} lost its intro`);
    for (const row of owner.rows) {
      assert.ok(page.includes(`\`${row.name}\``), `${owner.slug} does not list ${row.name}`);
    }
  }
});

test('the real repository satisfies the reference contract', () => {
  assert.deepEqual(collectPublicReferenceViolations(ROOT_DIR), []);
});

// A reference owner without prose would publish a bare table of symbol names — technically
// complete and useless, which is exactly what #474's G2 gate rejects.
test('a reference owner with no curated entry is rejected', () => {
  const owners = buildReferenceManifest(ROOT_DIR);
  assert.ok(owners.length > 0);
  const stripped = { ...CONTENT, owners: { ...CONTENT.owners } };
  delete stripped.owners[owners[0].slug];
  assert.throws(
    () => {
      for (const owner of owners) renderReferencePage(owner, stripped);
    },
    /Cannot read|undefined/u,
  );
});
