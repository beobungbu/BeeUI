// Source-owned component update/diff assistance (#219).
//
// A consumer who ran `beeui add` owns the copied files outright: BeeUI never
// touches them again on its own. This module gives that consumer a safe,
// read-first way to find out what changed upstream since their last sync,
// without ever silently overwriting a local edit.
//
// Source identity (#219 "deterministic source identity/version metadata"):
// registry items carry no semantic version of their own (the registry is
// content-addressed, not semver-tagged — see registry-lib.mjs's #216
// integrity manifest, which already trusts sha256 digests over version
// numbers for the same reason: it is the one identity that cannot drift from
// the actual bytes). `beeui add`/`beeui update` therefore record a
// `beeui.manifest.json` next to `beeui.config.json` mapping every managed
// destination path to the exact sha256 digest of the content that was last
// written there. `beeui diff`/`beeui update` compare three digests per file:
//   - the recorded baseline (what was last synced),
//   - the current local file on disk (has the consumer edited it?),
//   - the current registry-resolved content (has upstream changed?),
// and classify each file from that triangle — see `classifyDiffEntry` below.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  REGISTRY_INTEGRITY_PATH,
  REPO_ROOT,
  applyTransforms,
  assertNoSymlinkPath,
  configuredTarget,
  loadIntegrityManifest,
  resolveInside,
  resolveRegistryItems,
  sha256Hex,
  stableJson,
  statIfExists,
  validateConfig,
  verifySourceChecksum,
} from './registry-lib.mjs';

export const MANIFEST_FILENAME = 'beeui.manifest.json';
export const MANIFEST_SCHEMA_VERSION = 1;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function contentHash(content) {
  return `sha256:${sha256Hex(content)}`;
}

export function validateManifest(manifest) {
  invariant(isPlainObject(manifest), `${MANIFEST_FILENAME} must be an object`);
  invariant(
    manifest.schemaVersion === MANIFEST_SCHEMA_VERSION,
    `unsupported ${MANIFEST_FILENAME} schemaVersion '${manifest.schemaVersion}' (this CLI supports schemaVersion ` +
      `${MANIFEST_SCHEMA_VERSION} only; remove the file and rerun 'beeui add' to regenerate it if it came from an ` +
      'incompatible CLI version)',
  );
  invariant(isPlainObject(manifest.entries), `${MANIFEST_FILENAME}.entries must be an object`);
  for (const [targetRelative, entry] of Object.entries(manifest.entries)) {
    const prefix = `${MANIFEST_FILENAME}.entries['${targetRelative}']`;
    invariant(isPlainObject(entry), `${prefix} must be an object`);
    invariant(typeof entry.item === 'string' && entry.item.length > 0, `${prefix}.item must be a non-empty string`);
    invariant(typeof entry.source === 'string' && entry.source.length > 0, `${prefix}.source must be a non-empty string`);
    invariant(
      typeof entry.contentHash === 'string' && /^sha256:[0-9a-f]{64}$/.test(entry.contentHash),
      `${prefix}.contentHash must be a 'sha256:<hex>' digest`,
    );
  }
  return manifest;
}

function emptyManifest() {
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, entries: {} };
}

// Never throws for "file absent" — a project that has never run `add` simply
// has no manifest yet, which is not an error condition for `diff`/`update`
// (they report "nothing managed" instead).
export async function readManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILENAME);
  await assertNoSymlinkPath(projectRoot, manifestPath, 'manifest');
  const stat = await statIfExists(manifestPath);
  if (!stat) return emptyManifest();
  invariant(stat.isFile(), `${MANIFEST_FILENAME} is not a file`);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`malformed ${MANIFEST_FILENAME}: ${error.message}`);
  }
  return validateManifest(manifest);
}

export async function writeManifest(projectRoot, manifest) {
  validateManifest(manifest);
  const manifestPath = path.join(projectRoot, MANIFEST_FILENAME);
  await assertNoSymlinkPath(projectRoot, manifestPath, 'manifest');
  const sortedEntries = Object.fromEntries(
    Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(manifestPath, stableJson({ schemaVersion: MANIFEST_SCHEMA_VERSION, entries: sortedEntries }), 'utf8');
}

// Folds a completed `buildAddPlan()`/`executeAddPlan()` result into the
// manifest: every file in the plan is now known to hold exactly `content` on
// disk (true for 'create', 'overwrite', and 'unchanged' actions alike — a
// 'collision' action never reaches this point because `buildAddPlan` throws
// before any write happens), so every one of them gets its baseline
// recorded/refreshed. This is also how a project that adopted BeeUI before
// this manifest existed gets backfilled the first time it runs `add` again.
export function recordPlanInManifest(manifest, plan) {
  const entries = { ...manifest.entries };
  for (const file of plan.files) {
    entries[file.targetRelative] = { item: file.item, source: file.source, contentHash: contentHash(file.content) };
  }
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, entries };
}

