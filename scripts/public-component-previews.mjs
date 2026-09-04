#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { showcaseHref } from '../apps/showcase/showcase-target.ts';
import {
  PUBLIC_COMPONENT_DIR,
  buildPublicComponentManifest,
} from './public-component-reference.mjs';
import {
  ROOT_DIR,
  buildShowcaseUsageIndex,
  usageForComponent,
} from './component-docs-lib.mjs';

function anatomy(component) {
  const rootCandidate = component.title.replaceAll(' ', '');
  const root = component.values.find((value) => value === rootCandidate) ?? component.values[0];
  const parts = component.values.filter((value) => value !== root);
  const lines = [`- **Family root / primary export:** \`${root}\``];
  if (parts.length) {
    lines.push('  - Public composition parts / helpers:');
    for (const part of parts) lines.push(`    - \`${part}\``);
  }
  if (component.types.length) {
    lines.push('  - Exported type surface:');
    for (const typeName of component.types) lines.push(`    - \`${typeName}\``);
  }
  return lines.join('\n');
}

function fixtureRank(file) {
  if (file.includes('/__mocks__/')) return 100;
  if (file.includes('/__tests__/')) return 90;
  if (file.includes('/component-gallery/')) return 0;
  if (file.includes('/pattern-gallery/')) return 10;
  if (file.includes('/patterns/')) return 20;
  if (file.endsWith('/showcase-root.tsx')) return 30;
  if (file.includes('/runtime-smoke')) return 40;
  return 50;
}

function leaksPrivateMonorepoImport(source) {
  return source.includes('/packages/ui/src/') || source.includes("from '../../packages/");
}

export function selectPreviewFixture(component, rootDir = ROOT_DIR) {
  const usageIndex = buildShowcaseUsageIndex(rootDir);
  const candidates = usageForComponent(component, usageIndex)
    .sort((a, b) => fixtureRank(a) - fixtureRank(b) || a.localeCompare(b));

  for (const fixture of candidates) {
    const source = fs.readFileSync(path.join(rootDir, fixture), 'utf8');
    if (!source.includes("from '@beemvp/beeui-ui'")) continue;
    if (leaksPrivateMonorepoImport(source)) continue;
    return { fixture, source };
  }
  throw new Error(`${component.name}: no public-boundary runtime Showcase fixture is available for the live preview.`);
}

// A fixture small enough to read whole is shown whole; anything larger is excerpted to the
// regions that actually use this family.
const WHOLE_FILE_LINE_LIMIT = 160;
// Adjacent regions separated by less than this many lines are merged rather than shown as two
// excerpts with a gap marker between them.
const MERGE_GAP_LINES = 3;
// A layout primitive like `Box` or `Screen` wraps nearly every other example, so "where it is
// used" is most of the file and an unbudgeted excerpt reproduces the dump this replaced. Show
// the smallest regions first — they read as examples rather than as a wall — and say plainly
// how many were left out.
const MAX_EXCERPT_LINES = 120;
const MAX_EXCERPT_REGIONS = 6;
// Below this a region is a declaration or a lone opening tag — true, but not an example.
const SUBSTANTIVE_REGION_LINES = 3;
// A layout wrapper's element spans everything it contains — `<Screen>` opened at line 472 and
// closed at 1071 — so quoting the whole element quotes the whole file again. Past this size the
// useful part is the opening tag and its props, which is what a reader is looking for anyway.
const LARGE_ELEMENT_LINES = 40;

