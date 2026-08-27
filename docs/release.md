# BeeUI release contract

This document defines what a BeeUI `0.x` release candidate means and separates automated package/compile proof from runtime/device proof.

## Current distribution model

BeeUI is not publicly published to npm. `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` remain `private: true` while pre-1.0 distribution is productized.

Current consumption/verification modes:

1. workspace consumption inside the monorepo;
2. packed tarballs for package-boundary verification and controlled/internal consumer testing;
3. the implemented phase-1 repository-local Registry + source-ownership CLI.

Packed tarballs are verification artifacts, not a public npm claim. Public CLI/package naming, broader registry coverage, compatibility guarantees, release automation, and the final public package/source-ownership support model remain roadmap work.

### Web transport resolution scope

The anchored-overlay transport ships as platform files (`overlay-transport.web.tsx`, `.native.tsx`, `.d.ts`). The current proven Web environment is **Expo Web / current Metro**, whose resolver includes `web` platform files. Arbitrary React Native Web/generic bundlers and public npm conditional exports are not yet guaranteed.

## Versioning policy

All BeeUI packages use one lockstep version matching the workspace root.

During `0.x`:

- patch releases must not intentionally break documented public behavior;
- minor releases may change documented APIs while the foundation stabilizes;
- intentional breaking changes require changelog/migration notes;
- package versions must not drift;
- packed manifests must not expose unresolved `workspace:*` dependency ranges.

## Automated release gates

CI may claim only what its jobs actually prove.

| Gate | Command/job | Environment | Evidence | Blocking |
| --- | --- | --- | --- | --- |
| frozen dependency graph | `pnpm install --frozen-lockfile` | Linux/macOS as scheduled | successful install | yes |
| TypeScript contract | `pnpm typecheck` | Linux | CI step | yes |
| behavioral contract tests | `pnpm test` | Linux | Jest / RNTL / Registry tests | yes |
| package/release contract | `pnpm release:verify` | Linux | release verification artifact | yes |
| Expo Web/Android/iOS exports | `verify` | Linux | Expo export | yes |
| Expo native generation | `verify` | Linux | clean prebuild | yes |
| bare RN package install | `bare-native` | Linux | packed BeeUI tarballs in fresh RN app | yes |
| bare Android + iOS Metro | `bare-native` | Linux | production bundles | yes |
| bare Android native compile | `bare-native` | Linux | debug APK | yes |
| deterministic Web visual/browser QA | `visual-web` | Linux | canonical pixels + integration tests | yes |
| Expo Showcase native iOS Simulator compile | `ios-native` | macOS ARM64 | CocoaPods + `xcodebuild` generic simulator | when scheduled / always on main |
| true bare RN native iOS Simulator compile | `ios-native` | macOS ARM64 | fresh RN consumer + CocoaPods + `xcodebuild` | when scheduled / always on main |
| real iOS Simulator runtime smoke | `native-runtime-smoke / ios-runtime` | booted modern iPhone Simulator | exact-head metadata + Maestro log + screenshots/video + native logs | nightly / manual / `ci:runtime` |
| real Android Emulator runtime smoke | `native-runtime-smoke / android-runtime` | Pixel-class API 36 emulator | exact-head metadata + Maestro log + real ADB Back log + screenshots/logcat | nightly / manual / `ci:runtime` |

`pnpm release:verify` checks package names/versions, explicit packed files, exports, peers, Expo import boundaries, packed-manifest workspace rewriting, clean installation, and clean-consumer behavior.

The `visual-web` gate owns both deterministic component pixels and browser integration. It does not substitute for native runtime interaction.

The native runtime smoke jobs are not ordinary PR gates. They run nightly, by manual dispatch, when a PR is labeled `ci:runtime`, and on the runtime-foundation workstream itself so that the framework can obtain exact-head proof before review. See `docs/native-runtime-smoke.md`.

### Anchored-overlay deterministic contracts

For the current anchored-overlay runtime, automated tests may prove source-level contracts including:

- context preservation on web-dom and native-teleport test seams;
- defensive legacy context loss/insertion/remount behavior;
- per-scope topmost dismissal and semantic scope depth;
- initial-open and nested-modal global-dismiss ordering independent of React effect order;
- staged root-behind-modal Web Escape where the root overlay registers in a later commit;
- modal-local non-zero geometry and host-move remeasurement;
- latest-request-wins async host/anchor measurement;
- Android Modal request-close child-first policy;
- iOS request-close non-interception;
- RN Modal presentation props: `overFullScreen` transparent; `fullScreen` / `pageSheet` / `formSheet` non-transparent so native presentation is not coerced.

These tests do **not** prove live native sheet presentation or swipe interaction. Exact-head Simulator/Emulator runtime evidence is recorded separately by the native runtime smoke layer.

## Pull-request native iOS scheduling

