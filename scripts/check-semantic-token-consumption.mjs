#!/usr/bin/env node
//
// Semantic-token consumption guard (issue #83).
//
// BeeUI's design rule says reusable component source consumes public semantic tokens —
// never raw color literals, private authoring primitives, unsupported raw CSS-variable
// access, or brand-specific literals/branches. Before this guard that rule was only
// documentation (docs/theming.md, docs/theme-authoring-primitives.md). This script makes
// it mechanically enforceable for `packages/ui/src/**`.
//
// Classification is derived from the canonical/generated token metadata every run:
//   - public semantic color names: `com.beeui.semanticColorDescriptions` in
//     packages/tokens/tokens.json (the same source that generates `semanticColorTokens`
//     in packages/tokens/src/index.ts);
//   - private authoring-primitive identifiers: `com.beeui.privateTokenGroups` (currently
//     `primitives`) in the same document, flattened by
//     `privatePrimitiveIdentifiers()` in scripts/generate-tokens.mjs;
//   - brand names: `com.beeui.brandNames`;
//   - runtime-readable CSS-variable namespaces (`--color-`, `--chart-`, `--radius-`,
//     `--motion-duration-`): `readableTokenNamespaces()` in scripts/generate-tokens.mjs,
//     the same canonical `runtimeOverridable` flags (plus the two always-present color
//     categories) that build `beeTokenReaderCategories`/`useBeeToken`/`getBeeToken` (#72)
//     in packages/tokens/src/index.ts. A raw `var(--...)` or a direct
//     `useCSSVariable`/`Uniwind.getCSSVariable` call against any of these namespaces
//     bypasses that typed reader and is flagged, except in the one sanctioned
//     implementation file itself (see `TYPED_READER_IMPLEMENTATION_RELATIVE_PATH` below).
// There is no second hand-maintained token list anywhere in this file.
//
// See docs/token-consumption-guard.md for the contributor-facing rules and the
// exception syntax.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  brandNames,
  loadCanonicalTokens,
  privatePrimitiveIdentifiers,
  readableTokenNamespaces,
  semanticNames,
} from './generate-tokens.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Primary scope per issue #83: `packages/ui/src/**` is BeeUI's reusable component
// library. Nothing else in the monorepo is scanned — `apps/showcase/patterns/**` is
// product-specific Pattern Gallery content (explicitly out of scope), and
// `packages/core`/`packages/tokens` are not component styling surfaces.
export const DEFAULT_INCLUDE_ROOTS = ['packages/ui/src'];

// The one sanctioned call site for Uniwind's raw CSS-variable read APIs
// (`useCSSVariable`/`Uniwind.getCSSVariable`) — BeeUI's #72 typed-reader adapter itself.
// Every other file in scope must go through `useBeeToken`/`getBeeToken` instead of calling
// these directly, so the `typed-reader-bypass-call` rule exempts exactly this file path and
// nothing broader (no directory-level ignore — see module docs above).
export const TYPED_READER_IMPLEMENTATION_RELATIVE_PATH = 'packages/ui/src/components/use-bee-token.ts';

export function isTypedReaderImplementationFile(relativePath) {
  return relativePath.split(path.sep).join('/') === TYPED_READER_IMPLEMENTATION_RELATIVE_PATH;
}

const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.d\.ts$/;
const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__mocks__']);
const EXCLUDED_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.stories.ts', '.stories.tsx'];

const UTILITY_COLOR_PREFIXES =
  '(?:bg|text|border|ring|fill|stroke|outline|shadow|from|via|to|divide|accent|caret|decoration|placeholder)';

// Tailwind's own numeric palette scale (50, 100, 200 ... 950). BeeUI's public semantic
// color tokens never end in a bare numeric shade (they end in words like `-foreground`,
// `-hover`, `-pressed`), so any `<prefix>-<word>-<shade>` utility is guaranteed to be
// either Tailwind's built-in default palette or one of BeeUI's own private numeric-shade
// primitives (packages/tokens/tokens.json primitives.neutral/amber/violet) — never a
// public semantic token. This pattern needs no hand-maintained color-family list.
const PALETTE_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

