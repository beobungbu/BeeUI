// Breaking-change tracking for the public surface, by measurement rather than by memory.
//
// `docs/public-surface.inventory.json` is regenerated from source on every check, so a row that
// disappears between the base branch and HEAD is a public export, type, token, CLI flag or
// registry item that consumers can no longer reach — whether or not anyone remembered to call
// that breaking. This diff is the second half of the owner's "both" decision: changesets carry
// the human-written note, the inventory diff refuses to let a removal ship without one.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OUTPUT_FILE, serializePublicSurfaceInventory } from './generate-public-surface-inventory.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_PACKAGES = ['@beemvp/beeui-ui', '@beemvp/beeui-core', '@beemvp/beeui-tokens', '@beemvp/beeui-cli'];

// A row's id is package-scoped, so a symbol reachable both from the root barrel and from a
// subpath keeps its id when it leaves the barrel: the row swaps `family` for `subpath` and, read
// as metadata, that was a "none". Removing `alertBannerVariants` from `packages/ui/src/index.ts`
// passed this check. Reach is part of what a consumer has; losing the root barrel breaks
// `import { x } from '@beemvp/beeui-ui'` even while `@beemvp/beeui-ui/alert-banner` still works.
function reachOf(row) {
  return row.family !== undefined ? 'root' : row.subpath ? `subpath:${row.subpath}` : 'unknown';
}

// Removal, a narrower reach, a different package, or any change of classification is breaking.
// The inventory carries nine classification values and none of them is "internal" — internal
// rows are not listed — so a row moving from `consumer` to `advanced-consumer` is a demotion a
// consumer reads about after the fact, and the only safe reading of *any* move is breaking.
// Source path, docs owner and owner status are where a row is documented, not what a consumer
// can reach, so they change freely.
export function diffInventories(base, head) {
  const baseById = new Map(base.rows.map((row) => [row.id, row]));
  const headById = new Map(head.rows.map((row) => [row.id, row]));
  const removed = [];
  const changed = [];
  for (const [id, row] of baseById) {
    const now = headById.get(id);
    if (!now) {
      removed.push(id);
      continue;
    }
    if (row.classification !== now.classification) {
      changed.push({ id, what: 'classification', from: row.classification, to: now.classification });
    }
    if (row.package !== now.package) changed.push({ id, what: 'package', from: row.package, to: now.package });
    const was = reachOf(row);
    const is = reachOf(now);
    if (was === 'root' && is !== 'root') changed.push({ id, what: 'reach', from: was, to: is });
  }
  const added = [...headById.keys()].filter((id) => !baseById.has(id));
  return { removed, changed, added };
}

export function classifyDiff(diff) {
  if (diff.removed.length || diff.changed.length) return 'breaking';
  if (diff.added.length) return 'additive';
  return 'none';
}

// The bump a removal needs depends on where the workspace sits on SemVer. On 0.x, changesets'
// own convention is that breaking changes bump the minor, so `minor` is the floor; on 1.x and
// above only `major` is. This was first written assuming 0.x while the workspace major was
// 20260902, where a `minor` is a compatible upgrade for every `^` range and would have
// auto-installed the removal.
export function breakingFloor(rootVersion) {
  const major = Number.parseInt(String(rootVersion).split('.')[0], 10);
  return major === 0 ? ['minor', 'major'] : ['major'];
}

// `---\n"@beemvp/beeui-ui": minor\n---` — the frontmatter of one changeset file.
export function parseChangeset(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/u);
  if (!match) return {};
  const bumps = {};
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^\s*["']?(@?[\w./-]+)["']?\s*:\s*(major|minor|patch)\s*$/u);
    if (entry) bumps[entry[1]] = entry[2];
  }
  return bumps;
}