The expensive `ios-native` job is change-aware on pull requests. `scripts/classify-ci-changes.mjs` may skip macOS only when every changed path is on a conservative native-safe list. Package source, executable Showcase files, dependencies/lock/workspace metadata, workflow/native-verification files, classifier changes, and unknown paths default to native verification. Empty/unclassifiable diffs fail safe. The `ci:native` label may force a run. Pushes to `main` always run native iOS verification.

If a path later becomes executable native input, tighten the classifier in the same change.

## Native build cache policy

Trusted macOS native caches are performance-only. The fresh bare RN consumer is still recreated, BeeUI tarballs are repacked/reinstalled, and CocoaPods/build evaluation runs against current source. Cache hits never replace evidence.

Runtime-smoke DerivedData reuse is also performance-only. Each runtime run still performs clean Expo Prebuild, CocoaPods evaluation, exact-head app build/install, fresh app state, and a real booted Simulator/Emulator interaction pass.

## Native verification ownership

Linux owns TypeScript/tests/release verification, Expo exports/Prebuild, packed bare-consumer installation, Metro bundles, and Android native compilation.

The trusted macOS ARM64 runner owns compile-only iOS verification for the Expo Showcase and a fresh true bare React Native consumer. It targets `generic/platform=iOS Simulator`; it does **not** boot or interact with Simulator.

The separate `native-runtime-smoke` workflow owns booted Simulator/Emulator interaction. It does not replace compile proof and must not be generalized into physical-device proof.

See `docs/native-verification.md` for the package-installed/native-build contract and `docs/native-runtime-smoke.md` for live native runtime automation.

## Runtime and device gates

Compile-only CI and browser QA cannot prove real native interaction.

| Gate | Required environment | Record |
| --- | --- | --- |
| iOS `pageSheet` / `formSheet` actual presentation, anchored placement, swipe request-close | iOS Simulator/device | exact SHA, device/OS, presentationStyle, steps, screenshot/video, result |
| non-zero safe-area behavior | iOS/Android simulator/device | device + orientation + result |
| VoiceOver behavior | iOS simulator/device | representative flows + result |
| TalkBack behavior | Android emulator/device | representative flows + result |
| focus/keyboard runtime interaction | supported simulator/device/browser | flow + result |
| Android hardware-back interaction | Android emulator/device | exact overlay/Dialog flow + result |
| representative native visuals | supported light/dark form factors | screenshots/review note |
| RTL / large-text stress where release-relevant | supported simulator/device/browser | scenario + result |

Native iOS compilation is already CI-proven and must not be listed as a manual compile gate.

The runtime smoke suite now automates a representative subset of these rows on real virtual devices: iOS sheets/swipe/child overlays/keyboard/safe-area plus Android real `KEYCODE_BACK`, nested child-first dismissal, AlertDialog policy, keyboard, reduced height, and scrolling. VoiceOver, TalkBack, RTL/large-text stress, and physical-device behavior remain separate evidence unless explicitly run and recorded.

### Evidence classification

For runtime-sensitive PRs, record evidence as one of:

- **exact-head automated** — CI/test output tied to the current head;
- **exact-head device/simulator** — runtime interaction performed on the exact head;
- **deterministic-only** — source/Jest/browser contract that intentionally does not claim native interaction;
- **prior-head supporting evidence** — useful history, never represented as exact-current proof.

A release note must not convert compile/deterministic proof into a claim that safe areas, focus, keyboard, VoiceOver/TalkBack, native sheet behavior, hardware-back runtime behavior, or native visuals passed.

## Simulator/device finding evidence

When a simulator/device acceptance pass finds an issue, use one finding per PR comment and include:

- exact tested SHA;
- platform/device/OS;
- scenario and reproduction steps;
- expected vs actual;
- screenshot/video/log/accessibility-tree evidence where applicable;
- reproducibility rate;
- severity;
- whether code was modified (test-first passes should say `NO`).

A final summary comment should link every finding and list PASS / FINDINGS / NOT TESTED. This preserves an auditable separation between discovery evidence and later fixes.

## Release candidate checklist

A release candidate may be cut only when:

1. all automated gates applicable to the exact candidate are green;
2. release verification reports pass;
3. deterministic visual/browser QA is green;
4. `CHANGELOG.md` contains candidate changes;
5. migration notes exist for intentional breaking changes;
6. required runtime/device gates are recorded, or the candidate is explicitly labeled as not fully device-verified.

Public-package releases will additionally need proof of actual published artifacts in clean consumers.

## Changelog convention

`CHANGELOG.md` keeps an `Unreleased` section. Entries describe user-visible behavior, dependency/compatibility changes, distribution behavior, release infrastructure affecting consumers, and migrations. Pure refactors without consumer impact need no entry.

## Roadmap boundary

This file documents **current release evidence**. Future readiness work belongs in `docs/roadmap.md`. Do not describe future work as shipped or shipped automated evidence as a manual future gate.
