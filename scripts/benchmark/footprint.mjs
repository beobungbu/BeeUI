#!/usr/bin/env node
// BeeUI bundle & package footprint baseline (#183, R5.5).
//
// This is a separate script from `cli.mjs`'s scenario registry on purpose: the
// sampling harness measures *time* (warm-up/samples/percentiles); this script
// measures *bytes* for a fixed, real point-in-time layout, so nothing here
// benefits from the sampler/statistics machinery. It reuses the harness's git
// provenance helper and its JSON+summary dual-output convention instead.
//
// This supersedes the #346/`feat/183-footprint-baseline` draft, which measured
// the PRE-distribution layout (raw `.ts`/`.tsx` source aliased directly, no
// `dist/`) and was blocked pending #200. #200 has since landed the real
// release-ready package layout: `packages/{core,tokens,ui}` build `dist/`
// (dual ESM `module` + CJS `commonjs` + `.d.ts` via react-native-builder-bob)
// and expose it through conditional `exports` (`source`/`react-native`/
// `browser`/`import`/`require`), with `dist` + `src` both in `files`. This
// script measures THAT layout, not raw source.
//
// It measures, honestly and separately (see `docs/beeui-1.0-evidence-classes.md`):
//
//   1. Packed tarball sizes — real `npm pack --dry-run --json` output for every
//      public package (`@beeui/core`, `@beeui/tokens`, `@beeui/ui`) against the
//      actual release-ready layout: `dist/` (module + commonjs + typescript)
//      plus `src` (kept for the Registry/`beeui add` source-ownership path and
//      for Metro/uniwind `@source` scanning per ADR-011 D4). Requires `dist/`
//      to already be built (`pnpm build`) — `npm pack --dry-run` does not run
//      the `prepack` lifecycle script, so this tool never builds implicitly on
//      your behalf; `pnpm bench:footprint` chains `pnpm build` first.
//
//   2. Clean-consumer bundle contribution — esbuild bundles of small,
//      synthetic entry points that import only from the packages' real BUILT
//      `dist/module` output (the exact file every one of `@beeui/*`'s `exports`
//      conditions — `react-native`, `import`, `browser`, `default` — resolves
//      to; only `require` differs, pointing at `dist/commonjs`), with every
//      peerDependency (react, react-dom, react-native and every optional
//      native peer) marked `external` so the number reflects what THIS
//      package contributes to a consumer's bundle, not what the consumer's
//      platform runtime already provides. This is an esbuild-bundled proxy
//      over real built output, not a real Metro/webpack/Vite build — it is
//      reported as such, not as "bundle/compile evidence". A byte-for-byte
//      Metro/Vite number for a real npm-installed consumer is exactly what
//      `scripts/verify-bare-consumer.sh` / `scripts/verify-web-consumer.sh`
//      already prove at the compile-succeeds level (ADR-011); this script's
//      job is comparative BYTES across scenarios, not re-proving resolution.
//
// Peer/optional-dependency cost is reported separately (the `externalModules`
// list per scenario) from BeeUI-owned source bytes, per the issue's
// requirement to not conflate the two.
//
// The "direct module import" scenarios below bundle a single component's
// built `dist/module/components/<name>.js` file directly, bypassing the
// `@beeui/ui` barrel. Today's public `exports` map has no per-component
// subpath (only `.` and `./package.json`), so these are not a resolvable
// import path for a real consumer yet — they exist to measure what a future
// granular subpath export (issue #184's decision) would cost, using the real
// built bytes rather than a source estimate.
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
const SCHEMA_VERSION = 2;

const PACKAGE_DIRS = {
  core: path.join(ROOT_DIR, 'packages', 'core'),
  tokens: path.join(ROOT_DIR, 'packages', 'tokens'),
  ui: path.join(ROOT_DIR, 'packages', 'ui'),
};

const DIST_MODULE = {
  core: path.join(PACKAGE_DIRS.core, 'dist', 'module'),
  tokens: path.join(PACKAGE_DIRS.tokens, 'dist', 'module'),
  ui: path.join(PACKAGE_DIRS.ui, 'dist', 'module'),
};

// esbuild's metafile reports input paths relative to `absWorkingDir` (set to
// ROOT_DIR below), always with forward slashes regardless of host OS, so these
// must be POSIX-style relative prefixes rather than absolute filesystem paths.
const OWNED_SOURCE_DIRS = [
  'packages/core/dist/module',
  'packages/tokens/dist/module',
  'packages/ui/dist/module',
];

const UI_COMPONENTS = path.join(DIST_MODULE.ui, 'components');

function readPackageJson(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

function assertBuilt() {
  const missing = Object.entries(DIST_MODULE)
    .filter(([, dir]) => !fs.existsSync(path.join(dir, 'index.js')))
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `dist/module is missing for: ${missing.join(', ')}. Run "pnpm build" first ` +
        `(or "pnpm bench:footprint", which chains it) — this script measures the ` +
        `real built output and never builds implicitly on your behalf.`,
    );
  }
}

