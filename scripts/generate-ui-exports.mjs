#!/usr/bin/env node

// Derives `packages/ui/package.json`'s per-component subpath `exports`
// (`@beeui/ui/<name>`) from the single source of truth for "what is public":
// `packages/ui/src/index.ts`'s own `from './components/<name>'` re-exports.
//
// This is a leak guard by construction, not by curation: a component only
// gets a subpath if the public barrel already re-exports it. Internal files
// (locale/shared helpers, overlay transport internals, context modules, the
// `use-direction`/`use-required-callback-warning` hooks, `*.d.ts` platform
// shims) are never referenced by name in `index.ts`, so they never produce an
// export entry, and deep imports into them fail with Node's own
// `ERR_PACKAGE_PATH_NOT_EXPORTED` — no `"./*"` wildcard is used anywhere here.
//
// Component "kind" (single-file vs. base+platform-override vs.
// platform-only-no-base) is detected from `packages/ui/src/components/`'s
// actual file names, mirroring exactly how `index.ts`'s own extensionless
// relative imports already resolve today: Metro/`vite-plugin-rnw` apply
// platform-extension resolution on top of the target, and `tsc` (Bundler
// module resolution) falls back to the co-located `.d.ts` type shim when no
// runtime `.ts`/`.tsx` base file exists (see `date-picker.d.ts`,
// `tooltip.d.ts`, `overlay-transport.d.ts` for the established precedent this
// script generalizes).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI_PACKAGE_DIR = path.join(ROOT_DIR, 'packages/ui');
const INDEX_PATH = path.join(UI_PACKAGE_DIR, 'src/index.ts');
const COMPONENTS_DIR = path.join(UI_PACKAGE_DIR, 'src/components');
const PACKAGE_JSON_PATH = path.join(UI_PACKAGE_DIR, 'package.json');
const GENERATOR_PATH = 'scripts/generate-ui-exports.mjs';

const COMPONENT_IMPORT_RE = /from\s+'\.\/components\/([a-z0-9-]+)'/g;

/**
 * Extracts the ordered, de-duplicated set of public component module names
 * from the barrel's own `from './components/<name>'` specifiers. This is the
 * single source of truth for "what is public" — a file the barrel does not
 * import by this pattern never becomes a subpath.
 */
