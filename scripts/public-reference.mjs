#!/usr/bin/env node

// Generates the Reference hub pages under apps/docs/src/content/docs/reference/ (#463).
//
// These pages are derived from docs/public-surface.inventory.json — the same generated
// inventory the ownership gate reads. That is deliberate: a reference page built from
// the inventory cannot disagree with it, so "every public surface has a documented owner"
// stops being a routing claim and becomes a page a reader can actually open. Adding a public
// token, core export, CLI command or Registry item makes it appear here automatically, and
// --check fails if the committed pages have gone stale.
//
// The irreducible human part — what the surface is for, how to approach it, what is
// intentionally advanced — lives in docs/reference.content.json. The generator joins the two.
//
// Every row also carries the columns a reader actually looks a reference page up for: a
// TypeScript-derived signature and JSDoc first sentence for values/types, resolved token
// values for token groups, the command(s) a CLI flag attaches to, and the files/dependencies
// a Registry item copies. These are computed here, at render time, straight from the same
// canonical sources the inventory itself reads — never hand-maintained.
//
//   node scripts/public-reference.mjs           # (re)write the pages
//   node scripts/public-reference.mjs --check   # fail if stale or uncurated

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { ROOT_DIR, readJson, readText } from './component-docs-lib.mjs';
import { buildPublicSurfaceInventory, resolveRelativeModule } from './generate-public-surface-inventory.mjs';
import { CONFIG_FILENAME } from './registry-lib.mjs';

export const PUBLIC_REFERENCE_DIR = 'apps/docs/src/content/docs/reference';
export const REFERENCE_CONTENT_FILE = 'docs/reference.content.json';
const GITHUB_BLOB = 'https://github.com/beobungbu/BeeUI/blob/main';
const CLI_SOURCE_PATH = 'packages/cli/src/beeui.mjs';
const REGISTRY_SOURCE_PATH = 'registry/registry.json';
const TOKENS_SOURCE_PATH = 'packages/tokens/tokens.json';

// Replaces the old visible ":::caution[Generated file]" admonition (#474 M5): that block put
// maintainer history (an internal issue number the reader cannot open) above the answer, on
// every one of these pages. The do-not-edit signal still needs to exist for anyone reading the
// raw file, so it moves into an HTML comment — invisible in the rendered page, exactly like
// `scripts/public-component-reference.mjs`'s GENERATED_MARKER — and cites paths instead of an
// issue number.
const GENERATED_MARKER =
  `<!-- Generated file: written by scripts/public-reference.mjs from docs/public-surface.inventory.json. ` +
  `Prose lives in ${REFERENCE_CONTENT_FILE}. Do not hand-edit. -->`;