// `fixtureRank` deliberately prefers the runtime component gallery, because it is the largest
// typechecked surface that exercises real public API. For 51 of 62 families that resolved to
// the same 43 KB file, and inlining it whole put 1083 lines of `Input`, `Skeleton` and
// `Checkbox` source on the Accordion page. The fixture is still the right source; showing all
// of it is not. This finds the JSX regions where the family is actually used, so the excerpt
// is a real, locatable slice of the same executable file rather than a curated retelling.
// The names a family reaches the fixture under: its own exports, plus any binding introduced by
// calling one of them (`const toast = useToast()`). Exported separately so the check that an
// excerpt really shows the family can re-derive this from the file on disk rather than trusting
// the range computation it is supposed to be checking.
export function derivedBindingNames(source, component, fileName = 'fixture.tsx') {
  const names = new Set(component.values);
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const derived = new Set();

  const walk = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      names.has(node.initializer.expression.text)
    ) {
      derived.add(node.name.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  return derived;
}

export function familyUsageRanges(source, component, fileName = 'fixture.tsx') {
  const names = new Set(component.values);
  // `useToast()` is the export, but the usage worth showing is `toast.show({...})` on the value
  // it returns. Matching only the export name reduced toast.md's entire "Verified example
  // source" to `const toast = useToast();` while eight real `toast.show` calls went unshown —
  // and, because that was the only region found, the page reported it as complete usage.
  const derived = derivedBindingNames(source, component, fileName);
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineOf = (pos) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  const ranges = [];

  const tagName = (node) => {
    const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    // `<Foo.Bar>` is attributed to `Foo`, which is the exported family member.
    return ts.isPropertyAccessExpression(tag) ? tag.expression.getText(sourceFile) : tag.getText(sourceFile);
  };

  // A family is not always used as a JSX tag: `useToast` is called, `beeTokenReader` is read.
  // Matching only JSX left those families falling through to the whole-file branch, which is
  // exactly the case this excerpting exists to fix.
  // eslint-disable-next-line no-unused-vars -- referenced by both collectors below.
  const enclosingStatement = (node) => {
    let current = node;
    while (current.parent && !ts.isStatement(current) && !ts.isJsxElement(current) && !ts.isJsxSelfClosingElement(current)) {
      current = current.parent;
    }
    return current;
  };

  // Walks outward to the smallest enclosing JSX element that is a readable example, stopping
  // before anything large enough to be the file's layout rather than a usage of this family.
  const enclosingExample = (node, start, end) => {
    let current = node.parent;
    while (current) {
      if (ts.isJsxElement(current)) {
        const outerStart = lineOf(current.getStart(sourceFile));
        const outerEnd = lineOf(current.getEnd());
        if (outerEnd - outerStart + 1 > LARGE_ELEMENT_LINES) break;
        if (outerEnd - outerStart + 1 >= SUBSTANTIVE_REGION_LINES) return { start: outerStart, end: outerEnd };
      }
      current = current.parent;
    }
    return { start, end };
  };

  const visit = (node) => {
    // `toast.show(...)` — a call on a value the family's hook produced.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      derived.has(node.expression.expression.text)
    ) {
      const statement = enclosingStatement(node);
      ranges.push({ start: lineOf(statement.getStart(sourceFile)), end: lineOf(statement.getEnd()) });
      return;
    }
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && names.has(tagName(node))) {
      const start = lineOf(node.getStart(sourceFile));
      const end = lineOf(node.getEnd());
      if (end - start + 1 <= LARGE_ELEMENT_LINES) {
        // `<Spinner />` on its own is a true but empty example. Show the smallest enclosing JSX
        // element that still reads as an example, so the reader sees the props and the context
        // the component is used in rather than a bare self-closing tag.
        const context = end - start + 1 < SUBSTANTIVE_REGION_LINES ? enclosingExample(node, start, end) : { start, end };
        ranges.push(context);
        return; // Nested uses of the same family are already inside this range.
      }
      // Keep the opening tag, then keep descending: a nested use of the same family further in
      // is a separate, smaller example worth showing on its own.
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      ranges.push({ start, end: lineOf(opening.getEnd()), openingTagOnly: true });
    }
    if (
      ts.isIdentifier(node) &&
      names.has(node.text) &&
      !ts.isImportSpecifier(node.parent) &&
      !ts.isImportClause(node.parent) &&
      // A tag name is handled by the JSX branch above, which knows to keep only the opening tag
      // of a large wrapper. Treating it as a plain identifier here walked back up to the whole
      // element and undid that.
      !ts.isJsxOpeningElement(node.parent) &&
      !ts.isJsxSelfClosingElement(node.parent) &&
      !ts.isJsxClosingElement(node.parent)
    ) {
      const statement = enclosingStatement(node);
      ranges.push({ start: lineOf(statement.getStart(sourceFile)), end: lineOf(statement.getEnd()) });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return ranges
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .reduce((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start - previous.end <= MERGE_GAP_LINES) {
        previous.end = Math.max(previous.end, range.end);
        // A merged region is no longer just an opening tag.
        if (previous.end !== lineOf(sourceFile.getStart())) previous.openingTagOnly = previous.openingTagOnly && range.openingTagOnly;
        return merged;
      }
      return [...merged, { ...range }];
    }, []);
}

