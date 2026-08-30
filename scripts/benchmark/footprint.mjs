#!/usr/bin/env node
// BeeUI bundle & package footprint baseline (#183, R5.5).
//
// This is a separate script from `cli.mjs`'s scenario registry on purpose: the
// sampling harness measures *time* (warm-up/samples/percentiles); this script
// measures *bytes* for a fixed, real point-in-time layout, so nothing here
// benefits from the sampler/statistics machinery. It reuses the harness's git
// provenance helper and its JSON+summary dual-output convention instead.
//
// It measures, honestly and separately (see `docs/beeui-1.0-evidence-classes.md`):
//
//   1. Packed tarball sizes — real `npm pack --dry-run --json` output for every
//      public package (`@beeui/core`, `@beeui/tokens`, `@beeui/ui`) against
//      today's actual source-shaped layout (no build step exists yet; R7.4/#200
//      has not landed, so there is no built ESM/dist artifact to pack instead).
//      This is clean-consumer evidence for *today's* layout, not a promise
//      about the eventual release-ready layout #184/#201 will define.
//
//   2. Clean-consumer bundle contribution — esbuild bundles of small,
//      synthetic entry points that import only from `@beeui/ui`/`@beeui/core`/
//      `@beeui/tokens` (never the whole monorepo or the showcase app), with
//      every peerDependency (react, react-dom, react-native and every optional
//      native peer) marked `external` so the number reflects what THIS
//      package contributes to a consumer's bundle, not what the consumer's
//      platform runtime already provides. This is an esbuild-bundled proxy,
//      not a real Metro/webpack/Vite build — it is reported as such, not as
//      "bundle/compile evidence".
//
// Peer/optional-dependency cost is reported separately (the `externalModules`
// list per scenario) from BeeUI-owned source bytes, per the issue's
// requirement to not conflate the two.
//
// Usage:
//   node scripts/benchmark/footprint.mjs [--out <dir>] [--quiet]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import esbuild from 'esbuild';

import { readGitInfo } from './lib/metadata.mjs';
import { summarizePackEntry, buildScenarioReport } from './lib/footprint-analysis.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA_VERSION = 1;

const PACKAGE_DIRS = {
  core: path.join(ROOT_DIR, 'packages', 'core'),
  tokens: path.join(ROOT_DIR, 'packages', 'tokens'),
  ui: path.join(ROOT_DIR, 'packages', 'ui'),
};

// esbuild's metafile reports input paths relative to `absWorkingDir` (set to
// ROOT_DIR below), always with forward slashes regardless of host OS, so these
// must be POSIX-style relative prefixes rather than absolute filesystem paths.
const OWNED_SOURCE_DIRS = ['packages/core/src', 'packages/tokens/src', 'packages/ui/src'];

const UI_SRC = path.join(PACKAGE_DIRS.ui, 'src');
const COMPONENTS = path.join(UI_SRC, 'components');

