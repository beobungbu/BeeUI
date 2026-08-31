import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONDITIONAL_JOBS_EXCLUDED_FROM_REQUIRED_CHECKS,
  REQUIRED_STATUS_CHECKS,
  VISUAL_WEB_MATRIX_JOB,
  collectReleaseRulesetViolations,
  extractDocumentedRuleset,
  extractJobIfCondition,
  jobAlwaysRuns,
  jobIsConditionallySkippable,
} from '../check-release-ruleset.mjs';

const FORK_GUARD_ALWAYS_RUN_JOB = `
jobs:
  classify:
    runs-on: ubuntu-latest
    if: >
      github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository
    steps:
      - run: echo classify
  verify:
    needs: [classify]
    runs-on: ubuntu-latest
    steps:
      - run: echo verify
`;

const CLASSIFY_GATED_JOB = `
jobs:
  bare-native:
    needs: [classify]
    if: >
      needs.classify.outputs.package-boundary-required == 'true' ||
      needs.classify.outputs.bare-native-required == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo bare-native
  ios-native:
    needs: [classify]
    if: >
      needs.classify.outputs.ios-native-required == 'true'
    runs-on: macos-latest
    steps:
      - run: echo ios-native
`;

const ALWAYS_WRAPPED_REPORT_JOB = `
jobs:
  visual-web:
    if: >
      github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - run: echo shard
  visual-web-report:
    needs: [visual-web]
    if: >
      always() &&
      (
        github.event_name != 'pull_request' ||
        github.event.pull_request.head.repo.full_name == github.repository
      )
    steps:
      - run: echo report
`;

const LABEL_GATED_RUNTIME_JOB = `
jobs:
  ios-runtime:
    if: >-
      github.event_name == 'schedule' ||
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'pull_request' &&
        github.event.pull_request.head.repo.full_name == github.repository &&
        (github.head_ref == 'test/runtime-device-smoke' || contains(github.event.pull_request.labels.*.name, 'ci:runtime')))
    steps:
      - run: echo ios-runtime
`;

test('extractJobIfCondition reads a block-scalar (>) if condition', () => {
  const condition = extractJobIfCondition(FORK_GUARD_ALWAYS_RUN_JOB, 'classify');
  assert.match(condition, /github\.event_name != 'pull_request'/);
});

test('extractJobIfCondition returns null when a job has no if:', () => {
  assert.equal(extractJobIfCondition(FORK_GUARD_ALWAYS_RUN_JOB, 'verify'), null);
});

test('jobAlwaysRuns is true for the plain fork-guard and for a job with no if:', () => {
  assert.equal(jobAlwaysRuns(FORK_GUARD_ALWAYS_RUN_JOB, 'classify'), true);
  assert.equal(jobAlwaysRuns(FORK_GUARD_ALWAYS_RUN_JOB, 'verify'), true);
});

test('jobAlwaysRuns is true for the always()-wrapped fork-guard used by visual-web-report', () => {
  assert.equal(jobAlwaysRuns(ALWAYS_WRAPPED_REPORT_JOB, 'visual-web-report'), true);
  assert.equal(jobAlwaysRuns(ALWAYS_WRAPPED_REPORT_JOB, 'visual-web'), true);
});

test('jobIsConditionallySkippable is true for a job gated on needs.classify.outputs', () => {
  assert.equal(jobIsConditionallySkippable(CLASSIFY_GATED_JOB, 'bare-native'), true);
});

test('jobIsConditionallySkippable is true for a job gated on labels/head_ref/schedule', () => {
  assert.equal(jobIsConditionallySkippable(LABEL_GATED_RUNTIME_JOB, 'ios-runtime'), true);
});

test('collectReleaseRulesetViolations passes for a coherent doc + always-run workflows', () => {
  const markdown = [
    '```json release-ruleset',
    JSON.stringify({ requiredStatusChecks: REQUIRED_STATUS_CHECKS.map((entry) => entry.job) }),
    '```',
  ].join('\n');

  const workflowContentsByFile = {
    'ci.yml': FORK_GUARD_ALWAYS_RUN_JOB + CLASSIFY_GATED_JOB,
    'web-a11y.yml': `jobs:\n  web-a11y:\n    if: >\n      github.event_name != 'pull_request' ||\n      github.event.pull_request.head.repo.full_name == github.repository\n`,
    'visual-web.yml': ALWAYS_WRAPPED_REPORT_JOB,
    'web-consumer.yml': `jobs:\n  web-consumer:\n    if: >\n      github.event_name != 'pull_request' ||\n      github.event.pull_request.head.repo.full_name == github.repository\n`,
    'runtime-native.yml': LABEL_GATED_RUNTIME_JOB + `\n  android-runtime:\n    if: >-\n      github.event_name == 'schedule'\n`,
    'compat-rn-0-87.yml': `jobs:\n  bare-android-rn87:\n    if: contains(github.event.pull_request.labels.*.name, 'ci:rn-0.87')\n  bare-ios-rn87:\n    if: contains(github.event.pull_request.labels.*.name, 'ci:rn-0.87')\n`,
  };

  const violations = collectReleaseRulesetViolations({ markdown, workflowContentsByFile });
  assert.deepEqual(violations, []);
});

