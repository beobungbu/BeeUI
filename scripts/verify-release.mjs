#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const ARTIFACT_DIR = path.join(ROOT_DIR, '.artifacts');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'release-verification.json');
const VERIFY_SHA = process.env.BEEUI_VERIFY_SHA ?? null;

const packageSpecs = [
  {
    name: '@beeui/core',
    dir: 'packages/core',
    requiredPackedFiles: [
      'package/src/index.ts',
      'package/src/utils/anchored-overlay.ts',
      'package/src/utils/overlay-runtime.ts',
      // Built output (D2/D3): dual ESM + CJS + .d.ts is the primary artifact;
      // src stays packed alongside it for the source-ownership path.
      'package/dist/module/index.js',
      'package/dist/commonjs/index.js',
      'package/dist/typescript/module/index.d.ts',
      'package/dist/typescript/commonjs/index.d.ts',
    ],
  },
  {
    name: '@beeui/tokens',
    dir: 'packages/tokens',
    requiredPackedFiles: [
      'package/src/index.ts',
      'package/src/motion-runtime.ts',
      'package/src/theme.css',
      'package/tokens.json',
      'package/src/tokens.resolver.json',
      'package/src/lifecycle.json',
      'package/dist/module/index.js',
      'package/dist/commonjs/index.js',
      'package/dist/typescript/module/index.d.ts',
      'package/dist/typescript/commonjs/index.d.ts',
      // CSS/JSON assets must stay consumable unbuilt (D4): theme.css is
      // imported directly by consumers (`@beeui/tokens/theme.css`), never
      // through the JS module graph, so it is copied into dist verbatim
      // rather than compiled.
      'package/dist/module/theme.css',
      'package/dist/commonjs/theme.css',
    ],
  },
  {
    name: '@beeui/ui',
    dir: 'packages/ui',
    requiredPackedFiles: [
      'package/src/index.ts',
      'package/src/components/popover.tsx',
      'package/src/components/dropdown-menu.tsx',
      'package/src/components/overlay-runtime.tsx',
      'package/src/components/overlay-dismiss-events.ts',
      'package/src/components/overlay-dismiss-events.web.ts',
      // Portal transport layer — the platform-selected files that decide how
      // overlay content travels to its host and whether consumer context
      // survives. These are critical runtime behavior, so pin them explicitly
      // instead of relying on files: ["src"] to sweep them in incidentally.
      'package/src/components/overlay-host-mode.ts',
      'package/src/components/overlay-transport-shared.tsx',
      'package/src/components/overlay-transport.d.ts',
      'package/src/components/overlay-transport.native.tsx',
      'package/src/components/overlay-transport.web.tsx',
      'package/src/components/toast.tsx',
      'package/dist/module/index.js',
      'package/dist/commonjs/index.js',
      'package/dist/typescript/module/index.d.ts',
      'package/dist/typescript/commonjs/index.d.ts',
      // D4: the platform-selected transport files must keep their
      // `.native`/`.web` suffix through the build so Metro's platform
      // extension resolution still works against the compiled package.
      'package/dist/module/components/overlay-transport.native.js',
      'package/dist/module/components/overlay-transport.web.js',
      'package/dist/commonjs/components/overlay-transport.native.js',
      'package/dist/commonjs/components/overlay-transport.web.js',
      // The `.d.ts` platform-shadow shim (see that file's own header comment)
      // must be copied into the compiled type tree too, since other emitted
      // declarations (e.g. overlay-runtime.d.ts) still import it by relative
      // path and tsc does not re-emit hand-written ambient .d.ts inputs.
      'package/dist/typescript/module/components/overlay-transport.d.ts',
      'package/dist/typescript/commonjs/components/overlay-transport.d.ts',
    ],
  },
];

const checks = [];
const packedPackages = [];
let rootVersion = null;
let tempRoot = null;

function record(name, detail = '') {
  checks.push({ name, status: 'pass', detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, name, detail = '') {
  if (!condition) {
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`${name}${suffix}`);
  }
  record(name, detail);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

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
      [
        `Command failed: ${command} ${args.join(' ')}`,
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result.stdout ?? '';
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(absolute));
    } else if (entry.isFile()) {
      output.push(absolute);
    }
  }
  return output;
}

function collectExportTargets(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectExportTargets);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectExportTargets);
  }
  return [];
}

function writeReport(status, error = null) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status,
        commit: VERIFY_SHA,
        version: rootVersion,
        packages: packedPackages,
        checks,
        error: error ? String(error.message ?? error) : null,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

