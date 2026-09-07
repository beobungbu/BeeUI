#!/usr/bin/env node

// Executable / non-drifting documentation examples check (#222).
//
// Documentation snippets rot silently: an example can keep importing a symbol
// that was renamed or removed, or cite a `@beemvp/beeui-showcase` fixture that no longer
// exists, and nothing fails. This check pins the docs' code examples to the real,
// machine-derived surface so API drift breaks CI instead of misleading a reader:
//
//   - every symbol a doc imports from '@beemvp/beeui-ui' must be a real barrel export
//     (value or type) — hand-written examples cannot reference dead APIs;
//   - every `pnpm beeui add <item>` in the docs must name a real PUBLIC component;
//   - every `@beemvp/beeui-showcase` file the generated references cite as an executable
//     example must resolve to a real file (the fixtures themselves are typechecked
//     by `pnpm --filter @beemvp/beeui-showcase typecheck`, so a resolving link is a
//     compiling example);
//   - the generated references must not present the unpublished packages as live
//     on npm.
//
// Two modes mirror the other repo checks:
//   node scripts/check-doc-examples.mjs         # run all checks, exit non-zero on failure
//   (the unit tests import the helpers)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseBarrelExports } from './generate-llms-txt.mjs';
import { ROOT_DIR, extractBeeuiImports, listSourceFiles } from './component-docs-lib.mjs';

// Documentation roots scanned for @beemvp/beeui-ui example imports.
export const DOC_ROOTS = ['docs', 'apps/docs/src/content'];
export const DOC_EXTENSIONS = ['.md', '.mdx'];

// Generated references whose showcase links and npm-honesty are checked directly.
export const GENERATED_REFERENCES = ['docs/component-reference.md', 'docs/pattern-library.md'];

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function isIdentifier(token) {
  return IDENTIFIER_RE.test(token);
}

export function readBarrelSymbols(rootDir = ROOT_DIR) {
  const barrel = parseBarrelExports(fs.readFileSync(path.join(rootDir, 'packages/ui/src/index.ts'), 'utf8'));
  const symbols = new Set();
  for (const { values, types } of barrel.values()) {
    for (const value of values) symbols.add(value);
    for (const type of types) symbols.add(type);
  }
  return symbols;
}

// Every PUBLIC registry item name is a valid `pnpm beeui add` target — that
// includes the public `theme` item, not just `type: "component"` items. Private
// utilities (public: false) are not addable and stay out of the set.
export function readPublicAddTargets(rootDir = ROOT_DIR) {
  const registry = JSON.parse(fs.readFileSync(path.join(rootDir, 'registry/registry.json'), 'utf8'));
  return new Set(registry.items.filter((item) => item.public).map((item) => item.name));
}

