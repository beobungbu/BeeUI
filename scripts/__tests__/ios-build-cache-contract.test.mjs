import assert from 'node:assert/strict';
import test from 'node:test';

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function sources() {
  const [
    ci,
    runtime,
    expo,
    webConsumer,
    webA11y,
    visual,
    visualConfig,
    beeuiWeb,
    environmentCi,
    bareScript,
    expoScript,
  ] = await Promise.all([
    read('.github/workflows/ci.yml'),
    read('.github/workflows/runtime-native.yml'),
    read('.github/workflows/expo-consumer.yml'),
    read('.github/workflows/web-consumer.yml'),
    read('.github/workflows/web-a11y.yml'),
    read('.github/workflows/visual-web.yml'),
    read('apps/visual-regression/playwright.config.ts'),
    read('.github/workflows/beeui-web.yml'),
    read('.github/workflows/beeui-environment-ci.yml'),
    read('scripts/verify-bare-consumer.sh'),
    read('scripts/verify-expo-consumer.sh'),
  ]);
  return { ci, runtime, expo, webConsumer, webA11y, visual, visualConfig, beeuiWeb, environmentCi, bareScript, expoScript };
}

test('PR CI is affected-first instead of eight verification lanes plus three export jobs', async () => {
  const { ci } = await sources();
  assert.match(ci, /^  classify:\n/m);
  assert.match(ci, /^  verify-fast:\n/m);
  assert.match(ci, /^  verify-docs:\n/m);
  assert.match(ci, /^  verify-tokens:\n/m);
  assert.match(ci, /^  verify-runtime:\n/m);
  assert.doesNotMatch(ci, /^  verify-lane:\n/m);
  assert.doesNotMatch(ci, /platform: \[web, android, ios\]/);
  assert.doesNotMatch(ci, /^  showcase-bundle:\n/m);
});

test('classifier stays on the shortest path and emits reusable scope/native outputs', async () => {
  const { ci } = await sources();
  const classifyBlock = ci.slice(ci.indexOf('  classify:'), ci.indexOf('  verify-fast:'));
  assert.match(classifyBlock, /fetch-depth: 0/);
  assert.match(classifyBlock, /node \.\/scripts\/ci-scope\.mjs/);
  assert.match(classifyBlock, /node \.\/scripts\/classify-ci-changes\.mjs/);
  assert.doesNotMatch(classifyBlock, /pnpm install/);
  assert.doesNotMatch(classifyBlock, /node --test/);
});

test('normal PR fast lane owns CI policy contracts while expensive checks are conditional', async () => {
  const { ci } = await sources();
  const fast = ci.slice(ci.indexOf('  verify-fast:'), ci.indexOf('  verify-docs:'));
  assert.match(fast, /classify-ci-changes\.test\.mjs/);
  assert.match(fast, /ci-scope\.test\.mjs/);
  assert.match(fast, /ios-build-cache-contract\.test\.mjs/);

  for (const job of ['verify-docs', 'verify-tokens', 'verify-runtime', 'verify-release', 'verify-benchmark', 'bare-consumer']) {
    const start = ci.indexOf(`  ${job}:`);
    assert.ok(start >= 0, job);
    // The next job header, not merely the next two-space-indented line: job
    // bodies are indented deeper, so anchoring on `\n  ` alone would slice the
    // block down to its own header and make the `if:` assertion vacuous.
    const rest = ci.slice(start + job.length + 3);
    const next = rest.search(/\n {2}[A-Za-z][\w-]*:/);
    const block = rest.slice(0, next >= 0 ? next : undefined);
    assert.match(block, /\n {4}if: /, job);
  }
});

test('stable verify fan-in blocks any selected lane failure including native', async () => {
  const { ci } = await sources();
  const block = ci.slice(ci.indexOf('  verify:'));
  for (const need of ['verify-fast', 'verify-docs', 'verify-runtime', 'bare-consumer', 'android-native', 'ios-native']) {
    assert.match(block, new RegExp(`- ${need.replace('-', '\\-')}`), need);
  }
  assert.match(block, /success\|skipped/);
  assert.match(block, /test "\$CLASSIFY" = success/);
});

