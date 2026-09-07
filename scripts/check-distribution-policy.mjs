#!/usr/bin/env node

// Guards the two distribution-policy documents against silent drift from the
// repository's real state:
//
//   docs/dist-tag-policy.md            (#206 dist-tag/prerelease policy)
//   docs/consumer-compatibility-report.md (#208 consumer compatibility report)
//
// Neither document publishes anything; both make claims that must stay true:
//
//   - The dist-tag policy pins the lockstep version, the prerelease naming
//     pattern, the two dist-tags, and the `release` environment. Its
//     `currentVersion` must equal every package version and `published` must
//     stay false until the owner actually publishes (#254) — so the policy
//     cannot describe a published state that does not exist.
//   - The compatibility report's version pins must equal
//     docs/compatibility-matrix.md's machine snapshot, and its peer promises
//     must equal packages/ui's declared peerDependencies. This is what
//     mechanically prevents a peer claim in the report from exceeding a tested
//     row (the #129/#208 rule), instead of merely asserting it in prose.
//
// Mirrors the other repo doc-drift checks (check-release-ruleset.mjs,
// check-compatibility-matrix.mjs): a pure violation collector plus a CLI
// runner; the unit tests import the collector.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DIST_TAG_DOC = path.join(ROOT_DIR, 'docs', 'dist-tag-policy.md');
const REPORT_DOC = path.join(ROOT_DIR, 'docs', 'consumer-compatibility-report.md');
const MATRIX_DOC = path.join(ROOT_DIR, 'docs', 'compatibility-matrix.md');
const RELEASE_RULESET_DOC = path.join(ROOT_DIR, 'docs', 'release-ruleset.md');

