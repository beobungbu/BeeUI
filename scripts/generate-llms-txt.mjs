#!/usr/bin/env node

// Generates the canonical llms.txt family (llms.txt, llms-full.txt,
// llms-components.txt, llms-patterns.txt) — BeeUI's AI-native discovery surface
// for LLM/agent consumers.
//
// The family is DERIVED from the stable contract corpus so it cannot silently
// drift from the real public surface:
//   - the public component inventory + source paths come from registry/registry.json;
//   - the exported symbol set per module comes from packages/ui/src/index.ts;
//   - package names/versions/private-state come from the three packages/*/package.json;
//   - every documentation link is validated to resolve to a real repository file.
//
// Two modes mirror scripts/generate-tokens.mjs:
//   node scripts/generate-llms-txt.mjs            # (re)write the four files
//   node scripts/generate-llms-txt.mjs --check    # fail if committed files are stale
//
// Freshness is CI-enforced: `pnpm llms:check` runs inside `pnpm typecheck` and the
// unit tests run inside `pnpm test`, so a changed registry/export/package surface
// that is not regenerated fails CI.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OUTPUT_FILES = {
  index: 'llms.txt',
  full: 'llms-full.txt',
  components: 'llms-components.txt',
  patterns: 'llms-patterns.txt',
};

// Repository files the generated family links to. Every path here MUST resolve to a
// real file — the generator fails loudly if one is missing, so a renamed/removed doc
// or ADR cannot leave a dangling reference in the agent context surface.
export const LINKED_PATHS = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'LICENSE',
  'registry/registry.json',
  'packages/ui/src/index.ts',
  'docs/README.md',
  'docs/architecture.md',
  'docs/components.md',
  'docs/roadmap.md',
  'docs/release.md',
  'docs/compatibility-matrix.md',
  'docs/web-support-contract.md',
  'docs/accessibility-contract.md',
  'docs/anchored-overlays.md',
  'docs/theming.md',
  'docs/registry-cli.md',
  'docs/distribution-names.md',
  'docs/agent-execution-contract.md',
  'docs/ai-agent-cookbook.md',
  'docs/benchmark-harness.md',
  'docs/bundle-footprint-baseline.md',
  'docs/performance-baseline-report.md',
  'docs/decisions/001-styling-engine.md',
  'docs/decisions/002-overlay-behavior.md',
  'docs/decisions/003-native-measurement-timeout.md',
  'docs/decisions/004-direction-architecture.md',
  'docs/decisions/005-tooltip-contract.md',
  'docs/decisions/006-sheet-gesture-engine.md',
  'docs/decisions/007-table-datatable-architecture.md',
  'docs/decisions/008-datetime-architecture.md',
  'docs/decisions/009-slider-1-0-decision.md',
  'docs/decisions/010-select-presentation-1-0-decision.md',
  'docs/decisions/011-distribution-architecture.md',
  'apps/docs/src/content/docs/index.md',
  'apps/docs/src/content/docs/start/index.md',
  'apps/docs/src/content/docs/start/expo.md',
  'apps/docs/src/content/docs/start/bare-react-native.md',
  'apps/docs/src/content/docs/start/web.md',
  'apps/docs/src/content/docs/start/provider-safe-area.md',
  'apps/docs/src/content/docs/guides/cli-source-ownership.md',
  'apps/docs/src/content/docs/components/index.md',
  'apps/docs/src/content/docs/components/table.md',
  'apps/docs/src/content/docs/components/calendar-date-time.md',
  'apps/docs/src/content/docs/patterns/index.md',
  'apps/docs/src/content/docs/performance/index.md',
  'examples/README.md',
  'examples/scripts/pack-beeui-packages.mjs',
  'examples/web-consumer/vite.config.ts',
  'examples/web-consumer/src/global.css',
];

// Production pattern packs (README.md "Production pattern coverage"), living under
// apps/showcase/patterns/**. Screens are executable Showcase inputs, not @beemvp/beeui-ui exports.
export const PATTERN_PACKS = [
  { name: 'Authentication + Onboarding', screens: 9 },
  { name: 'Dashboard + Finance', screens: 8 },
  { name: 'Commerce + Social', screens: 12 },
  { name: 'Account + Settings', screens: 8 },
];

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

