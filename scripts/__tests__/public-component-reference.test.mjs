import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTypeIndex,
  cvaVariantType,
  extractAccessibilityFacts,
  extractCvaVariants,
  variantsIdentifierFromBase,
  diffPlatformObjectShape,
  diffPlatformPropsShape,
  extractConsumedProps,
  extractDefaults,
  getBehaviorGuardKnownNames,
  getComponentTypeDocs,
  resolveComponentTypeEntry,
  resolveDeclaration,
  summarizeDescription,
} from '../component-props-lib.mjs';
import {
  buildPublicComponentManifest,
  collectPropDescriptionCoverage,
  collectRenderedPageViolations,
  collectPropDescriptionViolations,
  PROP_DESCRIPTION_FLOOR,
  PROP_DISTINCT_DESCRIPTION_FLOOR,
  collectPublicComponentReferenceViolations,
  renderPublicComponentIndex,
  renderPublicComponentPage,
} from '../public-component-reference.mjs';
import { getPublicComponents } from '../component-docs-lib.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- component-props-lib.mjs: synthetic-source unit tests -------------------
//
// Each fixture below is a minimal, self-contained TypeScript source string —
// not a read against the real repository — so a test failure points at a
// specific parser behavior instead of "something in packages/ui/src changed".

function index(files) {
  return buildTypeIndex(files);
}

// `getComponentTypeDocs`/`getBehaviorGuardKnownNames` read real files under
// `<rootDir>/packages/ui/src/components/*` — a synthetic tmp directory shaped the same way
// lets those integration-level code paths run against small, purpose-built fixtures instead of
// the real 62-family repository.
function makeSyntheticComponentsRoot(files) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'public-component-reference-fixture-'));
  const dir = path.join(tmpRoot, 'packages/ui/src/components');
  fs.mkdirSync(dir, { recursive: true });
  for (const [filename, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, filename), source);
  }
  return tmpRoot;
}

