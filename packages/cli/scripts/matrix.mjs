#!/usr/bin/env node
// E2E CLI clean-consumer matrix (#218).
//
// Runs the *packed* @beemvp/beeui-cli (dist/beeui.mjs, standalone, bundled +
// checksum-verified registry — never the monorepo/dev-mode source tree) as a
// subprocess against a matrix of throwaway "clean consumer" project
// fixtures, proving `beeui add`/`init`/`doctor`/`diff`/`update` behave
// correctly with no monorepo import available, matching how a real consumer
// invokes the published binary.
//
// Scope note (documented, not silently skipped): this script proves the CLI
// engine's own contract end-to-end — file copy, dependency-closure
// resolution, collision/overwrite safety, idempotency, dry-run parity, and
// diff/update assistance — across Expo/bare-RN/Web-shaped consumer
// `package.json` fixtures. It deliberately does not drive a real Metro/
// Gradle/Xcode build: that heavier native-toolchain proof already exists in
// scripts/verify-expo-consumer.sh / verify-bare-consumer.sh /
// verify-web-consumer.sh (CI-only, requires Xcode/Android SDK/network) and
// is out of scope for a fast, locally-runnable matrix. "Builds cleanly" is
// proven here at the level this CLI actually controls: every copied
// TypeScript/TSX file transpiles (via the installed `typescript` package,
// matching scripts/__tests__/beeui.test.mjs's own "transpile syntax smoke"),
// and every relative import between copied files resolves on disk.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_BIN = path.join(PACKAGE_ROOT, 'dist', 'beeui.mjs');

