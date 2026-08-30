---
name: beeui-github-hosted-ci-migration
description: BeeUI CI migrated off self-hosted Mars to free github-hosted runners (Aug 2026); android-runtime AVD boot gotcha and fix
metadata:
  type: project
---

BeeUI's CI (`.github/workflows/*.yml`) migrated from a single self-hosted "Mars"
runner to free github-hosted runners (`ubuntu-latest`/`macos-latest`) in
commit a6d33a3 (#329) + 4e59add (#330), ~2026-08-30. This supersedes any older
memory saying CI is self-hosted / blocked by billing — that's stale now.

**android-runtime job gotcha (fixed in PR #315, issue #126, head 50687aa):**
A manual `avdmanager create avd` + `emulator "@name"` launch in
`scripts/runtime-smoke/android.sh` failed on fresh `ubuntu-latest` runners with
`Unknown AVD name ... no file <name>.ini in $HOME/.android/avd`, even though
`avdmanager create avd` itself reported success. Root cause: `ubuntu-latest`
ships both a preinstalled SDK cmdline-tools version 2mismatch ("Wrong version
in preinstalled sdkmanager" in the "Setup Android SDK" step log) and a legacy
`tools/bin/avdmanager` shim alongside the versioned `cmdline-tools/*/bin/avdmanager`
— a classic dual-toolchain PATH conflict that writes the AVD somewhere `emulator`
never searches. Fix: replaced the manual create/boot/wait loop with
`reactivecircus/android-emulator-runner` (pinned by commit SHA), which owns
AVD create/boot/teardown reliably; `android.sh` now only detects the
already-booted `adb` device. See [[beeui-adr003-measurement-tick-budget]] for
the companion iOS finding from the same debugging pass.

**How to verify AVD/emulator failures on this repo going forward:** always
pull the exact failing step's log via `gh run view --job <id> --log-failed`
first — the failure is usually a fast (~2min), bounded, textual error, not a
hang, now that Mars self-hosted flakiness is gone.
