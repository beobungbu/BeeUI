import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectPublicTruthViolations } from '../check-public-doc-truth.mjs';
import { deriveReleaseState, renderStatusSentence } from '../release-status-lib.mjs';

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

const LOCKSTEP_PACKAGE_NAMES = ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui', '@beemvp/beeui-cli'];

function policy({ candidateStableVersion = '0.86.2' } = {}) {
  return `\`\`\`json dist-tag-policy\n${JSON.stringify({
    candidateStableVersion,
    prereleaseDistTag: 'next',
  })}\n\`\`\`\n`;
}

// Publication state is derived from docs/registry-observation.json, never authored in the policy
// block. `version` resolving to the stable line ('0.86.2') is observed under `latest`; anything
// else (an RC) is observed under `next` — mirroring the real dist-tag/channel rule.
function registryObservation(version) {
  const distTag = version === '0.86.2' ? 'latest' : 'next';
  return JSON.stringify({
    observedAt: '2026-01-01T00:00:00.000Z',
    observedBy: 'test',
    packages: Object.fromEntries(LOCKSTEP_PACKAGE_NAMES.map((name) => [name, { versions: [version], distTags: { [distTag]: version } }])),
  });
}

function releaseStatusBlock(text) {
  return `<!-- release-status:generated:start -->\n${text}\n<!-- release-status:generated:end -->\n`;
}

// Mirrors what `pnpm release-status:generate` writes for the given fixture's scenario — the same
// derivation `readPublicationState`/`extractPublicationPolicy` compute for real docs.
function expectedStatusSentence({ published, version }) {
  const distTag = version === '0.86.2' ? 'latest' : 'next';
  const observation = published
    ? { observedAt: '2026-01-01T00:00:00.000Z', observedBy: 'test', packages: Object.fromEntries(LOCKSTEP_PACKAGE_NAMES.map((name) => [name, { versions: [version], distTags: { [distTag]: version } }])) }
    : null;
  const releaseState = deriveReleaseState({
    workspaceVersion: version,
    candidateStableVersion: '0.86.2',
    prereleaseDistTag: 'next',
    stableDistTag: 'latest',
    packageNames: LOCKSTEP_PACKAGE_NAMES,
    observation,
  });
  return renderStatusSentence(releaseState);
}

