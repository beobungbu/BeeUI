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

## Roadmap

`docs/roadmap.md` defines the next verification step: a protected iOS Simulator + Android Emulator/device runtime smoke tier, scheduled for nightly/release-candidate use rather than every ordinary pull request.
