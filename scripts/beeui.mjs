#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  CONFIG_FILENAME,
  REPO_ROOT,
  availableItems,
  buildAddPlan,
  executeAddPlan,
  getProjectRoot,
  initConfig,
  loadRegistry,
  publicItems,
  readConfig,
  validateConfiguredProjectPaths,
} from './registry-lib.mjs';

const HELP = `BeeUI source ownership CLI (pre-1.0, repository-local)

Usage:
  pnpm beeui -- help
  pnpm beeui -- init
  pnpm beeui -- list
  pnpm beeui -- add <items...>
  pnpm beeui -- add --dry-run <items...>
  pnpm beeui -- add --overwrite <items...>
  pnpm beeui -- doctor

Commands:
  help                 Show this help.
  init                 Create ${CONFIG_FILENAME} without overwriting an existing config.
  list                 List supported public registry components in stable order.
  add <items...>       Preflight and copy source plus transitive BeeUI dependencies.
  doctor               Validate the canonical registry and local BeeUI config.
  verify               Alias for doctor.

Add options:
  --dry-run            Show the deterministic plan without filesystem mutation.
  --overwrite          Explicitly replace differing destination files after preflight.

This CLI does not install npm packages and does not claim a public npm/npx package yet.
`;

function write(stream, value) {
  stream.write(value.endsWith('\n') ? value : `${value}\n`);
}

function assertNoArgs(args, command) {
  if (args.length > 0) throw new Error(`'${command}' does not accept arguments: ${args.join(' ')}`);
}

function parseAddArgs(args) {
  let dryRun = false;
  let overwrite = false;
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
    if (arg.startsWith('-')) throw new Error(`unknown add option '${arg}'`);
    items.push(arg);
  }
  if (items.length === 0) throw new Error("'add' requires at least one component name");
  return { dryRun, overwrite, items };
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

export async function main(argv = process.argv.slice(2), options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const cwd = options.cwd ?? process.cwd();

  try {
    const [command = 'help', ...args] = argv;

    if (command === 'help' || command === '--help' || command === '-h') {
      assertNoArgs(args, command);
      write(stdout, HELP);
      return 0;
    }

    const registry = await loadRegistry({ repoRoot: REPO_ROOT });

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
      write(stdout, `BeeUI doctor OK: registry schema v${registry.schemaVersion}, ${publicItems(registry).length} public components, valid ${CONFIG_FILENAME}.`);
      return 0;
    }

    if (command === 'add') {
      const { dryRun, overwrite, items } = parseAddArgs(args);
      const config = await readConfig(projectRoot);
      await validateConfiguredProjectPaths(projectRoot, config);
      const plan = await buildAddPlan({ projectRoot, registry, config, requestedItems: items, overwrite });
      printPlan(stdout, plan, { dryRun });
      if (!dryRun) {
        await executeAddPlan(projectRoot, plan);
        write(stdout, 'Source ownership plan applied. External packages, if missing, still require manual installation.');
      }
      return 0;
    }

    throw new Error(`unknown command '${command}'. Run 'pnpm beeui -- help' for usage.`);
  } catch (error) {
    write(stderr, `BeeUI CLI error: ${error.message}`);
    return 1;
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entry === import.meta.url) process.exitCode = await main();
