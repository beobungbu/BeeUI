#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { showcaseHref } from '../apps/showcase/showcase-target.ts';
import {
  ROOT_DIR,
  PATTERN_PACKS,
  getPatternRuntimeIds,
  getPatternScreens,
  readJson,
} from './component-docs-lib.mjs';
import {
  buildPublicComponentManifest,
  collectScopedAccessibilityFacts,
  KNOWN_ACCESSIBILITY_ROLES,
  platformLabel,
} from './public-component-reference.mjs';
import { stripSourceComments } from './component-props-lib.mjs';

// Patterns sit directly under the ratified section, matching the component families that
// moved there in #459. A /reference/ segment between the section and its content was an
// artifact of these pages once being gitignored, not part of the IA.
export const PUBLIC_PATTERN_DIR = 'apps/docs/src/content/docs/patterns';

function titleFromSlug(slug) {
  return slug
    .replace(/-screen$/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function githubHref(file) {
  return `https://github.com/beobungbu/BeeUI/blob/main/${file}`;
}

// Memoized: the manifest parses every component source, and both the page renderer and the
// derived-claim checker need this map once per pattern. Rebuilding it 74 times turned a
// sub-second gate into a minute-long one.
const symbolRouteCache = new Map();
function symbolRouteMap(rootDir) {
  const cached = symbolRouteCache.get(rootDir);
  if (cached) return cached;
  const map = new Map();
  for (const component of buildPublicComponentManifest(rootDir)) {
    for (const value of component.values) map.set(value, component.route);
  }
  symbolRouteCache.set(rootDir, map);
  return map;
}

// --- Derived per-pattern facts ----------------------------------------------
//
// `## Responsive contract` and `## Accessibility` were one identical paragraph on all 37
// pattern pages: true of BeeUI in general, and therefore not a fact about any screen. The
// component pages went through the same correction, and the defect that survived eight review
// rounds there was always the same shape — a sentence asserting something outside what the
// generator had actually read ("assigns no roles", "same on all platforms"). The rules that
// ended it are reproduced here:
//
//   1. Every fact names the files it was read from. A negative is scoped to those files
//      ("no `horizontal` scroll container in `x.tsx`"), never categorical.
//   2. No sentence describes what another part of the page contains.
//   3. An independent oracle — a grep over the comment-stripped source, deliberately not
//      sharing code with the AST extractor — refuses every negative the source refutes, and
//      every positive names a token the source does not contain.
//   4. No fact from a branch the screen does not take. A shell that returns one of two layouts
//      depending on a prop states two different things, and only one of them is about the screen
//      reading it; a fact that survives from a branch names the condition that selects it.
//
// The derivation is not total, and the shapes outside it fail loudly rather than quietly:
// `patternOpaqueShapeViolations` refuses an aliased or namespaced tag, `Platform['OS']`, a
// destructured `OS`, and `import()`/`require()`, because each of those turns a real fact into
// silence in both the extractor and the oracle.
//
// A pattern screen's layout is mostly in the pack-local shell it imports (`screen-shell.tsx`,
// `auth-shared.tsx`), not in the screen file, so the read set follows relative imports inside
// `apps/showcase/patterns/**`. That widening is exactly why rule 1 matters: the scope sentence
// names every file, so a reader can tell a shell fact from a screen fact.
export const PATTERN_SOURCE_ROOT = 'apps/showcase/patterns';

function resolveLocalImport(fromRel, specifier, rootDir) {
  if (!specifier.startsWith('.')) return null;
  const base = path.join(path.dirname(fromRel), specifier);
  for (const suffix of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = path.normalize(`${base}${suffix}`);
    if (fs.existsSync(path.join(rootDir, candidate))) return candidate;
  }
  return null;
}

// The module specifiers a file pulls in at runtime. A type-only import emits nothing, and
// following it widened the read set with files the screen never renders:
// `account-settings/screens/settings-screen.tsx` imports `AppearanceTheme` from the *Appearance*
// screen for its type alone, and the Settings page published Appearance's `Box`, `HStack` and
// `accessibilityLabel` as facts about itself. Read as an AST rather than as `from '...'` text,
// because that is the only place the type-only marker exists.
function runtimeModuleSpecifiers(filePath, source) {
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, kind);
  const specifiers = [];
  for (const statement of sourceFile.statements) {
    const isImport = ts.isImportDeclaration(statement);
    if (!isImport && !ts.isExportDeclaration(statement)) continue;
    const moduleSpecifier = statement.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) continue;
    if (isImport ? statement.importClause?.isTypeOnly : statement.isTypeOnly) continue;
    // `import { type A, type B } from './x'` is `import type` written one specifier at a time,
    // and emits no require either. A side-effect import has no bindings and always counts.
    const bindings = isImport ? statement.importClause?.namedBindings : statement.exportClause;
    if (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) {
      if (bindings.elements.every((element) => element.isTypeOnly)) continue;
    }
    specifiers.push(moduleSpecifier.text);
  }
  return specifiers;
}

// The screen file plus every pattern-local file it imports, transitively. Bounded to
// `apps/showcase/patterns/**` so a stray import can never pull `packages/ui` source in and let a
// pattern page publish a component's facts as its own. An entry outside that root — only a test
// fixture reaches this — is bounded to its own directory, so the bound is never absent.
export function collectPatternSourceFiles(entryRel, rootDir = ROOT_DIR) {
  if (!entryRel || !fs.existsSync(path.join(rootDir, entryRel))) return [];
  const bound = entryRel.startsWith(PATTERN_SOURCE_ROOT) ? PATTERN_SOURCE_ROOT : path.dirname(entryRel);
  const visited = new Set();
  const queue = [entryRel];
  const files = [];
  while (queue.length) {
    const rel = queue.shift();
    if (visited.has(rel)) continue;
    visited.add(rel);
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    const source = fs.readFileSync(abs, 'utf8');
    files.push({ path: rel, source });
    for (const specifier of runtimeModuleSpecifiers(rel, source)) {
      const next = resolveLocalImport(rel, specifier, rootDir);
      if (next && next.startsWith(bound)) queue.push(next);
    }
  }
  // Entry first so the scope sentence starts with the screen itself; the rest alphabetical so
  // reordering imports cannot churn every page.
  const [entry, ...rest] = files;
  rest.sort((a, b) => a.path.localeCompare(b.path));
  return [entry, ...rest];
}

// The BeeUI exports that own layout: everything under `packages/ui/src/components/` whose job is
// placing or scrolling its children. A closed vocabulary rather than "any capitalized import",
// because a pattern imports thirty components and only these carry a responsive contract.
// `patternLayoutVocabularyViolations` refuses a name here that is not a public export, so the
// set cannot drift into naming something BeeUI does not ship.
export const BEEUI_LAYOUT_PRIMITIVES = [
  'BottomActionBar', 'Box', 'HStack', 'KeyboardAwareScreen', 'SafeArea', 'Screen', 'Section',
  'Stack', 'VStack',
];

// React Native's scrolling containers. `horizontal` is a prop on these, so which one a screen
// renders is what makes the horizontal claim checkable at all.
const SCROLL_CONTAINERS = ['FlatList', 'ScrollView', 'SectionList', 'VirtualizedList'];

// APIs that read the viewport at runtime. `useBreakpoint`/`useMediaQuery` are not BeeUI exports
// today; they are listed because their absence is the fact being published, and a future export
// by that name must show up rather than pass unnoticed.
const VIEWPORT_APIS = ['useWindowDimensions', 'useBreakpoint', 'useMediaQuery'];

const BREAKPOINT_PREFIXES = ['sm', 'md', 'lg', 'xl', '2xl'];
const PLATFORM_CLASS_PREFIXES = ['web', 'ios', 'android', 'native'];

// A width constraint is either the `contentWidth` prop or a Tailwind `max-w-*` class. The class
// form has three spellings — a scale (`max-w-md`), a multi-segment scale (`max-w-screen-md`) and
// an arbitrary value (`max-w-[680px]`) — and reading only the first published "no width
// constraint" reasoning on six pages whose shell sets `max-w-[680px]`.
const MAX_WIDTH_CLASS = /^max-w-(?:\[[^\]]+\]|[a-z0-9]+(?:-[a-z0-9]+)*)$/u;

function jsxTagNode(node) {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) return node.tagName;
  return null;
}

function jsxTagName(node) {
  const tag = jsxTagNode(node);
  if (!tag) return null;
  return ts.isIdentifier(tag) ? tag.text : null;
}

function walkNodes(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walkNodes(child, visit));
}

function addFact(map, key, file) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(file);
}

