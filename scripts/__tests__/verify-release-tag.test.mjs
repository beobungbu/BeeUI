import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { LOCKSTEP_MANIFESTS } from '../release/prepare-candidate.mjs';
import { checkReleaseTag } from '../release/verify-release-tag.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function lockstep(version) {
  return Object.fromEntries(LOCKSTEP_MANIFESTS.map((relPath) => [relPath, version]));
}

test('an annotated tag on main matching every lockstep manifest passes', () => {
  assert.deepEqual(checkReleaseTag({ tag: 'v0.86.2-rc.4', objectType: 'tag', versions: lockstep('0.86.2-rc.4'), onMain: true }), []);
  assert.deepEqual(checkReleaseTag({ tag: 'v0.86.2', objectType: 'tag', versions: lockstep('0.86.2'), onMain: true }), []);
});

test('a lightweight tag fails', () => {
  const errors = checkReleaseTag({ tag: 'v0.86.2', objectType: 'commit', versions: lockstep('0.86.2'), onMain: true });
  assert.deepEqual(errors, ['v0.86.2: is a lightweight tag; create a signed annotated tag with `git tag -s v0.86.2 <main-commit>`']);
});

test('a tag whose name disagrees with the tagged manifests fails and names each manifest', () => {
  const versions = { ...lockstep('0.86.2-rc.4'), 'packages/cli/package.json': '0.86.2-rc.3' };
  const errors = checkReleaseTag({ tag: 'v0.86.2-rc.4', objectType: 'tag', versions, onMain: true });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /packages\/cli\/package\.json=0\.86\.2-rc\.3/);
  assert.doesNotMatch(errors[0], /packages\/ui/);
});

test('a tag on a commit that is not on main fails', () => {
  const errors = checkReleaseTag({ tag: 'v0.86.2', objectType: 'tag', versions: lockstep('0.86.2'), onMain: false });
  assert.deepEqual(errors, ['v0.86.2: the tagged commit is not on main; tag the promoted main commit']);
});

test('a malformed tag name fails before anything else is read', () => {
  for (const tag of ['0.86.2', 'v0.86', 'v0.86.2-beta.1', 'v0.86.2-rc.01', 'v0.86.2-rc.1-x']) {
    const errors = checkReleaseTag({ tag, objectType: 'tag', versions: lockstep('0.86.2'), onMain: true });
    assert.equal(errors.length, 1, tag);
    assert.match(errors[0], /must be v<major>/, tag);
  }
});

test('the verify workflow runs on v* tag pushes only, read-only, with full history', () => {
  const workflow = parse(readFileSync(path.join(repoRoot, '.github/workflows/tag-release-verify.yml'), 'utf8'));
  assert.deepEqual(workflow.on, { push: { tags: ['v*'] } });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const job = workflow.jobs.verify;
  assert.equal(job.environment, undefined, 'verification must not sit behind the release environment');
  const checkout = job.steps.find((step) => String(step.uses ?? '').startsWith('actions/checkout@'));
  assert.equal(checkout.with['fetch-depth'], 0);
  const run = job.steps.map((step) => step.run ?? '').join('\n');
  assert.match(run, /node \.\/scripts\/release\/verify-release-tag\.mjs "\$GITHUB_REF_NAME"/);
  assert.doesNotMatch(run, /npm (publish|dist-tag)|git push|gh release/, 'verification must never mutate anything');
});
