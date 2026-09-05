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

// Props tables publish a prop's whole JSDoc description.
//
// Two narrower rules were tried and both lost real contract. Publishing only the first
// sentence dropped the operative clause for 263 of the 382 documented props (Table's `layout`
// read "Responsive presentation." with the sentence naming `'stacked'` discarded). Capping the
// summary at 280 characters still truncated seven props, and six of those lost user-facing
// contract rather than the maintainer rationale the cap was meant to trim — `Sheet.avoidKeyboard`
// kept its ADR reference and dropped "does not itself read this flag", so the page told a reader
// the prop worked. A prop whose JSDoc runs long is a prop to rewrite, not one to truncate
// silently: the longest real description is 413 characters.
export function summarizeDescription(text) {
  return text.replace(/\s+/gu, ' ').trim();
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
        description = summarizeDescription(ts.getTextOfJSDocComment(doc.comment) ?? '');
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

function isLiteralConstExpression(node) {
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return true;
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  return ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand);
}

// Looks for a top-level `const NAME = <literal>;` in `sourceFile` and returns the literal's
// own text. Only a `const` bound directly to a literal counts — anything else (a `let`, a
// non-literal initializer, or a name this file never declares) is not something a reader can
// resolve by looking at the page, so the caller treats it as unresolved rather than guessing.
function resolveLocalConstantLiteralText(sourceFile, name) {
  let literalText;
  walk(sourceFile, (node) => {
    if (literalText !== undefined || !ts.isVariableStatement(node)) return;
    if (!(node.declarationList.flags & ts.NodeFlags.Const)) return;
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer &&
        isLiteralConstExpression(declaration.initializer)
      ) {
        literalText = declaration.initializer.getText(sourceFile);
      }
    }
  });
  return literalText;
}

// A destructured default that is already a literal (`'md'`, `false`, `1`) is exactly what a
// reader wants and is returned verbatim. A bare identifier is resolved to the literal it names
// when that identifier is a local `const` in the same file (`SELECT_DEFAULT_PLACEHOLDER` ->
// `'Select an option'`) — otherwise (imported from elsewhere, or not a literal) it is
// unresolved. A call expression (`resolveDirection()`) is computed at render time, not a fixed
// value a reader can read off the page, so it is always unresolved. `undefined` here means "no
// documented default", never an unreadable symbol printed into the Default column.
function resolveDefaultInitializerText(initializer, sourceFile) {
  if (ts.isIdentifier(initializer)) return resolveLocalConstantLiteralText(sourceFile, initializer.text);
  if (ts.isCallExpression(initializer)) return undefined;
  return initializer.getText(sourceFile);
}

function collectDefaultsFromBindingPattern(pattern, sourceFile, defaults) {
  for (const element of pattern.elements) {
    if (!ts.isBindingElement(element) || !element.initializer || !ts.isIdentifier(element.name)) continue;
    if (defaults.has(element.name.text)) continue;
    const resolved = resolveDefaultInitializerText(element.initializer, sourceFile);
    if (resolved !== undefined) defaults.set(element.name.text, resolved);
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

// A Props type that is a pure alias of an upstream type — `SwitchProps = Omit<RNSwitchProps, …>`
// — has no own fields, so a fields table for it is empty and the page tells the reader nothing
// about `value`, `onValueChange` or `disabled`. The component's own render function names the
// props it actually reads, and those names are the ones a reader is looking for. This returns
// them, with a default where one is destructured, so an aliased family still documents the
// subset it handles rather than deferring the entire question upstream.
// Props destructured into an underscore-prefixed binding — `modalProps: _modalProps` — are the
// repository's convention for "accepted for API parity, deliberately unread on this platform".
// Reporting only that such a prop's *type* differs is true and misleading: on Web `modalProps`,
// `avoidKeyboard` and `enableSwipeToDismiss` do nothing at all.
export function extractInertProps(files, candidateNames) {
  const inert = new Set();
  const record = (pattern) => {
    for (const element of pattern.elements) {
      if (!ts.isBindingElement(element) || element.dotDotDotToken) continue;
      if (!element.propertyName || !ts.isIdentifier(element.propertyName)) continue;
      if (ts.isIdentifier(element.name) && element.name.text.startsWith('_')) inert.add(element.propertyName.text);
    }
  };

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
    walk(sourceFile, (node) => {
      if (ts.isCallExpression(node) && node.typeArguments?.length === 2 && /forwardRef$/.test(node.expression.getText(sourceFile))) {
        if (!candidateNames.has(getBareTypeReferenceName(node.typeArguments[1]) ?? '')) return;
        const renderFn = node.arguments[0];
        const param = (ts.isArrowFunction(renderFn) || ts.isFunctionExpression(renderFn)) ? renderFn.parameters[0] : undefined;
        if (param && ts.isObjectBindingPattern(param.name)) record(param.name);
        return;
      }
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        const param = node.parameters[0];
        if (!param || !candidateNames.has(getBareTypeReferenceName(param.type) ?? '')) return;
        if (ts.isObjectBindingPattern(param.name)) record(param.name);
      }
    });
  }
  return inert;
}