// --- Prop-conditional branches ----------------------------------------------
//
// A pack-local shell returns one of two layouts depending on a prop, and the screen that renders
// it fixes that prop. Reading the shell as a flat bag of JSX published `contentWidth="md"` and
// `KeyboardAwareScreen` on six account-settings pages whose screens never pass `keyboardAware`
// (and hid the `max-w-[680px]` that does apply), and published `web:py-12` on the two auth
// screens that pass `compact`. The invariant that ends it: a page never publishes a fact from a
// branch its screen does not select, and a fact that survives from a branch always names the
// condition that selects it.
//
// Only two shapes count as a branch, both resolvable from the render site: `if (prop) { … }`
// — with the rest of the enclosing block as the implicit else when the block returns — and
// `prop ? a : b`, where `prop` is a destructured prop of the enclosing component. A condition
// like `state === 'empty'` is deliberately not one: both arms are reachable for the same screen
// through its own named states, so its facts stay unlabelled as before.

// The destructured props of a component function, keyed by the local binding name so a condition
// can be matched, and carrying the external name so a render site can be read.
function componentPropDeclaration(node) {
  let name = null;
  let parameters = null;
  if (ts.isFunctionDeclaration(node) && node.name) {
    name = node.name.text;
    parameters = node.parameters;
  } else if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    name = node.name.text;
    parameters = node.initializer.parameters;
  }
  if (!name || !/^[A-Z]/u.test(name) || !parameters?.length) return null;
  const [first] = parameters;
  if (!ts.isObjectBindingPattern(first.name)) return null;
  const props = new Map();
  for (const element of first.name.elements) {
    if (!ts.isIdentifier(element.name)) continue;
    const external = element.propertyName && ts.isIdentifier(element.propertyName)
      ? element.propertyName.text
      : element.name.text;
    const initializer = element.initializer?.kind;
    const fallback = initializer === ts.SyntaxKind.TrueKeyword
      ? true
      : initializer === ts.SyntaxKind.FalseKeyword
        ? false
        : null;
    props.set(element.name.text, { external, fallback });
  }
  return { name, props };
}

// `<Shell keyboardAware>` / `<Shell keyboardAware={false} />` / `<Shell />`. `null` means the
// value is an expression this derivation cannot evaluate, and `undefined` means the attribute is
// absent, which is the component's own default.
function jsxAttributeBoolean(attribute) {
  if (!attribute.initializer) return true;
  if (ts.isJsxExpression(attribute.initializer)) {
    const kind = attribute.initializer.expression?.kind;
    if (kind === ts.SyntaxKind.TrueKeyword) return true;
    if (kind === ts.SyntaxKind.FalseKeyword) return false;
  }
  return null;
}

function collectRenderSites(sourceFile, into) {
  walkNodes(sourceFile, (node) => {
    const tag = jsxTagName(node);
    if (!tag) return;
    const attributes = new Map();
    let spread = false;
    for (const attribute of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) { spread = true; continue; }
      if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
      attributes.set(attribute.name.text, jsxAttributeBoolean(attribute));
    }
    if (!into.has(tag)) into.set(tag, []);
    into.get(tag).push({ attributes, spread });
  });
}

// Which values of `prop` the read set actually passes to `component`. `null` is "not resolvable
// here" — the component is never rendered in these files, a render site spreads its props, or a
// site passes an expression — and leaves both branches published, each named with its condition.
function resolveRenderedProp(renderSites, guard) {
  const sites = renderSites.get(guard.component);
  if (!sites?.length) return null;
  const values = new Set();
  for (const site of sites) {
    if (site.spread) return null;
    const passed = site.attributes.has(guard.prop) ? site.attributes.get(guard.prop) : guard.fallback;
    if (passed === null || passed === undefined) return null;
    values.add(passed);
  }
  return values;
}

// The clause a branch fact is published under, or `null` when the screen does not select the
// branch at all and the fact must not be published.
function guardDescriptor(guards, resolve) {
  if (!guards.length) return '';
  const clauses = [];
  let settled = true;
  for (const guard of guards) {
    const selected = resolve(guard);
    if (selected && !selected.has(guard.value)) return null;
    if (!selected || selected.size !== 1) settled = false;
    clauses.push(`\`${guard.prop}\` is ${guard.value}`);
  }
  return `${settled ? 'the branch taken when' : 'only when'} ${clauses.join(' and ')}`;
}

function propCondition(expression, scope) {
  if (!scope.props) return null;
  let value = true;
  let node = expression;
  while (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    value = !value;
    node = node.operand;
  }
  if (!ts.isIdentifier(node)) return null;
  const declared = scope.props.get(node.text);
  if (!declared) return null;
  return { component: scope.component, prop: declared.external, fallback: declared.fallback, value };
}

function statementReturns(statement) {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (!ts.isBlock(statement)) return false;
  return statement.statements.some((child) => ts.isReturnStatement(child) || ts.isThrowStatement(child));
}

// Like `walkNodes`, but every visit carries the prop conditions that must hold for the node to
// render. Guards reset at each component boundary, because a prop only means anything inside the
// component that declares it.
function walkGuarded(node, scope, visit) {
  visit(node, scope.guards);
  const declared = componentPropDeclaration(node);
  const inner = declared ? { component: declared.name, props: declared.props, guards: [] } : scope;

  if (ts.isBlock(node) || ts.isSourceFile(node)) {
    let guards = inner.guards;
    for (const statement of node.statements) {
      walkGuarded(statement, { ...inner, guards }, visit);
      const condition = ts.isIfStatement(statement) ? propCondition(statement.expression, inner) : null;
      // `if (p) { return … }` with no else: everything after it in this block is the else branch.
      if (condition && !statement.elseStatement && statementReturns(statement.thenStatement)) {
        guards = [...guards, { ...condition, value: !condition.value }];
      }
    }
    return;
  }

  if (ts.isIfStatement(node)) {
    const condition = propCondition(node.expression, inner);
    if (condition) {
      walkGuarded(node.expression, inner, visit);
      walkGuarded(node.thenStatement, { ...inner, guards: [...inner.guards, condition] }, visit);
      if (node.elseStatement) {
        const otherwise = { ...condition, value: !condition.value };
        walkGuarded(node.elseStatement, { ...inner, guards: [...inner.guards, otherwise] }, visit);
      }
      return;
    }
  }

  if (ts.isConditionalExpression(node)) {
    const condition = propCondition(node.condition, inner);
    if (condition) {
      walkGuarded(node.condition, inner, visit);
      walkGuarded(node.whenTrue, { ...inner, guards: [...inner.guards, condition] }, visit);
      const otherwise = { ...condition, value: !condition.value };
      walkGuarded(node.whenFalse, { ...inner, guards: [...inner.guards, otherwise] }, visit);
      return;
    }
  }

  ts.forEachChild(node, (child) => walkGuarded(child, inner, visit));
}

// A recorded fact site: the value, the file it was read from, and the guards that must hold.
function addSite(sites, key, file, guards) {
  if (!sites.has(key)) sites.set(key, []);
  sites.get(key).push({ file, guards });
}

// Sites → the published shape, `Map<value, Map<file, Set<condition>>>`, where the empty condition
// is an unguarded fact. Sites in a branch the screen does not select are dropped, and a guarded
// site is dropped when the same file states the fact unguarded too — the unguarded reading is
// strictly stronger and two lines for one value would only read as a contradiction.
function resolveSites(sites, resolve) {
  const facts = new Map();
  for (const [value, entries] of sites) {
    const byFile = new Map();
    for (const { file, guards } of entries) {
      const descriptor = guardDescriptor(guards, resolve);
      if (descriptor === null) continue;
      if (!byFile.has(file)) byFile.set(file, new Map());
      byFile.get(file).set(descriptor, guards);
    }
    for (const [, descriptors] of byFile) {
      // A file that declares the value in both arms of the same condition declares it
      // unconditionally; `web:py-10` sits in both returns of `settings-screen-shell.tsx`, and two
      // complementary clauses would say less than no clause at all.
      for (const [descriptor, guards] of [...descriptors]) {
        if (guards.length !== 1) continue;
        const complement = [...descriptors].find(([, other]) =>
          other.length === 1 && other[0].prop === guards[0].prop && other[0].value !== guards[0].value);
        if (!complement) continue;
        descriptors.delete(descriptor);
        descriptors.delete(complement[0]);
        descriptors.set('', []);
      }
      // An unguarded reading is strictly stronger than a guarded one from the same file.
      if (descriptors.has('') && descriptors.size > 1) {
        for (const descriptor of [...descriptors.keys()]) if (descriptor) descriptors.delete(descriptor);
      }
    }
    const published = new Map();
    for (const [file, descriptors] of byFile) if (descriptors.size) published.set(file, new Set(descriptors.keys()));
    if (published.size) facts.set(value, published);
  }
  return facts;
}