// Section order within a page, and the heading + renderer each row kind uses. Kinds absent
// from a given owner simply produce no section.
const KIND_SECTIONS = [
  ['cli-command', 'Commands', renderCliCommandSection],
  ['cli-flag', 'Flags', renderCliFlagSection],
  ['token-group', 'Token groups', renderTokenGroupSection],
  ['token-runtime-value', 'Runtime values', renderTsExportSection],
  ['token-runtime-type', 'Runtime types', renderTsExportSection],
  ['core-value', 'Values', renderTsExportSection],
  ['core-type', 'Types', renderTsExportSection],
  ['registry-item', 'Registry items', renderRegistrySection],
  ['package-export', 'Package export subpaths', renderGenericSection],
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

// ---------------------------------------------------------------------------------------------
// Shared cell-formatting helpers.
//
// A classification column that shows the same word on every row of a section is not a lookup
// column, it is decoration — worse, the vocabulary it prints (consumer/advanced-consumer/
// consumer-runtime/...) is defined nowhere a reader can open. Every renderer below drops the
// Classification column when it is constant across the rows it is about to print, and keeps it
// only where the value varies (currently: core-value's `cn` versus everything else), where the
// owning page's curated prose in docs/reference.content.json already explains what the values
// mean in context.
// ---------------------------------------------------------------------------------------------

export function classificationVaries(rows) {
  return new Set(rows.map((row) => row.classification)).size > 1;
}

function collapseWhitespace(text) {
  return text.replace(/\r?\n/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// Plain-text table cell: whitespace collapsed, pipes escaped. Starlight's markdown pipeline
// splits GFM table rows on every literal `|`, including ones inside a code span (verified
// against the built HTML: an un-escaped `|` inside a backtick-fenced TypeScript union type
// still produced extra `<td>`s), so every cell — code-wrapped or not — needs this.
function formatPlainCell(text, max = 220) {
  if (!text) return '';
  return truncate(collapseWhitespace(text), max).replace(/\|/gu, '\\|');
}

// Text destined for a markdown code span: whitespace collapsed and pipes escaped for the same
// reason as `formatPlainCell` (see its comment). The escape survives inside a code span here —
// code spans do not suppress backslash-escaping of characters that would otherwise be structural
// markdown syntax, only of characters that would otherwise be inline-formatting syntax.
function formatCodeText(text, max = 240) {
  if (!text) return '';
  return truncate(collapseWhitespace(text), max).replace(/\|/gu, '\\|');
}

// Wraps `text` in a markdown code span long enough to survive backticks already inside it
// (TypeScript template-literal types print with their own backticks, e.g.
// `` `--color-${SemanticColorToken}` ``). Per CommonMark, a code span's fence must be one
// backtick longer than the longest backtick run in its content; padding both sides with a
// space keeps a leading/trailing backtick in the content from merging into the fence.
export function codeSpan(text) {
  const runs = text.match(/`+/gu) ?? [];
  const maxRun = runs.reduce((longest, run) => Math.max(longest, run.length), 0);
  const fence = '`'.repeat(maxRun + 1);
  return `${fence} ${text} ${fence}`;
}

function linkedSource(sourcePath, locator = '') {
  return `[\`${sourcePath}\`](${GITHUB_BLOB}/${sourcePath})${locator}`;
}

function tableRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

function tableHeader(columns) {
  return `${tableRow(columns)}\n${tableRow(columns.map(() => '---'))}`;
}

// ---------------------------------------------------------------------------------------------
// Generic fallback renderer — used for kinds M3 did not ask to enrich (package-export today).
// Still applies the constant-classification drop so it never regresses to the flat, undated
// three-column table the other sections used to render.
// ---------------------------------------------------------------------------------------------

function renderGenericSection(heading, rows) {
  const withClassification = classificationVaries(rows);
  const columns = ['Name', ...(withClassification ? ['Classification'] : []), 'Source'];
  const body = rows
    .map((row) => {
      const locator = row.source.includes('#') ? ` \`${row.source.split('#')[1]}\`` : '';
      const sourceCell = linkedSource(row.source.split('#')[0], locator);
      const cells = [`\`${row.name}\``, ...(withClassification ? [row.classification] : []), sourceCell];
      return tableRow(cells);
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${tableHeader(columns)}\n${body}\n`;
}

// ---------------------------------------------------------------------------------------------
// TypeScript-derived signatures (core-value/core-type/token-runtime-value/token-runtime-type).
//
// `packages/core/src/index.ts` and, for some symbols, `packages/tokens/src/index.ts` are
// re-export barrels: the row's `source` names the barrel, not the file that actually declares
// the symbol, which is why every core row used to link to the same file 25 times. `resolveExportedDeclaration`
// walks the same relative `export { x } from './y'` / `export * from './y'` chain the inventory
// generator already parses (`resolveRelativeModule`) until it reaches the real declaration, and
// renders that file as the row's Source link instead.
// ---------------------------------------------------------------------------------------------

const printer = ts.createPrinter({ removeComments: true, omitTrailingSemicolon: true });
const sourceFileCache = new Map();

function parseTypeScript(relPath, rootDir) {
  const key = `${rootDir}::${relPath}`;
  let sourceFile = sourceFileCache.get(key);
  if (!sourceFile) {
    const text = readText(relPath, rootDir);
    sourceFile = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);
    sourceFileCache.set(key, sourceFile);
  }
  return sourceFile;
}

function printNode(node, sourceFile) {
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function jsDocOwner(node) {
  // JSDoc directly above `export const foo = ...;` attaches to the VariableStatement, not the
  // individual VariableDeclaration inside it.
  return ts.isVariableDeclaration(node) ? node.parent.parent : node;
}

// JSDoc is written for maintainers reading source. Two of its habits do not survive being
// published: `{@link Foo}` is inline-tag syntax no markdown renderer resolves, and a bare
// tracking-issue number is unreachable and meaningless to a consumer reading a reference page.
export function publishableJsDocText(text) {
  return text
    .replace(/\{@link\s+([^}|]+?)(?:\|[^}]*)?\}/gu, (_match, target) => `\`${target.trim()}\``)
    // A parenthetical whose whole purpose is a tracking reference, e.g. "(ADR-008, `X` #174)".
    .replace(/\s*\([^()]*#\d{2,4}\)/gu, '')
    // A bare reference left in running prose, e.g. "BeeUI's #72 typed runtime-token reader".
    .replace(/\s#\d{2,4}\b/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function firstJsDocSentence(node) {
  for (const tag of ts.getJSDocCommentsAndTags(jsDocOwner(node))) {
    if (ts.isJSDoc(tag) && tag.comment) {
      const text = ts.getTextOfJSDocComment(tag.comment);
      if (text) return publishableJsDocText(text.trim().split(/(?<=[.!?])\s+/u)[0]);
    }
  }
  return '';
}

function functionSignature(fn, sourceFile) {
  const params = fn.parameters.map((param) => printNode(param, sourceFile)).join(', ');
  const returnType = fn.type ? `: ${printNode(fn.type, sourceFile)}` : '';
  return `(${params})${returnType}`;
}

// Unwraps `expr as const` / `expr satisfies T` (in either order) down to the underlying
// expression, keeping the first `satisfies` type seen — that type is the best available
// "signature" for a data constant that isn't itself a function.
function unwrapAssertions(expression) {
  let current = expression;
  let satisfiesType = null;
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
    if (ts.isSatisfiesExpression(current) && !satisfiesType) satisfiesType = current.type;
    current = current.expression;
  }
  return { expression: current, satisfiesType };
}

// Given a declaration node found by `findLocalDeclaration`, produces the best available
// "signature" text plus the JSDoc first sentence. Every branch is syntactic (compiler-API AST
// inspection), never a full type-checker Program — deliberately, since these files are plain
// exports with explicit parameter/return types, not inference-heavy code.
export function describeDeclarationNode(node, sourceFile) {
  const description = firstJsDocSentence(node);
  if ((ts.isFunctionDeclaration(node) || ts.isMethodSignature(node)) && node.name) {
    return { signature: functionSignature(node, sourceFile), description };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return { signature: printNode(node.type, sourceFile), description };
  }
  if (ts.isInterfaceDeclaration(node)) {
    const members = node.members.map((member) => printNode(member, sourceFile)).join(' ');
    return { signature: `{ ${members} }`, description };
  }
  if (ts.isVariableDeclaration(node)) {
    if (node.type) return { signature: printNode(node.type, sourceFile), description };
    if (node.initializer) {
      const { expression, satisfiesType } = unwrapAssertions(node.initializer);
      if (satisfiesType) return { signature: printNode(satisfiesType, sourceFile), description };
      if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
        return { signature: functionSignature(expression, sourceFile), description };
      }
      return { signature: expression.getText(sourceFile), description };
    }
  }
  return { signature: '', description };
}

function findLocalDeclaration(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name) {
      return statement;
    }
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) return statement;
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) return statement;
    if (ts.isVariableStatement(statement)) {
      const decl = statement.declarationList.declarations.find(
        (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name,
      );
      if (decl) return decl;
    }
  }
  return null;
}

// Parses `sourceText` as a standalone TypeScript file and describes the local declaration named
// `name`. Does not follow re-exports — pure and filesystem-free, so it is the entry point unit
// tests drive with synthetic source instead of the real repository.
export function describeExport(sourceText, fileName, name) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const node = findLocalDeclaration(sourceFile, name);
  return node ? { ...describeDeclarationNode(node, sourceFile), sourceFile } : null;
}

// Resolves `name`, exported (directly or transitively via `export {...} from`/`export * from`)
// from `relPath`, to the file that actually declares it. Returns null rather than throwing when
// resolution fails (a barrel shape this doesn't anticipate, a symbol this repo removed) so a
// signature gap degrades a single table cell instead of failing the whole generator.
export function resolveExportedDeclaration(relPath, name, rootDir = ROOT_DIR, seen = new Set()) {
  if (seen.has(relPath)) return null;
  seen.add(relPath);

  let sourceFile;
  try {
    sourceFile = parseTypeScript(relPath, rootDir);
  } catch {
    return null;
  }

  const direct = findLocalDeclaration(sourceFile, name);
  if (direct) return { node: direct, sourceFile, relPath };

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue;

    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const element = statement.exportClause.elements.find((candidate) => candidate.name.text === name);
      if (!element) continue;
      const localName = (element.propertyName ?? element.name).text;
      const resolved = resolveRelativeModule(relPath, specifier, rootDir);
      if (!resolved) continue;
      const found = resolveExportedDeclaration(resolved, localName, rootDir, seen);
      if (found) return found;
    } else if (!statement.exportClause) {
      const resolved = resolveRelativeModule(relPath, specifier, rootDir);
      if (!resolved) continue;
      const found = resolveExportedDeclaration(resolved, name, rootDir, seen);
      if (found) return found;
    }
  }
  return null;
}

