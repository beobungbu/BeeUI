import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  ROOT_DIR,
  collectCompatibilityReportViolations,
  collectDistTagPolicyViolations,
  collectDistributionPolicyViolations,
  extractConsumerCompatibility,
  extractDistTagPolicy,
} from '../check-distribution-policy.mjs';

const PACKAGE_VERSIONS = {
  '@beemvp/beeui-core': '0.86.2-rc.1',
  '@beemvp/beeui-tokens': '0.86.2-rc.1',
  '@beemvp/beeui-ui': '0.86.2-rc.1',
};
const RELEASE_ENVIRONMENT = 'release';
const ROOT_VERSION = '0.86.2-rc.1';

const UI_PEERS = {
  react: '>=19 <20',
  'react-dom': '>=19 <20',
  'react-native': '>=0.86.0 <0.87.0',
  'react-native-safe-area-context': '>=5 <6',
  'react-native-teleport': '>=1.1 <2',
  '@gorhom/bottom-sheet': '>=5.2 <6',
  '@react-native-community/datetimepicker': '>=9.1 <10',
  'react-native-reanimated': '>=4.5 <5',
  'react-native-gesture-handler': '>=2.32 <3',
  'react-native-worklets': '>=0.10 <1',
  tailwindcss: '>=4 <5',
  uniwind: '>=1.10.1 <2',
};

const MATRIX_SNAPSHOT = {
  node: { repo: '24.13.1', pnpm: '10.15.0' },
  react: '19.2.3',
  reactDom: '19.2.3',
  reactNative: '0.86.2',
  reactNativeWeb: '0.21.0',
  tailwindcss: '4.3.3',
  uniwind: '1.10.1',
};

const GOOD_POLICY = {
  published: true,
  currentVersion: '0.86.2-rc.1',
  candidateStableVersion: '0.86.2',
  prereleaseVersionPattern: '^0\\.86\\.2-rc\\.(0|[1-9][0-9]*)$',
  prereleaseExample: '0.86.2-rc.1',
  distTags: ['latest', 'next'],
  prereleaseDistTag: 'next',
  stableDistTag: 'latest',
  stablePromotionTag: 'latest',
  lockstepPackages: ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui'],
  releaseEnvironment: 'release',
};

const GOOD_REPORT = {
  published: true,
  packageSet: ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui'],
  candidateVersion: '0.86.2-rc.1',
  cleanConsumerScripts: [
    'scripts/verify-bare-consumer.sh',
    'scripts/verify-web-consumer.sh',
    'scripts/verify-expo-consumer.sh',
  ],
  versionPins: {
    react: '19.2.3', reactDom: '19.2.3', reactNative: '0.86.2', reactNativeWeb: '0.21.0',
    node: '24.13.1', tailwindcss: '4.3.3', uniwind: '1.10.1',
  },
  peerPromises: { ...UI_PEERS },
};

const alwaysExists = () => true;

function policyViolations(overrides = {}, packageVersions = PACKAGE_VERSIONS) {
  return collectDistTagPolicyViolations({
    policy: { ...GOOD_POLICY, ...overrides },
    packageVersions,
    releaseEnvironment: RELEASE_ENVIRONMENT,
    existsSync: alwaysExists,
  });
}

function reportViolations(overrides = {}) {
  return collectCompatibilityReportViolations({
    report: { ...GOOD_REPORT, ...overrides },
    matrixSnapshot: MATRIX_SNAPSHOT,
    uiPeerDependencies: UI_PEERS,
    rootVersion: ROOT_VERSION,
    existsSync: alwaysExists,
  });
}

test('published RC policy is valid', () => {
  assert.deepEqual(policyViolations(), []);
});

test('unpublished state remains representable for a future fresh line', () => {
  assert.deepEqual(policyViolations({ published: false }), []);
});

test('published must be boolean', () => {
  assert.ok(policyViolations({ published: 'yes' }).some((v) => /published.*boolean/.test(v)));
});

test('currentVersion must equal library package boundary version', () => {
  assert.ok(policyViolations({ currentVersion: '0.86.2-rc.2' }).some((v) => /currentVersion/.test(v)));
});

test('stable candidate must equal prerelease stable base', () => {
  assert.ok(policyViolations({ candidateStableVersion: '1.0.0' }).some((v) => /candidateStableVersion/.test(v)));
});