// Responsive facts, read from the AST of every file in the read set. Deliberately AST-based:
// the oracle that checks the rendered sentences greps the same files as text, and two
// derivations that share code agree with each other even when both are wrong.
export function extractPatternLayoutFacts(files) {
  const parsed = files.map(({ path: filePath, source }) => ({
    name: filePath.split('/').pop(),
    sourceFile: ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  }));

  const renderSites = new Map();
  for (const { sourceFile } of parsed) collectRenderSites(sourceFile, renderSites);
  const resolved = new Map();
  const resolve = (guard) => {
    const key = `${guard.component}.${guard.prop}.${guard.fallback}`;
    if (!resolved.has(key)) resolved.set(key, resolveRenderedProp(renderSites, guard));
    return resolved.get(key);
  };

  const sites = {
    primitives: new Map(),
    scrollContainers: new Map(),
    horizontal: new Map(),
    widths: new Map(),
    breakpointClasses: new Map(),
    platformClasses: new Map(),
    platformApi: new Map(),
    viewport: new Map(),
  };

  for (const { name, sourceFile } of parsed) {
    walkGuarded(sourceFile, { component: null, props: null, guards: [] }, (node, guards) => {
      const tag = jsxTagName(node);
      if (tag) {
        if (BEEUI_LAYOUT_PRIMITIVES.includes(tag)) addSite(sites.primitives, tag, name, guards);
        if (SCROLL_CONTAINERS.includes(tag)) addSite(sites.scrollContainers, tag, name, guards);
      }

      if (ts.isJsxAttribute(node) && node.name && ts.isIdentifier(node.name)) {
        const attribute = node.name.text;
        // `horizontal` with no initializer is `horizontal={true}`; `horizontal={false}` is the
        // vertical default written out and is not a horizontal-scrolling declaration.
        if (attribute === 'horizontal') {
          const off =
            node.initializer &&
            ts.isJsxExpression(node.initializer) &&
            node.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword;
          if (!off) addSite(sites.horizontal, 'horizontal', name, guards);
        }
        if (attribute === 'contentWidth' && node.initializer && ts.isStringLiteralLike(node.initializer)) {
          addSite(sites.widths, `contentWidth="${node.initializer.text}"`, name, guards);
        }
      }

      // `Platform.OS` / `Platform.select`, read as a property access rather than as the word
      // "Platform" anywhere in the file.
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Platform' &&
        (node.name.text === 'OS' || node.name.text === 'select')
      ) {
        addSite(sites.platformApi, `Platform.${node.name.text}`, name, guards);
      }

      if (ts.isIdentifier(node) && VIEWPORT_APIS.includes(node.text)) addSite(sites.viewport, node.text, name, guards);
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Dimensions' &&
        node.name.text === 'get'
      ) {
        addSite(sites.viewport, 'Dimensions.get', name, guards);
      }

      // Class names live in JSX string attributes, string literals and the fixed text of template
      // literals — read from the AST rather than the raw file text, so a comment naming
      // `md:flex-row` cannot publish a breakpoint the screen does not use. Read here rather than
      // in a second pass so a class inside `compact ? … : …` carries that branch's guard.
      const literals = ts.isStringLiteralLike(node) || ts.isTemplateHead(node)
        || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
        ? node.text.split(/\s+/u).filter(Boolean)
        : [];
      for (const token of literals) {
        if (MAX_WIDTH_CLASS.test(token)) addSite(sites.widths, token, name, guards);
        const prefixed = /^([a-z0-9]+):/u.exec(token);
        if (!prefixed) continue;
        if (BREAKPOINT_PREFIXES.includes(prefixed[1])) addSite(sites.breakpointClasses, token, name, guards);
        else if (PLATFORM_CLASS_PREFIXES.includes(prefixed[1])) addSite(sites.platformClasses, token, name, guards);
      }
    });
  }

  return Object.fromEntries(
    Object.entries(sites).map(([key, value]) => [key, resolveSites(value, resolve)]),
  );
}

// Shapes neither the AST extractor above nor the textual oracle below can see. None occurs in
// `apps/showcase/patterns/**` today; the point of failing on them is that the day one appears,
// CI stops rather than a page quietly losing a fact — an aliased `<Scroller />` would publish
// "no scroll container", which is exactly the class of silent false negative this whole
// derivation exists to prevent.
const OPAQUE_ALIAS_NAMES = new Set([
  ...BEEUI_LAYOUT_PRIMITIVES, ...SCROLL_CONTAINERS, ...VIEWPORT_APIS, 'Dimensions', 'Platform',
]);
const OPAQUE_NAMESPACE_MODULES = new Set(['@beemvp/beeui-ui', 'react-native']);

export function patternOpaqueShapeViolations(files) {
  const violations = [];
  const report = (file, shape) => violations.push(
    `${file}: uses ${shape}, which the pattern fact derivation cannot see. Rewrite it in a form ` +
    'the derivation reads, or teach both `extractPatternLayoutFacts` and the textual oracle to ' +
    'read it — publishing the page as it stands would drop a real fact silently.',
  );

  for (const { path: filePath, source } of files) {
    const name = filePath.split('/').pop();
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    walkNodes(sourceFile, (node) => {
      // `<React.Fragment>` is qualified too and hides nothing: only a qualified tag whose final
      // segment is a name this derivation keys on can turn a rendered primitive into silence.
      const tag = jsxTagNode(node);
      if (tag && !ts.isIdentifier(tag)) {
        const text = tag.getText(sourceFile);
        if (OPAQUE_ALIAS_NAMES.has(text.split('.').pop())) report(name, `the qualified JSX tag \`<${text}>\``);
      }

      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings) && OPAQUE_NAMESPACE_MODULES.has(node.moduleSpecifier.text)) {
          report(name, `a namespace import of \`${node.moduleSpecifier.text}\``);
        }
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            if (!element.propertyName || !OPAQUE_ALIAS_NAMES.has(element.propertyName.text)) continue;
            report(name, `the aliased import \`${element.propertyName.text} as ${element.name.text}\``);
          }
        }
      }

      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'Platform' || node.expression.text === 'Dimensions')
      ) {
        report(name, `element access on \`${node.expression.text}\``);
      }

      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        (node.initializer.text === 'Platform' || node.initializer.text === 'Dimensions')
      ) {
        report(name, `a destructure of \`${node.initializer.text}\``);
      }

      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) report(name, 'a dynamic `import()`');
        if (ts.isIdentifier(node.expression) && node.expression.text === 'require') report(name, '`require()`');
      }
    });
  }
  return violations;
}

// The renderer's absolute negatives and the oracles that refuse them, in one place — the same
// arrangement `public-component-reference.mjs` arrived at after a renamed sentence silently
// unhooked its guard while `--check` stayed green.
export const PATTERN_LAYOUT_NONE_CLAIM = '**BeeUI layout primitives rendered:** none';
// Element-level on purpose. "No scroll container is rendered" was the wrong answer to the
// question the label asks on nine auth pages: they render `<KeyboardAwareScreen>`, whose own
// source composes a `ScrollView`, so the screens do scroll. What the read set can decide is
// whether these files write a scrolling *element*; where they do not, the sentence hands the
// question to the composed family that owns it.
export const PATTERN_SCROLL_NONE_CLAIM =
  '**Scroll ownership:** no `ScrollView`, `FlatList`, `SectionList` or `VirtualizedList` element';
export const PATTERN_HORIZONTAL_NONE_CLAIM = '**Horizontal scrolling:** no `horizontal` scroll container';
export const PATTERN_WIDTH_NONE_CLAIM = '**Width constraint:** no `contentWidth` prop and no `max-w-*` class';
export const PATTERN_BREAKPOINT_NONE_CLAIM = '**Breakpoint-prefixed utility classes:** none';
export const PATTERN_PLATFORM_CLASS_NONE_CLAIM = '**Platform-prefixed utility classes:** none';
export const PATTERN_PLATFORM_API_NONE_CLAIM = '**Platform branching:** no `Platform.OS` or `Platform.select` call';
export const PATTERN_VIEWPORT_NONE_CLAIM = '**Viewport measurement:** no `useWindowDimensions`, `Dimensions.get` or breakpoint hook';
export const PATTERN_ROLES_NONE_CLAIM = '**Roles this screen sets itself:** none';
export const PATTERN_STATES_NONE_CLAIM = '**Accessibility states and properties it sets itself:** none';
export const PATTERN_COMPOSED_NONE_CLAIM = '**Semantics inherited from composed BeeUI families:** none imported';

