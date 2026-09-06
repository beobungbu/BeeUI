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

// Removal and de-publication are breaking. Metadata (source path, docs owner, owner status) is
// where a row is documented, not what a consumer can reach, so it changes freely.
export function diffInventories(base, head) {
  const baseById = new Map(base.rows.map((row) => [row.id, row]));
  const headById = new Map(head.rows.map((row) => [row.id, row]));
  const removed = [];
  const reclassified = [];
  for (const [id, row] of baseById) {
    const now = headById.get(id);
    if (!now) {
      removed.push(id);
      continue;
    }
    if (row.classification === 'consumer' && now.classification !== 'consumer') {
      reclassified.push({ id, from: row.classification, to: now.classification });
    }
  }
  const added = [...headById.keys()].filter((id) => !baseById.has(id));
  return { removed, reclassified, added };
}

export function classifyDiff(diff) {
  if (diff.removed.length || diff.reclassified.length) return 'breaking';
  if (diff.added.length) return 'additive';
  return 'none';
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

export function readChangesets(rootDir = ROOT_DIR) {
  const dir = path.join(rootDir, '.changeset');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
    .map((name) => ({ name, bumps: parseChangeset(fs.readFileSync(path.join(dir, name), 'utf8')) }));
}

// A breaking diff needs a changeset that bumps a public package by at least `minor`. The
// workspace is on 0.x, where changesets' own convention is that breaking changes bump the
// minor; `major` is accepted too. An additive diff needs any changeset naming a public package.
export function collectSurfaceDiffViolations({ diff, changesets }) {
  const level = classifyDiff(diff);
  if (level === 'none') return [];
  const publicBumps = changesets.flatMap(({ bumps }) =>
    Object.entries(bumps).filter(([name]) => PUBLIC_PACKAGES.includes(name)).map(([, bump]) => bump),
  );
  if (level === 'breaking') {
    if (publicBumps.some((bump) => bump === 'minor' || bump === 'major')) return [];
    const ids = [...diff.removed, ...diff.reclassified.map((entry) => entry.id)].join(', ');
    return [
      `public surface removed or de-published (${ids}) with no changeset bumping a public package by minor or major. ` +
        'Run `pnpm changeset` and describe the migration.',
    ];
  }
  if (publicBumps.length) return [];
  return [`public surface added (${diff.added.join(', ')}) with no changeset naming a public package. Run \`pnpm changeset\`.`];
}

function readBaseInventory(ref, rootDir) {
  return JSON.parse(execFileSync('git', ['show', `${ref}:${OUTPUT_FILE}`], { cwd: rootDir, encoding: 'utf8' }));
}

function main() {
  const baseIndex = process.argv.indexOf('--base');
  const ref = baseIndex === -1 ? 'origin/development' : process.argv[baseIndex + 1];
  const diff = diffInventories(readBaseInventory(ref, ROOT_DIR), JSON.parse(serializePublicSurfaceInventory(ROOT_DIR)));
  console.log(
    `Public surface vs ${ref}: ${classifyDiff(diff)} — removed ${diff.removed.length}, reclassified ${diff.reclassified.length}, added ${diff.added.length}.`,
  );
  for (const id of diff.removed) console.log(`  - removed: ${id}`);
  for (const { id, from, to } of diff.reclassified) console.log(`  - reclassified: ${id} (${from} → ${to})`);
  for (const id of diff.added) console.log(`  + added: ${id}`);
  const violations = collectSurfaceDiffViolations({ diff, changesets: readChangesets(ROOT_DIR) });
  if (violations.length) {
    console.error('Public surface diff check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log('Public surface diff check passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
