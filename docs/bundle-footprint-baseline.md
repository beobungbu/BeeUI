# Bundle & package footprint baseline (#183, R5.5)

Methodology: `docs/benchmark-harness.md#bundle--package-footprint-baseline-r55-183`.
Reproduce with `pnpm bench:footprint` (writes
`.artifacts/benchmark/footprint-<sha>.json`, gitignored; this file is the
committed, human-readable snapshot).

## Status: pre-distribution baseline, not the final #183 number

Per `docs/roadmap.md`'s package/performance chain
(`#197 → #198 → (#199 + #200) → #183 → #184 → ...`) and #183's own "Sequence
rule", this measurement is meant to run against the release-ready package
layout once the distribution ADR (#197), package name reservation (#198),
package metadata (#199) and package output format (#200) land. **As of this
baseline, #197/#198/#199/#200 are all still open on `main`.** Every number
below is measured against today's actual, real, un-built source layout
(`exports` pointing straight at `src/*.ts(x)`, `"private": true`, no
`sideEffects` field) — real and reproducible, and already enough to make
#184's granular-subpath-export decision, but **not** the final release-ready
baseline #183's own DoD asks for. Re-run `pnpm bench:footprint` once #200
lands and replace the tables below.

Base commit: `54befe75f566` (`main`, before this PR's own commits).

## 1. Packed tarball sizes (`npm pack --dry-run`, today's source layout)

| Package | Packed (gzip) | Unpacked | Files |
| --- | ---: | ---: | ---: |
| `@beeui/core` | 6.9 KiB | 24.8 KiB | 6 |
| `@beeui/tokens` | 33.5 KiB | 155.0 KiB | 10 |
| `@beeui/ui` | 126.3 KiB | 554.5 KiB | 93 |

Largest files packed today:

- `@beeui/tokens`: `tokens.json` (64.1 KB), `src/index.ts` (44.1 KB), `src/theme.css` (13.9 KB).
- `@beeui/ui`: `src/components/overlay-runtime.tsx` (40.5 KB), `src/components/select.tsx` (30.7 KB), `src/components/sheet.web.tsx` (29.0 KB), `src/components/dropdown-menu.tsx` (26.8 KB), `src/components/sheet.native.tsx` (26.1 KB).

`@beeui/ui`'s 93 packed files are pure `src/*.ts(x)` — there is no `dist/`
build output yet (#200), so this is the whole TypeScript source tree, not a
minified/compiled artifact.

## 2. Clean-consumer bundle contribution (esbuild proxy, peers externalized)

Every `peerDependency` of `@beeui/ui` (react/react-dom/react-native and every
optional native peer) is marked external in every scenario, so these bytes
are what `@beeui/ui` (+ `@beeui/core` + `@beeui/tokens`, always bundled
alongside it today) contributes on top of what the consumer's app already
ships.

| Scenario | Platform | Raw (min) | Gzip | Externals referenced |
| --- | --- | ---: | ---: | --- |
| `full-barrel` | web | 175.4 KiB | 52.1 KiB | react, react-dom, react-native, react-native-safe-area-context, uniwind |
| `single-component-via-barrel` (Button, through today's only export) | web | 171.2 KiB | 50.4 KiB | same as full-barrel |
| `single-component-direct` (Button, hypothetical direct import) | web | 31.5 KiB | 10.2 KiB | react, react-native |
| `core-tokens-baseline` (`@beeui/core`+`@beeui/tokens` alone) | web | 53.0 KiB | 17.0 KiB | none |
| `sheet-direct` | web | 53.0 KiB | 17.6 KiB | react, react-dom, react-native, react-native-safe-area-context |
| `table-direct` | web | 33.6 KiB | 11.0 KiB | react, react-native |
| `date-controls-direct` (Calendar+DatePicker+DateTimePicker) | web | 74.3 KiB | 23.7 KiB | react, react-dom, react-native, react-native-safe-area-context |
| `full-barrel` | native-priority proxy | 170.5 KiB | 50.8 KiB | + `@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`, `react-native-reanimated`, `react-native-teleport`, `uniwind` |
| `button-direct` | native-priority proxy | 31.5 KiB | 10.2 KiB | react, react-native |
| `sheet-direct` | native-priority proxy | 48.8 KiB | 16.4 KiB | + `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-teleport`, `react-native-safe-area-context` |

"Native-priority proxy" = the same esbuild bundle, but extensionless imports
resolve `*.native.tsx` first (mirroring Metro's platform-file convention).
**This is not a real Metro build** — see the methodology doc's evidence-class
note. A real Metro Web export of the full `apps/showcase` kitchen-sink app
(760 modules — every gallery/pattern screen, not a clean consumer) was run as
a bundle/compile-evidence anchor: `expo export --platform web` produced a
1.29 MiB raw / 338.8 KiB gzip JS bundle plus a 44.7 KiB raw / 8.5 KiB gzip CSS
bundle. That number is not comparable to the clean-consumer scenarios above
(it is the whole app, including React/react-native-web/uniwind/tailwind
runtime and every demo screen) — it is recorded here only as one genuine,
non-fabricated bundle/compile data point for this baseline's SHA.

### Findings that matter for #184

- **The barrel gives zero tree-shaking today.** `full-barrel` (175.4 KiB) and
  `single-component-via-barrel` (171.2 KiB) are within 3% of each other on
  Web, because neither `@beeui/core`, `@beeui/tokens` nor `@beeui/ui`
  declares `"sideEffects": false` — a bundler cannot prove the other ~90
  components are safe to drop when only `Button` is imported through the one
  existing `"."` export.
- **The granular-import upside is real and large.** `single-component-direct`
  (bypassing the barrel entirely) is 31.5 KiB vs. 171.2 KiB through the
  barrel — an ~82% reduction for a Button-only consumer. This is direct
  evidence for #184's subpath-export decision.
- **Sheet's optional native dependency is correctly isolated today.** On Web,
  `sheet-direct`'s externals never include `@gorhom/bottom-sheet` or
  `react-native-reanimated` (Web resolves `sheet.web.tsx`, which does not
  import them). On the native-priority proxy, `sheet-direct` does reference
  `@gorhom/bottom-sheet` + `react-native-reanimated` + `react-native-teleport`
  as externals (peer cost, not bundled BeeUI code) — exactly the
  "optional Sheet dependency impact, separated from BeeUI-owned source" #183
  asks for.
- **No accidental large transitive imports were found.** Every scenario's
  bundled third-party-dependency bytes are stable at ~106–109 KB across
  scenarios (`class-variance-authority` + `clsx` + `tailwind-merge`, the
  packages' only real, non-peer `dependencies`) — nothing unexpected gets
  pulled in.
