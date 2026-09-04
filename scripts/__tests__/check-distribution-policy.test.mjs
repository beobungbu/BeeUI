import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCompatibilityReportViolations,
  collectDistTagPolicyViolations,
  collectDistributionPolicyViolations,
  extractConsumerCompatibility,
  extractDistTagPolicy,
} from '../check-distribution-policy.mjs';

const PACKAGE_VERSIONS = {
  '@beemvp/beeui-core': '20260902.0.0',
  '@beemvp/beeui-tokens': '20260902.0.0',
  '@beemvp/beeui-ui': '20260902.0.0',
  '@beemvp/beeui-cli': '20260902.0.0',
};
const RELEASE_ENVIRONMENT = 'release';
const ROOT_VERSION = '20260902.0.0';

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
  published: false,
  currentVersion: '20260902.0.0',
  candidateStableVersion: '20260902.0.0',
  prereleaseVersionPattern: '^20260902\\.0\\.0-rc\\.(0|[1-9][0-9]*)$',
  prereleaseExample: '20260902.0.0-rc.1',
  distTags: ['latest', 'next'],
  prereleaseDistTag: 'next',
  stableDistTag: 'latest',
  atomicPromotionTag: 'latest',
  lockstepPackages: [
    '@beemvp/beeui-core',
    '@beemvp/beeui-tokens',
    '@beemvp/beeui-ui',
    '@beemvp/beeui-cli',
  ],
  releaseEnvironment: 'release',
};

const GOOD_REPORT = {
  published: false,
  packageSet: ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui'],
  candidateVersion: ROOT_VERSION,
  cleanConsumerScripts: [
    'scripts/verify-bare-consumer.sh',
    'scripts/verify-web-consumer.sh',
    'scripts/verify-expo-consumer.sh',
  ],
  versionPins: {
    react: '19.2.3',
    reactDom: '19.2.3',
    reactNative: '0.86.2',
    reactNativeWeb: '0.21.0',
    node: '24.13.1',
    tailwindcss: '4.3.3',
    uniwind: '1.10.1',
  },
  peerPromises: { ...UI_PEERS },
};

const alwaysExists = () => true;

function policyViolations(overrides, packageVersions = PACKAGE_VERSIONS) {
  return collectDistTagPolicyViolations({
    policy: { ...GOOD_POLICY, ...overrides },
    packageVersions,
    releaseEnvironment: RELEASE_ENVIRONMENT,
    existsSync: alwaysExists,
  });
}

function reportViolations(overrides) {
  return collectCompatibilityReportViolations({
    report: { ...GOOD_REPORT, ...overrides },
    matrixSnapshot: MATRIX_SNAPSHOT,
    uiPeerDependencies: UI_PEERS,
    rootVersion: ROOT_VERSION,
    existsSync: alwaysExists,
  });
}

test('clean stable dist-tag policy fixture produces no violations', () => {
  assert.deepEqual(policyViolations({}), []);
});

test('clean rc fixture on the same date-version line produces no violations', () => {
  const rc = '20260902.0.0-rc.3';
  const packageVersions = Object.fromEntries(Object.keys(PACKAGE_VERSIONS).map((name) => [name, rc]));
  assert.deepEqual(policyViolations({ currentVersion: rc }, packageVersions), []);
});

test('published:true is rejected while the repo still records pre-publication state', () => {
  assert.ok(policyViolations({ published: true }).some((v) => /published/.test(v)));
});

test('currentVersion must equal the lockstep package version', () => {
  assert.ok(policyViolations({ currentVersion: '20260902.0.0-rc.1' }).some((v) => /currentVersion/.test(v)));
});

test('candidate stable version must equal the stable base of currentVersion', () => {
  assert.ok(policyViolations({ candidateStableVersion: '1.0.0' }).some((v) => /candidateStableVersion/.test(v)));
});

test('prerelease pattern must reject the stable version', () => {
  const v = policyViolations({ prereleaseVersionPattern: '^20260902\\.0\\.0(-rc\\.[0-9]+)?$' });
  assert.ok(v.some((m) => /must NOT match the stable version/.test(m)));
});

test('prerelease example must match the pattern', () => {
  assert.ok(policyViolations({ prereleaseExample: '20260902.0.0' }).some((v) => /prereleaseExample/.test(v)));
});

