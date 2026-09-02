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

const ALWAYS_RUN_CI_JOBS = `
jobs:
  classify:
    runs-on: ubuntu-latest
  verify-check:
    strategy:
      matrix:
        task: [static, tests, release]
  showcase-bundle:
    strategy:
      matrix:
        platform: [web, android, ios]
  verify:
    needs: [classify, verify-check, showcase-bundle]
    if: always()
    runs-on: ubuntu-latest
`;

const CLASSIFY_GATED_JOBS = `
jobs:
  bare-bundle:
    needs: [classify]
    if: >
      needs.classify.outputs.package-boundary-required == 'true' ||
      needs.classify.outputs.bare-native-required == 'true'
  bare-android:
    needs: [classify]
    if: needs.classify.outputs.bare-native-required == 'true'
  ios-showcase:
    needs: [classify]
    if: needs.classify.outputs.showcase-native-required == 'true'
  ios-bare:
    needs: [classify]
    if: needs.classify.outputs.bare-native-required == 'true'
`;

const ALWAYS_WRAPPED_REPORT_JOB = `
jobs:
  visual-web:
    strategy:
      matrix:
        shard: [1, 2, 3]
  visual-web-report:
    needs: [visual-web]
    if: always()
`;

const LABEL_GATED_RUNTIME_JOB = `
jobs:
  ios-runtime:
    if: >-
      github.event_name == 'push' ||
      github.event_name == 'schedule' ||
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'ci:runtime'))
`;

test('extractJobIfCondition reads classifier-gated condition', () => {
  const condition = extractJobIfCondition(CLASSIFY_GATED_JOBS, 'bare-bundle');
  assert.match(condition, /package-boundary-required/);
});

test('required fan-in aggregators using always() count as always-run', () => {
  assert.equal(jobAlwaysRuns(ALWAYS_RUN_CI_JOBS, 'classify'), true);
  assert.equal(jobAlwaysRuns(ALWAYS_RUN_CI_JOBS, 'verify'), true);
  assert.equal(jobAlwaysRuns(ALWAYS_WRAPPED_REPORT_JOB, 'visual-web-report'), true);
});

test('classifier/runtime gated jobs remain conditionally skippable', () => {
  assert.equal(jobIsConditionallySkippable(CLASSIFY_GATED_JOBS, 'bare-android'), true);
  assert.equal(jobIsConditionallySkippable(CLASSIFY_GATED_JOBS, 'ios-showcase'), true);
  assert.equal(jobIsConditionallySkippable(LABEL_GATED_RUNTIME_JOB, 'ios-runtime'), true);
});

test('collectReleaseRulesetViolations passes for coherent parallel topology', () => {
  const markdown = [
    '```json release-ruleset',
    JSON.stringify({ requiredStatusChecks: REQUIRED_STATUS_CHECKS.map((entry) => entry.job) }),
    '```',
  ].join('\n');

  const workflowContentsByFile = {
    'ci.yml': ALWAYS_RUN_CI_JOBS + CLASSIFY_GATED_JOBS,
    'web-a11y.yml': `jobs:\n  web-a11y:\n    steps:\n      - run: echo a11y\n`,
    'visual-web.yml': ALWAYS_WRAPPED_REPORT_JOB,
    'web-consumer.yml': `jobs:\n  web-consumer:\n    steps:\n      - run: echo consumer\n`,
    'runtime-native.yml': LABEL_GATED_RUNTIME_JOB + `\n  android-runtime:\n    if: github.event_name == 'schedule'\n`,
  };

  assert.deepEqual(collectReleaseRulesetViolations({ markdown, workflowContentsByFile }), []);
});

test('collectReleaseRulesetViolations flags a skippable required aggregator', () => {
  const markdown = [
    '```json release-ruleset',
    JSON.stringify({ requiredStatusChecks: REQUIRED_STATUS_CHECKS.map((entry) => entry.job) }),
    '```',
  ].join('\n');

  const regressedCi = `
jobs:
  classify:
  verify:
    needs: [classify]
    if: needs.classify.outputs.bare-native-required == 'true'
  bare-bundle:
    if: needs.classify.outputs.package-boundary-required == 'true'
  bare-android:
    if: needs.classify.outputs.bare-native-required == 'true'
  ios-showcase:
    if: needs.classify.outputs.showcase-native-required == 'true'
  ios-bare:
    if: needs.classify.outputs.bare-native-required == 'true'
`;

  const workflowContentsByFile = {
    'ci.yml': regressedCi,
    'web-a11y.yml': `jobs:\n  web-a11y:\n`,
    'visual-web.yml': ALWAYS_WRAPPED_REPORT_JOB,
    'web-consumer.yml': `jobs:\n  web-consumer:\n`,
    'runtime-native.yml': LABEL_GATED_RUNTIME_JOB + `\n  android-runtime:\n    if: github.event_name == 'schedule'\n`,
  };

  const violations = collectReleaseRulesetViolations({ markdown, workflowContentsByFile });
  assert.ok(violations.some((v) => v.includes('ci.yml:verify')), violations.join('\n'));
});

test('documented required check list cannot drift', () => {
  const markdown = ['```json release-ruleset', JSON.stringify({ requiredStatusChecks: ['classify', 'verify'] }), '```'].join('\n');
  const workflowContentsByFile = {
    'ci.yml': ALWAYS_RUN_CI_JOBS + CLASSIFY_GATED_JOBS,
    'web-a11y.yml': `jobs:\n  web-a11y:\n`,
    'visual-web.yml': ALWAYS_WRAPPED_REPORT_JOB,
    'web-consumer.yml': `jobs:\n  web-consumer:\n`,
    'runtime-native.yml': LABEL_GATED_RUNTIME_JOB + `\n  android-runtime:\n    if: github.event_name == 'schedule'\n`,
  };
  const violations = collectReleaseRulesetViolations({ markdown, workflowContentsByFile });
  assert.ok(violations.some((v) => v.includes('requiredStatusChecks')), violations.join('\n'));
});

test('extractDocumentedRuleset throws without fenced contract', () => {
  assert.throws(() => extractDocumentedRuleset('# no fenced block here'), /fenced contract block/);
});

test('conditional and matrix jobs never overlap required-check names', () => {
  const requiredNames = new Set(REQUIRED_STATUS_CHECKS.map((entry) => entry.job));
  for (const excluded of [...CONDITIONAL_JOBS_EXCLUDED_FROM_REQUIRED_CHECKS, VISUAL_WEB_MATRIX_JOB]) {
    assert.equal(requiredNames.has(excluded.job), false, `${excluded.job} must stay out of REQUIRED_STATUS_CHECKS`);
  }
});
