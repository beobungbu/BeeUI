# Native verification contract

BeeUI's foundation CI proves TypeScript, behavioral contracts, Expo/Metro exports, and Expo Prebuild generation. This document defines the next portability gate: consuming BeeUI from a newly generated React Native application that has no Expo runtime.

## Bare consumer

`scripts/verify-bare-consumer.sh` creates a fresh React Native 0.86.2 application using the React Native Community CLI, installs only BeeUI's styling/runtime dependencies, vendors the BeeUI source packages into that isolated consumer, and configures Metro with `@react-native/metro-config` plus Uniwind.

The smoke app imports real BeeUI components, semantic theme CSS, form state, selection state, and `Dialog`. It then creates production Metro bundles for both Android and iOS.

A bare-consumer run fails if the generated application can resolve the Expo runtime.

## Native compilation

CI has dedicated platform jobs:

- `bare-android` builds the generated application's debug APK with Gradle and verifies the APK exists.
- `bare-ios` installs CocoaPods for the generated application and builds the iOS Simulator target with code signing disabled.

These jobs intentionally generate a fresh consumer rather than committing native template output to BeeUI. This keeps the repository focused on the design system while continuously testing against the canonical React Native 0.86.2 application template.

## What this does not prove

A successful native compile does not replace interaction testing on a simulator or physical device. Dialog hardware-back behavior, focus behavior, screen-reader navigation, keyboard interactions, and visual correctness still require runtime smoke tests.
