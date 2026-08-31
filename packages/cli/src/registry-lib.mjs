import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This module is the single shared BeeUI registry/source-ownership engine.
// It is used two ways from two different physical file locations, and it
// must behave correctly in both without any caller-supplied configuration:
//
// 1. Repository-local dev mode: this file lives at
//    `<repoRoot>/packages/cli/src/registry-lib.mjs` (imported directly by
//    `scripts/registry-lib.mjs` and `pnpm beeui`/`pnpm registry:*`). Registry
//    data and component sources are the live monorepo tree.
// 2. Packed/published mode: the package's `build` script copies this file to
//    `<packageRoot>/dist/registry-lib.mjs` and additionally writes a
//    self-contained snapshot of the registry plus every referenced source
//    file into a sibling `<packageRoot>/dist/registry/` directory. A
//    published `@beeui/cli` tarball never has access to the monorepo tree
//    (it is installed standalone into a consumer's node_modules), so at
//    runtime it must resolve registry data and sources from that bundled
//    snapshot instead.
//
// `detectRoots()` distinguishes the two by checking whether a bundled
// `registry/registry.json` exists next to this file. Nothing else in this
// module (or in `beeui.mjs`) needs to know which mode is active.
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

function detectRoots() {
  const bundledRegistryPath = path.join(MODULE_DIR, 'registry', 'registry.json');
  if (existsSync(bundledRegistryPath)) {
    return {
      registryPath: bundledRegistryPath,
      sourcesRoot: path.join(MODULE_DIR, 'registry', 'sources'),
    };
  }
  // Repository-local dev mode: this file always lives at
  // `<repoRoot>/packages/cli/src/registry-lib.mjs`, three directories below
  // the monorepo root.
  const repoRoot = path.resolve(MODULE_DIR, '..', '..', '..');
  return {
    registryPath: path.join(repoRoot, 'registry', 'registry.json'),
    sourcesRoot: repoRoot,
  };
}

const DEFAULT_ROOTS = detectRoots();

// Retained for the repository-local test/verify scripts, which read the
// canonical `registry/registry.json` directly (e.g. to mutate a copy for
// negative-path validator tests). Only meaningful in dev mode; a packed CLI
// resolves `DEFAULT_ROOTS.sourcesRoot` to its own bundled `dist/registry/sources`
// instead, which is not "the repo root" in any useful sense.
export const REPO_ROOT = DEFAULT_ROOTS.sourcesRoot;
export const REGISTRY_PATH = DEFAULT_ROOTS.registryPath;

export const CONFIG_FILENAME = 'beeui.config.json';
export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: 1,
  componentsDir: 'src/components/beeui',
  libDir: 'src/lib/beeui',
  themeFile: 'src/beeui/theme.css',
});

const KNOWN_ITEM_TYPES = new Set(['component', 'utility', 'theme']);
const KNOWN_TARGET_ROOTS = new Set(['components', 'lib', 'theme']);
const KNOWN_TRANSFORMS = new Set(['rewrite-beeui-core-cn', 'rewrite-beeui-core-module']);
const ITEM_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PACKAGE_NAME_RE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function validateRelativePath(value, label, { allowEmpty = false } = {}) {
  invariant(typeof value === 'string', `${label} must be a string`);
  if (allowEmpty && value === '') return '';
  invariant(value.length > 0, `${label} must not be empty`);
  invariant(!value.includes('\\'), `${label} must use forward slashes`);
  invariant(!path.posix.isAbsolute(value), `${label} must be relative`);
  invariant(!path.win32.isAbsolute(value), `${label} must be relative`);
  invariant(!value.includes('\0'), `${label} contains a NUL byte`);

  const segments = value.split('/');
  invariant(!segments.includes('..'), `${label} must not contain '..'`);
  invariant(!segments.includes(''), `${label} must not contain empty path segments`);
  invariant(!segments.includes('.'), `${label} must not contain '.' path segments`);
  return segments.join('/');
}

export function resolveInside(root, relativePath, label = 'path') {
  const safe = validateRelativePath(relativePath, label);
  const candidate = path.resolve(root, ...safe.split('/'));
  const relative = path.relative(root, candidate);
  invariant(relative !== '', `${label} must resolve below the project root`);
  invariant(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `${label} escapes the project root`);
  return candidate;
}

