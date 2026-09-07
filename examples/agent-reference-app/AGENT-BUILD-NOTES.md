# Agent build notes (#235)

This app was built to test a specific claim: **can a fresh coding agent build a
real BeeUI application using only BeeUI's AI-agent-facing context?** The context
treated as the sole spec was:

- [`llms.txt`](../../llms.txt), [`llms-full.txt`](../../llms-full.txt),
  [`llms-components.txt`](../../llms-components.txt),
  [`llms-patterns.txt`](../../llms-patterns.txt)
- [`docs/ai-agent-cookbook.md`](../../docs/ai-agent-cookbook.md)
- the source-ownership CLI surface those docs point to

This note records (1) what was buildable straight from those docs, and (2) the
**gap list** — everything that was needed but *not* discoverable from the AI docs
alone, which is the deliverable's value.

## Build context

- **Model / tool identity:** Claude (Anthropic) coding agent, BeeUI 1.0
  implementation agent session.
- **Base SHA:** `dad55a5e4b08d0142377829235d6498d43e356dc` (`main`).
- **Target:** Web (Vite 8 + react-native-web), Node 24.13.1 via nvm.
- **Consumption model:** centralized packages, consumed as real `pnpm pack`
  tarballs (BeeUI is unpublished — no npm install possible).
- **No hidden maintainer corrections** were applied to the app before its first
  clean build; the friction below is what an unaided agent actually hits.

## What the AI docs got right (buildable with no outside knowledge)

These were fully and correctly specified by the llms family + cookbook, and the
app relies on them exactly as documented:

- **Unpublished-status rules.** The STATUS banner on every llms file and cookbook
  §1 made it unambiguous that `npm install @beemvp/beeui-ui` is wrong today, and
  that package names are *targets*. The app honestly consumes tarballs and says so.
- **Provider + safe-area shell.** `BeeUIProvider` wrapping `Screen` / `AppHeader`
  is stated in llms-full §"Provider and safe-area setup" and cookbook §5.
- **The component inventory.** `llms-components.txt` is an accurate name → symbol
  map; every import in `src/App.tsx` came from it (e.g. `Field`, `Select`,
  `SegmentedControl`, `AlertDialog*`, `Table*`, `Calendar`, `useToast`,
  `Stat*`, `Badge`, `DescriptionList`).
- **Ownership boundaries.** Cookbook §6 + ADR-007/008 correctly told the app to
  keep Table rows/sort/selection caller-owned and to own date formatting
  (`Calendar` returns a plain `{ year, month, day }`).
- **Web theme import.** `@import '@beemvp/beeui-tokens/theme.css'` (llms.txt Install)
  is correct and sufficient for the semantic tokens.
- **Composition guidance.** llms-patterns "compose primitives, keep domain
  composition local" shaped the whole app (the domain model lives in the app).

## Gap list (what the AI docs should add)

Ordered by how much each blocked progress. G1–G3 are the ones an agent cannot get
past without leaving the AI docs.

### G1 — No Web build/bundler recipe (blocking)

llms.txt says to `@import` the theme CSS and llms-full points to
`docs/compatibility-matrix.md` for versions, but **nothing in the llms family or
cookbook tells you how to actually bundle a Web app**: that you need
`vite-plugin-rnw` (to resolve `react-native` → `react-native-web`),
`@tailwindcss/vite`, and the `uniwind/vite` plugin, nor that `global.css` must
`@import 'tailwindcss'` + `@import 'uniwind'` and declare
`@source '.../@beemvp/beeui-ui/src'` so Tailwind/Uniwind statically discover the
utility classes BeeUI emits. Without the `@source` globs the app builds but ships
**unstyled**. This had to be reconstructed from `examples/web-consumer` and the
compatibility matrix.
*Suggested fix:* add a short "Web bundling (Vite + react-native-web)" block to
`llms-full.txt` (or a linked getting-started/web snippet) covering the plugin
stack and the `@source`/`@import` `global.css` contract.

### G2 — No standalone-consumer install path while unpublished (blocking)