// The CLI is held to the same version by scripts/check-release-control-plane.mjs, but it is not
// listed here: `lockstepPackages` feeds the docs foundation's `packageNames` and the landing's
// public-package-boundary count, where the CLI is modelled separately as `cliPackageName`.
const LOCKSTEP_PACKAGE_MANIFESTS = ['packages/core', 'packages/tokens', 'packages/ui'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractFencedJson(markdown, tag, docLabel) {
  const match = new RegExp('```json ' + tag + '\\n([\\s\\S]*?)\\n```').exec(markdown);
  if (!match) {
    throw new Error(`${docLabel} is missing its \`\`\`json ${tag} fenced block.`);
  }
  return JSON.parse(match[1]);
}

export function extractDistTagPolicy(markdown) {
  return extractFencedJson(markdown, 'dist-tag-policy', 'docs/dist-tag-policy.md');
}

export function extractConsumerCompatibility(markdown) {
  return extractFencedJson(markdown, 'consumer-compatibility', 'docs/consumer-compatibility-report.md');
}

export function extractCompatibilitySnapshot(markdown) {
  return extractFencedJson(markdown, 'compatibility-matrix', 'docs/compatibility-matrix.md');
}

export function extractReleaseEnvironment(markdown) {
  const block = extractFencedJson(markdown, 'release-ruleset', 'docs/release-ruleset.md');
  return block.releaseEnvironment;
}

// `0.86.2-rc.1` and `0.86.2` are the same release line; the stable base is what a prerelease
// eventually becomes. Only the exact `-rc.N` suffix the policy sanctions is stripped, so an
// unrecognised prerelease form stays visible to the comparisons below rather than being
// silently normalised away.
function stableBase(version) {
  return typeof version === 'string' ? version.replace(/-rc\.(0|[1-9][0-9]*)$/, '') : version;
}

// ---- dist-tag / prerelease policy (#206) ----

export function collectDistTagPolicyViolations({ policy, packageVersions, releaseEnvironment, existsSync }) {
  const violations = [];
  const label = 'docs/dist-tag-policy.md';

  if (policy.published !== false) {
    violations.push(`${label}: "published" must be false until the owner publishes (#254).`);
  }

  // Lockstep invariant: currentVersion equals every package version.
  const distinct = [...new Set(Object.values(packageVersions))];
  if (distinct.length !== 1) {
    violations.push(
      `${label}: lockstep packages are not on one version (${JSON.stringify(packageVersions)}); dist-tag policy assumes a single lockstep version.`,
    );
  } else if (policy.currentVersion !== distinct[0]) {
    violations.push(
      `${label}: "currentVersion" ${JSON.stringify(policy.currentVersion)} must equal the lockstep package version ${JSON.stringify(distinct[0])}.`,
    );
  }

  // The stable candidate is the release line the workspace is already on, not a future number.
  // Owner decision #407 (2026-09-02) had replaced the 0.x -> 1.0.0 scheme with a date label
  // (20260902.0.0); ADR-015 (2026-09-06) supersedes that with plain SemVer 0.86.2. Under either,
  // the workspace legitimately sits *at* the candidate from the start, so "no package has reached
  // it yet" is unsatisfiable — it could only be kept by letting this block contradict its own prose.
  //
  // A release candidate lives on the same line: with currentVersion at 0.86.2-rc.1 the stable
  // candidate is still 0.86.2, so the comparison is against the stable base rather than the
  // literal current version. Requiring equality instead would make an RC pin unsatisfiable,
  // because prereleaseVersionPattern must simultaneously match every rc.N and reject the
  // candidate.
  //
  // What the original rule was protecting is still enforced, just not by a version comparison:
  // `published` must be false (checked above), the docs foundation refuses an install CTA,
  // an available CLI or a missing #254 owner gate while unpublished, and verify-release
  // asserts the root manifest stays private. Publication remains an owner action, not a
  // consequence of a version number.
  const currentStableBase = stableBase(policy.currentVersion);
  if (policy.candidateStableVersion !== currentStableBase) {
    violations.push(
      `${label}: "candidateStableVersion" ${JSON.stringify(policy.candidateStableVersion)} must equal ` +
      `the stable base ${JSON.stringify(currentStableBase)} of "currentVersion" ${JSON.stringify(policy.currentVersion)}.`,
    );
  }

  // Prerelease pattern: valid regex, matches the example and rc.N, rejects the
  // stable version and the current version.
  let re;
  try {
    re = new RegExp(policy.prereleaseVersionPattern);
  } catch (error) {
    violations.push(`${label}: "prereleaseVersionPattern" is not a valid regex: ${error.message}.`);
  }
  if (re) {
    if (!re.test(policy.prereleaseExample)) {
      violations.push(
        `${label}: prereleaseExample ${JSON.stringify(policy.prereleaseExample)} does not match prereleaseVersionPattern.`,
      );
    }
    if (!re.test(`${policy.candidateStableVersion}-rc.2`)) {
      violations.push(`${label}: prereleaseVersionPattern must match "${policy.candidateStableVersion}-rc.2".`);
    }
    if (re.test(policy.candidateStableVersion)) {
      violations.push(
        `${label}: prereleaseVersionPattern must NOT match the stable version ${JSON.stringify(policy.candidateStableVersion)} (a prerelease is not the stable release).`,
      );
    }
    // When the pin itself is a candidate, the pattern has to describe it. Without this, a pin of
    // 0.86.2-rc.1 could sit beside a pattern for a different line and every check stayed green.
    if (policy.currentVersion !== currentStableBase && !re.test(policy.currentVersion)) {
      violations.push(
        `${label}: prerelease "currentVersion" ${JSON.stringify(policy.currentVersion)} must match prereleaseVersionPattern ${JSON.stringify(policy.prereleaseVersionPattern)}.`,
      );
    }
  }

  // Exactly the two dist-tags, and the stable/prerelease/promotion tags are among them.
  const expectedTags = ['latest', 'next'];
  const tags = policy.distTags;
  if (!Array.isArray(tags) || tags.length !== expectedTags.length || !expectedTags.every((t) => tags.includes(t))) {
    violations.push(`${label}: "distTags" must be exactly ${JSON.stringify(expectedTags)}, got ${JSON.stringify(tags)}.`);
  }
  for (const key of ['stableDistTag', 'prereleaseDistTag', 'stablePromotionTag']) {
    if (Array.isArray(tags) && !tags.includes(policy[key])) {
      violations.push(`${label}: "${key}" ${JSON.stringify(policy[key])} must be one of distTags ${JSON.stringify(tags)}.`);
    }
  }
  if (policy.stableDistTag !== 'latest') {
    violations.push(`${label}: "stableDistTag" must be "latest".`);
  }
  // The tag a finished release is promoted to is the stable consumer channel, not a third
  // destination. Naming it separately was only ever a restatement; being in distTags did not
  // stop it naming "next" and pointing default installs at a prerelease.
  if (policy.stablePromotionTag !== policy.stableDistTag) {
    violations.push(
      `${label}: "stablePromotionTag" ${JSON.stringify(policy.stablePromotionTag)} must equal "stableDistTag" ${JSON.stringify(policy.stableDistTag)}.`,
    );
  }
  if (policy.prereleaseDistTag === policy.stableDistTag) {
    violations.push(`${label}: prereleaseDistTag and stableDistTag must differ (prereleases never publish to latest).`);
  }

  // Lockstep package set matches the real manifests.
  const expectedPackages = Object.keys(packageVersions);
  const declared = policy.lockstepPackages;
  if (
    !Array.isArray(declared) ||
    declared.length !== expectedPackages.length ||
    !expectedPackages.every((p) => declared.includes(p))
  ) {
    violations.push(
      `${label}: "lockstepPackages" ${JSON.stringify(declared)} must equal the real package set ${JSON.stringify(expectedPackages)}.`,
    );
  }

  // Release environment matches the live ruleset contract.
  if (policy.releaseEnvironment !== releaseEnvironment) {
    violations.push(
      `${label}: "releaseEnvironment" ${JSON.stringify(policy.releaseEnvironment)} must equal docs/release-ruleset.md's ${JSON.stringify(releaseEnvironment)}.`,
    );
  }

  return violations;
}

// ---- consumer compatibility report (#208) ----

// Maps report versionPins keys to the compatibility-matrix snapshot value.
function matrixValueFor(key, snapshot) {
  switch (key) {
    case 'node':
      return snapshot.node?.repo;
    case 'reactDom':
      return snapshot.reactDom;
    case 'reactNative':
      return snapshot.reactNative;
    case 'reactNativeWeb':
      return snapshot.reactNativeWeb;
    default:
      return snapshot[key];
  }
}

export function collectCompatibilityReportViolations({ report, matrixSnapshot, uiPeerDependencies, rootVersion, existsSync }) {
  const violations = [];
  const label = 'docs/consumer-compatibility-report.md';

  if (report.published !== false) {
    violations.push(`${label}: "published" must be false — no npm artifact exists.`);
  }

  const expectedPackages = ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui'];
  if (
    !Array.isArray(report.packageSet) ||
    report.packageSet.length !== expectedPackages.length ||
    !expectedPackages.every((p) => report.packageSet.includes(p))
  ) {
    violations.push(`${label}: "packageSet" must be ${JSON.stringify(expectedPackages)}.`);
  }

  if (report.candidateVersion !== rootVersion) {
    violations.push(
      `${label}: "candidateVersion" ${JSON.stringify(report.candidateVersion)} must equal the lockstep root version ${JSON.stringify(rootVersion)}.`,
    );
  }

  // Every clean-consumer script the report cites must exist on disk.
  for (const rel of report.cleanConsumerScripts ?? []) {
    if (!existsSync(path.join(ROOT_DIR, rel))) {
      violations.push(`${label}: cleanConsumerScripts references "${rel}", which does not exist.`);
    }
  }

  // Version pins must equal the compatibility-matrix snapshot exactly.
  for (const [key, value] of Object.entries(report.versionPins ?? {})) {
    const expected = matrixValueFor(key, matrixSnapshot);
    if (expected === undefined) {
      violations.push(`${label}: versionPins has "${key}", which has no docs/compatibility-matrix.md counterpart.`);
    } else if (value !== expected) {
      violations.push(
        `${label}: versionPins.${key} ${JSON.stringify(value)} must equal docs/compatibility-matrix.md ${JSON.stringify(expected)}.`,
      );
    }
  }

  // Peer promises must equal packages/ui's declared peerDependencies exactly —
  // the report may not claim a wider (or narrower) peer than the package.
  for (const [name, range] of Object.entries(report.peerPromises ?? {})) {
    const declared = uiPeerDependencies[name];
    if (declared === undefined) {
      violations.push(`${label}: peerPromises has "${name}", which is not a packages/ui peerDependency.`);
    } else if (range !== declared) {
      violations.push(
        `${label}: peerPromises["${name}"] ${JSON.stringify(range)} must equal packages/ui peerDependencies ${JSON.stringify(declared)} (a report claim must not exceed the declared peer).`,
      );
    }
  }

  return violations;
}

export function collectDistributionPolicyViolations({
  distTagMarkdown,
  reportMarkdown,
  matrixMarkdown,
  releaseRulesetMarkdown,
  packageVersions,
  rootVersion,
  uiPeerDependencies,
  existsSync = fs.existsSync,
}) {
  const violations = [];

  let policy;
  let report;
  let matrixSnapshot;
  let releaseEnvironment;
  try {
    policy = extractDistTagPolicy(distTagMarkdown);
    report = extractConsumerCompatibility(reportMarkdown);
    matrixSnapshot = extractCompatibilitySnapshot(matrixMarkdown);
    releaseEnvironment = extractReleaseEnvironment(releaseRulesetMarkdown);
  } catch (error) {
    return [error.message];
  }

  violations.push(...collectDistTagPolicyViolations({ policy, packageVersions, releaseEnvironment, existsSync }));
  violations.push(
    ...collectCompatibilityReportViolations({ report, matrixSnapshot, uiPeerDependencies, rootVersion, existsSync }),
  );

  return violations;
}

function runCli() {
  const packageVersions = Object.fromEntries(
    LOCKSTEP_PACKAGE_MANIFESTS.map((dir) => {
      const manifest = readJson(path.join(ROOT_DIR, dir, 'package.json'));
      return [manifest.name, manifest.version];
    }),
  );
  const rootVersion = readJson(path.join(ROOT_DIR, 'package.json')).version;
  const uiPeerDependencies = readJson(path.join(ROOT_DIR, 'packages', 'ui', 'package.json')).peerDependencies ?? {};

  const violations = collectDistributionPolicyViolations({
    distTagMarkdown: fs.readFileSync(DIST_TAG_DOC, 'utf8'),
    reportMarkdown: fs.readFileSync(REPORT_DOC, 'utf8'),
    matrixMarkdown: fs.readFileSync(MATRIX_DOC, 'utf8'),
    releaseRulesetMarkdown: fs.readFileSync(RELEASE_RULESET_DOC, 'utf8'),
    packageVersions,
    rootVersion,
    uiPeerDependencies,
  });

  if (violations.length > 0) {
    console.error('Distribution-policy docs have drifted from the repository state:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    'Distribution-policy check passed (dist-tag policy and consumer compatibility report match versions, peers, matrix and release environment).',
  );
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    runCli();
  } catch (error) {
    console.error(`Distribution-policy check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
