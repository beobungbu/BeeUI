# Native iOS CI change classification

BeeUI keeps full native iOS compile proof on every push to `main`, while pull requests may skip the expensive macOS `ios-native` job when their diff is demonstrably isolated from native build inputs.

The implementation lives in `scripts/classify-ci-changes.mjs` and is exercised by `scripts/__tests__/classify-ci-changes.test.mjs`. Persistent iOS build-cache behavior is locked by `scripts/__tests__/ios-build-cache-contract.test.mjs`.

## Pull-request policy

A pull request may skip `ios-native` only when every changed path is classified as native-iOS-safe. The current safe surface is intentionally narrow:

- `README.md`
- `CHANGELOG.md`
- `docs/**`
- `registry/**`
- `apps/visual-regression/**`
- `apps/showcase/__tests__/patterns/**`
- repository-local registry/CLI implementation files explicitly listed by the classifier

Production pattern implementation under `apps/showcase/patterns/**` is **not** native-safe. Pattern files became executable native Showcase inputs when the canonical Pattern Gallery was integrated into `App.tsx` through `ShowcaseRoot -> PatternGallery -> pattern catalog -> pattern packs`. A change to a production screen such as `apps/showcase/patterns/auth/screens/sign-in-screen.tsx` can therefore affect the Android/iOS Showcase bundle and must schedule `ios-native`.

Pattern-specific test files under `apps/showcase/__tests__/patterns/**` remain safe because those tests are not bundled into the executable native Showcase. Gallery/component tests are also test-only, but executable implementation paths such as `apps/showcase/pattern-gallery/**`, `apps/showcase/component-gallery/**`, `apps/showcase/showcase-root.tsx`, and `apps/showcase/App.tsx` are native-sensitive by the classifier's default/fail-safe behavior.

Everything not explicitly safe is native-sensitive by default. That includes package implementation, executable Showcase files, root dependency/workspace metadata, workflow changes, native verification scripts, and unknown/new paths.

An empty changed-file list also runs native verification as a fail-safe.

## Force native verification

Add the `ci:native` label to a pull request to force native iOS verification. The workflow subscribes to pull-request label events, so adding the label starts a fresh CI run.

## Main policy

Pushes to `main` always run `ios-native`, regardless of path classification. This means the optimization affects pull-request iteration time without weakening the native compile proof attached to merged main commits.

## Persistent macOS build caches

The self-hosted macOS runner keeps performance caches under `~/Library/Caches/BeeUI` instead of placing reusable compiler output under `RUNNER_TEMP`.

For the Expo Showcase and the fresh bare React Native consumer:

- DerivedData is persistent across jobs;
- DerivedData paths are separated by Xcode version and `Podfile.lock` SHA-256 so a different toolchain or native dependency graph does not reuse the same incremental output directory;
- Xcode 26 compilation caching is explicitly enabled with `COMPILATION_CACHE_ENABLE_CACHING=YES`;
- `-showBuildTimingSummary` is enabled so warm/cold behavior can be measured from CI logs;
- the bare React Native consumer is still recreated from scratch on every verification run; only compiler outputs and Ruby gems are reused;
- the bare consumer's Bundler path is persistent and separated by Ruby version, CPU architecture, and React Native version;
- CocoaPods still performs `pod install`; no committed or blindly restored `Pods/` directory is treated as authoritative.

These caches are performance hints, not verification artifacts. `xcodebuild` still evaluates the current workspace, scheme, Pod lockfile, sources, and build settings on every native job.

## Maintenance rule

The safe list describes current build topology, not permanent architectural truth. If a safe path starts participating in the executable native Showcase or another native build input, update the classifier in the same change. Prefer false positives (an unnecessary native build) over false negatives (skipping a native build that could have detected a regression).

Persistent cache keys must remain conservative. When Xcode, React Native, Ruby, CocoaPods inputs, or another native dependency boundary changes in a way that invalidates reuse assumptions, update the cache key/layout in the same PR rather than deleting correctness checks.
