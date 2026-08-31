# DTCG interoperability: Style Dictionary, design-tool handoff, and round-trip ownership

`packages/tokens/tokens.json` is already a conformant **DTCG 2025.10** Format document, and `packages/tokens/src/tokens.resolver.json` is already a conformant DTCG 2025.10 Resolver document — see [Canonical source and DTCG 2025.10](./theming.md#canonical-source-and-dtcg-202510) and [Package and generated artifacts](./theming.md#package-and-generated-artifacts). Both are published `@beemvp/beeui-tokens` exports (`@beemvp/beeui-tokens/tokens.json`, `@beemvp/beeui-tokens/tokens.resolver.json`). This document is the interoperability companion to that architecture: worked examples for consuming those artifacts from external tooling, and the ownership contract that governs any change those tools propose.

Nothing here changes BeeUI's runtime, generator, or schema. Every code sample below runs in a **consumer's own project or design-tool session** — none of it is added to this repository's dependencies, scripts, or CI.

## Style Dictionary consumption (worked example)

[Style Dictionary](https://styledictionary.com/) is a common next hop for teams that want BeeUI's tokens as native iOS/Android/CSS output alongside their own. This is a worked example a consumer copies into **their own project**; BeeUI does not add a `style-dictionary` dependency, script, or CI step to ship it.

### 1. Install, in the consuming project

```bash
npm install --save-dev style-dictionary
```

### 2. Point Style Dictionary at the published canonical artifact

Style Dictionary v4+ has native support for the `$value`/`$type`/`$description` shape (opt in with `usesDtcg: true`) — so it can read `tokens.json` directly, without scraping BeeUI's generated TypeScript or CSS:

```js
// sd.config.mjs (in the consuming project)
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['node_modules/@beemvp/beeui-tokens/tokens.json'],
  usesDtcg: true,
});
```

### 3. Resolve BeeUI's `$ref` aliases before Style Dictionary's own reference engine runs

Style Dictionary's built-in reference engine expects curly-brace strings inside a value (`"{color.primary}"`). BeeUI's canonical primitive-to-semantic aliases are DTCG 2025.10 Format `$ref` JSON Pointers instead (see [Private authoring primitives and semantic aliases](./theme-authoring-primitives.md)) — the more standards-faithful reference form, and deliberately not flattened in the canonical file. A consumer bridges that gap with one small preprocessor, written once:

```js
// resolve-beeui-refs.mjs (in the consuming project)
function resolvePointer(root, pointer) {
  const path = pointer.replace(/^#\//, '').split('/');
  return path.reduce((node, key) => node[key], root);
}

function resolveRefs(node, root) {
  if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') {
      const target = resolvePointer(root, node.$ref);
      // Recurse in case the target is itself an alias (multi-hop references).
      return resolveRefs({ ...target, $description: node.$description ?? target.$description }, root);
    }
    for (const key of Object.keys(node)) node[key] = resolveRefs(node[key], root);
  }
  return node;
}

export const beeuiRefResolver = {
  name: 'beeui/resolve-refs',
  preprocessor: (dictionary) => resolveRefs(structuredClone(dictionary), dictionary),
};
```

```js
// sd.config.mjs (continued)
import { beeuiRefResolver } from './resolve-beeui-refs.mjs';

StyleDictionary.registerPreprocessor(beeuiRefResolver);

const sd = new StyleDictionary({
  source: ['node_modules/@beemvp/beeui-tokens/tokens.json'],
  usesDtcg: true,
  preprocessors: ['beeui/resolve-refs'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/',
      files: [{ destination: 'beeui-tokens.css', format: 'css/variables' }],
    },
  },
});

await sd.buildAllPlatforms();
```

Style Dictionary's current `css` transform group already understands DTCG dimension (`{ value, unit }`) and color (`{ colorSpace, components, hex }`) `$value` shapes; consult Style Dictionary's own token-type documentation if you target a platform (Swift, Kotlin, Android XML, …) or an older Style Dictionary version with different built-in transforms.

### 4. Keep the private/public boundary

`$extensions["com.beeui"].privateTokenGroups` names `primitives` as authoring-only, never a component or design-tool API (same rule reusable BeeUI components follow). Drop it in the same preprocessor before publishing tokens to a wider audience:

```js
// inside resolveRefs's caller, after resolving references:
delete dictionary.primitives;
```

### What this example is, and is not

- It **transforms** the canonical file at build time inside the consumer's own project; it never copies `packages/tokens/tokens.json` into a second maintained file. Bumping the installed `@beemvp/beeui-tokens` version is the only step needed to pick up new or changed tokens.
- It is illustrative documentation, not a BeeUI-maintained integration. BeeUI ships and tests no `style-dictionary` config, and this example is not exercised by BeeUI's own CI.

## Tokens Studio / Figma handoff

Tokens Studio (the Figma plugin) and similar design tools can import `tokens.json` directly as a read source. This section describes the **import/export workflow**: what design-tool concepts BeeUI's fields map to, and what does not carry over automatically.

### Field mapping

| BeeUI / DTCG concept | Design-tool concept | Notes |
| --- | --- | --- |
| `$type` | Token type (color, spacing, sizing, borderRadius, boxShadow, fontFamilies, …) | DTCG's `$type` vocabulary is coarser than some tools' own categories (for example DTCG's single `dimension` type covers what a tool may split into spacing/sizing/border-radius categories). Map by token group, not by a strict 1:1 type name. |
| `$value` | Token value | Structured DTCG values (dimension objects, sRGB color objects, `cubicBezier` easing arrays, `shadow` objects) usually need the tool's own DTCG-aware import path rather than a plain-string paste. |
| `$ref` (JSON Pointer) | Alias / reference | Most design-tool alias engines historically use curly-brace strings (`{color.primary}`), the same as Style Dictionary. If the installed tool version does not yet resolve DTCG 2025.10 `$ref` pointers on import, apply the same pre-resolution technique from the Style Dictionary example before importing — the alias still traces back to `primitives` in the canonical source; only the design tool's copy is flattened. |
| `$description` | Token description | Carries over directly where the tool supports per-token descriptions. |
| `$extensions["com.beeui"].privateTokenGroups` (`primitives`) | "Internal only" / excluded token set | Import `primitives` only if the tool needs it to resolve aliases locally; do not publish it as a usable Figma style or variable. Only semantic groups (`colors`, `chart`, spacing, typography, motion, …) should become designer-facing styles. |
| `tokens.resolver.json`'s `modifiers.runtimeTheme.contexts` (`light`, `dark`, `violet-light`, `violet-dark`, `high-contrast-light`, `high-contrast-dark`) | Design-tool "themes" / theme-switchable variable sets | Conceptually analogous to a Tokens Studio theme per runtime-theme name, each layering the shared foundation set with one `themes.<name>.colors` + `themes.<name>.chart` context (see [Accessibility (high-contrast) theme path — #77](./theming.md#accessibility-high-contrast-theme-path--77) and [Data-visualization (chart) tokens — #78](./theming.md#data-visualization-chart-tokens--78)). BeeUI does not ship a ready-made Tokens Studio theme configuration file; a design team wires up one theme per runtime-theme name against this same resolver document. |

### Workflow

1. **Export from BeeUI.** Fetch the published `@beemvp/beeui-tokens/tokens.json` (and `tokens.resolver.json` if the tool consumes DTCG Resolver documents) from the installed package version — via the npm registry or a checkout of this repository. Import it into the design tool's JSON import feature, or point a one-way GitHub sync at `packages/tokens/tokens.json`.
2. **Review in the tool.** The design tool renders BeeUI's semantic groups (colors, chart, spacing, typography, motion, …) as browsable tokens/variables. Exclude `primitives` from anything published as a usable style.
3. **Apply in design work.** Designers use the imported values/variables in Figma exactly like any other token source.
4. **Propose, don't sync.** A designer may change a value or suggest a new token inside the tool. That is a **proposal**, not an update to BeeUI — see [Round-trip ownership and non-goals](#round-trip-ownership-and-non-goals) for what happens next.

### Non-goal: no live sync

Some design tools offer an automatic two-way GitHub sync (writing commits back to a repository on save). BeeUI does not configure or support that mode for this repository. Use import/export in one direction only — design tool pulls from the published artifact — and route every proposed change back through the ordinary review workflow below.

## Round-trip ownership and non-goals

`packages/tokens/tokens.json` is the only authored token file in BeeUI. Everything this document describes consuming — the canonical file itself, `tokens.resolver.json`, and anything a Style Dictionary build or a design tool derives from either — is downstream of it, never the reverse.

### Workflow

1. **Consume.** A Style Dictionary build or a design-tool import reads the published `@beemvp/beeui-tokens/tokens.json` / `tokens.resolver.json`.
2. **Propose.** A designer changes a value in Tokens Studio, or an integrator requests a new token or alias while wiring up Style Dictionary.
3. **Return through the canonical source.** Someone edits `packages/tokens/tokens.json` by hand to carry the proposal forward — never by exporting a design tool's own file format over the canonical source, and never by hand-editing a generated artifact.
4. **Regenerate.** `pnpm tokens:generate` recomputes every derived artifact (`packages/tokens/src/index.ts`, `packages/tokens/src/theme.css`, `packages/tokens/src/tokens.resolver.json`, `packages/tokens/src/lifecycle.json`) from the edited canonical source.
5. **Review.** The change goes through the same gates as any other token edit — `pnpm tokens:check`, DTCG schema validation, and BeeUI's own contrast/completeness/alias-graph validation — described in [Extending BeeUI tokens](./theming.md#extending-beeui-tokens).
6. **Publish.** Once merged, the next `@beemvp/beeui-tokens` release carries the change back out to every external consumer of this document.

### Non-goals (restated from issue #80)

- **No bidirectional or live sync.** Every external tool covered by this document is read-only against the published artifact unless a person deliberately re-authors `packages/tokens/tokens.json` and runs it through the workflow above.
- **No design-tool source of truth.** Figma, Tokens Studio, and Style Dictionary are never authoritative. `packages/tokens/tokens.json` is.
- **Generated artifacts are never hand-authored** — not by a person, and not by exporting a design tool's file over them. `packages/tokens/src/index.ts`, `packages/tokens/src/theme.css`, `packages/tokens/src/tokens.resolver.json`, and `packages/tokens/src/lifecycle.json` exist only as `pnpm tokens:generate` output.
- **No new runtime dependency, and no SaaS token-management platform.** Every example in this document runs inside a consumer's own project or design-tool session, never inside BeeUI's runtime bundle or this repository's CI.
