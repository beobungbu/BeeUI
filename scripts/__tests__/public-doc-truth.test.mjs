import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectPublicTruthViolations } from '../check-public-doc-truth.mjs';

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-public-truth-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const validDemo = `
pnpm --filter @beemvp/beeui-demo start
pnpm --filter @beemvp/beeui-demo web
pnpm --filter @beemvp/beeui-demo build:web
`;

test('accepts repository-local evaluation commands and verified demo commands', () => {
  const root = fixture({
    'README.md': 'pnpm install --frozen-lockfile\n',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'BeeUI is unpublished.\n',
  });
  assert.deepEqual(collectPublicTruthViolations(root), []);
});

test('rejects unavailable public registry commands', () => {
  const root = fixture({
    'README.md': 'pnpm add @beemvp/beeui-ui\n',
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': 'npx @beemvp/beeui-cli add button\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.length, 2);
  assert.match(violations.join('\n'), /pnpm add/);
  assert.match(violations.join('\n'), /npx/);
});

test('rejects stale demo build command and missing workspace commands', () => {
  const root = fixture({
    'README.md': 'BeeUI\n',
    'apps/demo/README.md': 'npm run build\n',
    'apps/docs/src/content/docs/index.md': 'BeeUI\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.some((line) => line.includes('npm run build')), true);
  assert.equal(violations.filter((line) => line.includes('missing verified workspace command')).length, 3);
});
