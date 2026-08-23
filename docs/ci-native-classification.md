# Native iOS CI change classification

BeeUI keeps full native iOS compile proof on every push to `main`, while pull requests may skip the expensive macOS `ios-native` job when their diff is demonstrably isolated from native build inputs.

The implementation lives in `scripts/classify-ci-changes.mjs` and is exercised by `scripts/__tests__/classify-ci-changes.test.mjs`.

## Pull-request policy

A pull request may skip `ios-native` only when every changed path is classified as native-iOS-safe. The current safe surface is intentionally narrow:

- `README.md`
- `CHANGELOG.md`
- `docs/**`
- `registry/**`
- `apps/visual-regression/**`
- `apps/showcase/patterns/**`
- `apps/showcase/__tests__/patterns/**`
- repository-local registry/CLI implementation files explicitly listed by the classifier

Everything else is native-sensitive by default. That includes package implementation, executable Showcase files, root dependency/workspace metadata, workflow changes, native verification scripts, and unknown/new paths.

An empty changed-file list also runs native verification as a fail-safe.

## Force native verification

Add the `ci:native` label to a pull request to force native iOS verification. The workflow subscribes to pull-request label events, so adding the label starts a fresh CI run.

## Main policy

Pushes to `main` always run `ios-native`, regardless of path classification. This means the optimization affects pull-request iteration time without weakening the native compile proof attached to merged main commits.

## Maintenance rule

The safe list describes current build topology, not permanent architectural truth. If a safe path starts participating in the executable native Showcase or another native build input, update the classifier in the same change. Prefer false positives (an unnecessary native build) over false negatives (skipping a native build that could have detected a regression).
