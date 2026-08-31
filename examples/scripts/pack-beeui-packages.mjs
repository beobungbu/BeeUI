#!/usr/bin/env node
// Shared tarball-packing helper for the R10 consumer starters
// (examples/expo-package-consumer, examples/bare-rn-consumer,
// examples/web-consumer, examples/source-ownership-starter).
//
// BeeUI is unpublished (docs/decisions/011-distribution-architecture.md
// "Owner guard": no package is published until the owner commands the 1.0
// release). Every starter therefore consumes real `pnpm pack` tarballs
// through the exact same package boundary as
// scripts/verify-bare-consumer.sh and scripts/verify-web-consumer.sh,
// instead of a workspace:* link or a hand-copied dist/ folder.
//
// Usage:
//   node ../scripts/pack-beeui-packages.mjs --out <dir> [--packages core,tokens,ui,cli]
//
// Prints shell `export NAME_TARBALL="/abs/path.tgz"` lines to stdout so a
// caller can do:
//   eval "$(node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs)"
//   npm install --save-exact "$CORE_TARBALL" "$TOKENS_TARBALL" "$UI_TARBALL"
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const PACKAGE_DIST_HINTS = {
  core: 'dist',
  tokens: 'dist',
  ui: 'dist',
  cli: 'dist',
};

function parseArgs(argv) {
  const args = { out: null, packages: ['core', 'tokens', 'ui'] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      args.out = argv[++i];
    } else if (arg === '--packages') {
      args.packages = argv[++i].split(',').map((entry) => entry.trim()).filter(Boolean);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.out) {
    throw new Error('Missing required --out <dir>');
  }
  return args;
}

function assertBuilt(pkg) {
  const distHint = PACKAGE_DIST_HINTS[pkg];
  const distPath = path.join(REPO_ROOT, 'packages', pkg, distHint);
  if (!existsSync(distPath)) {
    throw new Error(
      `packages/${pkg}/${distHint} is missing. Run "pnpm build" (or, for the CLI, ` +
        `"pnpm --filter @beemvp/beeui-cli run build") from the repo root before packing.`,
    );
  }
}

function packPackage(pkg, outDir) {
  assertBuilt(pkg);
  // `pnpm pack`'s own stdout ("Tarball Details" etc.) must not leak onto our
  // stdout: callers do `eval "$(node pack-beeui-packages.mjs ...)"`, so stdout
  // must contain only the `export NAME_TARBALL=...` lines. Route the child's
  // stdout to our stderr instead (still visible for debugging/build logs).
  execFileSync('pnpm', ['--filter', `@beemvp/beeui-${pkg}`, 'pack', '--pack-destination', outDir], {
    cwd: REPO_ROOT,
    // fd 2 (stderr) for both the child's stdout and stderr, so our own
    // stdout stays limited to the `export NAME_TARBALL=...` lines below.
    stdio: ['ignore', 2, 2],
  });
  const prefix = `beemvp-beeui-${pkg}-`;
  const match = readdirSync(outDir).find((file) => file.startsWith(prefix) && file.endsWith('.tgz'));
  if (!match) {
    throw new Error(`Expected a ${prefix}*.tgz tarball in ${outDir} after packing @beemvp/beeui-${pkg}`);
  }
  return path.join(outDir, match);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const lines = [];
  for (const pkg of args.packages) {
    const tarballPath = packPackage(pkg, outDir);
    const varName = `${pkg.toUpperCase()}_TARBALL`;
    lines.push(`export ${varName}="${tarballPath}"`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
