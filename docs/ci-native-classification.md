# Native CI change classification

BeeUI runs CI on standard GitHub-hosted runners. Public-repository standard runner minutes are unmetered, while concurrent jobs and macOS slots remain finite. The classifier therefore optimizes **wall-clock latency and concurrency allocation**, not billing.

The implementation lives in `scripts/classify-ci-changes.mjs` and is exercised by `scripts/__tests__/classify-ci-changes.test.mjs`. Native build topology is locked by `scripts/__tests__/ios-build-cache-contract.test.mjs`.

## Parallel execution policy

Independent work must not wait behind unrelated work, but ready jobs must also be staged so optional work cannot randomly displace required checks at the hosted-runner concurrency ceiling.

At workflow start, `classify`, eight `verify-lane` jobs (`quality`, `tokens`, `contracts`, `docs`, `types`, `showcase-registry`, `bench`, `release`) and three Showcase export jobs (`web`, `android`, `ios`) start concurrently. The required `verify` status is only a lightweight fan-in aggregator after those lanes finish.

The old top-level CI sequence `pnpm typecheck` followed by `pnpm test` is deliberately decomposed across these lanes. All constituent checks remain covered, but the critical path is now the slowest lane rather than the sum of all checks. Classifier/topology contract tests live in the `contracts` lane instead of delaying `classify`. Only the `tokens` lane fetches full Git history because its token-removal guard compares against repository history; the other verification lanes use shallow checkout.

Once `classify` resolves the native graph, `ios-bare` becomes eligible immediately because it is a long macOS proof. The remaining native jobs are independent proofs but use the completed Showcase export matrix as a **scheduling barrier**:

- `bare-bundle`: packed bare-RN consumer prepare + Android/iOS Metro bundle proof;
- `bare-android`: independently prepares the packed bare-RN consumer and compiles Android;
- `ios-showcase`: Expo Showcase prebuild/pods/Xcode simulator compile;
- `ios-bare`: independently prepares the packed bare-RN consumer and compiles iOS, eligible immediately after `classify`.

The barrier does not pass artifacts and is not a correctness dependency. The staged jobs use `always()` and retain their classifier conditions, so they still run for diagnostics even if a Showcase export fails. No native job depends on another native job. When `ios-bare` is still running as the export matrix completes, `ios-showcase` runs concurrently with it rather than waiting for the bare compile.

At repository level, the ordinary PR startup topology is shaped around the 20-job hosted concurrency budget. Core/required work plus the initial Expo-consumer work consumes the startup slots. `ios-bare` is released after the short classifier; the other three native jobs are released when the three Showcase export slots are freed. This keeps capacity saturated while preventing optional native work from racing required visual/a11y/web checks for the last startup slots.

## Pull-request policy

Every pull request, including a fork PR, runs the required hosted checks with `permissions: contents: read` and no repository secrets.

A pull request may skip the conditional native jobs only when every changed path is classified as safe for the corresponding graph. The safe surface remains intentionally narrow:

- `README.md`
- `CHANGELOG.md`
- `docs/**`
- `registry/**`
- `apps/visual-regression/**`
- `apps/showcase/__tests__/patterns/**`
- repository-local registry/CLI implementation files explicitly listed by the classifier

Production pattern implementation under `apps/showcase/patterns/**` is executable native Showcase input and remains native-sensitive. Unknown/new paths also remain native-sensitive by default. An empty changed-file list forces native verification as a fail-safe.

## Force native verification

Add `ci:native` to force the full compile graph on a pull request. The workflow subscribes to label changes, so the new run immediately uses the forced classification.

Runtime device smoke has a separate `ci:runtime` opt-in. A PR cannot self-trigger the runtime workflow merely by naming a fork branch `test/runtime-device-smoke`: that magic branch only works for same-repository PRs. A maintainer-applied `ci:runtime` label may explicitly opt a fork PR in; runtime checkout then fetches and verifies the exact fork head SHA.

## Main and scheduled policy

Pushes to `main` force the complete native compile graph. A weekly clean run catches hosted-image/toolchain drift when the repository is idle. `runtime-native.yml` separately runs real iOS Simulator and Android Emulator smoke on exact `main`, explicit runtime PRs, manual dispatch and its weekly backstop.

## Hosted-runner cache policy

Each hosted job starts on a fresh VM. Correctness never depends on local state surviving from a prior job or run.

Persist only caches with clear reuse value and bounded size: pnpm, CocoaPods downloads/specs, Gradle, Playwright browsers and Maestro. Xcode `DerivedData` is intentionally not stored in Actions cache; iOS jobs use deterministic job-local DerivedData and always execute a real current-source `xcodebuild`. The Android runtime workflow also avoids persisting its multi-GB AVD snapshot and creates a deterministic fresh AVD from the pinned system image on each proof run.

Generated Android projects are created after cache evaluation, so Gradle cache keys must come from checked-in inputs such as the lockfile, app manifest/package metadata and harness scripts. Keys based only on generated `*.gradle*` files silently collapse before prebuild and are forbidden by the CI contract tests.

On a Playwright browser-cache hit, workflows verify the cached browser without rerunning full Linux dependency provisioning. The visual workflow installs only the deterministic GNU Unifont fallback needed by the canonical baselines; the package installation itself refreshes fontconfig, so an extra global font-cache rebuild is intentionally avoided.

The bare React Native and Expo consumers are independently recreated in each parallel lane that needs them. This duplicates setup work intentionally: runner minutes are not the scarce resource, while eliminating unnecessary workspace-sharing chains reduces time-to-result.

## Maintenance rule

Keep the classifier conservative and the graph dependency-minimal. A job may depend on another job only when it consumes that job's result, is an intentional fan-in gate, or is staged specifically to respect the global concurrency budget. Do not serialize merely to reuse an ephemeral workspace. Prefer an extra parallel hosted job over an avoidable critical-path dependency while keeping total concurrency within GitHub account limits.
