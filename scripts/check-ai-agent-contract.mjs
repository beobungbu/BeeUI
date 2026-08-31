#!/usr/bin/env node

// AI-agent contract regression suite (#227/#228).
//
// The AI-agent development contract + prompt cookbook (docs/ai-agent-cookbook.md) is prose,
// so it can silently drift away from the real code surface it describes. This check pins the
// cookbook to canonical, machine-derived facts so drift fails CI instead of misleading an
// agent:
//   - every repo-relative link in the cookbook must resolve to a real file;
//   - every `pnpm beeui -- <sub>` subcommand must be a real CLI subcommand;
//   - every `pnpm beeui -- add <item>` must name a real PUBLIC registry component;
//   - every `pnpm <script>` must be a real package.json script;
//   - every component symbol in the machine-checked manifest must be a real @beemvp/beeui-ui export;
//   - the cookbook must cross-link the whole llms.txt family (and those files must exist);
//   - any "NN public component" claim must match the real public-component count;
//   - the unpublished-status rules must be present and no false "published/on npm" claim.
//
// Two modes mirror the other repo checks:
//   node scripts/check-ai-agent-contract.mjs         # run all checks, exit non-zero on failure
//   (the unit tests in scripts/__tests__/ai-agent-contract.test.mjs import these helpers)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseBarrelExports } from './generate-llms-txt.mjs';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const COOKBOOK_REL = 'docs/ai-agent-cookbook.md';

// The canonical llms.txt family the cookbook must cross-link (repo-root-relative).
export const LLMS_FAMILY = ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt'];

// Real subcommands of the repo-local source-ownership CLI (scripts/beeui.mjs).
export const BEEUI_SUBCOMMANDS = new Set(['help', 'init', 'list', 'add', 'doctor', 'verify']);

function readText(rootDir, relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

export function readCookbook(rootDir = ROOT_DIR) {
  return readText(rootDir, COOKBOOK_REL);
}

// --- Canonical fact sources -------------------------------------------------

export function readBarrelValueExports(rootDir = ROOT_DIR) {
  const source = readText(rootDir, 'packages/ui/src/index.ts');
  const parsed = parseBarrelExports(source);
  const values = new Set();
  for (const { values: specValues } of parsed.values()) {
    for (const name of specValues) values.add(name);
  }
  return values;
}

export function readPublicComponentNames(rootDir = ROOT_DIR) {
  const registry = JSON.parse(readText(rootDir, 'registry/registry.json'));
  return registry.items
    .filter((item) => item.public && item.type === 'component')
    .map((item) => item.name)
    .sort();
}

export function readPackageScripts(rootDir = ROOT_DIR) {
  const pkg = JSON.parse(readText(rootDir, 'package.json'));
  return new Set(Object.keys(pkg.scripts ?? {}));
}

// --- Extractors (exported for unit testing) ---------------------------------

// All markdown links `[text](target)`.
export function extractMarkdownLinks(text) {
  const links = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) links.push(m[1].trim());
  return links;
}

// Repo-relative link targets (drop external URLs and pure anchors), with the anchor stripped.
export function extractRepoRelativeLinks(text) {
  return extractMarkdownLinks(text)
    .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith('#') && !target.startsWith('mailto:'))
    .map((target) => target.split('#')[0])
    .filter((target) => target.length > 0);
}

// Links that do not resolve to a real file. Targets are resolved relative to the cookbook's
// own directory (docs/), matching how a reader/renderer follows them.
export function collectBrokenLinks(rootDir = ROOT_DIR) {
  const text = readCookbook(rootDir);
  const cookbookDir = path.dirname(path.join(rootDir, COOKBOOK_REL));
  return extractRepoRelativeLinks(text).filter((target) => !fs.existsSync(path.resolve(cookbookDir, target)));
}

// Subcommand tokens used after `pnpm beeui -- ` (skips option flags like --dry-run).
export function extractBeeuiSubcommands(text) {
  const subs = new Set();
  const re = /pnpm beeui -- ((?:--?[a-z-]+\s+)*)([a-z-]+)/g;
  let m;
  while ((m = re.exec(text))) subs.add(m[2]);
  return [...subs].sort();
}

// Component items requested via `pnpm beeui -- add [flags] <item> [<item>...]`.
export function extractBeeuiAddItems(text) {
  const items = new Set();
  const re = /pnpm beeui -- add((?:\s+--[a-z-]+)*)\s+([a-z][a-z0-9 -]*)/g;
  let m;
  while ((m = re.exec(text))) {
    for (const token of m[2].trim().split(/\s+/)) {
      // Stop at obvious placeholders (angle brackets are stripped by the token class already).
      if (/^[a-z][a-z0-9-]*$/.test(token)) items.add(token);
    }
  }
  return [...items].sort();
}

