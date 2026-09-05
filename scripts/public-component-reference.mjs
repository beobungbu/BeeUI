#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coverageForComponent } from '../apps/showcase/component-coverage.ts';
import { showcaseHref } from '../apps/showcase/showcase-target.ts';
import { buildPublicSurfaceInventory } from './generate-public-surface-inventory.mjs';
import {
  ROOT_DIR,
  buildShowcaseUsageIndex,
  getPublicComponents,
  readJson,
  usageForComponent,
} from './component-docs-lib.mjs';
import {
  diffPlatformPropsShape,
  extractAccessibilityFacts,
  extractControlledPropWarnings,
  extractOmitPickOrBareTypeName,
  getBehaviorGuardKnownNames,
  getComponentTypeDocs,
  stripSourceComments,
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

// The optional peers a consuming app must install itself. Read from the manifest rather than
// listed here, so the two cannot drift.
const OPTIONAL_PEER_DEPENDENCIES = new Set(
  Object.keys(
    JSON.parse(fs.readFileSync(new URL('../packages/ui/package.json', import.meta.url), 'utf8'))
      .peerDependenciesMeta ?? {},
  ),
);

export function buildPublicComponentManifest(rootDir = ROOT_DIR) {
  const content = readJson('docs/component-reference.content.json', rootDir);
  const usageIndex = buildShowcaseUsageIndex(rootDir);
  // The inventory is the ownership authority; the registry is only the family list. Reading
  // both here is what lets a page name every surface routed to it.
  const inventoryRows = buildPublicSurfaceInventory(rootDir).rows;
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
      routedSurfaces: routedSurfacesFor({ ...component, docsRoute: `/docs/components/${component.name}/` }, inventoryRows),
      subpath: inventoryRows.find(
        (row) => row.kind === 'package-export' && row.primaryDocsOwner === `/docs/components/${component.name}/`,
      )?.name,
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

// Prop descriptions were 13% covered — 452 of 521 rows blank, and 46 of 58 pages with an empty
// Description on every prop. A shared glossary closed the structural and anchored-overlay
// vocabulary; the rest are family-specific and need real JSDoc in `packages/ui/src`.
//
// A ratchet rather than a pass/fail threshold: failing on any blank would fail today and teach
// nothing, and a silent percentage would drift back down the way it drifted here. The floor is
// the measured value at the time it was written, so coverage can only go up.
export const PROP_DESCRIPTION_FLOOR = 624;

// Two floors, because coverage alone is satisfiable by boilerplate: 22 props were added to the
// total by one repeated sentence and 100% never moved.
//
// The absolute floor catches descriptions being collapsed or deleted. It does NOT catch the
// growth mode — 200 new props each reusing an existing sentence verbatim keeps `described` at
// 100% and passes. The distinct floor catches that, because a reused sentence adds nothing to it.
// A ratio between the two used to stand here as a third guard; it was a number nobody could
// justify (0.44), and measuring what it was actually rejecting showed the real defect is one
// sentence reused across props with *different names*, which `sharedAcrossProps` states directly
// and a ratio only approximates.
export const PROP_DISTINCT_DESCRIPTION_FLOOR = 288;

// Walks a resolved type entry the same way `applyGlossary` and the renderer do:
// a `union` entry carries no `fields` of its own, only `variants`, each of which is
// itself an object (or nested union) shape. Scope: this counts the rows of the four-column
// props tables only. A shape with no fields of its own instead publishes a two-column
// `Prop | Default` table from `shape.consumed` (39 such rows today); those cells have no
// description slot at all — the prop is described on the base type's own page — so they are
// deliberately outside this denominator. Counting `entry.fields` alone reported
// 521/521 while 26 variant props rendered an em dash, because the props that would
// have disagreed were never in the counter's scope.
function walkShapeFields(shape, visit) {
  for (const field of shape?.fields ?? []) visit(field);
  for (const variant of shape?.variants ?? []) walkShapeFields(variant, visit);
}

// `described` counts a prop that has any description text. That is deliberately a low bar, and
// the number alone overstates the docs: text arrives from three places — per-prop JSDoc, the 17
// shared sentences in docs/prop-glossary.json, and the sentence generated for each cva variant.
// The last two are shared by construction, so `distinct` and `sharedAcrossProps` are reported
// alongside it to keep "100% described" from reading as "every prop has prose written for it".
export function collectPropDescriptionCoverage(manifest) {
  let total = 0;
  let described = 0;
  const seen = new Set();
  const namesByDescription = new Map();
  for (const component of manifest) {
    for (const entry of component.typeDocs ?? []) {
      walkShapeFields(entry, (field) => {
        total += 1;
        if (!field.description) return;
        described += 1;
        seen.add(field.description);
        const names = namesByDescription.get(field.description) ?? new Set();
        names.add(field.name);
        namesByDescription.set(field.description, names);
      });
    }
  }
  // A sentence shared by rows of the SAME prop name is correct — `className` means the same thing
  // on all 90 families that accept it. A sentence covering two DIFFERENT props is not: it says one
  // thing about two things. That distinction is the real defect, and it needs no threshold.
  const sharedAcrossProps = [...namesByDescription.values()].filter((names) => names.size > 1).length;

  return { described, distinct: seen.size, sharedAcrossProps, total };
}

export function collectPropDescriptionViolations(manifest) {
  const { described, distinct, sharedAcrossProps, total } = collectPropDescriptionCoverage(manifest);
  const remedy =
    'Document the prop in `packages/ui/src` with JSDoc, or add it to docs/prop-glossary.json if ' +
    'its meaning is identical on every family that declares it.';
  const violations = [];

  // Two separate failures. The floor catches a bulk regression even if the total moves with it;
  // `described === total` catches a single new undescribed prop, which a floor comparison alone
  // lets through whenever the total grows by the same amount (583 of 584 still clears a floor
  // of 583).
  if (described < PROP_DESCRIPTION_FLOOR) {
    violations.push(
      `prop descriptions dropped to ${described} of ${total} (floor ${PROP_DESCRIPTION_FLOOR}). ${remedy}`,
    );
  } else if (described < total) {
    violations.push(`${total - described} published prop(s) have no description. ${remedy}`);
  }

  if (distinct < PROP_DISTINCT_DESCRIPTION_FLOOR) {
    violations.push(
      `distinct prop descriptions dropped to ${distinct} (floor ${PROP_DISTINCT_DESCRIPTION_FLOOR}). ` +
      'Coverage can be held at 100% by repeating one sentence, so the number of different things ' +
      'said is guarded separately.',
    );
  }

  if (sharedAcrossProps > 0) {
    violations.push(
      `${sharedAcrossProps} description(s) are shared by props with different names. A sentence ` +
      'may be reused across families for the same prop, which is what the glossary is for, but a ' +
      'sentence covering two different props says one thing about two things — write one per prop.',
    );
  }

  return violations;
}

// Every check in this file reads the manifest or the table cells. Nothing read the prose the
// generator emits between them, which is how `escapeCell`'s table-only pipe escape reached the
// bases line and published `Omit<PressableProps, 'role' \\| 'children'>` on 34 of 62 pages. This
// reads the rendered page instead: a backslash-escaped pipe is correct inside a table row and
// wrong everywhere else.
export function collectRenderedPageViolations(page, componentName) {
  const violations = [];
  let inFence = false;

  page.split('\n').forEach((line, index) => {
    if (/^\s*(?:```|~~~)/u.test(line)) inFence = !inFence;
    if (inFence) return;
    // A `VariantProps<typeof x>` that reaches the page means the cva behind it was not resolved,
    // so the page tells a reader to consult a module-private const they cannot open. The values
    // belong in the table; see `applyCvaVariants`.
    if (line.includes('VariantProps<')) {
      violations.push(
        `${componentName}: line ${index + 1} publishes an unresolved \`VariantProps<...>\`; ` +
        'the variants it names must be read from the `cva()` call and published as props.',
      );
    }
    if (line.trimStart().startsWith('|')) return;
    if (!line.includes('\\|')) return;
    violations.push(
      `${componentName}: line ${index + 1} publishes a literal \\| outside a table row ` +
      '(`escapeCell` is for table cells; use `formatTypeText` for prose).',
    );
  });

  return violations;
}

// The renderer's absolute negatives and the oracle that refuses them, in one place.
//
// They were duplicated string literals. Renaming the rendered states line by one word left
// `--check` reporting zero violations while every page could have published the negative
// falsely: the oracle's key no longer matched anything, so it silently stopped looking. A guard
// that stops guarding when a sentence is edited is worse than no guard, because the green stays.
const ROLES_NONE_CLAIM = '**Roles this family assigns:** none';
const STATES_NONE_CLAIM = '**Accessibility states and properties it sets:** none';
const CLASS_NONE_CLAIM = '**Class-name surfaces:** none;';
const AXES_NONE_CLAIM = '**Style axes:** none;';

// An independent oracle for the four derived sections, deliberately NOT sharing code with the
// derivation it checks.
//
// Every derived section shipped with a test, every test passed, and five classes of false fact
// reached the portal anyway — because each test picked the one component for which its claim
// happened to be true, and the sections' worst failure mode is an absolute negative ("assigns no
// roles", "accepts no className"), which is a claim about everything the derivation did not look
// at. A grep over the family's whole source text cannot be fooled by a narrow AST scope: it sees
// the object literal, the platform file and the base class alike. It can only refute a negative,
// never confirm a positive, which is exactly the direction the damage runs.
const NEGATIVE_CLAIM_ORACLES = [
  {
    claim: ROLES_NONE_CLAIM,
    pattern: /accessibilityRole\s*[=:]|(?<![\w-])role\s*=\s*["'{]/u,
    message: 'publishes "assigns no roles" while its source sets a role',
  },
  {
    claim: STATES_NONE_CLAIM,
    // Narrowed to `accessibilityState` and `aria-*`, this missed nine pages that set
    // `accessibilityLiveRegion`, `accessibilityElementsHidden` or `accessibilityValue` — the
    // oracle's scope had been copied from the derivation's scope, which is the one thing an
    // independent oracle must not do.
    pattern: /accessibility(?!Role\b)[A-Z]\w*\s*[=:]|(?<![\w-])(?:aria-[a-z]+|accessible)\s*=/u,
    message: 'publishes "sets no states or properties" while its source sets one',
  },
  {
    // A component styling its own internals (`<View className="flex-row">`) accepts nothing from
    // the caller, so the JSX-attribute form is deliberately not a refutation. What refutes the
    // claim is the prop existing: declared as a type field, or destructured out of props.
    claim: CLASS_NONE_CLAIM,
    pattern: /className\s*\??\s*:|[{,]\s*className\s*[,}=]/u,
    message: 'publishes "accepts no className of its own" while its source declares one',
  },
  {
    claim: AXES_NONE_CLAIM,
    pattern: /\bcva\s*\(/u,
    message: 'publishes "no variant or size prop" while its source declares cva variants',
  },
];

// The oracle above can only refute a negative. The role line fails the other way too: reading
// `selectionMode === 'single' ? 'radiogroup' : undefined` as assigning both published `single`,
// a word that is not a role at all. Roles are a closed vocabulary — React Native's
// `AccessibilityRole` union plus the WAI-ARIA roles the portal uses — so anything outside it is
// a derivation leak, whatever produced it. A legitimate new role belongs in this set; that edit
// is the point at which someone confirms it is one.
const KNOWN_ACCESSIBILITY_ROLES = new Set([
  // React Native AccessibilityRole
  'adjustable', 'alert', 'button', 'checkbox', 'combobox', 'grid', 'header', 'image',
  'imagebutton', 'keyboardkey', 'link', 'list', 'menu', 'menubar', 'menuitem', 'none',
  'progressbar', 'radio', 'radiogroup', 'scrollbar', 'search', 'spinbutton', 'summary', 'switch',
  'tab', 'tablist', 'text', 'timer', 'togglebutton', 'toolbar',
  // WAI-ARIA roles used on Web
  'application', 'article', 'banner', 'cell', 'columnheader', 'complementary', 'contentinfo',
  'definition', 'dialog', 'document', 'feed', 'figure', 'form', 'group', 'heading', 'listbox',
  'listitem', 'log', 'main', 'marquee', 'math', 'menuitemcheckbox', 'menuitemradio', 'meter',
  'navigation', 'note', 'option', 'presentation', 'region', 'row', 'rowgroup', 'rowheader',
  'separator', 'slider', 'status', 'table', 'tabpanel', 'term', 'tooltip', 'tree', 'treegrid',
  'treeitem',
]);

function publishedRoles(page) {
  const line = page.split('\n').find((candidate) => candidate.includes('**Roles this family assigns:**'));
  if (!line || line.includes('none of its own')) return [];
  return [...line.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

export function collectDerivedClaimViolations(page, component, rootDir = ROOT_DIR) {
  const violations = [];
  const sources = (component.allSources ?? [component.source])
    .filter((relPath) => relPath && fs.existsSync(path.join(rootDir, relPath)))
    .map((relPath) => stripSourceComments(fs.readFileSync(path.join(rootDir, relPath), 'utf8')))
    .join('\n');

  for (const { claim, pattern, message } of NEGATIVE_CLAIM_ORACLES) {
    if (!page.includes(claim)) continue;
    if (!pattern.test(sources)) continue;
    violations.push(`${component.name}: ${message} (${pattern.source}).`);
  }

  // A second oracle that needs no source at all: the page contradicting itself. An absolute
  // negative is a claim about the whole prop surface, and a page carrying a bases line has
  // already told the reader part of that surface is documented elsewhere.
  //
  // This keyed on the phrase used for *external* bases first, which excluded exactly the defect
  // it was written for: IconButton's base resolves to BeeUI's own `ButtonProps`, so its bases
  // line reads "documented on the [Button] page" and the oracle never looked. Reverting the base
  // resolution republished "accepts no className of its own" on IconButton and SearchInput with
  // no violation raised — neither file writes `className`, they spread `...props`, so the source
  // grep is blind to them too. Keying on the bases line itself covers every phrasing of it.
  if (page.includes('Also carries every prop of')) {
    for (const claim of [AXES_NONE_CLAIM, CLASS_NONE_CLAIM]) {
      if (!page.includes(claim)) continue;
      violations.push(
        `${component.name}: publishes "${claim}" while also carrying a bases line that sends ` +
        'part of its prop surface elsewhere; the negative covers props the page never looked at.',
      );
    }
  }

  // Toast published "no variant or size prop" two lines below its own `variant?: ToastVariant`
  // and the five values that prop takes. No base was involved, so every base-shaped guard was
  // looking somewhere else — including, at first, this one: it was written inside the bases-line
  // branch above, which is exactly the condition Toast fails. The page naming the prop is the
  // evidence, wherever the prop came from.
  if (page.includes(AXES_NONE_CLAIM) && /\b(?:variant|size)\?:/u.test(page)) {
    violations.push(
      `${component.name}: publishes "${AXES_NONE_CLAIM}" while naming a \`variant\` or \`size\` ` +
      'prop elsewhere on the same page.',
    );
  }

  for (const role of publishedRoles(page)) {
    if (KNOWN_ACCESSIBILITY_ROLES.has(role)) continue;
    violations.push(
      `${component.name}: publishes \`${role}\` as an accessibility role, which is not one. ` +
      'Either the derivation read a value that is not a role, or the role is new and belongs in ' +
      '`KNOWN_ACCESSIBILITY_ROLES`.',
    );
  }
  return violations;
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


  violations.push(...collectPropDescriptionViolations(manifest));
  for (const component of manifest) {
    const page = renderPublicComponentPage(component, rootDir);
    violations.push(...collectRenderedPageViolations(page, component.name));
    violations.push(...collectDerivedClaimViolations(page, component, rootDir));
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
  const lines = component.values.length <= 1
    ? [`- Primary export: \`${component.values[0]}\``]
    : component.values.map((value, index) => `${index === 0 ? '- Family exports:' : '  '} \`${value}\``);

  // Surfaces the #473 inventory routes to this page but that are not part of the Registry
  // family. `getPublicComponents` reads registry.json, so a public symbol with no registry
  // family — `ToastRuntimeProvider`, `getTextareaWebMinHeight`, `semanticTypographyClasses` —
  // was assigned this owner page and then never written to it. The ownership gate reported
  // 683/683 documented because it checked that a row had an owner route, never that the page
  // named the row.
  if (component.routedSurfaces?.length) {
    lines.push('  - Also routed here, outside the Registry family:');
    for (const surface of component.routedSurfaces) lines.push(`    - \`${surface.name}\``);
  }
  if (component.subpath) {
    lines.push(`  - Package export subpath: \`@beemvp/beeui-ui${surfaceSubpath(component.subpath)}\``);
  }
  return lines.join('\n');
}

// `./accordion` in the inventory is the subpath a consumer writes after the package name.
function surfaceSubpath(name) {
  return name.replace(/^\./u, '');
}

// Rows the inventory routes to a component page, minus what the family already lists.
export function routedSurfacesFor(component, rows) {
  const listed = new Set([...component.values, ...component.types]);
  const owner = component.docsRoute ?? `/docs/components/${component.name}/`;
  return rows.filter((row) => row.primaryDocsOwner === owner && row.kind !== 'package-export' && !listed.has(row.name));
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
// Normalizes a type's text for publication: collapses the line breaks a source type is wrapped
// at and tightens the spacing inside brackets. Deliberately does NOT escape `|`.
function formatTypeText(text) {
  return String(text ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/([<(])\s+/gu, '$1')
    .replace(/\s+([>)])/gu, '$1');
}

// A `|` inside a Markdown table row would end the cell, so it must be escaped there — and only
// there. The same escape in a paragraph publishes a literal backslash: applying this to the
// bases line put `Omit<PressableProps, 'role' \| 'children'>` on 34 of the 62 component pages.
// Use this for table cells; use `formatTypeText` for prose.
function escapeCell(text) {
  return formatTypeText(text).replace(/\|/gu, '\\|');
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
// A base is one of three things, and the page must say which.
//
// `extractOmitPickOrBareTypeName` returns a name for `ViewProps` and `Omit<ButtonProps, 'size'>`
// and nothing for the rest — but "no name" was read as "written inline", which is only sometimes
// true. `React.ComponentProps<typeof NativeSafeAreaView>` is an ordinary named import, and calling
// it inline replaced a true sentence on the SafeArea page. Only a structural type — an object or
// union literal written at the `extends` site, which is what carries a brace — is genuinely
// unnameable, and that one must be described rather than quoted: ThemeScope's is 500 characters
// of union with JSDoc inside, and its backticks fragment the code span that holds it.
const INLINE_BASE_LABEL = 'a type declared inline at its `extends` site';

function isStructuralBase(base) {
  return base.includes('{');
}

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
    const text = formatTypeText(base);
    const typeName = extractOmitPickOrBareTypeName(base);
    const owner = typeName ? owners.get(typeName) : undefined;
    return { text, owner, structural: isStructuralBase(base) };
  });

  const external = rendered.filter((base) => !base.owner);
  const owned = rendered.filter((base) => Boolean(base.owner));

  const sentences = [];
  if (external.length) {
    const list = external
      .map((base) => (base.structural ? INLINE_BASE_LABEL : `\`${base.text}\``))
      .join(' and ');
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
      ? ` — on ${otherPlatform} it may come from \`${formatTypeText(otherBase)}\`, which this table does not reproduce`
      : ` — whether ${otherPlatform} carries it through its base type is not determined here`;

  for (const field of diff.nativeOnly) {
    const withDefault = field.default !== undefined ? ` (native default \`${formatTypeText(field.default)}\`)` : '';
    lines.push(`- \`${field.name}\` is declared explicitly on native${withDefault}${inheritedNote('Web', bases.web)}.`);
  }
  for (const field of diff.webOnly) {
    const withDefault = field.default !== undefined ? ` (Web default \`${formatTypeText(field.default)}\`)` : '';
    lines.push(`- \`${field.name}\` is declared explicitly on Web${withDefault}${inheritedNote('native', bases.native)}.`);
  }
  const inert = new Set(diff.inert ?? []);
  for (const name of inert) {
    lines.push(`- \`${name}\` is accepted on Web for API parity but has no effect there.`);
  }
  for (const change of diff.changed) {
    // A prop Web never reads needs no note about how its *type* differs there; the bullet above
    // already says the value is ignored, and two bullets on one prop read as a contradiction. A
    // default or optionality difference is still worth stating — the native side of it is real —
    // so only the type note is suppressed, not the whole prop.
    if (change.typeChanged && !inert.has(change.name)) {
      lines.push(
        `- \`${change.name}\` type differs: native \`${formatTypeText(change.native.type)}\`, Web \`${formatTypeText(change.web.type)}\`.`,
      );
    }
    if (change.defaultChanged) {
      const nativeDefault = change.native.default !== undefined ? `\`${formatTypeText(change.native.default)}\`` : 'no default';
      const webDefault = change.web.default !== undefined ? `\`${formatTypeText(change.web.default)}\`` : 'no default';
      lines.push(`- \`${change.name}\` default differs: native ${nativeDefault}, Web ${webDefault}.`);
    }
    if (change.optionalChanged) {
      const nativeReq = change.native.optional ? 'optional' : 'required';
      const webReq = change.web.optional ? 'optional' : 'required';
      lines.push(`- \`${change.name}\` is ${nativeReq} on native but ${webReq} on Web.`);
    }
  }
  if (diff.basesChanged) {
    const nativeBases = diff.nativeBases.length ? diff.nativeBases.map((base) => `\`${formatTypeText(base)}\``).join(' and ') : '_none_';
    const webBases = diff.webBases.length ? diff.webBases.map((base) => `\`${formatTypeText(base)}\``).join(' and ') : '_none_';
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
  return `- \`${entry.name}\` — alias of \`${formatTypeText(entry.aliasOf)}\`.`;
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

// The Accessibility section was one identical paragraph on all 62 pages, asserting that roles and
// states "remain component-specific" while containing nothing specific to any component — a page
// contradicting itself. These two lines are derived from the JSX each family renders.
function renderAccessibilityFacts(component, rootDir) {
  const files = (component.allSources ?? [component.source]).map((relPath) => ({
    path: relPath,
    source: fs.readFileSync(path.join(rootDir, relPath), 'utf8'),
  }));
  const { roles, states } = extractAccessibilityFacts(files);
  const code = (values) => values.map((value) => `\`${value}\``).join(', ');

  const roleLine = roles.length
    ? `- **Roles this family assigns:** ${code(roles)} — set by the components themselves, not by the caller.`
    : `- ${ROLES_NONE_CLAIM} of its own; each element keeps the role of the primitive it renders.`;
  const stateLine = states.length
    ? `- **Accessibility states and properties it sets:** ${code(states)}.`
    : `- ${STATES_NONE_CLAIM}; this family exposes no state to assistive technology beyond its content.`;

  return `${roleLine}\n${stateLine}`;
}

// The Platform behavior section closed by saying platform-specific behavior "is called out ...
// rather than hidden behind a generic parity claim", while being exactly a generic parity claim on
// 56 of the 62 pages. Which implementation renders on which target is a fact about the family's own
// files, so state it.
function renderPlatformImplementation(component) {
  const platformFiles = (component.allSources ?? []).filter((relPath) =>
    /\.(native|web|ios|android)\.tsx?$/u.test(relPath),
  );
  if (!platformFiles.length) {
    return 'One implementation renders on every supported target: this family ships no platform-specific file, so the props and behavior above are the same on iOS, Android and Web.';
  }

  const label = (relPath) => {
    const file = relPath.split('/').pop();
    if (/\.web\.tsx?$/u.test(relPath)) return `\`${file}\` (Web)`;
    if (/\.native\.tsx?$/u.test(relPath)) return `\`${file}\` (iOS and Android)`;
    if (/\.ios\.tsx?$/u.test(relPath)) return `\`${file}\` (iOS)`;
    return `\`${file}\` (Android)`;
  };

  return (
    'This family is split by platform and renders from ' +
    `${platformFiles.map(label).join(', ')}. Where the two shapes differ, the difference is ` +
    'listed under the affected type above rather than summarised here.'
  );
}

// Resolves a base type name to the shape entry that declares it, so a family that inherits its
// styling props is not described as having none.
let publicTypeShapeIndexCache;

function getPublicTypeShapeIndex(rootDir) {
  if (!publicTypeShapeIndexCache || publicTypeShapeIndexCache.rootDir !== rootDir) {
    const shapes = new Map();
    for (const component of getPublicComponents(rootDir)) {
      for (const entry of getComponentTypeDocs(component, rootDir)) shapes.set(entry.name, entry);
    }
    publicTypeShapeIndexCache = { rootDir, shapes };
  }
  return publicTypeShapeIndexCache.shapes;
}

// `Omit<ButtonProps, 'size'>` keeps every ButtonProps prop except `size`; `Pick<X, 'a'>` keeps
// only the named ones. The names live in the base text as quoted literals.
function baseFilterFor(base) {
  const names = new Set((base.match(/'[^']*'/gu) ?? []).map((literal) => literal.slice(1, -1)));
  if (/^\s*Omit\s*</u.test(base)) return (name) => !names.has(name);
  if (/^\s*Pick\s*</u.test(base)) return (name) => names.has(name);
  return () => true;
}

// One walk over a shape and every public base it inherits from, applying each base's
// Omit/Pick filter on the way down. `seen` stops a cycle; `unresolved` records the bases that
// leave the repository, because a family with one of those cannot honestly be said to have none.
function collectStyleSurfaces(shape, rootDir, accumulator, keep = () => true, seen = new Set()) {
  if (!shape) return;
  const visitFields = (node) => {
    for (const field of node?.fields ?? []) {
      if (!keep(field.name)) continue;
      if (field.name === 'className' || /ClassName$/u.test(field.name)) accumulator.classSurfaces.add(field.name);
      const literals = (field.type ?? '').match(/'[^']*'/gu);
      if (literals && literals.length > 1 && /presets, declared in/u.test(field.description ?? '')) {
        // A prop reachable both directly and through a base must keep the direct provenance.
        // `HStackProps extends StackProps` made the bases pass overwrite Stack's own `gap`,
        // `align` and `justify` with "inherited from `StackProps`" — Stack declares them.
        const existing = accumulator.axes.get(field.name);
        if (!existing || (existing.from && !accumulator.from)) {
          accumulator.axes.set(field.name, { count: literals.length, from: accumulator.from });
        }
      }
    }
    // A shape with no fields of its own publishes a `Prop | Default` table instead; those props
    // are real props of the family, and `className` on Textarea arrives only this way.
    for (const consumed of node?.consumed ?? []) {
      if (!keep(consumed.name)) continue;
      if (consumed.name === 'className' || /ClassName$/u.test(consumed.name)) {
        accumulator.classSurfaces.add(consumed.name);
      }
    }
    for (const variant of node?.variants ?? []) visitFields(variant);
  };
  visitFields(shape);

  const shapes = getPublicTypeShapeIndex(rootDir);
  for (const base of shape.bases ?? []) {
    const typeName = extractOmitPickOrBareTypeName(base);
    // Unread territory either way; the difference is only whether the page can name it.
    if (isStructuralBase(base)) {
      accumulator.inlineBases += 1;
      continue;
    }
    if (!typeName) {
      accumulator.unresolved.add(formatTypeText(base));
      continue;
    }
    const inherited = shapes.get(typeName);
    if (!inherited) {
      accumulator.unresolved.add(formatTypeText(base));
      continue;
    }
    accumulator.resolved.add(formatTypeText(base));
    if (seen.has(typeName)) continue;
    const filter = baseFilterFor(base);
    const previousFrom = accumulator.from;
    accumulator.from = accumulator.from ?? typeName;
    collectStyleSurfaces(
      inherited,
      rootDir,
      accumulator,
      (name) => keep(name) && filter(name),
      new Set([...seen, typeName]),
    );
    accumulator.from = previousFrom;
  }
}

// Styling and theming was one identical paragraph on all 62 pages, and it was where the cva rows
// used to send readers for "what each value changes" — a pointer to a page that named no value.
// Two facts are derivable per family: the style axes it exposes and the class-name surfaces it
// accepts, both of which differ by component.
//
// Both lines used to read only the family's own declared fields and then assert a negative.
// IconButton was published as having "no variant or size prop" while inheriting `variant` from
// `ButtonProps` — contradicting the Button page it links to — and Textarea as accepting "no
// className of its own" while merging one. An absolute negative is a claim about everything the
// derivation did not look at, so it is now made only when there is nothing left unlooked-at.
function renderStylingFacts(component, rootDir = ROOT_DIR) {
  const accumulator = {
    axes: new Map(),
    classSurfaces: new Set(),
    unresolved: new Set(),
    resolved: new Set(),
    inlineBases: 0,
    from: undefined,
  };
  for (const entry of component.typeDocs ?? []) collectStyleSurfaces(entry, rootDir, accumulator);

  const code = (values) => values.map((value) => `\`${value}\``).join(', ');
  const named = [...accumulator.unresolved].sort();
  // The absolute negative is available only to a family that carries no base at all. A resolved
  // base was read, but only as far as this parser reads a base; an unresolved or inline one was
  // not read at all. `collectDerivedClaimViolations` refuses the same sentence from the page
  // side, keyed on the same "Also carries every prop of" line the reader sees — so the two agree
  // by construction rather than by both happening to be right today.
  // A type alias whose body is an object literal is unread territory of the same kind: its
  // fields never reach `shape.fields`, so nothing here can see them. Toast declares its entire
  // prop surface that way — `ToastOptions` carries `variant?: ToastVariant`, five values, listed
  // on the same page two lines above — and the page claimed to have no variant prop. It has no
  // base at all, so every base-shaped guard was looking elsewhere.
  //
  // Scoped to families that export no `*Props` type at all — the page says so itself — because
  // only then does an object-literal alias hold the prop surface. `DateTimePickerValue` is an
  // object alias too, holding `date` and `time`, and it can hide no style axis; treating it the
  // same way traded a true sentence for a vaguer one on a page that had nothing wrong with it.
  const typeDocs = component.typeDocs ?? [];
  const unparsedAlias =
    !typeDocs.some((entry) => entry.docKind === 'props') &&
    typeDocs.some((entry) => entry.kind === 'alias' && (entry.aliasOf ?? '').includes('{'));

  // A prop typed by an alias this page cannot resolve to values is a prop whose values nobody
  // here has seen. `KeyboardAwareScreenContentWidth` is `keyof typeof CONTENT_WIDTH_CLASSES`,
  // four max-width classes, and the page said the family had no variant or size prop at all —
  // forty lines below the prop itself. DatePicker's `placement` and `align` are the same shape.
  const opaqueAliases = new Set();
  const collectOpaque = (entry) => {
    if (entry.kind === 'alias' && !(entry.aliasOf ?? '').includes('{')) opaqueAliases.add(entry.name);
    for (const variant of entry.variants ?? []) collectOpaque(variant);
  };
  for (const entry of typeDocs) collectOpaque(entry);
  const opaquePropTypes = [];
  const collectOpaqueProps = (entry) => {
    for (const field of entry.fields ?? []) {
      if (opaqueAliases.has((field.type ?? '').trim())) opaquePropTypes.push(field.name);
    }
    for (const variant of entry.variants ?? []) collectOpaqueProps(variant);
  };
  for (const entry of typeDocs) collectOpaqueProps(entry);
  const defersAnything =
    named.length > 0 || accumulator.resolved.size > 0 || accumulator.inlineBases > 0;
  const deferralList = named.length
    ? code(named)
    : accumulator.resolved.size
      ? code([...accumulator.resolved].sort())
      : INLINE_BASE_LABEL;

  const axisLine = accumulator.axes.size
    ? `- **Style axes:** ${[...accumulator.axes]
        .map(([name, { count, from }]) => `\`${name}\` (${count} values${from ? `, inherited from \`${from}\`` : ''})`)
        .join(', ')} — the values are in the props tables above.`
    : defersAnything
      ? `- **Style axes:** none of its own — its appearance comes from tokens and your own classes; it also carries ${deferralList}.`
      : unparsedAlias
        ? '- **Style axes:** not enumerated here: this family declares its props in a type alias whose fields this page does not parse — see the exported types above.'
        : opaquePropTypes.length
          ? `- **Style axes:** not enumerated here: ${opaquePropTypes
              .map((name) => `\`${name}\``)
              .join(', ')} ${opaquePropTypes.length === 1 ? 'is typed' : 'are typed'} by an alias this page does not resolve to values.`
        : `- ${AXES_NONE_CLAIM} this family has no variant or size prop, so its appearance comes from tokens and your own classes.`;

  const classLine = accumulator.classSurfaces.size
    ? `- **Class-name surfaces:** ${code([...accumulator.classSurfaces].sort())}.`
    : defersAnything
      ? `- **Class-name surfaces:** none declared by this family; it also carries ${deferralList}.`
      : unparsedAlias
        ? '- **Class-name surfaces:** not enumerated here, for the same reason as the axes above.'
        : `- ${CLASS_NONE_CLAIM} this family accepts no \`className\` of its own.`;

  return `${axisLine}\n${classLine}`;
}

// The Registry item's peer list is a fact about the item, but the page presented it as what a
// consumer must install, on families whose Web implementation imports none of it: the Sheet page
// told Web readers to install `@gorhom/bottom-sheet` and Reanimated while `sheet.web.tsx` states
// in its own header that ADR-006 gives Web a different engine. Which peers the Web file actually
// imports is derivable; which ones a native target needs transitively is not, so only the former
// is claimed.
function webPeerScope(component, rootDir) {
  const webFile = (component.allSources ?? []).find((relPath) => /\.web\.tsx?$/u.test(relPath));
  if (!webFile) return undefined;
  const peers = (component.peerDependencies ?? []).filter((peer) => peer !== 'react' && peer !== 'react-native');
  if (!peers.length) return undefined;

  const source = stripSourceComments(fs.readFileSync(path.join(rootDir, webFile), 'utf8'));
  const imported = new Set(
    [...source.matchAll(/(?:from|require\()\s*'([^']+)'/gu)].map((match) => match[1]),
  );
  // A subpath import (`react-native-reanimated/plugin`) still counts as importing the peer.
  const absent = peers.filter(
    (peer) => ![...imported].some((specifier) => specifier === peer || specifier.startsWith(`${peer}/`)),
  );
  if (absent.length !== peers.length) return undefined;
  return { webFile: webFile.split('/').pop(), peers: absent };
}

// "No component-specific limitation is curated here" was published on 48 pages, including
// DatePicker — which requires an optional native peer that the compatibility matrix records as
// having no native runtime evidence, and Sheet, which accepts three props on Web that do nothing
// there. The page said there was nothing to say while the repository had something to say. Only
// what is derivable is added; a family with no derivable constraint still says none is curated,
// because inventing one would be worse than admitting the gap.
function renderDerivedLimitations(component, rootDir) {
  const lines = [];

  // The component states this itself, in a development warning. Skipped when a curated limitation
  // already says it, so Dialog does not carry the same sentence twice.
  const files = (component.allSources ?? [component.source]).map((relPath) => ({
    path: relPath,
    source: fs.readFileSync(path.join(rootDir, relPath), 'utf8'),
  }));
  for (const { prop, handler } of extractControlledPropWarnings(files)) {
    const curated = component.limitations ?? '';
    if (curated.includes(prop) && curated.includes(handler)) continue;
    lines.push(
      `- Passing \`${prop}\` without \`${handler}\` leaves the value read-only: the component ` +
      'renders what you passed and can never change it. It warns in development builds rather ' +
      'than failing silently in production.',
    );
  }

  const optionalPeers = (component.peerDependencies ?? []).filter((peer) =>
    OPTIONAL_PEER_DEPENDENCIES.has(peer),
  );
  if (optionalPeers.length) {
    lines.push(
      `- Requires ${optionalPeers.map((peer) => `\`${peer}\``).join(', ')} to be installed by the ` +
      `consuming app. ${optionalPeers.length === 1 ? 'It is an optional peer' : 'They are optional peers'} ` +
      'of `@beemvp/beeui-ui`, so nothing installs ' +
      `${optionalPeers.length === 1 ? 'it' : 'them'} for you, and a target that never renders this ` +
      'family does not need it.',
    );
  }

  const inert = new Set();
  for (const entry of component.typeDocs ?? []) for (const name of entry.webShape?.inert ?? []) inert.add(name);
  if (inert.size) {
    lines.push(
      `- On Web, ${[...inert].sort().map((name) => `\`${name}\``).join(', ')} ` +
      `${inert.size === 1 ? 'is' : 'are'} accepted for API parity and read by nothing: setting ` +
      `${inert.size === 1 ? 'it' : 'them'} changes no behavior there.`,
    );
  }

  return lines.join('\n');
}

export function renderPublicComponentPage(component, rootDir = ROOT_DIR) {
  const examples = component.examples
    .map((file, index) => `- ${index === 0 ? '**Primary executable fixture:**' : '**Additional fixture:**'} [\`${file}\`](${githubHref(file)})`)
    .join('\n');
  const types = component.types.length ? component.types.map((name) => `\`${name}\``).join(', ') : 'No separately exported public types.';
  const webScope = webPeerScope(component, rootDir);
  const webPeerNote = webScope
    ? `- On Web this family renders from \`${webScope.webFile}\`, which does not import ${webScope.peers
        .map((name) => `\`${name}\``)
        .join(', ')}: ${
        webScope.peers.length === 1 ? 'that peer serves' : 'those peers serve'
      } the native implementation.\n`
    : '';
  const peers = component.peerDependencies.length ? component.peerDependencies.map((name) => `\`${name}\``).join(', ') : 'Only the package baseline peers.';
  const registryDeps = component.registryDependencies.length ? component.registryDependencies.map((name) => `\`${name}\``).join(', ') : 'None.';
  const platformSplit = component.allSources.length > 1
    ? 'This family has platform-split source files. The bundler selects the native/Web implementation; do not infer native runtime behavior from the Web preview.'
    : 'The same public family is exposed across the supported target matrix; meaningful platform differences remain governed by the compatibility contract.';
  const derivedLimitations = renderDerivedLimitations(component, rootDir);
  const curatedLimitations =
    component.limitations ||
    (derivedLimitations
      ? ''
      : 'No component-specific limitation is curated here. Check Compatibility and the linked behavior contract for target-specific constraints.');
  const limitations = [curatedLimitations, derivedLimitations].filter(Boolean).join('\n\n');
  const provider = component.providerRequired
    ? '`BeeUIProvider` is required above this family because it participates in shared overlay/toast runtime infrastructure.'
    : 'No additional provider is required by this family. `BeeUIProvider` remains the recommended application root.';

  return `---\ntitle: ${yamlString(component.title)}\ndescription: ${yamlString(component.purpose)}\n---\n\n<!-- Generated by scripts/public-component-reference.mjs. Do not hand-edit. -->\n\n${component.purpose}\n\n:::note[Distribution status]\nBeeUI packages and the public CLI remain unpublished. The import shape below is the stable public package boundary used by workspace/packed-consumer verification; use the repository-local Registry command only from a BeeUI checkout until publication is explicitly authorized.\n:::\n\n## Identity\n\n- **Category:** ${component.category}\n- **Status:** stable public Registry/export-map component family\n- **Targets:** iOS · Android · Web, subject to the [compatibility contract](/docs/compatibility/)\n- **Source:** [\`${component.source}\`](${component.sourceHref})\n\n## Import\n\n\`\`\`tsx\nimport { ${component.values.join(', ')} } from '@beemvp/beeui-ui';\n\`\`\`\n\nThere is no documented deep/private source import. For source ownership from a BeeUI checkout:\n\n\`\`\`bash\n${component.cliAdd}\n\`\`\`\n\nRegistry metadata: [\`registry/registry.json\`](${component.registryHref}).\n\n## Composition and public API\n\n${renderAnatomy(component)}\n\n**Exported types:** ${types}\n\nThe generated API inventory is mechanically joined to \`packages/ui/src/index.ts\`, Registry metadata, and the component reference contract. Each type's field table below is parsed directly from that source, not a second hand-maintained copy; for the fuller behavior narrative see the [canonical component behavior catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md).\n\n## State and behavior contract\n\n${component.behavior}\n\n### Props\n\n${renderTypeDocs(component.typeDocs)}\n\nThe executable fixtures below are the source-grounded usage examples; consumers should not infer state ownership from DOM structure or another UI library.\n\n## Provider and dependencies\n\n- ${provider}\n- **Peer/native dependencies visible to this Registry item:** ${peers}\n- **Registry dependency closure:** ${registryDeps}\n${webPeerNote}- Safe-area ownership remains explicit: shell surfaces touching system edges opt into \`SafeArea\`; components do not silently invent app-shell insets.\n- Web consumers load the BeeUI semantic theme CSS as documented in [Web onboarding](/docs/start/web/).\n\n## Platform behavior\n\n${renderPlatformImplementation(component)}\n\n${platformSplit}\n\nEvidence classes are not equal and this page does not blur them: Web behavior is exercised in a real browser, while iOS and Android carry package/export and native-compile evidence, which is not device-runtime proof. The [compatibility contract](/docs/compatibility/) records which class each claim rests on.\n\n## Accessibility\n\n${renderAccessibilityFacts(component, rootDir)}\n\nKeyboard/focus behavior, announcements, Dynamic Type/Web zoom, RTL and reduced-motion expectations are not derived here — see [Accessibility overview](/docs/accessibility/), [Keyboard & focus](/docs/accessibility/keyboard-focus/), [RTL/localization](/docs/accessibility/rtl/) and [Large text & zoom](/docs/accessibility/large-text/). BeeUI does not claim universal accessibility certification from automated tests.\n\n## Styling and theming\n\n${renderStylingFacts(component, rootDir)}\n\nColors, spacing and typography come from semantic tokens rather than from values written here — see [Theming](/docs/theming/) and [Density](/docs/guides/density/). A \`className\` is an escape hatch for source-owned and application work, not a cross-engine portability guarantee.\n\n## Executable examples\n\n${examples}\n\n### Addressable examples\n\nEach link below opens the Showcase at that exact example, not at the top of the gallery:\n\n${renderExampleTargets(component)}\n\nThe Showcase links demonstrate Web behavior; use the native-preview guide for real simulator/emulator/device paths.\n\n## Limitations\n\n${limitations}\n\n${component.notes ? `**Implementation note:** ${component.notes}\n\n` : ''}## Related\n\n- [All components](/docs/components/)\n- [Production patterns](/docs/patterns/)\n- [Showcase](/showcase/)\n- [CLI & source ownership](/docs/guides/cli-source-ownership/)\n- [Source](${component.sourceHref})\n`;
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
    fs.writeFileSync(path.join(outDir, `${component.name}.md`), renderPublicComponentPage(component, rootDir));
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