// Real `npm pack --dry-run --json` output for one package directory. npm
// (not pnpm) is used because it understands `--dry-run --json` file
// inventories directly; it is run from inside the package dir so it does not
// need pnpm-workspace-aware resolution. `--ignore-scripts` is required: `npm
// pack` (dry-run or not) otherwise runs the `prepack` lifecycle script
// (`pnpm run build`), which both rebuilds unnecessarily on every invocation
// and interleaves bob/babel log lines with stdout ahead of the JSON payload,
// breaking `JSON.parse`. This tool packs whatever `dist/` already exists on
// disk instead — see `assertBuilt()`.
function runNpmPackDryRun(pkgDir) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
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

// `@beeui/*` bare specifiers alias to the real built `dist/module/index.js` —
// exactly the file every one of the package's `exports` conditions that a
// bundler would pick for this proxy (`react-native`, `import`, `browser`,
// `default`) resolves to today (only `require` differs, at `dist/commonjs`).
// This is not re-deriving package resolution (that is `pnpm release:verify`'s
// and the clean-consumer scripts' job); it is pointing the byte-count proxy at
// the same file those conditions already agree on.
const ALIAS = {
  '@beeui/ui': path.join(DIST_MODULE.ui, 'index.js'),
  '@beeui/core': path.join(DIST_MODULE.core, 'index.js'),
  '@beeui/tokens': path.join(DIST_MODULE.tokens, 'index.js'),
  '@beeui/tokens/motion-runtime': path.join(DIST_MODULE.tokens, 'motion-runtime.js'),
};

const RESOLVE_EXTENSIONS = {
  // Metro/webpack platform-extension priority for Web: prefer `*.web.js`
  // (e.g. `sheet.web.js`) before the platform-neutral `*.js`. bob's compiled
  // output only ever emits `.js`, never `.ts(x)`.
  web: ['.web.js', '.js'],
  // Same idea for the native-priority proxy: prefer `*.native.js`.
  native: ['.native.js', '.js'],
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
  const button = path.join(UI_COMPONENTS, 'button');
  const sheet = path.join(UI_COMPONENTS, 'sheet');
  const table = path.join(UI_COMPONENTS, 'table');
  const calendar = path.join(UI_COMPONENTS, 'calendar');
  const datePicker = path.join(UI_COMPONENTS, 'date-picker');
  const dateTimePicker = path.join(UI_COMPONENTS, 'date-time-picker');

  return [
    {
      id: 'web/full-barrel',
      title: 'Full `@beeui/ui` barrel (today’s only public export), built output',
      platform: 'web',
      entry: moduleImport('@beeui/ui'),
      external: externalPeers,
    },
    {
      id: 'web/single-component-via-barrel',
      title: 'Button imported through the barrel (today’s only import path), built output',
      platform: 'web',
      entry: `export { Button } from '@beeui/ui';\n`,
      external: externalPeers,
    },
    {
      id: 'web/single-component-direct',
      title: 'Button, direct dist module (potential granular-subpath size, feeds #184)',
      platform: 'web',
      entry: moduleImport(button),
      external: externalPeers,
    },
    {
      id: 'web/core-tokens-baseline',
      title: '@beeui/core + @beeui/tokens alone (shared foundation every component pays), built output',
      platform: 'web',
      entry: combinedImport(['@beeui/core', '@beeui/tokens']),
      external: externalPeers,
    },
    {
      id: 'web/sheet-direct',
      title: 'Sheet, direct dist module (optional @gorhom/bottom-sheet cost check)',
      platform: 'web',
      entry: moduleImport(sheet),
      external: externalPeers,
    },
    {
      id: 'web/table-direct',
      title: 'Table, direct dist module',
      platform: 'web',
      entry: moduleImport(table),
      external: externalPeers,
    },
    {
      id: 'web/date-controls-direct',
      title: 'Calendar + DatePicker + DateTimePicker combined, direct dist module',
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
      title: 'Button, direct dist module, native-extension-priority proxy',
      platform: 'native',
      entry: moduleImport(button),
      external: externalPeers,
    },
    {
      id: 'native/sheet-direct',
      title: 'Sheet, direct dist module, native-extension-priority proxy (bottom-sheet/reanimated cost check)',
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
      resolveDir: DIST_MODULE.ui,
      sourcefile: `${scenario.id.replace(/\//g, '-')}.js`,
      loader: 'js',
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
  lines.push('BeeUI bundle & package footprint baseline (release-ready layout, dist/)');
  lines.push(
    `git ${resultSet.metadata.git.shortSha ?? 'nogit'}${resultSet.metadata.git.dirty ? ' (dirty)' : ''} — ${resultSet.metadata.timestamp}`,
  );
  lines.push('');
  lines.push('Packed tarball sizes (npm pack --dry-run, dist/ + src/):');
  for (const pkg of Object.values(resultSet.packages)) {
    lines.push(
      `  ${pkg.name.padEnd(16)} packed(gzip) ${formatBytes(pkg.packedGzipBytes).padStart(10)}   unpacked ${formatBytes(pkg.unpackedBytes).padStart(10)}   files ${pkg.entryCount}`,
    );
  }
  lines.push('');
  lines.push('Clean-consumer bundle contribution (esbuild proxy over real dist/module, peers externalized):');
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

  assertBuilt();

  const git = readGitInfo();
  const externalPeers = collectExternalPeers();
  const packages = collectPackageFootprints();
  const scenarios = await collectBundleReports(externalPeers);

  const resultSet = {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      timestamp: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
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