// Each negative, and the comment-stripped grep that refutes it. A negative is the only claim
// shape a grep can decide, and it is the shape that does the damage: it is an assertion about
// everything the AST walk did not visit.
const PATTERN_NEGATIVE_ORACLES = [
  {
    claim: PATTERN_LAYOUT_NONE_CLAIM,
    pattern: new RegExp(`<\\s*(?:${BEEUI_LAYOUT_PRIMITIVES.join('|')})[\\s/>]`, 'u'),
    message: 'publishes "no BeeUI layout primitives" while its source renders one',
  },
  {
    claim: PATTERN_SCROLL_NONE_CLAIM,
    pattern: new RegExp(`<\\s*(?:${SCROLL_CONTAINERS.join('|')})[\\s/>]`, 'u'),
    message: 'publishes "no scroll container" while its source renders one',
  },
  {
    claim: PATTERN_HORIZONTAL_NONE_CLAIM,
    pattern: /(?<![\w.'"-])horizontal(?![\w-])/u,
    message: 'publishes "no horizontal scroll container" while its source mentions `horizontal`',
  },
  {
    claim: PATTERN_WIDTH_NONE_CLAIM,
    pattern: /contentWidth\s*[=:]|max-w-/u,
    message: 'publishes "no width constraint" while its source declares one',
  },
  {
    claim: PATTERN_BREAKPOINT_NONE_CLAIM,
    pattern: new RegExp(`(?<![\\w-])(?:${BREAKPOINT_PREFIXES.join('|')}):[a-z]`, 'u'),
    message: 'publishes "no breakpoint-prefixed utility classes" while its source contains one',
  },
  {
    claim: PATTERN_PLATFORM_CLASS_NONE_CLAIM,
    pattern: new RegExp(`(?<![\\w-])(?:${PLATFORM_CLASS_PREFIXES.join('|')}):[a-z]`, 'u'),
    message: 'publishes "no platform-prefixed utility classes" while its source contains one',
  },
  {
    claim: PATTERN_PLATFORM_API_NONE_CLAIM,
    pattern: /\bPlatform\s*\.\s*(?:OS|select)\b/u,
    message: 'publishes "no Platform branching" while its source branches on `Platform`',
  },
  {
    claim: PATTERN_VIEWPORT_NONE_CLAIM,
    pattern: new RegExp(`\\b(?:${VIEWPORT_APIS.join('|')})\\b|\\bDimensions\\s*\\.\\s*get\\b`, 'u'),
    message: 'publishes "no viewport measurement" while its source reads the viewport',
  },
  {
    claim: PATTERN_ROLES_NONE_CLAIM,
    pattern: /accessibilityRole\s*[=:]|(?<![\w-])role\s*=\s*["'{]/u,
    message: 'publishes "sets no roles itself" while its source sets a role',
  },
  {
    claim: PATTERN_STATES_NONE_CLAIM,
    pattern: /accessibility(?!Role\b)[A-Z]\w*\s*[=:]|(?<![\w-])(?:aria-[a-z]+|accessible)\s*=/u,
    message: 'publishes "sets no states or properties itself" while its source sets one',
  },
  {
    // Registered here for two reasons. It is a negative and so needs refuting like the rest, and
    // being a registered claim is also what keeps `publishedFactTokens` from reading the module
    // specifier inside it as a derived fact — a token no source that imports nothing contains,
    // which would have made the claim refute itself.
    claim: PATTERN_COMPOSED_NONE_CLAIM,
    pattern: /from\s*['"]@beemvp\/beeui-ui['"]/u,
    message: 'publishes "no composed BeeUI families" while its source imports from `@beemvp/beeui-ui`',
  },
];

// Exported so a test can require a refuting source for every registered claim: an oracle whose
// probe matches nothing refuses nothing, and would sit in this list looking like a guard.
export const ALL_PATTERN_NONE_CLAIMS = PATTERN_NEGATIVE_ORACLES.map((oracle) => oracle.claim);

function scopeSentence(files) {
  const names = files.map((file) => `\`${file.path.split('/').pop()}\``);
  return names.join(', ');
}

// A rendered bullet: either the positive form with the files each value was read from — and, for
// a value that only exists inside a prop-conditional branch, the condition that selects it — or
// the shared negative constant scoped to every file that was read.
//
// Group order puts the unconditional reading first, so `` `VStack` (`shell.tsx`) `` and
// `` `Box` (`shell.tsx`, the branch taken when `keyboardAware` is false) `` read as what they
// are: one fact that always holds and one that holds because of how this screen renders it.
function factLine(label, facts, noneClaim, readScope, noneSuffix = '') {
  if (!facts.size) return `- ${noneClaim} in ${readScope}${noneSuffix}.`;
  const values = [...facts.keys()].sort().map((value) => {
    const byCondition = new Map();
    for (const [file, conditions] of [...facts.get(value)].sort((a, b) => a[0].localeCompare(b[0]))) {
      for (const condition of [...conditions].sort()) {
        if (!byCondition.has(condition)) byCondition.set(condition, []);
        byCondition.get(condition).push(file);
      }
    }
    const groups = [...byCondition.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([condition, where]) => {
        const named = where.map((file) => `\`${file}\``).join(', ');
        return condition ? `${named}, ${condition}` : named;
      });
    return `\`${value}\` (${groups.join('; ')})`;
  });
  return `- **${label}:** ${values.join(', ')}.`;
}

// Every backticked token a positive line publishes, minus the file names it was read from. The
// oracle requires each to appear literally in the source, so a hand-written or hallucinated
// value cannot ship.
export function publishedFactTokens(section) {
  const tokens = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('- ')) continue;
    if (ALL_PATTERN_NONE_CLAIMS.some((claim) => line.includes(claim))) continue;
    for (const match of line.matchAll(/`([^`]+)`/gu)) {
      const token = match[1];
      if (/\.(?:tsx?|json|md)$/u.test(token)) continue;
      tokens.push(token);
    }
  }
  return tokens;
}

export function buildPublicPatternManifest(rootDir = ROOT_DIR) {
  const content = readJson('docs/pattern-library.content.json', rootDir);
  const runtimeIds = getPatternRuntimeIds(rootDir);
  return getPatternScreens(rootDir).map((screen) => {
    const curated = content.screens?.[screen.slug] ?? {};
    // The runtime Pattern Gallery owns screen identity; the file slug is not always that id.
    const runtime = runtimeIds.get(screen.file.split('/').pop());
    if (!runtime) throw new Error(`${screen.file}: no runtime Pattern Gallery id is registered for this screen.`);
    const runtimeId = runtime.id;
    return {
      ...screen,
      source: screen.file,
      title: titleFromSlug(screen.slug),
      purpose: curated.purpose ?? '',
      excluded: curated.excluded ?? '',
      route: `/docs/patterns/${screen.pack}/${screen.slug}/`,
      runtimeId,
      stateTargets: runtime.states.map((state) => ({
        state,
        href: `${showcaseHref({ surface: 'pattern', id: runtimeId, state })}&embed=1`,
      })),
      showcaseHref: `${showcaseHref({ surface: 'pattern', id: runtimeId })}&embed=1`,
      sourceHref: githubHref(screen.file),
    };
  });
}

export function collectPublicPatternViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const manifest = buildPublicPatternManifest(rootDir);
  const canonicalPacks = new Set(PATTERN_PACKS.map((pack) => pack.id));
  const names = new Set();
  const routes = new Set();

  for (const pattern of manifest) {
    const key = `${pattern.pack}/${pattern.slug}`;
    if (!canonicalPacks.has(pattern.pack)) violations.push(`${key}: unknown pack.`);
    if (names.has(key)) violations.push(`${key}: duplicate canonical pattern identity.`);
    names.add(key);
    if (routes.has(pattern.route)) violations.push(`${key}: duplicate public route ${pattern.route}.`);
    routes.add(pattern.route);
    if (!pattern.purpose.trim()) violations.push(`${key}: missing curated purpose.`);
    if (!pattern.excluded.trim()) violations.push(`${key}: missing excluded application logic.`);
    if (pattern.source !== pattern.file) violations.push(`${key}: source projection drifted from canonical screen file.`);
    if (!fs.existsSync(path.join(rootDir, pattern.source))) violations.push(`${key}: source file is missing.`);
    if (!pattern.beeuiComponents.length) violations.push(`${key}: no direct public BeeUI composition metadata.`);
    const expectedTarget = `${showcaseHref({ surface: 'pattern', id: pattern.runtimeId })}&embed=1`;
    if (pattern.showcaseHref !== expectedTarget) violations.push(`${key}: missing canonical Showcase deep link.`);
  }

  const contentNames = Object.keys(readJson('docs/pattern-library.content.json', rootDir).screens ?? {});
  const screenSlugs = new Set(manifest.map((pattern) => pattern.slug));
  for (const slug of contentNames) {
    if (!screenSlugs.has(slug)) violations.push(`${slug}: curated pattern no longer exists in the canonical gallery.`);
  }
  if (manifest.length !== contentNames.length) {
    violations.push(`public pattern count ${manifest.length} does not match curated canonical count ${contentNames.length}.`);
  }

  violations.push(...patternLayoutVocabularyViolations(rootDir));
  for (const pattern of manifest) {
    const key = `${pattern.pack}/${pattern.slug}`;
    const opaque = patternOpaqueShapeViolations(collectPatternSourceFiles(pattern.source, rootDir));
    violations.push(...opaque.map((violation) => `${key}: ${violation}`));
    violations.push(...collectPatternDerivedClaimViolations(renderPublicPatternPage(pattern, rootDir), pattern, rootDir));
  }

  return violations;
}

function linkedComposition(pattern, routes) {
  return pattern.beeuiComponents
    .map((symbol) => routes.has(symbol) ? `[\`${symbol}\`](${routes.get(symbol)})` : `\`${symbol}\``)
    .join(', ');
}

function renderStateTargets(pattern) {
  if (!pattern.stateTargets.length) return 'This screen exposes a single default state.';
  return `Each named state is directly addressable:\n\n${pattern.stateTargets
    .map(({ state, href }) => `- [\`${state}\`](${href})`)
    .join('\n')}`;
}

function renderState(pattern) {
  const props = pattern.propsType ? `\`${pattern.propsType}\`` : 'caller-owned props';
  const callbacks = pattern.callbacks.length ? pattern.callbacks.map((name) => `\`${name}\``).join(', ') : 'no explicit `on*` callback props detected';
  return `The screen is controlled through ${props}. User intent crosses the application boundary through ${callbacks}; fetching, routing, persistence and side effects remain application-owned.`;
}

// Extracts the verbatim source text of `export type <typeName> = { ... }` (or an
// equivalent `interface <typeName> { ... }`) from a TSX source file, using the
// TypeScript compiler API rather than a regex so the extraction cannot be fooled by
// nested braces, comments or multi-line generics inside the props type body.
export function extractPropsTypeSource(source, typeName) {
  if (!typeName) return null;
  const sourceFile = ts.createSourceFile('pattern-screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let match = null;
  const visit = (node) => {
    if (match) return;
    if ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name.text === typeName) {
      match = source.slice(node.getStart(sourceFile), node.getEnd());
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return match;
}

// The fenced-code rendering of a pattern's *ScreenProps type. Falls back to a plain
// notice (never a fabricated second copy of the fields) when no props type or no
// matching declaration can be derived from the showcase source.
function renderPropsBlock(pattern, rootDir) {
  if (!pattern.propsType) return '_No exported props type was found in the screen source._';
  const source = fs.readFileSync(path.join(rootDir, pattern.source), 'utf8');
  const propsSource = extractPropsTypeSource(source, pattern.propsType);
  if (!propsSource) return '_No exported props type was found in the screen source._';
  return `\`\`\`tsx\n${propsSource}\n\`\`\``;
}

// The BeeUI symbols imported anywhere in the read set, and the files importing them. Wider than
// `pattern.beeuiComponents`, which is the screen file alone: the shell a screen imports composes
// half its surface, and the reader needs to know where those semantics are documented.
export function extractPatternBeeuiImports(files) {
  const imports = new Map();
  for (const { path: filePath, source } of files) {
    const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, kind);
    const name = filePath.split('/').pop();
    walkNodes(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      if (!ts.isStringLiteralLike(node.moduleSpecifier)) return;
      if (node.moduleSpecifier.text !== '@beemvp/beeui-ui') return;
      const bindings = node.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) return;
      // A type-only import documents nothing a user can interact with.
      if (node.importClause.isTypeOnly) return;
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue;
        addFact(imports, element.name.text, name);
      }
    });
  }
  return imports;
}

