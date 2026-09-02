#!/usr/bin/env node

// Pins the exact GitHub required-status-check names the `main` branch
// ruleset depends on, and guards docs/release-ruleset.md against silently
// drifting from the actual `if:` gating in the workflow files that produce
// those checks (issue #196).
//
// Standard GitHub-hosted runners are isolated, ephemeral VMs and are free for
// public repositories. Required checks therefore run for ordinary pull
// requests, including forks, with `permissions: contents: read`; they must not
// be hidden behind labels, path classifiers, or same-repository guards.
// Conditional native/runtime jobs remain intentionally outside the required
// set because GitHub reports skipped required checks as unsatisfied.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC_PATH = path.join(ROOT_DIR, 'docs', 'release-ruleset.md');

// Canonical, pinned set of GitHub status-check names required by the `main`
// branch ruleset. Changing this list must be a deliberate decision reviewed
// alongside the live ruleset update — see docs/release-ruleset.md.
export const REQUIRED_STATUS_CHECKS = Object.freeze([
  { workflow: 'ci.yml', job: 'classify' },
  { workflow: 'ci.yml', job: 'verify' },
  { workflow: 'web-a11y.yml', job: 'web-a11y' },
  { workflow: 'visual-web.yml', job: 'visual-web-report' },
  { workflow: 'web-consumer.yml', job: 'web-consumer' },
]);

// Native/runtime jobs intentionally EXCLUDED from REQUIRED_STATUS_CHECKS
// because they can be conditionally skipped on ordinary pull requests.
export const CONDITIONAL_JOBS_EXCLUDED_FROM_REQUIRED_CHECKS = Object.freeze([
  { workflow: 'ci.yml', job: 'bare-native' },
  { workflow: 'ci.yml', job: 'ios-native' },
  { workflow: 'runtime-native.yml', job: 'ios-runtime' },
  { workflow: 'runtime-native.yml', job: 'android-runtime' },
]);

// Also intentionally excluded: the per-shard `visual-web (1/2/3)` matrix
// checks. They always run, but requiring each shard by name is fragile
// against a future shard-count change; `visual-web-report` already depends on
// the full matrix and is the single authoritative visual signal.
export const VISUAL_WEB_MATRIX_JOB = Object.freeze({ workflow: 'visual-web.yml', job: 'visual-web' });

function normalizeCondition(raw) {
  return raw.replace(/\s+/g, ' ').trim();
}