// `packages/ui/package.json` is the single authored current version; `package.json` (root) is a
// synced follower. Most fixtures keep both at the same version — the divergence test below sets
// them apart on purpose to exercise the follower-drift violation.
function baseFiles({ published = false, version = '0.86.2-rc.1', uiVersion = version, readme } = {}) {
  const files = {
    'README.md': readme ?? releaseStatusBlock(expectedStatusSentence({ published, version })),
    'package.json': JSON.stringify({ version }),
    'packages/ui/package.json': JSON.stringify({ version: uiVersion }),
    'docs/dist-tag-policy.md': policy(),
    'apps/demo/README.md': validDemo,
    'apps/docs/src/content/docs/index.md': published ? 'Public RC docs.\n' : 'BeeUI is unpublished.\n',
  };
  if (published) files['docs/registry-observation.json'] = registryObservation(uiVersion);
  return files;
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

test('rejects unsupported automatic first-publish dist-tag claims', () => {
  const root = fixture({
    ...baseFiles({ published: true }),
    'apps/docs/src/content/docs/start.md':
      "latest matches next because this is npm's first-publish default.\n",
  });
  const violations = collectPublicTruthViolations(root);
  assert.ok(violations.some((v) => /unsupported npm dist-tag causal claim/.test(v)));
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

// Regression: a workspace candidate ahead of the registry (`candidate-ahead-of-registry`) still
// has a genuinely live `@next` channel — the registry just doesn't yet carry the new workspace
// version. `@next`-tagged commands must stay accepted; a command pinned to the new,
// not-yet-published workspace version must still be rejected.
test('accepts @next commands but rejects a pin to the new candidate while the registry still serves an older version', () => {
  const files = baseFiles({ published: false, version: '0.86.2-rc.9' });
  files['docs/registry-observation.json'] = registryObservation('0.86.2-rc.3');
  const aheadState = deriveReleaseState({
    workspaceVersion: '0.86.2-rc.9',
    candidateStableVersion: '0.86.2',
    prereleaseDistTag: 'next',
    stableDistTag: 'latest',
    packageNames: LOCKSTEP_PACKAGE_NAMES,
    observation: JSON.parse(files['docs/registry-observation.json']),
  });
  assert.equal(aheadState.state, 'candidate-ahead-of-registry');
  files['README.md'] = releaseStatusBlock(renderStatusSentence(aheadState));

  const accepted = fixture({
    ...files,
    'apps/docs/src/content/docs/start.md': 'npm install @beemvp/beeui-ui@next\nnpx @beemvp/beeui-cli@next list\n',
  });
  assert.deepEqual(collectPublicTruthViolations(accepted), []);

  const rejected = fixture({
    ...files,
    'apps/docs/src/content/docs/start.md': 'npm install @beemvp/beeui-ui@0.86.2-rc.9\n',
  });
  assert.ok(
    collectPublicTruthViolations(rejected).some((v) => /must pin @next or @0\.86\.2-rc\.3/.test(v)),
    'a pin to the unpublished workspace candidate must be rejected, not accepted as if it were live',
  );
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

test('README release-status block must state the exact current release status', () => {
  // Stale sentence inside a present marker block: flagged as stale, not as a forbidden hand-written
  // claim (the marker scrubbing removes it from the forbidden-phrase scan first).
  const stale = fixture(baseFiles({
    published: true,
    readme: releaseStatusBlock('BeeUI `9.9.9` is public on npm under the opt-in `next` dist-tag (observed 2020-01-01T00:00:00Z).'),
  }));
  const staleViolations = collectPublicTruthViolations(stale);
  assert.ok(staleViolations.some((v) => v.includes('does not state the current release status')));
  assert.ok(!staleViolations.some((v) => v.includes('hand-written current-state registry claim')));

  // The real generated sentence for this fixture's scenario passes cleanly.
  const correct = fixture(baseFiles({ published: true }));
  assert.deepEqual(collectPublicTruthViolations(correct), []);

  // No marker block at all: flagged as missing, and the hand-written prose (if it uses a forbidden
  // phrase) is separately flagged by the public-truth rule.
  const missing = fixture(baseFiles({ published: true, readme: 'BeeUI `0.86.2-rc.1` is publicly published on npm.\n' }));
  const missingViolations = collectPublicTruthViolations(missing);
  assert.ok(missingViolations.some((v) => v.includes('is missing its release-status:generated marker block')));
  assert.ok(missingViolations.some((v) => v.includes('hand-written current-state registry claim')));
});

test('a hand-written current-state claim outside any generated block is rejected everywhere public-truth walks', () => {
  const root = fixture({
    ...baseFiles({ published: true }),
    'apps/docs/src/content/docs/guides/example.md': 'BeeUI `0.86.2-rc.1` is public on npm under `next`.\n',
  });
  const violations = collectPublicTruthViolations(root);
  assert.ok(violations.some((v) => v.includes('guides/example.md') && v.includes('hand-written current-state registry claim')));
});

test('a release-status:generated block is exempt from the forbidden-phrase scan even when it legitimately states the claim', () => {
  const root = fixture(baseFiles({ published: true }));
  const violations = collectPublicTruthViolations(root);
  assert.deepEqual(violations, []);
});

test('the derived current version must agree with the root workspace version', () => {
  const files = baseFiles({ published: true, uiVersion: '0.86.2-rc.2' });
  const violations = collectPublicTruthViolations(fixture(files));
  assert.ok(violations.some((v) => /packages\/ui\/package\.json: version 0\.86\.2-rc\.2 .*must equal the root package\.json version 0\.86\.2-rc\.1/.test(v)));
});

test('malformed workspace manifest is reported', () => {
  const files = baseFiles();
  files['package.json'] = '{not json';
  const violations = collectPublicTruthViolations(fixture(files));
  assert.ok(violations.some((v) => v.startsWith('package.json: not parseable')));
});
