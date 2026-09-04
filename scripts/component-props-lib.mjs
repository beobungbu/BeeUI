#!/usr/bin/env node

// Derives real props tables for the public component reference (WBS-G061 B1) by
// parsing packages/ui/src/**/*.{ts,tsx} with the TypeScript compiler API — never
// with regexes, and never by hand-authoring a second source of truth. Every
// `*Props` type exported from `packages/ui/src/index.ts` must resolve to a real
// field list here; a shape this module cannot parse is a bug in the parser (or a
// genuinely out-of-scope shape that must be called out explicitly), never a
// silently empty table.
//
// Vocabulary:
//   - "object" shape: a flat field list plus the named external bases it also
//     carries (e.g. `Omit<ViewProps, 'children'>`) — those bases are cited, not
//     expanded, because they come from React/React Native, not from BeeUI.
//   - "union" shape: a `SomeProps = A | B` variant split (BeeUI's own
//     controlled/uncontrolled pattern) — each variant is itself resolved to an
//     "object" (or nested "union") shape.
//   - "literal-union": `type X = 'a' | 'b'` — rendered as its member list.
//   - "alias": any other named type this module intentionally does not expand
//     (e.g. `NonNullable<ScrollViewProps['keyboardDismissMode']>`) — printed
//     verbatim, never guessed at.
//
// A type reference that is itself declared locally (in the same file, or
// anywhere else under packages/ui/src, with no generic type arguments) is
// "embedded" — its fields are flattened in, because it is BeeUI's own
// composition detail (e.g. `TableColumnPositionProps`, `DialogBaseProps`), not
// an upstream contract worth citing separately. A reference this module cannot
// resolve locally, or that carries generic type arguments (e.g. `Omit<ViewProps,
// 'children'>`, `VariantProps<typeof badgeVariants>`), is cited as an external
// base/alias instead of expanded.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { ROOT_DIR } from './component-docs-lib.mjs';

const COMPONENTS_DIR = 'packages/ui/src/components';

// --- AST plumbing ------------------------------------------------------------

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function isExportedDeclaration(node) {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return Boolean(modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function scriptKindFor(filePath) {
  return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

// Common mid-sentence abbreviations ("e.g.", "i.e.", "etc.") would otherwise
// look like a sentence boundary to the naive regex below, truncating
// descriptions such as table.tsx's `colSpan` JSDoc mid-clause.
const ABBREVIATION_DOT_PLACEHOLDER = '\u0000';

function firstSentence(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const guarded = clean.replace(/\b(e\.g|i\.e|etc)\./gi, (match) => match.replace(/\.$/, ABBREVIATION_DOT_PLACEHOLDER));
  const match = guarded.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : guarded).trim().replaceAll(ABBREVIATION_DOT_PLACEHOLDER, '.');
}

// JSDoc immediately preceding a node: first-sentence description, plus whether
// it carries `@internal` (that member is not part of the public API and must
// never reach a generated table).
function getJsDocDescription(node) {
  let description = '';
  let internal = false;
  for (const doc of ts.getJSDocCommentsAndTags(node)) {
    if (ts.isJSDoc(doc)) {
      if (doc.comment && !description) {
        description = firstSentence(ts.getTextOfJSDocComment(doc.comment) ?? '');
      }
      for (const tag of doc.tags ?? []) {
        if (tag.tagName.text === 'internal') internal = true;
      }
    } else if (ts.isJSDocTag(doc) && doc.tagName.text === 'internal') {
      internal = true;
    }
  }
  return { description, internal };
}

// --- Type index (parse once, resolve by name across the family/whole tree) --

// Builds a per-file declaration table plus a global (exported-only) name index
// across every supplied source file. `files` is `[{ path, source }]` with
// repo-relative `path`s, so the same index format works for real disk reads
// and for synthetic test fixtures.
export function buildTypeIndex(files) {
  const perFile = new Map();
  const globalByName = new Map();

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
    const declarations = new Map();
    walk(sourceFile, (node) => {
      if ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
        declarations.set(node.name.text, node);
      }
    });
    perFile.set(filePath, { sourceFile, declarations });
    for (const [name, node] of declarations) {
      if (!isExportedDeclaration(node)) continue;
      if (!globalByName.has(name)) globalByName.set(name, []);
      globalByName.get(name).push({ path: filePath, node });
    }
  }

  return { perFile, globalByName };
}

