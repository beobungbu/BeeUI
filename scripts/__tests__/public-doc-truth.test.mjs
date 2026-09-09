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

function policy({ published, version = '0.86.2-rc.1' }) {
  return `\`\`\`json dist-tag-policy\n${JSON.stringify({
    published,
    currentVersion: version,
    prereleaseDistTag: 'next',
  })}\n\`\`\`\n`;
}

function baseFiles({ published = false, version = '0.86.2-rc.1', readme } = {}) {
  return {
    'README.md': readme ?? (published
      ? `> **Distribution status:** BeeUI \`${version}\` is publicly published on npm under \`next\`.\n`
      : `> the repository/package version is \`${version}\`.\n`),
    'package.json': JSON.stringify({ version }),
    'docs/dist-tag-policy.md': policy({ published, version }),
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': published ? 'Public RC docs.\n' : 'BeeUI is unpublished.\n',
  };
}

test('accepts repository-local evaluation commands while unpublished', () => {
  const root = fixture({ ...baseFiles(), 'apps/docs/src/content/docs/start.md': 'pnpm install --frozen-lockfile\n' });
  assert.deepEqual(collectPublicTruthViolations(root), []);
});

test('rejects registry commands while unpublished', () => {
  const root = fixture({
    ...baseFiles(),
    'apps/docs/src/content/docs/start.md': 'npm install @beemvp/beeui-ui@next\nnpx @beemvp/beeui-cli@next list\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.filter((v) => /unavailable registry command/.test(v)).length, 2);
});

test('accepts @next and exact-version commands after prerelease publication', () => {
  const root = fixture({
    ...baseFiles({ published: true }),
    'apps/docs/src/content/docs/start.md': [
      'npm install @beemvp/beeui-ui@next @beemvp/beeui-core@0.86.2-rc.1',
      'npx @beemvp/beeui-cli@next list',
      'pnpm dlx @beemvp/beeui-cli@0.86.2-rc.1 doctor',
    ].join('\n'),
  });
  assert.deepEqual(collectPublicTruthViolations(root), []);
});

test('rejects unqualified registry commands while current public version is an RC', () => {
  const root = fixture({
    ...baseFiles({ published: true }),
    'apps/docs/src/content/docs/start.md': 'npm install @beemvp/beeui-ui\nnpx @beemvp/beeui-cli list\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.filter((v) => /must pin @next or @0\.86\.2-rc\.1/.test(v)).length, 2);
});

test('accepts unqualified registry commands once current public version is stable', () => {
  const root = fixture({
    ...baseFiles({ published: true, version: '0.86.2' }),
    'apps/docs/src/content/docs/start.md': 'npm install @beemvp/beeui-ui\nnpx @beemvp/beeui-cli list\n',
  });
  assert.deepEqual(collectPublicTruthViolations(root), []);
});

test('rejects stale demo build command and missing workspace commands', () => {
  const root = fixture({
    ...baseFiles(),
    'apps/demo/README.md': 'npm run build\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.equal(violations.some((line) => line.includes('npm run build')), true);
  assert.equal(violations.filter((line) => line.includes('missing verified workspace command')).length, 3);
});

test('README distribution status must match workspace version', () => {
  const wrong = fixture(baseFiles({
    published: true,
    readme: '> **Distribution status:** BeeUI `9.9.9` is publicly published on npm under `next`.\n',
  }));
  assert.ok(
    collectPublicTruthViolations(wrong).some((v) => v.includes('states version 9.9.9 but the workspace version is 0.86.2-rc.1')),
  );

  const missing = fixture(baseFiles({ published: true, readme: 'BeeUI\n' }));
  assert.ok(collectPublicTruthViolations(missing).some((v) => v.includes('no longer carries its distribution-status line')));
});

test('policy currentVersion must agree with the workspace version', () => {
  const files = baseFiles({ published: true });
  files['docs/dist-tag-policy.md'] = policy({ published: true, version: '0.86.2-rc.2' });
  const violations = collectPublicTruthViolations(fixture(files));
  assert.ok(violations.some((v) => /currentVersion 0\.86\.2-rc\.2 must equal workspace version 0\.86\.2-rc\.1/.test(v)));
});

test('malformed workspace manifest is reported', () => {
  const files = baseFiles();
  files['package.json'] = '{not json';
  const violations = collectPublicTruthViolations(fixture(files));
  assert.ok(violations.some((v) => v.startsWith('package.json: not parseable')));
});