// Parses `export { A, B, type C } from './components/x';` / `export type { … } from '…';`
// blocks out of the @beemvp/beeui-ui barrel, grouped by the module specifier they re-export from.
export function parseBarrelExports(indexSource) {
  // Strip line comments so commented-out export illustrations never count as real exports.
  const withoutComments = indexSource.replace(/\/\/[^\n]*/g, '');
  const blockRe = /export\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*'([^']+)';/g;
  const bySpecifier = new Map();

  for (const match of withoutComments.matchAll(blockRe)) {
    const blockIsType = Boolean(match[1]);
    const specifier = match[3];
    const entry = bySpecifier.get(specifier) ?? { values: [], types: [] };

    for (const rawSymbol of match[2].split(',')) {
      const symbol = rawSymbol.trim();
      if (!symbol) continue;
      if (blockIsType || symbol.startsWith('type ')) {
        entry.types.push(symbol.replace(/^type\s+/, ''));
      } else {
        entry.values.push(symbol);
      }
    }

    bySpecifier.set(specifier, entry);
  }

  return bySpecifier;
}

// Builds the derived data model shared by every file builder. Throws (fails generation)
// if the registry's public component surface and the @beemvp/beeui-ui barrel have drifted apart,
// which is exactly the "stale exports/registry" condition the DoD requires machine-detected.
export function buildModel({ registry, barrelSource, packages }) {
  const barrel = parseBarrelExports(barrelSource);

  const publicComponents = registry.items
    .filter((item) => item.public && item.type === 'component')
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));

  const components = publicComponents.map((name) => {
    const specifier = `./components/${name}`;
    const exports = barrel.get(specifier);
    if (!exports) {
      throw new Error(
        `registry item "${name}" is public but @beemvp/beeui-ui barrel has no \`export … from '${specifier}'\` — ` +
          'registry/registry.json and packages/ui/src/index.ts have drifted.',
      );
    }
    const item = registry.items.find((candidate) => candidate.name === name);
    // Prefer a real implementation file over a `.d.ts` entry shim for platform-split
    // modules (e.g. date-picker, table, tooltip), so "source" points an agent at code.
    const primaryFile = item.files.find((file) => !file.source.endsWith('.d.ts')) ?? item.files[0];
    return {
      name,
      source: primaryFile.source,
      values: exports.values,
      types: exports.types,
      peerDependencies: Object.keys(item.peerDependencies ?? {}).sort((a, b) => a.localeCompare(b)),
    };
  });

  const publicUtilities = registry.items
    .filter((item) => item.public && item.type !== 'component')
    .map((item) => `${item.name} (${item.type})`)
    .sort((a, b) => a.localeCompare(b));

  const privateUtilities = registry.items
    .filter((item) => !item.public)
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));

  return {
    components,
    componentCount: components.length,
    publicUtilities,
    privateUtilities,
    registryItemCount: registry.items.length,
    packages,
    patternScreenTotal: PATTERN_PACKS.reduce((total, pack) => total + pack.screens, 0),
  };
}

function packageLine(pkg) {
  const state = pkg.private ? 'unpublished (private: true)' : 'unpublished (publishConfig.access=public prepared)';
  return `\`${pkg.name}\` v${pkg.version} — ${pkg.description} [${state}]`;
}

const HEADER_NOTE =
  'Generated by scripts/generate-llms-txt.mjs from registry/registry.json, packages/ui/src/index.ts, ' +
  'and packages/*/package.json. Do not edit by hand; run `pnpm llms:generate`.';

const UNPUBLISHED_NOTE =
  'STATUS: BeeUI is pre-1.0 and UNPUBLISHED. No `@beemvp/beeui-*` package or CLI is on npm, no `v1.0.0` tag or ' +
  'GitHub Release exists, and the repository is private by owner decision. Package/CLI names and install ' +
  'commands below are release-ready-but-not-published targets, not live registry commands. Do not tell a ' +
  'user to `npm install @beemvp/beeui-ui` or `npx @beemvp/beeui-cli` yet — those resolve to nothing today. The working, ' +
  'in-repo path is the source-ownership CLI (`pnpm beeui add <component>`).';

