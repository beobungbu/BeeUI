#!/usr/bin/env node

// Enriches the successful release-verification report with the exact byte size and
// SHA-256 of a canonical release tarball for every public BeeUI package.
//
// `pnpm pack` is still the authority for package selection and manifest rewriting,
// but its gzip/tar envelope is not guaranteed to be byte-identical across repeated
// invocations. The normal Bob package build intentionally runs configured targets
// concurrently; the release path instead serializes those targets so reproducibility
// verification cannot depend on target scheduling. To make the artifact that we
// verify the artifact that we publish, we:
//   1. build from a clean dist/ with deterministic target ordering;
//   2. run pnpm pack with lifecycle scripts disabled so it does not rebuild again;
//   3. extract that npm-compatible package payload;
//   4. repack it with stable ordering, ownership, mtimes, and gzip headers;
//   5. repeat the whole clean build + pack process and require byte-identical
//      canonical tarballs.
//
// Canonical tarballs are written to .artifacts/release-packages/ and are the only
// tarballs the npm release workflow is allowed to publish/stage.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_PATH = path.join(ROOT_DIR, '.artifacts', 'release-verification.json');
const RELEASE_PACKAGE_DIR = path.join(ROOT_DIR, '.artifacts', 'release-packages');

const PACKAGE_DIRS = new Map([
  ['@beemvp/beeui-core', 'packages/core'],
  ['@beemvp/beeui-tokens', 'packages/tokens'],
  ['@beemvp/beeui-ui', 'packages/ui'],
  ['@beemvp/beeui-cli', 'packages/cli'],
]);
const PACKAGE_NAMES = [...PACKAGE_DIRS.keys()];
const BOB_PACKAGE_NAMES = new Set([
  '@beemvp/beeui-core',
  '@beemvp/beeui-tokens',
  '@beemvp/beeui-ui',
]);
const BOB_TARGETS = ['module', 'commonjs', 'typescript'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
        result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result.stdout ?? '';
}

function fail(message) {
  throw new Error(message);
}

function cleanDist(name) {
  const packageDir = PACKAGE_DIRS.get(name);
  if (!packageDir) fail(`No package directory is registered for ${name}.`);
  fs.rmSync(path.join(ROOT_DIR, packageDir, 'dist'), { recursive: true, force: true });
}

function buildForRelease(name) {
  cleanDist(name);

  if (BOB_PACKAGE_NAMES.has(name)) {
    // `bob build` runs configured targets through Promise.all. That is desirable
    // for normal development speed, but release reproducibility needs a fixed
    // build order. Bob's supported --target entry point gives us the same target
    // implementations without concurrent writes into the package dist tree.
    for (const target of BOB_TARGETS) {
      run('pnpm', ['--filter', name, 'exec', 'bob', 'build', '--target', target]);
    }

    if (name === '@beemvp/beeui-ui') {
      // The UI package's normal build performs this deterministic post-build step
      // after Bob finishes: copy hand-written declaration shims and prune Babel's
      // dead .d.js/.d.js.map artifacts. Preserve that exact package contract here.
      run('node', ['packages/ui/scripts/copy-type-shims.mjs']);
    }
    return;
  }

  // The CLI owns a custom deterministic build rather than a Bob configuration.
  run('pnpm', ['--filter', name, 'run', 'build']);
}

