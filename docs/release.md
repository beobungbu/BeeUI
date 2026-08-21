# BeeUI release contract

This document defines what a BeeUI `0.x` release candidate means and separates automated proof from gates that still require macOS or real runtime interaction.

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

The Linux CI pipeline is allowed to claim only what it actually proves.

| Gate | Command/job | Evidence | Blocking |
| --- | --- | --- | --- |
| frozen dependency graph | `pnpm install --frozen-lockfile` | successful install | yes |
| TypeScript contract | `pnpm typecheck` | CI step | yes |
| behavioral contract tests | `pnpm test` | React Native Testing Library result | yes |
| package/release contract | `pnpm release:verify` | `.artifacts/release-verification.json` | yes |
| Expo web bundle | `verify` job | Expo export | yes |
| Expo Android bundle | `verify` job | Expo export | yes |
| Expo iOS bundle | `verify` job | Expo export | yes |
| Expo native generation | `verify` job | clean prebuild | yes |
| bare RN package install | `bare-native` job | packed tarballs installed in fresh RN app | yes |
| bare Android + iOS Metro | `bare-native` job | production bundles | yes |
| bare Android native compile | `bare-native` job | debug APK | yes |

`pnpm release:verify` checks package names/versions, explicit packed files, export targets, peer dependency expectations, the Expo import boundary, packed-manifest workspace-protocol rewriting, clean package installation, and the absence of Expo in the clean package smoke.

## macOS and runtime gates

The following remain release gates but cannot truthfully be marked green by the current Linux runner:

| Gate | Required environment | Record before release candidate |
| --- | --- | --- |
| bare iOS native binary compilation | macOS + Xcode + CocoaPods | build result/commit |
| non-zero safe-area interaction | iOS/Android simulator or device with system insets | device + orientation + result |
| Dialog interaction | simulator/device | focus, dismiss, keyboard, Android hardware-back |
| screen reader | VoiceOver and TalkBack | representative interactive flows |
| `VisuallyHidden` assistive behavior | VoiceOver and TalkBack | reading-order result |
| representative visual review | supported light/dark form factors | screenshots or review note |

Until these are automated, a release note must not phrase them as CI-proven.

## Release candidate checklist

A release candidate can be cut only when all automated gates are green on the exact candidate commit, the release-verification artifact reports `status: pass`, and `CHANGELOG.md` contains the candidate changes. If a change alters a documented public API or behavior, its migration note must exist before the candidate is tagged.

The reviewer then records the applicable macOS/runtime gates above. A candidate with an unverified manual gate may be used for internal development, but it must be labeled as not fully device-verified.

## Changelog convention

`CHANGELOG.md` keeps an `Unreleased` section. Entries describe user-visible package behavior, dependency/compatibility changes, release infrastructure that affects consumers, and migrations. Pure refactors that do not affect consumers do not need an entry.

When a version is cut, move the relevant `Unreleased` entries under a dated version heading and create a fresh empty `Unreleased` section.