export const EXCEPTION_MARKER = 'beeui-token-guard-allow';
export const MIN_EXCEPTION_RATIONALE_LENGTH = 12;
const EXCEPTION_PATTERN = new RegExp(`//\\s*${EXCEPTION_MARKER}:\\s*(.*)$`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the deterministic rule set from canonical token metadata. Each rule owns a
 * global, single-line regex plus a message/remediation renderer; `scanLine` runs every
 * rule against every non-comment line of a source file.
 */
export function buildGuardRules(source) {
  const publicNames = new Set(semanticNames(source));
  const { identifiers: privateIdentifiers } = privatePrimitiveIdentifiers(source);
  const brands = brandNames(source);

  // Every CSS custom-property namespace with a typed BeeUI runtime reader (#72
  // `useBeeToken`/`getBeeToken`) — currently `--color-`, `--chart-`, `--radius-`,
  // `--motion-duration-`. Derived from the same canonical/generated metadata that builds
  // `beeTokenReaderCategories` in packages/tokens/src/index.ts (see
  // `readableTokenNamespaces()` in generate-tokens.mjs) — no second hand-maintained list.
  const readableNamespaces = readableTokenNamespaces(source);
  const readablePrefixAlternation = readableNamespaces.map((namespace) => escapeRegExp(namespace.variablePrefix)).join('|');

  function readableNamespaceForMatch(matchText) {
    return readableNamespaces.find((namespace) => matchText.includes(namespace.variablePrefix));
  }

  const rules = [
    {
      id: 'raw-hex-color',
      regex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g,
      message: (match) =>
        `raw hex color literal "${match}". Use a public semantic color token (a Tailwind ` +
        'utility such as `bg-primary`/`text-foreground`) instead of a hard-coded hex value. ' +
        'If no existing semantic token fits, add one to packages/tokens/tokens.json rather ' +
        'than hard-coding a color here.',
    },
    {
      id: 'raw-rgb-hsl-color',
      regex: /\b(?:rgba?|hsla?)\s*\(/g,
      message: (match) =>
        `raw color function "${match.replace(/\s*\($/, '(')}". Reusable styling must consume ` +
        'a public semantic color token, not a raw rgb()/rgba()/hsl()/hsla() literal.',
    },
    {
      // Covers every runtime-readable namespace, not just colors: `var(--color-*)`,
      // `var(--chart-*)`, `var(--radius-*)`, `var(--motion-duration-*)`. A #72 typed reader
      // path exists for each of these — see `readableNamespaces` above — so raw
      // `var(--...)` access to any of them is redundant and untyped. A `var(--...)` access
      // to a namespace with NO typed reader (e.g. `--layer-*`, `--z-*`) never matches this
      // rule; only namespaces present in `readableNamespaces` do.
      id: 'raw-css-variable-access',
      regex: new RegExp(`var\\(\\s*(?:${readablePrefixAlternation})[a-zA-Z0-9-]+`, 'g'),
      message: (match) => {
        const namespace = readableNamespaceForMatch(match);
        const category = namespace ? namespace.readerCategory : undefined;
        const helperName = namespace ? namespace.helperName : undefined;
        const readerGuidance = category
          ? `use \`useBeeToken('${category}.<key>')\`/\`getBeeToken('${category}.<key>')\` from @beeui/ui`
          : 'use the typed BeeUI runtime-token reader (useBeeToken/getBeeToken) from @beeui/ui';
        const utilityGuidance = category === 'colors' ? ', the generated Tailwind semantic utility class,' : '';
        const helperGuidance = helperName
          ? ` or the \`${helperName}()\` helper from @beeui/tokens if you need the variable name as a string`
          : '';
        return (
          `unsupported raw CSS custom-property access "${match}". A typed BeeUI path already ` +
          `exists: ${readerGuidance}${utilityGuidance}${helperGuidance}.`
        );
      },
    },
    {
      // The `useBeeToken`/`getBeeToken` adapters exist specifically so component source
      // never calls Uniwind's raw CSS-variable read APIs directly for a readable
      // namespace. Calling `useCSSVariable('--color-primary')` or
      // `Uniwind.getCSSVariable('--radius-md')` with a string-literal readable-namespace
      // variable name bypasses that typed path exactly the way `var(--color-*)` does —
      // this rule catches the call-based bypass the `raw-css-variable-access` rule above
      // cannot see. The one sanctioned exception — `use-bee-token.ts` itself, which
      // legitimately calls these APIs to implement the adapters — is exempted by exact
      // file path in `runTokenConsumptionGuard`, not by this rule or a directory ignore.
      id: 'typed-reader-bypass-call',
      regex: new RegExp(
        `\\b(?:useCSSVariable|Uniwind\\.getCSSVariable)\\(\\s*(['"\`])(?:${readablePrefixAlternation})[a-zA-Z0-9-]*\\1`,
        'g',
      ),
      message: (match) => {
        const namespace = readableNamespaceForMatch(match);
        const category = namespace ? namespace.readerCategory : '<category>';
        return (
          `"${match}" calls Uniwind's raw CSS-variable read API directly with a readable-namespace ` +
          "variable name, bypassing BeeUI's typed reader. Use " +
          `\`useBeeToken('${category}.<key>')\` (inside a hook/component) or ` +
          `\`getBeeToken('${category}.<key>')\` (imperative, global-theme-only) from ` +
          '@beeui/ui instead — see packages/ui/src/components/use-bee-token.ts and ' +
          'docs/token-consumption-guard.md.'
        );
      },
    },
  ];

  if (privateIdentifiers.length > 0) {
    // Sort longest-first: JS regex alternation is first-match-wins, and with `\b` following
    // the group, a shorter identifier that is a prefix of a longer one (e.g. `neutral`
    // before `neutral-500`) would win the match and truncate the reported text to
    // "bg-neutral" instead of the full "bg-neutral-500". Detection is unaffected either way
    // (both are private), but the reported match/message must show the real identifier.
    const alternation = [...privateIdentifiers]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|');
    rules.push({
      id: 'private-primitive-utility',
      regex: new RegExp(`\\b${UTILITY_COLOR_PREFIXES}-(?:${alternation})\\b`, 'g'),
      message: (match) =>
        `"${match}" consumes a private authoring primitive (packages/tokens/tokens.json ` +
        '#/primitives) directly. Reusable component source may only consume public semantic ' +
        'tokens — see docs/theme-authoring-primitives.md. If this value should be reusable, ' +
        'alias it from a semantic token in tokens.json instead of referencing the primitive here.',
    });
  }

  rules.push(
    {
      id: 'private-primitive-pointer',
      regex: /#\/primitives\/|\bprimitives\.[a-z]/g,
      message: (match) =>
        `"${match}" references the private primitives layer directly. Only ` +
        'packages/tokens/tokens.json semantic-token `$ref`s may point at #/primitives; ' +
        'reusable component source consumes semantic tokens, never a primitives pointer.',
    },
    {
      id: 'palette-scale-utility',
      regex: new RegExp(`\\b${UTILITY_COLOR_PREFIXES}-[a-z]+-(?:${PALETTE_SHADES.join('|')})\\b`, 'g'),
      message: (match) =>
        `"${match}" references a raw numbered color-scale utility (Tailwind's built-in ` +
        'default palette or a BeeUI authoring primitive). No BeeUI public semantic color ' +
        'token uses a bare numeric shade — use a semantic utility such as `bg-muted` or ' +
        '`border-border-strong` instead.',
    },
  );

  if (brands.length > 0) {
    const brandAlternation = brands.map(escapeRegExp).join('|');
    const quote = `['"\`]`;
    const equalityBranch =
      `(?:===|!==|==|!=)\\s*${quote}(?:${brandAlternation})${quote}` +
      `|${quote}(?:${brandAlternation})${quote}\\s*(?:===|!==|==|!=)`;
    // `switch (brand) { case 'violet': ... }` bypasses semantic mapping the same way an
    // equality comparison does, but no `===`/`==` token appears on the `case` line itself —
    // catch it as its own alternative, keyed on the `case` keyword plus a brand-name literal.
    const switchCaseBranch = `\\bcase\\s+${quote}(?:${brandAlternation})${quote}\\s*:`;
    rules.push({
      id: 'brand-literal-branch',
      regex: new RegExp(`${equalityBranch}|${switchCaseBranch}`, 'g'),
      message: (match) =>
        `"${match}" branches on a brand-name literal. Reusable components stay brand-blind ` +
        '(docs/theming.md) — consume semantic tokens/props instead of comparing against a ' +
        'brand name here. Brand-specific values belong in the canonical theme, not in component logic.',
    });
  }

  // publicNames is intentionally unused for exclusion here: none of the above patterns can
  // ever match a valid public semantic name (they all key on private/raw shapes), so no
  // additional allow-list filtering is needed. It is retained on the return value so
  // callers/tests can assert classification without re-deriving it.
  return { rules, publicNames, privateIdentifiers, brands };
}

function isFullLineComment(trimmedLine) {
  return trimmedLine.startsWith('//') || (trimmedLine.startsWith('*') && !trimmedLine.startsWith('*/'));
}

/**
 * Split a line into its code portion and its trailing `//` line-comment portion, tracking
 * string/template-literal state so a `//` inside a string (e.g. a URL) is not mistaken for
 * a comment start. Rules only scan `code`; the exception marker is read from `comment`.
 */
function splitLineCodeAndComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '/' && line[index + 1] === '/') {
      return { code: line.slice(0, index), comment: line.slice(index) };
    }
  }
  return { code: line, comment: '' };
}