// Resolves the current registry-computed content for every file in the
// dependency closure of `itemNames`, verifying bundled-source integrity the
// same way `buildAddPlan` does. Deliberately duplicated in miniature from
// `buildAddPlan`'s per-file resolution (rather than sharing one refactored
// helper) so this new, less-tested diff/update path can never change the
// order-of-checks/error-precedence behavior of the heavily-tested `add`
// engine.
async function resolveCurrentPlan({ projectRoot, registry, config, itemNames, sourcesRoot = REPO_ROOT, integrityPath = REGISTRY_INTEGRITY_PATH }) {
  validateConfig(config);
  const items = resolveRegistryItems(registry, itemNames);
  const integrityManifest = await loadIntegrityManifest(integrityPath);
  const resolved = [];
  for (const item of items) {
    for (const file of item.files) {
      const targetRelative = configuredTarget(config, file.target);
      const destination = resolveInside(projectRoot, targetRelative, `destination for '${item.name}'`);
      await assertNoSymlinkPath(projectRoot, destination, `destination for '${item.name}'`);
      const source = resolveInside(sourcesRoot, file.source, `source for '${item.name}'`);
      await assertNoSymlinkPath(sourcesRoot, source, `source for '${item.name}'`);
      const sourceStat = await statIfExists(source);
      invariant(sourceStat?.isFile(), `source file is missing for '${item.name}': ${file.source}`);
      const raw = await readFile(source, 'utf8');
      verifySourceChecksum(file.source, raw, integrityManifest);
      const registryContent = applyTransforms(raw, file.transforms, { destination, projectRoot, config, registry });
      resolved.push({ item: item.name, source: file.source, targetRelative, destination, registryContent });
    }
  }
  resolved.sort((a, b) => a.targetRelative.localeCompare(b.targetRelative));
  return resolved;
}

// Classifies one file from the (baseline, local, registry) digest triangle.
// Every branch is a distinct, deterministic outcome — never a guess:
//   - 'new'                 — never copied; nothing on disk, nothing to lose.
//   - 'missing'              — previously synced, but the file is gone from
//                              disk (consumer deleted it); safe to restore.
//   - 'unchanged'            — matches both baseline and current upstream.
//   - 'upstream-changed'     — local untouched since sync, upstream moved;
//                              safe to fast-forward.
//   - 'local-modified'       — local diverged, upstream did not; nothing to
//                              sync, local edits are the only difference.
//   - 'local-matches-upstream' — local diverged from baseline, but by
//                              coincidence (or a manual merge) now matches
//                              current upstream exactly; nothing to do.
//   - 'conflict'             — both local and upstream diverged from
//                              baseline, and disagree with each other.
//   - 'untracked-conflict'   — a file already exists at this destination with
//                              no recorded baseline (predates the manifest,
//                              or an unrelated pre-existing file) and differs
//                              from current upstream content.
export function classifyDiffEntry({ registryContent, localContent, baselineHash }) {
  const registryHash = contentHash(registryContent);
  if (localContent === null) {
    return { status: baselineHash ? 'missing' : 'new', registryHash, localHash: null };
  }
  const localHash = contentHash(localContent);
  if (!baselineHash) {
    return { status: localHash === registryHash ? 'unchanged' : 'untracked-conflict', registryHash, localHash };
  }
  const localMatchesBaseline = localHash === baselineHash;
  const registryMatchesBaseline = registryHash === baselineHash;
  if (localMatchesBaseline && registryMatchesBaseline) return { status: 'unchanged', registryHash, localHash };
  if (localMatchesBaseline) return { status: 'upstream-changed', registryHash, localHash };
  if (registryMatchesBaseline) return { status: 'local-modified', registryHash, localHash };
  if (localHash === registryHash) return { status: 'local-matches-upstream', registryHash, localHash };
  return { status: 'conflict', registryHash, localHash };
}

