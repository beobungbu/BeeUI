#!/usr/bin/env node

// Enriches the successful release-verification report with the exact byte size and
// SHA-256 of a canonical release tarball for every public BeeUI package.
//
// `pnpm pack` remains the authority for package selection and publish-manifest
// rewriting. BeeUI owns the deterministic publication envelope after that point:
//   1. build from a clean dist/ with deterministic target ordering;
//   2. run pnpm pack with lifecycle scripts disabled so it does not rebuild again;
//   3. extract the npm-compatible payload;
//   4. canonicalize only semantically unordered package.json ordering;
//   5. repack with stable ordering, ownership, mtimes, and gzip headers;
//   6. repeat the whole clean build + pack process and require byte-identical
//      canonical tarballs.
//
// Conditional `exports`/`imports` ordering is deliberately not normalized. If that
// ever drifts, the reproducibility check must fail because condition order can affect
// package resolution semantics.
//
// Canonical tarballs are written to .artifacts/release-packages/ and are the only
// tarballs the npm release workflow is allowed to publish/stage.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizePublishManifestFile } from './canonicalize-publish-manifest.mjs';

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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function describeTree(rootDir) {
  const entries = new Map();

  function visit(absolute, relative) {
    const stat = fs.lstatSync(absolute);
    const mode = `0${(stat.mode & 0o7777).toString(8)}`;
    let entry;

    if (stat.isDirectory()) {
      entry = { type: 'dir', mode, size: stat.size };
    } else if (stat.isSymbolicLink()) {
      entry = { type: 'symlink', mode, size: stat.size, target: fs.readlinkSync(absolute) };
    } else if (stat.isFile()) {
      entry = { type: 'file', mode, size: stat.size, sha256: sha256File(absolute) };
    } else {
      entry = { type: 'other', mode, size: stat.size };
    }

    entries.set(relative || '.', entry);
    if (!stat.isDirectory()) return;

    for (const child of fs.readdirSync(absolute).sort()) {
      visit(path.join(absolute, child), relative ? `${relative}/${child}` : child);
    }
  }

  visit(rootDir, '');
  return entries;
}

function formatTreeEntry(entry) {
  if (!entry) return '<missing>';
  const fields = [`type=${entry.type}`, `mode=${entry.mode}`, `size=${entry.size}`];
  if (entry.sha256) fields.push(`sha256=${entry.sha256}`);
  if (entry.target) fields.push(`target=${JSON.stringify(entry.target)}`);
  return fields.join(',');
}

function comparePayloadTrees(firstRoot, secondRoot) {
  const first = describeTree(firstRoot);
  const second = describeTree(secondRoot);
  const paths = [...new Set([...first.keys(), ...second.keys()])].sort();
  const differences = [];

  for (const relative of paths) {
    const a = first.get(relative);
    const b = second.get(relative);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    differences.push(`${relative}: first(${formatTreeEntry(a)}) second(${formatTreeEntry(b)})`);
  }

  return differences;
}

function compareTextFiles(firstPath, secondPath, limit = 24) {
  const first = fs.readFileSync(firstPath, 'utf8').split('\n');
  const second = fs.readFileSync(secondPath, 'utf8').split('\n');
  const differences = [];
  const length = Math.max(first.length, second.length);

  for (let index = 0; index < length; index += 1) {
    if (first[index] === second[index]) continue;
    differences.push(
      `line ${index + 1}: first=${JSON.stringify(first[index] ?? '<missing>')} second=${JSON.stringify(second[index] ?? '<missing>')}`,
    );
    if (differences.length >= limit) break;
  }

  return differences;
}

function manifestStructureDiagnostics(firstPath, secondPath) {
  const first = JSON.parse(fs.readFileSync(firstPath, 'utf8'));
  const second = JSON.parse(fs.readFileSync(secondPath, 'utf8'));
  const sections = ['dependencies', 'peerDependencies', 'peerDependenciesMeta', 'optionalDependencies', 'devDependencies'];
  const output = [
    `top-level keys first=${JSON.stringify(Object.keys(first))}`,
    `top-level keys second=${JSON.stringify(Object.keys(second))}`,
  ];

  for (const section of sections) {
    if (!(section in first) && !(section in second)) continue;
    output.push(`${section} first=${JSON.stringify(first[section])}`);
    output.push(`${section} second=${JSON.stringify(second[section])}`);
  }

  return output;
}