/**
 * Scan already-loaded source text for guard violations. Exposed standalone (no filesystem
 * access) so fixture tests can exercise every rule against synthetic snippets.
 */
export function scanSourceText(fileLabel, text, rules) {
  const violations = [];
  const lines = text.split('\n');
  let inBlockComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const lineNumber = index + 1;

    const startedInBlockComment = inBlockComment;
    if (trimmed.includes('/*') && !trimmed.includes('*/')) inBlockComment = true;
    if (trimmed.includes('*/')) inBlockComment = false;
    if (startedInBlockComment || isFullLineComment(trimmed)) continue;

    const { code, comment } = splitLineCodeAndComment(line);

    const exceptionMatch = EXCEPTION_PATTERN.exec(comment);
    EXCEPTION_PATTERN.lastIndex = 0;
    const rationale = exceptionMatch ? exceptionMatch[1].trim() : undefined;
    const hasException = exceptionMatch !== null;
    const exceptionValid = hasException && rationale.length >= MIN_EXCEPTION_RATIONALE_LENGTH;

    if (hasException && !exceptionValid) {
      violations.push({
        file: fileLabel,
        line: lineNumber,
        column: code.length + exceptionMatch.index + 1,
        ruleId: 'blank-exception-rationale',
        match: exceptionMatch[0].trim(),
        message:
          `"${EXCEPTION_MARKER}:" exception comment is missing a rationale (needs at least ` +
          `${MIN_EXCEPTION_RATIONALE_LENGTH} characters explaining why this line is exempt). ` +
          'A bare marker with no explanation does not suppress the guard.',
      });
    }

    const seenColumns = new Set();
    for (const rule of rules) {
      rule.regex.lastIndex = 0;
      let match;
      // eslint-disable-next-line no-cond-assign -- intentional regex exec loop
      while ((match = rule.regex.exec(code)) !== null) {
        const column = match.index + 1;
        if (seenColumns.has(column)) {
          if (rule.regex.lastIndex === match.index) rule.regex.lastIndex += 1;
          continue;
        }
        seenColumns.add(column);

        if (!exceptionValid) {
          violations.push({
            file: fileLabel,
            line: lineNumber,
            column,
            ruleId: rule.id,
            match: match[0],
            message: rule.message(match[0]),
          });
        }

        if (rule.regex.lastIndex === match.index) rule.regex.lastIndex += 1;
      }
    }
  }

  return violations;
}

