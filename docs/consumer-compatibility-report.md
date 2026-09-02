# BeeUI package consumer compatibility report (#208, R7.12)

> **Status:** Release-review report — the durable, evidence-tied statement of which packed
> package set was verified against each supported consumer row and **what evidence class
> passed**.
> **Snapshot:** 2026-08-31
> **Packages under test:** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui` (one lockstep group;
> candidate version `20260902.0.0` today — publication of that exact version is owner-gated at
> [#254](https://github.com/beobungbu/BeeUI/issues/254)).

This report consolidates compatibility that is **actually proven** by the clean-consumer
gates, the consumer starters, and the compatibility matrix into one release-review artifact.
It does not widen any promise: every row states the strongest evidence class actually obtained
([docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md)) and cites the exact
gate/script/matrix row that proves it. Where evidence is weaker than the declared peer range,
the gap is called out, not hidden.

- **Single source of truth for versions/peers:** [docs/compatibility-matrix.md](compatibility-matrix.md)
  (the pinned/tested versions) and `packages/ui/package.json` (`peerDependencies` — the public
  promise). This report must not diverge from either; `scripts/check-distribution-policy.mjs`
  (`pnpm dist:policy:check`, part of `pnpm typecheck`) fails if its machine-readable block
  below drifts from the matrix snapshot or from `packages/ui`'s declared peers.
- **Rule (from #129, inherited here):** if a combination cannot be tested, narrow the public
  promise instead of documenting hope. This report **prevents package peer claims from
  exceeding tested rows** — that is enforced mechanically, not just asserted.

## No publication

This report describes verification against **packed tarballs** and workspace/starter
consumers only. No `npm publish` has run; no dist-tag exists; `@beemvp/beeui-*` is unpublished
([docs/distribution-names.md](distribution-names.md)). Public-package releases will
additionally need proof of actual published artifacts in clean consumers
([docs/release.md](release.md) release-candidate checklist); that evidence does not exist yet
and is not claimed here. The dist-tag/prerelease semantics that will govern that publication
are [docs/dist-tag-policy.md](dist-tag-policy.md) (#206).

## How the packed set is verified

The three packages are packed through the real package boundary (`pnpm pack` →
`beeui-core-*.tgz`, `beeui-tokens-*.tgz`, `beeui-ui-*.tgz`) and installed into isolated
consumer apps with **no monorepo/workspace fallback** — the clean-consumer evidence bar of
[docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md). Three clean-consumer
rows exist, one per ADR-011 D7 target:

| Clean consumer | Script | CI workflow | Proves |
| --- | --- | --- | --- |
| Bare React Native | `scripts/verify-bare-consumer.sh` | `ci.yml` (`bare-native`), `ios-native` | RN-CLI app outside the monorepo; tarball install; strict-`tsconfig`; Metro Android/iOS bundle; bare Android native compile; iOS Simulator `xcodebuild` compile; provider/overlay/token smoke fixture |
| Web (Vite + react-native-web) | `scripts/verify-web-consumer.sh` | `web-consumer.yml` (`web-consumer`) | isolated Vite app; tarball install; `@import '@beemvp/beeui-tokens/theme.css'`; real Chromium interaction (Playwright) + axe scan; `vite build` |
| Expo SDK 57 | `scripts/verify-expo-consumer.sh` | R7.8 ([#204](https://github.com/beobungbu/BeeUI/issues/204)) | isolated Expo app; tarball install; Metro resolves packaged `dist/` through ordinary `react-native`/`browser`/`default` conditions (no `unstable_conditionsByPlatform` reorder) |

The showcase app (`apps/showcase`) is workspace-linked (`@beemvp/beeui-ui: workspace:*`) and is the
source of the native runtime smoke and Web-export browser evidence; it is not a clean consumer
but it exercises the same source. Bundle/footprint numbers are
[docs/bundle-footprint-baseline.md](bundle-footprint-baseline.md).

## Compatibility rows

Evidence classes below are exactly those defined in
[docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md). "Matrix row" links each
claim to [docs/compatibility-matrix.md](compatibility-matrix.md), which owns the underlying
decision and its issue.

| Consumer dependency | Tested / pinned | Declared peer promise (`packages/ui`) | Evidence class obtained | Proven by | Verdict / known limitation |
| --- | --- | --- | --- | --- | --- |
| React | `19.2.3` exact | `>=19 <20` | Bundle/compile + deterministic contract | `tsc`, Jest; Metro/Web/Android/iOS export in `ci.yml`; all three clean consumers | Only the `19.x` line is exercised; range capped at `<20` (matrix: React row, #133). No React 20 claim. |
| React DOM (Web only) | `19.2.3` exact, via `react-native-web` | `>=19 <20`, `optional` | Bundle/compile + browser interaction | Web export in `ci.yml`; Playwright/axe in `web-a11y.yml`/`visual-web.yml`; `verify-web-consumer.sh` | Chromium only; coupled 1:1 to the React row (matrix: React DOM row, #133). |
| React Native — floor | `0.86.2` (lowest ever built) | `>=0.86.0 <0.87.0` | — (no evidence for `0.85.x`) | n/a | `0.85` dropped from the promise, not deferred (matrix: RN minimum-candidate row, #132). |
| React Native — 0.86.x | `0.86.2` exact | `>=0.86.0 <0.87.0` | Native runtime + clean-consumer + bundle/compile | `verify-bare-consumer.sh`; `ci.yml` `bare-native`/`ios-native`; `runtime-native.yml` smoke | Reproduces outside the monorepo; confirmed (matrix: RN 0.86 row, #130). |
| React Native — 0.87.x | `0.87.1` tested | `>=0.86.0 <0.87.0` (excluded) | Bundle/compile — **real Android compile failure** | `compat-rn-0-87.yml` (opt-in) | **Excluded on real evidence**: `react-native-safe-area-context@5.7.0` Kotlin does not build against RN 0.87 (`Unresolved reference 'uiImplementation'`). Not a BeeUI defect (matrix: RN 0.87 row, #131). |
| Expo SDK | `~57.0.0` (`@expo/metro-runtime ~57.0.12`) | not a `@beemvp/beeui-ui` peer (app-level) | Bundle/compile + native runtime smoke | `expo export` (web/android/ios), `expo prebuild --clean`, iOS `xcodebuild` in `ci.yml`; `verify-expo-consumer.sh` | SDK 57 is the only tested Expo line (matrix: Expo SDK row). |
| Node — toolchain | `24.13.1` exact | `engines.node: "24.13.1"` (root) | Deterministic contract | `Verify JavaScript toolchain` CI step; `.nvmrc`; `engine-strict=true` | The one Node version the repo builds/tests/releases with (matrix: Node toolchain row). |
| Node — CLI | `24.13.1` only | CLI `engines.node: ">=24"` (#209) | Deterministic contract (Node-24 guard) + packed-artifact | `pnpm release:verify`, `pnpm cli:smoke`; `scripts/__tests__/beeui.test.mjs` | Node 22 has no evidence; narrowed to Node 24 only (matrix: Node/CLI row, #134). CLI unpublished. |
| `react-native-web` | `0.21.0` exact | not a `@beemvp/beeui-ui` peer (Web bundler aliases `react-native`) | Bundle/compile + browser interaction | Expo Web export + Vite (`web-consumer.yml`); Playwright/axe on both | Only `0.21.0`, through two independent bundlers (matrix: react-native-web row, #136). |
| Tailwind CSS | `4.3.3` exact | `>=4 <5` | Bundle/compile + deterministic contract | `tokens:check`, semantic-layer/theme-scope/override/token-reader/density tests; Web/Metro export | Only the `4.3.3` point release; range capped `>=4 <5` (matrix: Tailwind row, #135). |
| Uniwind | `1.10.1` exact | `>=1.10.1 <2` | Bundle/compile (real) + deterministic/mock (unit) | Metro/Web/native bundling; Jest via `__mocks__/uniwind.ts`; Vite `uniwind/vite` in the Web consumer | Only the exact floor `1.10.1`; range stays `>=1.10.1 <2` (matrix: Uniwind row, #135). |
| `react-native-safe-area-context` | `5.7.0` exact | `>=5 <6` | Bundle/compile + native runtime smoke (RN 0.86) | `verify-bare-consumer.sh`; `runtime-native.yml` | Only `5.7.x`, only vs RN `0.86.2`; **fails RN 0.87** (root cause of the RN 0.87 exclusion). Matrix: safe-area-context row. |
| `react-native-teleport` | `1.1.13` exact | `>=1.1 <2` | Bundle/compile + native runtime smoke | Popover/DropdownMenu native smoke; pinned in `verify-release.mjs` packed-file list | Only `1.1.13`; promise caps the pre-2.0 API (matrix: teleport row). |
| `@react-native-community/datetimepicker` | `9.1.0` exact | `>=9.1 <10`, `optional` | Deterministic contract + Web bundle/compile only | `tsc`, Jest (mocked); `beeui.test.mjs`; `expo export --platform web` (never imports the native module) | **No native compile/runtime evidence** in this repo's sandbox; native pickers unverified beyond TS (matrix: datetimepicker row, #176/#177). |
| `@gorhom/bottom-sheet` | `5.2.14` exact | `>=5.2 <6`, `optional` | Deterministic contract + iOS `ios-native` bundle/compile | `tsc`, Jest (mocked); real `pod install` + `xcodebuild` in `ci.yml` | **No native runtime** (gesture/drag/snap/keyboard/AT) — owed to #160 (matrix: bottom-sheet row, ADR-006). |
| `react-native-reanimated` | `4.5.1` exact | `>=4.5 <5`, `optional` | Deterministic contract + iOS bundle/compile | `tsc`, Jest; `ios-native` | Reanimated v4 (worklets split out); one Expo-SDK-matched version; runtime owed to #160 (matrix row). |
| `react-native-gesture-handler` | `2.32.0` exact | `>=2.32 <3`, `optional` | Deterministic contract + iOS bundle/compile | `tsc`, Jest; `ios-native` | `@gorhom/bottom-sheet` peer; runtime owed to #160 (matrix row). |
| `react-native-worklets` | `0.10.1` exact | `>=0.10 <1`, `optional` | Deterministic contract + iOS bundle/compile | `tsc`, Jest; `ios-native` | Reanimated v4's required peer; runtime owed to #160 (matrix row). |

## Web support scope (evidence-bounded)

Per the Web support contract ([docs/web-support-contract.md](web-support-contract.md);
[docs/compatibility-matrix.md](compatibility-matrix.md) "Web support contract (#136)"):

- **Supported, with real evidence:** Chromium only (Playwright's pinned build);
  `react-native-web@0.21.0`; the **Expo/Metro** Web export and the **Vite** consumer as the
  two proven bundlers; Tailwind `4.3.3` + Uniwind `1.10.1` theming. The independent Vite +
  react-native-web consumer (`verify-web-consumer.sh`) exercises provider/theme CSS, forms
  (`Input`/`Checkbox`), overlays (`Dialog` + `Escape`), `Select`, `Tooltip` (keyboard focus),
  `Sheet`, `Table` semantics, and `Calendar`, then runs a real `vite build`.
- **Not claimed (narrowed, not deferred):** Firefox, Safari/WebKit, or any non-Chromium
  engine; Next.js, Webpack, Parcel, or any bundler other than Expo/Metro and Vite; SSR/SSG.

## Evidence-class summary

| Evidence class | Where it applies in this report |
| --- | --- |
| Deterministic contract | `tsc`, Jest/RNTL, token/registry checks — every row's baseline |
| Bundle/compile | Metro/Web bundle, Expo prebuild, Android/iOS native compile — RN/Expo/Web/Tailwind/Uniwind rows |
| Browser interaction | Playwright keyboard/pointer/focus + axe — Web/React DOM rows (Chromium only) |
| Native runtime | iOS Simulator / Android Emulator smoke — RN 0.86, safe-area-context, teleport rows |
| Clean-consumer | Packed tarballs in bare RN / Web / Expo apps with no workspace fallback — the three verify scripts |
| Performance | `pnpm bench:footprint` — [docs/bundle-footprint-baseline.md](bundle-footprint-baseline.md) |

Not obtained anywhere for these packages, and therefore **not claimed**: assistive-technology
certification (VoiceOver/TalkBack are separate, partial evidence per
[docs/release.md](release.md)); native runtime for the optional Sheet/date-picker peers;
physical-device behavior; and any published-npm artifact evidence.

## Machine-readable evidence contract

Parsed verbatim by `scripts/check-distribution-policy.mjs`. Version pins must equal
[docs/compatibility-matrix.md](compatibility-matrix.md)'s snapshot; peer promises must equal
`packages/ui/package.json`'s `peerDependencies`; every clean-consumer script path must exist.
This is what mechanically prevents a peer claim here from exceeding a tested row.

```json consumer-compatibility
{
  "published": false,
  "packageSet": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
  "candidateVersion": "20260902.0.0",
  "cleanConsumerScripts": [
    "scripts/verify-bare-consumer.sh",
    "scripts/verify-web-consumer.sh",
    "scripts/verify-expo-consumer.sh"
  ],
  "versionPins": {
    "react": "19.2.3",
    "reactDom": "19.2.3",
    "reactNative": "0.86.2",
    "reactNativeWeb": "0.21.0",
    "node": "24.13.1",
    "tailwindcss": "4.3.3",
    "uniwind": "1.10.1"
  },
  "peerPromises": {
    "react": ">=19 <20",
    "react-dom": ">=19 <20",
    "react-native": ">=0.86.0 <0.87.0",
    "react-native-safe-area-context": ">=5 <6",
    "react-native-teleport": ">=1.1 <2",
    "@gorhom/bottom-sheet": ">=5.2 <6",
    "@react-native-community/datetimepicker": ">=9.1 <10",
    "react-native-reanimated": ">=4.5 <5",
    "react-native-gesture-handler": ">=2.32 <3",
    "react-native-worklets": ">=0.10 <1",
    "tailwindcss": ">=4 <5",
    "uniwind": ">=1.10.1 <2"
  }
}
```

## Feeds

This report feeds docs/llms and release review ([docs/release.md](release.md)) and is the
compatibility half of the release evidence packet; the tag/version semantics for the eventual
publication are [docs/dist-tag-policy.md](dist-tag-policy.md). It changes no package,
`peerDependencies`, or registry data.