test('intersection with an external base cites it without expanding it', () => {
  const files = [
    {
      path: 'components/widget.tsx',
      source: `
        export type WidgetProps = Omit<ExternalLibraryProps, 'foo'> & {
          /** Visible label. */
          label?: string;
        };
      `,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'WidgetProps', { fromPath: files[0].path, errorLabel: 'widget' });
  assert.equal(entry.docKind, 'props');
  assert.equal(entry.kind, 'object');
  assert.deepEqual(entry.bases, ["Omit<ExternalLibraryProps, 'foo'>"]);
  assert.deepEqual(
    entry.fields.map((field) => field.name),
    ['label'],
  );
  assert.equal(entry.fields[0].description, 'Visible label.');
});

test('interface extends an unresolvable external interface: heritage cited as a base, own field kept', () => {
  const files = [
    {
      path: 'components/card.tsx',
      source: `
        export interface CardProps extends React.ComponentProps<'div'> {
          title: string;
        }
      `,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'CardProps', { fromPath: files[0].path, errorLabel: 'card' });
  assert.equal(entry.kind, 'object');
  assert.deepEqual(entry.bases, ["React.ComponentProps<'div'>"]);
  assert.deepEqual(
    entry.fields.map((field) => field.name),
    ['title'],
  );
  assert.equal(entry.fields[0].optional, false);
});

test('a local, no-type-argument heritage/intersection member is embedded (flattened), not cited as a base', () => {
  const files = [
    {
      path: 'components/head.tsx',
      source: `
        type ColumnPositionProps = {
          columnIndex?: number;
        };
        export type HeadProps = ColumnPositionProps & {
          label?: string;
        };
      `,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'HeadProps', { fromPath: files[0].path, errorLabel: 'head' });
  assert.deepEqual(entry.bases, []);
  assert.deepEqual(
    entry.fields.map((field) => field.name).sort(),
    ['columnIndex', 'label'],
  );
});

test('@internal members are excluded entirely from the field list', () => {
  const files = [
    {
      path: 'components/widget.tsx',
      source: `
        export type WidgetProps = {
          label?: string;
          /** @internal assigned by the parent, not part of the public API. */
          secretIndex?: number;
        };
      `,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'WidgetProps', { fromPath: files[0].path, errorLabel: 'widget' });
  assert.deepEqual(
    entry.fields.map((field) => field.name),
    ['label'],
  );
});

test('a bare alias of another local Props type recurses and records aliasOf', () => {
  const files = [
    {
      path: 'components/dialog.tsx',
      source: `
        export type DialogTitleProps = { children?: string };
      `,
    },
    {
      path: 'components/alert-dialog.tsx',
      source: `
        import type { DialogTitleProps } from './dialog';
        export type AlertDialogTitleProps = DialogTitleProps;
      `,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'AlertDialogTitleProps', {
    fromPath: files[1].path,
    errorLabel: 'alert-dialog',
  });
  assert.equal(entry.aliasOf, 'DialogTitleProps');
  assert.deepEqual(
    entry.fields.map((field) => field.name),
    ['children'],
  );
});

test('a union of local named Props types resolves to labeled variants', () => {
  const files = [
    {
      path: 'components/dialog.tsx',
      source: `
        type DialogControlledProps = { open: boolean; onOpenChange: (open: boolean) => void };
        type DialogUncontrolledProps = { open?: undefined; defaultOpen?: boolean };
        export type DialogProps = DialogControlledProps | DialogUncontrolledProps;
      `,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'DialogProps', { fromPath: files[0].path, errorLabel: 'dialog' });
  assert.equal(entry.kind, 'union');
  assert.deepEqual(
    entry.variants.map((variant) => variant.name),
    ['DialogControlledProps', 'DialogUncontrolledProps'],
  );
  assert.deepEqual(
    entry.variants[0].fields.map((field) => field.name),
    ['open', 'onOpenChange'],
  );
});

test('a union/literal type alias renders its members instead of just its name', () => {
  const files = [
    {
      path: 'components/table-shared.ts',
      source: `export type TableLayout = 'scroll' | 'stacked';`,
    },
  ];
  const entry = resolveComponentTypeEntry(index(files), 'TableLayout', { fromPath: files[0].path, errorLabel: 'table' });
  assert.equal(entry.docKind, 'literal-union');
  assert.deepEqual(entry.members, ['scroll', 'stacked']);
});

test('a mapped type (or any other unsupported shape) fails loudly instead of publishing an empty table', () => {
  const files = [
    {
      path: 'components/widget.tsx',
      source: `
        type Keys = 'a' | 'b';
        export type WidgetProps = { [K in Keys]: string };
      `,
    },
  ];
  assert.throws(
    () => resolveComponentTypeEntry(index(files), 'WidgetProps', { fromPath: files[0].path, errorLabel: 'widget: WidgetProps' }),
    /unsupported type shape/,
  );
});

test('resolveDeclaration disambiguates a platform-split name collision via family context, and throws with none', () => {
  const files = [
    { path: 'components/table.tsx', source: `export type TableProps = { native: true };` },
    { path: 'components/table.web.tsx', source: `export type TableProps = { web: true };` },
  ];
  const typeIndex = index(files);
  const preferPrimary = resolveDeclaration(typeIndex, 'TableProps', {
    primaryPath: 'components/table.tsx',
    familyPaths: ['components/table.tsx', 'components/table.web.tsx'],
  });
  assert.equal(preferPrimary.path, 'components/table.tsx');

  assert.throws(() => resolveDeclaration(typeIndex, 'TableProps', {}), /ambiguous type/);
});

test('extractDefaults reads a forwardRef render function destructured default', () => {
  const files = [
    {
      path: 'components/widget.tsx',
      source: `
        export const Widget = React.forwardRef<unknown, WidgetProps>(({ size = 'md', ...rest }, ref) => null);
      `,
    },
  ];
  const defaults = extractDefaults(files, new Set(['WidgetProps']));
  assert.equal(defaults.get('size'), "'md'");
});

test('extractDefaults reads a body-level destructure of a typed function parameter (non-forwardRef)', () => {
  const files = [
    {
      path: 'components/dialog.tsx',
      source: `
        export function Dialog(props: DialogProps) {
          const { children, defaultOpen = false, onOpenChange, open } = props;
        }
      `,
    },
  ];
  const defaults = extractDefaults(files, new Set(['DialogProps']));
  assert.equal(defaults.get('defaultOpen'), 'false');
});

test('extractDefaults finds nothing (never guesses) when no matching typed parameter exists', () => {
  const files = [{ path: 'components/widget.tsx', source: `export function useWidget() { return {}; }` }];
  const defaults = extractDefaults(files, new Set(['WidgetProps']));
  assert.equal(defaults.size, 0);
});

// --- public-component-reference.mjs: renderer + contract integration -------

test('M1: a generated component page carries exactly one Markdown H1 (frontmatter title only)', () => {
  const manifest = getPublicComponents().slice(0, 1);
  const component = {
    ...manifest[0],
    title: 'Widget',
    purpose: 'p',
    behavior: 'b',
    limitations: '',
    notes: '',
    typeDocs: [],
    examples: [],
    category: 'Other',
    providerRequired: false,
    exampleTargets: [],
    showcaseHref: '/showcase/',
    sourceHref: 'https://example.com',
    registryHref: 'https://example.com',
  };
  const page = renderPublicComponentPage(component);
  const h1Lines = page.split('\n').filter((line) => /^# /.test(line));
  assert.deepEqual(h1Lines, [], `body must not carry a Markdown H1, found: ${JSON.stringify(h1Lines)}`);
});

test('M1: the generated component index carries no body H1 either', () => {
  const generatedIndex = renderPublicComponentIndex([]);
  const h1Lines = generatedIndex.split('\n').filter((line) => /^# /.test(line));
  assert.deepEqual(h1Lines, []);
});

test('renderPublicComponentPage prints a real props table with the field name, type and default', () => {
  const base = getPublicComponents().find((c) => c.name === 'table');
  const component = {
    ...base,
    title: 'Table',
    purpose: 'p',
    behavior: 'Real behavior text.',
    limitations: '',
    notes: '',
    typeDocs: [
      {
        name: 'TableProps',
        docKind: 'props',
        kind: 'object',
        bases: ["Omit<ViewProps, 'children'>"],
        fields: [{ name: 'layout', optional: true, type: 'TableLayout', description: 'Responsive presentation.', default: "'scroll'" }],
      },
    ],
    examples: [],
    category: 'Data display',
    providerRequired: false,
    exampleTargets: [],
    showcaseHref: '/showcase/',
    sourceHref: 'https://example.com',
    registryHref: 'https://example.com',
  };
  const page = renderPublicComponentPage(component);
  assert.match(page, /\| `layout` \| `TableLayout` \| `'scroll'` \| Responsive presentation\. \|/);
  assert.match(page, /Also carries every prop of `Omit<ViewProps, 'children'>`/);
  assert.doesNotMatch(page, /Controlled\/uncontrolled props, callbacks, disabled semantics/);
});

test('the committed content.json already carries a behavior contract for every component', () => {
  const violations = collectPublicComponentReferenceViolations();
  assert.deepEqual(violations.filter((v) => v.includes('missing curated behavior contract')), []);
});

test('collectPublicComponentReferenceViolations flags a component whose curated behavior is stripped', () => {
  // A real (fixture) rootDir rather than a mock: symlinks the actual
  // registry/packages so `getPublicComponents()` sees the true 62-component
  // surface, then swaps in a `docs/component-reference.content.json` with one
  // component's `behavior` deleted — proving the enforcement added alongside
  // `purpose` actually fires, not just that the committed file happens to be
  // complete today.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'public-component-reference-behavior-'));
  try {
    fs.symlinkSync(path.join(REPO_ROOT, 'registry'), path.join(tmpRoot, 'registry'));
    fs.symlinkSync(path.join(REPO_ROOT, 'packages'), path.join(tmpRoot, 'packages'));
    fs.mkdirSync(path.join(tmpRoot, 'docs'), { recursive: true });
    // The manifest reads the #473 inventory to learn which surfaces are routed to each page,
    // so a fixture root needs the owner policy the inventory derives from.
    for (const file of ['public-surface-owners.json', 'reference.content.json', 'pattern-library.content.json']) {
      const from = path.join(REPO_ROOT, 'docs', file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(tmpRoot, 'docs', file));
    }
    for (const file of ['llms-components.txt', 'package.json']) {
      const from = path.join(REPO_ROOT, file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(tmpRoot, file));
    }
    fs.symlinkSync(path.join(REPO_ROOT, 'web'), path.join(tmpRoot, 'web'));
    const content = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs/component-reference.content.json'), 'utf8'));
    delete content.components.button.behavior;
    fs.writeFileSync(path.join(tmpRoot, 'docs/component-reference.content.json'), JSON.stringify(content));

    const violations = collectPublicComponentReferenceViolations(tmpRoot);
    assert.ok(
      violations.includes('button: missing curated behavior contract.'),
      `expected a missing-behavior violation for button, got: ${JSON.stringify(violations)}`,
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('every public component resolves a typeDocs model with no thrown errors, and every *Props type has fields or a documented base', () => {
  // Exercises the full real-repo integration path once: every `*Props` type
  // across all 62 families must be parseable (fail loudly, not silently, is
  // enforced by generatePublicComponentPages itself; this asserts it in test).
  const manifest = buildPublicComponentManifest();
  assert.equal(manifest.length, 62);
  for (const component of manifest) {
    assert.ok(component.behavior.trim().length > 0, `${component.name} has no curated behavior`);
    for (const entry of component.typeDocs) {
      if (entry.docKind !== 'props') continue;
      const hasContent = entry.kind === 'union'
        ? entry.variants.every((variant) => variant.fields.length > 0 || variant.bases.length > 0)
        : entry.fields.length > 0 || entry.bases.length > 0;
      assert.ok(hasContent, `${component.name}.${entry.name} resolved to neither fields nor a base`);
    }
  }
});

// `SwitchProps = Omit<RNSwitchProps, …>` has no fields of its own, so a fields table for it is
// empty and the page never names `value` or `onValueChange` — the "documented but unanswerable"
// shape surviving inside its own fix. The implementation destructures the props it reads.
test('a Props type that only narrows an upstream type still documents what the family reads', () => {
  const files = [{
    path: 'switch.tsx',
    source: [
      "export type SwitchProps = Omit<RNSwitchProps, 'thumbColor'>;",
      'export const Switch = React.forwardRef<Ref, SwitchProps>(',
      '  ({ accessibilityState, disabled = false, onValueChange, value = false, ...props }, ref) => null,',
      ');',
    ].join('\n'),
  }];

  const consumed = extractConsumedProps(files, new Set(['SwitchProps']));
  assert.deepEqual([...consumed.keys()].sort(), ['accessibilityState', 'disabled', 'onValueChange', 'value']);
  assert.equal(consumed.get('disabled'), 'false');
  assert.equal(consumed.get('value'), 'false');
  // `...props` is the passthrough, not a prop anyone looks up.
  assert.equal(consumed.has('props'), false);
});

// --- Default-value resolution (MINOR: select.md's `resolveDirection()`/`SELECT_DEFAULT_PLACEHOLDER`) ---

test('extractDefaults resolves a bare identifier default to the literal a local `const` binds it to', () => {
  const files = [
    {
      path: 'components/select.tsx',
      source: [
        "const SELECT_DEFAULT_PLACEHOLDER = 'Select an option';",
        'export const Select = React.forwardRef<unknown, SelectProps>(',
        '  ({ placeholder = SELECT_DEFAULT_PLACEHOLDER, ...rest }, ref) => null,',
        ');',
      ].join('\n'),
    },
  ];
  const defaults = extractDefaults(files, new Set(['SelectProps']));
  assert.equal(defaults.get('placeholder'), "'Select an option'");
});

test('extractDefaults never prints a call expression default — an unreadable symbol is dropped, not guessed at', () => {
  const files = [
    {
      path: 'components/select.tsx',
      source: [
        'export const Select = React.forwardRef<unknown, SelectProps>(',
        '  ({ direction = resolveDirection(), ...rest }, ref) => null,',
        ');',
      ].join('\n'),
    },
  ];
  const defaults = extractDefaults(files, new Set(['SelectProps']));
  assert.equal(defaults.has('direction'), false);
});

test('extractDefaults drops an identifier default that does not resolve to a local literal const', () => {
  const files = [
    {
      path: 'components/select.tsx',
      source: [
        'import { IMPORTED_DEFAULT } from "./constants";',
        'export const Select = React.forwardRef<unknown, SelectProps>(',
        '  ({ tone = IMPORTED_DEFAULT, ...rest }, ref) => null,',
        ');',
      ].join('\n'),
    },
  ];
  const defaults = extractDefaults(files, new Set(['SelectProps']));
  assert.equal(defaults.has('tone'), false);
});

// --- Platform-split shape diffing (MAJOR M4) ---------------------------------

test('diffPlatformObjectShape reports native-only, Web-only, and changed fields, plus a changed base', () => {
  const nativeShape = {
    kind: 'object',
    bases: ["Omit<ViewProps, 'children'>"],
    fields: [
      { name: 'colSpan', optional: true, type: 'number', description: '', default: '1' },
      { name: 'label', optional: true, type: 'string', description: '' },
    ],
  };
  const webShape = {
    kind: 'object',
    bases: ["Omit<React.HTMLAttributes<HTMLElement>, 'children'>"],
    fields: [
      { name: 'label', optional: true, type: 'React.ReactNode', description: '' },
      { name: 'testID', optional: true, type: 'string', description: '' },
    ],
  };
  const diff = diffPlatformObjectShape(nativeShape, webShape);
  assert.deepEqual(diff.nativeOnly.map((f) => f.name), ['colSpan']);
  assert.deepEqual(diff.webOnly.map((f) => f.name), ['testID']);
  assert.deepEqual(diff.changed.map((c) => c.name), ['label']);
  assert.equal(diff.changed[0].typeChanged, true);
  assert.equal(diff.changed[0].defaultChanged, false);
  assert.equal(diff.basesChanged, true);
});

test('diffPlatformObjectShape returns null when both platforms resolve to the identical shape', () => {
  const shape = {
    kind: 'object',
    bases: ["Omit<ViewProps, 'children'>"],
    fields: [{ name: 'children', optional: true, type: 'React.ReactNode', description: '' }],
  };
  assert.equal(diffPlatformObjectShape(shape, { ...shape, fields: [...shape.fields] }), null);
});

test('diffPlatformPropsShape returns `unsupported` when native is a union and Web is a plain object', () => {
  const nativeEntry = { kind: 'union', variants: [{ name: 'A', kind: 'object', bases: [], fields: [] }] };
  const webShape = { kind: 'object', bases: [], fields: [] };
  assert.deepEqual(diffPlatformPropsShape(nativeEntry, webShape), { kind: 'unsupported' });
});

test('diffPlatformPropsShape diffs matching union variants by name and reports genuinely unmatched ones', () => {
  const nativeEntry = {
    kind: 'union',
    variants: [
      { name: 'Controlled', kind: 'object', bases: [], fields: [{ name: 'open', optional: false, type: 'boolean', description: '' }] },
      { name: 'NativeOnly', kind: 'object', bases: [], fields: [] },
    ],
  };
  const webShape = {
    kind: 'union',
    variants: [
      { name: 'Controlled', kind: 'object', bases: [], fields: [{ name: 'open', optional: true, type: 'boolean', description: '' }] },
    ],
  };
  const diff = diffPlatformPropsShape(nativeEntry, webShape);
  assert.equal(diff.kind, 'union');
  assert.deepEqual(diff.variantDiffs[0].variantName, 'Controlled');
  assert.deepEqual(diff.variantDiffs[0].diff.changed[0].name, 'open');
  assert.equal(diff.variantDiffs[0].diff.changed[0].optionalChanged, true);
  assert.deepEqual(diff.unmatched, ['NativeOnly']);
});

test('getComponentTypeDocs attaches a webShape only when the Web file locally redeclares the same type name', () => {
  const rootDir = makeSyntheticComponentsRoot({
    'widget.tsx': [
      "export type WidgetProps = Omit<ViewProps, 'children'> & {",
      '  label?: string;',
      '};',
    ].join('\n'),
    'widget.web.tsx': [
      "export type WidgetProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {",
      '  label?: string;',
      '  testID?: string;',
      '};',
    ].join('\n'),
    'shared-widget.tsx': "export type SharedWidgetLayout = 'a' | 'b';",
  });
  try {
    const component = {
      name: 'widget',
      types: ['WidgetProps'],
      source: 'packages/ui/src/components/widget.tsx',
      allSources: [
        'packages/ui/src/components/widget.tsx',
        'packages/ui/src/components/widget.web.tsx',
        'packages/ui/src/components/shared-widget.tsx',
      ],
    };
    const [entry] = getComponentTypeDocs(component, rootDir);
    assert.ok(entry.webShape, 'expected a webShape to be attached for a Web-redeclared type');
    assert.equal(entry.webSource, 'packages/ui/src/components/widget.web.tsx');
    const diff = diffPlatformPropsShape(entry, entry.webShape);
    assert.deepEqual(diff.diff.webOnly.map((f) => f.name), ['testID']);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('getComponentTypeDocs does not attach a webShape when only a shared (non-`.web.`-local) declaration exists', () => {
  const rootDir = makeSyntheticComponentsRoot({
    'widget.native.tsx': "export { Widget } from './widget-shared';",
    'widget.web.tsx': "export { Widget } from './widget-shared';",
    'widget-shared.tsx': [
      'export type WidgetProps = {',
      '  label?: string;',
      '};',
      'export const Widget = (props: WidgetProps) => null;',
    ].join('\n'),
  });
  try {
    const component = {
      name: 'widget',
      types: ['WidgetProps'],
      source: 'packages/ui/src/components/widget-shared.tsx',
      allSources: [
        'packages/ui/src/components/widget-shared.tsx',
        'packages/ui/src/components/widget.native.tsx',
        'packages/ui/src/components/widget.web.tsx',
      ],
    };
    const [entry] = getComponentTypeDocs(component, rootDir);
    assert.equal(entry.webShape, undefined);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

// `applyDefaults` (component-props-lib.mjs) and its call site inside `getComponentTypeDocs`
// have no direct test: deleting that call site blanks the Default column on every page with a
// green suite everywhere else, because every other test either constructs a typeDocs entry by
// hand (bypassing `getComponentTypeDocs`) or does not assert on `.default`. This drives the
// real `getComponentTypeDocs` entry point against a synthetic fixture and asserts the
// destructured default actually lands on the field.
test('getComponentTypeDocs applies a real destructured default to its field (proves the applyDefaults call site)', () => {
  const rootDir = makeSyntheticComponentsRoot({
    'widget.tsx': [
      'export type WidgetProps = {',
      "  layout?: 'scroll' | 'stacked';",
      '};',
      'export const Widget = React.forwardRef<unknown, WidgetProps>(',
      "  ({ layout = 'scroll', ...rest }, ref) => null,",
      ');',
    ].join('\n'),
  });
  try {
    const component = {
      name: 'widget',
      types: ['WidgetProps'],
      source: 'packages/ui/src/components/widget.tsx',
      allSources: ['packages/ui/src/components/widget.tsx'],
    };
    const [entry] = getComponentTypeDocs(component, rootDir);
    const layout = entry.fields.find((field) => field.name === 'layout');
    assert.equal(layout.default, "'scroll'");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

// --- Behavior-prose prop guard (MAJOR M8) ------------------------------------

test('getBehaviorGuardKnownNames credits own fields, cva() variant keys, and one level of a local base\'s fields', () => {
  const rootDir = makeSyntheticComponentsRoot({
    'button.tsx': [
      "import { cva } from 'class-variance-authority';",
      "const buttonVariants = cva('base', { variants: { variant: { primary: 'x' }, size: { md: 'y' } } });",
      "export type ButtonProps = Omit<PressableProps, 'children'> & VariantProps<typeof buttonVariants> & {",
      '  loading?: boolean;',
      '};',
      'export const Button = (props: ButtonProps) => null;',
    ].join('\n'),
    'icon-button.tsx': [
      "export type IconButtonProps = Omit<ButtonProps, 'children'> & {",
      '  accessibilityLabel: string;',
      '};',
      'export const IconButton = (props: IconButtonProps) => null;',
    ].join('\n'),
  });
  try {
    const iconButton = {
      name: 'icon-button',
      values: ['IconButton'],
      types: ['IconButtonProps'],
      source: 'packages/ui/src/components/icon-button.tsx',
      allSources: ['packages/ui/src/components/icon-button.tsx'],
    };
    const typeDocs = getComponentTypeDocs(iconButton, rootDir);
    const known = getBehaviorGuardKnownNames(iconButton, typeDocs, rootDir);
    // Own field.
    assert.ok(known.has('accessibilityLabel'));
    // One level into the locally-resolvable `Omit<ButtonProps, …>` base.
    assert.ok(known.has('loading'), 'expected `loading` resolved from the ButtonProps base');
    // Not a real name anywhere in this fixture.
    assert.equal(known.has('somethingMadeUp'), false);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('getBehaviorGuardKnownNames credits cva() variant keys directly declared on the family itself', () => {
  const rootDir = makeSyntheticComponentsRoot({
    'badge.tsx': [
      "import { cva } from 'class-variance-authority';",
      "const badgeVariants = cva('base', { variants: { variant: { primary: 'x' } } });",
      'export type BadgeProps = VariantProps<typeof badgeVariants> & {',
      '  className?: string;',
      '};',
      'export const Badge = (props: BadgeProps) => null;',
    ].join('\n'),
  });
  try {
    const badge = {
      name: 'badge',
      values: ['Badge'],
      types: ['BadgeProps'],
      source: 'packages/ui/src/components/badge.tsx',
      allSources: ['packages/ui/src/components/badge.tsx'],
    };
    const typeDocs = getComponentTypeDocs(badge, rootDir);
    const known = getBehaviorGuardKnownNames(badge, typeDocs, rootDir);
    assert.ok(known.has('variant'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('collectPublicComponentReferenceViolations flags a behavior string that references a prop the family does not have', () => {
  // Real (fixture) rootDir, same symlink pattern as the missing-behavior test above: proves
  // the guard fires against the true 62-family surface, not a mock. Reverts `progress.behavior`
  // to its actual pre-fix wording ("`value` is clamped to its `min`/`max` range") — `min` was
  // never a `ProgressProps` field — and asserts the guard names exactly that identifier.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'public-component-reference-behavior-prop-'));
  try {
    fs.symlinkSync(path.join(REPO_ROOT, 'registry'), path.join(tmpRoot, 'registry'));
    fs.symlinkSync(path.join(REPO_ROOT, 'packages'), path.join(tmpRoot, 'packages'));
    fs.mkdirSync(path.join(tmpRoot, 'docs'), { recursive: true });
    // The manifest reads the #473 inventory to learn which surfaces are routed to each page,
    // so a fixture root needs the owner policy the inventory derives from.
    for (const file of ['public-surface-owners.json', 'reference.content.json', 'pattern-library.content.json']) {
      const from = path.join(REPO_ROOT, 'docs', file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(tmpRoot, 'docs', file));
    }
    for (const file of ['llms-components.txt', 'package.json']) {
      const from = path.join(REPO_ROOT, file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(tmpRoot, file));
    }
    fs.symlinkSync(path.join(REPO_ROOT, 'web'), path.join(tmpRoot, 'web'));
    const content = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs/component-reference.content.json'), 'utf8'));
    content.components.progress.behavior =
      "Stateless clamped determinate progress bar; `value` is clamped to its `min`/`max` range and exposes native progressbar semantics — there is no indeterminate mode.";
    fs.writeFileSync(path.join(tmpRoot, 'docs/component-reference.content.json'), JSON.stringify(content));

    const violations = collectPublicComponentReferenceViolations(tmpRoot);
    assert.ok(
      violations.includes('progress: behavior references `min`, which is not a known prop or exported value of this family.'),
      `expected a \`min\` mismatch violation for progress, got: ${JSON.stringify(violations)}`,
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('the committed content.json behavior strings reference only real props/exported values', () => {
  const violations = collectPublicComponentReferenceViolations();
  assert.deepEqual(violations.filter((v) => v.includes('is not a known prop or exported value')), []);
});

// --- BeeUI-owned base linking (MEDIUM D2) ------------------------------------

test('renderPublicComponentPage links a base that resolves to another public family\'s own Props type, and drops "upstream"', () => {
  const base = getPublicComponents().find((c) => c.name === 'textarea');
  const component = {
    ...base,
    title: 'Textarea',
    purpose: 'p',
    behavior: 'b',
    limitations: '',
    notes: '',
    typeDocs: [
      {
        name: 'TextareaProps',
        docKind: 'props',
        kind: 'object',
        bases: ["Omit<InputProps, 'multiline' | 'size'>"],
        fields: [],
      },
    ],
    examples: [],
    category: 'Forms & selection',
    providerRequired: false,
    exampleTargets: [],
    showcaseHref: '/showcase/',
    sourceHref: 'https://example.com',
    registryHref: 'https://example.com',
  };
  const page = renderPublicComponentPage(component);
  // A `|` here is prose, not a table cell: the published signature must read `'multiline' | 'size'`.
  assert.match(page, /Also carries every prop of `Omit<InputProps, 'multiline' \| 'size'>` — documented on the \[Input\]\(\/docs\/components\/input\/\) page, not reproduced here\./);
  assert.doesNotMatch(page, /upstream contract/);
});

test('renderPublicComponentPage keeps the "upstream" wording for a genuinely external base, and collapses bracket-adjacent whitespace', () => {
  const base = getPublicComponents().find((c) => c.name === 'table');
  const component = {
    ...base,
    title: 'Table',
    purpose: 'p',
    behavior: 'b',
    limitations: '',
    notes: '',
    typeDocs: [
      {
        name: 'TableProps',
        docKind: 'props',
        kind: 'object',
        bases: ["Omit<\n  ViewProps,\n  'children' | 'style'\n>"],
        fields: [],
      },
    ],
    examples: [],
    category: 'Data display',
    providerRequired: false,
    exampleTargets: [],
    showcaseHref: '/showcase/',
    sourceHref: 'https://example.com',
    registryHref: 'https://example.com',
  };
  const page = renderPublicComponentPage(component);
  assert.match(page, /Also carries every prop of `Omit<ViewProps, 'children' \| 'style'>` — that upstream contract is not reproduced here\./);
  assert.doesNotMatch(page, /Omit<\s+ViewProps/, 'expected the bracket-adjacent space to be collapsed');
  assert.doesNotMatch(page, /'style'\s+>/, 'expected the bracket-adjacent space to be collapsed');
});

// --- Platform-diff rendering (MAJOR M4, render layer) ------------------------

function baseSyntheticComponentForRender() {
  const base = getPublicComponents().find((c) => c.name === 'table');
  return {
    ...base,
    title: 'Widget',
    purpose: 'p',
    behavior: 'b',
    limitations: '',
    notes: '',
    examples: [],
    category: 'Data display',
    providerRequired: false,
    exampleTargets: [],
    showcaseHref: '/showcase/',
    sourceHref: 'https://example.com',
    registryHref: 'https://example.com',
  };
}

test('renderPublicComponentPage renders explicit platform-difference bullets for an object-kind entry', () => {
  const component = {
    ...baseSyntheticComponentForRender(),
    typeDocs: [
      {
        name: 'WidgetProps',
        docKind: 'props',
        kind: 'object',
        bases: ["Omit<ViewProps, 'children'>"],
        fields: [{ name: 'colSpan', optional: true, type: 'number', description: '', default: '1' }],
        webShape: {
          kind: 'object',
          bases: ["Omit<React.HTMLAttributes<HTMLElement>, 'children'>"],
          fields: [{ name: 'testID', optional: true, type: 'string', description: '' }],
        },
        webSource: 'packages/ui/src/components/widget.web.tsx',
      },
    ],
  };
  const page = renderPublicComponentPage(component);
  assert.match(page, /\*\*Platform differences \(native vs\. \[Web\]/);
  // A field listed on one declaration and not the other is not evidence the other platform
  // lacks it: `testID` is explicit on Web and inherited from `ViewProps` on native, `colSpan`
  // is the reverse. Both were published as exclusive and both were false, so the page must say
  // where the field is declared and leave the other platform's base type unasserted.
  assert.match(page, /`colSpan` is declared explicitly on native \(native default `1`\)/u);
  assert.match(page, /`testID` is declared explicitly on Web/u);
  assert.equal(/declared on (?:native|Web) only/u.test(page), false, 'must not assert platform exclusivity');
  assert.match(page, /Base type differs: native carries `Omit<ViewProps, 'children'>`; Web carries `Omit<React\.HTMLAttributes<HTMLElement>, 'children'>`\./);
});

test('renderPublicComponentPage prints no platform-difference note when the Web shape is identical', () => {
  const component = {
    ...baseSyntheticComponentForRender(),
    typeDocs: [
      {
        name: 'WidgetProps',
        docKind: 'props',
        kind: 'object',
        bases: [],
        fields: [{ name: 'label', optional: true, type: 'string', description: '' }],
        webShape: { kind: 'object', bases: [], fields: [{ name: 'label', optional: true, type: 'string', description: '' }] },
        webSource: 'packages/ui/src/components/widget.web.tsx',
      },
    ],
  };
  const page = renderPublicComponentPage(component);
  assert.doesNotMatch(page, /Platform differences/);
  assert.doesNotMatch(page, /Platform note/);
});

test('renderPublicComponentPage falls back to an explicit native-only note when the two shapes are not diffable', () => {
  const component = {
    ...baseSyntheticComponentForRender(),
    typeDocs: [
      {
        name: 'WidgetProps',
        docKind: 'props',
        kind: 'union',
        variants: [{ name: 'A', kind: 'object', bases: [], fields: [] }],
        webShape: { kind: 'object', bases: [], fields: [] },
        webSource: 'packages/ui/src/components/widget.web.tsx',
      },
    ],
  };
  const page = renderPublicComponentPage(component);
  assert.match(page, /\*\*Platform note:\*\* this table documents the native declaration only\./);
  assert.match(page, /\[`packages\/ui\/src\/components\/widget\.web\.tsx`\]/);
});

// A prop the Web implementation destructures into an underscore binding is accepted for API
// parity and never read, so its type there is moot. Suppressing the type note must not suppress
// a default or optionality difference, which is real on the native side.
test('an inert Web prop suppresses only its type-difference note', () => {
  const component = {
    ...baseSyntheticComponentForRender(),
    typeDocs: [
      {
        name: 'WidgetProps',
        docKind: 'props',
        kind: 'object',
        bases: [],
        fields: [
          { name: 'modalProps', optional: true, type: 'WidgetModalProps', description: '' },
          { name: 'avoidKeyboard', optional: true, type: 'boolean', description: '', default: 'true' },
        ],
        webShape: {
          kind: 'object',
          bases: [],
          inert: ['modalProps', 'avoidKeyboard'],
          fields: [
            { name: 'modalProps', optional: true, type: 'Record<string, unknown>', description: '' },
            { name: 'avoidKeyboard', optional: false, type: 'boolean', description: '', default: 'false' },
          ],
        },
        webSource: 'packages/ui/src/components/widget.web.tsx',
      },
    ],
  };
  const page = renderPublicComponentPage(component);

  assert.match(page, /`modalProps` is accepted on Web for API parity but has no effect there\./u);
  assert.equal(/`modalProps` type differs/u.test(page), false, 'the type note is redundant for an inert prop');
  // A default or optionality difference is real on the native side and must survive the skip.
  assert.match(page, /`avoidKeyboard` default differs/u);
  assert.match(page, /`avoidKeyboard` is optional on native but required on Web/u);
});


// A `union` entry keeps its props in `variants[].fields`, never in `fields`. Counting
// only `entry.fields` reported a perfect score while every controlled/uncontrolled
// overlay prop rendered an em dash, because the props that would have disagreed were
// never in the counter's scope.
test('prop-description coverage counts union variant fields', () => {
  const manifest = [
    {
      typeDocs: [
        {
          name: 'DialogProps',
          kind: 'union',
          variants: [
            {
              name: 'DialogControlledProps',
              kind: 'object',
              fields: [
                { name: 'open', type: 'boolean', description: 'Current open state.' },
                { name: 'defaultOpen', type: 'never', description: '' },
              ],
            },
          ],
        },
      ],
    },
  ];

  assert.deepEqual(collectPropDescriptionCoverage(manifest), { described: 1, distinct: 1, sharedAcrossProps: 0, total: 2 });
});

test('prop-description coverage reaches variants nested inside a variant', () => {
  const manifest = [
    {
      typeDocs: [
        {
          name: 'OuterProps',
          kind: 'union',
          variants: [
            {
              name: 'Inner',
              kind: 'union',
              variants: [
                {
                  name: 'Leaf',
                  kind: 'object',
                  fields: [{ name: 'page', type: 'number', description: '' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  assert.deepEqual(collectPropDescriptionCoverage(manifest), { described: 0, distinct: 0, sharedAcrossProps: 0, total: 1 });
});

// The floor is only meaningful if it is the real published total. A floor set below
// the true denominator silently tolerates undescribed props.
test('every published prop carries a description', () => {
  const { described, total } = collectPropDescriptionCoverage(
    buildPublicComponentManifest(REPO_ROOT),
  );

  assert.equal(described, total, `${total - described} published prop(s) have no description`);
  assert.equal(PROP_DESCRIPTION_FLOOR, total, 'the floor must track the real published total');
});


// Publishing only the first sentence turned `table.tsx`'s `layout` JSDoc into
// "Responsive presentation." and discarded the sentence that names `'stacked'`; a later
// character cap truncated seven props, six of which lost contract rather than rationale.
test('a prop description is published whole', () => {
  const full =
    "Responsive presentation. Defaults to 'scroll'. Set 'stacked' to render a card presentation instead.";

  assert.equal(summarizeDescription(full), full);
});

test('a prop description is published whole however long it runs', () => {
  const long = `${'a'.repeat(300)}. ${'b'.repeat(300)}.`;

  assert.equal(summarizeDescription(long), long);
});

test('a prop description collapses the line breaks a JSDoc block wraps at', () => {
  assert.equal(summarizeDescription('Column span,\n   e.g. 2.\n'), 'Column span, e.g. 2.');
});



// A floor comparison alone passes 583 of 584 whenever the total grows by the same amount as the
// gap, so one newly undocumented prop reaches the published tables with every gate green.
test('one undescribed prop is a violation even when the floor is still met', () => {
  // Distinct text per prop: these fixtures test the coverage floors, not the boilerplate floor.
  const fields = Array.from({ length: PROP_DESCRIPTION_FLOOR }, (unused, index) => ({
    name: `documented${index}`,
    description: `Described ${index}.`,
  }));
  const manifest = [
    { typeDocs: [{ kind: 'object', fields: [...fields, { name: 'brandNew', description: '' }] }] },
  ];

  const violations = collectPropDescriptionViolations(manifest);

  assert.equal(violations.length, 1);
  assert.match(violations[0], /1 published prop\(s\) have no description/u);
});

test('a manifest below the floor reports the floor, not the per-prop gap', () => {
  const manifest = [{ typeDocs: [{ kind: 'object', fields: [{ name: 'only', description: '' }] }] }];

  assert.match(collectPropDescriptionViolations(manifest)[0], /floor \d+/u);
});

test('a fully described manifest at the floor is clean', () => {
  // Distinct text per prop: these fixtures test the coverage floors, not the boilerplate floor.
  const fields = Array.from({ length: PROP_DESCRIPTION_FLOOR }, (unused, index) => ({
    name: `documented${index}`,
    description: `Described ${index}.`,
  }));

  assert.deepEqual(collectPropDescriptionViolations([{ typeDocs: [{ kind: 'object', fields }] }]), []);
});


// `escapeCell`'s pipe escape is correct in a table row and wrong in a paragraph. Applying it to
// the bases line published `Omit<PressableProps, 'role' \| 'children'>` on 34 of 62 pages, with
// every existing check green — they all read the manifest or the cells, never the prose.
test('an escaped pipe in prose is a violation', () => {
  const page = ["## Composition", '', "Also carries every prop of `Omit<P, 'a' \\| 'b'>` — see Text.", ''].join('\n');

  const violations = collectRenderedPageViolations(page, 'accordion');

  assert.equal(violations.length, 1);
  assert.match(violations[0], /literal \\\| outside a table row/u);
});

test('an escaped pipe inside a table row is allowed', () => {
  const page = [
    '| Prop | Type | Default | Description |',
    '| --- | --- | --- | --- |',
    "| `variant` | `'a' \\| 'b'` | `'a'` | Visual variant. |",
  ].join('\n');

  assert.deepEqual(collectRenderedPageViolations(page, 'button'), []);
});

// A fenced example may legitimately contain an escaped pipe as sample text.
test('an escaped pipe inside a code fence is not a violation', () => {
  const page = ['```md', "| `x` | `'a' \\| 'b'` |", '```'].join('\n');

  assert.deepEqual(collectRenderedPageViolations(page, 'table'), []);
});

test('every generated component page is free of escaped pipes in prose', () => {
  const offenders = buildPublicComponentManifest(REPO_ROOT).flatMap((component) =>
    collectRenderedPageViolations(renderPublicComponentPage(component), component.name),
  );

  assert.deepEqual(offenders, []);
});


// `variant`/`size` arrive through `VariantProps<typeof x>`, which this parser cannot resolve, so
// the allowed values were published nowhere. They are literals in the `cva()` call.
test('cva variants are read from the call, with their defaults', () => {
  const source = `
    const buttonVariants = cva('base', {
      variants: {
        variant: { primary: 'a', ghost: 'b' },
        size: { sm: 'c', md: 'd' },
      },
      defaultVariants: { variant: 'primary', size: 'md' },
    });
  `;

  const found = extractCvaVariants([{ path: 'button.tsx', source }]);

  assert.deepEqual(found.get('buttonVariants').props.get('variant'), {
    values: ['primary', 'ghost'],
    default: 'primary',
  });
  assert.deepEqual(found.get('buttonVariants').props.get('size'), { values: ['sm', 'md'], default: 'md' });
});

test('a cva call with no defaultVariants still publishes its values', () => {
  const source = "const x = cva('', { variants: { tone: { neutral: 'a' } } });";

  assert.deepEqual(extractCvaVariants([{ path: 'x.tsx', source }]).get('x').props.get('tone'), {
    values: ['neutral'],
    default: undefined,
  });
});

test('a non-cva call is not mistaken for variants', () => {
  const source = "const x = notCva('', { variants: { tone: { neutral: 'a' } } });";

  assert.equal(extractCvaVariants([{ path: 'x.tsx', source }]).size, 0);
});

// Input declares `Omit<VariantProps<typeof inputVariants>, 'invalid'>` because it re-declares
// `invalid`; matching only the bare form left its variants unpublished.
test('a VariantProps base is recognised bare and inside Omit', () => {
  assert.deepEqual(variantsIdentifierFromBase('VariantProps<typeof buttonVariants>'), {
    identifier: 'buttonVariants',
    omitted: new Set(),
  });
  assert.deepEqual(variantsIdentifierFromBase("Omit<VariantProps<typeof inputVariants>, 'invalid'>"), {
    identifier: 'inputVariants',
    omitted: new Set(['invalid']),
  });
  assert.equal(variantsIdentifierFromBase("Omit<PressableProps, 'role'>"), undefined);
});


// cva types a variant whose keys are `true`/`false` as `boolean`. Publishing the string union
// put `'true' | 'false'` on the Stack page, which the same page contradicts with `<HStack wrap>`.
test('a boolean cva variant keeps its boolean default', () => {
  const source = `
    const stackVariants = cva('', {
      variants: { wrap: { true: 'flex-wrap', false: 'flex-nowrap' } },
      defaultVariants: { wrap: false },
    });
  `;

  assert.deepEqual(extractCvaVariants([{ path: 'stack.tsx', source }]).get('stackVariants').props.get('wrap'), {
    values: ['true', 'false'],
    default: 'false',
  });
});

test('a numeric cva default is not dropped', () => {
  const source = "const x = cva('', { variants: { level: { 1: 'a', 2: 'b' } }, defaultVariants: { level: 1 } });";

  assert.equal(extractCvaVariants([{ path: 'x.tsx', source }]).get('x').props.get('level').default, '1');
});

// A `VariantProps<...>` reaching the page means the cva behind it was never resolved, so the page
// points a reader at a module-private const. It survived on 11 lines across six pages.
test('an unresolved VariantProps on the page is a violation', () => {
  const page = 'Also carries every prop of `VariantProps<typeof buttonVariants>` — not reproduced here.';

  const violations = collectRenderedPageViolations(page, 'dialog');

  assert.equal(violations.length, 1);
  assert.match(violations[0], /unresolved `VariantProps<\.\.\.>`/u);
});

test('no generated component page names an unresolved VariantProps', () => {
  const offenders = buildPublicComponentManifest(REPO_ROOT).flatMap((component) =>
    collectRenderedPageViolations(renderPublicComponentPage(component), component.name),
  );

  assert.deepEqual(offenders, []);
});

// "100% described" counts glossary sentences and generated variant text, not only per-prop prose.
test('prop-description coverage reports how many descriptions are distinct', () => {
  const manifest = [
    {
      typeDocs: [
        {
          kind: 'object',
          fields: [
            { name: 'a', description: 'Shared.' },
            { name: 'b', description: 'Shared.' },
            { name: 'c', description: 'Its own.' },
          ],
        },
      ],
    },
  ];

  assert.deepEqual(collectPropDescriptionCoverage(manifest), { described: 3, distinct: 2, sharedAcrossProps: 1, total: 3 });
});


// The boolean decision happens where the field is emitted, not in the extractor, so a test on
// `extractCvaVariants` alone cannot see it — reverting the fix left that test green. This asserts
// the published shape instead: Stack's `wrap` is `boolean`, and the page uses `<HStack wrap>`.
test('a boolean cva variant publishes as boolean, not a string union', () => {
  const stack = buildPublicComponentManifest(REPO_ROOT).find((component) => component.name === 'stack');
  const props = stack.typeDocs.find((entry) => entry.name === 'StackProps');
  const wrap = props.fields.find((field) => field.name === 'wrap');

  assert.equal(wrap.type, 'boolean');
  assert.equal(wrap.default, 'false');
});


test('cva boolean keys publish as boolean, other keys as string literals', () => {
  assert.equal(cvaVariantType(['true', 'false']).type, 'boolean');
  assert.equal(cvaVariantType(['sm', 'md']).type, "'sm' | 'md'");
  // Numeric keys are NOT special-cased: `extractCvaVariants` strips quotes, so `{ 1: … }` and
  // `{ '1': … }` are indistinguishable here and guessing was wrong for the quoted form.
  assert.equal(cvaVariantType(['1', '2']).type, "'1' | '2'");
});

// A wrapper that forwards a prop can re-default it. Applying the shared cva's own defaults
// globally published 'primary' for AlertDialogAction, whose real default is 'destructive'.
test('a prop re-defaulted by a forwarding wrapper takes the wrapper default', () => {
  const source = `
    export const AlertDialogAction = React.forwardRef<Ref, AlertDialogActionProps>(
      ({ variant, ...props }, ref) => <DialogClose ref={ref} {...props} variant={variant ?? 'destructive'} />
    );
  `;

  const defaults = extractDefaults(
    [{ path: 'alert-dialog.tsx', source }],
    new Set(['AlertDialogActionProps']),
  );

  assert.equal(defaults.get('variant'), "'destructive'");
});

test('AlertDialog publishes the defaults its wrappers apply, not buttonVariants own', () => {
  const alertDialog = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'alert-dialog');
  const defaultFor = (typeName) =>
    alertDialog.typeDocs
      .find((entry) => entry.name === typeName)
      ?.fields?.find((field) => field.name === 'variant')?.default;

  assert.equal(defaultFor('AlertDialogActionProps'), "'destructive'");
  assert.equal(defaultFor('AlertDialogCancelProps'), "'outline'");
  // The trigger does not re-default, so it keeps buttonVariants own default.
  assert.equal(defaultFor('AlertDialogTriggerProps'), "'primary'");
});

// Coverage can sit at 100% while saying one thing 700 times.
test('a manifest whose descriptions are all one sentence is a violation', () => {
  const fields = Array.from({ length: 700 }, (unused, index) => ({
    name: `p${index}`,
    description: 'Same boilerplate.',
  }));

  const violations = collectPropDescriptionViolations([{ typeDocs: [{ kind: 'object', fields }] }]);

  assert.match(violations[0], /distinct prop descriptions dropped to 1/u);
});


// A sentence reused for the SAME prop across families is correct — that is what the glossary is
// for. A sentence covering two DIFFERENT props is not, and it needs no threshold to detect.
test('reusing a sentence for the same prop across families is not a violation', () => {
  const fields = [
    ...Array.from({ length: 400 }, () => ({ name: 'className', description: 'Extra utility classes.' })),
    ...Array.from({ length: PROP_DISTINCT_DESCRIPTION_FLOOR }, (unused, index) => ({
      name: `p${index}`,
      description: `Sentence ${index}.`,
    })),
  ];

  const violations = collectPropDescriptionViolations([{ typeDocs: [{ kind: 'object', fields }] }]);

  assert.deepEqual(violations.filter((entry) => /different names/u.test(entry)), []);
});

test('one sentence covering two different props is a violation', () => {
  const fields = [
    { name: 'size', description: 'Selects a preset.' },
    { name: 'variant', description: 'Selects a preset.' },
    ...Array.from({ length: PROP_DISTINCT_DESCRIPTION_FLOOR }, (unused, index) => ({
      name: `p${index}`,
      description: `Sentence ${index}.`,
    })),
  ];

  const violations = collectPropDescriptionViolations([{ typeDocs: [{ kind: 'object', fields }] }]);

  assert.match(
    violations.find((entry) => /different names/u.test(entry)),
    /1 description\(s\) are shared by props with different names/u,
  );
});

test('no published description covers two different props', () => {
  const { sharedAcrossProps } = collectPropDescriptionCoverage(buildPublicComponentManifest(REPO_ROOT));

  assert.equal(sharedAcrossProps, 0);
});

// forwardRef((props, ref) => { const { x = 'lit' } = props }) — the shape that left 30 rows blank.
test('a default destructured in a forwardRef body is published', () => {
  const source = `
    export const Calendar = React.forwardRef<Ref, CalendarProps>((props, forwardedRef) => {
      const { readOnly = false, weekdayFormat = 'short' } = props;
      return null;
    });
  `;

  const defaults = extractDefaults([{ path: 'calendar.tsx', source }], new Set(['CalendarProps']));

  assert.equal(defaults.get('readOnly'), 'false');
  assert.equal(defaults.get('weekdayFormat'), "'short'");
});


// The two default collectors used to disagree on precedence, so which default was published
// depended on which of them ran. A node that both destructures a default and forwards a `??`
// fallback must publish the destructured one.
test('a destructured default wins over a forwarded fallback on the same node', () => {
  const source = `
    export const Trigger = React.forwardRef<Ref, TriggerProps>(
      ({ variant = 'destructured', ...rest }, ref) => <Inner ref={ref} {...rest} variant={variant ?? 'fallback'} />
    );
  `;

  const defaults = extractDefaults([{ path: 'trigger.tsx', source }], new Set(['TriggerProps']));

  assert.equal(defaults.get('variant'), "'destructured'");
});

// The body walk must only read a destructure of the props parameter itself.
test('a destructure of something other than the props parameter is not a default source', () => {
  const source = `
    export const Widget = React.forwardRef<Ref, WidgetProps>((props, ref) => {
      const { size = 'lg' } = somethingElse;
      return null;
    });
  `;

  const defaults = extractDefaults([{ path: 'widget.tsx', source }], new Set(['WidgetProps']));

  assert.equal(defaults.get('size'), undefined);
});

// An expression-bodied forwardRef has no block to walk; it must not throw or invent defaults.
test('an expression-bodied forwardRef yields no body defaults', () => {
  const source = `
    export const Plain = React.forwardRef<Ref, PlainProps>((props, ref) => <Inner {...props} />);
  `;

  const defaults = extractDefaults([{ path: 'plain.tsx', source }], new Set(['PlainProps']));

  assert.equal(defaults.size, 0);
});


// The cva rows used to end "see Styling and theming for what each value changes". That section is
// one boilerplate paragraph across all 62 pages and says nothing about any value — a pointer that
// answered nothing, published on 41 rows. The replacement names the file, so assert the file.
test('a cva-derived description names the file that declares the variants', () => {
  const button = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'button');
  const props = button.typeDocs.find((entry) => entry.name === 'ButtonProps');
  const variant = props.fields.find((field) => field.name === 'variant');

  assert.match(variant.description, /packages\/ui\/src\/components\/button\.tsx/u);
  assert.equal(/Styling and theming/u.test(variant.description), false);
});

test('no generated page still points at Styling and theming for variant values', () => {
  const offenders = buildPublicComponentManifest(REPO_ROOT).filter((component) =>
    renderPublicComponentPage(component).includes('see Styling and theming for what each value changes'),
  );

  assert.deepEqual(offenders.map((component) => component.name), []);
});


// The Accessibility section was one identical paragraph on all 62 pages asserting that roles and
// states "remain component-specific" — a page contradicting itself.
test('accessibility facts are read from JSX, not from comments or selector strings', () => {
  const source = `
    // react-native-web always renders \`role="progressbar"\` here, which is not ours to claim.
    const q = '[role="cell"][tabindex="0"]';
    export const Thing = () => (
      <View role="listitem" accessibilityState={{ checked: true, disabled: false }}>
        <Inner aria-expanded={open} />
      </View>
    );
  `;

  const { roles, states } = extractAccessibilityFacts([{ path: 'thing.tsx', source }]);

  assert.deepEqual(roles, ['listitem']);
  assert.deepEqual(states, ['checked', 'disabled', 'expanded']);
});

// `role={decorative ? undefined : 'separator'}` assigns a real role on one branch.
test('a role assigned through a conditional expression is read', () => {
  const source = "export const S = () => <View role={decorative ? undefined : 'separator'} />;";

  assert.deepEqual(extractAccessibilityFacts([{ path: 's.tsx', source }]).roles, ['separator']);
});

test('a role coming from a variable claims nothing', () => {
  const source = 'export const S = () => <View role={someRole} />;';

  assert.deepEqual(extractAccessibilityFacts([{ path: 's.tsx', source }]).roles, []);
});

test('every component page states the roles that family assigns', () => {
  const pages = buildPublicComponentManifest(REPO_ROOT).map((component) => ({
    name: component.name,
    page: renderPublicComponentPage(component),
  }));

  for (const { name, page } of pages) {
    assert.match(page, /\*\*Roles this family assigns:\*\*/u, `${name} lost its roles line`);
  }
  // The section used to be one body across all 62 pages while claiming to be component-specific.
  const bodies = new Set(pages.map(({ page }) => page.split('## Accessibility')[1].split('## ')[0]));
  assert.ok(bodies.size > 20, `expected differentiated accessibility sections, got ${bodies.size}`);
});


// Platform behavior closed by saying platform-specific behavior is called out "rather than hidden
// behind a generic parity claim", while being exactly that claim on 56 of 62 pages.
test('a platform-split family names the files it renders from', () => {
  const sheet = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'sheet');
  const page = renderPublicComponentPage(sheet);

  assert.match(page, /split by platform and renders from/u);
  assert.match(page, /`sheet\.web\.tsx` \(Web\)/u);
  assert.match(page, /`sheet\.native\.tsx` \(iOS and Android\)/u);
});

test('a single-implementation family says so instead of claiming parity', () => {
  const text = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'text');
  const page = renderPublicComponentPage(text);

  assert.match(page, /ships no platform-specific file/u);
  assert.equal(/rather than hidden behind a generic parity claim/u.test(page), false);
});

// Styling and theming was one identical paragraph on all 62 pages.
test('the styling section names the family own style axes and class surfaces', () => {
  const avatar = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'avatar');
  const page = renderPublicComponentPage(avatar);

  assert.match(page, /\*\*Style axes:\*\* `size` \(4 values\)/u);
  assert.match(page, /`className`, `fallbackClassName`, `imageClassName`/u);
});

test('a family with no variant prop says it has no style axes', () => {
  const separator = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'separator');

  assert.match(renderPublicComponentPage(separator), /\*\*Style axes:\*\* none;/u);
});

// The three sections that used to be one body across every page must stay differentiated.
test('the shared-template sections are no longer one body for every page', () => {
  const pages = buildPublicComponentManifest(REPO_ROOT).map((c) => renderPublicComponentPage(c));
  const bodies = (heading) =>
    new Set(pages.map((page) => page.split(`## ${heading}`)[1]?.split('\n## ')[0] ?? ''));

  assert.ok(bodies('Styling and theming').size > 10, 'styling section is still one template');
  assert.ok(bodies('Accessibility').size > 20, 'accessibility section is still one template');
  assert.ok(bodies('Platform behavior').size > 5, 'platform section is still one template');
});


// "No component-specific limitation is curated here" was published on DatePicker, which requires
// an optional native peer nothing installs for you, and on Sheet, which accepts three Web props
// that do nothing there. The page said there was nothing to say while the repo had something.
test('a family needing an optional native peer says so in Limitations', () => {
  const datePicker = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'date-picker');
  const page = renderPublicComponentPage(datePicker);

  assert.match(page, /Requires `@react-native-community\/datetimepicker` to be installed/u);
  assert.match(page, /It is an optional peer/u);
  assert.equal(/No component-specific limitation is curated here/u.test(page), false);
});

test('a family with props that do nothing on Web says which ones', () => {
  const sheet = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'sheet');
  const page = renderPublicComponentPage(sheet);

  assert.match(page, /`avoidKeyboard`, `enableSwipeToDismiss`, `modalProps` are accepted for API parity/u);
});

// A derived limitation must never replace a curated one.
test('curated limitations survive alongside derived ones', () => {
  const tooltip = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'tooltip');

  assert.match(renderPublicComponentPage(tooltip), /Never a press target and never interactive content/u);
});

// A family with no derivable constraint must still admit the gap rather than invent one.
test('a family with nothing derivable still says none is curated', () => {
  const text = buildPublicComponentManifest(REPO_ROOT).find((c) => c.name === 'text');

  assert.match(renderPublicComponentPage(text), /No component-specific limitation is curated here/u);
});