export function collectComponentSourceFiles(rootDir, includeRoots = DEFAULT_INCLUDE_ROOTS) {
  const files = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SOURCE_FILE_PATTERN.test(entry.name)) continue;
      if (EXCLUDED_FILE_PATTERN.test(entry.name)) continue;
      if (EXCLUDED_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue;
      files.push(full);
    }
  };

  for (const includeRoot of includeRoots) walk(path.join(rootDir, includeRoot));
  return files.sort();
}

export function runTokenConsumptionGuard({
  rootDir = ROOT_DIR,
  source = loadCanonicalTokens(path.join(ROOT_DIR, 'packages/tokens/tokens.json')),
  includeRoots = DEFAULT_INCLUDE_ROOTS,
} = {}) {
  const { rules } = buildGuardRules(source);
  const rulesWithoutTypedReaderBypass = rules.filter((rule) => rule.id !== 'typed-reader-bypass-call');
  const files = collectComponentSourceFiles(rootDir, includeRoots);
  const violations = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(rootDir, file);
    // The `typed-reader-bypass-call` rule exists to keep every OTHER file honest about
    // going through `useBeeToken`/`getBeeToken`; the adapter implementation itself is
    // exempted here by exact relative file path (see the constant's own docs above) —
    // never by a broad directory ignore.
    const applicableRules = isTypedReaderImplementationFile(relative) ? rulesWithoutTypedReaderBypass : rules;
    violations.push(...scanSourceText(relative, text, applicableRules));
  }

  return { violations, filesScanned: files.length };
}

function formatViolation(violation) {
  return `${violation.file}:${violation.line}:${violation.column} [${violation.ruleId}] ${violation.message}`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const { violations, filesScanned } = runTokenConsumptionGuard();
  if (violations.length > 0) {
    console.error(`Semantic-token consumption guard failed (${filesScanned} files scanned):`);
    for (const violation of violations) console.error(`- ${formatViolation(violation)}`);
    console.error(
      `\nTo document a narrow, reviewed exception, add "// ${EXCEPTION_MARKER}: <reason>" on the ` +
        `offending line with a real rationale (>= ${MIN_EXCEPTION_RATIONALE_LENGTH} characters). ` +
        'See docs/token-consumption-guard.md.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Semantic-token consumption guard passed (${filesScanned} files scanned, 0 violations).`);
  }
}
