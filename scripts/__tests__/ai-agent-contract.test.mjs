import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BEEUI_SUBCOMMANDS,
  LLMS_FAMILY,
  collectBrokenLinks,
  extractBeeuiAddItems,
  extractBeeuiSubcommands,
  extractComponentManifest,
  extractMarkdownLinks,
  extractPnpmScripts,
  extractRepoRelativeLinks,
  readBarrelValueExports,
  readCookbook,
  readPackageScripts,
  readPublicComponentNames,
  runChecks,
} from '../check-ai-agent-contract.mjs';

// --- Extractor unit tests (pure, fixture-driven) ---------------------------

test('extractMarkdownLinks returns every link target', () => {
  const text = 'see [a](one.md) and [b](../two.md) and [ext](https://x.dev) and [anchor](#top)';
  assert.deepEqual(extractMarkdownLinks(text), ['one.md', '../two.md', 'https://x.dev', '#top']);
});

test('extractRepoRelativeLinks drops external URLs and anchors, strips fragments', () => {
  const text = '[a](one.md#frag) [b](https://x.dev) [c](#top) [d](../pkg/index.ts)';
  assert.deepEqual(extractRepoRelativeLinks(text), ['one.md', '../pkg/index.ts']);
});

test('extractBeeuiSubcommands skips option flags and captures the subcommand', () => {
  const text = 'run `pnpm beeui -- add --dry-run button` then `pnpm beeui -- doctor` and `pnpm beeui -- list`';
  assert.deepEqual(extractBeeuiSubcommands(text), ['add', 'doctor', 'list']);
});

test('extractBeeuiAddItems captures real component tokens and ignores placeholders', () => {
  const text = '`pnpm beeui -- add button` and `pnpm beeui -- add --overwrite popover sheet` and `pnpm beeui -- add <component>`';
  assert.deepEqual(extractBeeuiAddItems(text), ['button', 'popover', 'sheet']);
});

test('extractPnpmScripts excludes the beeui CLI runner', () => {
  const text = '`pnpm typecheck` `pnpm test` `pnpm registry:verify` `pnpm beeui -- add button`';
  assert.deepEqual(extractPnpmScripts(text), ['registry:verify', 'test', 'typecheck']);
});

test('extractComponentManifest parses the ai-contract:components block', () => {
  const text = 'before\n<!-- ai-contract:components\nButton, Field,\nTable\n-->\nafter';
  assert.deepEqual(extractComponentManifest(text), ['Button', 'Field', 'Table']);
});

test('extractComponentManifest returns null when the block is absent', () => {
  assert.equal(extractComponentManifest('no manifest here'), null);
});

// --- Integration: the real cookbook against the real surface ---------------

test('the cookbook exists and carries a machine-checked component manifest', () => {
  const manifest = extractComponentManifest(readCookbook());
  assert.ok(Array.isArray(manifest) && manifest.length > 0, 'manifest block must be present and non-empty');
});

// Load-bearing: if a cited component symbol is renamed/removed from @beemvp/beeui-ui, this fails.
test('every manifest component symbol is a real @beemvp/beeui-ui value export', () => {
  const values = readBarrelValueExports();
  const hallucinated = extractComponentManifest(readCookbook()).filter((sym) => !values.has(sym));
  assert.deepEqual(hallucinated, [], `hallucinated symbols: ${hallucinated.join(', ')}`);
});

// Load-bearing: a renamed/removed doc or ADR breaks the link and this fails.
test('every repo-relative link in the cookbook resolves to a real file', () => {
  assert.deepEqual(collectBrokenLinks(), []);
});

test('every beeui add item names a real public registry component', () => {
  const publicComponents = new Set(readPublicComponentNames());
  const unknown = extractBeeuiAddItems(readCookbook()).filter((i) => !publicComponents.has(i));
  assert.deepEqual(unknown, [], `unknown add items: ${unknown.join(', ')}`);
});

test('every beeui subcommand referenced is a real CLI subcommand', () => {
  const unknown = extractBeeuiSubcommands(readCookbook()).filter((s) => !BEEUI_SUBCOMMANDS.has(s));
  assert.deepEqual(unknown, [], `unknown subcommands: ${unknown.join(', ')}`);
});

test('every pnpm script referenced is a real package.json script', () => {
  const scripts = readPackageScripts();
  const unknown = extractPnpmScripts(readCookbook()).filter((s) => !scripts.has(s));
  assert.deepEqual(unknown, [], `unknown scripts: ${unknown.join(', ')}`);
});

test('the cookbook cross-links the whole llms.txt family', () => {
  const text = readCookbook();
  const notLinked = LLMS_FAMILY.filter((f) => !text.includes(`(../${f})`));
  assert.deepEqual(notLinked, []);
});

// Guards against a false "published/available on npm" claim slipping into the contract.
test('the cookbook states UNPUBLISHED status and never claims npm availability', () => {
  const text = readCookbook();
  assert.match(text, /UNPUBLISHED/);
  assert.match(text, /pnpm beeui -- add/);
  assert.doesNotMatch(text, /available on npm/i);
});

// The aggregate runner used by the CLI / CI must pass on the committed cookbook.
test('runChecks passes for the committed cookbook', () => {
  const { ok, results } = runChecks();
  const failed = results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail}`);
  assert.deepEqual(failed, [], `failing checks:\n${failed.join('\n')}`);
  assert.equal(ok, true);
});
