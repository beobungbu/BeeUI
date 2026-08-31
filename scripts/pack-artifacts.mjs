#!/usr/bin/env node
// #203 (R7.7, parent #114): produce the exact package tarballs a BeeUI 1.0
// prerelease would publish, retained only as local/CI build artifacts — no
// npm registry mutation, no dist-tag mutation, no public CLI publication.
// This is deliberately a *sibling* of `scripts/verify-release.mjs`, not a
// replacement: release:verify proves the packed contract is correct (#202);
// this script is the "what we would ship" evidence (#203), so it always
// rebuilds and re-packs fresh rather than reusing verify's ephemeral temp
// packs, and it writes into a durable, gitignored location instead of a
// temp dir that gets deleted on exit.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const ARTIFACT_DIR = path.join(ROOT_DIR, '.artifacts', 'pack');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');

// Lockstep order matches scripts/verify-release.mjs's packageSpecs (D6,
// docs/decisions/011-distribution-architecture.md): @beeui/ui depends on the
// other two, but pack order does not matter for `npm pack` itself, only for
// readable manifest output.
const PACKAGE_NAMES = ['@beeui/core', '@beeui/tokens', '@beeui/ui'];

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

// A candidate version is deterministic per exact commit SHA (ADR-011 D7:
// "reproducible publication-ready artifacts from an exact SHA") without ever
// writing that version into a package.json — it exists only in this
// artifact's own metadata, per #203's requirement.
function resolveCandidateSha() {
  const override = process.env.BEEUI_RELEASE_CANDIDATE_SHA;
  if (override) return override.trim();
  return run('git', ['rev-parse', 'HEAD']).trim();
}

// #203's "changelog/migration/version inputs validated": a prerelease
// candidate must have recorded, reviewable changes waiting to ship — an
// empty "## Unreleased" section means there is nothing new to certify as a
// candidate. Mirrors the release-candidate checklist in docs/release.md
// ("CHANGELOG.md contains candidate changes").
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

  return body;
}

try {
  const rootPackage = readJson(path.join(ROOT_DIR, 'package.json'));
  const rootVersion = rootPackage.version;

  if (typeof rootVersion !== 'string' || !/^0\.\d+\.\d+$/.test(rootVersion)) {
    throw new Error(`Workspace root must stay on a pre-1.0 lockstep version; found "${rootVersion}".`);
  }
  if (rootPackage.private !== true) {
    throw new Error('Workspace root must remain private: true; this script must never run against a publish-ready root.');
  }

  validateChangelogHasCandidateChanges();

  const candidateSha = resolveCandidateSha();
  const candidateVersion = `${rootVersion}-rc-ready.${candidateSha.slice(0, 12)}`;

  // Deterministic from source: always rebuild before packing, rather than
  // trusting whatever dist/ happens to be on disk (mirrors
  // scripts/verify-release.mjs's own reasoning for the same `pnpm pack`'s
  // `prepack` also rebuilds, but doing it explicitly here keeps this
  // script's own log output honest about what it packed).
  run('pnpm', ['--filter', './packages/*', 'run', 'build']);

  fs.rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const packages = [];
  for (const name of PACKAGE_NAMES) {
    const before = new Set(fs.readdirSync(ARTIFACT_DIR).filter((file) => file.endsWith('.tgz')));
    run('pnpm', ['--filter', name, 'pack', '--pack-destination', ARTIFACT_DIR]);
    const created = fs.readdirSync(ARTIFACT_DIR).filter((file) => file.endsWith('.tgz') && !before.has(file));

    if (created.length !== 1) {
      throw new Error(`${name} produced ${created.length} tarball(s) in ${ARTIFACT_DIR}, expected exactly one.`);
    }

    const tarballName = created[0];
    const tarballPath = path.join(ARTIFACT_DIR, tarballName);
    const packedManifest = JSON.parse(run('tar', ['-xOzf', tarballPath, 'package/package.json']));

    if (packedManifest.name !== name) {
      throw new Error(`${tarballName} packed manifest name "${packedManifest.name}" does not match "${name}".`);
    }
    if (JSON.stringify(packedManifest).includes('workspace:')) {
      throw new Error(`${tarballName} packed manifest still contains an unresolved workspace: protocol reference.`);
    }

    packages.push({
      name,
      version: packedManifest.version,
      tarball: tarballName,
      sha256: sha256File(tarballPath),
      bytes: fs.statSync(tarballPath).size,
    });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: candidateSha,
    candidateVersion,
    lockstepVersion: rootVersion,
    // Explicit, machine-checkable statement of what this run did NOT do —
    // the owner guard from ADR-011: no publish, no dist-tag mutation, no
    // npm account action.
    publish: { executed: false, registry: null, distTag: null },
    packages,
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `Packed ${packages.length} prerelease-equivalent artifact(s) as candidate ${candidateVersion} (commit ${candidateSha}). No package was published: no npm registry mutation, no dist-tag change, no version bump.`,
  );
  console.log(`Manifest: ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
  for (const pkg of packages) {
    console.log(`  ${pkg.name}@${pkg.version} -> ${pkg.tarball} (sha256 ${pkg.sha256.slice(0, 12)}…, ${pkg.bytes} bytes)`);
  }
} catch (error) {
  console.error(`pack-artifacts failed:\n${error.stack ?? error}`);
  process.exitCode = 1;
}
