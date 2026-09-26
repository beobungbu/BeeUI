import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { checkWorkflowSource, checkWorkflows } from '../check-workflow-shape.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const VALID = `name: ok
on:
  workflow_dispatch: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
  reuse:
    uses: ./.github/workflows/other.yml
`;

test('every committed workflow parses and has the shape GitHub requires', () => {
  const { files, errors } = checkWorkflows();
  assert.ok(files.length > 0, 'no workflows found; the check would pass vacuously');
  assert.ok(files.includes('.github/workflows/ci.yml'));
  assert.deepEqual(errors, []);
});

test('verify-fast runs this check on every pull request', () => {
  // A PR that edits CI can delete its own guard and still go green, so pin the
  // wiring: verify-fast carries no job-level condition and runs both the check
  // and this suite.
  const ci = parse(readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8'));
  const job = ci.jobs['verify-fast'];
  assert.ok(job, 'ci.yml must keep the verify-fast job');
  assert.equal(job.if, undefined, 'verify-fast must stay unconditional');
  const commands = job.steps.map((step) => step.run ?? '').join('\n');
  assert.match(commands, /pnpm ci-workflows:check/);
  assert.match(commands, /scripts\/__tests__\/check-workflow-shape\.test\.mjs/);
});

test('a minimal valid workflow passes, including a reusable-workflow job', () => {
  assert.deepEqual(checkWorkflowSource(VALID, 'valid.yml'), []);
});

test('a duplicate `on:` key fails, in the shape that reached main', () => {
  // A leftover `on:` whose only children were comments, followed by the real
  // trigger block. Text-level contract tests saw nothing wrong with this file.
  const source = `name: registry-observe

on:
# a stale comment that used to sit under the old trigger block

on:
  workflow_dispatch: {}

jobs:
  observe:
    runs-on: ubuntu-latest
    steps:
      - run: echo observe
`;
  const errors = checkWorkflowSource(source, 'registry-observe.yml');
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0], /^registry-observe\.yml: YAML parse error: Map keys must be unique/);
});

test('any duplicate key fails, not only `on`', () => {
  const errors = checkWorkflowSource(VALID.replace('  reuse:', '  build:'), 'dup-job.yml');
  assert.match(errors.join('\n'), /Map keys must be unique/);
});

test('a missing `on` key fails', () => {
  const errors = checkWorkflowSource(VALID.replace('on:\n  workflow_dispatch: {}\n', ''), 'no-on.yml');
  assert.deepEqual(errors, ['no-on.yml: expected exactly one `on` key, found 0']);
});

test('missing or empty `jobs` fails', () => {
  assert.deepEqual(checkWorkflowSource('on: push\n', 'no-jobs.yml'), ['no-jobs.yml: missing `jobs` map']);
  assert.deepEqual(checkWorkflowSource('on: push\njobs: {}\n', 'empty.yml'), ['empty.yml: `jobs` must be a non-empty map']);
  assert.deepEqual(checkWorkflowSource('on: push\njobs:\n  - build\n', 'list.yml'), ['list.yml: `jobs` must be a non-empty map']);
});

test('a job without `runs-on` or `uses` fails', () => {
  const source = 'on: push\njobs:\n  build:\n    steps:\n      - run: echo hi\n';
  assert.deepEqual(checkWorkflowSource(source, 'no-runner.yml'), [
    'no-runner.yml: job `build` needs `runs-on` or a reusable-workflow `uses`',
  ]);
});

test('a job with both `runs-on` and `uses` fails', () => {
  const source = 'on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    uses: ./.github/workflows/x.yml\n';
  assert.deepEqual(checkWorkflowSource(source, 'both.yml'), ['both.yml: job `build` cannot set both `runs-on` and `uses`']);
});

test('a non-map job or invalid job id fails', () => {
  assert.deepEqual(checkWorkflowSource('on: push\njobs:\n  build: ubuntu-latest\n', 'scalar.yml'), [
    'scalar.yml: job `build` must be a map',
  ]);
  const errors = checkWorkflowSource('on: push\njobs:\n  1build:\n    runs-on: ubuntu-latest\n', 'id.yml');
  assert.match(errors.join('\n'), /job id `1build`/);
});

test('unparseable YAML, a non-map root, or multiple documents fail', () => {
  assert.match(checkWorkflowSource('on: [push\n', 'broken.yml').join('\n'), /^broken\.yml: YAML parse error/);
  assert.deepEqual(checkWorkflowSource('- on\n', 'list-root.yml'), ['list-root.yml: top level must be a mapping']);
  assert.deepEqual(checkWorkflowSource(`${VALID}---\n${VALID}`, 'multi.yml'), [
    'multi.yml: expected exactly one YAML document, found 2',
  ]);
});