// Returns either the whole fixture, or the family's usage regions with the exact line numbers
// they occupy in it. Excerpts are never re-indented or edited: what is printed is byte-identical
// to those lines of the file, which is what lets the page keep claiming the displayed source and
// the executable source are the same thing.
export function excerptFixture(source, component, fixturePath) {
  const lines = source.split('\n');
  if (lines.length <= WHOLE_FILE_LINE_LIMIT) return { whole: true, excerpts: [], source };

  const ranges = familyUsageRanges(source, component, path.basename(fixturePath));
  if (!ranges.length) return { whole: true, excerpts: [], source };

  const withText = ranges.map((range) => ({ ...range, text: lines.slice(range.start - 1, range.end).join('\n') }));

  // Smallest-first alone let a one-line region — `const toast = useToast();` — stand as the
  // whole example while multi-line calls went unshown. A region that is only a declaration or a
  // bare opening tag teaches nothing on its own, so substantive regions get the budget first.
  const bySize = (a, b) => (a.end - a.start) - (b.end - b.start);
  const substantive = withText.filter((range) => range.end - range.start + 1 >= SUBSTANTIVE_REGION_LINES).sort(bySize);
  const trivial = withText.filter((range) => range.end - range.start + 1 < SUBSTANTIVE_REGION_LINES).sort(bySize);

  const kept = [];
  let budget = MAX_EXCERPT_LINES;
  for (const range of [...substantive, ...trivial]) {
    const size = range.end - range.start + 1;
    if (kept.length >= MAX_EXCERPT_REGIONS || size > budget) continue;
    budget -= size;
    kept.push(range);
  }
  // Always show at least the smallest region, even if it alone exceeds the budget: an excerpt
  // section with no code would be worse than a long one.
  if (!kept.length) kept.push(withText.reduce((a, b) => (b.end - b.start < a.end - a.start ? b : a)));

  // A bare opening tag earns its place only when it is all there is — a layout wrapper used once.
  // Printed alongside complete examples it is an unbalanced JSX fragment that reads as noise.
  const complete = kept.filter((range) => !range.openingTagOnly);
  const selected = complete.length ? complete : kept;

  return {
    whole: false,
    excerpts: selected.sort((a, b) => a.start - b.start),
    omittedRegions: withText.length - selected.length,
    totalRegions: withText.length,
    source,
  };
}

export function buildPreviewDescriptor(component, rootDir = ROOT_DIR) {
  const selected = selectPreviewFixture(component, rootDir);
  const excerpted = excerptFixture(selected.source, component, selected.fixture);
  return {
    component: component.name,
    title: component.title,
    fixture: selected.fixture,
    source: selected.source,
    excerpt: excerpted,
    fixtureLineCount: selected.source.split('\n').length,
    sourceHref: `https://github.com/beobungbu/BeeUI/blob/main/${selected.fixture}`,
    showcaseHref: `${component.showcaseHref}&embed=1`,
    anatomy: anatomy(component),
  };
}

