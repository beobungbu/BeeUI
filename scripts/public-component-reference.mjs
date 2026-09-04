#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { showcaseHref } from '../apps/showcase/showcase-target.ts';
import {
  ROOT_DIR,
  buildShowcaseUsageIndex,
  getPublicComponents,
  readJson,
  usageForComponent,
} from './component-docs-lib.mjs';

export const PUBLIC_COMPONENT_DIR = 'apps/docs/src/content/docs/components/reference';

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
      limitations: curated?.limitations ?? '',
      notes: curated?.notes ?? '',
      examples,
      route: `/docs/components/reference/${component.name}/`,
      showcaseHref: showcaseHref({ surface: 'component', id: component.name, example: 'basic' }),
      sourceHref: githubHref(component.source),
      registryHref: githubHref('registry/registry.json'),
    };
  });
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
    if (!component.source || !fs.existsSync(path.join(rootDir, component.source))) {
      violations.push(`${component.name}: source path is missing: ${component.source}.`);
    }
    if (!component.values.length) violations.push(`${component.name}: no public runtime exports.`);
    if (!component.examples.length) violations.push(`${component.name}: no executable Showcase example.`);
    if (!component.cliAdd.startsWith('pnpm beeui -- add ')) {
      violations.push(`${component.name}: registry identity is not the repository-local source-ownership command.`);
    }
    if (!component.route.startsWith('/docs/components/reference/')) {
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

function renderAnatomy(component) {
  if (component.values.length <= 1) return `- Primary export: \`${component.values[0]}\``;
  return component.values.map((value, index) => `${index === 0 ? '- Family exports:' : '  '} \`${value}\``).join('\n');
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

  return `---\ntitle: ${yamlString(component.title)}\ndescription: ${yamlString(component.purpose)}\n---\n\n<!-- Generated by scripts/public-component-reference.mjs. Do not hand-edit. -->\n\n# ${component.title}\n\n${component.purpose}\n\n:::note[Distribution status]\nBeeUI packages and the public CLI remain unpublished. The import shape below is the stable public package boundary used by workspace/packed-consumer verification; use the repository-local Registry command only from a BeeUI checkout until publication is explicitly authorized.\n:::\n\n## Identity\n\n- **Category:** ${component.category}\n- **Status:** stable public Registry/export-map component family\n- **Targets:** iOS · Android · Web, subject to the [compatibility contract](/docs/compatibility/)\n- **Source:** [\`${component.source}\`](${component.sourceHref})\n\n## Import\n\n\`\`\`tsx\nimport { ${component.values.join(', ')} } from '@beemvp/beeui-ui';\n\`\`\`\n\nThere is no documented deep/private source import. For source ownership from a BeeUI checkout:\n\n\`\`\`bash\n${component.cliAdd}\n\`\`\`\n\nRegistry metadata: [\`registry/registry.json\`](${component.registryHref}).\n\n## Composition and public API\n\n${renderAnatomy(component)}\n\n**Exported types:** ${types}\n\nThe generated API inventory is mechanically joined to \`packages/ui/src/index.ts\`, Registry metadata, and the component reference contract. For behavior details and defaults, use the [canonical component behavior catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) rather than copying TypeScript declarations into a second hand-maintained table.\n\n## State and behavior contract\n\nControlled/uncontrolled props, callbacks, disabled semantics, normalization/fail-safe behavior, and mount/unmount rules are defined by the public types and the canonical behavior catalog. The executable fixtures below are the source-grounded usage examples; consumers should not infer state ownership from DOM structure or another UI library.\n\n## Provider and dependencies\n\n- ${provider}\n- **Peer/native dependencies visible to this Registry item:** ${peers}\n- **Registry dependency closure:** ${registryDeps}\n- Safe-area ownership remains explicit: shell surfaces touching system edges opt into \`SafeArea\`; components do not silently invent app-shell insets.\n- Web consumers load the BeeUI semantic theme CSS as documented in [Web onboarding](/docs/getting-started/web/).\n\n## Platform behavior\n\n${platformSplit}\n\n- **Web:** live browser/keyboard behavior is verified by Web-specific checks where applicable.\n- **iOS / Android:** package/export/native compile evidence is not described as device-runtime proof. Consult the compatibility and native-preview guides for the exact evidence class.\n- Platform-specific or experimental behavior is called out in the canonical component/compatibility docs rather than hidden behind a generic parity claim.\n\n## Accessibility\n\nUse the [Accessibility overview](/docs/accessibility/), [RTL/localization](/docs/accessibility/rtl/), and [Large text & zoom](/docs/accessibility/large-text/) alongside this family. Roles/states, keyboard/focus behavior, announcements, Dynamic Type/Web zoom, RTL, and reduced-motion expectations remain component-specific; BeeUI does not claim universal accessibility certification from automated tests.\n\n## Styling and theming\n\nBeeUI components consume semantic tokens and support the current typed variant/density contracts. Use [Theming](/docs/theming/) and [Density](/docs/theming/density/). \`className\` is an implementation escape hatch for source-owned/application work, not a cross-engine portability guarantee.\n\n## Executable examples\n\n${examples}\n\n[Open the matching Web runtime in Showcase](${component.showcaseHref}). The Showcase link demonstrates Web behavior; use the native-preview guide for real simulator/emulator/device paths.\n\n## Limitations\n\n${limitations}\n\n${component.notes ? `**Implementation note:** ${component.notes}\n\n` : ''}## Related\n\n- [All component reference pages](/docs/components/reference/)\n- [Production patterns](/docs/patterns/)\n- [Showcase](/showcase/)\n- [CLI & source ownership](/docs/cli/)\n- [Source](${component.sourceHref})\n`;
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

  return `---\ntitle: All components\ndescription: Source-driven BeeUI public component reference.\n---\n\n# All components\n\nThis index is generated from the public Registry + \`@beemvp/beeui-ui\` export map. It currently contains **${manifest.length}** stable public component families; adding or removing a public Registry component changes this inventory automatically and is checked by CI.\n\n${sections}\n`;
}

export function generatePublicComponentPages({ rootDir = ROOT_DIR, outDir = path.join(rootDir, PUBLIC_COMPONENT_DIR) } = {}) {
  const violations = collectPublicComponentReferenceViolations(rootDir);
  if (violations.length) throw new Error(`Public component reference contract failed:\n- ${violations.join('\n- ')}`);
  const manifest = buildPublicComponentManifest(rootDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
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
