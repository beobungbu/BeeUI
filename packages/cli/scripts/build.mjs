#!/usr/bin/env node
// Builds the publishable @beemvp/beeui-cli package.
//
// Registry-data-shipping decision (#209): the registry engine copies BeeUI
// component source into a consumer project by reading files off disk at
// paths recorded in registry/registry.json (e.g.
// "packages/ui/src/components/button.tsx"). Those paths only resolve inside
// this monorepo checkout. A published npm tarball is installed standalone
// into a consumer's node_modules with no monorepo tree available, so the
// packed CLI must carry its own copy of every file the registry can ever
// reference — the registry must be "bundled", not "generated at first run".
//
// This script therefore:
//   1. re-validates the canonical registry against real monorepo source
//      (fails the build if the registry and the package source drift), then
//   2. copies packages/cli/src/*.mjs verbatim into dist/ (plain Node ESM,
//      nothing to transpile), and
//   3. copies the canonical registry/registry.json plus every unique
//      "source" file it references into dist/registry/, mirroring each
//      file's monorepo-relative path under dist/registry/sources/, and
//   4. writes a sha256 checksum manifest (dist/registry/integrity.json)
//      covering registry.json and every bundled source file (#216: registry
//      delivery + integrity strategy). `registry-lib.mjs` verifies these
//      checksums at runtime before trusting bundled data, so a tampered or
//      corrupted installed package fails loudly instead of silently copying
//      mismatched component source into a consumer project.
//
// packages/cli/src/registry-lib.mjs resolves registry data and sources from
// dist/registry/ automatically at runtime once that directory exists next to
// it (see that file's own header comment) — no path rewriting is needed
// inside registry.json itself, because the bundled sources preserve the same
// repo-relative path shape the registry already uses.
import { createHash } from 'node:crypto';
import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from '../src/registry-lib.mjs';

function sha256Hex(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SRC_DIR = path.join(PACKAGE_ROOT, 'src');
const DIST_DIR = path.join(PACKAGE_ROOT, 'dist');
const REGISTRY_SOURCE_PATH = path.join(REPO_ROOT, 'registry', 'registry.json');

async function main() {
  // Fail the build loudly if the registry references a file that does not
  // exist, escapes the repo, or otherwise fails validation, before bundling
  // anything.
  const registry = await loadRegistry({ repoRoot: REPO_ROOT, registryPath: REGISTRY_SOURCE_PATH });

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const entrySourceFiles = ['beeui.mjs', 'registry-lib.mjs', 'semver-lite.mjs', 'detect.mjs', 'dependency-diagnostics.mjs', 'update-lib.mjs'];
  for (const file of entrySourceFiles) {
    await cp(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
  }
  // `bin` executables need the executable bit; `cp` does not reliably
  // preserve it, so set it explicitly rather than depending on the source
  // file's on-disk mode.
  await chmod(path.join(DIST_DIR, 'beeui.mjs'), 0o755);

  const uniqueSources = [...new Set(registry.items.flatMap((item) => item.files.map((file) => file.source)))].sort();
  const sourcesDir = path.join(DIST_DIR, 'registry', 'sources');
  const sourceChecksums = {};
  for (const relativeSource of uniqueSources) {
    const from = path.join(REPO_ROOT, relativeSource);
    const to = path.join(sourcesDir, relativeSource);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to);
    sourceChecksums[relativeSource] = sha256Hex(await readFile(from, 'utf8'));
  }

  const rawRegistry = await readFile(REGISTRY_SOURCE_PATH, 'utf8');
  await mkdir(path.join(DIST_DIR, 'registry'), { recursive: true });
  await writeFile(path.join(DIST_DIR, 'registry', 'registry.json'), rawRegistry, 'utf8');

  const packageManifest = JSON.parse(await readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const integrityManifest = {
    schemaVersion: 1,
    algorithm: 'sha256',
    // Version pairing (#216): the checksum manifest, the registry snapshot,
    // and the bundled sources are all written by this single build step from
    // the same commit, so a given @beemvp/beeui-cli version can never observe a
    // registry/source pairing other than the one it shipped with.
    cliVersion: packageManifest.version,
    registry: sha256Hex(rawRegistry),
    sources: sourceChecksums,
  };
  await writeFile(
    path.join(DIST_DIR, 'registry', 'integrity.json'),
    `${JSON.stringify(integrityManifest, null, 2)}\n`,
    'utf8',
  );

  process.stdout.write(
    `@beemvp/beeui-cli build: bundled registry schema v${registry.schemaVersion}, ${registry.items.length} registry items, ` +
      `${uniqueSources.length} unique source files + sha256 integrity manifest into dist/registry/.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`@beemvp/beeui-cli build failed: ${error.message}\n`);
  process.exitCode = 1;
});