function renderVerifiedSource(descriptor) {
  const link = `[\`${descriptor.fixture}\`](${descriptor.sourceHref})`;

  if (descriptor.excerpt.whole) {
    return [
      `The following is the exact typechecked **runtime Showcase fixture selected for this live preview**: ${link}. ` +
      'Runtime gallery/pattern sources are preferred over test harnesses, and the displayed source and ' +
      'executable source are the same file; there is no separately maintained demo snippet.',
      '',
      '````tsx',
      descriptor.source,
      '````',
      '',
      "Use the code block's copy affordance to copy the exact fixture. For a smaller app-specific example, " +
      'start from the public imports shown above and keep only the state your screen owns.',
      '',
    ].join('\n');
  }

  const excerptLines = descriptor.excerpt.excerpts.reduce((total, part) => total + (part.end - part.start + 1), 0);
  const blocks = descriptor.excerpt.excerpts.map((part) => {
    const range = part.start === part.end ? `line ${part.start}` : `lines ${part.start}–${part.end}`;
    const anchor = `${descriptor.sourceHref}#L${part.start}-L${part.end}`;
    return [`[${range}](${anchor}):`, '', '````tsx', part.text, '````', ''].join('\n');
  });

  const places = `${descriptor.excerpt.excerpts.length} ${descriptor.excerpt.excerpts.length === 1 ? 'place' : 'places'}`;
  // `<Screen>` opens at the top of the gallery and closes at the bottom, so what is left out of
  // its excerpt is mostly Screen's own children — saying "other families" there would be false.
  const remainder = descriptor.excerpt.excerpts.every((part) => part.openingTagOnly)
    ? 'What follows the tag in the fixture is this family\'s own content, which the live preview above already renders.'
    : 'The rest of that file exercises other families and is not reproduced here.';
  const omitted = descriptor.excerpt.omittedRegions
    ? `, of ${descriptor.excerpt.totalRegions} in total — open the fixture for the remaining ${descriptor.excerpt.omittedRegions}`
    : '';
  return [
    `These are the parts of the typechecked **runtime Showcase fixture behind this live preview** — ${link}, ` +
    `${descriptor.fixtureLineCount} lines — where **${descriptor.title}** is actually used: ` +
    `${excerptLines} ${excerptLines === 1 ? 'line' : 'lines'} in ${places}` +
    `${omitted}. Each block is copied verbatim from the line range named above it, so it is the same executable ` +
    `source, not a retelling of it. ${remainder}`,
    '',
    ...blocks,
    'Open the fixture itself for the surrounding imports and state. For a smaller app-specific example, start from ' +
    'the public imports shown above and keep only the state your screen owns.',
    '',
  ].join('\n');
}

export function renderPreviewAddon(descriptor) {
  return [
    '## Live Web preview',
    '',
    `<div class="beeui-component-preview" data-component="${descriptor.component}">`,
    '  <iframe',
    `    src="${descriptor.showcaseHref}"`,
    `    title="Live Web preview of ${descriptor.title}"`,
    '    loading="lazy"',
    '    style="width:100%;min-height:32rem;border:1px solid var(--sl-color-gray-5);border-radius:0.75rem;background:var(--sl-color-bg);"',
    '  ></iframe>',
    '</div>',
    '',
    'This frame loads the **real BeeUI Web Showcase** on demand; it is not a second docs-only implementation. It',
    'proves browser behavior only. Use [native preview](/docs/showcase/) for iOS/Android simulator, emulator or',
    'device paths.',
    '',
    '### Composition anatomy',
    '',
    descriptor.anatomy,
    '',
    'The tree above is ordinary document structure so it remains readable with keyboard and assistive technology;',
    'it is derived from the real public export family rather than a canvas-only diagram.',
    '',
    '## Verified example source',
    '',
    renderVerifiedSource(descriptor),
  ].join('\n');
}