test('iOS native proofs share one macOS runner and persist only Xcode compilation cache', async () => {
  const { ci, bareScript } = await sources();
  assert.match(ci, /^  ios-native:\n/m);
  assert.doesNotMatch(ci, /^  ios-showcase:\n/m);
  assert.doesNotMatch(ci, /^  ios-bare:\n/m);
  assert.match(ci, /Restore Xcode compilation results/);
  assert.match(ci, /Save Xcode compilation results/);
  assert.match(ci, /CompilationCache\.noindex/);
  assert.match(ci, /xcode-cas-v1-/);
  assert.doesNotMatch(ci, /Cache Xcode DerivedData/);
  assert.match(ci, /COMPILATION_CACHE_ENABLE_CACHING="\$BEEUI_XCODE_COMPILATION_CACHE"/);
  assert.match(bareScript, /COMPILATION_CACHE_ENABLE_CACHING=YES/);
});

test('Android builds use Gradle setup action instead of manually caching Gradle User Home', async () => {
  const { ci, runtime, expo } = await sources();
  const pin = /gradle\/actions\/setup-gradle@9c971963bec38e04b3d30dcc455b5382be2fdbfb/;
  assert.match(ci, pin);
  assert.match(runtime, pin);
  assert.match(expo, pin);
  assert.doesNotMatch(ci, /- name: Cache Gradle\n\s+uses: actions\/cache/);
  assert.doesNotMatch(runtime, /- name: Cache Gradle\n\s+uses: actions\/cache/);
  assert.doesNotMatch(expo, /- name: Cache Gradle\n\s+uses: actions\/cache/);
  assert.match(ci, /cache-encryption-key: \$\{\{ secrets\.GRADLE_ENCRYPTION_KEY \}\}/);
  assert.match(expo, /cache-encryption-key: \$\{\{ secrets\.GRADLE_ENCRYPTION_KEY \}\}/);
});

test('runtime Android weekly schedule is clean-room for task/configuration outputs', async () => {
  const { runtime } = await sources();
  assert.match(runtime, /github\.event_name == 'schedule' && 'false' \|\| 'true'/);
  assert.match(runtime, /-Dorg\.gradle\.caching=/);
  assert.match(runtime, /-Dorg\.gradle\.configuration-cache=/);
  assert.match(runtime, /force-avd-creation: true/);
  assert.doesNotMatch(runtime, /Cache Android AVD/);
});

test('Expo consumer has one JS proof job and native jobs are change-gated', async () => {
  const { expo } = await sources();
  assert.match(expo, /^  scope:\n/m);
  assert.match(expo, /^  expo-consumer:\n/m);
  assert.doesNotMatch(expo, /^  platform-export:\n/m);
  assert.doesNotMatch(expo, /matrix:\n\s+platform: \[android, ios\]/);
  assert.match(expo, /^  android-native:\n\s+needs: \[scope\]\n\s+if: needs\.scope\.outputs\.native-required == 'true'/m);
  assert.match(expo, /^  ios-native:\n\s+needs: \[scope\]\n\s+if: needs\.scope\.outputs\.native-required == 'true'/m);
  assert.doesNotMatch(expo, /head\.repo\.full_name == github\.repository \|\|/);
  assert.match(expo, /Restore Xcode compilation results/);
  assert.match(expo, /Save Xcode compilation results/);
});

test('required Web consumer check skips browser work when package surface is unchanged', async () => {
  const { webConsumer } = await sources();
  assert.match(webConsumer, /^  web-consumer:\n/m);
  assert.match(webConsumer, /node \.\/scripts\/ci-scope\.mjs/);
  assert.match(webConsumer, /if: steps\.scope\.outputs\.consumer != 'true'/);
  assert.match(webConsumer, /if: steps\.scope\.outputs\.consumer == 'true'/);
  assert.match(webConsumer, /BEEUI_WEB_CONSUMER_CLEAN: '1'/);
});

test('required accessibility check skips Playwright provisioning when visual surface is unchanged', async () => {
  const { webA11y } = await sources();
  assert.match(webA11y, /^  web-a11y:\n/m);
  assert.match(webA11y, /node \.\/scripts\/ci-scope\.mjs/);
  assert.match(webA11y, /if: steps\.scope\.outputs\.visual != 'true'/);
  assert.match(webA11y, /if: steps\.scope\.outputs\.visual == 'true'/);
});