async function statIfExists(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function assertNoSymlinkPath(root, target, label = 'destination') {
  const relative = path.relative(root, target);
  invariant(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `${label} escapes the project root`);

  const parts = relative === '' ? [] : relative.split(path.sep);
  let cursor = root;
  const rootStat = await lstat(root);
  invariant(!rootStat.isSymbolicLink(), `${label} project root must not be a symlink`);

  for (const part of parts) {
    cursor = path.join(cursor, part);
    const stat = await statIfExists(cursor);
    if (!stat) break;
    invariant(!stat.isSymbolicLink(), `${label} crosses symbolic link: ${path.relative(root, cursor)}`);
  }
}

function validatePackageMap(value, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  for (const [name, range] of Object.entries(value)) {
    invariant(PACKAGE_NAME_RE.test(name), `${label} has invalid package name '${name}'`);
    invariant(typeof range === 'string' && range.trim().length > 0, `${label}.${name} must be a non-empty version range`);
    invariant(!/[\r\n\0]/.test(range), `${label}.${name} contains invalid control characters`);
  }
}

export async function validateRegistry(registry, { repoRoot = REPO_ROOT, checkSources = true } = {}) {
  invariant(isPlainObject(registry), 'registry must be an object');
  invariant(registry.schemaVersion === 1, `unsupported registry schemaVersion '${registry.schemaVersion}'`);
  invariant(Array.isArray(registry.items), 'registry.items must be an array');

  const names = new Set();
  const targets = new Map();

  for (const [index, item] of registry.items.entries()) {
    const prefix = `registry.items[${index}]`;
    invariant(isPlainObject(item), `${prefix} must be an object`);
    invariant(typeof item.name === 'string' && ITEM_NAME_RE.test(item.name), `${prefix}.name must be lowercase kebab-case`);
    invariant(!names.has(item.name), `duplicate registry item name '${item.name}'`);
    names.add(item.name);
    invariant(KNOWN_ITEM_TYPES.has(item.type), `${prefix}.type '${item.type}' is not supported`);
    invariant(typeof item.public === 'boolean', `${prefix}.public must be boolean`);
    invariant(Array.isArray(item.files) && item.files.length > 0, `${prefix}.files must be a non-empty array`);
    invariant(Array.isArray(item.registryDependencies), `${prefix}.registryDependencies must be an array`);
    invariant(new Set(item.registryDependencies).size === item.registryDependencies.length, `${prefix}.registryDependencies contains duplicates`);
    validatePackageMap(item.dependencies, `${prefix}.dependencies`);
    validatePackageMap(item.peerDependencies, `${prefix}.peerDependencies`);

    for (const [fileIndex, file] of item.files.entries()) {
      const filePrefix = `${prefix}.files[${fileIndex}]`;
      invariant(isPlainObject(file), `${filePrefix} must be an object`);
      const source = validateRelativePath(file.source, `${filePrefix}.source`);
      invariant(isPlainObject(file.target), `${filePrefix}.target must be an object`);
      invariant(KNOWN_TARGET_ROOTS.has(file.target.root), `${filePrefix}.target.root '${file.target.root}' is not supported`);
      const targetPath = validateRelativePath(file.target.path, `${filePrefix}.target.path`, { allowEmpty: file.target.root === 'theme' });
      invariant(file.target.root === 'theme' ? targetPath === '' : targetPath !== '', `${filePrefix}.target.path is invalid for root '${file.target.root}'`);
      invariant(Array.isArray(file.transforms), `${filePrefix}.transforms must be an array`);
      invariant(new Set(file.transforms).size === file.transforms.length, `${filePrefix}.transforms contains duplicates`);
      for (const transform of file.transforms) {
        invariant(KNOWN_TRANSFORMS.has(transform), `${filePrefix} uses unknown transform '${transform}'`);
      }

      const targetKey = `${file.target.root}:${targetPath}`;
      invariant(!targets.has(targetKey), `duplicate registry target '${targetKey}' in '${targets.get(targetKey)}' and '${item.name}'`);
      targets.set(targetKey, item.name);

      if (checkSources) {
        const sourceAbs = resolveInside(repoRoot, source, `${filePrefix}.source`);
        await assertNoSymlinkPath(repoRoot, sourceAbs, `${filePrefix}.source`);
        const stat = await statIfExists(sourceAbs);
        invariant(stat?.isFile(), `${filePrefix}.source does not exist as a file: ${source}`);
        const resolved = await realpath(sourceAbs);
        const relative = path.relative(repoRoot, resolved);
        invariant(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `${filePrefix}.source resolves outside the repository`);
      }
    }
  }

  for (const item of registry.items) {
    for (const dependency of item.registryDependencies) {
      invariant(names.has(dependency), `registry item '${item.name}' references missing registry dependency '${dependency}'`);
    }
  }

  const byName = new Map(registry.items.map((item) => [item.name, item]));
  const states = new Map();
  const stack = [];
  const visit = (name) => {
    const state = states.get(name);
    if (state === 'done') return;
    if (state === 'visiting') {
      const start = stack.indexOf(name);
      const cycle = [...stack.slice(start), name].join(' -> ');
      throw new Error(`registry dependency cycle detected: ${cycle}`);
    }
    states.set(name, 'visiting');
    stack.push(name);
    for (const dependency of [...byName.get(name).registryDependencies].sort()) visit(dependency);
    stack.pop();
    states.set(name, 'done');
  };
  for (const name of [...names].sort()) visit(name);

  return registry;
}

export async function loadRegistry({ repoRoot = REPO_ROOT, registryPath = REGISTRY_PATH } = {}) {
  let raw;
  try {
    raw = await readFile(registryPath, 'utf8');
  } catch (error) {
    throw new Error(`unable to read registry: ${error.message}`);
  }
  let registry;
  try {
    registry = JSON.parse(raw);
  } catch (error) {
    throw new Error(`malformed registry JSON: ${error.message}`);
  }
  return validateRegistry(registry, { repoRoot, checkSources: true });
}

export function validateConfig(config) {
  invariant(isPlainObject(config), 'config must be an object');
  invariant(config.schemaVersion === 1, `unsupported config schemaVersion '${config.schemaVersion}'`);
  const allowed = new Set(['schemaVersion', 'componentsDir', 'libDir', 'themeFile']);
  for (const key of Object.keys(config)) invariant(allowed.has(key), `unknown config field '${key}'`);
  validateRelativePath(config.componentsDir, 'config.componentsDir');
  validateRelativePath(config.libDir, 'config.libDir');
  validateRelativePath(config.themeFile, 'config.themeFile');
  invariant(config.themeFile.endsWith('.css'), 'config.themeFile must point to a .css file');
  return config;
}

export async function getProjectRoot(cwd = process.cwd()) {
  const root = await realpath(path.resolve(cwd));
  const stat = await lstat(root);
  invariant(stat.isDirectory(), `project root is not a directory: ${root}`);
  return root;
}

export async function readConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILENAME);
  await assertNoSymlinkPath(projectRoot, configPath, 'config');
  const stat = await statIfExists(configPath);
  invariant(stat, `BeeUI is not initialized in this project; run 'pnpm beeui -- init' first`);
  invariant(stat.isFile(), `${CONFIG_FILENAME} is not a file`);
  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`malformed ${CONFIG_FILENAME}: ${error.message}`);
  }
  return validateConfig(config);
}