// Resolves a type name to its declaration. Same-file (possibly non-exported)
// declarations win first — this is how a component's own private
// `FooControlledProps`/`FooUncontrolledProps` split resolves. Otherwise falls
// back to the exported-only global index; a name declared in more than one
// file (platform-split families redeclaring the same `*Props` name per
// platform, e.g. `table.tsx` vs `table.web.tsx`) prefers the family's primary
// source file, then any other file of that family, and only throws if the
// caller gave no family context to disambiguate with.
export function resolveDeclaration(index, name, opts = {}) {
  const { fromPath, familyPaths = [], primaryPath } = opts;
  if (fromPath) {
    const local = index.perFile.get(fromPath)?.declarations.get(name);
    if (local) return { path: fromPath, node: local };
  }
  const candidates = index.globalByName.get(name);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const primary = candidates.find((candidate) => candidate.path === primaryPath);
  if (primary) return primary;
  const inFamily = candidates.filter((candidate) => familyPaths.includes(candidate.path));
  if (inFamily.length === 1) return inFamily[0];
  throw new Error(
    `ambiguous type "${name}": declared in multiple files with no family context to disambiguate ` +
      `(${candidates.map((candidate) => candidate.path).join(', ')})`,
  );
}

// --- Field/shape extraction ---------------------------------------------------

// Extracts PropertySignature members of a TypeLiteralNode/InterfaceDeclaration
// body. `@internal` members are dropped entirely — they are explicitly not
// public API and must never surface in a generated table.
function extractFields(container, sourceFile) {
  const fields = [];
  for (const member of container.members) {
    if (!ts.isPropertySignature(member) || !member.name) continue;
    const { description, internal } = getJsDocDescription(member);
    if (internal) continue;
    fields.push({
      name: member.name.getText(sourceFile),
      optional: Boolean(member.questionToken),
      type: member.type ? member.type.getText(sourceFile) : 'unknown',
      description,
    });
  }
  return fields;
}

// Attempts to treat a (no-type-argument) type reference / heritage clause
// entry as a locally-declared, BeeUI-owned composition detail to flatten in.
// Returns null if the name does not resolve locally (RN/React/library types,
// or anything carrying generic type arguments) — those are cited as external
// bases instead, never expanded.
function tryEmbed(node, sourceFile, ctx) {
  if (node.typeArguments) return null;
  const name = ts.isExpressionWithTypeArguments(node)
    ? node.expression.getText(sourceFile)
    : node.typeName.getText(sourceFile);
  if (!resolveDeclaration(ctx.index, name, ctx.resolveOpts)) return null;
  const shape = resolveNamedTypeShape(name, ctx);
  if (shape.kind !== 'object') {
    throw new Error(`${ctx.errorLabel}: cannot flatten non-object type "${name}" into an intersection/heritage member`);
  }
  return shape;
}

function resolveHeritageBases(node, sourceFile, ctx) {
  const bases = [];
  const fields = [];
  for (const clause of node.heritageClauses ?? []) {
    for (const type of clause.types) {
      const embedded = tryEmbed(type, sourceFile, ctx);
      if (embedded) {
        bases.push(...embedded.bases);
        fields.push(...embedded.fields);
      } else {
        bases.push(type.getText(sourceFile));
      }
    }
  }
  return { bases, fields };
}

// Resolves a type AST node (the right-hand side of a `type X = ...`) to a
// normalized shape. Throws for any shape it does not recognize — a `*Props`
// type this cannot parse must fail generation loudly, never publish an empty
// table.
function resolveTypeNodeToShape(typeNode, sourceFile, ctx) {
  if (ts.isParenthesizedTypeNode(typeNode)) return resolveTypeNodeToShape(typeNode.type, sourceFile, ctx);

  if (ts.isTypeLiteralNode(typeNode)) {
    return { kind: 'object', bases: [], fields: extractFields(typeNode, sourceFile) };
  }

  if (ts.isIntersectionTypeNode(typeNode)) {
    const bases = [];
    const fields = [];
    for (const member of typeNode.types) {
      if (ts.isTypeLiteralNode(member)) {
        fields.push(...extractFields(member, sourceFile));
        continue;
      }
      const embedded = ts.isTypeReferenceNode(member) ? tryEmbed(member, sourceFile, ctx) : null;
      if (embedded) {
        bases.push(...embedded.bases);
        fields.push(...embedded.fields);
      } else {
        bases.push(member.getText(sourceFile));
      }
    }
    return { kind: 'object', bases, fields };
  }

  if (ts.isUnionTypeNode(typeNode)) {
    const isLiteralUnion = typeNode.types.every((member) => ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal));
    if (isLiteralUnion) {
      return { kind: 'literal-union', members: typeNode.types.map((member) => member.literal.text) };
    }
    const variants = typeNode.types.map((member) => {
      if (!ts.isTypeReferenceNode(member) || member.typeArguments) {
        throw new Error(
          `${ctx.errorLabel}: union member "${member.getText(sourceFile)}" is not a resolvable named type — ` +
            'refusing to guess at its shape',
        );
      }
      const name = member.typeName.getText(sourceFile);
      return { name, ...resolveNamedTypeShape(name, ctx) };
    });
    return { kind: 'union', variants };
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText(sourceFile);
    // A bare, no-type-argument reference that resolves locally is a genuine
    // alias of another BeeUI Props type (e.g. `AlertDialogProps = DialogProps`)
    // — recurse into it and say so. Anything else (generic instantiations like
    // `Omit<TextProps, 'tone' | 'variant'>`, or a name this module cannot find
    // under packages/ui/src) is an external contract with zero BeeUI-added
    // fields: cite it as the sole base rather than guessing at its shape.
    if (!typeNode.typeArguments && resolveDeclaration(ctx.index, name, ctx.resolveOpts)) {
      const shape = resolveNamedTypeShape(name, ctx);
      return { ...shape, aliasOf: name };
    }
    return { kind: 'object', bases: [typeNode.getText(sourceFile)], fields: [] };
  }

  throw new Error(`${ctx.errorLabel}: unsupported type shape "${typeNode.getText(sourceFile)}" — refusing to guess at its fields`);
}