function buildIndex(model) {
  const { packages } = model;
  return `# BeeUI

> BeeUI is a production-oriented, accessibility-first React Native + Web UI system written in TypeScript, for Expo, bare React Native, and React Native Web. Stable behavior, semantic, and variant APIs do not require callers to know the styling engine (currently Uniwind + Tailwind CSS v4). This file is the AI-agent entry point; the links below resolve to real files in the repository.

${UNPUBLISHED_NOTE}

BeeUI ships ${model.componentCount} public component modules from \`@beemvp/beeui-ui\` plus a semantic design-token contract (\`@beemvp/beeui-tokens\`) and engine-neutral helpers (\`@beemvp/beeui-core\`). It owns UI only: no router, data-fetching, backend, auth, form-library, or chart framework. Two consumption models coexist — centralized packages and file-level source ownership.

## Packages
- ${packageLine(packages.core)} ([packages/core/package.json](packages/core/package.json))
- ${packageLine(packages.tokens)} ([packages/tokens/package.json](packages/tokens/package.json))
- ${packageLine(packages.ui)} ([packages/ui/package.json](packages/ui/package.json))

## Install (both models, targets are unpublished)
- Centralized (release-ready target, NOT yet on npm): \`npm i @beemvp/beeui-ui @beemvp/beeui-core @beemvp/beeui-tokens\`, then \`import { Button } from '@beemvp/beeui-ui'\` and wire the Web theme via \`@import '@beemvp/beeui-tokens/theme.css'\`. See [docs/decisions/011-distribution-architecture.md](docs/decisions/011-distribution-architecture.md).
- Source ownership (works today, repo-local): \`pnpm beeui add <component>\` copies component source into the consumer and rewrites \`@beemvp/beeui-core\` imports. The published CLI target is \`@beemvp/beeui-cli\` (binary \`beeui\`), invoked \`npx @beemvp/beeui-cli add <component>\` once released — NOT \`npx beeui\`. See [docs/registry-cli.md](docs/registry-cli.md) and [docs/distribution-names.md](docs/distribution-names.md).

## Start here
- [README.md](README.md): project overview, quick start, safe-area/overlay/toast foundations.
- [docs/architecture.md](docs/architecture.md): layering, invariants, non-goals, styling-engine boundary.
- [docs/components.md](docs/components.md): canonical per-component contract inventory.
- [docs/roadmap.md](docs/roadmap.md): pre-1.0 plan and hard 1.0 gates.

## Detailed agent surfaces
- [llms-full.txt](llms-full.txt): expanded architecture, setup, compatibility, and contract detail.
- [llms-components.txt](llms-components.txt): the ${model.componentCount} public component modules with exported symbols and source paths.
- [llms-patterns.txt](llms-patterns.txt): production pattern catalog and composition guidance.

## For contributing agents
- [docs/ai-agent-cookbook.md](docs/ai-agent-cookbook.md): AI-agent development contract + task-oriented prompt cookbook (how to consume/build/contribute; unpublished-status rules; ownership boundaries).
- [AGENTS.md](AGENTS.md): code rules (semantic-token-only styling, engine-boundary, accessibility).
- [CONTRIBUTING.md](CONTRIBUTING.md): local setup, required gates, review discipline.
- [docs/agent-execution-contract.md](docs/agent-execution-contract.md): implementation-agent protocol for BeeUI 1.0.

## Optional
- [docs/compatibility-matrix.md](docs/compatibility-matrix.md): pinned/tested React/RN/Expo/tooling versions.
- [docs/theming.md](docs/theming.md): semantic tokens, density, high contrast, branding.
- [docs/anchored-overlays.md](docs/anchored-overlays.md): shared overlay geometry/runtime/portal contract.
- [registry/registry.json](registry/registry.json): machine-readable source-ownership registry.

${HEADER_NOTE}
`;
}

