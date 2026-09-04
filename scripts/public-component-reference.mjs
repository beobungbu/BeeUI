#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coverageForComponent } from '../apps/showcase/component-coverage.ts';
import { showcaseHref } from '../apps/showcase/showcase-target.ts';
import {
  ROOT_DIR,
  buildShowcaseUsageIndex,
  getPublicComponents,
  readJson,
  usageForComponent,
} from './component-docs-lib.mjs';
import {
  diffPlatformPropsShape,
  extractOmitPickOrBareTypeName,
  getBehaviorGuardKnownNames,
  getComponentTypeDocs,
} from './component-props-lib.mjs';

// The ratified owner route for a component family is /docs/components/<slug>/ — that is what
// docs/public-surface-owners.json routes 444 inventory rows to. Emitting under a /reference/
// sub-prefix left every one of those rows counted as planned, so the coverage gate reported a
// documented surface that no page answered to.
export const PUBLIC_COMPONENT_DIR = 'apps/docs/src/content/docs/components';

const CATEGORY_RULES = [
  ['Forms & selection', /^(input|textarea|password-input|otp-input|search-input|field|form-group|form-message|label|checkbox|radio|switch|select|calendar|date-picker|date-time-picker)$/],
  ['Overlays & feedback', /^(dialog|alert-dialog|popover|dropdown-menu|tooltip|sheet|toast|alert-banner|state-message|spinner|skeleton|progress)$/],
  ['Layout & surfaces', /^(box|stack|screen|safe-area|card|section|keyboard-aware-screen|bottom-action-bar)$/],
  ['Navigation & disclosure', /^(app-header|breadcrumb|link|pagination|tabs|accordion|collapsible|stepper)$/],
  ['Data display', /^(avatar|badge|chip|description-list|list-group|list-item|metadata-row|separator|stat|table|text|timeline)$/],
  ['Actions & controls', /^(button|icon-button|segmented-control)$/],
  ['Theming & utilities', /^(theme-scope|use-bee-token|visually-hidden)$/],
];

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map((part) => part === 'otp' ? 'OTP' : part === 'bee' ? 'Bee' : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function categoryForComponent(name) {
  return CATEGORY_RULES.find(([, matcher]) => matcher.test(name))?.[0] ?? 'Other';
}

function githubHref(pathname) {
  return `https://github.com/beobungbu/BeeUI/blob/main/${pathname}`;
}

export function buildPublicComponentManifest(rootDir = ROOT_DIR) {
  const content = readJson('docs/component-reference.content.json', rootDir);
  const usageIndex = buildShowcaseUsageIndex(rootDir);
  return getPublicComponents(rootDir).map((component) => {
    const curated = content.components?.[component.name];
    const examples = usageForComponent(component, usageIndex).slice(0, 4);
    return {
      ...component,
      title: titleFromSlug(component.name),
      category: categoryForComponent(component.name),
      purpose: curated?.purpose ?? '',
      behavior: curated?.behavior ?? '',
      limitations: curated?.limitations ?? '',
      notes: curated?.notes ?? '',
      typeDocs: getComponentTypeDocs(component, rootDir),
      examples,
      route: `/docs/components/${component.name}/`,
      showcaseHref: showcaseHref({ surface: 'component', id: component.name, example: 'basic' }),
      exampleTargets: coverageForComponent(component.name).map((example) => ({
        example,
        href: showcaseHref({ surface: 'component', id: component.name, example }),
      })),
      sourceHref: githubHref(component.source),
      registryHref: githubHref('registry/registry.json'),
    };
  });
}

// --- Behavior-prose prop guard (WBS-G060 M8) --------------------------------
//
// `docs/component-reference.content.json`'s 62 `behavior` strings were hand-written in one
// pass and are otherwise unverified against the real source: `progress.behavior` claimed a
// `min` prop `ProgressProps` never had. This checks every backtick-quoted, lower-camelCase
// bareword (`` `value` ``, `` `onValueChange` ``) against the same field/value data the props
// tables are built from — via `getBehaviorGuardKnownNames` — and flags the ones that resolve
// to nothing.
//
// This is intentionally not exhaustive. Two small, explicit exception lists absorb the real,
// non-bug cases that data alone cannot resolve — see each list's comment for exactly what it
// covers and why. A genuine typo that happens to collide with one of these words is this
// guard's documented blind spot.
const BEHAVIOR_PROP_LIKE_TOKEN = /`([a-z][A-Za-z0-9]*)`/g;

// JS literal keywords that are commonly backticked in prose (`defaults to \`true\``) and would
// otherwise look exactly like a prop-shaped identifier.
const BEHAVIOR_GUARD_LITERAL_KEYWORDS = new Set(['true', 'false', 'null', 'undefined']);

// Field names that come from a genuinely external contract this generator does not parse
// (react-native/react-native-web `Pressable`/`TextInput` props, react-native-safe-area-context's
// `SafeAreaView.edges`) or from an imperative hook-return member (`useToast().dismiss`/
// `dismissAll` — a value on an object `useToast()` returns, not a component prop or an exported
// symbol itself).
const BEHAVIOR_GUARD_EXTERNAL_TERMS = new Set([
  'accessibilityLabel',
  'disabled',
  'dismiss',
  'dismissAll',
  'edges',
  'nativeID',
  'onChangeText',
  'onPress',
  'secureTextEntry',
  'value',
]);

// ARIA role / native semantic-element barewords that legitimately appear unquoted in
// accessibility prose ("no generic native `fieldset` role", "`radiogroup` semantics") without
// being a prop at all. The guard cannot distinguish a role bareword from a prop-shaped
// identifier by shape alone.
const BEHAVIOR_GUARD_NON_PROP_TERMS = new Set(['fieldset', 'radiogroup']);

// Backticked, prop-shaped identifiers in `component.behavior` that resolve to neither a known
// prop/exported-value of the family nor a documented exception — each one is either a stale/
// typo'd prop reference (the bug class M8 exists to catch) or a legitimate case the two
// exception lists above have not been tuned for yet.
function findUnknownBehaviorPropReferences(component, rootDir, field = 'behavior') {
  const known = getBehaviorGuardKnownNames(component, component.typeDocs, rootDir);
  const unknown = [];
  BEHAVIOR_PROP_LIKE_TOKEN.lastIndex = 0;
  let match;
  while ((match = BEHAVIOR_PROP_LIKE_TOKEN.exec(component[field] ?? ''))) {
    const token = match[1];
    if (BEHAVIOR_GUARD_LITERAL_KEYWORDS.has(token)) continue;
    if (BEHAVIOR_GUARD_EXTERNAL_TERMS.has(token)) continue;
    if (BEHAVIOR_GUARD_NON_PROP_TERMS.has(token)) continue;
    if (known.has(token)) continue;
    unknown.push(token);
  }
  return unknown;
}

export function collectPublicComponentReferenceViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const manifest = buildPublicComponentManifest(rootDir);
  const names = new Set();
  const routes = new Set();

  if (manifest.length === 0) violations.push('public component manifest is empty.');

  for (const component of manifest) {
    if (names.has(component.name)) violations.push(`duplicate public component ${component.name}.`);
    names.add(component.name);
    if (routes.has(component.route)) violations.push(`duplicate public component route ${component.route}.`);
    routes.add(component.route);
    if (!component.purpose.trim()) violations.push(`${component.name}: missing curated purpose.`);
    // `purpose` and `limitations` are published in the meta description, the page lead and the
    // repository reference. Guarding only `behavior` let the AlertDialog page assert the
    // opposite of itself at line 8 and line 52 — the behavior text was corrected and the
    // purpose above it was not.
    for (const field of ['purpose', 'limitations']) {
      for (const token of findUnknownBehaviorPropReferences(component, rootDir, field)) {
        violations.push(
          `${component.name}: ${field} references \`${token}\`, which is not a known prop or exported value of this family.`,
        );
      }
    }
    if (!component.behavior.trim()) {
      violations.push(`${component.name}: missing curated behavior contract.`);
    } else {
      for (const token of findUnknownBehaviorPropReferences(component, rootDir, 'behavior')) {
        violations.push(
          `${component.name}: behavior references \`${token}\`, which is not a known prop or exported value of this family.`,
        );
      }
    }
    if (!component.source || !fs.existsSync(path.join(rootDir, component.source))) {
      violations.push(`${component.name}: source path is missing: ${component.source}.`);
    }
    if (!component.values.length) violations.push(`${component.name}: no public runtime exports.`);
    if (!component.examples.length) violations.push(`${component.name}: no executable Showcase example.`);
    if (!component.cliAdd.startsWith('pnpm beeui add ')) {
      violations.push(`${component.name}: registry identity is not the repository-local source-ownership command.`);
    }
    if (!component.route.startsWith('/docs/components/')) {
      violations.push(`${component.name}: route escaped canonical Components section.`);
    }
  }

  const curatedNames = Object.keys(readJson('docs/component-reference.content.json', rootDir).components ?? {});
  for (const name of curatedNames) {
    if (!names.has(name)) violations.push(`curated component ${name} is no longer a public Registry/export-map component.`);
  }

  return violations;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function renderExampleTargets(component) {
  return component.exampleTargets
    .map(({ example, href }) => `- [\`${example}\`](${href}) — ${example === 'basic' ? 'smallest meaningful complete usage' : `the ${example} example`}`)
    .join('\n');
}

function renderAnatomy(component) {
  if (component.values.length <= 1) return `- Primary export: \`${component.values[0]}\``;
  return component.values.map((value, index) => `${index === 0 ? '- Family exports:' : '  '} \`${value}\``).join('\n');
}

// --- Derived props tables (WBS-G061 B1) -------------------------------------
//
// Renders the shapes `scripts/component-props-lib.mjs` derives from the real
// TypeScript source, so this section states real fields/types/defaults
// instead of the fixed "see the canonical catalog" paragraph every page used
// to carry byte-for-byte identically.

// A cell/type value printed from a multi-line type node (e.g. a base wrapped across lines by
// Prettier) keeps its newlines and indentation, which would otherwise render as
// `Omit< RNSwitchProps, … >`: collapsed to a single space first, but leaving a stray space
// right after `<`/`(` or right before `>`/`)`. Both the whitespace collapse and that
// bracket-adjacent trim happen here so every caller — table cells and the prose "Also carries…"
// line alike — gets the same normalization instead of only the line that was fixed first.
function escapeCell(text) {
  return String(text ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/([<(])\s+/gu, '$1')
    .replace(/\s+([>)])/gu, '$1')
    .replace(/\|/g, '\\|');
}

function renderFieldRow(field) {
  const name = field.optional ? `\`${field.name}\`` : `\`${field.name}\` **(required)**`;
  const type = `\`${escapeCell(field.type)}\``;
  const fallback = field.default !== undefined ? `\`${escapeCell(field.default)}\`` : '—';
  const description = field.description ? escapeCell(field.description) : '—';
  return `| ${name} | ${type} | ${fallback} | ${description} |`;
}

// A base such as `Omit<StackProps, 'direction'>` or `Omit<InputProps, 'multiline' | 'size'>`
// names a type BeeUI itself declares and documents on its own public component page — calling
// that "upstream" and leaving it unlinked (as every base used to be rendered) makes it
// indistinguishable from a genuinely external contract like `ViewProps`/`PressableProps`. This
// resolves the base's root type name against every public family's exported type names and
// links to the owning family's page when it is BeeUI's own; a base that resolves to nothing
// (external, or a generic this module does not parse, e.g. `VariantProps<typeof xVariants>`)
// keeps the original "upstream contract" wording unchanged.
let publicTypeOwnerIndexCache;

function getPublicTypeOwnerIndex(rootDir) {
  if (!publicTypeOwnerIndexCache || publicTypeOwnerIndexCache.rootDir !== rootDir) {
    const owners = new Map();
    for (const component of getPublicComponents(rootDir)) {
      for (const typeName of component.types) owners.set(typeName, component);
    }
    publicTypeOwnerIndexCache = { rootDir, owners };
  }
  return publicTypeOwnerIndexCache.owners;
}

function renderBasesLine(bases, rootDir = ROOT_DIR) {
  if (!bases.length) return '';
  const owners = getPublicTypeOwnerIndex(rootDir);
  const rendered = bases.map((base) => {
    const text = escapeCell(base);
    const typeName = extractOmitPickOrBareTypeName(base);
    const owner = typeName ? owners.get(typeName) : undefined;
    return { text, owner };
  });

  const external = rendered.filter((base) => !base.owner);
  const owned = rendered.filter((base) => Boolean(base.owner));

  const sentences = [];
  if (external.length) {
    const list = external.map((base) => `\`${base.text}\``).join(' and ');
    sentences.push(`Also carries every prop of ${list} — that upstream contract is not reproduced here.`);
  }
  for (const { text, owner } of owned) {
    sentences.push(
      `Also carries every prop of \`${text}\` — documented on the [${titleFromSlug(owner.name)}](/docs/components/${owner.name}/) page, not reproduced here.`,
    );
  }
  return `\n\n${sentences.join('\n\n')}`;
}

// A type that only narrows an upstream one has no fields of its own. Listing nothing and
// pointing upstream is accurate and useless: the reader still cannot find `value` or
// `onValueChange`. The implementation names the props it reads, so those are listed instead,
// labelled for what they are — the subset this family handles, not the whole upstream contract.
function renderConsumedProps(consumed) {
  const rows = consumed
    .map((prop) => `| \`${prop.name}\` | ${prop.default ? `\`${prop.default}\`` : '—'} |`)
    .join('\n');
  return (
    'This type adds no fields of its own. These are the props the implementation reads from the ' +
    'base type below; everything else is passed straight through.\n\n' +
    `| Prop | Default |\n| --- | --- |\n${rows}\n`
  );
}

function renderObjectShape(shape) {
  if (shape.fields.length) {
    const table = `| Prop | Type | Default | Description |\n| --- | --- | --- | --- |\n${shape.fields.map(renderFieldRow).join('\n')}`;
    return `${table}${renderBasesLine(shape.bases)}`;
  }
  const consumed = shape.consumed?.length
    ? renderConsumedProps(shape.consumed)
    : '_No own fields; this type is exactly the base(s) below._';
  return `${consumed}${renderBasesLine(shape.bases)}`;
}

// Renders one platform-object diff (see `diffPlatformObjectShape`) as a bullet list. A field
// present on only one platform, a field whose type or default differs, and a base that differs
// are each their own bullet — never folded into the main table, and never printed as if the
// native table's own Default/Type column already said so.
//
// A field listed on one declaration and not the other is NOT evidence the other platform lacks
// it: `testID` is explicit in `table.web.tsx` and inherited from `ViewProps` on native, and
// `colSpan` is the reverse, explicit on native and typed through `TdHTMLAttributes` on Web.
// Both were published as "declared on Web only" / "on native only", and both were false. The
// bases are external types this generator does not resolve, so absence is not decidable here
// and must not be asserted.
function renderPlatformDiffBullets(diff) {
  const lines = [];
  const bases = {
    native: (diff.nativeBases ?? []).join(' & '),
    web: (diff.webBases ?? []).join(' & '),
  };
  const inheritedNote = (otherPlatform, otherBase) =>
    otherBase
      ? ` — on ${otherPlatform} it may come from \`${escapeCell(otherBase)}\`, which this table does not reproduce`
      : ` — whether ${otherPlatform} carries it through its base type is not determined here`;

  for (const field of diff.nativeOnly) {
    const withDefault = field.default !== undefined ? ` (native default \`${escapeCell(field.default)}\`)` : '';
    lines.push(`- \`${field.name}\` is declared explicitly on native${withDefault}${inheritedNote('Web', bases.web)}.`);
  }
  for (const field of diff.webOnly) {
    const withDefault = field.default !== undefined ? ` (Web default \`${escapeCell(field.default)}\`)` : '';
    lines.push(`- \`${field.name}\` is declared explicitly on Web${withDefault}${inheritedNote('native', bases.native)}.`);
  }
  for (const name of diff.inert ?? []) {
    lines.push(`- \`${name}\` is accepted on Web for API parity but has no effect there.`);
  }
  for (const change of diff.changed) {
    if (change.typeChanged) {
      lines.push(
        `- \`${change.name}\` type differs: native \`${escapeCell(change.native.type)}\`, Web \`${escapeCell(change.web.type)}\`.`,
      );
    }
    if (change.defaultChanged) {
      const nativeDefault = change.native.default !== undefined ? `\`${escapeCell(change.native.default)}\`` : 'no default';
      const webDefault = change.web.default !== undefined ? `\`${escapeCell(change.web.default)}\`` : 'no default';
      lines.push(`- \`${change.name}\` default differs: native ${nativeDefault}, Web ${webDefault}.`);
    }
    if (change.optionalChanged) {
      const nativeReq = change.native.optional ? 'optional' : 'required';
      const webReq = change.web.optional ? 'optional' : 'required';
      lines.push(`- \`${change.name}\` is ${nativeReq} on native but ${webReq} on Web.`);
    }
  }
  if (diff.basesChanged) {
    const nativeBases = diff.nativeBases.length ? diff.nativeBases.map((base) => `\`${escapeCell(base)}\``).join(' and ') : '_none_';
    const webBases = diff.webBases.length ? diff.webBases.map((base) => `\`${escapeCell(base)}\``).join(' and ') : '_none_';
    lines.push(`- Base type differs: native carries ${nativeBases}; Web carries ${webBases}.`);
  }
  return lines;
}

// A platform-split family's Web file sometimes redeclares a `*Props` type with a genuinely
// different shape (see the `diffPlatformPropsShape` module comment in `component-props-lib.mjs`
// for the concrete `table`/`sheet` cases this exists for). `entry.webShape` is only set when
// that happened; this renders the derived diff explicitly so the table above is never presented
// as the whole cross-platform contract without qualification.
function renderPlatformDiffNote(entry) {
  const diff = diffPlatformPropsShape(entry, entry.webShape);
  if (!diff) return '';
  const webHref = githubHref(entry.webSource);
  if (diff.kind === 'unsupported') {
    return (
      `\n\n**Platform note:** this table documents the native declaration only. \`${entry.name}\` in ` +
      `[\`${entry.webSource}\`](${webHref}) has a structurally different shape that this generator ` +
      'does not diff automatically — consult the source directly for the Web contract.'
    );
  }
  const lines = [];
  if (diff.kind === 'object') {
    lines.push(...renderPlatformDiffBullets({ ...diff.diff, inert: entry.webShape?.inert }));
  } else {
    for (const { variantName, diff: variantDiff } of diff.variantDiffs) {
      lines.push(`- Variant \`${variantName}\`:`);
      for (const line of renderPlatformDiffBullets(variantDiff)) lines.push(`  ${line}`);
    }
    for (const variantName of diff.unmatched) {
      lines.push(`- Variant \`${variantName}\` exists on only one platform; consult the source directly.`);
    }
  }
  if (!lines.length) return '';
  return `\n\n**Platform differences (native vs. [Web](${webHref})):**\n\n${lines.join('\n')}`;
}

function renderPropsTypeEntry(entry) {
  const heading = `#### \`${entry.name}\``;
  let body;
  if (entry.kind === 'union') {
    const intro = entry.aliasOf ? `\`${entry.name}\` is exactly \`${entry.aliasOf}\`, ` : '';
    const variants = entry.variants
      .map((variant) => `**Variant \`${variant.name}\`:**\n\n${renderObjectShape(variant)}`)
      .join('\n\n');
    body = `${intro}one of the following mutually exclusive variants:\n\n${variants}`;
  } else {
    const intro = entry.aliasOf ? `\`${entry.name}\` is exactly \`${entry.aliasOf}\`.\n\n` : '';
    body = `${intro}${renderObjectShape(entry)}`;
  }
  const platformNote = entry.webShape ? renderPlatformDiffNote(entry) : '';
  return `${heading}\n\n${body}${platformNote}`;
}

function renderRelatedTypeEntry(entry) {
  if (entry.kind === 'literal-union') {
    return `- \`${entry.name}\` — one of ${entry.members.map((member) => `\`'${member}'\``).join(', ')}.`;
  }
  return `- \`${entry.name}\` — alias of \`${escapeCell(entry.aliasOf)}\`.`;
}

