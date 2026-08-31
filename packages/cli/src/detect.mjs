// Consumer project + platform detection (#213).
//
// This module only *reads* the consumer project (package.json plus a small,
// fixed set of well-known marker files at the project root) to inform
// `doctor`/`init`/`add` diagnostics. It never mutates anything and never
// looks outside `projectRoot` — no walking up parent directories, no
// resolving `node_modules` for actually-installed versions. Detection is
// therefore based on *declared* dependencies/config files, not on what a
// package manager has actually resolved on disk, which keeps it correct
// before `npm install` has ever run (the common case right after `beeui
// init`) and keeps its result fully deterministic for a given project tree.
//
// Per #213's policy: "Detection informs diagnostics/plans; it must not
// silently rewrite arbitrary application configuration." Ambiguous or
// absent signals produce an explicit `'unknown'` kind plus a human-readable
// fallback note, never a guessed answer.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertNoSymlinkPath } from './registry-lib.mjs';

async function readJsonIfExists(projectRoot, relativeName) {
  const target = path.join(projectRoot, relativeName);
  await assertNoSymlinkPath(projectRoot, target, relativeName);
  let raw;
  try {
    raw = await readFile(target, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, value: null };
    throw error;
  }
  try {
    return { exists: true, value: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`malformed ${relativeName}: ${error.message}`);
  }
}

async function fileExists(projectRoot, relativeName) {
  const target = path.join(projectRoot, relativeName);
  await assertNoSymlinkPath(projectRoot, target, relativeName);
  try {
    await readFile(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function collectDeclaredPackages(pkg) {
  const declared = new Map();
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const map = pkg?.[section];
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    for (const [name, range] of Object.entries(map)) {
      if (!declared.has(name)) declared.set(name, { section, range: String(range) });
    }
  }
  return declared;
}

const LOCKFILES = [
  { file: 'pnpm-lock.yaml', packageManager: 'pnpm' },
  { file: 'yarn.lock', packageManager: 'yarn' },
  { file: 'package-lock.json', packageManager: 'npm' },
  { file: 'bun.lockb', packageManager: 'bun' },
];

function detectPackageManager(pkg, lockfilesFound) {
  const field = typeof pkg?.packageManager === 'string' ? pkg.packageManager : null;
  if (field) {
    const name = field.split('@')[0];
    if (['pnpm', 'yarn', 'npm', 'bun'].includes(name)) return name;
  }
  const found = LOCKFILES.find((entry) => lockfilesFound.has(entry.file));
  return found ? found.packageManager : 'unknown';
}

/**
 * Detects the consumer project's kind (`'expo' | 'bare-react-native' |
 * 'web' | 'unknown'`), platform capabilities, package manager, and a small
 * set of setup facts (TypeScript, monorepo, Tailwind/Uniwind presence).
 *
 * Every boolean/string field here is derived from declared `package.json`
 * dependencies and the presence of well-known root-level files — never from
 * resolving `node_modules`, so it works identically before or after
 * `npm install`.
 */
export async function detectProject(projectRoot) {
  const { exists: hasPackageJson, value: pkg } = await readJsonIfExists(projectRoot, 'package.json');
  const declared = hasPackageJson ? collectDeclaredPackages(pkg) : new Map();

  const has = (name) => declared.has(name);

  const lockfilesFound = new Set();
  for (const { file } of LOCKFILES) {
    // eslint-disable-next-line no-await-in-loop -- small fixed list, sequential is clearer than Promise.all bookkeeping here
    if (await fileExists(projectRoot, file)) lockfilesFound.add(file);
  }

  const hasExpo = has('expo');
  const hasReactNative = has('react-native');
  const hasReactDom = has('react-dom');
  const hasReactNativeWeb = has('react-native-web');

  const platforms = {
    native: hasExpo || hasReactNative,
    web: hasReactDom || hasReactNativeWeb,
  };

  let kind = 'unknown';
  if (hasExpo) kind = 'expo';
  else if (hasReactNative) kind = 'bare-react-native';
  else if (platforms.web) kind = 'web';

  const notes = [];
  if (!hasPackageJson) {
    notes.push(
      "no package.json found at the project root; run 'npm init' (or your package manager's equivalent) before " +
        'installing BeeUI peer dependencies — detection defaults to unknown until then.',
    );
  } else if (kind === 'unknown') {
    notes.push(
      "could not detect a React Native or Web project: no 'expo', 'react-native', 'react-dom', or " +
        "'react-native-web' dependency is declared in package.json. If this is intentional (e.g. dependencies " +
        'are not installed yet), install the appropriate peer first; otherwise confirm the project type manually — ' +
        'see docs/registry-cli.md.',
    );
  }

  const hasWorkspacesField = Boolean(pkg?.workspaces);
  const hasPnpmWorkspaceFile = await fileExists(projectRoot, 'pnpm-workspace.yaml');
  const isMonorepo = hasWorkspacesField || hasPnpmWorkspaceFile;

  const hasTsconfig = await fileExists(projectRoot, 'tsconfig.json');
  const hasTypeScript = hasTsconfig || has('typescript');

  return Object.freeze({
    kind,
    platforms: Object.freeze(platforms),
    packageManager: detectPackageManager(pkg, lockfilesFound),
    isMonorepo,
    hasTypeScript,
    hasTailwind: has('tailwindcss'),
    hasUniwind: has('uniwind'),
    hasSafeAreaContext: has('react-native-safe-area-context'),
    hasTeleport: has('react-native-teleport'),
    packageJsonFound: hasPackageJson,
    notes: Object.freeze(notes),
    declared: Object.freeze(declared),
  });
}