function buildFull(model) {
  const { packages } = model;
  const adrs = [
    ['001-styling-engine', 'Uniwind + Tailwind v4 as the current, replaceable styling engine behind stable APIs.'],
    ['002-overlay-behavior', 'Modal-class vs anchored overlays use different behavior primitives.'],
    ['003-native-measurement-timeout', 'Bounded native measurement completion and deterministic fallback.'],
    ['004-direction-architecture', 'One stateless LTR/RTL resolver; BeeUI reads ambient direction, never writes it.'],
    ['005-tooltip-contract', 'Tooltip is a non-interactive contextual disclosure, not a click menu.'],
    ['006-sheet-gesture-engine', 'Sheet: @gorhom/bottom-sheet on native, BeeUI Web overlay on Web; no drag-parity claim.'],
    ['007-table-datatable-architecture', 'Table is a composable primitive family, not a data-driven grid.'],
    ['008-datetime-architecture', 'Timezone-free, Intl-driven, single-date-selection value contracts.'],
    ['009-slider-1-0-decision', 'Slider scope decision for 1.0.'],
    ['010-select-presentation-1-0-decision', 'Select presentation scope for 1.0 (no Sheet mode / virtualization).'],
    ['011-distribution-architecture', 'Public distribution model: three scoped packages + source-ownership CLI, prepared not published.'],
  ];

  return `# BeeUI — full agent context

> Expanded stable-API, setup, compatibility, and architecture-contract detail for coding agents. Companion to llms.txt (compact index), llms-components.txt (component inventory), and llms-patterns.txt (patterns).

${UNPUBLISHED_NOTE}

## What BeeUI is
BeeUI is a reusable, mobile-first React Native UI foundation for long-lived client apps. The public component API stops at \`@beemvp/beeui-ui\`; applications should not need to know the styling engine. Web support is additive and native ergonomics remain first-class. See [docs/architecture.md](docs/architecture.md).

## Packages (all unpublished / pre-1.0, one lockstep version)
- ${packageLine(packages.core)}
- ${packageLine(packages.tokens)}
- ${packageLine(packages.ui)}

\`@beemvp/beeui-core\`, \`@beemvp/beeui-tokens\`, and \`@beemvp/beeui-ui\` share one lockstep version and are released together (ADR-011 D6). Package manifests declare \`publishConfig.access=public\` + provenance but remain unpublished; \`exports\` maps ship dual ESM+CJS with \`.d.ts\`, a \`react-native\` condition for Metro, \`browser\`/\`default\` for Web, and \`@beemvp/beeui-tokens/theme.css\` for the Web theme.

## Consumption models
1. Centralized packages (release-ready target, NOT on npm): \`npm i @beemvp/beeui-ui\` pulls \`@beemvp/beeui-core\` + \`@beemvp/beeui-tokens\`; import components from \`@beemvp/beeui-ui\`; wire Web theme with \`@import '@beemvp/beeui-tokens/theme.css'\`.
2. Source ownership (works today, repo-local): \`pnpm beeui add <component>\` copies component source in-tree and rewrites \`@beemvp/beeui-core\` imports via \`rewrite-beeui-core-cn\` / \`rewrite-beeui-core-module\`. Run \`pnpm beeui list\` for the canonical component list (generated from registry/registry.json). Future published CLI: \`@beemvp/beeui-cli\` (binary \`beeui\`), \`npx @beemvp/beeui-cli add <component>\` — never \`npx beeui\` (the unscoped name is an npm tombstone; see [docs/distribution-names.md](docs/distribution-names.md)).

See [docs/decisions/011-distribution-architecture.md](docs/decisions/011-distribution-architecture.md) and [docs/registry-cli.md](docs/registry-cli.md).

### Consuming the packages before release (pnpm pack tarballs)
The centralized model above is a target, but a new, standalone external app can already consume it **today** without npm — as local tarballs, the same package boundary CI's \`scripts/verify-web-consumer.sh\` / \`scripts/verify-bare-consumer.sh\` and the checked-in starters use (never a \`workspace:*\` link or a hand-copied \`dist/\`). Steps: (1) build the packages once from the repo root (\`pnpm build\`); (2) pack \`@beemvp/beeui-core\`, \`@beemvp/beeui-tokens\`, and \`@beemvp/beeui-ui\` into \`*.tgz\` files — the starters do this with [examples/scripts/pack-beeui-packages.mjs](examples/scripts/pack-beeui-packages.mjs), which runs \`pnpm pack\` per package; (3) install the tarballs into the consumer with \`npm install --save-exact <core.tgz> <tokens.tgz> <ui.tgz>\`, which pins them as \`"@beemvp/beeui-ui": "file:….tgz"\` dependencies. This resolves the real package \`exports\` maps and the Web theme CSS exactly as a published install would, so no fictional npm entry is needed. Worked, buildable reference: [examples/web-consumer](examples/web-consumer) and [examples/README.md](examples/README.md).

## Quick start (repository)
\`\`\`bash
corepack enable
pnpm install --frozen-lockfile
pnpm showcase   # then press i (iOS), a (Android), or w (Web)
\`\`\`
Verification: \`pnpm check\` (typecheck + tests), \`pnpm release:verify\` (package gate), \`pnpm --dir apps/visual-regression test\` (browser QA). See [README.md](README.md).

## Provider and safe-area setup
Wrap the app root in \`BeeUIProvider\` (installs safe-area measurement, the Toast runtime, and the shared anchored-overlay runtime). \`SafeArea\` assigns explicit \`top\`/\`bottom\`/\`left\`/\`right\` edge ownership; \`Screen\`, \`AppHeader\`, and \`BottomActionBar\` never add insets themselves. See [apps/docs/src/content/docs/start/provider-safe-area.md](apps/docs/src/content/docs/start/provider-safe-area.md).

## Web bundling (Vite + react-native-web)
\`@import '@beemvp/beeui-tokens/theme.css'\` supplies the semantic tokens but is not, by itself, a Web build. A from-scratch Vite + react-native-web app needs a specific plugin stack and a Tailwind/Uniwind CSS entry; get it wrong and the app either fails to resolve \`react-native\` or builds **unstyled**. The tested stack:
- \`vite.config.ts\` — three plugins, in this order: \`rnw()\` from \`vite-plugin-rnw\` (resolves \`react-native\` → \`react-native-web\`), \`tailwindcss()\` from \`@tailwindcss/vite\`, and \`uniwind()\` from \`uniwind/vite\` (passed \`cssEntryFile\` + \`dtsFile\`).
- A CSS entry (e.g. \`src/global.css\`) imported once from the app entry, declaring in order:
\`\`\`css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';
@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
\`\`\`
The \`@source\` globs are **required**: Tailwind/Uniwind only emit utility classes they can statically discover, and BeeUI's classes live inside the installed packages' \`src\`. Omit them and the build succeeds but ships with no BeeUI styling. Pinned/tested versions for every dependency in this stack are in [docs/compatibility-matrix.md](docs/compatibility-matrix.md); the complete buildable reference is [examples/web-consumer](examples/web-consumer) ([vite.config.ts](examples/web-consumer/vite.config.ts), [src/global.css](examples/web-consumer/src/global.css)). Web support boundaries: [docs/web-support-contract.md](docs/web-support-contract.md).

## Runtime theme switching (app-owned light/dark)
Brand and density live in tokens (\`@import\` the theme, ADR-001), but the **app-level** switch between light and dark at runtime is owned by the application and driven through Uniwind — not a BeeUI component. Import from the \`uniwind\` package: \`Uniwind.setTheme(name)\` changes the active theme globally, and \`useUniwind()\` reads the current \`{ theme }\` (and \`hasAdaptiveThemes\`) so the app re-renders. The valid runtime-theme names are exported from \`@beemvp/beeui-tokens\` as \`beeRuntimeThemeNames\` (\`light\`, \`dark\`, \`violet-light\`, \`violet-dark\`); \`Uniwind.setTheme('light')\` / \`Uniwind.setTheme('dark')\` is the common case. This is a single small piece of app state deciding *which* value BeeUI's existing theme runtime uses — not a second theme authority. To theme one subtree independently of the app theme, use the \`BeeThemeScope\` component (a public \`@beemvp/beeui-ui\` export) instead of a second \`setTheme\` path. See [docs/theming.md](docs/theming.md) and the cookbook's Recipe F in [docs/ai-agent-cookbook.md](docs/ai-agent-cookbook.md).

## Architecture invariants (do not violate)
- Stable behavior/semantic/variant APIs are independent of Uniwind, Expo, routers, storage, networking, and business logic.
- Components consume semantic tokens (\`bg-primary\`, \`text-foreground\`, \`border-border\`); never literal brand colors. Every semantic token exists in every theme.
- \`className\` is an optional current-engine escape hatch, not a portability guarantee; engine-only bridge props stay internal.
- No duplicate theme, overlay, focus, direction, or state authority. One application-root overlay runtime; nested providers reuse it.
- Tailwind/Uniwind utilities must be statically discoverable — never construct \`bg-\${x}\` dynamically.
- Controlled primitives (Checkbox, Radio, RadioGroup, Switch, Tabs, SegmentedControl, and others) require their change callback; enabled usage without it warns in development.
- Accessibility, RTL/logical direction, large text, high contrast, and reduced motion are part of component correctness.
See [AGENTS.md](AGENTS.md) and [docs/architecture.md](docs/architecture.md).

## Non-goals (explicit)
BeeUI does not build or bundle a styling compiler, router, backend, state library, form framework, chart framework, data-grid, or virtualization engine to match another ecosystem's feature list. It owns no fetching, navigation, auth, or persistence. Timezone/business-calendar rules stay with the application (ADR-008). Table is a primitive family, not a data grid (ADR-007). Select has no Sheet mode or virtualization for 1.0 (ADR-010).

## Overlay model (summary)
- Modal-class \`Dialog\`/\`AlertDialog\` use React Native core \`Modal\`. \`DialogContent\` defaults to \`overFullScreen\` (transparent); \`fullScreen\`/\`pageSheet\`/\`formSheet\` are non-transparent so RN honors the presentation.
- Anchored \`Popover\`/\`DropdownMenu\`/\`Select\`/\`Tooltip\` share one non-modal geometry/runtime/portal/dismiss kernel installed by \`BeeUIProvider\`.
- Portal transport: Web \`ReactDOM.createPortal\`; native New Architecture \`react-native-teleport\`; defensive legacy fallback (does not preserve consumer context).
- Global dismissal targets the deepest active scope via semantic depth, independent of React effect order. Native measurement uses latest-request-wins generation guards.
- \`Toast\` is a separate transient-notification runtime (not modal, not anchored).
See [docs/anchored-overlays.md](docs/anchored-overlays.md).

## Platform / compatibility boundaries
- Targets React Native first: Expo, Expo prebuild/dev builds, bare RN, and documented RN Web. Expo-specific APIs live in apps/adapters, never core packages.
- Pinned/tested versions (React, React Native, Expo SDK, react-native-web, Tailwind, Uniwind, safe-area-context, teleport) are the authority in [docs/compatibility-matrix.md](docs/compatibility-matrix.md); Web support boundaries in [docs/web-support-contract.md](docs/web-support-contract.md).
- iOS \`pageSheet\`/\`formSheet\` presentation is EXPERIMENTAL for 1.0 (compile + deterministic evidence only; live placement/swipe is a device gate). Compilation/browser evidence never proves full native runtime behavior.

## Accessibility
Accessibility roles/names/states/focus/keyboard are component correctness, not an add-on. Web gets real focus traps (Dialog/Sheet), listbox/menu keyboard semantics, and \`aria-*\` relationships; native uses RN semantic roles and merged hints where no equivalent role exists. VoiceOver/TalkBack claims require device evidence. See [docs/accessibility-contract.md](docs/accessibility-contract.md).

## Architecture decision records
${adrs.map(([slug, note]) => `- [ADR-${slug.slice(0, 3)} ${slug.slice(4)}](docs/decisions/${slug}.md): ${note}`).join('\n')}

## Registry / source ownership
[registry/registry.json](registry/registry.json) is the machine-readable source of ${model.registryItemCount} items: ${model.componentCount} public components, 1 public theme, and internal utilities (${model.privateUtilities.join(', ')}). Each item declares source files, transforms, registry dependencies, and peer dependencies. Component-to-symbol mapping is verified against [packages/ui/src/index.ts](packages/ui/src/index.ts) at generation time.

## Documentation map
- AI-agent contract + prompt cookbook: [docs/ai-agent-cookbook.md](docs/ai-agent-cookbook.md)
- Authority index: [docs/README.md](docs/README.md)
- Start: [Expo](apps/docs/src/content/docs/start/expo.md) · [bare RN](apps/docs/src/content/docs/start/bare-react-native.md) · [Web](apps/docs/src/content/docs/start/web.md)
- CLI: [apps/docs/src/content/docs/guides/cli-source-ownership.md](apps/docs/src/content/docs/guides/cli-source-ownership.md)
- Components site: [apps/docs/src/content/docs/components/index.md](apps/docs/src/content/docs/components/index.md) (deep dives: [Table](apps/docs/src/content/docs/components/table.md), [Calendar/DatePicker](apps/docs/src/content/docs/components/calendar-date-time.md))
- Performance: methodology [docs/benchmark-harness.md](docs/benchmark-harness.md) · baseline report [docs/performance-baseline-report.md](docs/performance-baseline-report.md) · package/bundle footprint [docs/bundle-footprint-baseline.md](docs/bundle-footprint-baseline.md) · docs site [apps/docs/src/content/docs/performance/index.md](apps/docs/src/content/docs/performance/index.md)
- Release policy: [docs/release.md](docs/release.md) · Changelog: [CHANGELOG.md](CHANGELOG.md) · License: [LICENSE](LICENSE) (MIT)

${HEADER_NOTE}
`;
}