export function extractJobBlock(workflowYaml, jobName) {
  const lines = workflowYaml.split('\n');
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex === -1) {
    throw new Error('Workflow file has no top-level "jobs:" key.');
  }

  const jobHeaderRe = new RegExp(`^  ${jobName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*$`);
  const anyJobHeaderRe = /^ {2}[A-Za-z0-9_-]+:\s*$/;

  let start = -1;
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    if (jobHeaderRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    throw new Error(`Job "${jobName}" not found under jobs:.`);
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (anyJobHeaderRe.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

// Returns the job's `if:` condition as a single normalized string, or null
// when the job has no `if:` (i.e. always runs whenever its `needs` allow).
export function extractJobIfCondition(workflowYaml, jobName) {
  const block = extractJobBlock(workflowYaml, jobName);
  const lines = block.split('\n');
  const ifLineIndex = lines.findIndex((line) => /^ {4}if:\s*/.test(line));
  if (ifLineIndex === -1) return null;

  const inlineMatch = /^ {4}if:\s*(.*)$/.exec(lines[ifLineIndex]);
  const inlineValue = inlineMatch[1].trim();

  // Block scalar (`>`, `>-`, `|`, `|-`): condition is the following
  // deeper-indented lines, not the marker itself.
  if (/^[>|]-?$/.test(inlineValue) || inlineValue === '') {
    const collected = [];
    for (let i = ifLineIndex + 1; i < lines.length; i += 1) {
      if (/^ {6,}\S/.test(lines[i])) {
        collected.push(lines[i].trim());
      } else if (lines[i].trim() === '') {
        continue;
      } else {
        break;
      }
    }
    return normalizeCondition(collected.join(' '));
  }

  return normalizeCondition(inlineValue);
}

// Required jobs either have no `if:` at all, or use `always()` only when
// they aggregate another job/matrix (visual-web-report). Any other condition
// can make a required check disappear or report skipped for a legitimate PR.
export function jobAlwaysRuns(workflowYaml, jobName) {
  const condition = extractJobIfCondition(workflowYaml, jobName);
  if (condition === null) return true;
  return condition.replace(/\s+/g, '') === 'always()';
}

export function jobIsConditionallySkippable(workflowYaml, jobName) {
  return !jobAlwaysRuns(workflowYaml, jobName);
}

export function extractDocumentedRuleset(markdown) {
  const match = /```json release-ruleset\n([\s\S]*?)\n```/.exec(markdown);
  if (!match) {
    throw new Error('docs/release-ruleset.md is missing its ```json release-ruleset fenced contract block.');
  }
  return JSON.parse(match[1]);
}

export function collectReleaseRulesetViolations({ markdown, workflowContentsByFile }) {
  const violations = [];

  let documented;
  try {
    documented = extractDocumentedRuleset(markdown);
  } catch (error) {
    return [error.message];
  }

  const canonicalNames = REQUIRED_STATUS_CHECKS.map((entry) => entry.job);
  const documentedNames = documented.requiredStatusChecks;
  if (!Array.isArray(documentedNames) || documentedNames.length !== canonicalNames.length) {
    violations.push(
      `docs/release-ruleset.md requiredStatusChecks ${JSON.stringify(documentedNames)} does not match the pinned set ${JSON.stringify(canonicalNames)}.`,
    );
  } else {
    for (const name of canonicalNames) {
      if (!documentedNames.includes(name)) {
        violations.push(`docs/release-ruleset.md requiredStatusChecks is missing "${name}".`);
      }
    }
  }

  for (const { workflow, job } of REQUIRED_STATUS_CHECKS) {
    const contents = workflowContentsByFile[workflow];
    if (!contents) {
      violations.push(`Missing workflow contents for ${workflow} needed to verify job "${job}".`);
      continue;
    }
    if (jobIsConditionallySkippable(contents, job)) {
      violations.push(
        `${workflow}:${job} is a required status check but its "if:" condition can skip it on an ordinary pull request.`,
      );
    }
  }

  for (const { job } of [...CONDITIONAL_JOBS_EXCLUDED_FROM_REQUIRED_CHECKS, VISUAL_WEB_MATRIX_JOB]) {
    if (canonicalNames.includes(job)) {
      violations.push(`"${job}" must not appear in REQUIRED_STATUS_CHECKS (it is a conditional/per-shard job).`);
    }
  }

  for (const { workflow, job } of CONDITIONAL_JOBS_EXCLUDED_FROM_REQUIRED_CHECKS) {
    const contents = workflowContentsByFile[workflow];
    if (!contents) {
      violations.push(`Missing workflow contents for ${workflow} needed to verify job "${job}".`);
      continue;
    }
    if (jobAlwaysRuns(contents, job)) {
      violations.push(
        `${workflow}:${job} is documented as conditionally-skipped, but its "if:" condition now always runs — re-evaluate whether it should become a required check.`,
      );
    }
  }

  return violations;
}

function runCli() {
  const workflowFiles = ['ci.yml', 'visual-web.yml', 'web-a11y.yml', 'web-consumer.yml', 'runtime-native.yml'];
  const workflowContentsByFile = Object.fromEntries(
    workflowFiles.map((file) => [file, fs.readFileSync(path.join(ROOT_DIR, '.github', 'workflows', file), 'utf8')]),
  );
  const markdown = fs.readFileSync(DOC_PATH, 'utf8');

  const violations = collectReleaseRulesetViolations({ markdown, workflowContentsByFile });

  if (violations.length > 0) {
    console.error('docs/release-ruleset.md has drifted from the repository CI workflows:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log('Release ruleset check passed (required-check names match always-run, non-skippable jobs).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    runCli();
  } catch (error) {
    console.error(`Release ruleset check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