test('collectReleaseRulesetViolations flags a required check that can be skipped', () => {
  const markdown = [
    '```json release-ruleset',
    JSON.stringify({ requiredStatusChecks: REQUIRED_STATUS_CHECKS.map((entry) => entry.job) }),
    '```',
  ].join('\n');

  // "verify" is re-defined here as classify-gated, simulating an accidental
  // future change that would make a required check skippable.
  const regressedCi = `
jobs:
  classify:
    if: >
      github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository
  verify:
    needs: [classify]
    if: needs.classify.outputs.package-boundary-required == 'true'
  bare-native:
    needs: [classify]
    if: needs.classify.outputs.bare-native-required == 'true'
  ios-native:
    needs: [classify]
    if: needs.classify.outputs.ios-native-required == 'true'
`;

  const workflowContentsByFile = {
    'ci.yml': regressedCi,
    'web-a11y.yml': `jobs:\n  web-a11y:\n    if: >\n      github.event_name != 'pull_request' ||\n      github.event.pull_request.head.repo.full_name == github.repository\n`,
    'visual-web.yml': ALWAYS_WRAPPED_REPORT_JOB,
    'web-consumer.yml': `jobs:\n  web-consumer:\n    if: >\n      github.event_name != 'pull_request' ||\n      github.event.pull_request.head.repo.full_name == github.repository\n`,
    'runtime-native.yml': LABEL_GATED_RUNTIME_JOB + `\n  android-runtime:\n    if: >-\n      github.event_name == 'schedule'\n`,
    'compat-rn-0-87.yml': `jobs:\n  bare-android-rn87:\n    if: contains(github.event.pull_request.labels.*.name, 'ci:rn-0.87')\n  bare-ios-rn87:\n    if: contains(github.event.pull_request.labels.*.name, 'ci:rn-0.87')\n`,
  };

  const violations = collectReleaseRulesetViolations({ markdown, workflowContentsByFile });
  assert.ok(violations.some((v) => v.includes('ci.yml:verify')), violations.join('\n'));
});

test('collectReleaseRulesetViolations flags a documented check list that drifts from the pinned set', () => {
  const markdown = [
    '```json release-ruleset',
    JSON.stringify({ requiredStatusChecks: ['classify', 'verify'] }),
    '```',
  ].join('\n');

  const workflowContentsByFile = {
    'ci.yml': FORK_GUARD_ALWAYS_RUN_JOB + CLASSIFY_GATED_JOB,
    'web-a11y.yml': `jobs:\n  web-a11y:\n    if: >\n      github.event_name != 'pull_request' ||\n      github.event.pull_request.head.repo.full_name == github.repository\n`,
    'visual-web.yml': ALWAYS_WRAPPED_REPORT_JOB,
    'web-consumer.yml': `jobs:\n  web-consumer:\n    if: >\n      github.event_name != 'pull_request' ||\n      github.event.pull_request.head.repo.full_name == github.repository\n`,
    'runtime-native.yml': LABEL_GATED_RUNTIME_JOB + `\n  android-runtime:\n    if: >-\n      github.event_name == 'schedule'\n`,
    'compat-rn-0-87.yml': `jobs:\n  bare-android-rn87:\n    if: contains(github.event.pull_request.labels.*.name, 'ci:rn-0.87')\n  bare-ios-rn87:\n    if: contains(github.event.pull_request.labels.*.name, 'ci:rn-0.87')\n`,
  };

  const violations = collectReleaseRulesetViolations({ markdown, workflowContentsByFile });
  assert.ok(violations.some((v) => v.includes('requiredStatusChecks')), violations.join('\n'));
});

test('extractDocumentedRuleset throws without the fenced release-ruleset block', () => {
  assert.throws(() => extractDocumentedRuleset('# no fenced block here'), /fenced contract block/);
});

test('pinned sets stay disjoint: conditional/matrix jobs never overlap the required-check names', () => {
  const requiredNames = new Set(REQUIRED_STATUS_CHECKS.map((entry) => entry.job));
  for (const excluded of [...CONDITIONAL_JOBS_EXCLUDED_FROM_REQUIRED_CHECKS, VISUAL_WEB_MATRIX_JOB]) {
    assert.equal(requiredNames.has(excluded.job), false, `${excluded.job} must stay out of REQUIRED_STATUS_CHECKS`);
  }
});
