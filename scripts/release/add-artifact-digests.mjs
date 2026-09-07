#!/usr/bin/env node

// Enriches the successful release-verification report with the exact byte size and
// SHA-256 of a fresh `pnpm pack` tarball for every public BeeUI package. The verifier
// already proves the package contents/exports/clean-consumer contract; this step makes
// the candidate evidence self-contained enough to freeze and later compare with npm.
//
// A release tarball must also be reproducible from a clean build. `prepack` rebuilds
// `dist/`, but build tools are not required to remove stale outputs first. Packing over
// an existing dist tree can therefore make artifact identity depend on job history even
// when source is unchanged. Each proof below starts with no dist/ and is repeated once;
// a byte/hash mismatch aborts the release instead of silently freezing one random pack.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_PATH = path.join(ROOT_DIR, '.artifacts', 'release-verification.json');

const PACKAGE_DIRS = new Map([
  ['@beemvp/beeui-core', 'packages/core'],
  ['@beemvp/beeui-tokens', 'packages/tokens'],
  ['@beemvp/beeui-ui', 'packages/ui'],
  ['@beemvp/beeui-cli', 'packages/cli'],
]);
const PACKAGE_NAMES = [...PACKAGE_DIRS.keys()];

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

function packClean(name, destination) {
  cleanDist(name);
  const before = new Set(fs.readdirSync(destination));
  run('pnpm', ['--filter', name, 'pack', '--pack-destination', destination]);
  const created = fs
    .readdirSync(destination)
    .filter((file) => file.endsWith('.tgz') && !before.has(file));

  if (created.length !== 1) {
    fail(`${name} produced ${created.length} tarball(s); expected exactly one.`);
  }

  const tarball = created[0];
  const tarballPath = path.join(destination, tarball);
  const bytes = fs.statSync(tarballPath).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
  const packedManifest = JSON.parse(run('tar', ['-xOzf', tarballPath, 'package/package.json']));
  return { tarball, tarballPath, bytes, sha256, packedManifest };
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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-digests-'));
try {
  for (const name of PACKAGE_NAMES) {
    const firstDir = path.join(tempRoot, `${name.split('/').pop()}-first`);
    const secondDir = path.join(tempRoot, `${name.split('/').pop()}-second`);
    fs.mkdirSync(firstDir, { recursive: true });
    fs.mkdirSync(secondDir, { recursive: true });

    const first = packClean(name, firstDir);
    const second = packClean(name, secondDir);

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
        `${name}: clean reproducibility check failed; identical source produced ` +
          `${first.bytes} bytes / ${first.sha256} then ${second.bytes} bytes / ${second.sha256}.`,
      );
    }

    const entry = report.packages.find((candidate) => candidate.name === name);
    if (!entry) fail(`Release verification report is missing ${name}.`);
    if (entry.tarball !== first.tarball) {
      fail(`${name}: verifier tarball ${JSON.stringify(entry.tarball)} differs from digest tarball ${JSON.stringify(first.tarball)}.`);
    }

    entry.bytes = first.bytes;
    entry.sha256 = first.sha256;
    entry.reproducible = true;
  }

  const missing = report.packages.filter(
    (entry) =>
      !Number.isInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '') ||
      entry.reproducible !== true,
  );
  if (missing.length > 0) {
    fail(`Release verification report has incomplete artifact digests: ${missing.map((entry) => entry.name).join(', ')}.`);
  }

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  for (const entry of report.packages) {
    console.log(
      `${entry.name}@${entry.version}: ${entry.tarball}, ${entry.bytes} bytes, sha256 ${entry.sha256}, reproducible`,
    );
  }
  console.log(`Release artifact digests recorded in ${path.relative(ROOT_DIR, REPORT_PATH)}.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