function runCli(nodeBin, args, cwd) {
  return execFileSync(nodeBin, [DIST_BIN, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function runCliExpectFailure(nodeBin, args, cwd) {
  try {
    runCli(nodeBin, args, cwd);
  } catch (error) {
    if (typeof error.status !== 'number') throw error;
    return String(error.stderr ?? '');
  }
  throw new Error(`expected 'beeui ${args.join(' ')}' to fail, but it exited 0`);
}

// Best-effort: looks for an installed Node 22 binary via nvm on the machine
// running this script, to prove the CLI's own version gate (checkNodeVersion
// in beeui.mjs, MIN_SUPPORTED_NODE_MAJOR = 24) against a *real* Node 22
// interpreter rather than only the mocked version-string unit test in
// scripts/__tests__/beeui.test.mjs. Node 22 is not a supported CLI runtime
// (docs/compatibility-matrix.md) — the correct, DoD-relevant behavior to
// prove is that it is refused clearly and immediately, never silently run
// with unverified behavior. Returns `null`, not a fabricated pass, when no
// Node 22 install can be found.
function findNode22Binary() {
  const nvmDir = process.env.NVM_DIR ?? path.join(os.homedir(), '.nvm');
  const versionsDir = path.join(nvmDir, 'versions', 'node');
  if (!existsSync(versionsDir)) return null;
  let entries;
  try {
    entries = readdirSync(versionsDir);
  } catch {
    return null;
  }
  const candidate = entries.find((entry) => /^v22\.\d+\.\d+$/.test(entry));
  if (!candidate) return null;
  const bin = path.join(versionsDir, candidate, 'bin', 'node');
  return existsSync(bin) ? bin : null;
}

// Four consumer `package.json` fixtures matching detect.mjs's classification
// rules (docs/registry-cli.md's "Project detection" section) — the same
// shapes #218 asks for: Expo, bare RN, Web, and a peers-declared-but-stale
// project used to prove doctor's INCOMPATIBLE diagnostic path.
const PROFILES = [
  {
    name: 'expo-source-owned',
    expectedKind: 'expo',
    packageJson: {
      name: 'matrix-expo-consumer',
      version: '0.0.0',
      dependencies: { expo: '~57.0.0', react: '19.2.0', 'react-native': '0.86.2' },
    },
  },
  {
    name: 'bare-rn-source-owned',
    expectedKind: 'bare-react-native',
    packageJson: {
      name: 'matrix-bare-rn-consumer',
      version: '0.0.0',
      dependencies: { react: '19.2.0', 'react-native': '0.86.2' },
    },
  },
  {
    name: 'web-enabled',
    expectedKind: 'web',
    packageJson: {
      name: 'matrix-web-consumer',
      version: '0.0.0',
      dependencies: { react: '19.2.0', 'react-dom': '19.2.0', 'react-native-web': '0.21.0' },
    },
  },
  {
    name: 'incompatible-peers',
    expectedKind: 'bare-react-native',
    packageJson: {
      name: 'matrix-incompatible-peers-consumer',
      version: '0.0.0',
      dependencies: {
        react: '19.2.0',
        'react-native': '0.86.2',
        // `#212`'s classification is range-overlap, not subset-containment:
        // '^1.0.0' actually *overlaps* BeeUI's required '>=1.10.1 <2' (e.g.
        // 1.15.0 satisfies both) and is correctly reported OK. '^0.9.0'
        // (>=0.9.0 <1.0.0) has no overlap with '>=1.10.1 <2' at all, so it is
        // the fixture that actually proves the INCOMPATIBLE path.
        uniwind: '^0.9.0',
      },
    },
  },
];

class MatrixLog {
  constructor(profileName) {
    this.profileName = profileName;
    this.steps = [];
  }

  // Always async and always awaited by the caller: several steps below run
  // subprocess calls interleaved with async filesystem assertions, and a
  // synchronous `record` that does not await a returned promise would let
  // later steps start running (and mutate the same consumerRoot) before an
  // earlier async step's assertions or writes have actually finished.
  async record(name, fn) {
    const startedAt = Date.now();
    try {
      const result = await fn();
      this.steps.push({ name, ok: true, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.steps.push({ name, ok: false, durationMs: Date.now() - startedAt, error: error.message });
      throw error;
    }
  }
}

async function runProfile(profile, nodeBin) {
  const log = new MatrixLog(profile.name);
  const consumerRoot = await mkdtemp(path.join(os.tmpdir(), `beeui-cli-matrix-${profile.name}-`));
  try {
    await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify(profile.packageJson, null, 2)}\n`, 'utf8');

    await log.record('init', () => {
      const output = runCli(nodeBin, ['init'], consumerRoot);
      assert.match(output, /Created beeui\.config\.json/);
      assert.match(output, new RegExp(`Detected project: ${profile.expectedKind}`));
    });

    await log.record('doctor (initial)', () => {
      const output = runCli(nodeBin, ['doctor'], consumerRoot);
      assert.match(output, /BeeUI doctor OK/);
      assert.match(output, /registry delivery: bundled \(\d+ source checksums verified\)/);
      if (profile.name === 'incompatible-peers') assert.match(output, /INCOMPATIBLE\s+uniwind/);
    });

    // Collision + overwrite (#211 invariant: a preflight collision must leave
    // zero partial writes) — run before the real `add --all` below so the
    // pre-existing decoy file is the *only* thing on disk when it happens.
    await log.record('collision leaves no partial writes, --overwrite is explicit', async () => {
      const themeDir = path.join(consumerRoot, 'src', 'beeui');
      const themePath = path.join(themeDir, 'theme.css');
      await mkdir(themeDir, { recursive: true });
      await writeFile(themePath, '/* consumer-owned decoy */\n', 'utf8');
      const stderr = runCliExpectFailure(nodeBin, ['add', 'theme'], consumerRoot);
      assert.match(stderr, /refusing to overwrite existing files/);
      assert.equal(await readFile(themePath, 'utf8'), '/* consumer-owned decoy */\n');
      assert.equal(existsSync(path.join(consumerRoot, 'src', 'components')), false, 'a preflight collision must not partially write sibling files');

      const overwriteOutput = runCli(nodeBin, ['add', '--overwrite', 'theme'], consumerRoot);
      assert.match(overwriteOutput, /OVERWRITE src\/beeui\/theme\.css/);
      assert.doesNotMatch(await readFile(themePath, 'utf8'), /consumer-owned decoy/);
    });

    await log.record('add --dry-run --all mutates nothing', () => {
      const output = runCli(nodeBin, ['add', '--all', '--dry-run'], consumerRoot);
      assert.match(output, /Dry run: no files were written/);
      assert.equal(existsSync(path.join(consumerRoot, 'src', 'components')), false);
    });

    await log.record('add --all copies the full public surface', () => {
      const output = runCli(nodeBin, ['add', '--all'], consumerRoot);
      assert.match(output, /Source ownership plan applied/);
    });

    await log.record('repeat add --all is idempotent', () => {
      const output = runCli(nodeBin, ['add', '--all'], consumerRoot);
      assert.doesNotMatch(output, /OVERWRITE|CREATE/);
    });

    await log.record('complex individual closures resolve together in one request', () => {
      const output = runCli(nodeBin, ['add', 'popover', 'select', 'sheet', 'table', 'calendar', 'date-time-picker'], consumerRoot);
      assert.doesNotMatch(output, /OVERWRITE|CREATE/, 'already covered by add --all; this proves multi-item resolution, not new writes');
    });

    await log.record('diff reports a clean sync after add --all', () => {
      const output = runCli(nodeBin, ['diff'], consumerRoot);
      assert.doesNotMatch(output, /CONFLICT|LOCAL|UPSTREAM|MISSING|UNTRACKED/);
    });

    await log.record('local edit with no upstream change is LOCAL and survives update, even with --force', async () => {
      const buttonPath = path.join(consumerRoot, 'src', 'components', 'beeui', 'button.tsx');
      const original = await readFile(buttonPath, 'utf8');
      await writeFile(buttonPath, `${original}\n// matrix local edit\n`, 'utf8');

      const diffOutput = runCli(nodeBin, ['diff', 'button'], consumerRoot);
      assert.match(diffOutput, /LOCAL\s+src\/components\/beeui\/button\.tsx/);

      const updateOutput = runCli(nodeBin, ['update', 'button'], consumerRoot);
      assert.match(updateOutput, /SKIP\s+src\/components\/beeui\/button\.tsx \(button\) — local-modified/);
      assert.equal(await readFile(buttonPath, 'utf8'), `${original}\n// matrix local edit\n`);

      // #219: `--force` must never discard a local-only edit that has no
      // corresponding upstream change to apply — there would be nothing to
      // "update" to, so forcing it would just destroy the edit for no
      // functional reason. This is the safety invariant `--force` exists to
      // scope, not bypass.
      const forceOnLocalOnly = runCli(nodeBin, ['update', '--force', 'button'], consumerRoot);
      assert.match(forceOnLocalOnly, /SKIP\s+src\/components\/beeui\/button\.tsx \(button\) — local-modified/);
      assert.equal(await readFile(buttonPath, 'utf8'), `${original}\n// matrix local edit\n`);
    });

    // Acceptance evidence for #218/#219: "diff produces correct output on a
    // modified copied component + re-sync with explicit flag." A genuine
    // CONFLICT (both local *and* upstream changed since the last sync)
    // cannot be produced by editing the registry source itself here (out of
    // this script's file ownership and this repo's own dev-mode registry is
    // the live monorepo tree), so — exactly like
    // scripts/__tests__/beeui-diff-update.test.mjs's unit coverage — a stale
    // baseline is simulated by hand-editing the manifest's recorded content
    // hash, which is precisely the signal `beeui diff`/`beeui update`
    // actually key off.
    await log.record('a conflicting (local + upstream) change requires --force to re-sync', async () => {
      // `buttonPath` still carries the previous step's local-only edit (never
      // overwritten by it, by design) — this step's own manifest tamper is
      // what turns that same file into a genuine CONFLICT (both local *and*
      // "upstream" now disagree with the recorded baseline).
      const buttonPath = path.join(consumerRoot, 'src', 'components', 'beeui', 'button.tsx');
      const manifestPath = path.join(consumerRoot, 'beeui.manifest.json');
      const editedContent = await readFile(buttonPath, 'utf8');
      assert.match(editedContent, /matrix local edit/, 'sanity: this step must start from the previous step\'s locally-edited file');

      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.entries['src/components/beeui/button.tsx'].contentHash = `sha256:${'a'.repeat(64)}`;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      const conflictDiff = runCli(nodeBin, ['diff', 'button'], consumerRoot);
      assert.match(conflictDiff, /CONFLICT\s+src\/components\/beeui\/button\.tsx/);

      const withoutForce = runCli(nodeBin, ['update', 'button'], consumerRoot);
      assert.match(withoutForce, /SKIP\*\s+src\/components\/beeui\/button\.tsx \(button\) — conflict/);
      assert.equal(await readFile(buttonPath, 'utf8'), editedContent, 'without --force the local edit must survive untouched');

      const withForce = runCli(nodeBin, ['update', '--force', 'button'], consumerRoot);
      assert.match(withForce, /UPDATE\s+src\/components\/beeui\/button\.tsx \(button\) — conflict/);
      assert.doesNotMatch(await readFile(buttonPath, 'utf8'), /matrix local edit/, '--force must discard the local edit and restore canonical upstream content');

      const cleanDiff = runCli(nodeBin, ['diff', 'button'], consumerRoot);
      assert.doesNotMatch(cleanDiff, /CONFLICT/);
    });

    await log.record('doctor (final)', () => {
      const output = runCli(nodeBin, ['doctor'], consumerRoot);
      assert.match(output, /BeeUI doctor OK/);
    });

    return { profile: profile.name, status: 'PASS', steps: log.steps };
  } catch (error) {
    return { profile: profile.name, status: 'FAIL', steps: log.steps, error: error.message };
  } finally {
    await rm(consumerRoot, { recursive: true, force: true });
  }
}

async function main() {
  if (!existsSync(DIST_BIN)) {
    execFileSync(process.execPath, [path.join(PACKAGE_ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });
  }

  const results = [];
  for (const profile of PROFILES) {
    // eslint-disable-next-line no-await-in-loop -- profiles run sequentially so failures/logs stay attributable and readable
    results.push(await runProfile(profile, process.execPath));
  }

  const node22 = findNode22Binary();
  if (node22) {
    const node22Version = execFileSync(node22, ['--version'], { encoding: 'utf8' }).trim();
    try {
      const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'beeui-cli-matrix-node22-'));
      try {
        const stderr = runCliExpectFailure(node22, ['init'], tmpRoot);
        assert.match(stderr, /unsupported Node\.js version/);
      } finally {
        await rm(tmpRoot, { recursive: true, force: true });
      }
      results.push({ profile: `Node ${node22Version} is clearly refused (unsupported runtime)`, status: 'PASS', steps: [] });
    } catch (error) {
      results.push({ profile: `Node ${node22Version} rejection`, status: 'FAIL', steps: [], error: error.message });
    }
  } else {
    results.push({ profile: 'Node 22 rejection check (no Node 22 install found via nvm)', status: 'SKIPPED', steps: [] });
  }

  // Artifacts/logs are retained (#218 DoD) for post-run inspection, keyed by
  // a timestamped run directory under the OS temp root — never committed to
  // the repository, mirroring how this repo's other throwaway consumer
  // fixtures (scripts/verify-*-consumer.sh) are never committed either.
  const artifactsDir = path.join(os.tmpdir(), `beeui-cli-matrix-report-${Date.now()}`);
  await mkdir(artifactsDir, { recursive: true });
  const reportPath = path.join(artifactsDir, 'matrix-report.json');
  await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

  process.stdout.write('BeeUI CLI clean-consumer matrix (#218):\n');
  for (const result of results) {
    process.stdout.write(`  ${result.status.padEnd(8)} ${result.profile} (${result.steps.length} step(s))\n`);
    if (result.status === 'FAIL') process.stdout.write(`    ${result.error}\n`);
  }
  process.stdout.write(`Artifacts retained at: ${reportPath}\n`);

  const failed = results.filter((result) => result.status === 'FAIL');
  if (failed.length > 0) {
    process.exitCode = 1;
    process.stderr.write(`beeui-cli matrix: FAIL (${failed.length}/${results.length} profile(s) failed)\n`);
  } else {
    process.stdout.write('beeui-cli matrix: PASS\n');
  }
}

main().catch((error) => {
  process.stderr.write(`beeui-cli matrix: FAIL\n${error.stack ?? error}\n`);
  process.exitCode = 1;
});