function buildComponents(model) {
  const lines = model.components.map((component) => {
    const symbols = component.values.join(', ');
    const peer = component.peerDependencies.length
      ? ` — notable peers: ${component.peerDependencies.join(', ')}`
      : '';
    return `- \`${component.name}\` → exports: ${symbols} — source: [${component.source}](${component.source})${peer}`;
  });

  return `# BeeUI — component inventory

> The ${model.componentCount} public component modules exported by \`@beemvp/beeui-ui\`, derived from registry/registry.json and packages/ui/src/index.ts. Each line lists the module's exported runtime symbols and its source file. Full per-component behavior/accessibility contracts live in [docs/components.md](docs/components.md); this file is the token-efficient map from name to symbols to source.

${UNPUBLISHED_NOTE}

## How to read this
- Import all listed symbols from \`@beemvp/beeui-ui\` (centralized model) or copy the source file via \`pnpm beeui add <name>\` (source-ownership model). Type-only exports are omitted here for brevity; see the source file or [packages/ui/src/index.ts](packages/ui/src/index.ts) for \`Props\` and value-type exports.
- "source" paths are repository files. Platform-split modules (e.g. \`date-picker\`, \`table\`, \`sheet\`, \`tooltip\`) resolve \`*.web.tsx\` / \`*.native.tsx\` at build time from the listed entry.
- Every text-bearing component honors OS/browser font scaling (docs/dynamic-type.md via [docs/components.md](docs/components.md)); interactive components carry accessibility roles/states.

## Platform behavior (summary)
- Web: real HTML semantics where available (Table renders \`<table>\`/\`<th scope>\`/\`aria-sort\`), focus traps (Dialog, Sheet), listbox/menu/combobox keyboard + typeahead (Select, DropdownMenu), and \`aria-*\` relationships gated to mounted content.
- Native: RN semantic roles (\`radiogroup\`, \`progressbar\`, \`switch\`), merged \`accessibilityHint\`/\`accessibilityLabel\` where no Web-equivalent role exists, and system pickers for DatePicker/DateTimePicker via \`@react-native-community/datetimepicker\`.
- Shared anchored kernel: Popover, DropdownMenu, Select, Tooltip share geometry/flip/shift/collision/safe-area/dismiss; RTL via one \`useDirection()\` resolver (ADR-004).
- Native-only: \`DatePicker\` / \`DateTimePicker\` are the system pickers and ship **only** as \`*.native.tsx\` (no \`date-picker.web.tsx\`) — on Web they render nothing usable. Use \`Calendar\`, which is the cross-platform date primitive (native + Web), for date selection on Web (ADR-008).

## Public component modules (${model.componentCount})
${lines.join('\n')}

## Public non-component surface
- \`theme\` (registry type: theme) — the canonical Uniwind/Tailwind CSS at \`packages/tokens/src/theme.css\`, consumed on Web via \`@import '@beemvp/beeui-tokens/theme.css'\`.

## Internal utilities (not part of the public import surface)
${model.privateUtilities.map((name) => `- \`${name}\``).join('\n')}

