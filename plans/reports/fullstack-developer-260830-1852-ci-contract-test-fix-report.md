# CI Contract Test Fix — Report (PR #329 follow-up)

## Executed Task
- Coordinator flagged PR #329's `verify` job failing: `scripts/__tests__/ios-build-cache-contract.test.mjs` still pinned the removed self-hosted pod-snapshot mechanism.
- Worktree: recreated `/Users/textsoft/workspace/beeui-wt-cimig` from `origin/ci/github-hosted-migration` (previous worktree had been removed between turns).
- Status: DONE

## What the test now asserts
Replaced 2 stale tests in `scripts/__tests__/ios-build-cache-contract.test.mjs` that pinned the removed `BEEUI_IOS_CACHE_ROOT`/`BEEUI_PODS_FRESH` rsync snapshot mechanism:

1. **`ios-native runs a plain pod install on PATH with no self-hosted snapshot rsync`**
   - asserts `run: pod install` is present (no hardcoded `/opt/homebrew/bin/pod`)
   - asserts `BEEUI_PODS_FRESH`, `pods-cache/showcase`, and `rsync -a --delete` are all gone from ci.yml

2. **`ios-native caches CocoaPods spec/download data and Xcode DerivedData via actions/cache`**
   - asserts the `Cache CocoaPods` step exists with paths `~/.cocoapods` and `~/Library/Caches/CocoaPods`, key `pods-macos-${{ hashFiles('pnpm-lock.yaml') }}`
   - asserts the `Cache Xcode DerivedData` step exists with path `~/Library/Developer/Xcode/DerivedData`, key `dd-macos-${{ hashFiles('pnpm-lock.yaml') }}`
   - asserts the xcodebuild step's `derived_data=` variable resolves under `$HOME/Library/Developer/Xcode/DerivedData/showcase` (the standard, cache-covered path)

Kept the test meaningful (still verifies the ios-native pod/DerivedData caching contract) rather than gutting it — just points at the github-hosted reality instead of the retired self-hosted snapshot.

The other 8 tests in that file (DerivedData persistence flags, bare-consumer script, gating outputs, nightly backstop, etc.) were untouched — they don't reference the removed mechanism and still hold.

## Tests Status
- `node --test scripts/__tests__/ios-build-cache-contract.test.mjs scripts/__tests__/classify-ci-changes.test.mjs`: 32/32 pass
- `pnpm test` (after `pnpm install --frozen-lockfile` in the fresh worktree, Node 24.13.1 via nvm): 66 suites / 716 tests pass, plus registry:verify + registry:test (29/29) pass
- `git diff --check`: clean

## Files Modified
- `/Users/textsoft/workspace/beeui-wt-cimig/scripts/__tests__/ios-build-cache-contract.test.mjs` (only file touched, 21 insertions / 14 deletions)

## Commit / Push
- Commit: `test: update ios-native cache contract for github-hosted pod install`
- Pushed to `ci/github-hosted-migration` — updates PR #329
- New head: `1c0ecb2048015bedd69dc6fd3350f39a8f39005b` (was `6aa6cc520aa9998c345a4f3e05cec54c4fa52eee`)
- PR: https://github.com/beobungbu/BeeUI/pull/329
- main untouched

Status: DONE
Summary: Rewrote the 2 stale ios-build-cache-contract assertions to match the new github-hosted pod install + CocoaPods/DerivedData actions/cache reality; full local test suite green; pushed to update PR #329, which will re-run CI on github-hosted.
PR: https://github.com/beobungbu/BeeUI/pull/329  Head: 1c0ecb2048015bedd69dc6fd3350f39a8f39005b
Concerns/Blockers: none — awaiting the PR's own re-run to confirm the `verify` job now passes end-to-end on github-hosted.
