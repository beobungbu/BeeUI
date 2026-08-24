# BeeUI release contract

This document defines what a BeeUI `0.x` release candidate means and separates automated package/compile proof from runtime/device proof.

## Current distribution model

BeeUI is not publicly published to npm yet. `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` intentionally remain `private: true` while the pre-1.0 distribution workflow is productized.

The repository currently supports three consumption/verification modes:

1. workspace consumption inside the BeeUI monorepo;
2. packed tarballs for package-boundary verification and controlled/internal consumer testing;
3. the implemented phase-1 repository-local Registry + source-ownership CLI.

The Registry/CLI is real and documented in `docs/registry-cli.md`; it is no longer a merely hypothetical future workflow. However, it is intentionally not yet a public `npx beeui` product, and its public registry coverage is still limited to the phase-1 component set.

Packed tarballs remain verification artifacts, not a claim that a public npm channel exists.

Before public 1.0, BeeUI still needs to productize distribution: publishable CLI/package naming, broader stable registry coverage, explicit compatibility guarantees, release automation, and the chosen public npm/source-ownership support model. See `docs/roadmap.md`.

### Web transport resolution scope

The anchored-overlay transport ships as platform files (`overlay-transport.web.tsx` / `.native.tsx` / `.d.ts`). Resolving the `.web` file needs the bundler to treat `web` as a platform extension. The Showcase Metro config adds `web` to `resolver.platforms`, and the automated Web regression (`visual-web`, over the exported Showcase) proves the `web-dom` (`ReactDOM.createPortal`) transport **under Expo Web / that Metro configuration**.

This is **not** yet a guarantee that arbitrary React Native Web bundlers or generic consumer bundlers resolve the `.web` platform file the same way. A portable web-resolution contract (e.g. conditional package `exports`) is part of the public-distribution hardening above and is not a pre-1.0 guarantee. Docs must not claim arbitrary-bundler web support beyond the tested Expo/Metro environment.

## Versioning policy

All BeeUI packages use one lockstep version matching the workspace root.

During `0.x`:

- patch releases must not intentionally break documented public behavior;
- minor releases may change documented APIs while the foundation is being stabilized;
- intentional breaking changes must be called out under `CHANGELOG.md` with migration notes;
- package versions must never drift from one another;
- packed manifests must not expose unresolved `workspace:*` dependency ranges.

The current BeeUI 1.0 exit criteria are maintained in `docs/roadmap.md` rather than being inferred from component count alone.

## Automated release gates

CI may claim only what its jobs actually prove.

| Gate | Command/job | Environment | Evidence | Blocking |
| --- | --- | --- | --- | --- |
| frozen dependency graph | `pnpm install --frozen-lockfile` | Linux `beeui`; macOS ARM64 `beeui-macos` where native iOS is scheduled | successful install | yes |
| TypeScript contract | `pnpm typecheck` | Linux `beeui` | CI step | yes |
| behavioral contract tests | `pnpm test` | Linux `beeui` | Jest / React Native Testing Library / Registry tests | yes |
| package/release contract | `pnpm release:verify` | Linux `beeui` | `.artifacts/release-verification.json` | yes |
| Expo Web bundle | `verify` | Linux `beeui` | Expo export | yes |
| Expo Android bundle | `verify` | Linux `beeui` | Expo export | yes |
| Expo iOS bundle | `verify` | Linux `beeui` | Expo export | yes |
| Expo native generation | `verify` | Linux `beeui` | clean prebuild | yes |
| bare RN package install | `bare-native` | Linux `beeui` | packed BeeUI tarballs installed into a fresh RN app | yes |
| bare Android + iOS Metro | `bare-native` | Linux `beeui` | production bundles | yes |
| bare Android native compile | `bare-native` | Linux `beeui` | debug APK | yes |
| deterministic Web visual regression | `visual-web` workflow | Linux `beeui` | comparison against committed Chromium baselines | yes |
| Expo Showcase native iOS Simulator compile | `ios-native` | macOS ARM64 `beeui-macos` | CocoaPods + `xcodebuild` for `generic/platform=iOS Simulator` | when scheduled / always on main |
| true bare RN native iOS Simulator compile | `ios-native` | macOS ARM64 `beeui-macos` | fresh RN 0.86.2 consumer + CocoaPods + `xcodebuild` | when scheduled / always on main |

`pnpm release:verify` checks package names/versions, explicit packed files, export targets, peer dependency expectations, the Expo import boundary, packed-manifest workspace-protocol rewriting, clean package installation, and the absence of Expo in the clean package smoke.

The `visual-web` workflow is intentionally independent from native compile jobs and compares 28 deterministic Chromium baselines. Visual comparison does not replace behavior/accessibility/native evidence.