test('development PR visual proof is targeted while full pushes use three duration-balanced semantic lanes', async () => {
  const { visual, visualConfig } = await sources();
  const prBlock = visual.slice(visual.indexOf('  visual-web-report:'), visual.indexOf('  visual-web-full:'));
  assert.match(prBlock, /if: github\.event_name == 'pull_request'/);
  assert.match(prBlock, /--project=mobile-light/);
  assert.match(prBlock, /--project=showcase-acceptance-smoke/);
  assert.doesNotMatch(prBlock, /--shard=/);
  assert.doesNotMatch(prBlock, /matrix:/);

  const fullBlock = visual.slice(visual.indexOf('  visual-web-full:'));
  assert.match(fullBlock, /if: github\.event_name == 'push'/);
  assert.match(fullBlock, /lane: \[canonical-and-smoke, showcase-integration, showcase-acceptance-matrix\]/);
  assert.match(fullBlock, /--project='mobile-\*'/);
  assert.match(fullBlock, /--project='desktop-\*'/);
  assert.match(fullBlock, /--project=showcase-integration/);
  assert.match(fullBlock, /--project=showcase-acceptance-matrix/);
  assert.doesNotMatch(fullBlock, /--shard=/);

  assert.match(visualConfig, /name: 'showcase-integration'[\s\S]*testIgnore: rootShowcaseSpec/);
  assert.match(visualConfig, /name: 'showcase-acceptance-matrix'[\s\S]*grep: fullAcceptanceMatrix/);
  assert.match(visualConfig, /name: 'showcase-acceptance-smoke'[\s\S]*grepInvert: fullAcceptanceMatrix/);
});