try {
  const rootPackage = readJson(path.join(ROOT_DIR, 'package.json'));
  rootVersion = rootPackage.version;

  run('node', ['./scripts/generate-tokens.mjs', '--check']);
  record('generated token artifacts are current');

  assert(rootPackage.private === true, 'workspace root remains private');
  assert(typeof rootVersion === 'string' && /^0\.\d+\.\d+$/.test(rootVersion), 'workspace uses a pre-1.0 semver version', rootVersion);

  // D2/D3 (ADR-011): the built dist/ output is the primary published artifact,
  // so it must exist on disk before the exports/packed-file checks below can
  // assert anything about it. `pnpm pack` also runs each package's own
  // `prepack` (which rebuilds), so this just makes local/CI runs of this
  // script deterministic without relying on stale dist/ from a prior build.
  run('pnpm', ['--filter', './packages/*', 'run', 'build']);
  record('packages built (dist/ ESM + CJS + .d.ts) before packing');

  const manifests = new Map();

  for (const spec of packageSpecs) {
    const packageDir = path.join(ROOT_DIR, spec.dir);
    const manifestPath = path.join(packageDir, 'package.json');
    const manifest = readJson(manifestPath);
    manifests.set(spec.name, manifest);

    assert(manifest.name === spec.name, `${spec.name} package name matches directory contract`);
    assert(manifest.version === rootVersion, `${spec.name} stays on lockstep version`, manifest.version);
    assert(manifest.private === undefined, `${spec.name} is publication-ready (no private flag)`);
    assert(manifest.type === 'module', `${spec.name} remains an ESM package`);

    // #199 publishable metadata.
    assert(manifest.license === 'MIT', `${spec.name} declares the MIT license`);
    assert(Boolean(manifest.author), `${spec.name} declares an author`);
    assert(
      manifest.repository?.type === 'git' &&
        manifest.repository?.url === 'git+https://github.com/beobungbu/BeeUI.git' &&
        manifest.repository?.directory === spec.dir,
      `${spec.name} declares its repository/directory`,
      JSON.stringify(manifest.repository),
    );
    assert(
      typeof manifest.homepage === 'string' && manifest.homepage.includes('github.com/beobungbu/BeeUI'),
      `${spec.name} declares a homepage`,
      manifest.homepage,
    );
    assert(
      typeof manifest.bugs?.url === 'string' && manifest.bugs.url.includes('github.com/beobungbu/BeeUI'),
      `${spec.name} declares a bugs URL`,
      manifest.bugs?.url,
    );
    assert(
      Array.isArray(manifest.keywords) && manifest.keywords.length > 0,
      `${spec.name} declares keywords`,
      manifest.keywords?.join(', '),
    );
    assert(manifest.sideEffects === false, `${spec.name} declares sideEffects: false`);
    assert(
      manifest.publishConfig?.access === 'public' && manifest.publishConfig?.provenance === true,
      `${spec.name} publishConfig requests public access + provenance`,
      JSON.stringify(manifest.publishConfig),
    );

    // #200 output format: dist/ (built) ships alongside src/ (source-ownership).
    const expectedFiles = spec.name === '@beeui/tokens' ? ['dist', 'src', 'tokens.json'] : ['dist', 'src'];
    assert(
      Array.isArray(manifest.files) && expectedFiles.every((entry) => manifest.files.includes(entry)) && manifest.files.length === expectedFiles.length,
      `${spec.name} packs its built output and its source surface`,
      manifest.files?.join(', ') ?? 'missing',
    );

    for (const field of ['main', 'module', 'types']) {
      assert(typeof manifest[field] === 'string', `${spec.name} declares a top-level ${field} field`, manifest[field]);
      assert(
        fs.existsSync(path.join(packageDir, manifest[field])),
        `${spec.name} top-level ${field} field resolves to a built file`,
        manifest[field],
      );
    }

    const exportTargets = collectExportTargets(manifest.exports);
    assert(exportTargets.length > 0, `${spec.name} declares package exports`);
    for (const target of exportTargets) {
      assert(target.startsWith('./'), `${spec.name} export is package-relative`, target);
      assert(fs.existsSync(path.join(packageDir, target)), `${spec.name} export target exists`, target);
    }

    // D3/D4: every subpath's "." export must expose the conditions consumers
    // and bundlers rely on — types for TypeScript, source for the
    // monorepo/source-ownership path, react-native for Metro, import/require
    // for dual ESM+CJS, and browser/default for generic bundlers.
    const dotExport = manifest.exports?.['.'];
    const requiredConditions = ['source', 'react-native', 'import', 'require', 'browser', 'default'];
    for (const condition of requiredConditions) {
      assert(
        Object.hasOwn(dotExport ?? {}, condition),
        `${spec.name} exports['.'] declares the ${condition} condition`,
      );
    }
    assert(
      typeof dotExport.import === 'object' && typeof dotExport.import.types === 'string',
      `${spec.name} exports['.'].import declares its own types`,
    );
    assert(
      typeof dotExport.require === 'object' && typeof dotExport.require.types === 'string',
      `${spec.name} exports['.'].require declares its own types`,
    );
  }

  const uiManifest = manifests.get('@beeui/ui');
  assert(uiManifest.dependencies?.['@beeui/core'] === 'workspace:*', '@beeui/ui uses the workspace protocol internally for @beeui/core');

  const expectedUiPeers = {
    react: '>=19 <20',
    'react-native': '>=0.86.0 <0.87.0',
    'react-native-safe-area-context': '>=5 <6',
    'react-native-teleport': '>=1.1 <2',
    tailwindcss: '>=4 <5',
    uniwind: '>=1.10.1 <2',
  };
  for (const [peer, range] of Object.entries(expectedUiPeers)) {
    assert(uiManifest.peerDependencies?.[peer] === range, `@beeui/ui peer range is explicit for ${peer}`, range);
  }
  // @beeui/ui itself only reaches for react-dom in its web (createPortal)
  // transport, so its own direct peer stays optional. Note this is not the whole
  // package-manager story: react-native-teleport declares react-dom as one of its
  // peers, so a strict resolver may still require a matching react-dom even in a
  // native-only consumer (see docs/anchored-overlays.md and the bare-native smoke,
  // which installs react-dom for exactly this reason). Assert the direct-peer
  // contract stays optional here.
  assert(
    uiManifest.peerDependencies?.['react-dom'] === '>=19 <20',
    '@beeui/ui declares the react-dom (web) peer range',
    uiManifest.peerDependencies?.['react-dom'],
  );
  assert(
    uiManifest.peerDependenciesMeta?.['react-dom']?.optional === true,
    '@beeui/ui marks its own react-dom peer optional (web-only for BeeUI)',
  );

  const forbiddenExpoImport = /(?:from\s+|require\s*\(\s*|import\s*\(\s*|import\s+)['"]expo(?:\/[^'"]*)?['"]/;
  for (const packageDir of ['packages/core/src', 'packages/ui/src']) {
    const sourceFiles = walkFiles(path.join(ROOT_DIR, packageDir)).filter((file) => /\.[cm]?[jt]sx?$/.test(file));
    const offender = sourceFiles.find((file) => forbiddenExpoImport.test(fs.readFileSync(file, 'utf8')));
    assert(!offender, `${packageDir} has no Expo runtime import`, offender ? path.relative(ROOT_DIR, offender) : 'clean');
  }

  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-'));
  const packDir = path.join(tempRoot, 'packs');
  fs.mkdirSync(packDir, { recursive: true });

  const tarballs = [];
  for (const spec of packageSpecs) {
    const before = new Set(fs.readdirSync(packDir));
    run('pnpm', ['--filter', spec.name, 'pack', '--pack-destination', packDir]);
    const created = fs
      .readdirSync(packDir)
      .filter((file) => file.endsWith('.tgz') && !before.has(file));

    assert(created.length === 1, `${spec.name} produces exactly one tarball`, created.join(', '));

    const tarball = path.join(packDir, created[0]);
    const packedManifest = JSON.parse(run('tar', ['-xOzf', tarball, 'package/package.json']));
    const packedFiles = run('tar', ['-tzf', tarball])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    assert(packedManifest.name === spec.name, `${spec.name} packed manifest keeps package name`);
    assert(packedManifest.version === rootVersion, `${spec.name} packed manifest keeps lockstep version`, rootVersion);
    assert(!JSON.stringify(packedManifest).includes('workspace:'), `${spec.name} packed manifest contains no workspace protocol`);

    for (const requiredFile of spec.requiredPackedFiles) {
      assert(packedFiles.includes(requiredFile), `${spec.name} tarball contains ${requiredFile}`);
    }

    if (spec.name === '@beeui/ui') {
      assert(
        packedManifest.dependencies?.['@beeui/core'] === rootVersion,
        '@beeui/ui packed dependency on @beeui/core resolves to the release version',
        packedManifest.dependencies?.['@beeui/core'] ?? 'missing',
      );
    }

    tarballs.push(tarball);
    packedPackages.push({
      name: spec.name,
      version: packedManifest.version,
      tarball: path.basename(tarball),
      files: packedFiles.length,
    });
  }

  const consumerDir = path.join(tempRoot, 'consumer');
  fs.mkdirSync(consumerDir, { recursive: true });
  fs.writeFileSync(
    path.join(consumerDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'beeui-release-consumer-smoke',
        version: '0.0.0',
        private: true,
      },
      null,
      2,
    )}\n`,
  );

  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--legacy-peer-deps',
      ...tarballs,
    ],
    { cwd: consumerDir },
  );

  for (const spec of packageSpecs) {
    const installedManifestPath = path.join(consumerDir, 'node_modules', ...spec.name.split('/'), 'package.json');
    assert(fs.existsSync(installedManifestPath), `${spec.name} installs into a clean consumer`);
    const installedManifest = readJson(installedManifestPath);
    assert(installedManifest.version === rootVersion, `${spec.name} clean-consumer version matches release`, installedManifest.version);
  }

  assert(!fs.existsSync(path.join(consumerDir, 'node_modules', 'expo')), 'release package smoke does not pull the Expo runtime');

  writeReport('pass');
  console.log(`\nRelease verification passed. Report: ${path.relative(ROOT_DIR, REPORT_PATH)}`);
} catch (error) {
  checks.push({
    name: 'release verification completed',
    status: 'fail',
    detail: String(error.message ?? error),
  });
  writeReport('fail', error);
  console.error(`\nRelease verification failed:\n${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  if (tempRoot) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