export async function initConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILENAME);
  await assertNoSymlinkPath(projectRoot, configPath, 'config');
  const stat = await statIfExists(configPath);
  if (stat) {
    invariant(stat.isFile(), `${CONFIG_FILENAME} already exists and is not a file`);
    let existing;
    try {
      existing = JSON.parse(await readFile(configPath, 'utf8'));
    } catch (error) {
      throw new Error(`existing ${CONFIG_FILENAME} is malformed: ${error.message}`);
    }
    validateConfig(existing);
    return { created: false, config: existing, configPath };
  }
  await writeFile(configPath, stableJson(DEFAULT_CONFIG), { encoding: 'utf8', flag: 'wx' });
  return { created: true, config: { ...DEFAULT_CONFIG }, configPath };
}

export function publicItems(registry) {
  return registry.items
    .filter((item) => item.public && item.type === 'component')
    .map((item) => item.name)
    .sort();
}

export function availableItems(registry) {
  return registry.items
    .filter((item) => item.public)
    .map((item) => item.name)
    .sort();
}

export function resolveRegistryItems(registry, requestedItems) {
  invariant(Array.isArray(requestedItems) && requestedItems.length > 0, 'at least one registry item is required');
  const byName = new Map(registry.items.map((item) => [item.name, item]));
  const requested = [...new Set(requestedItems)].sort();
  for (const name of requested) {
    invariant(typeof name === 'string' && ITEM_NAME_RE.test(name), `invalid registry item name '${name}'`);
    const item = byName.get(name);
    invariant(item && item.public, `unknown or unsupported registry item '${name}'`);
  }

  const resolved = [];
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    const item = byName.get(name);
    for (const dependency of [...item.registryDependencies].sort()) visit(dependency);
    seen.add(name);
    resolved.push(item);
  };
  for (const name of requested) visit(name);
  return resolved;
}