// `pnpm <script>` references (excludes the `beeui` CLI runner and pnpm's own flags/`-r`).
export function extractPnpmScripts(text) {
  const scripts = new Set();
  const re = /pnpm ([a-z][a-z0-9:-]*)/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1];
    if (name === 'beeui') continue;
    scripts.add(name);
  }
  return [...scripts].sort();
}

// Symbols listed in the machine-checked `<!-- ai-contract:components ... -->` manifest.
export function extractComponentManifest(text) {
  const m = text.match(/<!--\s*ai-contract:components\s*([\s\S]*?)-->/);
  if (!m) return null;
  return m[1]
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

// --- Checks -----------------------------------------------------------------

export function runChecks(rootDir = ROOT_DIR) {
  const results = [];
  const add = (name, ok, detail = '') => results.push({ name, ok, detail });

  const cookbookPath = path.join(rootDir, COOKBOOK_REL);
  const exists = fs.existsSync(cookbookPath);
  add('cookbook exists', exists, exists ? '' : `${COOKBOOK_REL} is missing`);
  if (!exists) return { ok: false, results };

  const text = readCookbook(rootDir);

  add('cookbook ends with a final newline', text.endsWith('\n'), 'repo hygiene requires a trailing newline');

  // Links resolve.
  const broken = collectBrokenLinks(rootDir);
  add('all repo-relative links resolve', broken.length === 0, broken.length ? `broken: ${broken.join(', ')}` : '');

  // beeui subcommands are real.
  const badSubs = extractBeeuiSubcommands(text).filter((s) => !BEEUI_SUBCOMMANDS.has(s));
  add('beeui subcommands are real', badSubs.length === 0, badSubs.length ? `unknown: ${badSubs.join(', ')}` : '');

  // beeui add items are real PUBLIC components.
  const publicComponents = new Set(readPublicComponentNames(rootDir));
  const badAdds = extractBeeuiAddItems(text).filter((i) => !publicComponents.has(i));
  add('beeui add items are real public components', badAdds.length === 0, badAdds.length ? `unknown: ${badAdds.join(', ')}` : '');

  // pnpm scripts are real.
  const scripts = readPackageScripts(rootDir);
  const badScripts = extractPnpmScripts(text).filter((s) => !scripts.has(s));
  add('pnpm scripts are real package.json scripts', badScripts.length === 0, badScripts.length ? `unknown: ${badScripts.join(', ')}` : '');

  // Component manifest symbols are real @beemvp/beeui-ui exports.
  const manifest = extractComponentManifest(text);
  const values = readBarrelValueExports(rootDir);
  if (!manifest) {
    add('component manifest present', false, 'missing <!-- ai-contract:components ... --> block');
  } else {
    const hallucinated = manifest.filter((sym) => !values.has(sym));
    add('component manifest symbols are real @beemvp/beeui-ui exports', hallucinated.length === 0, hallucinated.length ? `not exported: ${hallucinated.join(', ')}` : `${manifest.length} symbols checked`);
  }

  // Cross-links the whole llms.txt family, and the files exist.
  const missingLlmsLinks = LLMS_FAMILY.filter((f) => !text.includes(`(../${f})`));
  add('cross-links the full llms.txt family', missingLlmsLinks.length === 0, missingLlmsLinks.length ? `not linked: ${missingLlmsLinks.join(', ')}` : '');
  const missingLlmsFiles = LLMS_FAMILY.filter((f) => !fs.existsSync(path.join(rootDir, f)));
  add('llms.txt family files exist', missingLlmsFiles.length === 0, missingLlmsFiles.length ? `missing: ${missingLlmsFiles.join(', ')}` : '');

  // Any "NN public component" claim matches reality.
  const claims = [...text.matchAll(/(\d+)\s+public component/g)].map((m) => Number(m[1]));
  const realCount = publicComponents.size;
  const wrongClaims = claims.filter((n) => n !== realCount);
  add('public-component count claims are accurate', wrongClaims.length === 0, wrongClaims.length ? `claims ${wrongClaims.join(', ')} but real count is ${realCount}` : `count ${realCount}`);

  // Unpublished-status rules present.
  add('states the UNPUBLISHED status', /UNPUBLISHED/.test(text), 'must carry the unpublished-status rules');
  add('documents the working source-ownership command', /pnpm beeui -- add/.test(text), 'must present the repo-local `pnpm beeui -- add` path');

  // No false "published / available on npm" claim.
  add('never claims availability on npm', !/available on npm/i.test(text), 'must not present the packages as available on npm');

  const ok = results.every((r) => r.ok);
  return { ok, results };
}

function main() {
  const { ok, results } = runChecks();
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}\n`);
  }
  if (!ok) {
    process.stdout.write('\nAI-agent contract check FAILED. Fix docs/ai-agent-cookbook.md or the referenced surface.\n');
    process.exit(1);
  }
  process.stdout.write('\nAI-agent contract check passed.\n');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