// Builds the full diff report for `requestedItems`, or — when empty/omitted —
// for every item this project has already synced at least one file for
// (derived from the manifest, never guessed from disk contents).
export async function buildDiffReport({ projectRoot, registry, config, requestedItems = [] }) {
  const manifest = await readManifest(projectRoot);
  // The manifest records an entry for every file in a request's *resolved*
  // dependency closure, which includes internal, non-public transitive items
  // (e.g. 'core-cn'). `resolveRegistryItems` — like `add` — only accepts
  // public items as request roots (it re-expands their internal dependencies
  // itself), so auto-derived defaults are filtered down to the public items
  // actually managed here; an explicit non-public request name still fails
  // with the same "unknown or unsupported registry item" error `add` gives.
  const publicNames = new Set(registry.items.filter((item) => item.public).map((item) => item.name));
  const managedItemNames = [...new Set(Object.values(manifest.entries).map((entry) => entry.item))]
    .filter((name) => publicNames.has(name))
    .sort();
  const itemNames = requestedItems.length > 0 ? [...new Set(requestedItems)].sort() : managedItemNames;
  if (itemNames.length === 0) return { itemNames: [], entries: [] };

  const resolved = await resolveCurrentPlan({ projectRoot, registry, config, itemNames });
  const entries = [];
  for (const file of resolved) {
    const baselineHash = manifest.entries[file.targetRelative]?.contentHash ?? null;
    const localStat = await statIfExists(file.destination);
    const localContent = localStat?.isFile() ? await readFile(file.destination, 'utf8') : null;
    const classification = classifyDiffEntry({ registryContent: file.registryContent, localContent, baselineHash });
    entries.push({ ...file, localContent, baselineHash, ...classification });
  }
  return { itemNames, entries };
}