export function collectPublicComponentPreviewViolations(rootDir = ROOT_DIR) {
  const violations = [];
  for (const component of buildPublicComponentManifest(rootDir)) {
    let descriptor;
    try {
      descriptor = buildPreviewDescriptor(component, rootDir);
    } catch (error) {
      violations.push(error.message);
      continue;
    }
    if (!descriptor.source.includes("from '@beemvp/beeui-ui'")) {
      violations.push(`${component.name}: preview fixture does not consume the public BeeUI package boundary.`);
    }
    if (leaksPrivateMonorepoImport(descriptor.source)) {
      violations.push(`${component.name}: preview fixture leaks a private monorepo import.`);
    }
    if (descriptor.fixture.includes('/__tests__/') || descriptor.fixture.includes('/__mocks__/')) {
      violations.push(`${component.name}: live preview selected a test/mock source instead of a runtime Showcase fixture.`);
    }
    const expectedTarget = `${showcaseHref({ surface: 'component', id: component.name, example: 'basic' })}&embed=1`;
    if (descriptor.showcaseHref !== expectedTarget) {
      violations.push(`${component.name}: preview is not addressable through the canonical Showcase component target.`);
    }
    const addon = renderPreviewAddon(descriptor);
    // The page's claim is that the code shown IS the executable source. For a whole fixture that
    // means the file appears verbatim; for an excerpt it means every block matches the exact
    // lines it names, and that the family really is used inside those lines. An excerpt whose
    // line numbers point somewhere else would be a citation nobody could check.
    if (descriptor.excerpt.whole) {
      if (!addon.includes(descriptor.source)) {
        violations.push(`${component.name}: displayed code drifted from running fixture source.`);
      }
    } else {
      // Read the fixture back off disk rather than reusing `descriptor.source`. Both the
      // excerpt text and the earlier comparison were sliced from the same in-memory string, so
      // they could never disagree: an independent review corrupted the line derivation by five
      // lines and this guard stayed green while the page quoted unrelated `const filler` lines
      // under a heading claiming they were where the family is used.
      const onDisk = fs.readFileSync(path.join(rootDir, descriptor.fixture), 'utf8').split('\n');
      if (!descriptor.excerpt.excerpts.length) {
        violations.push(`${component.name}: fixture was excerpted to nothing.`);
      }
      for (const part of descriptor.excerpt.excerpts) {
        if (onDisk.slice(part.start - 1, part.end).join('\n') !== part.text || !addon.includes(part.text)) {
          violations.push(
            `${component.name}: displayed excerpt does not match ${descriptor.fixture} lines ${part.start}-${part.end}.`,
          );
        }
        // The heading says these are the lines where the family is used. Checking that the
        // family appears somewhere in the file does not check that; this does.
        const vocabulary = [
          ...component.values,
          ...derivedBindingNames(onDisk.join('\n'), component, path.basename(descriptor.fixture)),
        ];
        if (!vocabulary.some((name) => new RegExp(`\\b${name}\\b`, 'u').test(part.text))) {
          violations.push(
            `${component.name}: the excerpt at ${descriptor.fixture} lines ${part.start}-${part.end} does not ` +
            'mention any export of this family, so it is not where the family is used.',
          );
        }
        if (!addon.includes(`#L${part.start}-L${part.end}`)) {
          violations.push(`${component.name}: excerpt at lines ${part.start}-${part.end} is not linked to those lines.`);
        }
      }
    }
    if (!addon.includes('loading="lazy"')) violations.push(`${component.name}: Showcase preview must lazy-load.`);
    if (!addon.includes(`title="Live Web preview of ${component.title}"`)) violations.push(`${component.name}: preview iframe lacks an accessible title.`);
  }
  return violations;
}

export function enhanceGeneratedPublicComponentPages({ rootDir = ROOT_DIR, outDir = path.join(rootDir, PUBLIC_COMPONENT_DIR) } = {}) {
  const violations = collectPublicComponentPreviewViolations(rootDir);
  if (violations.length) throw new Error(`Public component preview contract failed:\n- ${violations.join('\n- ')}`);

  const manifest = buildPublicComponentManifest(rootDir);
  for (const component of manifest) {
    const file = path.join(outDir, `${component.name}.md`);
    if (!fs.existsSync(file)) throw new Error(`${component.name}: generated public reference page is missing before preview enhancement.`);
    const page = fs.readFileSync(file, 'utf8');
    const marker = '## Limitations';
    if (!page.includes(marker)) throw new Error(`${component.name}: generated page lacks the Limitations insertion marker.`);
    const addon = renderPreviewAddon(buildPreviewDescriptor(component, rootDir));
    fs.writeFileSync(file, page.replace(marker, `${addon}${marker}`));
  }
  return manifest;
}

function main() {
  const check = process.argv.includes('--check');
  const violations = collectPublicComponentPreviewViolations(ROOT_DIR);
  if (violations.length) {
    console.error('Public component preview check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  if (check) {
    console.log(`Public component preview check passed (${buildPublicComponentManifest(ROOT_DIR).length} source-equal runtime previews).`);
    return;
  }
  const manifest = enhanceGeneratedPublicComponentPages();
  console.log(`Enhanced ${manifest.length} public component pages with lazy Showcase previews and exact runtime fixture source.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
