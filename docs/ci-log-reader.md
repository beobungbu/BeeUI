# CI native log error reader

Native CI logs (`ios-native`, `bare-native`, `ios-runtime`, `android-runtime` in `.github/workflows/ci.yml` / `runtime-native.yml`) are long, and the tail is almost always just:

```
##[error]Process completed with exit code 1.
```

That line never explains *why* — the real cause is earlier: a shell error, a Kotlin/Gradle failure, an Xcode/CocoaPods error, an Android emulator that never booted, or a failed Maestro assertion. `scripts/ci-native-error-reader.mjs` finds that line instead of making you scroll.

## Usage

```bash
# Fetch and analyze a specific failed job by its numeric job ID
node scripts/ci-native-error-reader.mjs --job <jobId>

# Resolve the failed job(s) of a run, optionally narrowed by job name substring
node scripts/ci-native-error-reader.mjs --run <runId>
node scripts/ci-native-error-reader.mjs --run <runId> --job ios

# Offline / already-downloaded log
node scripts/ci-native-error-reader.mjs --file path/to/job.log
cat job.log | node scripts/ci-native-error-reader.mjs
```

Exit code is `1` when a failure was found (safe to use in a script), `0` when the log shows no `##[error]` marker. If the run is still in progress, `gh` cannot download logs yet — the tool detects this and prints a clear message instead of an opaque `gh` error.

## What it does

1. Fetches the job log via `gh run view --job <id> --log-failed` (falls back to `--log` if that view is unavailable).
2. Parses GH Actions' `jobName\tstepName\ttimestamp message` line format and groups lines into the step that actually failed (the one containing `##[error]`).
3. Classifies the first line(s) in that step matching a platform-aware error taxonomy (shell/`unbound variable`, npm/`ERESOLVE`, CocoaPods `[!]`, Xcode `error:`/`BUILD FAILED`, Gradle `FAILURE: Build failed`/`Caused by:`, Kotlin `Unresolved reference`, Android emulator/AVD boot failures, Maestro assertion failures) — cascading errors mean the *first* match is usually the root cause; distinct categories in the same step are all reported.
4. Prints the failing job/step, a one-line classification, the error block with a few lines of surrounding context (prefix stripped), and the final `##[error]` line — a screenful, not the whole log.

## Example output

```
Failing step: ios-native / Prepare true bare React Native consumer for iOS
Classification: iOS: shell error in ./scripts/verify-bare-consumer.sh (line 108): extra_flags[@]: unbound variable

-- Root cause --
   /Users/runner/Library/Caches/BeeUI/bare-consumer/packages/beeui-ui-0.1.0.tgz
   ##[endgroup]
   ##[group]Install BeeUI tarballs and runtime styling dependencies
>> ./scripts/verify-bare-consumer.sh: line 108: extra_flags[@]: unbound variable

Final error line:
##[error]Process completed with exit code 1.
```

## Tests

`scripts/__tests__/ci-native-error-reader.test.mjs` runs the tool against four real, trimmed failure logs checked into `scripts/__tests__/fixtures/ci-logs/` (one per taxonomy: shell, Android AVD, Maestro, Kotlin) via `--file`, so the suite is deterministic and offline. Run with:

```bash
node --test scripts/__tests__/ci-native-error-reader.test.mjs
```
