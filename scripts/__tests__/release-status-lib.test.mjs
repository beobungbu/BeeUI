import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveReleaseState, isHealthyPublishedState, renderStatusSentence, toAstroProps } from '../release-status-lib.mjs';

const PACKAGES = ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui', '@beemvp/beeui-cli'];

function observationFor(versionsByPackage, distTagsByPackage, observedAt = '2026-09-25T00:00:00Z') {
  const packages = {};
  for (const name of PACKAGES) {
    packages[name] = {
      versions: versionsByPackage[name] ?? [],
      distTags: distTagsByPackage[name] ?? {},
    };
  }
  return { observedAt, observedBy: 'test', packages };
}

function allAt(version, distTags) {
  const versions = {};
  const tags = {};
  for (const name of PACKAGES) {
    versions[name] = [version];
    tags[name] = distTags;
  }
  return { versions, tags };
}

const BASE = {
  candidateStableVersion: '0.86.2',
  prereleaseDistTag: 'next',
  stableDistTag: 'latest',
  packageNames: PACKAGES,
};

test('unpublished: no observation ever recorded', () => {
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.1', observation: null });
  assert.equal(result.state, 'unpublished');
  assert.equal(result.published, false);
  assert.match(renderStatusSentence(result), /has not published any package/);
});

test('unpublished: observation recorded but every package has zero versions', () => {
  const observation = observationFor({}, {});
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.1', observation });
  assert.equal(result.state, 'unpublished');
});

test('candidate-ahead-of-registry: workspace rc.9 vs a complete registry line at rc.2', () => {
  const { versions, tags } = allAt('0.86.2-rc.2', { next: '0.86.2-rc.2', latest: '0.86.2-rc.1' });
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.9', observation });
  assert.equal(result.state, 'candidate-ahead-of-registry');
  assert.equal(result.installableVersion, '0.86.2-rc.2');
  assert.equal(result.installableDistTag, 'next');
  assert.equal(result.published, false);
  assert.match(renderStatusSentence(result), /is the current source candidate/);
  assert.match(renderStatusSentence(result), /0\.86\.2-rc\.2/);
});

test('partial-publication: only core and tokens carry the workspace rc.9 version', () => {
  const versions = {
    '@beemvp/beeui-core': ['0.86.2-rc.2', '0.86.2-rc.9'],
    '@beemvp/beeui-tokens': ['0.86.2-rc.2', '0.86.2-rc.9'],
    '@beemvp/beeui-ui': ['0.86.2-rc.2'],
    '@beemvp/beeui-cli': ['0.86.2-rc.2'],
  };
  const tags = {
    '@beemvp/beeui-core': { next: '0.86.2-rc.9' },
    '@beemvp/beeui-tokens': { next: '0.86.2-rc.9' },
    '@beemvp/beeui-ui': { next: '0.86.2-rc.2' },
    '@beemvp/beeui-cli': { next: '0.86.2-rc.2' },
  };
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.9', observation });
  assert.equal(result.state, 'partial-publication');
  assert.equal(result.published, false);
  assert.match(result.reason, /@beemvp\/beeui-core, @beemvp\/beeui-tokens carry 0\.86\.2-rc\.9/);
  assert.match(renderStatusSentence(result), /publication is in progress/);
  assert.doesNotMatch(renderStatusSentence(result), /\bis public on npm\b/);
});

test('prerelease-published: all four packages agree on next', () => {
  const { versions, tags } = allAt('0.86.2-rc.3', { next: '0.86.2-rc.3', latest: '0.86.2-rc.2' });
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.3', observation });
  assert.equal(result.state, 'prerelease-published');
  assert.equal(result.published, true);
  assert.equal(result.installableVersion, '0.86.2-rc.3');
  assert.equal(isHealthyPublishedState(result.state), true);
  assert.match(renderStatusSentence(result), /public on npm under the opt-in `next`/);
});

