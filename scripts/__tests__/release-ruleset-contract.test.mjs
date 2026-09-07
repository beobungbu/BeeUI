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
  verify-docs:
    needs: [classify]
    if: needs.classify.outputs.docs-required == 'true'
  verify-tokens:
    needs: [classify]
    if: needs.classify.outputs.tokens-required == 'true'
  verify-runtime:
    needs: [classify]
    if: needs.classify.outputs.package-required == 'true'
  verify-release:
    needs: [classify]
    if: needs.classify.outputs.release-required == 'true'
  verify-benchmark:
    needs: [classify]
    if: needs.classify.outputs.benchmark-required == 'true'
  bare-consumer:
    needs: [classify]
    if: >
      needs.classify.outputs.package-boundary-required == 'true' ||
      needs.classify.outputs.consumer-required == 'true'
  android-native:
    needs: [classify]
    if: needs.classify.outputs.bare-native-required == 'true'
  ios-native:
    needs: [classify]
    if: needs.classify.outputs.ios-native-required == 'true'
`;

const ALWAYS_WRAPPED_REPORT_JOB = `
jobs:
  visual-web-full:
    strategy:
      matrix:
        lane: [showcase-acceptance-matrix, showcase-integration, canonical-and-smoke]
  visual-web-report:
    needs: [visual-web-full]
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
  const condition = extractJobIfCondition(CLASSIFY_GATED_JOBS, 'bare-consumer');
  assert.match(condition, /package-boundary-required/);
});

test('required fan-in aggregators using always() count as always-run', () => {
  assert.equal(jobAlwaysRuns(ALWAYS_RUN_CI_JOBS, 'classify'), true);
  assert.equal(jobAlwaysRuns(ALWAYS_RUN_CI_JOBS, 'verify'), true);
  assert.equal(jobAlwaysRuns(ALWAYS_WRAPPED_REPORT_JOB, 'visual-web-report'), true);
});

test('classifier/runtime gated jobs remain conditionally skippable', () => {
  assert.equal(jobIsConditionallySkippable(CLASSIFY_GATED_JOBS, 'android-native'), true);
  assert.equal(jobIsConditionallySkippable(CLASSIFY_GATED_JOBS, 'ios-native'), true);
  assert.equal(jobIsConditionallySkippable(LABEL_GATED_RUNTIME_JOB, 'ios-runtime'), true);
});

test('a required job gated on the pull_request event still counts as always-run', () => {
  const prScoped = `
jobs:
  visual-web-report:
    if: github.event_name == 'pull_request'
`;
  assert.equal(jobAlwaysRuns(prScoped, 'visual-web-report'), true);
});

test('a required job hidden behind a label or classifier is still rejected', () => {
  const labelScoped = `
jobs:
  visual-web-report:
    if: contains(github.event.pull_request.labels.*.name, 'ci:visual')
`;
  const classifierScoped = `
jobs:
  visual-web-report:
    if: needs.classify.outputs.visual-required == 'true'
`;
  const pushScoped = `
jobs:
  visual-web-report:
    if: github.event_name == 'push'
`;
  assert.equal(jobAlwaysRuns(labelScoped, 'visual-web-report'), false);
  assert.equal(jobAlwaysRuns(classifierScoped, 'visual-web-report'), false);
  assert.equal(jobAlwaysRuns(pushScoped, 'visual-web-report'), false);
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
  verify-docs:
    if: needs.classify.outputs.docs-required == 'true'
  verify-tokens:
    if: needs.classify.outputs.tokens-required == 'true'
  verify-runtime:
    if: needs.classify.outputs.package-required == 'true'
  verify-release:
    if: needs.classify.outputs.release-required == 'true'
  verify-benchmark:
    if: needs.classify.outputs.benchmark-required == 'true'
  bare-consumer:
    if: needs.classify.outputs.consumer-required == 'true'
  android-native:
    if: needs.classify.outputs.bare-native-required == 'true'
  ios-native:
    if: needs.classify.outputs.ios-native-required == 'true'
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
