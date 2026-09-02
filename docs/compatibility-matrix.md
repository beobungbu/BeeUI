# BeeUI 1.0 Compatibility Support Matrix

> **Status:** Candidate — locked as the shared-authority baseline for R2 (#129, parent
> [#114](https://github.com/beobungbu/BeeUI/issues/114)).
> **Snapshot:** 2026-09-02
> **Authority:** This file is the single canonical source for BeeUI 1.0
> dependency/runtime compatibility. `docs/roadmap.md`, `docs/registry-cli.md`, package
> manifests and CI must not diverge from it without updating this file in the same
> change. Row-level verification/execution is delegated to the R2 child issues listed
> below; this issue (#129) locks the candidate scope and rule, it does not itself widen
> any published peer range.

## Rule (from #129)

> If a combination cannot be tested, narrow the public promise instead of documenting
> hope.

Every row below states the **strongest evidence class actually obtained**
(`docs/beeui-1.0-evidence-classes.md`), never an aspirational one. Where the evidence is
weaker than an existing declared `peerDependencies`/`engines` range, that gap is called
out explicitly and assigned to the R2 issue responsible for resolving it — this document
does not change any peer range itself.

## How this matrix is kept honest

`scripts/check-compatibility-matrix.mjs` (run via `pnpm compat:check`, part of
`pnpm typecheck` and therefore of CI's `Typecheck` step) parses the exact pinned/tested
versions out of `package.json`, `.nvmrc`, the active version-pinned GitHub Actions
workflows, `packages/ui/package.json` and `apps/showcase/package.json`, and fails if they
drift from the machine-readable block at the bottom of this file. Declared
`peerDependencies` *ranges* (the aspirational public promise) are intentionally **not**
duplicated in that block — package manifests remain the single authority for the promise
itself; this file and its check only guard the *tested-version* facts a reader relies on
to judge whether that promise is justified.

## Matrix

| Dependency | Tested / pinned today | Evidence class | Declared public peer promise | Verdict | Owning R2 issue |
| --- | --- | --- | --- | --- | --- |
| React | `19.2.3` exact (repo dev + Showcase) | Bundle/compile + deterministic contract (Jest, tsc, Metro/Web/Android/iOS export) | `>=19 <20` in `packages/ui/package.json` | **Decided (#133)**: only the `19.x` line has ever been exercised, so the public range is capped at `<20` — no accidental React 20 promise. | [#133](https://github.com/beobungbu/BeeUI/issues/133) React/ReactDOM major caps |
| React DOM (optional) | `19.2.3` exact, rendered via `react-native-web` in the Showcase's Web Metro export | Bundle/compile evidence (Web export in `ci.yml`) plus browser interaction evidence for the rendered surfaces covered by `web-a11y`/`visual-web` (Playwright, Chromium only) | `>=19 <20`, `optional: true` | **Decided (#133)**: capped alongside React; kept optional and coupled 1:1 to the React row. | [#133](https://github.com/beobungbu/BeeUI/issues/133) |
| `react-native-web` | `0.21.0` exact, `apps/showcase/package.json` (Expo's Web export) and the independent Vite consumer `scripts/verify-web-consumer.sh` pins the identical version | Bundle/compile evidence (Expo `web` export in `ci.yml`, `vite build` in `web-consumer.yml`) + browser interaction evidence (Playwright/axe against both the Showcase Web export — `web-a11y`/`visual-web` — and the independent Vite consumer — `web-consumer.yml`), all real Chromium only | Not declared as an `@beemvp/beeui-ui` `peerDependencies` entry (the package peers on `react-native`, not `react-native-web`; a Web bundler is responsible for aliasing `react-native` to `react-native-web` itself — see the Web support contract below) | **Confirmed**: `0.21.0` is the only version this repo builds or tests against, through two independently wired bundlers (Expo/Metro and Vite). | [#136](https://github.com/beobungbu/BeeUI/issues/136) Web support contract |
| React Native — minimum candidate | `0.85` is **not present anywhere** in the lockfile, CI matrix, or Showcase; the lowest version this repo has ever built/tested is `0.86.2` | None for `0.85.x` (no evidence class obtained) | `>=0.86.0 <0.87.0` in `packages/ui/package.json` and `docs/registry-cli.md` | **Decided (#132)**: `0.85` is dropped from the stable peer promise; the floor is raised to `0.86.0`, the lowest version this repo actually builds/tests. Re-adding `0.85` requires a real consumer need plus a full compatibility row. | [#132](https://github.com/beobungbu/BeeUI/issues/132) RN 0.85 decision, [#130](https://github.com/beobungbu/BeeUI/issues/130) RN 0.86 row |
| React Native — 0.86.x (repo current) | `0.86.2` exact, pinned in `packages/ui/package.json` devDependencies, `apps/showcase/package.json`, and exercised through Metro/Web/Android/iOS bundling plus native compile (`ci.yml`) and Maestro simulator/emulator smoke (`runtime-native.yml`); the true bare-consumer path (`scripts/verify-bare-consumer.sh`, RN CLI `init` outside the monorepo, package-tarball install, strict-`tsconfig` template, Metro Android/iOS bundling, `Prebuild`-free bare Android/iOS native compile, overlay/provider/token smoke via `App.tsx`'s `BeeUIProvider`/`Dialog`/`Checkbox`/`ChipGroup` fixture) proves this row reproduces outside the workspace | Native runtime evidence (iOS Simulator/Android Emulator smoke, Expo Showcase) + clean-consumer + bundle/compile evidence (bare RN consumer, `ci.yml` `bare-native`/`ios-native` jobs) | `>=0.86.0 <0.87.0` | **Decided/confirmed (#130)**: the RN 0.86 support claim is reproducible outside the monorepo (bare-consumer script) and wired into `ci.yml`'s package-boundary/native gates, which run on every native-sensitive PR and on push to `main`. | [#130](https://github.com/beobungbu/BeeUI/issues/130) RN 0.86 row |
| React Native — 0.87.x (historically tested and excluded) | `0.87.1` was exercised through the same bare-consumer path with an explicit out-of-range override. The retained evidence is run [33315274925](https://github.com/beobungbu/BeeUI/actions/runs/33315274925): iOS bare-consumer compile green; Android compile fails in `react-native-safe-area-context@5.7.0` with `Unresolved reference 'uiImplementation'`. | Historical bundle/compile evidence showing a **real upstream native incompatibility**, not a CI-plumbing gap. | `>=0.86.0 <0.87.0` (RN 0.87 is not promised) | **Decided/excluded (#131)**: RN 0.87 stays outside BeeUI 1.0. The dedicated continuous `compat-rn-0-87.yml` workflow was retired on 2026-09-02 because continuously compiling a deliberately unsupported combination added CI noise without strengthening the supported 1.0 contract. The historical evidence remains authoritative. Reintroduce a targeted compatibility run only when evaluating a peer-range expansion or after `react-native-safe-area-context` (or an equivalent) is proven compatible with RN 0.87. | [#131](https://github.com/beobungbu/BeeUI/issues/131) RN 0.87 row |
| Expo SDK | `~57.0.0` (`@expo/metro-runtime` `~57.0.12`), Xcode floor pinned to `26.4`+ specifically because "SDK 57 targets Xcode 26.6" (`ci.yml` comment) | Bundle/compile evidence (`expo export` for web/android/ios, `expo prebuild --clean`, iOS Simulator xcodebuild) + native runtime smoke | Not currently declared as a `peerDependencies` entry (Expo is a Showcase/app-level concern, not a `@beemvp/beeui-ui` peer) | **Confirmed**: SDK 57 is the only tested Expo line. No other SDK line exists anywhere in the repo. | Tracked implicitly with RN rows ([#130](https://github.com/beobungbu/BeeUI/issues/130)/[#131](https://github.com/beobungbu/BeeUI/issues/131)) |
| Node — repo/release toolchain | `24.13.1` exact, identical across root `package.json` `engines.node`, `.nvmrc`, and every active version-pinned GitHub Actions workflow; `.npmrc` sets `engine-strict=true` | Deterministic contract evidence (`Verify JavaScript toolchain` CI step asserts the exact version string) | `engines.node: "24.13.1"` (exact, not a range) | **Confirmed.** This is the one Node version the monorepo itself builds, tests and releases with. | N/A — already the strictest possible statement |
| Node — CLI tooling | Only `24.13.1` has ever run any BeeUI script in CI. No workflow, job, or test currently executes on Node `22.x`. The packed CLI now exists as a publication-ready `@beemvp/beeui-cli` artifact (`packages/cli`, #209): it packs, installs standalone, and its `beeui` bin runs end-to-end against a bundled registry snapshot (`pnpm release:verify`, `pnpm cli:smoke`); it declares `"engines": {"node": ">=24"}` and is not published to npm. `packages/cli/src/beeui.mjs` (shared by `scripts/beeui.mjs`) asserts a minimum Node major of `24` before running any command and fails with an actionable message otherwise (`scripts/__tests__/beeui.test.mjs`). | None obtained for Node 22 (no evidence class); deterministic contract evidence for the Node-24-only guard itself; `pnpm release:verify`/`pnpm cli:smoke` evidence for the packed artifact | No published CLI package yet; `docs/registry-cli.md` documents both `pnpm beeui -- add <item>` (repo-local) and the packed `@beemvp/beeui-cli` (#209) run inside this exact workspace | **Decided (#134)**: narrowed to Node 24 only rather than adding an untested Node 22 CI job — "Node 22+24 CLI tooling" stays a future candidate target, not a promise, per YAGNI (no consumer need demonstrated yet) and honesty (no CI evidence exists). The CLI now fails loudly with an actionable message on any Node major below 24 instead of failing obscurely deeper in the tool. Revisit if/when a Node 22 CI job is added. | [#134](https://github.com/beobungbu/BeeUI/issues/134) Node/tooling compatibility |
| Tailwind CSS | `4.3.3` exact, `apps/showcase/package.json` | Bundle/compile evidence (Web/Metro export) plus deterministic contract evidence for every required proof point in #135: theme CSS compile (`tokens:check`/`tokens:generate`), semantic utility resolution (`tokens:consumption-check`, `apps/showcase/__tests__/semantic-layer-tokens.test.tsx`), global/scoped theme switching (`apps/showcase/__tests__/issue-68-theme-scope.test.tsx`), runtime overrides (`apps/showcase/__tests__/theme-overrides-v3.test.tsx`), `useBeeToken`/`getBeeToken` (`apps/showcase/__tests__/issue-72-token-reader.test.tsx`), density/high-contrast (`apps/showcase/__tests__/theme-density-v3.test.tsx`, `theme-tokens-v3-high-contrast.test.tsx`) | `>=4 <5` in `packages/ui/package.json` and `docs/registry-cli.md` | **Decided/confirmed (#135)**: only the exact `4.3.3` point release is exercised, so the range stays capped at `>=4 <5` (the already-declared candidate); every required proof point above has deterministic test evidence at that exact version. No wider `4.x` claim is made. | [#135](https://github.com/beobungbu/BeeUI/issues/135) Uniwind/Tailwind tested range |
| Uniwind | `1.10.1` exact, `apps/showcase/package.json` (mocked via `__mocks__/uniwind.ts` in Jest, real in Metro/Web/native bundling) | Bundle/compile evidence for the real package; deterministic/mock evidence for unit tests covering the same #135 proof points as the Tailwind row (theme CSS, semantic utilities, global/scoped switching, runtime overrides, token accessors, density/high-contrast) | `>=1.10.1 <2` in `packages/ui/package.json` and `docs/registry-cli.md` | **Decided/confirmed (#135)**: only the exact floor version `1.10.1` is exercised; the declared range stays `>=1.10.1 <2` (matching the tested point, no wider claim) rather than being widened on unverified ground. | [#135](https://github.com/beobungbu/BeeUI/issues/135) |
| `react-native-safe-area-context` | `5.7.0` exact (`packages/ui` devDependency), `~5.7.0` (Showcase) | Bundle/compile + native runtime smoke evidence against RN `0.86.2`. **Fails Android bundle/compile evidence against RN `0.87.1`** (`Unresolved reference 'uiImplementation'` in `SafeAreaView.kt`) — see the RN 0.87 row above; this is the actual root cause of RN 0.87's exclusion, not an `@beemvp/beeui-ui` defect. | `>=5 <6` | **Confirmed candidate line for RN 0.86, narrow the spread**: the `5.x` major is a reasonable public promise (semver-disciplined library), but only the `5.7.x` minor has actually run, and only against RN `0.86.2` — it is not RN `0.87`-compatible as pinned today. | [#134](https://github.com/beobungbu/BeeUI/issues/134) (compatibility docs/CI wiring), [#131](https://github.com/beobungbu/BeeUI/issues/131) (RN 0.87 exclusion root cause), no dedicated row issue — flagged here for R2.2–R2.10 awareness |
| `react-native-teleport` | `1.1.13` exact (`packages/ui` devDependency), `~1.1.13` (Showcase); this is the overlay portal transport pinned explicitly in `scripts/verify-release.mjs`'s required packed-file list | Bundle/compile + native runtime smoke evidence (overlay/portal paths are exercised by Popover/DropdownMenu native runtime smoke) | `>=1.1 <2` | **Confirmed candidate line, narrow the spread**: only `1.1.13` is tested; the promise already correctly caps the pre-2.0 API surface (`1.1.x` per the issue title), which matches actual usage. | Flagged here for R2.2–R2.10 awareness; no dedicated tracking issue beyond #129's lock |
| `@react-native-community/datetimepicker` | `9.1.0` exact (`packages/ui` devDependency), `~9.1.0` (Showcase, added for the `DatePicker` gallery fixture, reused by `DateTimePicker`'s) | Deterministic contract evidence only (`tsc`, Jest with the module mocked via `jest.mock`, and the CLI's clean-consumer/transpile-smoke checks in `scripts/__tests__/beeui.test.mjs`) plus Web bundle/compile evidence (`expo export --platform web` never touches this native-only module, per the platform-file split). **No native (Android/iOS) bundle/compile evidence and no native runtime evidence were obtained** — this repo's sandbox has no Xcode/Android SDK available to run `expo prebuild`/native compile for this dependency, so `DatePicker`'s (`date-picker.native.tsx`) and `DateTimePicker`'s (`date-time-picker.native.tsx`) native presentations are honestly unverified beyond TypeScript-level correctness. | `>=9.1 <10`, `optional: true` (native-only; Web consumers never import it — isolated to `date-picker.native.tsx`/`date-time-picker.native.tsx` per the platform-file split) | **Narrow/unverified**: the declared range reflects the one version this repo has type-checked against, not a tested native-compile/runtime row. Native compile (Android/iOS) and simulator/emulator runtime proof that the OS picker opens, returns a value, and the `CalendarDate`/`ClockTime`⇄`Date` boundary does not shift day/time are owed to native runtime acceptance. `DateTimePicker` additionally owes native proof that Android's chained date-then-time dialog flow (no native `"datetime"` mode on Android) behaves correctly end-to-end. | [#176](https://github.com/beobungbu/BeeUI/issues/176)/[#177](https://github.com/beobungbu/BeeUI/issues/177) native a11y/runtime acceptance |
| `@gorhom/bottom-sheet` | `5.2.14` exact (`packages/ui` devDependency), `~5.2.14` (Showcase, added for the `Sheet` gallery fixture) | Deterministic contract evidence (`tsc`, Jest with the module mocked via `jest.mock`) plus CI `ios-native` bundle/compile evidence (real `pod install` + `xcodebuild` against the Showcase app, since adding this native dependency triggers that job's classifier). **No native (Android/iOS) runtime evidence obtained** — gesture/drag/snap-point completion, keyboard interaction, and VoiceOver/TalkBack focus-into-sheet require simulator/device proof this change does not claim. | `>=5.2 <6`, `optional: true` (native-only; Web consumers never import it — isolated to `sheet.native.tsx` per the platform-file split) | **Narrow/unverified beyond compile**: the declared range reflects the one version type-checked and native-compiled against. Real gesture/keyboard/Back-button/nested-scroll/reduced-motion runtime proof is owed to #160 (dedicated native runtime acceptance per ADR-006). | [ADR-006](decisions/006-sheet-gesture-engine.md), [#160](https://github.com/beobungbu/BeeUI/issues/160) native runtime acceptance |
| `react-native-reanimated` | `4.5.1` exact (`packages/ui` devDependency), `~4.5.1` (Showcase); matches Expo SDK 57's own bundled pin (`expo@57.0.15`'s `bundledNativeModules.json`) | Deterministic contract evidence plus CI `ios-native` bundle/compile evidence; no dedicated BeeUI code calls its APIs directly — `@gorhom/bottom-sheet`'s own required peer | `>=4.5 <5`, `optional: true` | **Narrow/unverified beyond compile**: Reanimated v4 is a new major (worklets split into `react-native-worklets`); only the one Expo-SDK-matched version has run. Real gesture/animation runtime proof is owed to #160, same as `@gorhom/bottom-sheet`. | [ADR-006](decisions/006-sheet-gesture-engine.md), [#160](https://github.com/beobungbu/BeeUI/issues/160) |
| `react-native-gesture-handler` | `2.32.0` exact (`packages/ui` devDependency), `~2.32.0` (Showcase); matches Expo SDK 57's own bundled pin | Deterministic contract evidence plus CI `ios-native` bundle/compile evidence; `@gorhom/bottom-sheet`'s own required peer, no direct BeeUI API usage | `>=2.32 <3`, `optional: true` | **Narrow/unverified beyond compile**: real gesture-arbitration runtime proof (pan-down-to-close, nested `ScrollView`/`FlatList` inside the sheet) is owed to #160. | [ADR-006](decisions/006-sheet-gesture-engine.md), [#160](https://github.com/beobungbu/BeeUI/issues/160) |
| `react-native-worklets` | `0.10.1` exact (`packages/ui` devDependency), `~0.10.1` (Showcase); Reanimated v4's own required peer (its worklets runtime split out of `react-native-reanimated` starting with v4), not an independent BeeUI dependency decision — matches Expo SDK 57's own bundled pin | Deterministic contract evidence plus CI `ios-native` bundle/compile evidence; no direct BeeUI API usage | `>=0.10 <1`, `optional: true` | **Narrow/unverified beyond compile**: transitively required by `react-native-reanimated`; carries the same runtime-proof gap owed to #160. | [ADR-006](decisions/006-sheet-gesture-engine.md), [#160](https://github.com/beobungbu/BeeUI/issues/160) |

## Explicitly out of scope for this lock (deferred, not silently promised)

- **Web/browser engine matrix.** `web-a11y.yml`, `visual-web.yml`, and `web-consumer.yml`
  install and test **Chromium only** via Playwright. Firefox/WebKit are not exercised
  anywhere in this repository. BeeUI does not currently make any public claim about
  non-Chromium browsers — see the "Web support contract (#136)" section below for the
  full, proved boundary of this claim.
- **React Native 0.85**: decided and dropped from the promise (#132) rather than deferred —
  see the "React Native — minimum candidate" row above. **React Native 0.86** is decided and
  confirmed (#130). **React Native 0.87** is decided and **excluded** (#131): it was actually
  tested (not merely deferred) and fails a real bare-consumer Android compile because
  `react-native-safe-area-context@5.7.0` does not build against RN 0.87's native surface — see
  the RN 0.87 row above for the exact error and CI evidence. React Native **0.87+** stays
  outside the `<0.87.0` cap until that upstream/peer incompatibility is resolved and the same
  evidence is repeated green.
- **Node 22 CLI verification**: decided (#134) to narrow the promise to Node 24 only
  instead of adding an unproven CI job; no CI job exists yet. Revisit if a real Node 22
  requirement emerges.
- **Compatibility CI scheduling** ([#137](https://github.com/beobungbu/BeeUI/issues/137)):
  supported rows use weekly clean-environment backstops in addition to PR/main verification.
  `ci.yml` forces the full RN 0.86.2 compile graph weekly and on every push to `main`;
  `runtime-native.yml` runs simulator/emulator smoke on exact main plus weekly/manual/explicit
  runtime PRs; `web-consumer.yml` and `expo-consumer.yml` each run their independent consumer
  rows weekly when the repo is idle. RN 0.87 is intentionally excluded and no longer has a
  recurring workflow; its historical evidence is retained above and a targeted run should be
  reintroduced only when evaluating a support-range expansion.
- **Mechanically synchronized compatibility documentation** beyond this file's own
  drift check (e.g. generating package README compatibility tables from this file):
  owned by [#138](https://github.com/beobungbu/BeeUI/issues/138).

## Web support contract (#136)

This section is the final, bounded, reproducible 1.0 Web support promise, written after
every hard 1.0 surface (Table #170, Calendar/date controls #178, Sheet #160/#161) closed.
It states only evidence actually obtained — see `docs/beeui-1.0-evidence-classes.md` —
and narrows rather than pads the claim wherever a surface was not actually tested.
Full detail and the exact proof commands live in `docs/web-support-contract.md`; this
section is the compatibility-matrix-facing summary.

**Supported today, with real evidence:**

- **Browser engine:** Chromium only, via Playwright's pinned build (see
  `visual-web.yml`/`web-a11y.yml`/`web-consumer.yml`'s `playwright install chromium`
  step — the exact bundled Chromium version is printed by each run's "Report visual
  browser versions" step). Firefox and WebKit are never installed or exercised anywhere
  in this repository, so BeeUI makes **no claim, implicit or explicit, about Firefox or
  Safari/WebKit rendering or interaction correctness**.
- **`react-native-web`:** `0.21.0` exact (see the matrix row above) — the one version
  this repo bundles and browser-tests, through two independently configured bundlers.
- **Bundlers:** Expo's Metro Web export (`apps/showcase`, proved by `ci.yml`'s `web`
  export job plus `web-a11y.yml`/`visual-web.yml`'s real-Chromium runs against that
  export) **and** Vite (proved by the independent, non-Showcase consumer below). **No
  other bundler is claimed** — Next.js, Webpack, Parcel, or any bundler besides these two
  are explicitly unverified and unsupported claims per the issue's own instruction not to
  claim Next.js or an arbitrary bundler without dedicated evidence.
- **CSS/theming baseline:** Tailwind CSS `4.3.3` exact + Uniwind `1.10.1` exact (same
  pins as the rest of this matrix), proved on the Vite path specifically via `uniwind`'s
  own `uniwind/vite` plugin (available since Uniwind 1.2.0, well under the `1.10.1` this
  repo pins) plus `@tailwindcss/vite`, mirroring the `withUniwindConfig`/`uniwind/metro`
  wiring `apps/showcase/metro.config.js` already uses for the Expo path.
- **Independent Web consumer:** `scripts/verify-web-consumer.sh` (wired into
  `.github/workflows/web-consumer.yml`, running on every PR and on push to `main`) packs
  `@beemvp/beeui-core`/`@beemvp/beeui-tokens`/`@beemvp/beeui-ui` through the real package boundary (`pnpm pack`)
  and installs the tarballs into an isolated Vite + `react-native-web` app outside this
  monorepo — no workspace fallback, matching the "clean-consumer evidence" bar
  `scripts/verify-bare-consumer.sh` already set for the native/bare-RN contract. That
  consumer:
  - renders through `BeeUIProvider` and Uniwind's theme CSS (package/source consumption,
    theme CSS, provider);
  - exercises representative forms (`Input`, `Checkbox`);
  - exercises overlays (`Dialog`, keyboard `Escape` dismissal);
  - exercises `Select` (open, choose an item, value propagates);
  - exercises `Tooltip` (keyboard-focus reveal, not just hover);
  - exercises `Sheet` (open, dismiss);
  - exercises `Table` (real `table`/`row`/`cell` semantics);
  - exercises `Calendar` (representative date-control surface — `DatePicker`/
    `DateTimePicker` compose the same `Calendar` grid, so this is not a separate
    accessibility tree);
  - runs a real Chromium interaction pass (Playwright) covering the keyboard paths above;
  - runs an automated accessibility scan (`@axe-core/playwright`, same
    `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tag set as `web-a11y.yml`) and fails on any
    `serious`/`critical` violation;
  - runs a real production build (`vite build`) and asserts non-empty output.

**Explicitly not claimed (narrowed, not deferred):**

- Firefox, Safari/WebKit, or any non-Chromium rendering/interaction correctness.
- Next.js, Webpack, Parcel, or any bundler other than Expo/Metro and Vite.
- `vite-plugin-rnw` (`0.0.12`, pinned in `scripts/verify-web-consumer.sh`) is a
  pre-1.0 (`0.0.x`) third-party plugin; it is the tested and pinned mechanism for
  `react-native`→`react-native-web` aliasing and `.web.tsx` extension resolution under
  Vite, not an aspirational range. It is not part of `@beemvp/beeui-ui`'s own
  `peerDependencies` (it is Web-bundler tooling, analogous to `uniwind/metro` for the
  Expo path) and is not covered by `scripts/check-compatibility-matrix.mjs`'s drift
  check; re-verify it explicitly before bumping.
- Server-side rendering (SSR) / static site generation of BeeUI content — neither the
  Showcase's Expo Web export nor the Vite consumer render on a server; both are
  client-rendered SPAs.

## No publication impact

This lock does not publish, republish, or change any npm/CLI artifact, and it does not
itself modify any `peerDependencies`/`engines` range. Range changes belong to the R2
issues named per row above, each of which must re-run this file's drift check and update
the row it resolves in the same change.

## Machine-checked snapshot

The block below is parsed verbatim by `scripts/check-compatibility-matrix.mjs`. Keep it
in sync with the "Tested / pinned today" column above; the check fails on drift in either
direction.

```json compatibility-matrix
{
  "node": {
    "repo": "24.13.1",
    "pnpm": "10.15.0"
  },
  "react": "19.2.3",
  "reactDom": "19.2.3",
  "reactNative": "0.86.2",
  "reactNativeWeb": "0.21.0",
  "expoSdkRange": "~57.0.0",
  "tailwindcss": "4.3.3",
  "uniwind": "1.10.1",
  "safeAreaContext": {
    "ui": "5.7.0",
    "showcase": "~5.7.0"
  },
  "teleport": {
    "ui": "1.1.13",
    "showcase": "~1.1.13"
  }
}
```