export function parsePublicComponentNames(indexSource) {
  const names = [];
  const seen = new Set();
  for (const match of indexSource.matchAll(COMPONENT_IMPORT_RE)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  if (names.length === 0) {
    throw new Error(`${INDEX_PATH}: found no './components/<name>' re-exports; barrel parsing is broken`);
  }
  return names;
}

/**
 * Detects a component's file shape from its sibling file names:
 * - `hasBase`: a platform-neutral `<name>.ts`/`.tsx` exists (e.g. `button.tsx`).
 * - `hasNative`: a `<name>.native.ts`/`.tsx` override exists (e.g. `sheet.native.tsx`).
 * - `hasWeb`: a `<name>.web.ts`/`.tsx` override exists (e.g. `sheet.web.tsx`).
 *
 * A component with no base file (e.g. `date-picker`, `tooltip`) always has
 * both a native and web file plus a co-located `.d.ts` type shim — the
 * `.d.ts` itself is never treated as "base" (it produces no runtime module).
 */
export function detectComponentKind(name, filenames) {
  const has = (suffix) => filenames.has(`${name}${suffix}.ts`) || filenames.has(`${name}${suffix}.tsx`);
  const kind = {
    hasBase: has(''),
    hasNative: has('.native'),
    hasWeb: has('.web'),
  };
  if (!kind.hasBase && !kind.hasNative && !kind.hasWeb) {
    throw new Error(`packages/ui/src/components: no source file found for public component "${name}"`);
  }
  return kind;
}

function genericTarget(name, kind, dir, ext) {
  if (kind.hasBase) return `${dir}/${name}${ext}`;
  if (kind.hasWeb) return `${dir}/${name}.web${ext}`;
  return `${dir}/${name}.native${ext}`;
}

/**
 * Builds one `@beeui/ui/<name>` exports entry, carrying the same condition
 * shape as the barrel's `"."` entry (source/react-native/import{types,default}
 * /require{types,default}/browser/default) so every documented component
 * resolves identically to how it already resolves through the barrel today.
 */
export function buildComponentExportsEntry(name, kind) {
  const moduleDir = './dist/module/components';
  const cjsDir = './dist/commonjs/components';
  const typesModuleDir = './dist/typescript/module/components';
  const typesCjsDir = './dist/typescript/commonjs/components';

  const genericModule = genericTarget(name, kind, moduleDir, '.js');
  const genericCjs = genericTarget(name, kind, cjsDir, '.js');
  const nativeModule = kind.hasNative ? `${moduleDir}/${name}.native.js` : genericModule;
  const browserModule = kind.hasWeb ? `${moduleDir}/${name}.web.js` : genericModule;

  return {
    source: `./src/components/${name}`,
    'react-native': nativeModule,
    import: {
      types: `${typesModuleDir}/${name}.d.ts`,
      default: genericModule,
    },
    require: {
      types: `${typesCjsDir}/${name}.d.ts`,
      default: genericCjs,
    },
    browser: browserModule,
    default: genericModule,
  };
}

/**
 * Builds the full `exports` field: the existing barrel `"."`/`"./package.json"`
 * entries plus one `./<name>` entry per public component, derived from
 * `names`/`kindByName`. Component subpaths are inserted in the barrel's own
 * declaration order (already alphabetical) between `"."` and `"./package.json"`.
 */
export function buildUiExportsField(barrelExports, names, kindByName) {
  // Reads only the barrel's own `"."` and `"./package.json"` entries and
  // discards any previously generated `./<name>` subpaths, so re-running this
  // generator against its own prior output is idempotent.
  const root = barrelExports['.'];
  const packageJson = barrelExports['./package.json'];
  if (!root || !packageJson) {
    throw new Error(
      `${PACKAGE_JSON_PATH}: expected "." and "./package.json" in the existing exports before regenerating subpaths`,
    );
  }

  const exportsField = { '.': root };
  for (const name of names) {
    exportsField[`./${name}`] = buildComponentExportsEntry(name, kindByName.get(name));
  }
  exportsField['./package.json'] = packageJson;
  return exportsField;
}

function readComponentFilenames() {
  return new Set(fs.readdirSync(COMPONENTS_DIR, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name));
}

export function computePublicUiExports({ rootDir = ROOT_DIR } = {}) {
  const packageJsonPath = path.join(rootDir, 'packages/ui/package.json');
  const indexPath = path.join(rootDir, 'packages/ui/src/index.ts');
  const componentsDir = path.join(rootDir, 'packages/ui/src/components');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const indexSource = fs.readFileSync(indexPath, 'utf8');
  const names = parsePublicComponentNames(indexSource);
  const filenames = new Set(
    fs.readdirSync(componentsDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name),
  );
  const kindByName = new Map(names.map((name) => [name, detectComponentKind(name, filenames)]));
  const exportsField = buildUiExportsField(packageJson.exports, names, kindByName);

  return { packageJson, packageJsonPath, exportsField, names };
}

export function writeOrCheckUiExports({ check = false, rootDir = ROOT_DIR } = {}) {
  const { packageJson, packageJsonPath, exportsField, names } = computePublicUiExports({ rootDir });
  const currentJson = fs.readFileSync(packageJsonPath, 'utf8');
  packageJson.exports = exportsField;
  const nextJson = `${JSON.stringify(packageJson, null, 2)}\n`;

  if (check) {
    if (currentJson !== nextJson) {
      throw new Error(
        `${path.relative(rootDir, packageJsonPath)} exports are stale for ${names.length} public component(s).\nRun: node ${GENERATOR_PATH}`,
      );
    }
    console.log(`@beeui/ui exports are current (${names.length} public component subpaths).`);
    return exportsField;
  }

  if (currentJson !== nextJson) {
    fs.writeFileSync(packageJsonPath, nextJson, 'utf8');
    console.log(`generated ${names.length} public component subpath(s) into ${path.relative(rootDir, packageJsonPath)}`);
  } else {
    console.log(`@beeui/ui exports already current (${names.length} public component subpaths).`);
  }
  return exportsField;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = process.argv.slice(2);
    const unknown = args.find((arg) => arg !== '--check');
    if (unknown) throw new Error(`unsupported argument: ${unknown}`);
    writeOrCheckUiExports({ check: args.includes('--check') });
  } catch (error) {
    console.error(error.message ?? error);
    process.exitCode = 1;
  }
}