// All documentation files under DOC_ROOTS (repo-relative), sorted.
export function listDocFiles(rootDir = ROOT_DIR) {
  const files = [];
  for (const root of DOC_ROOTS) {
    const abs = path.join(rootDir, root);
    for (const file of listDocFilesRecursive(abs)) {
      files.push(path.relative(rootDir, file).split(path.sep).join('/'));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function listDocFilesRecursive(absDir) {
  if (!fs.existsSync(absDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) out.push(...listDocFilesRecursive(abs));
    else if (DOC_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(abs);
  }
  return out;
}

// @beemvp/beeui-ui symbols imported by a doc that are NOT real exports. Placeholder
// tokens (`…`, `<X>`, comments) are not valid identifiers and are ignored.
export function findHallucinatedSymbols(source, validSymbols) {
  const imported = [...extractBeeuiImports(source)].filter(isIdentifier);
  return imported.filter((symbol) => !validSymbols.has(symbol));
}

// `pnpm beeui add [flags] <item> …` tokens used across a doc.
export function extractBeeuiAddItems(text) {
  const items = new Set();
  const re = /pnpm beeui add((?:\s+--[a-z-]+)*)\s+([a-z][a-z0-9 -]*)/g;
  let match;
  while ((match = re.exec(text))) {
    for (const token of match[2].trim().split(/\s+/)) {
      if (/^[a-z][a-z0-9-]*$/.test(token)) items.add(token);
    }
  }
  return [...items].sort((a, b) => a.localeCompare(b));
}

// Repo-relative markdown link targets in a doc that cite a showcase fixture.
export function extractShowcaseLinks(text) {
  const links = [];
  const re = /\]\(([^)]+)\)/g;
  let match;
  while ((match = re.exec(text))) {
    const target = match[1].split('#')[0].trim();
    if (target.includes('apps/showcase/')) links.push(target);
  }
  return links;
}

export function runChecks(rootDir = ROOT_DIR) {
  const results = [];
  const add = (name, ok, detail = '') => results.push({ name, ok, detail });

  const validSymbols = readBarrelSymbols(rootDir);
  const publicAddTargets = readPublicAddTargets(rootDir);

  // 1. Every @beemvp/beeui-ui symbol imported by any doc is a real export.
  const hallucinated = [];
  for (const rel of listDocFiles(rootDir)) {
    const source = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    for (const symbol of findHallucinatedSymbols(source, validSymbols)) {
      hallucinated.push(`${rel} :: ${symbol}`);
    }
  }
  add('doc @beemvp/beeui-ui imports are real exports', hallucinated.length === 0, hallucinated.length ? hallucinated.slice(0, 12).join(', ') : `scanned ${listDocFiles(rootDir).length} docs`);

  // 2. Every `pnpm beeui add <item>` names a real public component.
  const badAdds = new Set();
  for (const rel of listDocFiles(rootDir)) {
    const source = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    for (const item of extractBeeuiAddItems(source)) {
      if (!publicAddTargets.has(item)) badAdds.add(`${rel} :: ${item}`);
    }
  }
  add('doc `beeui add` items are real public registry items', badAdds.size === 0, badAdds.size ? [...badAdds].slice(0, 12).join(', ') : '');

  // 3. Every showcase example link in the generated references resolves.
  const brokenLinks = [];
  for (const rel of GENERATED_REFERENCES) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) {
      brokenLinks.push(`${rel} (missing)`);
      continue;
    }
    const docDir = path.dirname(abs);
    for (const target of extractShowcaseLinks(fs.readFileSync(abs, 'utf8'))) {
      if (!fs.existsSync(path.resolve(docDir, target))) brokenLinks.push(`${rel} → ${target}`);
    }
  }
  add('generated references cite real showcase fixtures', brokenLinks.length === 0, brokenLinks.length ? brokenLinks.slice(0, 12).join(', ') : '');

  // 4. Every cited showcase fixture actually imports from @beemvp/beeui-ui (is a real fixture).
  const knownShowcase = new Set(listSourceFiles(path.join(rootDir, 'apps/showcase')).map((abs) => path.relative(rootDir, abs).split(path.sep).join('/')));
  const nonFixture = [];
  for (const rel of GENERATED_REFERENCES) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    for (const target of extractShowcaseLinks(fs.readFileSync(abs, 'utf8'))) {
      const normalized = target.replace(/^(\.\.\/)+/, '');
      if (knownShowcase.has(normalized)) {
        const src = fs.readFileSync(path.join(rootDir, normalized), 'utf8');
        if (extractBeeuiImports(src).size === 0) nonFixture.push(`${rel} → ${normalized}`);
      }
    }
  }
  add('cited showcase fixtures import @beemvp/beeui-ui', nonFixture.length === 0, nonFixture.length ? nonFixture.slice(0, 12).join(', ') : '');

  // 5. The generated references never claim availability on npm.
  const falseClaims = [];
  for (const rel of GENERATED_REFERENCES) {
    const abs = path.join(rootDir, rel);
    if (fs.existsSync(abs) && /available on npm/i.test(fs.readFileSync(abs, 'utf8'))) falseClaims.push(rel);
  }
  add('generated references never claim availability on npm', falseClaims.length === 0, falseClaims.join(', '));

  const ok = results.every((r) => r.ok);
  return { ok, results };
}

function main() {
  const { ok, results } = runChecks();
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}\n`);
  }
  if (!ok) {
    process.stdout.write('\nExecutable-examples check FAILED. Fix the doc example or the referenced surface.\n');
    process.exit(1);
  }
  process.stdout.write('\nExecutable-examples check passed.\n');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