function renderTypeDocs(typeDocs) {
  const propsEntries = typeDocs.filter((entry) => entry.docKind === 'props');
  const otherEntries = typeDocs.filter((entry) => entry.docKind !== 'props');
  const propsSection = propsEntries.length
    ? propsEntries.map(renderPropsTypeEntry).join('\n\n')
    : '_This family exports no `*Props` type._';
  const relatedSection = otherEntries.length
    ? `\n\n**Related exported types:**\n\n${otherEntries.map(renderRelatedTypeEntry).join('\n')}`
    : '';
  return `${propsSection}${relatedSection}`;
}

export function renderPublicComponentPage(component) {
  const examples = component.examples
    .map((file, index) => `- ${index === 0 ? '**Primary executable fixture:**' : '**Additional fixture:**'} [\`${file}\`](${githubHref(file)})`)
    .join('\n');
  const types = component.types.length ? component.types.map((name) => `\`${name}\``).join(', ') : 'No separately exported public types.';
  const peers = component.peerDependencies.length ? component.peerDependencies.map((name) => `\`${name}\``).join(', ') : 'Only the package baseline peers.';
  const registryDeps = component.registryDependencies.length ? component.registryDependencies.map((name) => `\`${name}\``).join(', ') : 'None.';
  const platformSplit = component.allSources.length > 1
    ? 'This family has platform-split source files. The bundler selects the native/Web implementation; do not infer native runtime behavior from the Web preview.'
    : 'The same public family is exposed across the supported target matrix; meaningful platform differences remain governed by the compatibility contract.';
  const limitations = component.limitations || 'No component-specific limitation is curated here. Check Compatibility and the linked behavior contract for target-specific constraints.';
  const provider = component.providerRequired
    ? '`BeeUIProvider` is required above this family because it participates in shared overlay/toast runtime infrastructure.'
    : 'No additional provider is required by this family. `BeeUIProvider` remains the recommended application root.';

  return `---\ntitle: ${yamlString(component.title)}\ndescription: ${yamlString(component.purpose)}\n---\n\n<!-- Generated by scripts/public-component-reference.mjs. Do not hand-edit. -->\n\n${component.purpose}\n\n:::note[Distribution status]\nBeeUI packages and the public CLI remain unpublished. The import shape below is the stable public package boundary used by workspace/packed-consumer verification; use the repository-local Registry command only from a BeeUI checkout until publication is explicitly authorized.\n:::\n\n## Identity\n\n- **Category:** ${component.category}\n- **Status:** stable public Registry/export-map component family\n- **Targets:** iOS · Android · Web, subject to the [compatibility contract](/docs/compatibility/)\n- **Source:** [\`${component.source}\`](${component.sourceHref})\n\n## Import\n\n\`\`\`tsx\nimport { ${component.values.join(', ')} } from '@beemvp/beeui-ui';\n\`\`\`\n\nThere is no documented deep/private source import. For source ownership from a BeeUI checkout:\n\n\`\`\`bash\n${component.cliAdd}\n\`\`\`\n\nRegistry metadata: [\`registry/registry.json\`](${component.registryHref}).\n\n## Composition and public API\n\n${renderAnatomy(component)}\n\n**Exported types:** ${types}\n\nThe generated API inventory is mechanically joined to \`packages/ui/src/index.ts\`, Registry metadata, and the component reference contract. Each type's field table below is parsed directly from that source, not a second hand-maintained copy; for the fuller behavior narrative see the [canonical component behavior catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md).\n\n## State and behavior contract\n\n${component.behavior}\n\n### Props\n\n${renderTypeDocs(component.typeDocs)}\n\nThe executable fixtures below are the source-grounded usage examples; consumers should not infer state ownership from DOM structure or another UI library.\n\n## Provider and dependencies\n\n- ${provider}\n- **Peer/native dependencies visible to this Registry item:** ${peers}\n- **Registry dependency closure:** ${registryDeps}\n- Safe-area ownership remains explicit: shell surfaces touching system edges opt into \`SafeArea\`; components do not silently invent app-shell insets.\n- Web consumers load the BeeUI semantic theme CSS as documented in [Web onboarding](/docs/start/web/).\n\n## Platform behavior\n\n${platformSplit}\n\n- **Web:** live browser/keyboard behavior is verified by Web-specific checks where applicable.\n- **iOS / Android:** package/export/native compile evidence is not described as device-runtime proof. Consult the compatibility and native-preview guides for the exact evidence class.\n- Platform-specific or experimental behavior is called out in the canonical component/compatibility docs rather than hidden behind a generic parity claim.\n\n## Accessibility\n\nUse the [Accessibility overview](/docs/accessibility/), [RTL/localization](/docs/accessibility/rtl/), and [Large text & zoom](/docs/accessibility/large-text/) alongside this family. Roles/states, keyboard/focus behavior, announcements, Dynamic Type/Web zoom, RTL, and reduced-motion expectations remain component-specific; BeeUI does not claim universal accessibility certification from automated tests.\n\n## Styling and theming\n\nBeeUI components consume semantic tokens and support the current typed variant/density contracts. Use [Theming](/docs/theming/) and [Density](/docs/guides/density/). \`className\` is an implementation escape hatch for source-owned/application work, not a cross-engine portability guarantee.\n\n## Executable examples\n\n${examples}\n\n### Addressable examples\n\nEach link below opens the Showcase at that exact example, not at the top of the gallery:\n\n${renderExampleTargets(component)}\n\nThe Showcase links demonstrate Web behavior; use the native-preview guide for real simulator/emulator/device paths.\n\n## Limitations\n\n${limitations}\n\n${component.notes ? `**Implementation note:** ${component.notes}\n\n` : ''}## Related\n\n- [All components](/docs/components/)\n- [Production patterns](/docs/patterns/)\n- [Showcase](/showcase/)\n- [CLI & source ownership](/docs/guides/cli-source-ownership/)\n- [Source](${component.sourceHref})\n`;
}