## Deep-dive contracts
- Overlays (Popover/DropdownMenu/Select/Tooltip): [docs/anchored-overlays.md](docs/anchored-overlays.md), [ADR-002](docs/decisions/002-overlay-behavior.md), [ADR-005](docs/decisions/005-tooltip-contract.md), [ADR-010](docs/decisions/010-select-presentation-1-0-decision.md).
- Sheet: [ADR-006](docs/decisions/006-sheet-gesture-engine.md). Table: [ADR-007](docs/decisions/007-table-datatable-architecture.md), [apps/docs/src/content/docs/components/table.md](apps/docs/src/content/docs/components/table.md).
- Calendar/DatePicker/DateTimePicker: [ADR-008](docs/decisions/008-datetime-architecture.md), [apps/docs/src/content/docs/components/calendar-date-time.md](apps/docs/src/content/docs/components/calendar-date-time.md).

${HEADER_NOTE}
`;
}

function buildPatterns(model) {
  const packLines = PATTERN_PACKS.map((pack) => `- ${pack.name}: ${pack.screens} screens`);

  return `# BeeUI — production patterns

> BeeUI's composition guidance and the production Pattern Gallery: ${model.patternScreenTotal} screens across ${PATTERN_PACKS.length} packs under apps/showcase/patterns/**. Patterns are executable Showcase evidence and examples — they import public \`@beemvp/beeui-ui\` APIs and own local domain composition. They are NOT \`@beemvp/beeui-ui\` exports and are NOT installable via the registry.