const NO_SOURCE_NOTICE = '_No source file for this screen could be read, so no fact is derived here._';

// The read set is a transitive closure, not a direct-import list: `wallet-screen.tsx` imports
// four local files and reaches `trend-indicator.tsx` through `balance-card.tsx`. Saying "the 5
// files it imports" asserted a direct relation that does not hold on three pages.
function readScopePreamble(files) {
  const rest = files.length - 1;
  const shared = rest === 0
    ? 'the screen file alone'
    : `the screen file and the ${rest} pattern-local file${rest === 1 ? '' : 's'} in its runtime ` +
      'import closure, direct and transitive';
  return `Read from ${shared}: ${scopeSentence(files)}. Every fact below is scoped to those files and to nothing else.`;
}

// The BeeUI layout primitives whose own source renders a scrolling element, derived from the
// component manifest rather than listed by hand: `KeyboardAwareScreen` composes a `ScrollView`
// and `Screen` does not, and a hand-kept list would not notice if that changed.
const scrollOwningCache = new Map();
function scrollOwningPrimitives(rootDir) {
  const cached = scrollOwningCache.get(rootDir);
  if (cached) return cached;
  const probe = new RegExp(`<\\s*(?:${SCROLL_CONTAINERS.join('|')})[\\s/>]`, 'u');
  const owning = new Set();
  for (const component of buildPublicComponentManifest(rootDir)) {
    const layout = component.values.filter((value) => BEEUI_LAYOUT_PRIMITIVES.includes(value));
    if (!layout.length) continue;
    const sources = component.allSources ?? [component.source];
    const scrolls = sources.some((relPath) => {
      const abs = path.join(rootDir, relPath);
      if (!relPath || relPath.endsWith('.d.ts') || !fs.existsSync(abs)) return false;
      return probe.test(stripSourceComments(fs.readFileSync(abs, 'utf8')));
    });
    if (scrolls) for (const value of layout) owning.add(value);
  }
  scrollOwningCache.set(rootDir, owning);
  return owning;
}

function renderResponsiveFacts(files, rootDir) {
  if (!files.length) return NO_SOURCE_NOTICE;
  const readScope = scopeSentence(files);
  const facts = extractPatternLayoutFacts(files);
  // Where these files render no scrolling element but do compose one that scrolls, the negative
  // says who owns the scrolling instead of leaving the reader with "this screen does not scroll".
  const owners = [...facts.primitives.keys()].filter((name) => scrollOwningPrimitives(rootDir).has(name)).sort();
  const scrollSuffix = owners.length
    ? `; scrolling is owned by the composed ${owners.map((name) => `\`${name}\``).join(', ')}, ` +
      `whose own page${owners.length === 1 ? '' : 's'} derive${owners.length === 1 ? 's' : ''} it`
    : '';
  const lines = [
    factLine('BeeUI layout primitives rendered', facts.primitives, PATTERN_LAYOUT_NONE_CLAIM, readScope),
    factLine('Scroll ownership', facts.scrollContainers, PATTERN_SCROLL_NONE_CLAIM, readScope, scrollSuffix),
    factLine('Horizontal scrolling', facts.horizontal, PATTERN_HORIZONTAL_NONE_CLAIM, readScope),
    factLine('Width constraint', facts.widths, PATTERN_WIDTH_NONE_CLAIM, readScope),
    factLine('Breakpoint-prefixed utility classes', facts.breakpointClasses, PATTERN_BREAKPOINT_NONE_CLAIM, readScope),
    factLine('Platform-prefixed utility classes', facts.platformClasses, PATTERN_PLATFORM_CLASS_NONE_CLAIM, readScope),
    factLine('Platform branching', facts.platformApi, PATTERN_PLATFORM_API_NONE_CLAIM, readScope),
    factLine('Viewport measurement', facts.viewport, PATTERN_VIEWPORT_NONE_CLAIM, readScope),
  ];
  return `${readScopePreamble(files)}\n\n${lines.join('\n')}`;
}

function renderPatternAccessibilityFacts(files, routes) {
  if (!files.length) return NO_SOURCE_NOTICE;
  const readScope = scopeSentence(files);
  const { roles, states } = collectScopedAccessibilityFacts(files);

  // Attribution per fact, not per line. A pattern reads five or six files, so "`a`, `b`, `c` —
  // read from `x.tsx`, `y.tsx`, `z.tsx`" is a set-to-set statement that a reader takes file by
  // file: on the Product Search page it would have said `product-card.tsx` sets
  // `accessibilityIgnoresInvertColors`, which only `product-image.tsx` sets. Which file sets
  // which comes out of the same scan, so each fact carries its own files, as the responsive
  // lines do. A fact is attributed to a file only where the file's own platform scope overlaps
  // the scope the fact is published under, so a branch no target reaches names no file.
  const perFile = files.map((file) => ({
    name: file.path.split('/').pop(),
    facts: collectScopedAccessibilityFacts([file]),
  }));
  const qualified = (facts, pick) =>
    [...facts.keys()].sort().map((fact) => {
      const platforms = facts.get(fact);
      const where = perFile
        .filter((entry) => {
          const scope = pick(entry.facts).get(fact);
          return scope && [...scope].some((platform) => platforms.has(platform));
        })
        .map((entry) => `\`${entry.name}\``)
        .join(', ');
      const label = platformLabel(platforms);
      return label ? `\`${fact}\` (${label}; ${where})` : `\`${fact}\` (${where})`;
    }).join(', ');

  const roleLine = roles.size
    ? `- **Roles this screen sets itself:** ${qualified(roles, (facts) => facts.roles)}.`
    : `- ${PATTERN_ROLES_NONE_CLAIM} set in ${readScope}.`;
  const stateLine = states.size
    ? `- **Accessibility states and properties it sets itself:** ${qualified(states, (facts) => facts.states)}.`
    : `- ${PATTERN_STATES_NONE_CLAIM} set in ${readScope}.`;

  // Where the rest of the semantics live. The families are named, not their facts: restating a
  // component's roles here would be a second copy that drifts from the page that derives them.
  const composed = [...extractPatternBeeuiImports(files).keys()].sort();
  const linked = composed.filter((symbol) => routes.has(symbol));
  const unlinked = composed.filter((symbol) => !routes.has(symbol));
  const composedLine = linked.length
    ? `- **Semantics inherited from composed BeeUI families:** ${linked
        .map((symbol) => `[\`${symbol}\`](${routes.get(symbol)})`)
        .join(', ')} — each family's own page derives the roles and states it sets; they are not restated here.`
    : `- ${PATTERN_COMPOSED_NONE_CLAIM} in ${readScope}.`;
  const unlinkedLine = unlinked.length
    ? `\n- **Imported from \`@beemvp/beeui-ui\` with no public component page:** ${unlinked
        .map((symbol) => `\`${symbol}\``)
        .join(', ')}.`
    : '';

  return `${readScopePreamble(files)}\n\n${roleLine}\n${stateLine}\n${composedLine}${unlinkedLine}`;
}

// --- The oracle's own branch resolution, done as text -----------------------
//
// The extractor above resolves branches through the TypeScript AST. This does the same job by
// counting braces and quotes, and the two never share a line of code, because two derivations
// that share code agree with each other even when both are wrong. Where they disagree, the
// disagreement surfaces as a violation rather than as a page.
//
// Failing to recognise a construct here is safe in one direction only, and that is the direction
// it fails in: an unrecognised branch leaves its text live, so a negative gets probed against
// more source than it should and the page is refused. It never silently blesses a claim.

// Walks the source once, skipping string and template bodies, and returns `open → close` for
// every brace pair. Comments are already stripped by the caller.
function braceIndex(source) {
  const pairs = new Map();
  const stack = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') { index = skipStringLiteral(source, index); continue; }
    if (char === '{') stack.push(index);
    else if (char === '}') {
      const open = stack.pop();
      if (open !== undefined) pairs.set(open, index);
    }
    index += 1;
  }
  return pairs;
}

function skipStringLiteral(source, start) {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') { index += 2; continue; }
    if (char === quote) return index + 1;
    if (quote === '`' && char === '$' && source[index + 1] === '{') {
      let depth = 1;
      index += 2;
      while (index < source.length && depth) {
        const inner = source[index];
        if (inner === '"' || inner === "'" || inner === '`') { index = skipStringLiteral(source, index); continue; }
        if (inner === '{') depth += 1;
        else if (inner === '}') depth -= 1;
        index += 1;
      }
      continue;
    }
    index += 1;
  }
  return index;
}