export function renderPublicComponentIndex(manifest) {
  const groups = new Map();
  for (const component of manifest) {
    if (!groups.has(component.category)) groups.set(component.category, []);
    groups.get(component.category).push(component);
  }
  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, components]) => `## ${category}\n\n${components.map((component) => `- **[${component.title}](${component.route})** — ${component.purpose} · [Showcase](${component.showcaseHref})`).join('\n')}`)
    .join('\n\n');

  return `---\ntitle: All components\ndescription: Source-driven BeeUI public component reference.\n---\n\nThis index is generated from the public Registry + \`@beemvp/beeui-ui\` export map. It currently contains **${manifest.length}** stable public component families; adding or removing a public Registry component changes this inventory automatically and is checked by CI.\n\n${sections}\n`;
}

const GENERATED_MARKER = '<!-- Generated by scripts/public-component-reference.mjs. Do not hand-edit. -->';

// Only a page this generator wrote may be deleted by it. The output directory is now the
// section root, shared with a hand-authored index and any page an author adds beside it.
function isGeneratedComponentPage(absPath) {
  return fs.readFileSync(absPath, 'utf8').includes(GENERATED_MARKER);
}

export function generatePublicComponentPages({ rootDir = ROOT_DIR, outDir = path.join(rootDir, PUBLIC_COMPONENT_DIR) } = {}) {
  const violations = collectPublicComponentReferenceViolations(rootDir);
  if (violations.length) throw new Error(`Public component reference contract failed:\n- ${violations.join('\n- ')}`);
  const manifest = buildPublicComponentManifest(rootDir);
  fs.mkdirSync(outDir, { recursive: true });
  const owned = new Set(manifest.map((component) => `${component.name}.md`));
  // A family removed from the Registry must lose its page, but nothing else in the directory
  // may be touched: the section index and the guides that live beside it are hand-authored.
  for (const entry of fs.readdirSync(outDir)) {
    if (entry.endsWith('.md') && !owned.has(entry) && entry !== 'index.md' && isGeneratedComponentPage(path.join(outDir, entry))) {
      fs.rmSync(path.join(outDir, entry));
    }
  }
  fs.writeFileSync(path.join(outDir, 'index.md'), renderPublicComponentIndex(manifest));
  for (const component of manifest) {
    fs.writeFileSync(path.join(outDir, `${component.name}.md`), renderPublicComponentPage(component));
  }
  return manifest;
}

function main() {
  const check = process.argv.includes('--check');
  const violations = collectPublicComponentReferenceViolations(ROOT_DIR);
  if (violations.length) {
    console.error('Public component reference check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  if (check) {
    console.log(`Public component reference check passed (${buildPublicComponentManifest(ROOT_DIR).length} stable families).`);
    return;
  }
  const manifest = generatePublicComponentPages();
  console.log(`Generated ${manifest.length} public component reference pages under ${PUBLIC_COMPONENT_DIR}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
