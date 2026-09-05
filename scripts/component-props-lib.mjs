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
// `forwardRef((props, ref) => { const { disabled = false } = props; … })` destructures in the body,
// not in the parameter. The plain-function branch already read that shape; the forwardRef branch
// did not, so 15 rows across Calendar, DatePicker and DateTimePicker published no default while a
// literal one existed in source. (A further 14 rows on those pages still show no default: their
// value comes from a cross-file identifier rather than a literal, which is deliberately not
// published.)
function collectDefaultsFromBodyDestructure(fn, paramName, sourceFile, defaults) {
  // No `isBlock` narrowing: it had no observable effect (removing it changed no output and no
  // test), because the checks that matter are below — a `const { … } = <paramName>` statement.
  if (!fn.body) return;
  walk(fn.body, (inner) => {
    if (!ts.isVariableStatement(inner)) return;
    for (const declaration of inner.declarationList.declarations) {
      if (
        ts.isObjectBindingPattern(declaration.name) &&
        declaration.initializer &&
        ts.isIdentifier(declaration.initializer) &&
        declaration.initializer.text === paramName
      ) {
        collectDefaultsFromBindingPattern(declaration.name, sourceFile, defaults);
      }
    }
  });
}

// A wrapper can re-default a prop it forwards: `<DialogClose variant={variant ?? 'destructive'} />`.
// That is the real default a reader gets, and it is not a destructuring default, so the binding
// walk above cannot see it. Resolving `buttonVariants` globally published `'primary'` for
// AlertDialogAction and AlertDialogCancel, whose actual defaults are 'destructive' and 'outline',
// on a page whose own example passes no variant at all.
function collectDefaultsFromForwardedFallbacks(node, sourceFile, defaults) {
  walk(node, (inner) => {
    if (!ts.isJsxAttribute(inner) || !inner.name || !ts.isIdentifier(inner.name)) return;
    const initializer = inner.initializer;
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return;

    const expression = initializer.expression;
    if (!ts.isBinaryExpression(expression)) return;
    if (expression.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;
    if (!ts.isIdentifier(expression.left) || expression.left.text !== inner.name.text) return;
    if (!ts.isStringLiteralLike(expression.right)) return;

    // First-wins, matching `collectDefaultsFromBindingPattern`. This does NOT make the result
    // order-independent — first-wins is as order-dependent as last-wins across files. It makes the
    // two collectors agree, so which default is published no longer depends on which of them
    // happened to run: a node that both destructures a default and forwards a `??` fallback now
    // publishes the destructured one either way. Ordering across `allSources` remains a known
    // limit, currently unexercised: no prop in packages/ui carries conflicting defaults.
    if (!defaults.has(inner.name.text)) defaults.set(inner.name.text, `'${expression.right.text}'`);
  });
}

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
          } else if (param && ts.isIdentifier(param.name)) {
            collectDefaultsFromBodyDestructure(renderFn, param.name.text, sourceFile, defaults);
          }
          if (renderFn) collectDefaultsFromForwardedFallbacks(renderFn, sourceFile, defaults);
        }
      }

      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        const param = node.parameters[0];
        const typeName = param ? getBareTypeReferenceName(param.type) : undefined;
        if (!typeName || !candidateNames.has(typeName)) return;
        if (ts.isObjectBindingPattern(param.name)) {
          collectDefaultsFromBindingPattern(param.name, sourceFile, defaults);
        } else if (ts.isIdentifier(param.name)) {
          collectDefaultsFromBodyDestructure(node, param.name.text, sourceFile, defaults);
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
// cva does not type an object key as text: `{ true: …, false: … }` becomes `boolean`. Publishing
// the keys as string literals put `'true' | 'false'` on the Stack page, which the same page
// contradicts with `<HStack wrap>`.
//
// Numeric keys are deliberately NOT special-cased. cva types `{ 1: … }` as `1` and `{ '1': … }` as
// `'1'`, but `extractCvaVariants` strips the quotes, so by this point the two are indistinguishable
// and any guess is wrong half the time — a numeric branch here turned the quoted case, which was
// correct, into an incorrect one. No cva in packages/ui has a numeric or mixed key set; if one is
// added, carry the quoting through from the AST rather than inferring it from the text.
export function cvaVariantType(values) {
  const isBoolean = values.every((value) => value === 'true' || value === 'false');
  const quote = (value) => (isBoolean ? value : `'${value}'`);

  return { quote, type: isBoolean ? 'boolean' : values.map(quote).join(' | ') };
}

// Per-component accessibility facts, read from the JSX the family actually renders.
//
// The Accessibility section was one identical paragraph on all 62 pages that asserted roles and
// states "remain component-specific" — a page contradicting itself, since nothing on it was
// specific to the component. These are the two facts that can be derived honestly: the roles this
// family assigns to its own elements, and the accessibility states it manages. Read from the AST
// rather than by matching text, so a role named in a comment or a string is not published as one.
// Every `const <name> = <expression>` in the file, not the first.
//
// The comment here used to claim that a second declaration "would add its literals too"; the code
// returned on the first match and discarded the rest. Two components in one file each computing
// their own `const role` published only the earlier one's roles, and a reader takes the published
// list as complete. The page's claim is about the whole family, and the family is these files, so
// every declaration belongs in it.
//
// Resolution is skipped entirely when a parameter or binding of the same name exists: the
// identifier at the JSX site is then that binding, not the module constant, and resolving to the
// constant publishes a role the component never assigns. Recursion is not followed (`sourceFile`
// is dropped one level down), so an identifier chain resolves once and stops.
function findLocalConstInitializers(name, sourceFile) {
  const initializers = [];
  let shadowed = false;
  walk(sourceFile, (node) => {
    if (
      (ts.isParameter(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      shadowed = true;
      return;
    }
    if (!ts.isVariableDeclaration(node)) return;
    if (!ts.isIdentifier(node.name) || node.name.text !== name) return;
    if (node.initializer) initializers.push(node.initializer);
  });
  return shadowed ? [] : initializers;
}

// Comment text is prose about the code, not the code. Callers that grep a source file for what it
// does must not read an explanation of what it deliberately does not do — `sheet.web.tsx` names
// the gesture engine it does not use, and `spinner.tsx` names the role its primitive sets. A
// regex over `//` and `/* */` is not enough: a string containing `/*` (a glob, a URL, a JSDoc
// sample) swallows the rest of the file, so this walks the text tracking string and template
// state.
export function stripSourceComments(source) {
  let out = '';
  let index = 0;
  let quote;
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      if (character === '\\') {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === quote) quote = undefined;
      out += character;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      out += character;
      index += 1;
      continue;
    }
    if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      out += ' ';
      continue;
    }
    out += character;
    index += 1;
  }
  return out;
}