// The assertions above only prove visual-web.yml contains the strings this PR
// wrote. They stay green if someone adds a Playwright project that no lane
// selects, which drops its screens from CI while the report still passes. This
// derives the real project list from the visual contract and holds the lanes to
// it: every project claimed exactly once, no drops and no double runs.
test('every visual project is claimed by exactly one full-run lane', async () => {
  const { visualViewports, visualThemes } = await import('../../apps/visual-regression/src/visual-contract.ts');
  const { visual } = await sources();

  const projects = [
    ...Object.keys(visualViewports).flatMap((viewport) => visualThemes.map((theme) => `${viewport}-${theme}`)),
    'showcase-integration',
    'showcase-acceptance-matrix',
    'showcase-acceptance-smoke',
  ];

  const fullBlock = visual.slice(visual.indexOf('  visual-web-full:'));
  const filters = [...fullBlock.matchAll(/--project=('?)([^'\s\\]+)\1/g)].map((match) => match[2]);
  assert.ok(filters.length > 0, 'no --project filters found in the visual-web-full job');

  const toRegExp = (glob) => new RegExp(`^${glob.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  const matchers = filters.map((glob) => ({ glob, re: toRegExp(glob) }));

  for (const project of projects) {
    const claimedBy = matchers.filter((matcher) => matcher.re.test(project)).map((matcher) => matcher.glob);
    assert.equal(claimedBy.length, 1, `project "${project}" is claimed by ${claimedBy.length} lane filters (${claimedBy.join(', ') || 'none'})`);
  }

  // A filter that matches nothing is a rename that silently stopped selecting.
  for (const { glob, re } of matchers) {
    assert.ok(projects.some((project) => re.test(project)), `lane filter "${glob}" matches no configured project`);
  }
});

test('Playwright cache-hit paths avoid full dependency provisioning', async () => {
  const { webConsumer, webA11y, visual } = await sources();
  for (const source of [webConsumer, webA11y, visual]) {
    assert.match(source, /Provision Chromium and Linux dependencies on cache miss[\s\S]*cache-hit != 'true'/);
    assert.match(source, /Verify cached Chromium on cache hit[\s\S]*cache-hit == 'true'/);
  }
});

test('public Web workflow uses PR path filtering while environment pushes remain unconditional', async () => {
  const { beeuiWeb } = await sources();
  assert.match(beeuiWeb, /pull_request:\n\s+paths:/);
  assert.match(beeuiWeb, /- 'web\/\*\*'/);
  assert.match(beeuiWeb, /- 'docs\/\*\*'/);
  assert.match(beeuiWeb, /push:\n\s+branches:\n\s+- development\n\s+- staging\n\s+- main/);
});

test('development and staging retain complete repository integration after merge', async () => {
  const { environmentCi } = await sources();
  assert.match(environmentCi, /branches:\n\s+- development\n\s+- staging/);
  assert.match(environmentCi, /pnpm typecheck/);
  assert.match(environmentCi, /pnpm test/);
  assert.match(environmentCi, /Cache pnpm store/);
});

// GitHub's default runner shell is `bash -e {0}`: errexit without pipefail, so
// `xcodebuild ... | tee log` reports the exit status of tee and a failed compile
// passes. Every piped run step must opt into pipefail explicitly.
test('piped native compile steps cannot mask a failure through tee', async () => {
  const { ci, expo } = await sources();
  for (const [name, workflow] of [['ci.yml', ci], ['expo-consumer.yml', expo]]) {
    const lines = workflow.split('\n');
    for (const [index, line] of lines.entries()) {
      if (!line.includes('| tee ')) continue;
      // Walk back to the owning step and require either `shell: bash` on it or
      // `set -euo pipefail` inside a block run:.
      let guarded = false;
      for (let i = index; i >= 0; i -= 1) {
        if (/^\s+- (name|uses|run):/.test(lines[i]) && i !== index) {
          guarded ||= lines.slice(i, index).some((l) => /^\s+shell: bash\s*$/.test(l));
          break;
        }
        if (/set -euo pipefail/.test(lines[i])) { guarded = true; break; }
        if (/^\s+shell: bash\s*$/.test(lines[i])) { guarded = true; break; }
      }
      assert.ok(guarded, `${name}:${index + 1} pipes to tee without pipefail: ${line.trim()}`);
    }
  }
});

// Retargeting a pull request fires `pull_request.edited` and nothing else. The
// classifier decides full CI from base.ref, so a workflow that ignores `edited`
// lets a PR keep the reduced-scope checks it earned against development and
// spend them on main's branch protection.
test('pull request workflows re-validate when the base branch changes', async () => {
  const { ci, visual, webConsumer, webA11y, expo } = await sources();
  for (const [name, workflow] of [
    ['ci.yml', ci],
    ['visual-web.yml', visual],
    ['web-consumer.yml', webConsumer],
    ['web-a11y.yml', webA11y],
    ['expo-consumer.yml', expo],
  ]) {
    const types = /pull_request:[\s\S]*?types: \[([^\]]+)\]/.exec(workflow);
    assert.ok(types, `${name} has no pull_request types list`);
    const listed = types[1].split(',').map((entry) => entry.trim());
    assert.ok(listed.includes('edited'), `${name} ignores pull_request.edited, so a base-branch change never re-validates`);
    assert.ok(listed.includes('synchronize'), `${name} must still re-run on new commits`);
  }
});

// A pull request can only restore caches from its own ref, its base branch and
// the default branch. Every pull request here targets development, so unless
// development itself runs the native workflows the caches are never warm for
// anyone: each pull request started cold and rebuilt ~900 MB only it could
// reuse, which is also what filled the repository cache to 9.6 of 10 GB.
test('native workflows warm the base branch and never let a pull request write the shared cache', async () => {
  const { ci, expo } = await sources();
  for (const [name, workflow] of [['ci.yml', ci], ['expo-consumer.yml', expo]]) {
    const pushBranches = /push:\n\s+branches:([\s\S]*?)\n\s{2}\w/.exec(workflow);
    assert.ok(pushBranches, `${name} has no push branches list`);
    assert.match(pushBranches[1], /- development\b/, `${name} never warms the branch pull requests target`);

    // Gradle writes its cache unless told otherwise, so it needs the same rule.
    assert.match(
      workflow,
      /cache-read-only: \$\{\{ github\.event_name != 'push' \}\}/,
      `${name} lets a pull request write the Gradle cache`,
    );

    // Every explicit cache save must be a base-branch run.
    const lines = workflow.split('\n');
    for (const [index, line] of lines.entries()) {
      if (!/uses: actions\/cache\/save@/.test(line)) continue;
      let start = index;
      while (start > 0 && !/^\s+- name:/.test(lines[start])) start -= 1;
      const step = lines.slice(start, index).join('\n');
      assert.match(
        step,
        /if: github\.event_name == 'push'/,
        `${name}:${index + 1} saves a cache on events other than a base-branch push`,
      );
    }
  }
});

test('consumer scripts still perform real native compiles', async () => {
  const { bareScript, expoScript } = await sources();
  assert.match(bareScript, /\.\/gradlew[\s\S]*assembleDebug/);
  assert.match(bareScript, /xcodebuild[\s\S]*-sdk iphonesimulator/);
  assert.match(expoScript, /\.\/gradlew[\s\S]*assembleDebug/);
  assert.match(expoScript, /xcodebuild[\s\S]*-sdk iphonesimulator/);
});