// Only changesets this change adds count. Reading the working tree let one pending `minor`
// already on the base branch satisfy every later breaking change (`commit: false` keeps them
// there until a release), so the comparison is against the same ref the inventory diff uses.
export function readAddedChangesets(ref, rootDir = ROOT_DIR) {
  const dir = path.join(rootDir, '.changeset');
  if (!fs.existsSync(dir)) return [];
  const committed = git(['diff', '--diff-filter=A', '--name-only', `${ref}...HEAD`, '--', '.changeset/'], rootDir);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', '.changeset/'], rootDir);
  const names = [...new Set(`${committed}\n${untracked}`.split('\n').map((line) => line.trim()).filter(Boolean))];
  return names
    .filter((name) => name.endsWith('.md') && path.basename(name).toLowerCase() !== 'readme.md')
    .map((name) => ({ name, bumps: parseChangeset(fs.readFileSync(path.join(rootDir, name), 'utf8')) }));
}

export function collectSurfaceDiffViolations({ diff, changesets, rootVersion }) {
  const level = classifyDiff(diff);
  if (level === 'none') return [];
  const publicBumps = changesets.flatMap(({ bumps }) =>
    Object.entries(bumps).filter(([name]) => PUBLIC_PACKAGES.includes(name)).map(([, bump]) => bump),
  );
  if (level === 'breaking') {
    const floor = breakingFloor(rootVersion);
    if (publicBumps.some((bump) => floor.includes(bump))) return [];
    const what = [
      ...diff.removed.map((id) => `removed ${id}`),
      ...diff.changed.map((entry) => `${entry.what} of ${entry.id}: ${entry.from} → ${entry.to}`),
    ].join('; ');
    return [
      `public surface broken (${what}) with no changeset added in this change that bumps a public package by ` +
        `${floor.join(' or ')}. Run \`pnpm changeset\`, pick the bump, and describe the migration.`,
    ];
  }
  if (publicBumps.length) return [];
  return [`public surface added (${diff.added.join(', ')}) with no changeset added in this change naming a public package. Run \`pnpm changeset\`.`];
}

function git(args, rootDir) {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// A guard that dies with a stack trace is a guard someone disables. Say what is missing.
export function readBaseInventory(ref, rootDir = ROOT_DIR) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], rootDir);
  } catch {
    throw new Error(`base ref "${ref}" is not available locally. Run \`git fetch origin development\` (or pass --base <ref>).`);
  }
  try {
    return JSON.parse(git(['show', `${ref}:${OUTPUT_FILE}`], rootDir));
  } catch {
    throw new Error(`${OUTPUT_FILE} does not exist at "${ref}"; the base has no inventory to diff against.`);
  }
}

export function parseArgs(argv) {
  const baseIndex = argv.indexOf('--base');
  if (baseIndex === -1) return { ref: 'origin/development' };
  const ref = argv[baseIndex + 1];
  if (!ref || ref.startsWith('--')) throw new Error('--base needs a ref, e.g. --base origin/development');
  return { ref };
}

function main() {
  let ref;
  try {
    ({ ref } = parseArgs(process.argv.slice(2)));
    const base = readBaseInventory(ref, ROOT_DIR);
    const head = JSON.parse(serializePublicSurfaceInventory(ROOT_DIR));
    const diff = diffInventories(base, head);
    console.log(
      `Public surface vs ${ref}: ${classifyDiff(diff)} — removed ${diff.removed.length}, changed ${diff.changed.length}, added ${diff.added.length}.`,
    );
    for (const id of diff.removed) console.log(`  - removed: ${id}`);
    for (const { id, what, from, to } of diff.changed) console.log(`  ~ ${what}: ${id} (${from} → ${to})`);
    for (const id of diff.added) console.log(`  + added: ${id}`);
    const rootVersion = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')).version;
    const violations = collectSurfaceDiffViolations({ diff, changesets: readAddedChangesets(ref, ROOT_DIR), rootVersion });
    if (violations.length) {
      console.error('Public surface diff check failed:');
      for (const violation of violations) console.error(`- ${violation}`);
      process.exit(1);
    }
    console.log('Public surface diff check passed.');
  } catch (error) {
    console.error(`Public surface diff check could not run: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
