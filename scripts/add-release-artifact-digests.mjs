#!/usr/bin/env node

// Enriches the successful release-verification report with the exact byte size and
// SHA-256 of a fresh `pnpm pack` tarball for every public BeeUI package. The verifier
// already proves the package contents/exports/clean-consumer contract; this step makes
// the candidate evidence self-contained enough to freeze and later compare with npm.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(ROOT_DIR, '.artifacts', 'release-verification.json');

const PACKAGE_NAMES = [
  '@beemvp/beeui-core',
  '@beemvp/beeui-tokens',
  '@beemvp/beeui-ui',
  '@beemvp/beeui-cli',
];

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
    const before = new Set(fs.readdirSync(tempRoot));
    run('pnpm', ['--filter', name, 'pack', '--pack-destination', tempRoot]);
    const created = fs
      .readdirSync(tempRoot)
      .filter((file) => file.endsWith('.tgz') && !before.has(file));

    if (created.length !== 1) {
      fail(`${name} produced ${created.length} tarball(s); expected exactly one.`);
    }

    const tarball = created[0];
    const tarballPath = path.join(tempRoot, tarball);
    const packedManifest = JSON.parse(run('tar', ['-xOzf', tarballPath, 'package/package.json']));

    if (packedManifest.name !== name) {
      fail(`${tarball}: packed package name ${JSON.stringify(packedManifest.name)} does not match ${JSON.stringify(name)}.`);
    }
    if (packedManifest.version !== report.version) {
      fail(`${name}: packed version ${JSON.stringify(packedManifest.version)} does not match report version ${JSON.stringify(report.version)}.`);
    }

    const entry = report.packages.find((candidate) => candidate.name === name);
    if (!entry) fail(`Release verification report is missing ${name}.`);
    if (entry.tarball !== tarball) {
      fail(`${name}: verifier tarball ${JSON.stringify(entry.tarball)} differs from digest tarball ${JSON.stringify(tarball)}.`);
    }

    entry.bytes = fs.statSync(tarballPath).size;
    entry.sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
  }

  const missing = report.packages.filter(
    (entry) => !Number.isInteger(entry.bytes) || entry.bytes <= 0 || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? ''),
  );
  if (missing.length > 0) {
    fail(`Release verification report has incomplete artifact digests: ${missing.map((entry) => entry.name).join(', ')}.`);
  }

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  for (const entry of report.packages) {
    console.log(`${entry.name}@${entry.version}: ${entry.tarball}, ${entry.bytes} bytes, sha256 ${entry.sha256}`);
  }
  console.log(`Release artifact digests recorded in ${path.relative(ROOT_DIR, REPORT_PATH)}.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