${UNPUBLISHED_NOTE}

## Pattern packs (${model.patternScreenTotal} screens total)
${packLines.join('\n')}

The Showcase opens a local section chooser: Components (interactive playground) and Patterns (declarative Pattern Gallery over the four packs). No router or global store is required. See [README.md](README.md) and [docs/architecture.md](docs/architecture.md).

## Composition guidance for agents
- Compose existing primitives first; keep domain-specific composition local to the app, not in \`@beemvp/beeui-ui\`. Promote a shared primitive only after repeated or behaviorally complex evidence (the "Rule of Two", [docs/roadmap.md](docs/roadmap.md)).
- App shell: wrap in \`BeeUIProvider\`; own safe-area edges explicitly with \`SafeArea\` around \`AppHeader\` / content / \`BottomActionBar\`.
- Forms: \`Field\` composes label/description/error for text entry; \`FormGroup\` owns structural legend/description/error for related controls without collapsing them into one accessibility element. Controlled selection controls need their change callback.
- Overlays: use \`Dialog\`/\`AlertDialog\` for modal-class flows; \`Popover\`/\`DropdownMenu\`/\`Select\`/\`Tooltip\` for anchored non-modal content; \`Sheet\` for gesture bottom sheets (requires \`GestureHandlerRootView\` + \`BottomSheetModalProvider\` at the app root on native, ADR-006). \`useToast()\` for transient notifications.
- Data display: \`Table\` is a composable primitive family — map your own rows to \`TableRow\`/\`TableCell\`; sort/selection state stays caller-owned (ADR-007). \`Stat\`, \`Timeline\`, \`Badge\`, \`Avatar\`, \`DescriptionList\` are layout-only.
- Dates: \`Calendar\`/\`DatePicker\`/\`DateTimePicker\` are timezone-free, single-date, \`Intl\`-driven; the app owns any timezone/business-calendar conversion (ADR-008).

## Where to look
- Executable patterns: apps/showcase/patterns/** (native Showcase inputs).
- Component contracts referenced by patterns: [docs/components.md](docs/components.md).
- Patterns docs page: [apps/docs/src/content/docs/patterns/index.md](apps/docs/src/content/docs/patterns/index.md).

${HEADER_NOTE}
`;
}

