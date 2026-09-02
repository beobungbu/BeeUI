# Native CI change classification

BeeUI runs all CI on standard GitHub-hosted runners. Public-repository standard runners are unmetered for Actions minutes, but macOS concurrency and repository cache/storage remain finite resources. The classifier therefore optimizes **PR latency and runner concurrency**, not billing.

The implementation lives in `scripts/classify-ci-changes.mjs` and is exercised by `scripts/__tests__/classify-ci-changes.test.mjs`. Native build-contract behavior is locked by `scripts/__tests__/ios-build-cache-contract.test.mjs`.

## Pull-request policy

Every pull request, including a fork PR, runs the required `classify` and `verify` jobs on isolated GitHub-hosted Linux runners with `permissions: contents: read` and no repository secrets.

A pull request may skip the conditional `ios-native` job only when every changed path is classified as native-iOS-safe. The current safe surface is intentionally narrow:

- `README.md`
- `CHANGELOG.md`
- `docs/**`
- `registry/**`
- `apps/visual-regression/**`
- `apps/showcase/__tests__/patterns/**`
- repository-local registry/CLI implementation files explicitly listed by the classifier

Production pattern implementation under `apps/showcase/patterns/**` is **not** native-safe. Pattern files are executable native Showcase inputs through `ShowcaseRoot -> PatternGallery -> pattern catalog -> pattern packs`, so production-screen changes remain native-sensitive.

Pattern-specific test files under `apps/showcase/__tests__/patterns/**` remain safe because they are not bundled into the executable native Showcase. Executable implementation paths such as `apps/showcase/pattern-gallery/**`, `apps/showcase/component-gallery/**`, `apps/showcase/showcase-root.tsx`, and `apps/showcase/App.tsx` remain native-sensitive by default.

Everything not explicitly safe is native-sensitive. That includes package implementation, executable Showcase files, root dependency/workspace metadata, workflow changes, native verification scripts, and unknown/new paths. An empty changed-file list also forces native verification as a fail-safe.

## Force native verification

Add the `ci:native` label to a pull request to force native verification. The workflow subscribes to pull-request label events, so adding or removing the label starts a fresh CI run.

## Main and scheduled policy

Pushes to `main` always force the full native compile graph regardless of path classification. This attaches a complete compile proof to every merged main commit.

A weekly scheduled run repeats the full graph from a fresh hosted environment to detect runner-image or external-toolchain drift when the repository is otherwise idle. A nightly duplicate is unnecessary because PRs and main pushes already provide continuous coverage.

`runtime-native.yml` separately runs real iOS Simulator and Android Emulator smoke on every push to `main`, on explicit `ci:runtime`/runtime-test PRs, on manual dispatch, and as a weekly backstop.

## Hosted-runner cache policy

Each GitHub-hosted job starts on a fresh VM. Correctness must never depend on local state surviving from a prior job or run.

BeeUI only persists caches with clear reuse value and bounded size:

- pnpm store;
- CocoaPods download/spec caches;
- Gradle caches;
- Playwright browsers;
- Maestro CLI and the Android AVD where applicable.

Xcode `DerivedData` is intentionally **not** stored in Actions cache. It is large, build-specific compiler output and competes with the repository's finite Actions cache quota. iOS builds use job-local DerivedData and always execute a real `xcodebuild` against the current generated workspace, scheme, Pod lockfile, source and settings.

The bare React Native and Expo consumers are recreated in isolated hosted environments; package tarballs are installed through their real package boundary on each verification path. CocoaPods still performs a real `pod install`; no committed or blindly restored `Pods/` tree is authoritative.

## Maintenance rule

The safe list describes current build topology, not permanent architectural truth. If a safe path starts participating in the executable native Showcase or another native build input, update the classifier in the same change. Prefer false positives (an unnecessary native build) over false negatives (skipping a native build that could have detected a regression).

Cache keys must remain conservative. When Node, pnpm, React Native, Gradle, CocoaPods, Playwright, Maestro or another cached dependency boundary changes, update the relevant key in the same PR rather than weakening correctness checks.