// `variant`/`size` reach a component's props through `VariantProps<typeof xVariants>`, a
// class-variance-authority generic this parser cannot resolve — so those props were absent from
// every table, and the allowed values of the single most-asked API question ("which variants
// exist?") were published nowhere. The values are literals in the `cva()` call itself, so read
// them from there rather than leaving the contract undocumented.
//
// Shape handled: `const x = cva(base, { variants: { prop: { value: ... } }, defaultVariants: {...} })`.
export function extractCvaVariants(files) {
  const byIdentifier = new Map();

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
    walk(sourceFile, (node) => {
      if (!ts.isVariableDeclaration(node) || !node.name || !ts.isIdentifier(node.name)) return;
      const call = node.initializer;
      if (!call || !ts.isCallExpression(call)) return;
      if (!ts.isIdentifier(call.expression) || call.expression.text !== 'cva') return;

      const config = call.arguments[1];
      if (!config || !ts.isObjectLiteralExpression(config)) return;

      const readObject = (name) => {
        const property = config.properties.find(
          (candidate) =>
            ts.isPropertyAssignment(candidate) &&
            candidate.name &&
            (ts.isIdentifier(candidate.name) || ts.isStringLiteral(candidate.name)) &&
            candidate.name.text === name,
        );
        return property && ts.isObjectLiteralExpression(property.initializer) ? property.initializer : undefined;
      };

      const variants = readObject('variants');
      if (!variants) return;

      const defaults = new Map();
      for (const property of readObject('defaultVariants')?.properties ?? []) {
        if (!ts.isPropertyAssignment(property) || !property.name) continue;
        if (!ts.isStringLiteralLike(property.initializer)) continue;
        defaults.set(property.name.getText(sourceFile).replace(/['"]/gu, ''), property.initializer.text);
      }

      const props = new Map();
      for (const property of variants.properties) {
        if (!ts.isPropertyAssignment(property) || !property.name) continue;
        if (!ts.isObjectLiteralExpression(property.initializer)) continue;
        const propName = property.name.getText(sourceFile).replace(/['"]/gu, '');
        const values = property.initializer.properties
          .filter((value) => ts.isPropertyAssignment(value) && value.name)
          .map((value) => value.name.getText(sourceFile).replace(/['"]/gu, ''));
        if (!values.length) continue;
        props.set(propName, { values, default: defaults.get(propName) });
      }

      if (props.size) byIdentifier.set(node.name.text, props);
    });
  }

  return byIdentifier;
}

// `VariantProps<typeof buttonVariants>` -> the identifier, plus any keys an `Omit<>` wrapper
// removes. Input declares `Omit<VariantProps<typeof inputVariants>, 'invalid'>` because it
// re-declares `invalid` itself, so matching only the bare form left its variants unpublished.
export function variantsIdentifierFromBase(base) {
  const text = String(base ?? '').trim();

  const bare = /^VariantProps<\s*typeof\s+([A-Za-z0-9_$]+)\s*>$/u.exec(text);
  if (bare) return { identifier: bare[1], omitted: new Set() };

  const omit = /^Omit<\s*VariantProps<\s*typeof\s+([A-Za-z0-9_$]+)\s*>\s*,(.+)>$/u.exec(text);
  if (!omit) return undefined;

  const omitted = new Set(
    [...omit[2].matchAll(/'([^']+)'|"([^"]+)"/gu)].map((match) => match[1] ?? match[2]),
  );
  return { identifier: omit[1], omitted };
}

export function extractConsumedProps(files, candidateNames) {
  const consumed = new Map();

  const record = (pattern, sourceFile) => {
    for (const element of pattern.elements) {
      if (!ts.isBindingElement(element)) continue;
      // `...props` is the passthrough, not a documented prop.
      if (element.dotDotDotToken) continue;
      const name = element.propertyName ?? element.name;
      if (!ts.isIdentifier(name)) continue;
      if (consumed.has(name.text)) continue;
      consumed.set(name.text, element.initializer ? element.initializer.getText(sourceFile) : '');
    }
  };

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
    walk(sourceFile, (node) => {
      if (ts.isCallExpression(node) && node.typeArguments?.length === 2 && /forwardRef$/.test(node.expression.getText(sourceFile))) {
        if (!candidateNames.has(getBareTypeReferenceName(node.typeArguments[1]) ?? '')) return;
        const renderFn = node.arguments[0];
        const param = (ts.isArrowFunction(renderFn) || ts.isFunctionExpression(renderFn)) ? renderFn.parameters[0] : undefined;
        if (param && ts.isObjectBindingPattern(param.name)) record(param.name, sourceFile);
        return;
      }
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        const param = node.parameters[0];
        if (!param || !candidateNames.has(getBareTypeReferenceName(param.type) ?? '')) return;
        if (ts.isObjectBindingPattern(param.name)) record(param.name, sourceFile);
      }
    });
  }

  return consumed;
}

function applyDefaults(shape, defaults) {
  if (shape.fields) {
    shape.fields = shape.fields.map((field) => (defaults.has(field.name) ? { ...field, default: defaults.get(field.name) } : field));
  }
  if (shape.variants) {
    for (const variant of shape.variants) applyDefaults(variant, defaults);
  }
}

// --- Platform-split shape diffing (WBS-G060 M4) -------------------------------
//
// A platform-split family (a `.web.tsx` file among `component.allSources`) sometimes
// redeclares the same exported `*Props` name with a genuinely different shape — see
// `table.web.tsx` (own `testID` field, no `colSpan` default, a `React.HTMLAttributes` base
// instead of `ViewProps`) or `sheet.web.tsx` (`modalProps` typed `Record<string, unknown>`
// instead of native's `SheetModalProps`). `resolveDeclaration`'s primary/family
// disambiguation always prefers the native declaration for the rendered table, so without an
// explicit diff the reader never learns Web adds/removes a field, changes a default, or
// widens/narrows a base — the props table silently presents one platform's shape as if it were
// the whole contract. These helpers make that diff explicit and derivable instead of a
// hand-written caveat.

function normalizeTypeText(text) {
  return String(text ?? '').replace(/\s+/gu, ' ').trim();
}

function normalizeBaseList(bases) {
  return [...(bases ?? [])].map(normalizeTypeText).sort().join('\u0000');
}

function diffFieldLists(nativeFields, webFields) {
  const nativeByName = new Map(nativeFields.map((field) => [field.name, field]));
  const webByName = new Map(webFields.map((field) => [field.name, field]));
  const nativeOnly = [];
  const webOnly = [];
  const changed = [];
  for (const [name, field] of nativeByName) {
    const webField = webByName.get(name);
    if (!webField) {
      nativeOnly.push(field);
      continue;
    }
    const typeChanged = normalizeTypeText(field.type) !== normalizeTypeText(webField.type);
    const defaultChanged = (field.default ?? null) !== (webField.default ?? null);
    const optionalChanged = Boolean(field.optional) !== Boolean(webField.optional);
    if (typeChanged || defaultChanged || optionalChanged) {
      changed.push({ name, native: field, web: webField, typeChanged, defaultChanged, optionalChanged });
    }
  }
  for (const [name, field] of webByName) {
    if (!nativeByName.has(name)) webOnly.push(field);
  }
  return { nativeOnly, webOnly, changed };
}

// Compares one platform's resolved "object" shape (own fields + cited bases) against the
// other's. Returns `null` when there is genuinely no observable difference — most
// platform-split families redeclare an identical shape per file for signature parity, and a
// diff note there would be noise, not signal.
export function diffPlatformObjectShape(nativeShape, webShape) {
  const { nativeOnly, webOnly, changed } = diffFieldLists(nativeShape.fields ?? [], webShape.fields ?? []);
  const basesChanged = normalizeBaseList(nativeShape.bases) !== normalizeBaseList(webShape.bases);
  if (!nativeOnly.length && !webOnly.length && !changed.length && !basesChanged) return null;
  return { nativeOnly, webOnly, changed, basesChanged, nativeBases: nativeShape.bases ?? [], webBases: webShape.bases ?? [] };
}

// Compares a full resolved `*Props` doc entry (an "object" shape, or a "union" of variants)
// against its Web counterpart. Returns `{ kind: 'unsupported' }` when the two shapes are not
// directly comparable (e.g. one platform is a union and the other a plain object) — the caller
// must fall back to an explicit "this table documents the native shape only" note rather than
// guess at a diff it cannot derive. Returns `null` when every comparable part is identical.
export function diffPlatformPropsShape(nativeEntry, webShape) {
  if (nativeEntry.kind === 'object' && webShape.kind === 'object') {
    const diff = diffPlatformObjectShape(nativeEntry, webShape);
    return diff ? { kind: 'object', diff } : null;
  }
  if (nativeEntry.kind === 'union' && webShape.kind === 'union') {
    const webByName = new Map(webShape.variants.map((variant) => [variant.name, variant]));
    const nativeNames = new Set(nativeEntry.variants.map((variant) => variant.name));
    const variantDiffs = [];
    for (const variant of nativeEntry.variants) {
      const webVariant = webByName.get(variant.name);
      if (!webVariant) continue;
      const diff = diffPlatformObjectShape(variant, webVariant);
      if (diff) variantDiffs.push({ variantName: variant.name, diff });
    }
    const unmatched = [
      ...nativeEntry.variants.filter((variant) => !webByName.has(variant.name)).map((variant) => variant.name),
      ...webShape.variants.filter((variant) => !nativeNames.has(variant.name)).map((variant) => variant.name),
    ];
    if (!variantDiffs.length && !unmatched.length) return null;
    return { kind: 'union', variantDiffs, unmatched };
  }
  return { kind: 'unsupported' };
}

// --- Prop-name universe for the content.json prose guard (WBS-G060 M8) -------
//
// `Omit<X, 'a' | 'b'>` — a generic type reference — is deliberately never expanded even when
// `X` is itself a BeeUI-local type (see `tryEmbed`'s `node.typeArguments` guard): it is cited
// as a base, not flattened into fields. That is correct for the rendered table, but it means a
// real BeeUI prop like `icon-button`'s `loading` (inherited via `Omit<ButtonProps, …>`) never
// appears in this module's own field list. The behavior-prose guard needs a broader "does this
// family actually have a prop by this name" universe than the table does, so it separately
// resolves one level into any locally-declared base, plus `cva()` variant keys (`variant`,
// `size`, `tone`, …) that the same `VariantProps<typeof xVariants>` base convention never
// expands either.
export function extractOmitPickOrBareTypeName(baseText) {
  const generic = normalizeTypeText(baseText).match(/^(?:Omit|Pick)<\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,/);
  if (generic) return generic[1];
  const bare = normalizeTypeText(baseText);
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(bare) ? bare : null;
}

function addLocalBaseFieldNames(index, baseText, known) {
  const name = extractOmitPickOrBareTypeName(baseText);
  if (!name) return;
  let resolved;
  try {
    resolved = resolveDeclaration(index, name, {});
  } catch {
    // Ambiguous across files with no family context to disambiguate — not worth resolving for
    // a best-effort guard; the caller's explicit allowlist covers real cases that land here.
    return;
  }
  if (!resolved) return;
  const sourceFile = index.perFile.get(resolved.path).sourceFile;
  if (ts.isInterfaceDeclaration(resolved.node)) {
    for (const field of extractFields(resolved.node, sourceFile)) known.add(field.name);
    return;
  }
  if (ts.isTypeAliasDeclaration(resolved.node)) {
    const typeNode = resolved.node.type;
    if (ts.isTypeLiteralNode(typeNode)) {
      for (const field of extractFields(typeNode, sourceFile)) known.add(field.name);
    } else if (ts.isIntersectionTypeNode(typeNode)) {
      for (const member of typeNode.types) {
        if (ts.isTypeLiteralNode(member)) {
          for (const field of extractFields(member, sourceFile)) known.add(field.name);
        }
      }
    }
  }
}

function collectCvaVariantKeys(sourceFile, known) {
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    const calleeName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
    if (calleeName !== 'cva') return;
    for (const arg of node.arguments) {
      if (!ts.isObjectLiteralExpression(arg)) continue;
      for (const prop of arg.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name) || prop.name.text !== 'variants') continue;
        if (!ts.isObjectLiteralExpression(prop.initializer)) continue;
        for (const variantProp of prop.initializer.properties) {
          const name = variantProp.name && ts.isIdentifier(variantProp.name) ? variantProp.name.text : undefined;
          if (name) known.add(name);
        }
      }
    }
  });
}

// The "does this family have a prop by this name" universe the content.json prose guard checks
// backticked identifiers against. Deliberately broader than a single `*Props` type's own field
// list (see the module comment above); still not exhaustive — genuinely external bases
// (`PressableProps`, `TextInputProps`, react-native-safe-area-context's `SafeAreaView`) and
// imperative hook-return members (`useToast().dismiss`) are not resolvable this way at all, and
// the caller (`public-component-reference.mjs`) carries a small, explicit, documented allowlist
// for those.
export function getBehaviorGuardKnownNames(component, typeDocs, rootDir = ROOT_DIR) {
  const index = getComponentsIndex(rootDir);
  const known = new Set(component.values);

  const visit = (shape) => {
    if (shape.fields) for (const field of shape.fields) known.add(field.name);
    if (shape.bases) for (const base of shape.bases) addLocalBaseFieldNames(index, base, known);
    if (shape.consumed) for (const prop of shape.consumed) known.add(prop.name);
    if (shape.variants) for (const variant of shape.variants) visit(variant);
  };
  for (const entry of typeDocs) {
    if (entry.docKind !== 'props') continue;
    visit(entry);
  }

  for (const relPath of component.allSources) {
    const abs = path.join(rootDir, relPath);
    if (!fs.existsSync(abs)) continue;
    const sourceFile = ts.createSourceFile(relPath, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, scriptKindFor(relPath));
    collectCvaVariantKeys(sourceFile, known);
  }

  return known;
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

// A `.web.tsx` file among `allSources` that is not itself the family's primary/native source —
// the platform-split shape this module diffs against.
function findWebSourcePath(allSources, primaryPath) {
  return allSources.find((relPath) => relPath !== primaryPath && /\.web\.tsx?$/.test(relPath));
}

function fillConsumedFallback(shape, files, names) {
  if (shape.kind === 'object' && !shape.fields?.length) {
    shape.consumed = [...extractConsumedProps(files, names)]
      .map(([name, defaultText]) => ({ name, default: defaultText }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

// Full derived-types model for one public component family, in the same
// (already-sorted) order as `component.types` from `getPublicComponents()`.
// This is the only function `public-component-reference.mjs` needs.
export const PROP_GLOSSARY_FILE = 'docs/prop-glossary.json';

// Structural props repeat across families and are documented nowhere: `className` appears
// undescribed on 51 families, `children` on 26. Of 452 undescribed prop rows, 372 belong to
// props that repeat three or more times, so the gap is a shared vocabulary rather than 452
// separate facts. Source JSDoc always wins — the glossary only fills a blank.
function propGlossary(rootDir) {
  const file = path.join(rootDir, PROP_GLOSSARY_FILE);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')).props ?? {};
}

function applyGlossary(shape, glossary) {
  for (const field of shape?.fields ?? []) {
    if (!field.description && glossary[field.name]) field.description = glossary[field.name];
  }
  for (const variant of shape?.variants ?? []) applyGlossary(variant, glossary);
}

// Publishes the cva-derived variant props on the shape that declares
// `VariantProps<typeof x>`, and drops that base from the "also carries" line — the props are no
// longer elsewhere, they are in the table right above it.
function applyCvaVariants(shape, cvaByIdentifier) {
  if (!shape) return;
  for (const variant of shape.variants ?? []) applyCvaVariants(variant, cvaByIdentifier);
  if (!Array.isArray(shape.bases)) return;

  const remaining = [];
  for (const base of shape.bases) {
    const parsed = variantsIdentifierFromBase(base);
    const props = parsed ? cvaByIdentifier.get(parsed.identifier) : undefined;
    if (!parsed || !props) {
      remaining.push(base);
      continue;
    }
    const { identifier, omitted } = parsed;

    shape.fields = shape.fields ?? [];
    for (const [name, spec] of props) {
      if (omitted.has(name)) continue;
      if (shape.fields.some((field) => field.name === name)) continue;
      shape.fields.push({
        name,
        optional: true,
        type: spec.values.map((value) => `'${value}'`).join(' | '),
        default: spec.default === undefined ? undefined : `'${spec.default}'`,
        description:
          `Defined by \`${identifier}\` (class-variance-authority); see Styling and theming for ` +
          'what each value changes.',
      });
    }
    shape.fields.sort((left, right) => left.name.localeCompare(right.name));
  }

  shape.bases = remaining;
}

export function getComponentTypeDocs(component, rootDir = ROOT_DIR) {
  const index = getComponentsIndex(rootDir);
  const opts = {
    fromPath: component.source,
    familyPaths: component.allSources,
    primaryPath: component.source,
  };
  const webPath = findWebSourcePath(component.allSources, component.source);
  const files = component.allSources.map((relPath) => ({
    path: relPath,
    source: fs.readFileSync(path.join(rootDir, relPath), 'utf8'),
  }));

  return component.types.map((typeName) => {
    const entry = resolveComponentTypeEntry(index, typeName, { ...opts, errorLabel: `${component.name}: ${typeName}` });
    if (entry.docKind === 'props') {
      applyCvaVariants(entry, extractCvaVariants(files));
      applyDefaults(entry, extractDefaults(files, entry.names));
      applyGlossary(entry, propGlossary(rootDir));
      // A pure alias of an upstream type documents nothing on its own; fall back to the props
      // the implementation actually reads out of it.
      fillConsumedFallback(entry, files, entry.names);

      // The Web file only sometimes redeclares this exact type name locally (a genuine
      // platform-split shape, e.g. `table.web.tsx`'s own `TableProps`) — most platform-split
      // families share one declaration for a given type (e.g. `date-picker-shared.tsx`'s
      // `DatePickerProps`), which `resolveDeclaration` already resolves identically for both
      // platforms, so there is nothing to diff and this stays undefined for them.
      if (webPath && index.perFile.get(webPath)?.declarations.has(typeName)) {
        const webCtx = {
          index,
          errorLabel: `${component.name}: ${typeName} (Web)`,
          names: new Set([typeName]),
          resolveOpts: { fromPath: webPath, primaryPath: webPath, familyPaths: component.allSources },
        };
        const webShape = resolveNamedTypeShape(typeName, webCtx);
        applyDefaults(webShape, extractDefaults(files, webCtx.names));
        fillConsumedFallback(webShape, files, webCtx.names);
        // A prop the Web implementation destructures into an underscore-prefixed binding is
        // accepted for API parity and deliberately unread. Reporting only that its type differs
        // is true and misleading: on Web `modalProps`, `avoidKeyboard` and `enableSwipeToDismiss`
        // do nothing at all.
        applyGlossary(webShape, propGlossary(rootDir));
        webShape.inert = [...extractInertProps(
          [{ path: webPath, source: fs.readFileSync(path.join(rootDir, webPath), 'utf8') }],
          webCtx.names,
        )];
        entry.webShape = webShape;
        entry.webSource = webPath;
      }
    }
    return entry;
  });
}