export function buildFamily(model) {
  return {
    [OUTPUT_FILES.index]: buildIndex(model),
    [OUTPUT_FILES.full]: buildFull(model),
    [OUTPUT_FILES.components]: buildComponents(model),
    [OUTPUT_FILES.patterns]: buildPatterns(model),
  };
}

export function collectMissingLinkedPaths(rootDir = ROOT_DIR) {
  return LINKED_PATHS.filter((relPath) => !fs.existsSync(path.join(rootDir, relPath)));
}

function loadModelFromRepo() {
  return buildModel({
    registry: readJson('registry/registry.json'),
    barrelSource: readText('packages/ui/src/index.ts'),
    packages: {
      core: readJson('packages/core/package.json'),
      tokens: readJson('packages/tokens/package.json'),
      ui: readJson('packages/ui/package.json'),
    },
  });
}

function generate() {
  const missing = collectMissingLinkedPaths();
  if (missing.length > 0) {
    throw new Error(`llms.txt family links to non-existent files:\n- ${missing.join('\n- ')}`);
  }
  const family = buildFamily(loadModelFromRepo());
  for (const [file, content] of Object.entries(family)) {
    fs.writeFileSync(path.join(ROOT_DIR, file), content);
  }
  return Object.keys(family);
}

function check() {
  const missing = collectMissingLinkedPaths();
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `llms.txt family links to non-existent files:\n- ${missing.join('\n- ')}`,
    };
  }
  const family = buildFamily(loadModelFromRepo());
  const stale = [];
  for (const [file, expected] of Object.entries(family)) {
    const filePath = path.join(ROOT_DIR, file);
    const actual = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (actual !== expected) stale.push(file);
  }
  return stale.length > 0
    ? { ok: false, reason: `stale (rerun \`pnpm llms:generate\`): ${stale.join(', ')}` }
    : { ok: true };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const wantsCheck = process.argv.includes('--check');
  try {
    if (wantsCheck) {
      const result = check();
      if (!result.ok) {
        console.error(`llms.txt family check failed: ${result.reason}`);
        process.exitCode = 1;
      } else {
        console.log('llms.txt family check passed (files match registry/exports/packages and all links resolve).');
      }
    } else {
      const written = generate();
      console.log(`Generated llms.txt family: ${written.join(', ')}`);
    }
  } catch (error) {
    console.error(`llms.txt family ${wantsCheck ? 'check' : 'generation'} failed: ${error.message}`);
    process.exitCode = 1;
  }
}
