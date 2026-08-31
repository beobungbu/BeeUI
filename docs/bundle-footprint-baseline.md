# Bundle & package footprint baseline (#183, R5.5)

Methodology: `docs/benchmark-harness.md#bundle--package-footprint-baseline-r55-183`.
Reproduce with `pnpm bench:footprint` (writes
`.artifacts/benchmark/footprint-<sha>.json`, gitignored; this file is the
committed, human-readable snapshot).

This supersedes the earlier `feat/183-footprint-baseline` draft (PR #346),
which measured the pre-distribution layout (raw `.ts`/`.tsx` source aliased
directly, no `dist/`, packages still `"private": true`) and was blocked
pending #200. #200 has since landed on `main`: `packages/{core,tokens,ui}`
build a real `dist/` (dual ESM `module` + CJS `commonjs` + `.d.ts` via
react-native-builder-bob) behind conditional `exports`, `private` is removed,
and `publishConfig` is public + provenance. Every number below is measured
against **that** real release-ready layout.

Base commit: `f385b3fb9a1e` (`main`, before this PR's own commits).
Environment: Node v24.13.1, pnpm 10.15.0, darwin/arm64.

Updated at `7aeaf75370ba` (#202/#203/#204, R7.6-R7.8): the packed-inventory
audit in `pnpm release:verify` found and fixed a real leak —
`react-native-builder-bob`'s `module`/`commonjs` babel targets were also
compiling `@beeui/ui`'s hand-written ambient `.d.ts` type shims (they match
the same `*.ts` glob), producing 20 dead `.d.js`/`.d.js.map` files with no
consumer. `packages/ui/scripts/copy-type-shims.mjs` now prunes them after
every build. Each package also gained a `README.md` (+1 packed file each; npm
always includes it regardless of the `files` allowlist). Net for `@beeui/ui`:
824 → 805 files. The table below reflects the corrected, audited packed
contents.

## 1. Packed tarball sizes (`npm pack --dry-run`, real `dist/` + `src/`)

| Package | Packed (gzip) | Unpacked | Files |
| --- | ---: | ---: | ---: |
| `@beeui/core` | 25.8 KiB | 147.1 KiB | 52 |
| `@beeui/tokens` | 98.0 KiB | 546.5 KiB | 62 |
| `@beeui/ui` | 501.6 KiB | 2.98 MiB | 805 |

Every package now ships **three** copies of its source tree in the tarball —
`dist/module` (ESM), `dist/commonjs` (CJS), `dist/typescript` (`.d.ts` +
sourcemaps for both), plus `src` (kept for the Registry/`beeui add`
source-ownership path and Metro/uniwind `@source` scanning, per ADR-011 D2/D4)
— which is why `@beeui/ui`'s file count (824) and unpacked size (2.94 MiB) are
large in absolute terms: this is the honest cost of shipping dual
module-format built output *and* source side by side, not bloat from any
single format. The **packed (gzip)** column is the number that matters for
"what does `npm install` actually download," and gzip collapses the
duplication across formats substantially (each `.js`/`.d.ts` variant of the
same component compresses similarly).

Largest files packed today:

- `@beeui/tokens`: `tokens.json` (64.1 KB raw), `dist/typescript/module/index.d.ts` (52.5 KB), `dist/typescript/commonjs/index.d.ts` (52.4 KB), `src/index.ts` (44.1 KB).
- `@beeui/ui`: `src/components/overlay-runtime.tsx` (40.5 KB), `dist/commonjs/components/overlay-runtime.js` (35.8 KB), `dist/module/components/overlay-runtime.js` (34.0 KB), `src/components/select.tsx` (30.7 KB).

`overlay-runtime` and `tokens`' own `index`/`token-reader` are the largest
single owned files in both the tarball and the bundle scenarios below — they
are the anchored-overlay/positioning engine and the full token registry, both
genuinely shared foundation code rather than an accident.

## 2. Clean-consumer bundle contribution (esbuild proxy over real `dist/module`, peers externalized)

Every `peerDependency` of `@beeui/ui` (react/react-dom/react-native and every
optional native peer: `@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`,
`react-native-gesture-handler`, `react-native-reanimated`,
`react-native-safe-area-context`, `react-native-teleport`,
`react-native-worklets`, `tailwindcss`, `uniwind`) is marked external in every
scenario, so these bytes are what `@beeui/ui` (+ `@beeui/core` + `@beeui/tokens`,
always bundled alongside it today) contributes on top of what the consumer's
app already ships. Entry points alias `@beeui/*` straight to the real built
`dist/module/index.js` — see the methodology doc for why that is a faithful,
not approximated, target.

| Scenario | Platform | Raw (min) | Gzip | Externals referenced |
| --- | --- | ---: | ---: | --- |
| `full-barrel` | web | 176.5 KiB | 52.3 KiB | react, react-dom, react-native, react-native-safe-area-context, uniwind |
| `single-component-via-barrel` (Button, through today's only export) | web | 172.3 KiB | 50.8 KiB | same as full-barrel |
| `single-component-direct` (Button, hypothetical direct dist import) | web | 31.5 KiB | 10.2 KiB | react, react-native |
| `core-tokens-baseline` (`@beeui/core`+`@beeui/tokens` alone) | web | 53.0 KiB | 17.0 KiB | none |
| `sheet-direct` | web | 52.9 KiB | 17.6 KiB | react, react-dom, react-native, react-native-safe-area-context |
| `table-direct` | web | 33.9 KiB | 11.0 KiB | react, react-native |
| `date-controls-direct` (Calendar+DatePicker+DateTimePicker) | web | 74.3 KiB | 23.7 KiB | react, react-dom, react-native, react-native-safe-area-context |
| `full-barrel` | native-priority proxy | 171.4 KiB | 51.0 KiB | + `@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`, `react-native-reanimated`, `react-native-teleport`, `uniwind` |
| `button-direct` | native-priority proxy | 31.5 KiB | 10.2 KiB | react, react-native |
| `sheet-direct` | native-priority proxy | 48.8 KiB | 16.4 KiB | + `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-teleport`, `react-native-safe-area-context` |

"Native-priority proxy" = the same esbuild bundle, but extensionless imports
resolve `*.native.js` first (mirroring Metro's platform-file convention) —
**not a real Metro build**; see the methodology doc's evidence-class note. A
byte-for-byte real Metro/Vite number for an actual npm-installed clean
consumer is out of this script's scope by design (that is
`scripts/verify-bare-consumer.sh` / `scripts/verify-web-consumer.sh`'s
compile-succeeds job, ADR-011); this baseline is the comparative-bytes number.

## Findings that matter for #184 (main-barrel vs granular subpath exports)

- **The barrel still gives near-zero tree-shaking even against real built
  output.** `full-barrel` (176.5 KiB) and `single-component-via-barrel`
  (172.3 KiB) are within 2.4% of each other on Web — importing only `Button`
  through today's one `"."` export pulls essentially the entire component
  library, because nothing prunes the barrel's ~90 other named re-exports.
- **The granular-import upside is real, large, and now backed by real built
  bytes (not a source estimate).** `single-component-direct` — bundling
  `dist/module/components/button.js` directly, bypassing the barrel — is
  10.2 KiB gzip vs. 50.8 KiB gzip through the barrel: an **~80% reduction**
  for a Button-only consumer. `table-direct` (11.0 KiB) and
  `sheet-direct` (17.6 KiB web / 16.4 KiB native) tell the same story at
  different component weights. This is direct, reproducible evidence for
  #184's subpath-export decision: today's public `exports` map (`.` and
  `./package.json` only) is the single biggest lever left on the table for
  reducing a typical consumer's footprint.
- **Sheet's optional native dependency is correctly isolated.** On Web,
  `sheet-direct`'s externals never include `@gorhom/bottom-sheet` or
  `react-native-reanimated` (Web resolves `sheet.web.js`, which does not
  import them). On the native-priority proxy, `sheet-direct` does reference
  `@gorhom/bottom-sheet` + `react-native-reanimated` + `react-native-teleport`
  as externals — peer cost, not bundled BeeUI code — exactly the
  "optional Sheet dependency impact, separated from BeeUI-owned source" #183
  asks for.
- **Table and the date controls stay lean on their own.** `table-direct`
  (11.0 KiB gzip) and the combined `date-controls-direct`
  (Calendar+DatePicker+DateTimePicker, 23.7 KiB gzip) are both far below the
  barrel's 50.8 KiB for a single component, confirming none of these three
  individually pulls in unexpected weight.
- **`tailwind-merge` is the dominant, and only non-trivial, third-party
  dependency — and it is not peer-suppliable.** Across every scenario the
  bundled non-peer dependency set is stable: `class-variance-authority`
  (3.0 KB), `clsx` (0.4 KB), and `tailwind-merge` (105.6 KB pre-minify input,
  the largest single third-party input in the whole baseline). These are
  `@beeui/core`'s only real `dependencies` (not peers), so every scenario that
  touches `cn()` — which is nearly all of them, including `button-direct`
  and `table-direct` — pays `tailwind-merge`'s tree-shaken/minified share.
  This is not "accidental" (it is a declared, necessary dependency of the
  className-merge utility every component uses) but it is the one real
  transitive-size lever inside BeeUI's own dependency graph, worth flagging
  for anyone auditing `@beeui/core`'s footprint independent of peer cost.
- **No other accidental large transitive imports or assets were found.** The
  bundled third-party-dependency input bytes are the same
  ~105.9–109.0 KB set (`class-variance-authority` + `clsx` + `tailwind-merge`)
  across every scenario that reaches `@beeui/core`; nothing else — no
  unexpected polyfill, no accidentally-bundled dev tooling, no stray asset —
  gets pulled in.

## Separate: what's NOT measured here (by design)

- **A real Metro/Vite/webpack build for a clean, npm-installed consumer.**
  `scripts/verify-bare-consumer.sh` and `scripts/verify-web-consumer.sh`
  already prove those consumers compile and run against the packed tarballs
  (ADR-011's centralized-consumption evidence); adding a byte-count assertion
  there is a natural follow-up but is out of this issue's scope (measurement
  via the benchmark harness, not the release CI consumer scripts).
- **CJS (`dist/commonjs`) bundle bytes.** ESM is the primary/default condition
  (ADR-011 D3); CJS exists for interop only and every scenario above resolves
  through `dist/module`, matching what a modern bundler's `import`/`browser`/
  `react-native` conditions actually pick.