function renderTsExportSection(heading, rows, rootDir) {
  const withClassification = classificationVaries(rows);
  const columns = ['Name', 'Signature', 'Description', ...(withClassification ? ['Classification'] : []), 'Source'];
  const body = rows
    .map((row) => {
      const found = resolveExportedDeclaration(row.source, row.name, rootDir);
      const described = found ? describeDeclarationNode(found.node, found.sourceFile) : { signature: '', description: '' };
      const sourcePath = found?.relPath ?? row.source.split('#')[0];
      const fallbackLocator = !found && row.source.includes('#') ? ` \`${row.source.split('#')[1]}\`` : '';
      const sigCell = described.signature ? codeSpan(formatCodeText(described.signature)) : '—';
      const descCell = described.description ? formatPlainCell(described.description) : '—';
      const cells = [
        `\`${row.name}\``,
        sigCell,
        descCell,
        ...(withClassification ? [row.classification] : []),
        linkedSource(sourcePath, fallbackLocator),
      ];
      return tableRow(cells);
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${tableHeader(columns)}\n${body}\n`;
}

// ---------------------------------------------------------------------------------------------
// Token groups — resolved values, not just a group name (#474 M3).
// ---------------------------------------------------------------------------------------------

const MAX_INLINE_TOKEN_ENTRIES = 16;

function tokenPublicName(rawName, token) {
  return token?.$extensions?.['com.beeui']?.publicName ?? rawName;
}

function formatScalar(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => (entry && typeof entry === 'object' ? JSON.stringify(entry) : String(entry))).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    if (typeof value.value === 'number' && typeof value.unit === 'string') return `${value.value}${value.unit}`;
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

// Renders one token's display value. Composite DTCG types (shadow's multi-layer `elevation`
// values, in this token set) already carry a precomputed, human-readable CSS string in
// `$extensions.com.beeui.cssValue` — generated by the same pipeline that turns tokens.json into
// theme.css (scripts/generate-tokens.mjs) — so that is used verbatim instead of re-deriving a
// less legible rendering of the raw nested DTCG shadow object.
export function formatTokenValue(token) {
  const cssValue = token?.$extensions?.['com.beeui']?.cssValue;
  if (typeof cssValue === 'string') return cssValue;
  return formatScalar(token?.$value);
}

// Takes the already-loaded `tokens.json#tokens.<group>` object and returns
// `[publicName, token][]`, sorted by name — pure, so tests can hand it a synthetic group
// without reading packages/tokens/tokens.json.
export function tokenGroupEntries(group) {
  if (!group || typeof group !== 'object') return [];
  return Object.entries(group)
    .filter(([key]) => !key.startsWith('$'))
    .map(([key, token]) => [tokenPublicName(key, token), token])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function renderTokenGroupSection(heading, rows, rootDir) {
  const doc = readJson(TOKENS_SOURCE_PATH, rootDir);
  const columns = ['Group', 'Values', 'Source'];
  const body = rows
    .map((row) => {
      const entries = tokenGroupEntries(doc.tokens?.[row.name]);
      const locator = row.source.includes('#') ? ` \`${row.source.split('#')[1]}\`` : '';
      const sourceCell = linkedSource(row.source.split('#')[0], locator);
      let valuesCell;
      if (entries.length === 0) {
        valuesCell = '—';
      } else if (entries.length > MAX_INLINE_TOKEN_ENTRIES) {
        valuesCell = `${entries.length} entries — see ${sourceCell}`;
      } else {
        valuesCell = entries.map(([key, token]) => `\`${key}\`: ${formatTokenValue(token)}`).join(', ');
      }
      return tableRow([`\`${row.name}\``, formatPlainCell(valuesCell, 500), sourceCell]);
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${tableHeader(columns)}\n${body}\n`;
}

// ---------------------------------------------------------------------------------------------
// CLI commands and flags — flags attached to the command(s) that accept them (#474 M3).
// ---------------------------------------------------------------------------------------------

// Sentinel command name for a flag/description that applies globally rather than to one
// specific command parsed out of an "X options:" section.
export const ANY_COMMAND = Symbol('any-command');

// Parses the CLI's own `HELP` template literal into structured commands/flags. Pure function of
// the source text, so tests drive it with a synthetic HELP block instead of the real CLI.
export function parseCliHelp(source) {
  const helpMatch = /const HELP = `([\s\S]*?)`;/u.exec(source);
  if (!helpMatch) throw new Error('no HELP template literal found');
  const commands = new Map();
  // flag -> Map(command -> description). A flag documented under more than one "X options:"
  // section (like `--dry-run` under both `Add options:` and `Update options:`) keeps each
  // command's own wording rather than one command's description silently winning.
  const flagsByCommand = new Map();
  let section = null;
  let optionsCommand = null;
  let current = null;

  for (const line of helpMatch[1].split('\n')) {
    const leading = line.match(/^ */u)[0].length;
    const trimmed = line.trim();
    if (!trimmed) {
      current = null;
      continue;
    }
    if (trimmed === 'Commands:') {
      section = 'commands';
      current = null;
      continue;
    }
    const optionsHeading = /^([A-Za-z]+) options:$/u.exec(trimmed);
    if (optionsHeading) {
      section = 'options';
      optionsCommand = optionsHeading[1].toLowerCase();
      current = null;
      continue;
    }
    if (leading === 0) {
      // Any other top-level heading ("Usage:", "Exit codes:", the closing paragraph) ends the
      // sections this parser understands.
      section = null;
      current = null;
      continue;
    }
    if (leading === 2 && section === 'commands') {
      const match = /^([a-z][a-z-]*)(?:\s+\S+)?\s{2,}(.*)$/u.exec(trimmed);
      if (match) {
        commands.set(match[1], match[2]);
        current = { map: commands, key: match[1] };
        continue;
      }
    }
    if (leading === 2 && section === 'options') {
      const match = /^(--[a-z][a-z-]*)\s{2,}(.*)$/u.exec(trimmed);
      if (match) {
        const [, flag, description] = match;
        if (!flagsByCommand.has(flag)) flagsByCommand.set(flag, new Map());
        flagsByCommand.get(flag).set(optionsCommand, description);
        current = { map: flagsByCommand.get(flag), key: optionsCommand };
        continue;
      }
    }
    if (leading > 2 && current) {
      current.map.set(current.key, `${current.map.get(current.key)} ${trimmed}`);
    }
  }

  // `--help`/`-h`/`--version`/`-v` are not listed under an "X options:" section — they are
  // aliases for the `help`/`version` commands, dispatched via `command === '<alias>'` checks in
  // main(). Deriving the alias groups from those checks (rather than hand-listing them here)
  // means a new alias added to the dispatcher is picked up without touching this file. `ANY_COMMAND`
  // marks a flag/description as applying globally rather than to one parsed "X options:" command.
  for (const match of source.matchAll(/if\s*\(((?:command === '[^']+'(?:\s*\|\|\s*)?)+)\)/gu)) {
    const names = [...match[1].matchAll(/command === '([^']+)'/gu)].map((entry) => entry[1]);
    if (names.length < 2) continue;
    const [primary, ...aliases] = names;
    const primaryDescription = commands.get(primary);
    if (!primaryDescription) continue;
    for (const alias of aliases) {
      if (!alias.startsWith('-')) continue;
      if (!flagsByCommand.has(alias)) flagsByCommand.set(alias, new Map());
      flagsByCommand.get(alias).set(ANY_COMMAND, primaryDescription);
    }
  }

  return { commands, flagsByCommand };
}

function resolveConfigFilename(text) {
  return text.replace(/\$\{CONFIG_FILENAME\}/gu, CONFIG_FILENAME);
}

function loadCliHelp(rootDir) {
  return parseCliHelp(readText(CLI_SOURCE_PATH, rootDir));
}

function cliSourceNote() {
  return `Derived from ${linkedSource(CLI_SOURCE_PATH)}.\n`;
}

function renderCliCommandSection(heading, rows, rootDir) {
  const { commands } = loadCliHelp(rootDir);
  const columns = ['Command', 'Description'];
  const body = rows
    .map((row) => {
      const description = commands.get(row.name);
      return tableRow([`\`${row.name}\``, description ? formatPlainCell(resolveConfigFilename(description)) : '—']);
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${cliSourceNote()}\n${tableHeader(columns)}\n${body}\n`;
}

function renderCliFlagSection(heading, rows, rootDir) {
  const { flagsByCommand } = loadCliHelp(rootDir);
  const columns = ['Flag', 'Applies to', 'Description'];
  const body = rows
    .map((row) => {
      const byCommand = flagsByCommand.get(row.name) ?? new Map();
      const commandNames = [...byCommand.keys()].filter((key) => key !== ANY_COMMAND).sort((a, b) => a.localeCompare(b));
      const appliesCell = byCommand.has(ANY_COMMAND) || commandNames.length === 0
        ? 'any command'
        : commandNames.map((name) => `\`${name}\``).join(', ');
      const descriptions = [...new Set(byCommand.values())];
      let descriptionCell;
      if (descriptions.length === 0) {
        descriptionCell = '—';
      } else if (descriptions.length === 1) {
        descriptionCell = formatPlainCell(resolveConfigFilename(descriptions[0]));
      } else {
        // The same flag documented with different wording per command (e.g. `--dry-run` under
        // both `Add options:` and `Update options:`) keeps every command's own wording instead
        // of silently picking whichever section happened to parse last.
        descriptionCell = commandNames
          .map((name) => `**${name}**: ${formatPlainCell(resolveConfigFilename(byCommand.get(name)))}`)
          .join(' ');
      }
      return tableRow([`\`${row.name}\``, appliesCell, descriptionCell]);
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${tableHeader(columns)}\n${body}\n`;
}

// ---------------------------------------------------------------------------------------------
// Registry items — files, registry dependencies and peer dependencies (#474 M3).
// ---------------------------------------------------------------------------------------------

function renderRegistrySection(heading, rows, rootDir) {
  const registry = readJson(REGISTRY_SOURCE_PATH, rootDir);
  const byName = new Map(registry.items.map((item) => [item.name, item]));
  const withClassification = classificationVaries(rows);
  const columns = ['Name', 'Files', 'Registry dependencies', 'Peer dependencies', ...(withClassification ? ['Classification'] : [])];
  const body = rows
    .map((row) => {
      const item = byName.get(row.name);
      const files = item?.files?.length
        ? item.files.map((file) => linkedSource(file.source)).join(', ')
        : '—';
      const dependencies = item?.registryDependencies?.length
        ? item.registryDependencies.map((name) => `\`${name}\``).join(', ')
        : '—';
      const peers =
        item?.peerDependencies && Object.keys(item.peerDependencies).length
          ? Object.entries(item.peerDependencies)
              .map(([name, range]) => `\`${name}@${range}\``)
              .join(', ')
          : '—';
      const cells = [`\`${row.name}\``, files, dependencies, peers, ...(withClassification ? [row.classification] : [])];
      return tableRow(cells);
    })
    .join('\n');
  return `## ${heading} (${rows.length})\n\n${tableHeader(columns)}\n${body}\n`;
}

// ---------------------------------------------------------------------------------------------
// Page assembly.
// ---------------------------------------------------------------------------------------------

export function renderReferencePage(owner, content, rootDir = ROOT_DIR) {
  const entry = content.owners[owner.slug];
  const sections = KIND_SECTIONS.flatMap(([kind, heading, render]) => {
    const rows = owner.rows.filter((row) => row.kind === kind);
    return rows.length ? [render(heading, rows, rootDir)] : [];
  });

  const notes = entry.notes ? `\n${entry.notes}\n` : '';
  return [
    '---',
    `title: ${entry.title}`,
    `description: ${entry.description}`,
    '---',
    '',
    GENERATED_MARKER,
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
    fs.writeFileSync(path.join(outDir, `${owner.slug}.md`), renderReferencePage(owner, content, rootDir));
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
      return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== renderReferencePage(owner, content, ROOT_DIR);
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
