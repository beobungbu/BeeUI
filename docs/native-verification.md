# Native verification contract

BeeUI's foundation CI proves TypeScript, behavioral contracts, Expo/Metro exports, and Expo Prebuild generation. This document defines the next portability gate: consuming BeeUI from a newly generated React Native application that has no Expo runtime.

## Bare consumer

`scripts/verify-bare-consumer.sh` creates a fresh React Native 0.86.2 application using the React Native Community CLI, installs only BeeUI's styling/runtime dependencies, vendors the BeeUI source packages into that isolated consumer, and configures Metro with `@react-native/metro-config` plus Uniwind.

The smoke app imports real BeeUI components, semantic theme CSS, form state, selection state, and `Dialog`. It creates production Metro bundles for both Android and iOS before any native build begins.

A bare-consumer run fails if the generated application can resolve the Expo runtime.

## Native compilation

The `bare-native` CI job runs on BeeUI's Linux self-hosted runner. It installs the required Android SDK/NDK toolchain, builds the generated application's debug APK with Gradle, and verifies that `app-debug.apk` exists.

The same bare consumer also produces an iOS JavaScript bundle through React Native Metro, so BeeUI's source/Uniwind integration is exercised for the iOS platform without Expo.

A native iOS binary cannot be compiled on the current Linux runner. That gate requires a macOS self-hosted runner or available GitHub-hosted macOS capacity. Until one is connected, native iOS compilation remains a documented release gate rather than a passing CI claim.

The initial hosted-runner attempt was intentionally removed after GitHub failed both hosted Linux and macOS jobs at scheduling time with no executed steps or job log, while BeeUI's self-hosted runner continued normally.

## What this does not prove

A successful native compile does not replace interaction testing on a simulator or physical device. Dialog hardware-back behavior, focus behavior, screen-reader navigation, keyboard interactions, and visual correctness still require runtime smoke tests.