// `function Name({ a, b = false })` / `const Name = ({ a })`, with the body range so a condition
// can be attributed to the component that declares the prop it reads.
const TEXT_COMPONENT = /(?:function\s+([A-Z][\w$]*)|const\s+([A-Z][\w$]*)\s*(?::[^=]*?)?=\s*)\s*\(\s*\{([^}]*)\}/gu;

function textComponents(source, pairs) {
  const components = [];
  for (const match of source.matchAll(TEXT_COMPONENT)) {
    const name = match[1] ?? match[2];
    const props = new Map();
    for (const part of match[3].split(',')) {
      const binding = /^\s*([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_$][\w$]*)\s*)?(?:=\s*(.+?))?\s*$/u.exec(part);
      if (!binding) continue;
      const local = binding[2] ?? binding[1];
      const external = binding[1];
      const fallback = binding[3] === 'true' ? true : binding[3] === 'false' ? false : null;
      props.set(local, { external, fallback });
    }
    // The body opens at the first brace after the parameter list closes.
    let index = match.index + match[0].length;
    let depth = 1;
    while (index < source.length && depth) {
      const char = source[index];
      if (char === '"' || char === "'" || char === '`') { index = skipStringLiteral(source, index); continue; }
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      index += 1;
    }
    const body = source.indexOf('{', index);
    const end = body === -1 ? -1 : pairs.get(body);
    if (end === undefined || end === -1) continue;
    components.push({ name, props, start: body, end });
  }
  return components;
}

function innermostComponent(components, index) {
  let found = null;
  for (const component of components) {
    if (index < component.start || index > component.end) continue;
    if (!found || component.start > found.start) found = component;
  }
  return found;
}

function innermostBrace(pairs, index) {
  let found = null;
  for (const [open, close] of pairs) {
    if (index <= open || index >= close) continue;
    if (!found || open > found.open) found = { open, close };
  }
  return found;
}

// `a ? b : c` starting at the `?`: the character ranges of the two arms.
function ternaryArms(source, question) {
  let depth = 0;
  let nested = 0;
  let colon = -1;
  let index = question + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') { index = skipStringLiteral(source, index); continue; }
    if (char === '(' || char === '[' || char === '{') { depth += 1; index += 1; continue; }
    if (char === ')' || char === ']' || char === '}') {
      if (!depth) return null;
      depth -= 1;
      index += 1;
      continue;
    }
    if (!depth && char === '?' && source[index + 1] !== '.' && source[index + 1] !== ':') { nested += 1; index += 1; continue; }
    if (!depth && char === ':') {
      if (!nested) { colon = index; break; }
      nested -= 1;
      index += 1;
      continue;
    }
    if (!depth && (char === ',' || char === ';')) return null;
    index += 1;
  }
  if (colon === -1) return null;
  depth = 0;
  index = colon + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') { index = skipStringLiteral(source, index); continue; }
    if (char === '(' || char === '[' || char === '{') { depth += 1; index += 1; continue; }
    if (char === ')' || char === ']' || char === '}') {
      if (!depth) break;
      depth -= 1;
      index += 1;
      continue;
    }
    if (!depth && (char === ',' || char === ';')) break;
    index += 1;
  }
  return { whenTrue: [question + 1, colon], whenFalse: [colon + 1, index] };
}