// Resolves any named type (Props or otherwise) declared in the index to a
// normalized shape. `ctx.names` accumulates every name touched along the way,
// so default-value extraction can search for a destructured parameter typed
// with any of them (a plain function often destructures the union name
// itself, e.g. `DialogProps`, even though its fields live in private
// `DialogControlledProps`/`DialogUncontrolledProps` variants).
function resolveNamedTypeShape(name, ctx) {
  ctx.names.add(name);
  const resolved = resolveDeclaration(ctx.index, name, ctx.resolveOpts);
  if (!resolved) throw new Error(`${ctx.errorLabel}: could not resolve type "${name}" within packages/ui/src`);
  const sourceFile = ctx.index.perFile.get(resolved.path).sourceFile;
  const nestedCtx = { ...ctx, resolveOpts: { ...ctx.resolveOpts, fromPath: resolved.path } };

  if (ts.isInterfaceDeclaration(resolved.node)) {
    const { bases, fields: embeddedFields } = resolveHeritageBases(resolved.node, sourceFile, nestedCtx);
    return { kind: 'object', bases, fields: [...embeddedFields, ...extractFields(resolved.node, sourceFile)] };
  }
  if (ts.isTypeAliasDeclaration(resolved.node)) {
    return resolveTypeNodeToShape(resolved.node.type, sourceFile, nestedCtx);
  }
  throw new Error(`${ctx.errorLabel}: "${name}" is neither an interface nor a type alias`);
}

// --- Default-value extraction -------------------------------------------------

function getBareTypeReferenceName(typeNode) {
  if (typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) return typeNode.typeName.text;
  return undefined;
}

function collectDefaultsFromBindingPattern(pattern, sourceFile, defaults) {
  for (const element of pattern.elements) {
    if (!ts.isBindingElement(element) || !element.initializer || !ts.isIdentifier(element.name)) continue;
    if (!defaults.has(element.name.text)) {
      defaults.set(element.name.text, element.initializer.getText(sourceFile));
    }
  }
}

// Finds destructured default values (`layout = 'scroll'`) for any of
// `candidateNames`, across the given files. Handles both
// `React.forwardRef<T, XProps>(({ a, b = 1 }, ref) => ...)` (default read
// straight off the render function's first parameter) and a plain function
// whose typed parameter is destructured inside the body
// (`function Dialog(props: DialogProps) { const { defaultOpen = false } =
// props; }`). Returns an empty map — never a guess — when nothing matches.
export function extractDefaults(files, candidateNames) {
  const defaults = new Map();

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));

    walk(sourceFile, (node) => {
      if (ts.isCallExpression(node) && node.typeArguments?.length === 2 && /forwardRef$/.test(node.expression.getText(sourceFile))) {
        const propsArgName = getBareTypeReferenceName(node.typeArguments[1]);
        if (propsArgName && candidateNames.has(propsArgName)) {
          const renderFn = node.arguments[0];
          const param = (ts.isArrowFunction(renderFn) || ts.isFunctionExpression(renderFn)) ? renderFn.parameters[0] : undefined;
          if (param && ts.isObjectBindingPattern(param.name)) {
            collectDefaultsFromBindingPattern(param.name, sourceFile, defaults);
          }
        }
      }

      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        const param = node.parameters[0];
        const typeName = param ? getBareTypeReferenceName(param.type) : undefined;
        if (!typeName || !candidateNames.has(typeName)) return;
        if (ts.isObjectBindingPattern(param.name)) {
          collectDefaultsFromBindingPattern(param.name, sourceFile, defaults);
        } else if (ts.isIdentifier(param.name) && node.body && ts.isBlock(node.body)) {
          walk(node.body, (inner) => {
            if (!ts.isVariableStatement(inner)) return;
            for (const declaration of inner.declarationList.declarations) {
              if (
                ts.isObjectBindingPattern(declaration.name) &&
                declaration.initializer &&
                ts.isIdentifier(declaration.initializer) &&
                declaration.initializer.text === param.name.text
              ) {
                collectDefaultsFromBindingPattern(declaration.name, sourceFile, defaults);
              }
            }
          });
        }
      }
    });
  }

  return defaults;
}

