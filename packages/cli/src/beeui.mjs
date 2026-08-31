#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CONFIG_FILENAME,
  availableItems,
  buildAddPlan,
  executeAddPlan,
  getProjectRoot,
  initConfig,
  loadRegistry,
  publicItems,
  readConfig,
  validateConfiguredProjectPaths,
  verifyRegistrySourceIntegrity,
} from './registry-lib.mjs';

// This file always ships one directory below the package root, both in
// repository-local dev mode (`packages/cli/src/beeui.mjs`) and in the built
// package (`<packageRoot>/dist/beeui.mjs`, installed standalone as
// `@beeui/cli`) — `package.json` is always the published tarball's own
// manifest, never read over the network. `version` reports it directly so
// `beeui version`/`--version` never drifts from the actual installed package.
const PACKAGE_JSON_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

async function readOwnPackageInfo() {
  const raw = await readFile(PACKAGE_JSON_PATH, 'utf8');
  const pkg = JSON.parse(raw);
  return { name: pkg.name, version: pkg.version };
}

const HELP = `BeeUI source ownership CLI

Usage:
  beeui help
  beeui version
  beeui init
  beeui list
  beeui add <items...>
  beeui add --all
  beeui add --dry-run <items...>
  beeui add --overwrite <items...>
  beeui doctor

Commands:
  help                 Show this help.
  version              Print the installed @beeui/cli name and version.
  init                 Create ${CONFIG_FILENAME} without overwriting an existing config.
  list                 List supported public registry components in stable order.
  add <items...>       Preflight and copy source plus transitive BeeUI dependencies.
  doctor               Validate the canonical registry, local BeeUI config, and bundled
                       registry integrity (see "registry delivery" below).
  verify               Alias for doctor.

Add options:
  --all                Add the complete stable public registry surface (same set as
                       'beeui list'), instead of naming items explicitly.
  --dry-run            Show the deterministic plan without filesystem mutation.
  --overwrite          Explicitly replace differing destination files after preflight.

Exit codes:
  0                    Success.
  1                    Any usage error, validation failure, or runtime error. The
                       failure reason is always written to stderr.

This CLI copies BeeUI component source into your project. It does not install
npm packages (see #215 for a future, separately-gated package-manager mutation
policy) and does not fetch or execute remote code. The registry it reads from
is bundled with this package (never fetched over the network); 'doctor'
reports whether that bundled data has a verified checksum.
`;

// Only Node 24 has ever run this CLI in CI or in this repository's own
// development workflow (docs/compatibility-matrix.md, "Node — CLI tooling"
// row). Node 22 is a candidate target for a future packed CLI release but is
// not yet exercised by any test, so it is not promised here. Fail loudly and
// actionably instead of letting an unsupported runtime fail with an obscure
// syntax/API error deeper in the CLI.
const MIN_SUPPORTED_NODE_MAJOR = 24;

function checkNodeVersion(nodeVersion = process.version) {
  const major = Number.parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);
  if (Number.isNaN(major) || major < MIN_SUPPORTED_NODE_MAJOR) {
    throw new Error(
      `unsupported Node.js version ${nodeVersion}. The BeeUI CLI requires Node >=${MIN_SUPPORTED_NODE_MAJOR} ` +
        `(this repository develops and tests on Node ${MIN_SUPPORTED_NODE_MAJOR} only; see docs/compatibility-matrix.md). ` +
        `Install Node ${MIN_SUPPORTED_NODE_MAJOR}+ (for example via nvm: "nvm use") and retry.`,
    );
  }
}

function write(stream, value) {
  stream.write(value.endsWith('\n') ? value : `${value}\n`);
}

function assertNoArgs(args, command) {
  if (args.length > 0) throw new Error(`'${command}' does not accept arguments: ${args.join(' ')}`);
}

function parseAddArgs(args) {
  let dryRun = false;
  let overwrite = false;
  let all = false;
  const items = [];
  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--overwrite') {
      overwrite = true;
      continue;
    }
    if (arg === '--all') {
      all = true;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`unknown add option '${arg}'`);
    items.push(arg);
  }
  if (all && items.length > 0) throw new Error("'add --all' does not accept explicit item names");
  if (!all && items.length === 0) throw new Error("'add' requires at least one component name, or use --all");
  return { dryRun, overwrite, all, items };
}

function printRequirements(stdout, requirements) {
  const rows = [
    ...requirements.dependencies.map((entry) => ({ ...entry, kind: 'dependency' })),
    ...requirements.peerDependencies.map((entry) => ({ ...entry, kind: 'peer' })),
  ];
  if (rows.length === 0) return;
  write(stdout, 'External package requirements (install/manage manually):');
  for (const row of rows) {
    const state = row.declared
      ? `declared in ${row.declared.section} as ${row.declared.range}`
      : 'missing from package.json';
    write(stdout, `  ${row.kind.padEnd(10)} ${row.name}@${row.range} [${state}]`);
  }
  write(stdout, 'No package manager was run. Presence is checked; version-range satisfaction is not inferred.');
}