// Every prop-conditional character range in one file.
function textConditionalRegions(source, pairs, components) {
  const regions = [];
  const record = (owner, local, value, start, end) => {
    const declared = owner.props.get(local);
    if (!declared || end <= start) return;
    regions.push({ component: owner.name, prop: declared.external, fallback: declared.fallback, value, start, end });
  };

  for (const match of source.matchAll(/\bif\s*\(\s*(!?)\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/gu)) {
    const open = match.index + match[0].length - 1;
    const close = pairs.get(open);
    const owner = innermostComponent(components, match.index);
    if (close === undefined || !owner) continue;
    const value = !match[1];
    record(owner, match[2], value, open, close + 1);
    // `if (p) { return … }` with no else: the rest of the enclosing block is the else arm.
    if (!/\breturn\b/u.test(source.slice(open, close))) continue;
    if (/^\s*else\b/u.test(source.slice(close + 1))) continue;
    const enclosing = innermostBrace(pairs, match.index);
    if (enclosing) record(owner, match[2], !value, close + 1, enclosing.close);
  }

  for (const match of source.matchAll(/(!)?\s*\b([A-Za-z_$][\w$]*)\s*\?(?![.:?])/gu)) {
    const question = match.index + match[0].length - 1;
    const owner = innermostComponent(components, question);
    if (!owner) continue;
    const arms = ternaryArms(source, question);
    if (!arms) continue;
    const value = !match[1];
    record(owner, match[2], value, arms.whenTrue[0], arms.whenTrue[1]);
    record(owner, match[2], !value, arms.whenFalse[0], arms.whenFalse[1]);
  }

  return regions;
}

// The opening tag text of every `<Name …>` in the file, so the prop a branch reads can be
// resolved from what the screen actually passes.
function textRenderSites(source, names) {
  const sites = [];
  for (const name of names) {
    for (const match of source.matchAll(new RegExp(`<${name}(?![\\w$])`, 'gu'))) {
      let index = match.index + match[0].length;
      let depth = 0;
      while (index < source.length) {
        const char = source[index];
        if (char === '"' || char === "'" || char === '`') { index = skipStringLiteral(source, index); continue; }
        if (char === '{') { depth += 1; index += 1; continue; }
        if (char === '}') { depth -= 1; index += 1; continue; }
        if (!depth && char === '>') break;
        index += 1;
      }
      sites.push({ component: name, attributes: source.slice(match.index + match[0].length, index) });
    }
  }
  return sites;
}

function textPassedProp(attributes, prop) {
  if (/\{\s*\.\.\./u.test(attributes)) return null;
  const literal = new RegExp(`(?<![\\w$-])${prop}\\s*=\\s*\\{\\s*(true|false)\\s*\\}`, 'u').exec(attributes);
  if (literal) return literal[1] === 'true';
  if (new RegExp(`(?<![\\w$-])${prop}\\s*=`, 'u').test(attributes)) return null;
  if (new RegExp(`(?<![\\w$-])${prop}(?![\\w$-])`, 'u').test(attributes)) return true;
  return undefined;
}

// Per file: the comment-stripped source, its prop-conditional ranges, and the same source with
// every range this screen does not select blanked out. Negatives are probed against the blanked
// text, so "no platform-prefixed utility class" is decided on the branch the screen takes.
export function patternBranchAnalysis(files) {
  const prepared = files.map((file) => {
    const stripped = stripSourceComments(file.source);
    const pairs = braceIndex(stripped);
    const components = textComponents(stripped, pairs);
    return {
      name: file.path.split('/').pop(),
      stripped,
      components,
      regions: textConditionalRegions(stripped, pairs, components),
    };
  });

  const names = new Set(prepared.flatMap((file) => file.components.map((component) => component.name)));
  const sites = prepared.flatMap((file) => textRenderSites(file.stripped, names));
  const selected = (region) => {
    const rendered = sites.filter((site) => site.component === region.component);
    if (!rendered.length) return null;
    const values = new Set();
    for (const site of rendered) {
      const passed = textPassedProp(site.attributes, region.prop);
      if (passed === null) return null;
      values.add(passed === undefined ? region.fallback : passed);
    }
    return values.has(null) ? null : values;
  };

  return prepared.map((file) => {
    const live = [...file.stripped];
    for (const region of file.regions) {
      const values = selected(region);
      if (!values || values.has(region.value)) continue;
      for (let index = region.start; index < region.end; index += 1) live[index] = ' ';
    }
    return { ...file, live: live.join('') };
  });
}

// Where `value` occurs in `text` as a whole token. Class names carry `-`, `[` and `:`, so a plain
// `indexOf` would find `max-w-md` inside `max-w-md-x` and `Box` inside `BoxProps`.
function tokenOccurrences(text, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const probe = new RegExp(`(?<![\\w$-])${escaped}(?![\\w-])`, 'gu');
  return [...text.matchAll(probe)].map((match) => match.index);
}

// The fact groups a positive bullet publishes: the value, the files it names, and the condition
// clause, if any. Parsed back out of the rendered page rather than taken from the renderer, so a
// value that lost its condition on the way to the page is still caught.
export function publishedFactGroups(section) {
  const groups = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('- ')) continue;
    if (ALL_PATTERN_NONE_CLAIMS.some((claim) => line.includes(claim))) continue;
    for (const match of line.matchAll(/`([^`]+)`\s*\(([^)]*)\)/gu)) {
      const value = match[1];
      if (/\.(?:tsx?|json|md)$/u.test(value)) continue;
      for (const part of match[2].split(';')) {
        const named = [...part.matchAll(/`([^`]+)`/gu)]
          .map((file) => file[1])
          .filter((file) => /\.tsx?$/u.test(file));
        if (!named.length) continue;
        // Only the file names come out: the condition names the prop in backticks too, and that
        // name is the part of the clause worth reading back.
        const condition = part.replace(/`[^`]+\.tsx?`/gu, '').replace(/^[\s,]+|[\s,]+$/gu, '');
        groups.push({ value, files: named, condition });
      }
    }
  }
  return groups;
}

// The independent oracle for the two derived sections, greping the same files as text after
// stripping comments. It shares the claim constants with the renderer — that is the point, a
// guard keyed on a phrase stops guarding the moment the phrase is edited — and shares no
// derivation code with it.
export function collectPatternDerivedClaimViolations(page, pattern, rootDir = ROOT_DIR) {
  const violations = [];
  const files = collectPatternSourceFiles(pattern.source, rootDir);
  const key = `${pattern.pack}/${pattern.slug}`;
  if (!files.length) return violations;
  const analysis = patternBranchAnalysis(files);
  const byName = new Map(analysis.map((file) => [file.name, file]));
  const sources = analysis.map((file) => file.live).join('\n');

  for (const { claim, pattern: probe, message } of PATTERN_NEGATIVE_ORACLES) {
    if (!page.includes(claim)) continue;
    if (!probe.test(sources)) continue;
    violations.push(`${key}: ${message} (${probe.source}).`);
  }

  // The other direction, which the component pages left unguarded and which published a false
  // "platform-split source files" sentence on calendar.md: a positive claim naming something the
  // source does not contain. Every value the two sections publish was read out of the branches
  // this screen selects, so every one of them must still be findable in them as text — a fact
  // lifted from a branch the screen never renders is gone from `live` and fails here.
  const sections = [
    { body: sectionBody(page, 'Responsive contract'), branchScoped: true },
    { body: sectionBody(page, 'Accessibility'), branchScoped: false },
  ];
  for (const { body: section, branchScoped } of sections) {
    for (const token of publishedFactTokens(section)) {
      if (sources.includes(token)) continue;
      violations.push(`${key}: publishes \`${token}\` as a derived fact, which none of its source files contains.`);
    }

    // A fact that exists in a file only inside a prop-conditional branch is not a fact about the
    // screen until the condition is named. Publishing `contentWidth="md"` bare, from a shell
    // branch reached only when `keyboardAware` is passed, is what this refuses.
    //
    // Applied to the responsive facts, which are the ones derived with branch awareness. The
    // accessibility facts come from the shared component-page scan, which is platform-scoped but
    // not prop-scoped, and `transaction-row.tsx` writes `accessibilityRole={onPress ? 'button' :
    // undefined}` — a live branch every screen selects, but one this rule would demand a clause
    // for that the accessibility derivation cannot produce. The dead-branch check above still
    // covers both sections: a fact lifted out of a branch the screen never selects is blanked
    // from `live` and refused there, whichever section publishes it.
    if (!branchScoped) continue;
    for (const { value, files: named, condition } of publishedFactGroups(section)) {
      if (condition) continue;
      for (const name of named) {
        const file = byName.get(name);
        if (!file) continue;
        const occurrences = tokenOccurrences(file.live, value);
        if (!occurrences.length) continue;
        const covering = occurrences.map((at) =>
          file.regions.filter((region) => at >= region.start && at < region.end));
        // One occurrence outside every branch makes the fact unconditional in this file.
        if (covering.some((regions) => !regions.length)) continue;
        // So does a value written into both arms of the same condition, which is how
        // `settings-screen-shell.tsx` declares `web:py-10`.
        const arms = new Map();
        for (const regions of covering) {
          for (const region of regions) {
            const condition = `${region.component}.${region.prop}`;
            if (!arms.has(condition)) arms.set(condition, new Set());
            arms.get(condition).add(region.value);
          }
        }
        if ([...arms.values()].some((values) => values.size > 1)) continue;
        const conditions = [...arms.keys()].map((condition) => `\`${condition.split('.').pop()}\``).join(', ');
        violations.push(
          `${key}: publishes \`${value}\` from \`${name}\` with no condition, but \`${name}\` only ` +
          `declares it inside a prop-conditional branch (${conditions}). A fact that depends on a ` +
          'branch must name the condition that selects it.',
        );
      }
    }
  }

  // Page against itself. The Composition section lists the screen file's own BeeUI imports, so a
  // layout primitive named there and a "no layout primitives" line below it cannot both be true.
  if (page.includes(PATTERN_LAYOUT_NONE_CLAIM)) {
    for (const symbol of pattern.beeuiComponents ?? []) {
      if (!BEEUI_LAYOUT_PRIMITIVES.includes(symbol)) continue;
      violations.push(
        `${key}: publishes "${PATTERN_LAYOUT_NONE_CLAIM}" while its own Composition list names the ` +
        `layout primitive \`${symbol}\`.`,
      );
    }
  }

  for (const role of publishedPatternRoles(page)) {
    if (KNOWN_ACCESSIBILITY_ROLES.has(role)) continue;
    violations.push(
      `${key}: publishes \`${role}\` as an accessibility role, which is not one. Either the ` +
      'derivation read a value that is not a role, or the role is new and belongs in ' +
      '`KNOWN_ACCESSIBILITY_ROLES`.',
    );
  }

  return violations;
}

// The text under `## <heading>`, up to the next `## `. Section-scoped so a token quoted in the
// curated purpose or in the props code block is not read as a derived fact.
export function sectionBody(page, heading) {
  const start = page.indexOf(`\n## ${heading}\n`);
  if (start === -1) return '';
  const from = start + `\n## ${heading}\n`.length;
  const next = page.indexOf('\n## ', from);
  return next === -1 ? page.slice(from) : page.slice(from, next);
}