// Collects every string an expression can *evaluate to*.
//
// A conditional's condition is not one of them: `selectionMode === 'single' ? 'radiogroup' :
// undefined` assigns `radiogroup` and never assigns `single`. Walking the whole expression
// published `single` on the ChipGroup page as an ARIA role. The test that was supposed to cover
// this path used `decorative ? undefined : 'separator'` — a condition holding no string literal —
// so the case that would have disagreed was never in its scope.
function collectValueLiterals(node, out, sourceFile) {
  if (!node) return;
  if (ts.isParenthesizedExpression(node)) {
    collectValueLiterals(node.expression, out, sourceFile);
    return;
  }
  // `accessibilityRole={role}` where `role` is computed just above it. Chip assigns `radio`,
  // `checkbox` or `button` that way, and reading the attribute alone published only the one role
  // ChipGroup sets directly — a list a reader would take as complete.
  if (ts.isIdentifier(node) && sourceFile) {
    for (const initializer of findLocalConstInitializers(node.text, sourceFile)) {
      collectValueLiterals(initializer, out, undefined);
    }
    return;
  }
  if (ts.isStringLiteralLike(node)) {
    out.add(node.text);
    return;
  }
  if (ts.isConditionalExpression(node)) {
    collectValueLiterals(node.whenTrue, out, sourceFile);
    collectValueLiterals(node.whenFalse, out, sourceFile);
    return;
  }
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    // `cond && 'role'` yields the right side only; `a ?? 'role'` and `a || 'role'` yield either.
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      collectValueLiterals(node.right, out, sourceFile);
      return;
    }
    if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
      collectValueLiterals(node.left, out, sourceFile);
      collectValueLiterals(node.right, out, sourceFile);
    }
    // Comparisons evaluate to a boolean, never to an operand read as a role.
    return;
  }
  ts.forEachChild(node, (child) => collectValueLiterals(child, out, sourceFile));
}