## Pull-request native iOS scheduling

The expensive `ios-native` job is change-aware on pull requests.

`scripts/classify-ci-changes.mjs` may skip macOS only when **every** changed path is on a conservative native-safe list. Current safe classes include documentation/changelog changes, isolated Showcase pattern source/tests, the standalone visual-regression app, and explicitly enumerated repository-local Registry/CLI files.

Package source, executable Showcase files, dependencies/lock/workspace metadata, workflow files, native verification scripts, classifier changes, and unknown paths default to native verification.

An empty/unclassifiable diff fails safe by running native verification.

A maintainer may add `ci:native` to force a fresh PR run with native iOS verification.

Pushes to `main` always run the full `ios-native` gate, regardless of PR classification. This retains complete native compile proof on integrated main commits.

If a currently native-safe path later becomes executable native input, the classifier must be tightened in the same change.

## macOS native build cache policy

The trusted self-hosted macOS runner reuses performance-only native caches.

- Showcase and bare-RN DerivedData live under `~/Library/Caches/BeeUI`.
- Cache separation includes selected Xcode version and resulting `Podfile.lock` hash.
- Xcode 26 compilation caching is explicitly enabled.
- Both native builds emit `-showBuildTimingSummary`.
- Bare-RN Bundler gems use a persistent cache separated by Ruby version, CPU architecture, and React Native version.

The true bare RN consumer itself remains fresh: its working directory is deleted/recreated, BeeUI tarballs are repacked/reinstalled, and CocoaPods runs against the newly generated project on every verification.

Cache hits are performance hints, never substitute evidence for the current source/build graph.

## Native verification ownership

Linux owns:

- TypeScript/tests/release verification;
- Expo exports and Prebuild;
- bare package installation;
- bare Android/iOS Metro bundles;
- Android native compilation.

The trusted macOS ARM64 runner owns native iOS compilation for both:

- the generated Expo Showcase workspace;
- a fresh true bare React Native consumer.

The iOS gate is compile-only: it targets `generic/platform=iOS Simulator` and does not boot or interact with a simulator.

See `docs/native-verification.md` for the package-installed/native-build contract.

## Runtime and device gates

The following remain release gates because compile-only CI and Chromium screenshot comparison cannot prove real device interaction:

| Gate | Required environment | Record before release candidate |
| --- | --- | --- |
| non-zero safe-area behavior | iOS/Android simulator or device with system insets | device + orientation + result |
| VoiceOver behavior | iOS simulator/device with VoiceOver | representative interactive flows + result |
| TalkBack behavior | Android emulator/device with TalkBack | representative interactive flows + result |
| focus behavior requiring runtime interaction | supported simulator/device/browser | component/flow + result |
| keyboard interaction requiring runtime interaction | supported simulator/device/browser | component/flow + result |
| runtime navigation/accessibility interaction | supported simulator/device/browser | representative flow + result |
| Android hardware-back interaction | Android emulator/device | affected overlay/dialog flow + result |
| representative native visual verification | supported light/dark form factors | screenshots or review note |
| RTL / large-text stress where release-relevant | supported simulator/device/browser | scenario + result |

Native iOS compilation is already CI-proven. Do not list “compile iOS on macOS” as a manual gate anymore.

A release note must not turn compile proof into a claim that safe areas, focus, keyboard, VoiceOver/TalkBack, runtime navigation/accessibility behavior, or native visual correctness passed at runtime.

The roadmap targets a protected iOS/Android simulator/device smoke tier so part of this evidence can move from manual release review into automation without making every PR prohibitively expensive.

## Release candidate checklist

A release candidate may be cut only when:

1. all automated gates applicable to the exact candidate commit are green;
2. `.artifacts/release-verification.json` reports `status: pass`;
3. deterministic visual comparison is green;
4. `CHANGELOG.md` contains the candidate changes;
5. migration notes exist for intentional breaking changes;
6. required runtime/device gates have been recorded or the candidate is explicitly labeled as not fully device-verified.

For public-package releases, the future public distribution pipeline must additionally prove the actual published artifacts in clean consumers rather than relying only on internal tarball packing.

## Changelog convention

`CHANGELOG.md` keeps an `Unreleased` section.

Entries describe user-visible package behavior, dependency/compatibility changes, distribution behavior, release infrastructure that affects consumers, and migrations. Pure refactors without consumer impact do not need an entry.

When a version is cut, move the applicable `Unreleased` entries under a dated version heading and create a fresh empty `Unreleased` section.

## Roadmap boundary

This file documents **current release evidence**. Future readiness work belongs in `docs/roadmap.md`.

Do not document roadmap work here as if it already ships, and do not leave implemented gates described as future/manual work.