function readPackageJson(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

// Real `npm pack --dry-run --json` output for one package directory. npm
// (not pnpm) is used because it understands `--dry-run --json` file
// inventories directly; it is run from inside the package dir so it does not
// need pnpm-workspace-aware resolution.
function runNpmPackDryRun(pkgDir) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: pkgDir,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed in ${pkgDir}:\n${result.stderr}`);
  }
  const [entry] = JSON.parse(result.stdout);
  return entry;
}

function collectPackageFootprints() {
  const footprints = {};
  for (const [name, dir] of Object.entries(PACKAGE_DIRS)) {
    footprints[name] = summarizePackEntry(runNpmPackDryRun(dir));
  }
  return footprints;
}

// Every peerDependency (required and optional) of @beeui/ui: these are what a
// consumer's own app/platform already supplies, so they are marked external
// in every bundle scenario below rather than counted as BeeUI's own footprint.
function collectExternalPeers() {
  const uiPkg = readPackageJson(PACKAGE_DIRS.ui);
  return Object.keys(uiPkg.peerDependencies ?? {});
}

const ALIAS = {
  '@beeui/ui': path.join(UI_SRC, 'index.ts'),
  '@beeui/core': path.join(PACKAGE_DIRS.core, 'src', 'index.ts'),
  '@beeui/tokens': path.join(PACKAGE_DIRS.tokens, 'src', 'index.ts'),
  '@beeui/tokens/motion-runtime': path.join(PACKAGE_DIRS.tokens, 'src', 'motion-runtime.ts'),
};

const RESOLVE_EXTENSIONS = {
  // Metro/webpack platform-extension priority for Web: prefer `*.web.tsx`
  // (e.g. `sheet.web.tsx`) before the platform-neutral `*.tsx`.
  web: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  // Same idea for the native-priority proxy: prefer `*.native.tsx`.
  native: ['.native.tsx', '.native.ts', '.tsx', '.ts', '.jsx', '.js', '.json'],
};

function moduleImport(specifier) {
  return `import * as NS from ${JSON.stringify(specifier)};\nexport { NS };\n`;
}

function combinedImport(specifiers) {
  return specifiers
    .map((specifier, index) => `import * as NS${index} from ${JSON.stringify(specifier)};`)
    .concat(`export { ${specifiers.map((_, index) => `NS${index}`).join(', ')} };`)
    .join('\n');
}

function buildScenarios(externalPeers) {
  const button = path.join(COMPONENTS, 'button');
  const sheet = path.join(COMPONENTS, 'sheet');
  const table = path.join(COMPONENTS, 'table');
  const calendar = path.join(COMPONENTS, 'calendar');
  const datePicker = path.join(COMPONENTS, 'date-picker');
  const dateTimePicker = path.join(COMPONENTS, 'date-time-picker');

  return [
    {
      id: 'web/full-barrel',
      title: 'Full `@beeui/ui` barrel (today’s only public export)',
      platform: 'web',
      entry: moduleImport('@beeui/ui'),
      external: externalPeers,
    },
    {
      id: 'web/single-component-via-barrel',
      title: 'Button imported through the barrel (today’s only import path)',
      platform: 'web',
      entry: `export { Button } from '@beeui/ui';\n`,
      external: externalPeers,
    },
    {
      id: 'web/single-component-direct',
      title: 'Button, direct module import (potential granular-subpath size, feeds #184)',
      platform: 'web',
      entry: moduleImport(button),
      external: externalPeers,
    },
    {
      id: 'web/core-tokens-baseline',
      title: '@beeui/core + @beeui/tokens alone (shared foundation every component pays)',
      platform: 'web',
      entry: combinedImport(['@beeui/core', '@beeui/tokens']),
      external: externalPeers,
    },
    {
      id: 'web/sheet-direct',
      title: 'Sheet, direct module import (optional @gorhom/bottom-sheet cost check)',
      platform: 'web',
      entry: moduleImport(sheet),
      external: externalPeers,
    },
    {
      id: 'web/table-direct',
      title: 'Table, direct module import',
      platform: 'web',
      entry: moduleImport(table),
      external: externalPeers,
    },
    {
      id: 'web/date-controls-direct',
      title: 'Calendar + DatePicker + DateTimePicker combined, direct module import',
      platform: 'web',
      entry: combinedImport([calendar, datePicker, dateTimePicker]),
      external: externalPeers,
    },
    {
      id: 'native/full-barrel',
      title: 'Full `@beeui/ui` barrel, native-extension-priority proxy (not a real Metro build)',
      platform: 'native',
      entry: moduleImport('@beeui/ui'),
      external: externalPeers,
    },
    {
      id: 'native/button-direct',
      title: 'Button, direct module import, native-extension-priority proxy',
      platform: 'native',
      entry: moduleImport(button),
      external: externalPeers,
    },
    {
      id: 'native/sheet-direct',
      title: 'Sheet, direct module import, native-extension-priority proxy (bottom-sheet/reanimated cost check)',
      platform: 'native',
      entry: moduleImport(sheet),
      external: externalPeers,
    },
  ];
}

async function bundleScenario(scenario) {
  const result = await esbuild.build({
    stdin: {
      contents: scenario.entry,
      resolveDir: UI_SRC,
      sourcefile: `${scenario.id.replace(/\//g, '-')}.tsx`,
      loader: 'tsx',
    },
    alias: ALIAS,
    external: scenario.external,
    resolveExtensions: RESOLVE_EXTENSIONS[scenario.platform],
    platform: scenario.platform === 'web' ? 'browser' : 'neutral',
    format: 'esm',
    target: 'es2020',
    bundle: true,
    minify: true,
    treeShaking: true,
    metafile: true,
    write: false,
    logLevel: 'silent',
    absWorkingDir: ROOT_DIR,
  });
  if (result.errors.length > 0) {
    throw new Error(
      `esbuild scenario "${scenario.id}" failed:\n${result.errors.map((e) => e.text).join('\n')}`,
    );
  }
  const text = result.outputFiles[0].text;
  return {
    rawBytes: Buffer.byteLength(text, 'utf8'),
    gzipBytes: zlib.gzipSync(text).length,
    metafile: result.metafile,
  };
}

