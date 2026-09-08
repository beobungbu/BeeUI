#!/usr/bin/env node
// #203 (R7.7, parent #114): retain durable "what we would ship" evidence
// without creating a second release artifact authority.
//
// `pnpm release:verify` is the only build/pack path. It writes byte-stable,
// digest-verified tarballs to `.artifacts/release-packages/`. This script only
// validates and copies those exact bytes into `.artifacts/pack/` for CI retention.
// It must never rebuild or invoke pnpm/npm pack on its own.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_VERSION } from './check-release-control-plane.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const ARTIFACT_DIR = path.join(ROOT_DIR, '.artifacts', 'pack');
const CANONICAL_DIR = path.join(ROOT_DIR, '.artifacts', 'release-packages');
const RELEASE_REPORT_PATH = path.join(ROOT_DIR, '.artifacts', 'release-verification.json');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');

const PACKAGE_NAMES = ['@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-ui', '@beemvp/beeui-cli'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    const stdout = result.stdout?.trim();
    const stderr = result.stderr?.trim();
    throw new Error(
      [`Command failed: ${command} ${args.join(' ')}`, stdout ? `stdout:\n${stdout}` : '', stderr ? `stderr:\n${stderr}` : '']
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result.stdout ?? '';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveCandidateSha() {
  const override = process.env.BEEUI_RELEASE_CANDIDATE_SHA;
  if (override) return override.trim();
  return run('git', ['rev-parse', 'HEAD']).trim();
}

function validateChangelogHasCandidateChanges() {
  const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    throw new Error('CHANGELOG.md is missing; a release candidate requires recorded candidate changes.');
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const match = changelog.match(/^## Unreleased\s*\n([\s\S]*?)(?=\n## |\n?$)/m);
  if (!match) {
    throw new Error('CHANGELOG.md has no "## Unreleased" section.');
  }

  const body = match[1].trim();
  if (body.length === 0) {
    throw new Error('CHANGELOG.md "## Unreleased" section is empty; a release candidate requires recorded candidate changes.');
  }
}

function requireCanonicalReport(candidateSha, rootVersion) {
  if (!fs.existsSync(RELEASE_REPORT_PATH)) {
    throw new Error(
      `Canonical release report is missing: ${path.relative(ROOT_DIR, RELEASE_REPORT_PATH)}. Run \`pnpm release:verify\` first.`,
    );
  }

  const report = readJson(RELEASE_REPORT_PATH);
  if (report.status !== 'pass') {
    throw new Error(`Canonical release report must be passing; found status ${JSON.stringify(report.status)}.`);
  }
  if (report.version !== rootVersion) {
    throw new Error(
      `Canonical release report version ${JSON.stringify(report.version)} does not match workspace version ${JSON.stringify(rootVersion)}.`,
    );
  }
  if (report.commit && report.commit !== candidateSha) {
    throw new Error(
      `Canonical release report was produced for commit ${report.commit}, not candidate ${candidateSha}.`,
    );
  }
  if (!Array.isArray(report.packages) || report.packages.length !== PACKAGE_NAMES.length) {
    throw new Error(`Canonical release report must contain exactly ${PACKAGE_NAMES.length} packages.`);
  }
  return report;
}

try {
  const rootPackage = readJson(path.join(ROOT_DIR, 'package.json'));
  const rootVersion = rootPackage.version;

  if (rootVersion !== EXPECTED_VERSION) {
    throw new Error(
      `Workspace root must match release-control-plane lockstep version "${EXPECTED_VERSION}"; found "${rootVersion}".`,
    );
  }
  if (rootPackage.private !== true) {
    throw new Error('Workspace root must remain private: true; this script must never run against a publish-ready root.');
  }

  validateChangelogHasCandidateChanges();
  const candidateSha = resolveCandidateSha();
  const report = requireCanonicalReport(candidateSha, rootVersion);

  fs.rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const packages = [];
  for (const name of PACKAGE_NAMES) {
    const entry = report.packages.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`Canonical release report is missing ${name}.`);
    if (entry.version !== rootVersion) {
      throw new Error(`${name} canonical report version ${JSON.stringify(entry.version)} does not match ${rootVersion}.`);
    }
    if (entry.reproducible !== true || entry.canonicalManifest !== true) {
      throw new Error(`${name} is not marked canonical + reproducible by release:verify.`);
    }
    if (!/^[0-9a-f]{64}$/.test(entry.sha256 ?? '') || !Number.isInteger(entry.bytes) || entry.bytes <= 0) {
      throw new Error(`${name} has incomplete canonical digest metadata.`);
    }
    if (typeof entry.artifact !== 'string') {
      throw new Error(`${name} has no canonical artifact path in the release report.`);
    }

    const sourcePath = path.resolve(ROOT_DIR, entry.artifact);
    if (path.dirname(sourcePath) !== path.resolve(CANONICAL_DIR)) {
      throw new Error(
        `${name} artifact must come directly from ${path.relative(ROOT_DIR, CANONICAL_DIR)}; got ${entry.artifact}.`,
      );
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`${name} canonical artifact is missing: ${entry.artifact}.`);
    }
    if (path.basename(sourcePath) !== entry.tarball) {
      throw new Error(`${name} artifact path does not match reported tarball ${entry.tarball}.`);
    }

    const sourceBytes = fs.statSync(sourcePath).size;
    const sourceSha256 = sha256File(sourcePath);
    if (sourceBytes !== entry.bytes || sourceSha256 !== entry.sha256) {
      throw new Error(
        `${name} canonical artifact digest drifted after release verification: ` +
          `report=${entry.bytes}/${entry.sha256}, disk=${sourceBytes}/${sourceSha256}.`,
      );
    }

    const packedManifest = JSON.parse(run('tar', ['-xOzf', sourcePath, 'package/package.json']));
    if (packedManifest.name !== name) {
      throw new Error(`${entry.tarball} packed manifest name "${packedManifest.name}" does not match "${name}".`);
    }
    if (packedManifest.version !== rootVersion) {
      throw new Error(`${entry.tarball} packed manifest version "${packedManifest.version}" does not match "${rootVersion}".`);
    }
    if (JSON.stringify(packedManifest).includes('workspace:')) {
      throw new Error(`${entry.tarball} packed manifest still contains an unresolved workspace: protocol reference.`);
    }

    const destination = path.join(ARTIFACT_DIR, entry.tarball);
    fs.copyFileSync(sourcePath, destination);
    if (fs.statSync(destination).size !== sourceBytes || sha256File(destination) !== sourceSha256) {
      throw new Error(`${name} durable evidence copy is not byte-identical to the canonical release artifact.`);
    }

    packages.push({
      name,
      version: packedManifest.version,
      tarball: entry.tarball,
      sha256: sourceSha256,
      bytes: sourceBytes,
    });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: candidateSha,
    candidateVersion: rootVersion,
    lockstepVersion: rootVersion,
    publish: { executed: false, registry: null, distTag: null },
    packages,
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `Retained ${packages.length} byte-identical canonical release artifact(s) for ${rootVersion} ` +
      `(commit ${candidateSha}). No package was rebuilt, repacked or published.`,
  );
  console.log(`Manifest: ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
  for (const pkg of packages) {
    console.log(`  ${pkg.name}@${pkg.version} -> ${pkg.tarball} (sha256 ${pkg.sha256.slice(0, 12)}…, ${pkg.bytes} bytes)`);
  }
} catch (error) {
  console.error(`pack-artifacts failed:\n${error.stack ?? error}`);
  process.exitCode = 1;
}