function canonicalizeTarball(rawTarballPath, canonicalTarballPath, workDir) {
  const extractDir = path.join(workDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  run('tar', ['-xzf', rawTarballPath, '-C', extractDir]);

  if (!fs.existsSync(path.join(extractDir, 'package', 'package.json'))) {
    fail(`Packed tarball ${path.basename(rawTarballPath)} does not contain package/package.json.`);
  }

  const canonicalTarPath = path.join(workDir, 'canonical.tar');
  run('tar', [
    '--sort=name',
    '--format=gnu',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-cf',
    canonicalTarPath,
    '-C',
    extractDir,
    'package',
  ]);

  const output = fs.openSync(canonicalTarballPath, 'w');
  try {
    const result = spawnSync('gzip', ['-n', '-9', '-c', canonicalTarPath], {
      cwd: ROOT_DIR,
      stdio: ['ignore', output, 'pipe'],
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      fail(`gzip failed while canonicalizing ${path.basename(rawTarballPath)}: ${result.stderr?.trim() ?? ''}`);
    }
  } finally {
    fs.closeSync(output);
  }
}

function packCanonical(name, destination, workDir) {
  buildForRelease(name);
  const rawDir = path.join(workDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  // Every public package has a prepack build. We already performed the release
  // build explicitly above, so disable lifecycle scripts here; otherwise pack
  // would invoke a second normal (parallel Bob) build and reintroduce the race
  // this reproducibility check exists to detect.
  run('pnpm', ['--config.ignore-scripts=true', '--filter', name, 'pack', '--pack-destination', rawDir]);

  const rawTarballs = fs.readdirSync(rawDir).filter((file) => file.endsWith('.tgz'));
  if (rawTarballs.length !== 1) {
    fail(`${name} produced ${rawTarballs.length} raw tarball(s); expected exactly one.`);
  }

  const tarball = rawTarballs[0];
  fs.mkdirSync(destination, { recursive: true });
  const canonicalTarballPath = path.join(destination, tarball);
  canonicalizeTarball(path.join(rawDir, tarball), canonicalTarballPath, workDir);

  const bytes = fs.statSync(canonicalTarballPath).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(canonicalTarballPath)).digest('hex');
  const packedManifest = JSON.parse(run('tar', ['-xOzf', canonicalTarballPath, 'package/package.json']));
  return { tarball, tarballPath: canonicalTarballPath, bytes, sha256, packedManifest };
}

if (!fs.existsSync(REPORT_PATH)) {
  fail(`Release verification report is missing: ${path.relative(ROOT_DIR, REPORT_PATH)}`);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
if (report.status !== 'pass') {
  fail(`Refusing to digest artifacts for a non-passing release report (status=${JSON.stringify(report.status)}).`);
}
if (!report.version) {
  fail('Release verification report has no version.');
}
if (!Array.isArray(report.packages) || report.packages.length !== PACKAGE_NAMES.length) {
  fail(`Release verification report must contain exactly ${PACKAGE_NAMES.length} packages.`);
}

fs.rmSync(RELEASE_PACKAGE_DIR, { recursive: true, force: true });
fs.mkdirSync(RELEASE_PACKAGE_DIR, { recursive: true });

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-digests-'));
try {
  for (const name of PACKAGE_NAMES) {
    const key = name.split('/').pop().replace(/^beeui-/, '');
    const firstDir = path.join(tempRoot, `${key}-first-out`);
    const secondDir = path.join(tempRoot, `${key}-second-out`);
    const firstWork = path.join(tempRoot, `${key}-first-work`);
    const secondWork = path.join(tempRoot, `${key}-second-work`);
    fs.mkdirSync(firstWork, { recursive: true });
    fs.mkdirSync(secondWork, { recursive: true });

    const first = packCanonical(name, firstDir, firstWork);
    const second = packCanonical(name, secondDir, secondWork);

    for (const packed of [first, second]) {
      if (packed.packedManifest.name !== name) {
        fail(`${packed.tarball}: packed package name ${JSON.stringify(packed.packedManifest.name)} does not match ${JSON.stringify(name)}.`);
      }
      if (packed.packedManifest.version !== report.version) {
        fail(`${name}: packed version ${JSON.stringify(packed.packedManifest.version)} does not match report version ${JSON.stringify(report.version)}.`);
      }
    }

    if (first.tarball !== second.tarball) {
      fail(`${name}: clean reproducibility packs produced different tarball names (${first.tarball} vs ${second.tarball}).`);
    }
    if (first.bytes !== second.bytes || first.sha256 !== second.sha256) {
      fail(
        `${name}: canonical reproducibility check failed; identical source produced ` +
          `${first.bytes} bytes / ${first.sha256} then ${second.bytes} bytes / ${second.sha256}.`,
      );
    }

    const entry = report.packages.find((candidate) => candidate.name === name);
    if (!entry) fail(`Release verification report is missing ${name}.`);
    if (entry.tarball !== first.tarball) {
      fail(`${name}: verifier tarball ${JSON.stringify(entry.tarball)} differs from canonical tarball ${JSON.stringify(first.tarball)}.`);
    }

    const finalPath = path.join(RELEASE_PACKAGE_DIR, first.tarball);
    fs.copyFileSync(first.tarballPath, finalPath);
    entry.bytes = first.bytes;
    entry.sha256 = first.sha256;
    entry.reproducible = true;
    entry.artifact = path.relative(ROOT_DIR, finalPath);
  }

  const missing = report.packages.filter(
    (entry) =>
      !Number.isInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '') ||
      entry.reproducible !== true ||
      typeof entry.artifact !== 'string' ||
      !fs.existsSync(path.join(ROOT_DIR, entry.artifact)),
  );
  if (missing.length > 0) {
    fail(`Release verification report has incomplete artifact digests: ${missing.map((entry) => entry.name).join(', ')}.`);
  }

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  for (const entry of report.packages) {
    console.log(
      `${entry.name}@${entry.version}: ${entry.tarball}, ${entry.bytes} bytes, sha256 ${entry.sha256}, canonical + reproducible`,
    );
  }
  console.log(`Canonical release tarballs: ${path.relative(ROOT_DIR, RELEASE_PACKAGE_DIR)}`);
  console.log(`Release artifact digests recorded in ${path.relative(ROOT_DIR, REPORT_PATH)}.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