function publishedPatternRoles(page) {
  const line = page.split('\n').find((candidate) => candidate.includes('**Roles this screen sets itself:**'));
  // Keyed on the shared constant, not on a phrase: the negative line names its scope in
  // backticks, and reading those as roles would refuse every page that assigns none.
  if (!line || line.includes(PATTERN_ROLES_NONE_CLAIM)) return [];
  // Each role is followed by the files it was read from, in the same backticks. A source file is
  // not a role; the extension is what tells them apart.
  return [...line.matchAll(/`([^`]+)`/gu)]
    .map((match) => match[1])
    .filter((token) => !/\.(?:tsx?|json|md)$/u.test(token));
}

// Guards the closed vocabulary itself: a name in `BEEUI_LAYOUT_PRIMITIVES` that no BeeUI package
// exports would make every page's primitive list a claim about something that does not ship.
export function patternLayoutVocabularyViolations(rootDir = ROOT_DIR) {
  const exported = new Set();
  for (const component of buildPublicComponentManifest(rootDir)) {
    for (const value of component.values) exported.add(value);
  }
  return BEEUI_LAYOUT_PRIMITIVES
    .filter((name) => !exported.has(name))
    .map((name) => `BEEUI_LAYOUT_PRIMITIVES names \`${name}\`, which is not a public BeeUI export.`);
}

export function renderPublicPatternPage(pattern, rootDir = ROOT_DIR) {
  const routes = symbolRouteMap(rootDir);
  const composition = linkedComposition(pattern, routes);
  const sourceFiles = collectPatternSourceFiles(pattern.source, rootDir);
  return `---\ntitle: ${JSON.stringify(pattern.title)}\ndescription: ${JSON.stringify(pattern.purpose)}\n---\n\n<!-- Generated by scripts/public-pattern-reference.mjs. Do not hand-edit. -->\n\n${pattern.purpose}\n\n## Preview\n\n[Open the exact pattern in the real BeeUI Web Showcase](${pattern.showcaseHref}). This is a Web runtime preview, not native-device evidence.\n\n${renderStateTargets(pattern)}\n\nThe same source is available at [\`${pattern.source}\`](${pattern.sourceHref}).\n\n## Composition\n\nPrincipal public BeeUI exports used by this screen: ${composition}.\n\nThe pattern is a composition recipe rather than a new framework layer. Follow the linked component contracts for state, provider, platform and accessibility details.\n\n## State and callback contract\n\n${renderState(pattern)}\n\n${renderPropsBlock(pattern, rootDir)}\n\nCommon product states such as loading, success, empty, error, permission-like recovery, filtering/search/selection or pagination are represented only where the actual screen source exposes them. The pattern docs do not invent backend states that the fixture does not render.\n\n## Responsive contract\n\n${renderResponsiveFacts(sourceFiles, rootDir)}\n\nBeeUI's [mobile-first responsive contract](/docs/responsive/) is the framework-level document; the list above states only what this screen's own files declare, and says nothing about how the composed components behave internally.\n\n## Accessibility\n\n${renderPatternAccessibilityFacts(sourceFiles, routes)}\n\nTouch-target size, focus order, announcements, RTL, large-text and reduced-motion behavior are not derived from this source — see the [Accessibility guide](/docs/accessibility/) for what is and is not covered by evidence. A Web preview does not substitute for VoiceOver/TalkBack runtime evidence.\n\n## Application ownership boundary\n\n**Intentionally excluded:** ${pattern.excluded}\n\nBeeUI does not take ownership of app routing, authentication/business rules, APIs/data fetching, persistence, form/state frameworks, chart frameworks or backend logic merely because a pattern visually composes those product concepts.\n\n## Source ownership\n\n\`${pattern.componentName}\` is **Showcase source you copy**, not a package export: it is not shipped from any \`@beemvp/beeui-*\` package, and the Registry CLI (\`pnpm beeui list\` / \`pnpm beeui add\`) does not carry pattern screens. Copy [\`${pattern.source}\`](${pattern.sourceHref}) into your app and adapt it directly. Only the individual BeeUI components it composes (linked above) are available for source ownership through the repository-local Registry workflow; before public CLI publication, use [CLI & source ownership](/docs/guides/cli-source-ownership/) from a BeeUI checkout rather than a public \`npx\` command.\n\n## Related\n\n- [All production patterns](/docs/patterns/)\n- [Component reference](/docs/components/)\n- [Showcase](/showcase/)\n- [Production reference app](/demo/)\n- [Source](${pattern.sourceHref})\n`;
}

export function renderPublicPatternIndex(manifest) {
  const byPack = new Map(PATTERN_PACKS.map((pack) => [pack.id, []]));
  for (const pattern of manifest) byPack.get(pattern.pack)?.push(pattern);
  const sections = PATTERN_PACKS.map((pack) => {
    const patterns = byPack.get(pack.id) ?? [];
    return `## ${pack.title}\n\n${patterns.map((pattern) => `- **[${pattern.title}](${pattern.route})** — ${pattern.purpose} · [Showcase](${pattern.showcaseHref})`).join('\n')}`;
  }).join('\n\n');
  // A catalog, not a link list: each entry carries what a reader needs to decide whether to
  // open it — the components it composes, the states it exposes, and the application
  // responsibilities it deliberately leaves out.
  const catalog = PATTERN_PACKS.map((pack) => {
    const patterns = byPack.get(pack.id) ?? [];
    const rows = patterns.map((pattern) => {
      // stateTargets is the canonical list from #472; there is no `states` field, and
      // defaulting to `default` would have quietly claimed every pattern has one state.
      const states = pattern.stateTargets.length
        ? pattern.stateTargets.map((target) => `\`${target.state}\``).join(', ')
        : '—';
      const components = pattern.beeuiComponents.slice(0, 6).map((name) => `\`${name}\``).join(', ');
      const more = pattern.beeuiComponents.length > 6 ? `, +${pattern.beeuiComponents.length - 6} more` : '';
      return `| **[${pattern.title}](${pattern.route})** | ${pattern.purpose} | ${states} | ${components}${more} | [Open](${pattern.showcaseHref}) |`;
    }).join('\n');
    return `## ${pack.title}\n\n${patterns.length} pattern${patterns.length === 1 ? '' : 's'}.\n\n` +
      `| Pattern | Purpose | Named states | Composes | Showcase |\n| --- | --- | --- | --- | --- |\n${rows}`;
  }).join('\n\n');

  return `---\ntitle: Production patterns\ndescription: Every canonical BeeUI screen pattern, the components it composes and the states it exposes.\n---\n\n<!-- Generated by scripts/public-pattern-reference.mjs. Do not hand-edit. -->\n\n**${manifest.length}** canonical screen patterns across **${PATTERN_PACKS.length}** source-defined domain packs. The inventory comes from \`apps/showcase/patterns/**/screens\`; purpose and application-boundary prose come from \`docs/pattern-library.content.json\`. CI fails if either side drifts.\n\nA pattern is a **composition recipe**, not a framework layer and not an application. Fetching, routing, persistence, authentication and business rules stay in your app — each detail page states exactly what the pattern excludes. For a routed product application built from these, see the [Demo](/demo/).\n\nEvery \`Showcase\` link opens the real Web runtime at that exact pattern; named states are individually addressable from each detail page. Web preview is not native-device evidence.\n\n${catalog}\n`;
}

export function generatePublicPatternPages({ rootDir = ROOT_DIR, outDir = path.join(rootDir, PUBLIC_PATTERN_DIR) } = {}) {
  const violations = collectPublicPatternViolations(rootDir);
  if (violations.length) throw new Error(`Public pattern contract failed:\n- ${violations.join('\n- ')}`);
  const manifest = buildPublicPatternManifest(rootDir);
  // The output directory is the section root now, so only pack directories this generator
  // owns may be removed — never a sibling page an author added beside them.
  fs.mkdirSync(outDir, { recursive: true });
  const ownedPacks = new Set(manifest.map((pattern) => pattern.pack));
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !ownedPacks.has(entry.name)) fs.rmSync(path.join(outDir, entry.name), { recursive: true });
  }
  for (const pack of ownedPacks) {
    const dir = path.join(outDir, pack);
    if (!fs.existsSync(dir)) continue;
    const ownedSlugs = new Set(manifest.filter((pattern) => pattern.pack === pack).map((pattern) => `${pattern.slug}.md`));
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.md') && !ownedSlugs.has(entry)) fs.rmSync(path.join(dir, entry));
    }
  }
  fs.writeFileSync(path.join(outDir, 'index.md'), renderPublicPatternIndex(manifest));
  for (const pattern of manifest) {
    const dir = path.join(outDir, pattern.pack);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${pattern.slug}.md`), renderPublicPatternPage(pattern, rootDir));
  }
  return manifest;
}

function main() {
  const check = process.argv.includes('--check');
  const violations = collectPublicPatternViolations(ROOT_DIR);
  if (violations.length) {
    console.error('Public pattern reference check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  if (check) {
    console.log(`Public pattern reference check passed (${buildPublicPatternManifest(ROOT_DIR).length} canonical patterns).`);
    return;
  }
  const manifest = generatePublicPatternPages();
  console.log(`Generated ${manifest.length} public pattern pages under ${PUBLIC_PATTERN_DIR}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