test('stable: all four packages agree on latest at the stable version', () => {
  const { versions, tags } = allAt('0.86.2', { next: '0.86.2', latest: '0.86.2' });
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2', observation });
  assert.equal(result.state, 'stable');
  assert.equal(result.published, true);
  assert.equal(result.installableDistTag, 'latest');
  assert.match(renderStatusSentence(result), /current stable release/);
});

test('registry-inconsistent: workspace version published everywhere but next disagrees', () => {
  const versions = {};
  const tags = {};
  for (const name of PACKAGES) versions[name] = ['0.86.2-rc.3'];
  tags['@beemvp/beeui-core'] = { next: '0.86.2-rc.3' };
  tags['@beemvp/beeui-tokens'] = { next: '0.86.2-rc.3' };
  tags['@beemvp/beeui-ui'] = { next: '0.86.2-rc.2' }; // disagrees
  tags['@beemvp/beeui-cli'] = { next: '0.86.2-rc.3' };
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.3', observation });
  assert.equal(result.state, 'registry-inconsistent');
  assert.equal(result.published, false);
  assert.match(renderStatusSentence(result), /cannot be summarized as a healthy release state/);
});

test('registry-inconsistent: registry has old published versions but dist-tags disagree across packages', () => {
  const versions = {};
  const tags = {};
  for (const name of PACKAGES) versions[name] = ['0.86.2-rc.1'];
  tags['@beemvp/beeui-core'] = { next: '0.86.2-rc.1' };
  tags['@beemvp/beeui-tokens'] = { next: '0.86.2-rc.1' };
  tags['@beemvp/beeui-ui'] = { next: '0.86.2-rc.0' }; // disagrees, and rc.0 was never in "versions" is irrelevant
  tags['@beemvp/beeui-cli'] = { next: '0.86.2-rc.1' };
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.9', observation });
  assert.equal(result.state, 'registry-inconsistent');
});

test('registry-inconsistent: observation is missing an entry for one package', () => {
  const observation = observationFor({}, {});
  delete observation.packages['@beemvp/beeui-cli'];
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.1', observation });
  assert.equal(result.state, 'registry-inconsistent');
  assert.match(result.reason, /beeui-cli/);
});

test('deriveReleaseState requires non-empty workspaceVersion, candidateStableVersion and packageNames', () => {
  assert.throws(() => deriveReleaseState({ ...BASE, workspaceVersion: '', observation: null }));
  assert.throws(() => deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.1', candidateStableVersion: '', observation: null }));
  assert.throws(() => deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.1', packageNames: [], observation: null }));
});

test('toAstroProps returns serializable, JSON-safe data', () => {
  const { versions, tags } = allAt('0.86.2-rc.3', { next: '0.86.2-rc.3', latest: '0.86.2-rc.2' });
  const observation = observationFor(versions, tags);
  const result = deriveReleaseState({ ...BASE, workspaceVersion: '0.86.2-rc.3', observation });
  const props = toAstroProps(result);
  assert.doesNotThrow(() => JSON.stringify(props));
  assert.equal(props.state, 'prerelease-published');
  assert.equal(props.published, true);
  assert.equal(typeof props.headline, 'string');
});

test('renderStatusSentence never claims a partial or inconsistent state is published', () => {
  const partial = deriveReleaseState({
    ...BASE,
    workspaceVersion: '0.86.2-rc.9',
    observation: observationFor(
      {
        '@beemvp/beeui-core': ['0.86.2-rc.9'],
        '@beemvp/beeui-tokens': [],
        '@beemvp/beeui-ui': [],
        '@beemvp/beeui-cli': [],
      },
      { '@beemvp/beeui-core': { next: '0.86.2-rc.9' } },
    ),
  });
  assert.equal(partial.state, 'partial-publication');
  assert.doesNotMatch(renderStatusSentence(partial), /\bis public on npm\b/);
  assert.doesNotMatch(renderStatusSentence(partial), /\bis the current stable release\b/);
});