// `accessibilityState={interactive ? { disabled } : undefined}` puts the object one level below
// the attribute. Requiring an object literal directly meant ListItem published "manages no
// states" while managing `disabled`; the shape of the wrapper is not the question being asked.
function collectStateNames(node, states) {
  if (!node) return;
  if (ts.isParenthesizedExpression(node)) {
    collectStateNames(node.expression, states);
    return;
  }
  if (ts.isConditionalExpression(node)) {
    collectStateNames(node.whenTrue, states);
    collectStateNames(node.whenFalse, states);
    return;
  }
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      collectStateNames(node.right, states);
      return;
    }
    if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
      collectStateNames(node.left, states);
      collectStateNames(node.right, states);
    }
    return;
  }
  if (!ts.isObjectLiteralExpression(node)) return;
  for (const property of node.properties) {
    // `{ ...(inGroup ? { checked } : { selected }) }` states both, one branch each. A spread of a
    // variable (`...accessibilityState`) names nothing and correctly contributes nothing; reading
    // only named properties dropped Chip's `selected`.
    if (ts.isSpreadAssignment(property)) {
      collectStateNames(property.expression, states);
      continue;
    }
    // Shorthand (`{ disabled }`) carries its name like any other property.
    if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
      states.add(property.name.text);
    }
  }
}

export function extractAccessibilityFacts(files) {
  const roles = new Set();
  const states = new Set();

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
    walk(sourceFile, (node) => {
      // Props reach a primitive two ways: as JSX attributes, and as an object literal that is
      // spread into one. Switch sets `accessibilityRole: 'switch'` and an `accessibilityState`
      // object in a spread branch; reading JSX attributes alone published "assigns no roles,
      // manages no states" on a component whose whole purpose is the `switch` role.
      if (ts.isJsxAttribute(node) && node.name && ts.isIdentifier(node.name)) {
        const attribute = node.name.text;
        if (attribute === 'role' || attribute === 'accessibilityRole') {
          if (!node.initializer) return;
          if (ts.isStringLiteralLike(node.initializer)) {
            roles.add(node.initializer.text);
            return;
          }
          if (ts.isJsxExpression(node.initializer)) collectValueLiterals(node.initializer.expression, roles, sourceFile);
          return;
        }
        if (attribute.startsWith('aria-')) {
          states.add(attribute.slice('aria-'.length));
          return;
        }
        if (attribute !== 'accessibilityState') return;
        const value = node.initializer;
        if (!value || !ts.isJsxExpression(value)) return;
        collectStateNames(value.expression, states);
        return;
      }

      // Object-literal form. An earlier version of this code excluded a bare `role` key on the
      // stated grounds that no source in `packages/ui` used one — `select.tsx` does, building
      // `{ 'aria-labelledby': …, role: 'group' }` for Web, and the Select page published a role
      // list missing it. The exclusion was a guess about the repository presented as a fact.
      if (!ts.isPropertyAssignment(node)) return;
      const key = node.name;
      if (!key || !(ts.isIdentifier(key) || ts.isStringLiteral(key))) return;
      const name = key.text;
      if (name === 'accessibilityRole' || name === 'role') {
        collectValueLiterals(node.initializer, roles, sourceFile);
        return;
      }
      if (name.startsWith('aria-')) {
        states.add(name.slice('aria-'.length));
        return;
      }
      if (name !== 'accessibilityState') return;
      collectStateNames(node.initializer, states);
    });
  }

  return { roles: [...roles].sort(), states: [...states].sort() };
}


