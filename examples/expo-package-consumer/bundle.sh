#!/usr/bin/env bash
# R10.1 (#230) acceptance evidence: a headless Metro export for Android, iOS,
# and Web via `expo export`, proving the packed BeeUI packages bundle cleanly
# through the Expo/Metro toolchain without a simulator/device.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

test -d node_modules || { echo "node_modules is missing; run setup.sh first." >&2; exit 1; }

echo "==> Exporting Expo bundles for Android, iOS, and Web (Metro, no simulator/device)"
npx expo export --platform all --output-dir dist

test -d dist/_expo/static/js/android || { echo "Expected Android bundle output missing under dist/_expo/static/js/android" >&2; exit 1; }
test -d dist/_expo/static/js/ios || { echo "Expected iOS bundle output missing under dist/_expo/static/js/ios" >&2; exit 1; }

echo "OK: Expo export produced Android, iOS, and Web bundle output under dist/."
