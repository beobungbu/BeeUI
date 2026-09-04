---
title: Native (RN/Expo)
description: What BeeUI's native React Native/Expo verification proves and does not prove.
---

Full detail lives in `docs/native-verification.md` in the repository; this page is the
published summary. It mirrors the rigor `docs/web-support-contract.md` established for
the [Web contract](/docs/compatibility/web/).

## Two consumer paths, both proved by CI

1. **Expo Showcase** (`apps/showcase`) — the app BeeUI itself ships and dogfoods.
2. **Package-boundary bare consumer** (`scripts/verify-bare-consumer.sh`) — a fresh React
   Native `0.86.2` app created with the React Native Community CLI. It never copies BeeUI
   source: it packs `@beemvp/beeui-core`/`@beemvp/beeui-tokens`/`@beemvp/beeui-ui` with `pnpm pack`, installs
   the tarballs through the consumer's normal `node_modules` boundary, then bundles Metro
   for Android/iOS, compiles an Android debug APK, and — on the trusted macOS runner —
   compiles the generated iOS app with `xcodebuild` against a generic iOS Simulator
   destination. A run fails if the app can resolve the Expo runtime.

## What native compile CI proves

A green native gate proves the exact candidate source can generate/install the expected
native dependencies and **compile** — for both the Expo Showcase and the bare RN
`0.86.2` consumer — for Android and iOS Simulator, resolving the BeeUI package boundary
without requiring Expo in the bare consumer.

:::note[Compile is not runtime]
Compilation does **not** prove real runtime interaction (safe-area insets, keyboard
avoidance, Dialog/Popover dismissal, Android hardware-back, VoiceOver/TalkBack, and so
on). Those gates are tracked separately in `docs/release.md` and
`docs/native-runtime-smoke.md`.
:::

## React Native 0.86 vs 0.87

- **`0.86.2`** ([#130](https://github.com/beobungbu/BeeUI/issues/130)) — confirmed. It is
  the lowest version this repository has ever built or tested (`0.85` was dropped from
  the promise entirely, not merely deferred — [#132](https://github.com/beobungbu/BeeUI/issues/132)),
  and it is exercised by every ordinary CI run (`ci.yml`, `runtime-native.yml`).
- **`0.87.1`** ([#131](https://github.com/beobungbu/BeeUI/issues/131)) — tested and
  **excluded**, not merely deferred. `.github/workflows/compat-rn-0-87.yml` runs the
  identical bare-consumer contract with `BEEUI_RN_VERSION=0.87.1`. The iOS bare-consumer
  compile passes; the **Android bare-consumer compile fails** because
  `react-native-safe-area-context@5.7.0`'s Kotlin source does not build against RN
  `0.87`'s native surface (`Unresolved reference 'uiImplementation'` in
  `SafeAreaView.kt`) — an upstream/peer incompatibility, not a `@beemvp/beeui-ui`/`@beemvp/beeui-core`
  defect. Because `@beemvp/beeui-ui`'s declared peer range (`>=0.86.0 <0.87.0`) already excludes
  `0.87.1`, a plain `npm install` into that consumer fails fast on `ERESOLVE` before ever
  reaching a build step — the contract enforcing itself. This row is not required on
  every pull request; it runs nightly and on `workflow_dispatch`/the `ci:rn-0.87` PR
  label so an eventual upstream fix is caught automatically.

## Release-package verification

`pnpm release:verify` checks lockstep BeeUI package versions, explicit packed source
surfaces, declared export targets, expected peer dependency contracts, absence of Expo
runtime imports from `@beemvp/beeui-core`/`@beemvp/beeui-ui`, clean `pnpm pack` output with no
unresolved `workspace:` protocol, and clean installation without Expo leakage. A
successful run writes `.artifacts/release-verification.json` for the exact commit under
review.

## Pull-request scheduling

Native iOS compilation is expensive, so pull requests use the conservative classifier in
`docs/ci-native-classification.md`: native-sensitive/unknown diffs run the `ios-native`
job; explicitly native-safe diffs may skip it; the `ci:native` label forces it; pushes to
`main` always run the full native iOS gate.

## iOS `pageSheet`/`formSheet` — experimental

Native `pageSheet`/`formSheet` `DialogContent` presentation is **EXPERIMENTAL**, not
excluded and not yet release-quality certified. Deterministic contract tests and native
compile both pass; live presentation/swipe-dismissal evidence on a real iOS Simulator or
device is still owed (tracked against [#62](https://github.com/beobungbu/BeeUI/issues/62)
and `docs/native-runtime-smoke.md`'s I4–I7 cases). `overFullScreen` (transparent)
presentation is unaffected and passes today.
