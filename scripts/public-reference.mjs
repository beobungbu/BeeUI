#!/usr/bin/env node

// Generates the Reference hub pages under apps/docs/src/content/docs/reference/ (#463).
//
// These pages are derived from docs/public-surface.inventory.json — the same generated
// inventory the #473 ownership gate reads. That is deliberate: a reference page built from
// the inventory cannot disagree with it, so "every public surface has a documented owner"
// stops being a routing claim and becomes a page a reader can actually open. Adding a public
// token, core export, CLI command or Registry item makes it appear here automatically, and
// --check fails if the committed pages have gone stale.
//
// The irreducible human part — what the surface is for, how to approach it, what is
// intentionally advanced — lives in docs/reference.content.json. The generator joins the two.
//
//   node scripts/public-reference.mjs           # (re)write the pages
//   node scripts/public-reference.mjs --check   # fail if stale or uncurated

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, readJson } from './component-docs-lib.mjs';
import { buildPublicSurfaceInventory } from './generate-public-surface-inventory.mjs';

export const PUBLIC_REFERENCE_DIR = 'apps/docs/src/content/docs/reference';
export const REFERENCE_CONTENT_FILE = 'docs/reference.content.json';
const GITHUB_BLOB = 'https://github.com/beobungbu/BeeUI/blob/main';

// Section order within a page, and the heading each row kind renders under. Kinds absent
// from a given owner simply produce no section.
const KIND_SECTIONS = [
  ['cli-command', 'Commands'],
  ['cli-flag', 'Flags'],
  ['token-group', 'Token groups'],
  ['token-runtime-value', 'Runtime values'],
  ['token-runtime-type', 'Runtime types'],
  ['core-value', 'Values'],
  ['core-type', 'Types'],
  ['registry-item', 'Registry items'],
  ['package-export', 'Package export subpaths'],
];

function slugForRoute(route) {
  // '/docs/reference/tokens/' -> 'tokens'
  return route.replace(/^\/docs\/reference\//u, '').replace(/\/$/u, '');
}

function sourceHref(source) {
  // Inventory sources may carry a locator fragment (tokens.json#tokens.avatarSize). GitHub
  // cannot anchor into JSON, so the fragment stays as prose and the link targets the file.
  const [filePath] = source.split('#', 1);
  return `${GITHUB_BLOB}/${filePath}`;
}

export function buildReferenceManifest(rootDir = ROOT_DIR) {
  const inventory = buildPublicSurfaceInventory(rootDir);
  const byOwner = new Map();
  for (const row of inventory.rows) {
    if (!row.primaryDocsOwner.startsWith('/docs/reference/')) continue;
    byOwner.set(row.primaryDocsOwner, [...(byOwner.get(row.primaryDocsOwner) ?? []), row]);
  }
  return [...byOwner.entries()]
    .map(([route, rows]) => ({
      route,
      slug: slugForRoute(route),
      rows: [...rows].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

export function collectPublicReferenceViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const content = readJson(REFERENCE_CONTENT_FILE, rootDir);
  const manifest = buildReferenceManifest(rootDir);

  for (const owner of manifest) {
    const entry = content.owners?.[owner.slug];
    if (!entry) {
      violations.push(
        `${owner.route} owns ${owner.rows.length} public surface(s) but has no curated entry in ` +
        `${REFERENCE_CONTENT_FILE}. A new reference owner needs prose before it can be published.`,
      );
      continue;
    }
    for (const field of ['title', 'description', 'intro']) {
      if (!entry[field]) violations.push(`${REFERENCE_CONTENT_FILE} owner "${owner.slug}" is missing "${field}".`);
    }
    // A page whose rows are all one kind still needs the reader told what the kind means.
    for (const kind of new Set(owner.rows.map((row) => row.kind))) {
      if (!KIND_SECTIONS.some(([key]) => key === kind)) {
        violations.push(`${owner.route} contains unhandled surface kind "${kind}"; add it to KIND_SECTIONS.`);
      }
    }
  }

  const owned = new Set(manifest.map((owner) => owner.slug));
  for (const slug of Object.keys(content.owners ?? {})) {
    if (!owned.has(slug)) {
      violations.push(
        `${REFERENCE_CONTENT_FILE} curates "${slug}", which no longer owns any public surface. ` +
        'Remove it, or correct the owner policy that stopped routing surfaces to it.',
      );
    }
  }

  return violations;
}

function renderSection(heading, rows) {
  const header = '| Name | Classification | Source |\n| --- | --- | --- |';
  const body = rows
    .map((row) => {
      const locator = row.source.includes('#') ? ` \`${row.source.split('#')[1]}\`` : '';
      return `| \`${row.name}\` | ${row.classification} | [\`${row.source.split('#')[0]}\`](${sourceHref(row.source)})${locator} |`;
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${header}\n${body}\n`;
}

export function renderReferencePage(owner, content) {
  const entry = content.owners[owner.slug];
  const sections = KIND_SECTIONS.flatMap(([kind, heading]) => {
    const rows = owner.rows.filter((row) => row.kind === kind);
    return rows.length ? [renderSection(heading, rows)] : [];
  });

  const notes = entry.notes ? `\n${entry.notes}\n` : '';
  return [
    '---',
    `title: ${entry.title}`,
    `description: ${entry.description}`,
    '---',
    '',
    ':::caution[Generated file]',
    `Do not hand-edit this page. It is written by \`scripts/public-reference.mjs\` from`,
    '`docs/public-surface.inventory.json`, so it lists exactly the surfaces the #473 ownership',
    `gate routes here. Prose lives in \`${REFERENCE_CONTENT_FILE}\`.`,
    ':::',
    '',
    entry.intro,
    notes,
    sections.join('\n'),
  ].join('\n');
}

export function generatePublicReferencePages({ rootDir = ROOT_DIR } = {}) {
  const violations = collectPublicReferenceViolations(rootDir);
  if (violations.length) throw new Error(`Reference hub contract failed:\n- ${violations.join('\n- ')}`);
  const content = readJson(REFERENCE_CONTENT_FILE, rootDir);
  const manifest = buildReferenceManifest(rootDir);
  const outDir = path.join(rootDir, PUBLIC_REFERENCE_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  for (const owner of manifest) {
    fs.writeFileSync(path.join(outDir, `${owner.slug}.md`), renderReferencePage(owner, content));
  }
  return manifest;
}

function main() {
  const check = process.argv.includes('--check');
  const violations = collectPublicReferenceViolations(ROOT_DIR);
  if (violations.length) {
    console.error('Reference hub check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  const content = readJson(REFERENCE_CONTENT_FILE, ROOT_DIR);
  const manifest = buildReferenceManifest(ROOT_DIR);

  if (check) {
    const stale = manifest.filter((owner) => {
      const file = path.join(ROOT_DIR, PUBLIC_REFERENCE_DIR, `${owner.slug}.md`);
      return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== renderReferencePage(owner, content);
    });
    if (stale.length) {
      console.error(
        `Reference hub pages are stale: ${stale.map((owner) => owner.slug).join(', ')}. ` +
        'Run `pnpm docs:reference:generate`.',
      );
      process.exitCode = 1;
      return;
    }
    const total = manifest.reduce((sum, owner) => sum + owner.rows.length, 0);
    console.log(`Reference hub check passed (${manifest.length} owner pages covering ${total} public surfaces).`);
    return;
  }

  const written = generatePublicReferencePages();
  const total = written.reduce((sum, owner) => sum + owner.rows.length, 0);
  console.log(`Generated ${written.length} reference pages covering ${total} public surfaces under ${PUBLIC_REFERENCE_DIR}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