// Controlled-prop requirements, read from the development warnings the components already emit.
//
// Dialog's curated limitation is exactly this fact — "Controlled open requires onOpenChange" — so
// the claim that the remaining limitations all need product judgement was too broad: this class is
// a fact in the code, stated by the component itself, and nine families emit one.
export function extractControlledPropWarnings(files) {
  const pairs = new Map();

  for (const { path: filePath, source } of files) {
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
    walk(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;
      if (node.expression.getText(sourceFile) !== 'console.warn') return;
      for (const argument of node.arguments) {
        if (!ts.isStringLiteralLike(argument)) continue;
        const match = /^BeeUI\s+\w+:\s+`(\w+)`\s+requires\s+`(\w+)`/u.exec(argument.text);
        if (match) pairs.set(match[1], match[2]);
      }
    });
  }

  return [...pairs].map(([prop, handler]) => ({ prop, handler })).sort((a, b) => a.prop.localeCompare(b.prop));
}

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

      // `defaultVariants: { wrap: false }` is a boolean keyword, not a string literal. Accepting
      // only string literals dropped it, publishing "no default" for a prop that defaults to false.
      const literalText = (node) => {
        if (ts.isStringLiteralLike(node)) return node.text;
        if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true';
        if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false';
        if (ts.isNumericLiteral(node)) return node.text;
        return undefined;
      };

      const defaults = new Map();
      for (const property of readObject('defaultVariants')?.properties ?? []) {
        if (!ts.isPropertyAssignment(property) || !property.name) continue;
        const value = literalText(property.initializer);
        if (value === undefined) continue;
        defaults.set(property.name.getText(sourceFile).replace(/['"]/gu, ''), value);
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

      if (props.size) byIdentifier.set(node.name.text, { props, sourcePath: filePath });
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

// Built once over every component source, because a family can reference another file's
// variants: the Trigger/Close types on Dialog, AlertDialog, DropdownMenu, Popover, Sheet and
// Tooltip alias `ButtonProps` and so carry `VariantProps<typeof buttonVariants>`, which lives in
// button.tsx. Scoping extraction to the family's own files left those unresolved on 11 lines,
// published as "that upstream contract is not reproduced here" — while `buttonVariants` is a
// module-private const a reader cannot look up anywhere.
const cvaCache = new Map();

function getCvaVariants(rootDir) {
  if (!cvaCache.has(rootDir)) cvaCache.set(rootDir, extractCvaVariants(readComponentSourceFiles(rootDir)));
  return cvaCache.get(rootDir);
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
    const declaration = parsed ? cvaByIdentifier.get(parsed.identifier) : undefined;
    const props = declaration?.props;
    if (!parsed || !props) {
      remaining.push(base);
      continue;
    }
    const { identifier, omitted } = parsed;

    shape.fields = shape.fields ?? [];
    for (const [name, spec] of props) {
      if (omitted.has(name)) continue;
      if (shape.fields.some((field) => field.name === name)) continue;
      const { type, quote } = cvaVariantType(spec.values);

      shape.fields.push({
        name,
        optional: true,
        type,
        default: spec.default === undefined ? undefined : quote(spec.default),
        // Was "see Styling and theming for what each value changes". That section is one
        // boilerplate paragraph repeated across all 62 component pages and says nothing about any
        // value, so those rows carried a pointer that answered nothing. The classes each value
        // applies are literals in the `cva()` call, so name the file that holds them.
        // Named after the prop, not just the cva: one sentence per identifier meant `size` and
        // `variant` shared a description although they select different things. Those 35 rows were
        // the only place in the reference where one sentence covered two different props — every
        // other shared sentence is one prop name whose meaning genuinely is identical everywhere.
        description:
          `Chooses this element's \`${name}\` from \`${identifier}\`'s presets, declared in ` +
          `\`${declaration.sourcePath}\` — the classes each value applies are there.`,
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
      applyCvaVariants(entry, getCvaVariants(rootDir));
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
        // The Web shape needs the same cva resolution as the native one, or the platform-diff
        // bullets keep naming `VariantProps<typeof buttonVariants>` as an unreproduced contract.
        applyCvaVariants(webShape, getCvaVariants(rootDir));
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
