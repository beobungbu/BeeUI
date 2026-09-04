import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTypeIndex,
  extractConsumedProps,
  extractDefaults,
  resolveComponentTypeEntry,
  resolveDeclaration,
} from '../component-props-lib.mjs';
import {
  buildPublicComponentManifest,
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