The cookbook is emphatic that npm install is wrong and that source-ownership
`pnpm beeui add` is the working path — but source ownership copies files into an
*existing* consumer and still needs `@beemvp/beeui-tokens` (a package). For a
**new, standalone external app** that wants the centralized-package model, the AI
docs offer no working mechanism: the `pnpm pack` → `file:*.tgz` → `npm install`
approach (the only thing that actually works today, and what CI's
`verify-web-consumer.sh` does) is documented **only in `examples/README.md`**,
which is not part of the AI-agent context set.
*Suggested fix:* add a "Consuming the packages before release (pnpm pack
tarballs)" subsection to `llms-full.txt` §"Consumption models", so the
package-model path is reachable from the AI docs, not just the examples README.

### G3 — Runtime theme-switching API is undocumented for agents (blocking a required feature)

#235 requires theme switching. The cookbook (§5, Recipe F) says brand/density live
in tokens and to `@import` the theme, and mentions `BeeThemeScope` for subtree
theming — but the **app-level** switch is `Uniwind.setTheme('light' | 'dark')`
plus `useUniwind()`, from the `uniwind` package. That API appears only in
`packages/ui/src/components/theme-scope.tsx` prose and the Showcase, neither of
which is in the AI-agent context. An agent building runtime light/dark from the
llms docs alone cannot find it.
*Suggested fix:* document the app-owned `Uniwind.setTheme` / `useUniwind` pattern
(and the `light`/`dark` runtime-theme names from `@beemvp/beeui-tokens`
`beeRuntimeThemeNames`) in cookbook Recipe F, alongside the existing
`BeeThemeScope` guidance.

### G4 — DatePicker/DateTimePicker being native-only isn't called out (misleading for Web)

#235's minimum list names DatePicker/DateTimePicker. `llms-components.txt` lists
them with source `date-picker.native.tsx` and notes platform-split modules resolve
`*.web.tsx`/`*.native.tsx`, but there is **no `date-picker.web.tsx`** — these are
native-only (system pickers via `@react-native-community/datetimepicker`). A Web
agent will import `DatePicker`, get nothing usable, and only learn why by reading
source. The app uses `Calendar` (which is cross-platform) instead.
*Suggested fix:* mark native-only modules explicitly in `llms-components.txt`
(e.g. a "native-only" tag on `date-picker` / `date-time-picker`), and state in the
Web notes that `Calendar` is the cross-platform date primitive.

### G5 — `Field` composition shape is under-specified (minor)

Cookbook Recipe B says `Field` "composes label/description/error", but not that
`Field` takes `label` / `description` / `error` as **props** and the control as its
single child, nor that `DescriptionItem` takes `label`/`value` props (not
children). This is inferable but cost a couple of iterations.
*Suggested fix:* one concrete `<Field label=… ><Input …/></Field>` snippet in
Recipe B would remove the ambiguity.

## Contract/generator changes made

The gaps above are documentation-shaped and were left as recommendations rather
than patched here, to keep this PR scoped to `examples/**` per the task
constraints (no `packages/*`, registry, component source, or CLI edits). None of
the AI-contract-guarded files (`llms*.txt`, `docs/ai-agent-cookbook.md`) were
modified, so `pnpm llms:check` / `pnpm ai-contract:check` remain green unchanged.

## Acceptance evidence

Node: v24.13.1 (nvm). From the repo root, `pnpm build` (package dist), then in
`examples/agent-reference-app/`:

```
$ bash setup.sh
==> Packing @beemvp/beeui-core, @beemvp/beeui-tokens, @beemvp/beeui-ui through the package boundary
==> Installing BeeUI tarballs and Web runtime/tooling dependencies (npm, no monorepo/pnpm fallback)
==> Setup complete. Run: npm run build

$ npm run build
vite v8.2.2 building client environment for production...
✓ 568 modules transformed.
dist/index.html                   0.41 kB │ gzip:   0.27 kB
dist/assets/index-7_H_grO0.css   35.91 kB │ gzip:   7.16 kB
dist/assets/index-Bh_lUHbz.js   584.96 kB │ gzip: 182.10 kB
✓ built in 817ms
```

The 35.91 kB CSS bundle (the same size the `web-consumer` starter emits) confirms
Tailwind/Uniwind discovered BeeUI's semantic utility classes through the
`@source` globs in `global.css` — i.e. the app ships **styled**, not just built.
The one build warning (chunk > 500 kB) is informational, not an error.