function printPlan(stdout, plan, { dryRun }) {
  write(stdout, `Requested: ${plan.requestedItems.join(', ')}`);
  write(stdout, `Resolved: ${plan.resolvedItems.join(' -> ')}`);
  write(stdout, 'Files:');
  for (const file of plan.files) write(stdout, `  ${file.action.toUpperCase().padEnd(9)} ${file.targetRelative} <= ${file.source}`);
  printRequirements(stdout, plan.requirements);
  write(stdout, `Theme source: ${plan.themeFile}`);
  write(stdout, 'Import the copied theme file from the consumer Tailwind/Uniwind CSS entry; the CLI never mutates that entry automatically.');
  if (dryRun) write(stdout, 'Dry run: no files were written.');
}

export { checkNodeVersion };

export async function main(argv = process.argv.slice(2), options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const cwd = options.cwd ?? process.cwd();

  try {
    checkNodeVersion();
    const [command = 'help', ...args] = argv;

    if (command === 'help' || command === '--help' || command === '-h') {
      assertNoArgs(args, command);
      write(stdout, HELP);
      return 0;
    }

    if (command === 'version' || command === '--version' || command === '-v') {
      assertNoArgs(args, command);
      const { name, version } = await readOwnPackageInfo();
      write(stdout, `${name} ${version}`);
      return 0;
    }

    const registry = await loadRegistry();

    if (command === 'list') {
      assertNoArgs(args, command);
      for (const name of availableItems(registry)) write(stdout, name);
      return 0;
    }

    const projectRoot = await getProjectRoot(cwd);

    if (command === 'init') {
      assertNoArgs(args, command);
      const result = await initConfig(projectRoot);
      if (result.created) write(stdout, `Created ${CONFIG_FILENAME}.`);
      else write(stdout, `${CONFIG_FILENAME} already exists and is valid; nothing changed.`);
      write(stdout, `componentsDir: ${result.config.componentsDir}`);
      write(stdout, `libDir: ${result.config.libDir}`);
      write(stdout, `themeFile: ${result.config.themeFile}`);
      return 0;
    }

    if (command === 'doctor' || command === 'verify') {
      assertNoArgs(args, command);
      const config = await readConfig(projectRoot);
      await validateConfiguredProjectPaths(projectRoot, config);
      const integrity = await verifyRegistrySourceIntegrity(registry);
      const integrityDetail = integrity.mode === 'bundled'
        ? `bundled (${integrity.verifiedCount} source checksums verified)`
        : 'dev (live monorepo source tree, no bundled checksum manifest)';
      write(
        stdout,
        `BeeUI doctor OK: registry schema v${registry.schemaVersion}, ${publicItems(registry).length} public components, ` +
          `valid ${CONFIG_FILENAME}, registry delivery: ${integrityDetail}.`,
      );
      return 0;
    }

    if (command === 'add') {
      const { dryRun, overwrite, all, items } = parseAddArgs(args);
      const config = await readConfig(projectRoot);
      await validateConfiguredProjectPaths(projectRoot, config);
      const requestedItems = all ? availableItems(registry) : items;
      const plan = await buildAddPlan({ projectRoot, registry, config, requestedItems, overwrite });
      printPlan(stdout, plan, { dryRun });
      if (!dryRun) {
        await executeAddPlan(projectRoot, plan);
        write(stdout, 'Source ownership plan applied. External packages, if missing, still require manual installation.');
      }
      return 0;
    }

    throw new Error(`unknown command '${command}'. Run 'beeui help' for usage.`);
  } catch (error) {
    write(stderr, `BeeUI CLI error: ${error.message}`);
    return 1;
  }
}

// `npm`/`pnpm` install the `beeui` bin as a symlink (e.g.
// `node_modules/.bin/beeui -> ../@beeui/cli/dist/beeui.mjs`). Node's default
// ESM loader resolves `import.meta.url` to the symlink's realpath, but
// `process.argv[1]` stays the invoked (symlinked) path, so a literal
// string comparison between the two never matches once this file is run
// through the installed bin link — resolve both through the filesystem's
// realpath before comparing so direct invocation and the packed/published
// bin link both correctly detect "this file is the CLI entry point".
function resolveRealFileUrl(filePath) {
  try {
    return pathToFileURL(realpathSync(filePath)).href;
  } catch {
    return pathToFileURL(filePath).href;
  }
}

const entry = process.argv[1] ? resolveRealFileUrl(process.argv[1]) : null;
if (entry === import.meta.url) process.exitCode = await main();
