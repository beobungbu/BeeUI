# Native verification contract

BeeUI's automated verification proves package integrity, cross-platform bundling, Android native compilation, and native iOS Simulator compilation for both supported consumer paths. This document defines exactly what those gates prove and what still requires runtime/device interaction.

## Package-boundary bare consumer

`scripts/verify-bare-consumer.sh` creates a fresh React Native 0.86.2 application using the React Native Community CLI. It does **not** copy BeeUI source directories into the application.

Instead, the script:

1. packs `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` with `pnpm pack`;
2. installs those tarballs through the consumer's normal `node_modules` boundary;
3. installs the declared styling/native peer runtime;
4. creates production Metro bundles for Android and iOS;
5. compiles an Android debug APK on Linux;
6. on the macOS native gate, installs CocoaPods and compiles the generated iOS application for a generic iOS Simulator destination.

A bare-consumer run fails if the generated application can resolve the Expo runtime.

This is intentionally stronger than a workspace import or vendored-source smoke test. Missing packed files, unresolved `workspace:*` ranges, invalid exports, or package-boundary installation failures are detected before native verification can be accepted.

## Release-package verification

`pnpm release:verify` runs independently from the platform native builds and verifies:

- lockstep BeeUI package versions;
- explicit packed source surfaces;
- declared export targets;
- expected peer dependency contracts;
- no Expo runtime imports from `@beeui/core` / `@beeui/ui`;
- `pnpm pack` output with no unresolved `workspace:` protocol;
- rewritten packed dependency relationships;
- clean package installation without Expo leakage.

A successful run writes `.artifacts/release-verification.json`, which CI uploads for the exact commit under review.

## Linux native/cross-platform gate

The `bare-native` CI job runs on BeeUI's Linux self-hosted runner.

It proves:

- fresh package-installed bare React Native consumer creation;
- Android and iOS Metro production bundles through the installed BeeUI packages and Uniwind setup;
- Android SDK/NDK integration;
- debug APK compilation with Gradle;
- existence of the resulting APK.

Linux does not compile the iOS native binary; that responsibility belongs to the trusted macOS ARM64 gate.

## macOS native iOS gate

Native iOS compilation is now automated.

The `ios-native` job runs on the trusted `[self-hosted, beeui-macos]` runner and verifies two paths:

### Expo Showcase

- selects a supported Xcode version meeting the repository floor;
- installs the workspace dependencies for macOS/ARM64;
- consumes the generated Expo iOS project source from the exact run;
- installs CocoaPods;
- builds the Showcase with `xcodebuild` for `generic/platform=iOS Simulator`.

### True bare React Native consumer

- recreates a fresh React Native 0.86.2 consumer;
- repacks and reinstalls the BeeUI packages;
- runs CocoaPods against the fresh project;
- builds with `xcodebuild` for `generic/platform=iOS Simulator`.

These are real native compile gates. They are not simulator-boot/runtime interaction tests.

## React Native 0.87 row (#131)

`.github/workflows/compat-rn-0-87.yml` runs the identical `scripts/verify-bare-consumer.sh`
contract described above with `BEEUI_RN_VERSION=0.87.1`, proving the current upstream RN line
independently of the repo's own RN `0.86.2` pin. It adds the Android SDK platform/build-tools
`37` generation that RN 0.87's template requires (AGP `9.2.1`, Kotlin `2.2.0`, `compileSdk 37`).
Unlike the jobs above, it is `workflow_dispatch`-only — it does not run on every pull request or
push, since it duplicates the full native-compile cost of the 0.86 row for a version this repo
does not itself release. Trigger it manually to re-verify the row (e.g. `gh workflow run
compat-rn-0-87.yml`). See the "React Native — 0.87.x" row in `docs/compatibility-matrix.md` for
the evidence classes obtained and the resulting peer-range decision.

## Pull-request scheduling

Native iOS compilation is expensive, so pull requests use the conservative classifier documented in `docs/ci-native-classification.md`.

- native-sensitive/unknown PR diffs run `ios-native`;
- explicitly native-safe PR diffs may skip `ios-native`;
- `ci:native` may force it;
- pushes to `main` always run the full native iOS gate.

A skipped PR job is acceptable only when the classifier correctly identifies the entire diff as native-safe.

## Native build caches