test('an invalid prerelease regex is reported', () => {
  assert.ok(policyViolations({ prereleaseVersionPattern: '^20260902\\.0\\.0-rc\\.(' }).some((v) => /valid regex/.test(v)));
});

test('distTags must be exactly latest and next', () => {
  assert.ok(policyViolations({ distTags: ['latest', 'next', 'beta'] }).some((v) => /distTags/.test(v)));
});

test('prerelease must not publish to the stable dist-tag', () => {
  assert.ok(
    policyViolations({ prereleaseDistTag: 'latest' }).some((v) => /prereleaseDistTag and stableDistTag must differ/.test(v)),
  );
});

test('releaseEnvironment must match the ruleset', () => {
  assert.ok(policyViolations({ releaseEnvironment: 'prod' }).some((v) => /releaseEnvironment/.test(v)));
});

test('CLI is part of the lockstep published set', () => {
  const v = policyViolations({ lockstepPackages: ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui'] });
  assert.ok(v.some((m) => /lockstepPackages/.test(m)));
});

test('a peer promise wider than the declared peer is rejected', () => {
  const v = reportViolations({ peerPromises: { ...UI_PEERS, 'react-native': '>=0.86.0 <0.88.0' } });
  assert.ok(v.some((m) => /peerPromises\["react-native"\]/.test(m)));
});

test('a version pin that drifts from the matrix is rejected', () => {
  const v = reportViolations({ versionPins: { ...GOOD_REPORT.versionPins, reactNative: '0.87.1' } });
  assert.ok(v.some((m) => /versionPins.reactNative/.test(m)));
});

test('node pin maps to the matrix node.repo value', () => {
  const v = reportViolations({ versionPins: { ...GOOD_REPORT.versionPins, node: '22.0.0' } });
  assert.ok(v.some((m) => /versionPins.node/.test(m)));
});

test('a missing clean-consumer script is reported', () => {
  const v = collectCompatibilityReportViolations({
    report: GOOD_REPORT,
    matrixSnapshot: MATRIX_SNAPSHOT,
    uiPeerDependencies: UI_PEERS,
    rootVersion: ROOT_VERSION,
    existsSync: (p) => !p.endsWith('verify-expo-consumer.sh'),
  });
  assert.ok(v.some((m) => /verify-expo-consumer\.sh.*does not exist/.test(m)));
});

test('published:true on the report is rejected', () => {
  assert.ok(reportViolations({ published: true }).some((v) => /published/.test(v)));
});

test('a peerPromises key that is not a real peer is rejected', () => {
  const v = reportViolations({ peerPromises: { ...UI_PEERS, 'react-native-svg': '>=1 <2' } });
  assert.ok(v.some((m) => /not a packages\/ui peerDependency/.test(m)));
});

test('the real docs expose parseable fenced blocks that pass the combined check', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { ROOT_DIR } = await import('../check-distribution-policy.mjs');

  const distTagMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs', 'dist-tag-policy.md'), 'utf8');
  const reportMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs', 'consumer-compatibility-report.md'), 'utf8');
  const matrixMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs', 'compatibility-matrix.md'), 'utf8');
  const rulesetMarkdown = fs.readFileSync(path.join(ROOT_DIR, 'docs', 'release-ruleset.md'), 'utf8');

  assert.equal(extractDistTagPolicy(distTagMarkdown).published, false);
  assert.equal(extractConsumerCompatibility(reportMarkdown).published, false);

  const readPkg = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8'));
  const packageVersions = Object.fromEntries(
    ['packages/core', 'packages/tokens', 'packages/ui', 'packages/cli'].map((d) => {
      const m = readPkg(`${d}/package.json`);
      return [m.name, m.version];
    }),
  );

  const violations = collectDistributionPolicyViolations({
    distTagMarkdown,
    reportMarkdown,
    matrixMarkdown,
    releaseRulesetMarkdown: rulesetMarkdown,
    packageVersions,
    rootVersion: readPkg('package.json').version,
    uiPeerDependencies: readPkg('packages/ui/package.json').peerDependencies ?? {},
  });

  assert.deepEqual(violations, []);
});