function applyDefaults(shape, defaults) {
  if (shape.fields) {
    shape.fields = shape.fields.map((field) => (defaults.has(field.name) ? { ...field, default: defaults.get(field.name) } : field));
  }
  if (shape.variants) {
    for (const variant of shape.variants) applyDefaults(variant, defaults);
  }
}

// --- Public entry points -------------------------------------------------------

// Resolves one exported type name (as it appears in `component.types`) to a
// documentation entry: `kind: 'props'` for `*Props` types (fails loudly if the
// shape cannot be parsed), `kind: 'literal-union'` for `type X = 'a' | 'b'`,
// or `kind: 'alias'` for anything else this module deliberately does not
// expand further.
export function resolveComponentTypeEntry(index, name, opts = {}) {
  const resolved = resolveDeclaration(index, name, opts);
  if (!resolved) throw new Error(`${opts.errorLabel ?? name}: type "${name}" was not found under packages/ui/src`);
  const sourceFile = index.perFile.get(resolved.path).sourceFile;

  // `docKind` is the top-level classification the renderer/caller switches on
  // ('props' | 'literal-union' | 'alias'). For `*Props` types the resolved
  // shape is spread in afterwards, so its own `kind` ('object' | 'union')
  // describes the shape without colliding with `docKind`.
  if (/Props$/.test(name)) {
    const ctx = { index, errorLabel: opts.errorLabel ?? name, names: new Set([name]), resolveOpts: opts };
    const shape = resolveNamedTypeShape(name, ctx);
    return { name, docKind: 'props', ...shape, names: ctx.names };
  }

  const { description } = getJsDocDescription(resolved.node);
  if (ts.isInterfaceDeclaration(resolved.node)) {
    return { name, docKind: 'alias', kind: 'alias', aliasOf: '(interface)', description };
  }
  const typeNode = resolved.node.type;
  const isLiteralUnion = ts.isUnionTypeNode(typeNode) && typeNode.types.every((member) => ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal));
  if (isLiteralUnion) {
    return { name, docKind: 'literal-union', kind: 'literal-union', members: typeNode.types.map((member) => member.literal.text), description };
  }
  return { name, docKind: 'alias', kind: 'alias', aliasOf: typeNode.getText(sourceFile), description };
}

function readComponentSourceFiles(rootDir) {
  const dir = path.join(rootDir, COMPONENTS_DIR);
  return fs
    .readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
    .map((file) => ({
      path: `${COMPONENTS_DIR}/${file}`,
      source: fs.readFileSync(path.join(dir, file), 'utf8'),
    }));
}

const indexCache = new Map();

function getComponentsIndex(rootDir) {
  if (!indexCache.has(rootDir)) indexCache.set(rootDir, buildTypeIndex(readComponentSourceFiles(rootDir)));
  return indexCache.get(rootDir);
}

// Full derived-types model for one public component family, in the same
// (already-sorted) order as `component.types` from `getPublicComponents()`.
// This is the only function `public-component-reference.mjs` needs.
export function getComponentTypeDocs(component, rootDir = ROOT_DIR) {
  const index = getComponentsIndex(rootDir);
  const opts = {
    fromPath: component.source,
    familyPaths: component.allSources,
    primaryPath: component.source,
  };

  return component.types.map((typeName) => {
    const entry = resolveComponentTypeEntry(index, typeName, { ...opts, errorLabel: `${component.name}: ${typeName}` });
    if (entry.docKind === 'props') {
      const files = component.allSources.map((relPath) => ({
        path: relPath,
        source: fs.readFileSync(path.join(rootDir, relPath), 'utf8'),
      }));
      applyDefaults(entry, extractDefaults(files, entry.names));
    }
    return entry;
  });
}
