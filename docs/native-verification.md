# Native verification contract

BeeUI's foundation CI proves TypeScript, behavioral contracts, release-package integrity, Expo/Metro exports, and Expo Prebuild generation. This document defines the portability gate for consuming BeeUI from a newly generated React Native application that has no Expo runtime.

## Package-boundary bare consumer

`scripts/verify-bare-consumer.sh` creates a fresh React Native 0.86.2 application using the React Native Community CLI. It does **not** copy BeeUI source directories into the application.

Instead, the script packs `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` with `pnpm pack`, installs those tarballs into the generated application together with the declared styling/native peer runtime, and resolves BeeUI through the consumer's normal `node_modules` package boundary.

The smoke app imports real BeeUI components, semantic theme CSS, form state, selection state, safe-area integration, and `Dialog`. Tailwind/Uniwind source discovery points at the installed package source exposed by the tarballs. It creates production Metro bundles for both Android and iOS before any native build begins.

A bare-consumer run fails if the generated application can resolve the Expo runtime.

This is intentionally stronger than a workspace import or vendored-source smoke test: a package that omits an exported source file, leaks a `workspace:*` dependency into its packed manifest, or cannot be installed as a normal package fails before native verification can be accepted.

## Release-package verification

`pnpm release:verify` runs before platform bundling in the main CI job. It verifies the package contract independently from the bare React Native build:

- all BeeUI packages use the workspace's lockstep `0.x` version;
- each package has an explicit packed source surface;
- every declared export target exists;
- `@beeui/ui` keeps the expected peer dependency contract;
- `@beeui/core` and `@beeui/ui` contain no Expo runtime imports;
- `pnpm pack` produces installable tarballs with no remaining `workspace:` protocol;
- the packed `@beeui/ui` dependency on `@beeui/core` resolves to the release version;
- all three tarballs install into a clean package consumer without pulling Expo.

A successful run writes `.artifacts/release-verification.json`. CI uploads that file as the release-verification artifact for the exact commit under review.

## Native compilation

The `bare-native` CI job runs on BeeUI's Linux self-hosted runner. It installs the required Android SDK/NDK toolchain, builds the generated application's debug APK with Gradle, and verifies that `app-debug.apk` exists.

The same package-installed bare consumer also produces an iOS JavaScript bundle through React Native Metro, so BeeUI's package/Uniwind integration is exercised for the iOS platform without Expo.

A native iOS binary cannot be compiled on the current Linux runner. That gate requires a macOS self-hosted runner or available GitHub-hosted macOS capacity. Until one is connected, native iOS compilation remains a documented release gate rather than a passing CI claim.

The initial hosted-runner attempt was intentionally removed after GitHub failed both hosted Linux and macOS jobs at scheduling time with no executed steps or job log, while BeeUI's self-hosted runner continued normally.

## What automated CI does not prove

A successful native compile does not replace interaction testing on a simulator or physical device. Before a release candidate is considered fully verified, the release reviewer must record the applicable manual gates from `docs/release.md`, including:

- iOS native binary compilation on macOS;
- safe-area behavior on a device/simulator with non-zero top and bottom insets;
- Dialog focus, dismiss, keyboard, hardware-back, and screen-reader behavior;
- VoiceOver/TalkBack behavior for accessibility helpers such as `VisuallyHidden`;
- representative light/dark visual checks on supported form factors.