test('prerelease pattern rejects stable and describes current RC', () => {
  assert.ok(policyViolations({ prereleaseVersionPattern: '^0\\.86\\.2(-rc\\.[0-9]+)?$' }).some((v) => /must NOT match/.test(v)));
  assert.ok(policyViolations({ prereleaseVersionPattern: '^0\\.86\\.2-rc\\.[2-9]$', prereleaseExample: '0.86.2-rc.2' }).some((v) => /currentVersion/.test(v)));
});

test('dist tags are exactly latest/next with separate stable and RC channels', () => {
  assert.ok(policyViolations({ distTags: ['latest', 'next', 'beta'] }).some((v) => /distTags/.test(v)));
  assert.ok(policyViolations({ prereleaseDistTag: 'latest' }).some((v) => /prereleaseDistTag/.test(v)));
  assert.ok(policyViolations({ stablePromotionTag: 'next' }).some((v) => /stablePromotionTag/.test(v)));
});

test('library package-boundary set must match measured manifests', () => {
  assert.ok(policyViolations({ lockstepPackages: ['@beemvp/beeui-core'] }).some((v) => /lockstepPackages/.test(v)));
});

test('release environment must match ruleset', () => {
  assert.ok(policyViolations({ releaseEnvironment: 'prod' }).some((v) => /releaseEnvironment/.test(v)));
});

test('published compatibility report is valid', () => {
  assert.deepEqual(reportViolations(), []);
});

test('compatibility report published flag must be boolean', () => {
  assert.ok(reportViolations({ published: 'yes' }).some((v) => /published.*boolean/.test(v)));
});

test('peer and version-pin drift are rejected', () => {
  assert.ok(reportViolations({ peerPromises: { ...UI_PEERS, 'react-native': '>=0.86 <0.88' } }).some((v) => /peerPromises/.test(v)));
  assert.ok(reportViolations({ versionPins: { ...GOOD_REPORT.versionPins, reactNative: '0.87.1' } }).some((v) => /versionPins.reactNative/.test(v)));
});

test('missing clean consumer is rejected', () => {
  const violations = collectCompatibilityReportViolations({
    report: GOOD_REPORT,
    matrixSnapshot: MATRIX_SNAPSHOT,
    uiPeerDependencies: UI_PEERS,
    rootVersion: ROOT_VERSION,
    existsSync: (value) => !value.endsWith('verify-expo-consumer.sh'),
  });
  assert.ok(violations.some((v) => /verify-expo-consumer/.test(v)));
});

test('combined policy requires report publication state to match dist policy', () => {
  const distTagMarkdown = `\`\`\`json dist-tag-policy\n${JSON.stringify(GOOD_POLICY)}\n\`\`\``;
  const reportMarkdown = `\`\`\`json consumer-compatibility\n${JSON.stringify({ ...GOOD_REPORT, published: false })}\n\`\`\``;
  const matrixMarkdown = `\`\`\`json compatibility-matrix\n${JSON.stringify(MATRIX_SNAPSHOT)}\n\`\`\``;
  const releaseRulesetMarkdown = `\`\`\`json release-ruleset\n${JSON.stringify({ releaseEnvironment: 'release' })}\n\`\`\``;
  const violations = collectDistributionPolicyViolations({
    distTagMarkdown, reportMarkdown, matrixMarkdown, releaseRulesetMarkdown,
    packageVersions: PACKAGE_VERSIONS, rootVersion: ROOT_VERSION, uiPeerDependencies: UI_PEERS, existsSync: alwaysExists,
  });
  assert.ok(violations.some((v) => /published.*must match/.test(v)));
});

test('real repository fenced blocks pass combined policy check', () => {
  const distTagMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs/dist-tag-policy.md'), 'utf8');
  const reportMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs/consumer-compatibility-report.md'), 'utf8');
  const matrixMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs/compatibility-matrix.md'), 'utf8');
  const releaseRulesetMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs/release-ruleset.md'), 'utf8');

  assert.equal(extractDistTagPolicy(distTagMarkdown).published, true);
  assert.equal(extractConsumerCompatibility(reportMarkdown).published, true);

  const readPkg = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8'));
  const packageVersions = Object.fromEntries(['packages/core', 'packages/tokens', 'packages/ui'].map((dir) => {
    const manifest = readPkg(`${dir}/package.json`);
    return [manifest.name, manifest.version];
  }));

  const violations = collectDistributionPolicyViolations({
    distTagMarkdown,
    reportMarkdown,
    matrixMarkdown,
    releaseRulesetMarkdown,
    packageVersions,
    rootVersion: readPkg('package.json').version,
    uiPeerDependencies: readPkg('packages/ui/package.json').peerDependencies ?? {},
  });
  assert.deepEqual(violations, []);
});