async function collectBundleReports(externalPeers) {
  const scenarios = buildScenarios(externalPeers);
  const reports = [];
  for (const scenario of scenarios) {
    const bundleResult = await bundleScenario(scenario);
    reports.push(buildScenarioReport(scenario, bundleResult, OWNED_SOURCE_DIRS));
  }
  return reports;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(2)} MiB`;
}

function toSummary(resultSet) {
  const lines = [];
  lines.push('BeeUI bundle & package footprint baseline');
  lines.push(
    `git ${resultSet.metadata.git.shortSha ?? 'nogit'}${resultSet.metadata.git.dirty ? ' (dirty)' : ''} — ${resultSet.metadata.timestamp}`,
  );
  lines.push('');
  lines.push('Packed tarball sizes (npm pack --dry-run, today’s source-shaped layout):');
  for (const pkg of Object.values(resultSet.packages)) {
    lines.push(
      `  ${pkg.name.padEnd(16)} packed(gzip) ${formatBytes(pkg.packedGzipBytes).padStart(10)}   unpacked ${formatBytes(pkg.unpackedBytes).padStart(10)}   files ${pkg.entryCount}`,
    );
  }
  lines.push('');
  lines.push('Clean-consumer bundle contribution (esbuild proxy, peers externalized):');
  for (const scenario of resultSet.scenarios) {
    lines.push(
      `  [${scenario.platform.padEnd(6)}] ${scenario.id.padEnd(34)} raw ${formatBytes(scenario.rawBytes).padStart(10)}  gzip ${formatBytes(scenario.gzipBytes).padStart(9)}  externals: ${scenario.externalModules.length}`,
    );
  }
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  let outDir = path.join(ROOT_DIR, '.artifacts', 'benchmark');
  let quiet = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') {
      outDir = path.isAbsolute(argv[i + 1]) ? argv[i + 1] : path.join(ROOT_DIR, argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--quiet') {
      quiet = true;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }

  const git = readGitInfo();
  const externalPeers = collectExternalPeers();
  const packages = collectPackageFootprints();
  const scenarios = await collectBundleReports(externalPeers);

  const resultSet = {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      timestamp: new Date().toISOString(),
      git,
      externalPeers,
    },
    packages,
    scenarios,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const shaTag = git.shortSha ?? 'nogit';
  const outFile = path.join(outDir, `footprint-${shaTag}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(resultSet, null, 2)}\n`, 'utf8');

  if (!quiet) {
    process.stdout.write(`${toSummary(resultSet)}\n`);
    process.stdout.write(`\nwrote ${path.relative(ROOT_DIR, outFile)}\n`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`footprint measurement failed: ${error.message}\n`);
      process.exitCode = 2;
    });
}