function configuredTarget(config, target) {
  if (target.root === 'theme') return config.themeFile;
  const base = target.root === 'components' ? config.componentsDir : config.libDir;
  return `${base}/${target.path}`;
}

function withoutTypeScriptExtension(value) {
  return value.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/, '');
}

function toImportSpecifier(fromFile, toFile) {
  let relative = path.relative(path.dirname(fromFile), withoutTypeScriptExtension(toFile)).split(path.sep).join('/');
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative;
}

function coreCnDestination(projectRoot, config, registry) {
  const core = registry.items.find((item) => item.name === 'core-cn');
  invariant(core, "registry requires internal 'core-cn' item for import rewriting");
  invariant(core.files.length === 1, "internal 'core-cn' item must contain exactly one file");
  return resolveInside(projectRoot, configuredTarget(config, core.files[0].target), 'core-cn destination');
}

function coreOverlayDestination(projectRoot, config, registry) {
  const core = registry.items.find((item) => item.name === 'core-overlay');
  invariant(core, "registry requires internal 'core-overlay' item for @beeui/core module rewriting");
  const indexFile = core.files.find(
    (file) => file.target.root === 'lib' && file.target.path === 'core/index.ts',
  );
  invariant(indexFile, "internal 'core-overlay' item must contain a 'core/index.ts' barrel file");
  return resolveInside(projectRoot, configuredTarget(config, indexFile.target), 'core-overlay destination');
}

export function applyTransforms(source, transforms, { destination, projectRoot, config, registry }) {
  let output = source;
  for (const transform of transforms) {
    if (transform === 'rewrite-beeui-core-cn') {
      const needle = "import { cn } from '@beeui/core';";
      const count = output.split(needle).length - 1;
      invariant(count === 1, `transform '${transform}' expected exactly one @beeui/core cn import in ${path.relative(projectRoot, destination)}`);
      const importPath = toImportSpecifier(destination, coreCnDestination(projectRoot, config, registry));
      output = output.replace(needle, `import { cn } from '${importPath}';`);
      continue;
    }
    if (transform === 'rewrite-beeui-core-module') {
      const needle = "from '@beeui/core'";
      const count = output.split(needle).length - 1;
      invariant(count === 1, `transform '${transform}' expected exactly one @beeui/core module specifier in ${path.relative(projectRoot, destination)}`);
      const importPath = toImportSpecifier(destination, coreOverlayDestination(projectRoot, config, registry));
      output = output.replace(needle, `from '${importPath}'`);
      continue;
    }
    throw new Error(`unsupported transform '${transform}'`);
  }
  return output;
}

function mergeRequirements(items) {
  const groups = { dependencies: new Map(), peerDependencies: new Map() };
  for (const item of items) {
    for (const groupName of Object.keys(groups)) {
      for (const [name, range] of Object.entries(item[groupName])) {
        const existing = groups[groupName].get(name);
        invariant(!existing || existing === range, `conflicting ${groupName} ranges for '${name}': '${existing}' vs '${range}'`);
        groups[groupName].set(name, range);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(groups).map(([groupName, map]) => [
      groupName,
      [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, range]) => ({ name, range })),
    ]),
  );
}