// A minimal, deterministic line-level LCS diff — sufficient for
// component-source-sized files and dependency-free (no bundled diff
// library). O(n*m) time/space, fine for the hundreds-of-lines files this CLI
// ever copies.
export function diffLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${a[i]}`);
      i += 1;
    } else {
      out.push(`+ ${b[j]}`);
      j += 1;
    }
  }
  while (i < n) {
    out.push(`- ${a[i]}`);
    i += 1;
  }
  while (j < m) {
    out.push(`+ ${b[j]}`);
    j += 1;
  }
  return out;
}

// Collapses long unchanged runs down to a count, keeping only `context` lines
// of unchanged content around each change — a compact, deterministic,
// agent-readable rendering rather than a full-file dump.
export function formatUnifiedDiff(before, after, { context = 3 } = {}) {
  const lines = diffLines(before, after);
  const isChange = (line) => line.startsWith('- ') || line.startsWith('+ ');
  const keep = new Array(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (!isChange(line)) return;
    for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k += 1) keep[k] = true;
  });
  const out = [];
  let skipped = 0;
  const flushSkipped = () => {
    if (skipped > 0) out.push(`  ... (${skipped} unchanged line${skipped === 1 ? '' : 's'})`);
    skipped = 0;
  };
  for (const [index, line] of lines.entries()) {
    if (keep[index]) {
      flushSkipped();
      out.push(line);
    } else {
      skipped += 1;
    }
  }
  flushSkipped();
  return out;
}

const DIFF_STATUS_LABELS = Object.freeze({
  unchanged: 'UNCHANGED',
  'upstream-changed': 'UPSTREAM',
  'local-modified': 'LOCAL',
  'local-matches-upstream': 'SYNCED',
  conflict: 'CONFLICT',
  new: 'NEW',
  missing: 'MISSING',
  'untracked-conflict': 'UNTRACKED',
});

const DIFF_STATUS_NOTES = Object.freeze({
  unchanged: 'matches the current upstream source; nothing to do',
  'upstream-changed': "upstream changed, local file untouched since last sync; run 'beeui update' to fast-forward",
  'local-modified': 'local edits preserved; upstream source is unchanged since the last sync',
  'local-matches-upstream': 'local content already matches the current upstream source',
  conflict: "local edits and upstream both changed since last sync; run 'beeui update --force' to overwrite local edits, or resolve manually",
  new: "not yet copied into this project; run 'beeui add' or 'beeui update' to add it",
  missing: "previously synced file is missing from disk; run 'beeui update' to restore it",
  'untracked-conflict': "an existing file at this path predates BeeUI tracking and differs from upstream; back it up, then run 'beeui update --force' (or 'beeui add --overwrite') to adopt it under source ownership",
});

// Statuses where showing the local-vs-upstream body is actually informative
// (i.e. local content exists and differs from the upstream-resolved content).
const DIFF_BODY_STATUSES = new Set(['upstream-changed', 'local-modified', 'conflict', 'untracked-conflict']);

export function formatDiffReport(report) {
  const lines = [];
  for (const entry of report.entries) {
    lines.push(`  ${DIFF_STATUS_LABELS[entry.status].padEnd(10)} ${entry.targetRelative} (${entry.item}) — ${DIFF_STATUS_NOTES[entry.status]}`);
    if (DIFF_BODY_STATUSES.has(entry.status) && entry.localContent !== null) {
      for (const diffLine of formatUnifiedDiff(entry.localContent, entry.registryContent)) lines.push(`    ${diffLine}`);
    }
  }
  return lines;
}

// Turns a diff report into an update plan: which files are safe to
// fast-forward automatically, and which require the explicit `--force` flag
// because doing so would discard a local edit BeeUI cannot recover
// (`conflict`/`untracked-conflict`). `local-modified` is intentionally never
// written by `update`, `--force` or not — there is no upstream change to
// apply there, so "updating" it would just silently discard the consumer's
// only edit for no reason.
export async function buildUpdatePlan({ projectRoot, registry, config, requestedItems = [], force = false }) {
  const report = await buildDiffReport({ projectRoot, registry, config, requestedItems });
  const entries = report.entries.map((entry) => {
    let action;
    switch (entry.status) {
      case 'new':
      case 'missing':
      case 'upstream-changed':
        action = 'write';
        break;
      case 'conflict':
      case 'untracked-conflict':
        action = force ? 'write' : 'skip-needs-force';
        break;
      case 'unchanged':
      case 'local-modified':
      case 'local-matches-upstream':
      default:
        action = 'skip';
        break;
    }
    return { ...entry, action };
  });
  return { itemNames: report.itemNames, entries };
}

export async function executeUpdatePlan(projectRoot, plan) {
  const manifest = await readManifest(projectRoot);
  const entries = { ...manifest.entries };
  for (const entry of plan.entries) {
    if (entry.action !== 'write') continue;
    // eslint-disable-next-line no-await-in-loop -- writes must stay sequential; each mkdir/symlink-check pair guards the next write
    await assertNoSymlinkPath(projectRoot, entry.destination, `destination for '${entry.item}'`);
    // eslint-disable-next-line no-await-in-loop -- see above
    await mkdir(path.dirname(entry.destination), { recursive: true });
    // eslint-disable-next-line no-await-in-loop -- re-check immediately before the write, mirroring executeAddPlan
    await assertNoSymlinkPath(projectRoot, entry.destination, `destination for '${entry.item}'`);
    // eslint-disable-next-line no-await-in-loop -- see above
    await writeFile(entry.destination, entry.registryContent, 'utf8');
    entries[entry.targetRelative] = { item: entry.item, source: entry.source, contentHash: entry.registryHash };
  }
  await writeManifest(projectRoot, { schemaVersion: MANIFEST_SCHEMA_VERSION, entries });
}

const UPDATE_ACTION_LABELS = Object.freeze({
  write: 'UPDATE',
  skip: 'SKIP',
  'skip-needs-force': 'SKIP*',
});

export function formatUpdatePlan(plan, { dryRun = false } = {}) {
  const lines = [];
  for (const entry of plan.entries) {
    const suffix = entry.action === 'skip-needs-force' ? " — rerun with 'beeui update --force' to overwrite local edits" : '';
    lines.push(`  ${UPDATE_ACTION_LABELS[entry.action].padEnd(9)} ${entry.targetRelative} (${entry.item}) — ${entry.status}${suffix}`);
  }
  const needsForce = plan.entries.filter((entry) => entry.action === 'skip-needs-force');
  if (needsForce.length > 0) {
    lines.push(
      `${needsForce.length} file(s) have conflicting local and upstream changes and were left untouched. ` +
        "Rerun 'beeui update --force' to overwrite those local edits with the current upstream source " +
        '(irreversible — review the diff above first).',
    );
  }
  if (dryRun) lines.push('Dry run: no files were written.');
  return lines;
}