The macOS job keeps performance-only build caches under `~/Library/Caches/BeeUI`.

- Showcase and bare-RN DerivedData are separated by selected Xcode version + resulting `Podfile.lock` hash;
- Xcode compilation caching is enabled;
- build timing summaries are emitted;
- Bundler gems use a persistent cache separated by Ruby version, architecture, and RN version.

The bare consumer remains fresh on every run. Its app working directory is recreated, BeeUI packages are repacked/reinstalled, and CocoaPods runs again. Cache reuse never substitutes for current-source evaluation.

## What native compile CI proves

A green current native gate proves that the exact candidate source can:

- generate/install the expected native iOS dependencies;
- compile the Expo Showcase for iOS Simulator;
- compile a fresh package-installed bare RN consumer for iOS Simulator;
- compile a fresh package-installed bare RN consumer for Android;
- resolve the BeeUI package boundary on native targets without requiring Expo in the bare consumer.

## What automated compile CI does not prove

Compilation does **not** prove real runtime interaction.

Before a release candidate is considered fully device-verified, record the applicable runtime gates from `docs/release.md`, including:

- safe-area behavior with non-zero system insets;
- representative iOS/Android launch/navigation flows;
- keyboard avoidance, focus, and text-input interaction;
- Dialog/AlertDialog runtime dismissal behavior;
- Popover/DropdownMenu scrolling, anchor movement, focus, and screen-reader behavior;
- Android hardware-back behavior;
- VoiceOver/TalkBack behavior;
- representative light/dark native visual review;
- RTL/large-text stress where applicable.

Do **not** list “native iOS compilation on macOS” as a remaining manual gate: that compile proof is already automated.

## iOS `pageSheet`/`formSheet` support policy (#128, tracks #62)

**Status for BeeUI 1.0: EXPERIMENTAL.** Native `pageSheet`/`formSheet` `DialogContent` presentation is not EXCLUDED and is not yet SUPPORTED at release-quality confidence.

**Guaranteed deterministic/compile evidence:** Jest/RNTL contracts prove `transparent=false` Modal props for `pageSheet`/`formSheet`, modal-local host geometry (non-zero origin, host-move remeasurement), and iOS `onRequestClose` non-interception. Native iOS compilation (Expo Showcase and bare RN consumer, `ios-native` CI job) proves these presentations build. Neither proves live presentation, placement, or swipe dismissal.

**Required evidence for release-level support:** recorded exact-head real iOS Simulator or physical-device runtime evidence — actual `pageSheet`/`formSheet` presentation, child Popover/DropdownMenu, keyboard interaction, and swipe-to-dismiss with `onRequestClose` firing, per `docs/native-runtime-smoke.md`'s I4/I5/I6/I7 cases and the runtime-gate record format in `docs/release.md`. Until that evidence exists for an exact release-candidate head, the status stays EXPERIMENTAL.

**Current CI representation — quarantine, not a pass:** the `pageSheet`/`formSheet` section of `apps/showcase/runtime-smoke/maestro/ios-sheets.yaml` is explicitly QUARANTINED (skipped) on the headless CI iOS Simulator, where the trigger tap is swallowed and the sheet never presents (state stays closed, `requestClose: 0`) per #62's investigation. This is not reproducible as a hard failure in bare RN 0.86.2 and reproduces only ~33% locally (not ~100% as on CI), so it is treated as a documented RN-Modal/headless-CI-simulator limitation, not a BeeUI kernel defect. A quarantined/skipped section must never be reported or counted as a passing runtime gate. `overFullScreen` (transparent) presentation is unaffected, is exercised in the same suite, and passes.

**Conditions to remove the quarantine:** re-enable the `pageSheet`/`formSheet` Maestro section once either (a) upstream React Native/iOS Simulator behavior changes so the presentation reliably fires on the headless CI simulator, or (b) a CI-proven, non-flaky presentation path is found at the BeeUI layer — in both cases the re-enabled section must pass on CI before the quarantine is lifted. Do not re-attempt the previously reverted kernel accessibility-gating fix without new CI-proven evidence (see #62).

## Roadmap

`docs/roadmap.md` defines the next verification step: a protected iOS Simulator + Android Emulator/device runtime smoke tier, scheduled for nightly/release-candidate use rather than every ordinary pull request.
