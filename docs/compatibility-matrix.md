# BeeUI 1.0 Compatibility Support Matrix

> **Status:** Candidate — locked as the shared-authority baseline for R2 (#129, parent
> [#114](https://github.com/beobungbu/BeeUI/issues/114)).
> **Snapshot:** 2026-08-30
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
versions out of `package.json`, `.nvmrc`, `.github/workflows/*.yml`,
`packages/ui/package.json` and `apps/showcase/package.json`, and fails if they drift from
the machine-readable block at the bottom of this file. Declared `peerDependencies`
*ranges* (the aspirational public promise) are intentionally **not** duplicated in that
block — the package manifests remain the single authority for the promise itself; this
file and its check only guard the *tested-version* facts a reader relies on to judge
whether that promise is justified.

## Matrix

| Dependency | Tested / pinned today | Evidence class | Declared public peer promise | Verdict | Owning R2 issue |
| --- | --- | --- | --- | --- | --- |
| React | `19.2.3` exact (repo dev + Showcase) | Bundle/compile + deterministic contract (Jest, tsc, Metro/Web/Android/iOS export) | `>=19.0.0` (no upper bound) in `packages/ui/package.json` | **Narrow candidate**: only the `19.x` line has ever been exercised; an unbounded floor silently promises untested future majors. Public range should gain an explicit `<20.0.0` cap. | [#133](https://github.com/beobungbu/BeeUI/issues/133) React/ReactDOM major caps |
| React DOM (optional) | `19.2.3` exact, rendered via `react-native-web` in the Showcase's Web Metro export | Bundle/compile evidence (Web export in `ci.yml`) plus browser interaction evidence for the rendered surfaces covered by `web-a11y`/`visual-web` (Playwright, Chromium only) | `>=19.0.0`, `optional: true` | **Verify/narrow with React**: same unbounded-floor gap as React; kept optional and coupled 1:1 to the React row. | [#133](https://github.com/beobungbu/BeeUI/issues/133) |
| React Native — minimum candidate | `0.85` is **not present anywhere** in the lockfile, CI matrix, or Showcase; the lowest version this repo has ever built/tested is `0.86.2` | None for `0.85.x` (no evidence class obtained) | `>=0.85.0` in `packages/ui/package.json` and `docs/registry-cli.md` | **Narrow**: the declared `0.85.0` floor is an unverified promise today. `0.86` is the honest minimum candidate until a `0.85` row is actually run, or the floor is raised to `0.86`. | [#132](https://github.com/beobungbu/BeeUI/issues/132) RN 0.85 decision, [#130](https://github.com/beobungbu/BeeUI/issues/130) RN 0.86 row |
| React Native — current | `0.86.2` exact, pinned in `packages/ui/package.json` devDependencies, `apps/showcase/package.json`, and exercised through Metro/Web/Android/iOS bundling plus native compile (`ci.yml`) and Maestro simulator/emulator smoke (`runtime-native.yml`) | Native runtime evidence (iOS Simulator/Android Emulator smoke) + bundle/compile evidence | `>=0.85.0` (no upper bound) | **Confirmed as the tested current row.** RN `0.87` is not present in this repo in any form and is not yet a tested row. | [#131](https://github.com/beobungbu/BeeUI/issues/131) RN 0.87 row |
| Expo SDK | `~57.0.0` (`@expo/metro-runtime` `~57.0.12`), Xcode floor pinned to `26.4`+ specifically because "SDK 57 targets Xcode 26.6" (`ci.yml` comment) | Bundle/compile evidence (`expo export` for web/android/ios, `expo prebuild --clean`, iOS Simulator xcodebuild) + native runtime smoke | Not currently declared as a `peerDependencies` entry (Expo is a Showcase/app-level concern, not a `@beeui/ui` peer) | **Confirmed**: SDK 57 is the only tested Expo line. No other SDK line exists anywhere in the repo. | Tracked implicitly with RN rows ([#130](https://github.com/beobungbu/BeeUI/issues/130)/[#131](https://github.com/beobungbu/BeeUI/issues/131)) |
| Node — repo/release toolchain | `24.13.1` exact, identical across root `package.json` `engines.node`, `.nvmrc`, and all four `.github/workflows/*.yml` `NODE_VERSION` values; `.npmrc` sets `engine-strict=true` | Deterministic contract evidence (`Verify JavaScript toolchain` CI step asserts the exact version string) | `engines.node: "24.13.1"` (exact, not a range) | **Confirmed.** This is the one Node version the monorepo itself builds, tests and releases with. | N/A — already the strictest possible statement |
| Node — CLI tooling | Only `24.13.1` has ever run any BeeUI script in CI. No workflow, job, or test currently executes on Node `22.x`. The packed BeeUI CLI (R8, `#209`–`#219`) does not exist as a distributable artifact yet and declares no `engines` field of its own. | None obtained for Node 22 (no evidence class) | No published CLI package yet; `docs/registry-cli.md` documents `pnpm beeui -- add <item>` run inside this exact workspace | **Narrow the target, do not promise it yet**: "Node 22+24 CLI tooling" is a *candidate target* for the future packed CLI, not a tested claim. Do not state Node 22 support publicly until a CI job actually exercises the CLI under Node 22. | [#134](https://github.com/beobungbu/BeeUI/issues/134) Node/tooling compatibility |
| Tailwind CSS | `4.3.3` exact, `apps/showcase/package.json` | Bundle/compile evidence (Web/Metro export); no dedicated Tailwind-version regression suite | `>=4 <5` in `packages/ui/package.json` and `docs/registry-cli.md` | **Verify/narrow**: only the single exact `4.3.3` point release is exercised; the full `4.x` range is an untested promise. | [#135](https://github.com/beobungbu/BeeUI/issues/135) Uniwind/Tailwind tested range |
| Uniwind | `1.10.1` exact, `apps/showcase/package.json` (mocked via `__mocks__/uniwind.ts` in Jest, real in Metro/Web/native bundling) | Bundle/compile evidence for the real package; deterministic/mock evidence for unit tests | `>=1.10.1 <2` in `packages/ui/package.json` and `docs/registry-cli.md` | **Verify/narrow**: only the exact floor version `1.10.1` is exercised; nothing between `1.10.1` and `<2` has run. Candidate promise stays `<2` (matches issue title "tested range `<2`") only once #135 proves at least one additional point in that range. | [#135](https://github.com/beobungbu/BeeUI/issues/135) |
| `react-native-safe-area-context` | `5.7.0` exact (`packages/ui` devDependency), `~5.7.0` (Showcase) | Bundle/compile + native runtime smoke evidence | `>=5 <6` | **Confirmed candidate line, narrow the spread**: the `5.x` major is a reasonable public promise (semver-disciplined library), but only the `5.7.x` minor has actually run. | [#134](https://github.com/beobungbu/BeeUI/issues/134) (compatibility docs/CI wiring), no dedicated row issue — flagged here for R2.2–R2.10 awareness |
| `react-native-teleport` | `1.1.13` exact (`packages/ui` devDependency), `~1.1.13` (Showcase); this is the overlay portal transport pinned explicitly in `scripts/verify-release.mjs`'s required packed-file list | Bundle/compile + native runtime smoke evidence (overlay/portal paths are exercised by Popover/DropdownMenu native runtime smoke) | `>=1.1 <2` | **Confirmed candidate line, narrow the spread**: only `1.1.13` is tested; the promise already correctly caps the pre-2.0 API surface (`1.1.x` per the issue title), which matches actual usage. | Flagged here for R2.2–R2.10 awareness; no dedicated tracking issue beyond #129's lock |

## Explicitly out of scope for this lock (deferred, not silently promised)

- **Web/browser engine matrix.** `web-a11y.yml` and `visual-web.yml` install and test
  **Chromium only** via Playwright. Firefox/WebKit are not exercised anywhere in this
  repository. BeeUI does not currently make any public claim about non-Chromium
  browsers. The full reproducible Web support contract is explicitly owned by
  [#136](https://github.com/beobungbu/BeeUI/issues/136), not this issue.
- **React Native 0.85** and **React Native 0.87** rows: both require dedicated CI/native
  verification before either can be promised. See [#130](https://github.com/beobungbu/BeeUI/issues/130),
  [#131](https://github.com/beobungbu/BeeUI/issues/131), [#132](https://github.com/beobungbu/BeeUI/issues/132).
- **Node 22 CLI verification**: no CI job exists yet. See [#134](https://github.com/beobungbu/BeeUI/issues/134).
- **Compatibility CI scheduling** (a dedicated recurring job that actually runs
  alternate rows, as opposed to this document's drift check against the single row this
  repo already builds): owned by [#137](https://github.com/beobungbu/BeeUI/issues/137).
- **Mechanically synchronized compatibility documentation** beyond this file's own
  drift check (e.g. generating package README compatibility tables from this file):
  owned by [#138](https://github.com/beobungbu/BeeUI/issues/138).

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