async function consumerPackageDeclarations(projectRoot) {
  const packagePath = path.join(projectRoot, 'package.json');
  await assertNoSymlinkPath(projectRoot, packagePath, 'package.json');
  const stat = await statIfExists(packagePath);
  if (!stat) return new Map();
  invariant(stat.isFile(), 'package.json is not a file');
  let pkg;
  try {
    pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  } catch (error) {
    throw new Error(`malformed consumer package.json: ${error.message}`);
  }
  const declarations = new Map();
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!isPlainObject(pkg[section])) continue;
    for (const [name, range] of Object.entries(pkg[section])) {
      if (!declarations.has(name)) declarations.set(name, { section, range: String(range) });
    }
  }
  return declarations;
}

export async function buildAddPlan({ projectRoot, registry, config, requestedItems, overwrite = false, sourcesRoot = REPO_ROOT }) {
  validateConfig(config);
  const items = resolveRegistryItems(registry, requestedItems);
  const planned = [];
  const destinations = new Map();

  for (const item of items) {
    for (const file of [...item.files].sort((a, b) => configuredTarget(config, a.target).localeCompare(configuredTarget(config, b.target)))) {
      const targetRelative = configuredTarget(config, file.target);
      const destination = resolveInside(projectRoot, targetRelative, `destination for '${item.name}'`);
      await assertNoSymlinkPath(projectRoot, destination, `destination for '${item.name}'`);
      const key = path.normalize(destination);
      invariant(!destinations.has(key), `resolved destination collision: '${targetRelative}' from '${destinations.get(key)}' and '${item.name}'`);
      destinations.set(key, item.name);

      const source = resolveInside(sourcesRoot, file.source, `source for '${item.name}'`);
      await assertNoSymlinkPath(sourcesRoot, source, `source for '${item.name}'`);
      const sourceStat = await statIfExists(source);
      invariant(sourceStat?.isFile(), `source file is missing for '${item.name}': ${file.source}`);
      const raw = await readFile(source, 'utf8');
      const content = applyTransforms(raw, file.transforms, { destination, projectRoot, config, registry });
      const destinationStat = await statIfExists(destination);
      let action = 'create';
      if (destinationStat) {
        invariant(destinationStat.isFile(), `destination already exists and is not a regular file: ${targetRelative}`);
        const existing = await readFile(destination, 'utf8');
        if (existing === content) action = 'unchanged';
        else action = overwrite ? 'overwrite' : 'collision';
      }
      planned.push({ item: item.name, source: file.source, targetRelative, destination, content, action });
    }
  }

  planned.sort((a, b) => a.targetRelative.localeCompare(b.targetRelative));
  const collisions = planned.filter((entry) => entry.action === 'collision');
  if (collisions.length > 0) {
    const paths = collisions.map((entry) => entry.targetRelative).join(', ');
    throw new Error(`refusing to overwrite existing files: ${paths}; rerun with --overwrite only if replacement is intentional`);
  }

  const requirements = mergeRequirements(items);
  const declarations = await consumerPackageDeclarations(projectRoot);
  for (const group of Object.values(requirements)) {
    for (const requirement of group) requirement.declared = declarations.get(requirement.name) ?? null;
  }

  return {
    requestedItems: [...new Set(requestedItems)].sort(),
    resolvedItems: items.map((item) => item.name),
    files: planned,
    requirements,
    themeFile: config.themeFile,
  };
}

export async function executeAddPlan(projectRoot, plan) {
  for (const entry of plan.files) {
    if (entry.action === 'unchanged') continue;
    await assertNoSymlinkPath(projectRoot, entry.destination, `destination for '${entry.item}'`);
    await mkdir(path.dirname(entry.destination), { recursive: true });
    await assertNoSymlinkPath(projectRoot, entry.destination, `destination for '${entry.item}'`);
    if (entry.action === 'create') {
      await writeFile(entry.destination, entry.content, { encoding: 'utf8', flag: 'wx' });
    } else {
      await writeFile(entry.destination, entry.content, 'utf8');
    }
  }
}

export async function validateConfiguredProjectPaths(projectRoot, config) {
  validateConfig(config);
  for (const [label, relative] of [
    ['componentsDir', config.componentsDir],
    ['libDir', config.libDir],
    ['themeFile', config.themeFile],
  ]) {
    const target = resolveInside(projectRoot, relative, `config.${label}`);
    await assertNoSymlinkPath(projectRoot, target, `config.${label}`);
  }
}
