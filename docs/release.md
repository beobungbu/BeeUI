# BeeUI release contract

This document defines what a BeeUI `0.x` release candidate means and separates automated Linux/macOS proof from gates that still require real runtime or device interaction.

## Current distribution model

BeeUI is not publicly published to npm yet. `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` intentionally remain `private: true` while the pre-1.0 distribution workflow is being validated.

The repository currently supports three consumption modes:

1. workspace consumption inside the BeeUI monorepo;
2. packed tarballs for package-boundary verification and controlled/internal consumer testing;
3. source ownership in application work while the future registry/CLI workflow is still unimplemented.

Packed tarballs are a verification artifact, not a claim that a public registry channel exists. Before `1.0`, BeeUI still intends to provide a documented registry/CLI distribution workflow so applications can adopt source intentionally without depending on monorepo paths.

## Versioning policy

All three BeeUI packages use one lockstep version matching the workspace root.

During `0.x`:

- patch releases must not intentionally break documented public behavior;
- minor releases may change documented APIs while the foundation is being stabilized;
- any intentional breaking change must be called out under `CHANGELOG.md` and include a migration note;
- package versions must never drift from one another;
- a release must not expose unresolved `workspace:*` dependency ranges in its packed manifests.

`1.0` requires the architecture gates listed in `docs/architecture.md`, including stable tokens, accessibility coverage, visual regression coverage, and a registry/CLI distribution workflow.

## Automated release gates

CI is allowed to claim only what its Linux and macOS jobs actually prove.

| Gate | Command/job | Environment | Evidence | Blocking |
| --- | --- | --- | --- | --- |
| frozen dependency graph | `pnpm install --frozen-lockfile` | Linux `beeui`; macOS ARM64 `beeui-macos` for native iOS | successful install | yes |
| TypeScript contract | `pnpm typecheck` | Linux `beeui` | CI step | yes |
| behavioral contract tests | `pnpm test` | Linux `beeui` | React Native Testing Library result | yes |
| package/release contract | `pnpm release:verify` | Linux `beeui` | `.artifacts/release-verification.json` | yes |
| Expo web bundle | `verify` job | Linux `beeui` | Expo export | yes |
| Expo Android bundle | `verify` job | Linux `beeui` | Expo export | yes |
| Expo iOS bundle | `verify` job | Linux `beeui` | Expo export | yes |
| Expo native generation | `verify` job | Linux `beeui` | clean prebuild | yes |
| bare RN package install | `bare-native` job | Linux `beeui` | packed tarballs installed in fresh RN app | yes |
| bare Android + iOS Metro | `bare-native` job | Linux `beeui` | production bundles | yes |
| bare Android native compile | `bare-native` job | Linux `beeui` | debug APK | yes |
| Expo native iOS Simulator compile | `ios-native` job | macOS ARM64 `beeui-macos` | CocoaPods + `xcodebuild` against `generic/platform=iOS Simulator` | yes |
| true bare RN native iOS Simulator compile | `ios-native` job | macOS ARM64 `beeui-macos` | fresh React Native 0.86.2 consumer + CocoaPods + `xcodebuild` against `generic/platform=iOS Simulator` | yes |

`pnpm release:verify` checks package names/versions, explicit packed files, export targets, peer dependency expectations, the Expo import boundary, packed-manifest workspace-protocol rewriting, clean package installation, and the absence of Expo in the clean package smoke.

Linux owns the cross-platform, package, Metro, Expo generation, and Android native gates. The trusted macOS ARM64 runner owns native iOS compilation for both the Expo Showcase and a fresh true bare React Native consumer. These iOS gates are compile-only: `xcodebuild` targets `generic/platform=iOS Simulator` and does not boot or interact with a simulator.

### Pull-request native iOS scheduling

The expensive `ios-native` job is change-aware on pull requests. `scripts/classify-ci-changes.mjs` may skip the macOS job only when **every** changed path is on a conservative native-safe list, currently documentation/changelog files, isolated Showcase pattern sources/tests, the standalone visual-regression app, and registry/local-CLI-only files. Any package source, executable Showcase file, dependency/lock/workspace metadata, workflow file, native verification script, classifier change, or otherwise unknown path defaults to native verification.

An empty or unclassifiable diff also fails safe by running native verification. A maintainer can add the `ci:native` label to force a fresh pull-request run with native iOS verification. Pushes to `main` always run the full `ios-native` gate regardless of changed paths, so merged main commits retain complete native compile proof.

The native-safe list is an optimization contract, not an architectural claim that those paths can never affect native behavior. If an isolated pattern becomes part of the executable Showcase/native bundle, or another currently safe path begins participating in native build inputs, the classifier must be tightened in the same change.

## Runtime and device gates

The following remain release gates because compile-only CI cannot prove runtime interaction or representative device behavior:

| Gate | Required environment | Record before release candidate |
| --- | --- | --- |
| non-zero safe-area behavior | iOS/Android simulator or device with system insets | device + orientation + result |
| VoiceOver behavior | iOS simulator/device with VoiceOver | representative interactive flows + result |
| TalkBack behavior | Android emulator/device with TalkBack | representative interactive flows + result |
| focus behavior requiring runtime interaction | supported simulator/device/browser | component/flow + result |
| keyboard interaction requiring runtime interaction | supported simulator/device/browser | component/flow + result |
| runtime navigation/accessibility interaction | supported simulator/device/browser | representative flow + result |
| Android hardware-back interaction | Android emulator/device | affected overlay/dialog flow + result |
| representative visual/device verification | supported light/dark form factors | screenshots or review note |

Native iOS compilation is CI-proven; device execution and interaction are not. A release note must not turn compile proof into a claim that safe-area behavior, focus, keyboard interaction, VoiceOver/TalkBack, navigation/accessibility interaction, or visual correctness passed at runtime.

## Release candidate checklist

A release candidate can be cut only when all automated gates are green on the exact candidate commit, the release-verification artifact reports `status: pass`, and `CHANGELOG.md` contains the candidate changes. If a change alters a documented public API or behavior, its migration note must exist before the candidate is tagged.

The reviewer then records the applicable runtime/device gates above. A candidate with an unverified manual gate may be used for internal development, but it must be labeled as not fully device-verified.

## Changelog convention

`CHANGELOG.md` keeps an `Unreleased` section. Entries describe user-visible package behavior, dependency/compatibility changes, release infrastructure that affects consumers, and migrations. Pure refactors that do not affect consumers do not need an entry.

When a version is cut, move the relevant `Unreleased` entries under a dated version heading and create a fresh empty `Unreleased` section.