function cleanDist(name) {
  const packageDir = PACKAGE_DIRS.get(name);
  if (!packageDir) fail(`No package directory is registered for ${name}.`);
  fs.rmSync(path.join(ROOT_DIR, packageDir, 'dist'), { recursive: true, force: true });
}

function buildForRelease(name) {
  cleanDist(name);

  if (BOB_PACKAGE_NAMES.has(name)) {
    // `bob build` runs configured targets through Promise.all. Normal development
    // can keep that fast path; release artifact construction uses Bob's supported
    // single-target entry point to avoid concurrent writes into dist/.
    for (const target of BOB_TARGETS) {
      run('pnpm', ['--filter', name, 'exec', 'bob', 'build', '--target', target]);
    }

    if (name === '@beemvp/beeui-ui') {
      // Preserve the UI package's deterministic post-build contract: copy the
      // hand-written declaration shims and remove Babel's dead .d.js artifacts.
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

  const packedManifestPath = path.join(extractDir, 'package', 'package.json');
  if (!fs.existsSync(packedManifestPath)) {
    fail(`Packed tarball ${path.basename(rawTarballPath)} does not contain package/package.json.`);
  }

  // pnpm has already performed all publish-manifest rewriting (including
  // workspace protocol resolution). From here on BeeUI only removes serialization
  // order noise that package.json semantics explicitly do not depend on.
  canonicalizePublishManifestFile(packedManifestPath);

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

  // Every public package has a prepack build. The release build was completed
  // explicitly above, so lifecycle scripts are disabled for this pack invocation.
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
  const sha256 = sha256File(canonicalTarballPath);
  const canonicalTarPath = path.join(workDir, 'canonical.tar');
  const tarBytes = fs.statSync(canonicalTarPath).size;
  const tarSha256 = sha256File(canonicalTarPath);
  const packedManifest = JSON.parse(run('tar', ['-xOzf', canonicalTarballPath, 'package/package.json']));
  return {
    tarball,
    tarballPath: canonicalTarballPath,
    bytes,
    sha256,
    tarBytes,
    tarSha256,
    payloadRoot: path.join(workDir, 'extract', 'package'),
    packedManifest,
  };
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
      if (JSON.stringify(packed.packedManifest).includes('workspace:')) {
        fail(`${name}: canonical packed manifest still contains an unresolved workspace: protocol reference.`);
      }
    }

    if (first.tarball !== second.tarball) {
      fail(`${name}: clean reproducibility packs produced different tarball names (${first.tarball} vs ${second.tarball}).`);
    }
    if (first.bytes !== second.bytes || first.sha256 !== second.sha256) {
      const payloadDifferences = comparePayloadTrees(first.payloadRoot, second.payloadRoot);
      const firstManifestPath = path.join(first.payloadRoot, 'package.json');
      const secondManifestPath = path.join(second.payloadRoot, 'package.json');
      const manifestTextDifferences = compareTextFiles(firstManifestPath, secondManifestPath);
      const manifestStructure = manifestStructureDiagnostics(firstManifestPath, secondManifestPath);
      const diagnostics = [
        `canonical tar: first(${first.tarBytes} bytes / ${first.tarSha256}) second(${second.tarBytes} bytes / ${second.tarSha256})`,
        payloadDifferences.length > 0
          ? `payload differences:\n${payloadDifferences.map((line) => `  - ${line}`).join('\n')}`
          : 'payload differences: none (tar metadata/header-only drift)',
        manifestTextDifferences.length > 0
          ? `package.json differing lines:\n${manifestTextDifferences.map((line) => `  - ${line}`).join('\n')}`
          : 'package.json differing lines: none',
        `package.json structure:\n${manifestStructure.map((line) => `  - ${line}`).join('\n')}`,
      ].join('\n');
      fail(
        `${name}: canonical reproducibility check failed; identical source produced ` +
          `${first.bytes} bytes / ${first.sha256} then ${second.bytes} bytes / ${second.sha256}.\n${diagnostics}`,
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
    entry.canonicalManifest = true;
    entry.artifact = path.relative(ROOT_DIR, finalPath);
  }

  const missing = report.packages.filter(
    (entry) =>
      !Number.isInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '') ||
      entry.reproducible !== true ||
      entry.canonicalManifest !== true ||
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
